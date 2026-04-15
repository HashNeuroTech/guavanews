import sys
import os
import time
import uvicorn
import random
import base64
import hashlib
import hmac
import json
import secrets

# 1. 环境路径对齐
current_dir = os.path.dirname(os.path.abspath(__file__))
if current_dir not in sys.path:
    sys.path.append(current_dir)

from crewai import Crew, Process
from agents.scout import scout_agent
from agents.writer import neon_agent, cipher_agent
from agents.publisher import publisher_agent
from tasks.news_tasks import create_editorial_tasks

# FastAPI 相关导入
from fastapi import FastAPI, Depends, HTTPException, Body, Header, Request
from sqlalchemy.orm import Session
from core.database import get_db, engine, Base
from models.post import NewsPost
from models.user import User
from models.wallet_subscription import WalletSubscription
from typing import Any
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import requests

# --- 后端初始化 ---
Base.metadata.create_all(bind=engine)
app = FastAPI(title="Guava Editorial API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

AUTH_SECRET = os.getenv("AUTH_SECRET", "guava-dev-auth-secret")
FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:3000")
STRIPE_SECRET_KEY = os.getenv("STRIPE_SECRET_KEY", "")
STRIPE_PRICE_ID = os.getenv("STRIPE_PRICE_ID", "")
STRIPE_WEBHOOK_SECRET = os.getenv("STRIPE_WEBHOOK_SECRET", "")
STRIPE_API_BASE = "https://api.stripe.com/v1"


class AuthPayload(BaseModel):
    email: str
    password: str


class CheckoutPayload(BaseModel):
    success_url: str | None = None
    cancel_url: str | None = None


class WalletSubscriptionPayload(BaseModel):
    wallet_address: str
    tx_hash: str | None = None


def _hash_password(password: str, salt: str | None = None) -> str:
    salt = salt or secrets.token_hex(16)
    hashed = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt.encode("utf-8"), 100000)
    return f"{salt}${base64.b64encode(hashed).decode('ascii')}"


def _verify_password(password: str, stored_hash: str) -> bool:
    try:
        salt, expected = stored_hash.split("$", 1)
    except ValueError:
        return False
    candidate = _hash_password(password, salt)
    return hmac.compare_digest(candidate, f"{salt}${expected}")


def _b64url_encode(raw: bytes) -> str:
    return base64.urlsafe_b64encode(raw).rstrip(b"=").decode("ascii")


def _b64url_decode(value: str) -> bytes:
    padding = "=" * (-len(value) % 4)
    return base64.urlsafe_b64decode(value + padding)


def _create_auth_token(user: User) -> str:
    payload = {
        "user_id": user.id,
        "email": user.email,
        "is_premium": user.is_premium,
        "exp": int(time.time()) + 60 * 60 * 24 * 7,
    }
    encoded_payload = _b64url_encode(json.dumps(payload, separators=(",", ":")).encode("utf-8"))
    signature = hmac.new(AUTH_SECRET.encode("utf-8"), encoded_payload.encode("ascii"), hashlib.sha256).digest()
    return f"{encoded_payload}.{_b64url_encode(signature)}"


def _decode_auth_token(token: str) -> dict[str, Any]:
    try:
        encoded_payload, encoded_signature = token.split(".", 1)
    except ValueError as exc:
        raise HTTPException(status_code=401, detail="Invalid token") from exc

    expected_signature = hmac.new(
        AUTH_SECRET.encode("utf-8"),
        encoded_payload.encode("ascii"),
        hashlib.sha256,
    ).digest()
    actual_signature = _b64url_decode(encoded_signature)
    if not hmac.compare_digest(expected_signature, actual_signature):
        raise HTTPException(status_code=401, detail="Invalid token signature")

    payload = json.loads(_b64url_decode(encoded_payload).decode("utf-8"))
    if payload.get("exp", 0) < int(time.time()):
        raise HTTPException(status_code=401, detail="Token expired")
    return payload


def _get_bearer_token(authorization: str | None) -> str:
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing bearer token")
    return authorization.removeprefix("Bearer ").strip()


def _serialize_user(user: User) -> dict[str, Any]:
    return {
        "id": user.id,
        "email": user.email,
        "is_premium": user.is_premium,
        "created_at": user.created_at.isoformat() if user.created_at else None,
    }


def _normalize_wallet_address(wallet_address: str) -> str:
    normalized = wallet_address.strip().lower()
    if not normalized:
        raise HTTPException(status_code=400, detail="Wallet address is required")
    return normalized


def _get_current_user(db: Session, authorization: str | None) -> User:
    token = _get_bearer_token(authorization)
    payload = _decode_auth_token(token)
    user = db.query(User).filter(User.id == payload["user_id"]).first()
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    return user


def _verify_stripe_signature(body: bytes, stripe_signature: str) -> None:
    if not STRIPE_WEBHOOK_SECRET:
        raise HTTPException(status_code=500, detail="Missing STRIPE_WEBHOOK_SECRET")

    timestamp = ""
    expected_signature = ""
    for part in stripe_signature.split(","):
        if part.startswith("t="):
            timestamp = part.split("=", 1)[1]
        elif part.startswith("v1="):
            expected_signature = part.split("=", 1)[1]

    if not timestamp or not expected_signature:
        raise HTTPException(status_code=400, detail="Invalid Stripe signature header")

    signed_payload = f"{timestamp}.{body.decode('utf-8')}".encode("utf-8")
    computed_signature = hmac.new(
        STRIPE_WEBHOOK_SECRET.encode("utf-8"),
        signed_payload,
        hashlib.sha256,
    ).hexdigest()
    if not hmac.compare_digest(computed_signature, expected_signature):
        raise HTTPException(status_code=400, detail="Invalid Stripe signature")


@app.get("/api/health")
async def healthcheck():
    return {"status": "ok"}


@app.post("/api/auth/register")
async def register(payload: AuthPayload, db: Session = Depends(get_db)):
    existing_user = db.query(User).filter(User.email == payload.email).first()
    if existing_user:
        raise HTTPException(status_code=409, detail="Email already registered")
    if len(payload.password) < 8:
        raise HTTPException(status_code=400, detail="Password must be at least 8 characters")

    user = User(email=payload.email.lower(), password_hash=_hash_password(payload.password))
    db.add(user)
    db.commit()
    db.refresh(user)
    return {"token": _create_auth_token(user), "user": _serialize_user(user)}


@app.post("/api/auth/login")
async def login(payload: AuthPayload, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == payload.email.lower()).first()
    if not user or not _verify_password(payload.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Invalid email or password")
    return {"token": _create_auth_token(user), "user": _serialize_user(user)}


@app.get("/api/auth/me")
async def me(
    authorization: str | None = Header(default=None),
    db: Session = Depends(get_db),
):
    user = _get_current_user(db, authorization)
    return {"user": _serialize_user(user)}


@app.post("/api/billing/create-checkout-session")
async def create_checkout_session(
    payload: CheckoutPayload,
    authorization: str | None = Header(default=None),
    db: Session = Depends(get_db),
):
    user = _get_current_user(db, authorization)
    if not STRIPE_SECRET_KEY or not STRIPE_PRICE_ID:
        raise HTTPException(status_code=500, detail="Stripe is not configured")

    success_url = payload.success_url or f"{FRONTEND_URL}?billing=success"
    cancel_url = payload.cancel_url or f"{FRONTEND_URL}?billing=cancel"
    request_payload = {
        "mode": "subscription",
        "success_url": success_url,
        "cancel_url": cancel_url,
        "line_items[0][price]": STRIPE_PRICE_ID,
        "line_items[0][quantity]": "1",
        "customer_email": user.email,
        "client_reference_id": str(user.id),
        "metadata[user_id]": str(user.id),
    }
    if user.stripe_customer_id:
        request_payload["customer"] = user.stripe_customer_id
        request_payload.pop("customer_email", None)

    response = requests.post(
        f"{STRIPE_API_BASE}/checkout/sessions",
        headers={"Authorization": f"Bearer {STRIPE_SECRET_KEY}"},
        data=request_payload,
        timeout=30,
    )
    if response.status_code >= 400:
        raise HTTPException(status_code=500, detail=f"Stripe checkout failed: {response.text}")

    session = response.json()
    return {"checkout_url": session.get("url"), "session_id": session.get("id")}


@app.post("/api/billing/stripe-webhook")
async def stripe_webhook(request: Request, db: Session = Depends(get_db)):
    body = await request.body()
    stripe_signature = request.headers.get("Stripe-Signature", "")
    _verify_stripe_signature(body, stripe_signature)
    event = json.loads(body.decode("utf-8"))

    if event.get("type") == "checkout.session.completed":
        session_data = event.get("data", {}).get("object", {})
        user_id = session_data.get("metadata", {}).get("user_id") or session_data.get("client_reference_id")
        if user_id:
            user = db.query(User).filter(User.id == int(user_id)).first()
            if user:
                user.is_premium = True
                user.stripe_customer_id = session_data.get("customer")
                db.commit()

    return {"received": True}


@app.get("/api/wallet-subscriptions/{wallet_address}")
async def get_wallet_subscription(wallet_address: str, db: Session = Depends(get_db)):
    normalized_address = _normalize_wallet_address(wallet_address)
    subscription = (
        db.query(WalletSubscription)
        .filter(WalletSubscription.wallet_address == normalized_address)
        .first()
    )
    return {
        "wallet_address": normalized_address,
        "is_active": bool(subscription and subscription.is_active),
    }


@app.post("/api/wallet-subscriptions/confirm")
async def confirm_wallet_subscription(
    payload: WalletSubscriptionPayload,
    db: Session = Depends(get_db),
):
    normalized_address = _normalize_wallet_address(payload.wallet_address)
    subscription = (
        db.query(WalletSubscription)
        .filter(WalletSubscription.wallet_address == normalized_address)
        .first()
    )

    if subscription:
        subscription.is_active = True
        if payload.tx_hash:
            subscription.tx_hash = payload.tx_hash
    else:
        subscription = WalletSubscription(
            wallet_address=normalized_address,
            is_active=True,
            tx_hash=payload.tx_hash,
        )
        db.add(subscription)

    db.commit()
    db.refresh(subscription)
    return {
        "wallet_address": subscription.wallet_address,
        "is_active": subscription.is_active,
        "tx_hash": subscription.tx_hash,
    }

# --- 核心：全兼容文章接收接口 ---

@app.post("/api/articles")
async def handle_article_submission(submission: Any = Body(...), db: Session = Depends(get_db)):
    """
    大一统接口：
    1. 接收来自 Agent 的自动投递 (Any 类型，兼容 Dict 和 List)
    2. 接收来自前端的手动投稿
    """
    try:
        # 兼容性处理：全部转为列表
        items = submission if isinstance(submission, list) else [submission]

        added_posts = []
        for p in items:
            # 字段提取：兼容 content/body, title/headline 等各种可能
            content = p.get("content") or p.get("body") or ""
            title = p.get("title") or (content.split('\n')[0][:40] if content else "AI Generated News")
            category = p.get("category") or "Technology"
            author = p.get("author") or "AGENT_NEON"
            language = p.get("language") or "zh"

            # 去重判断：防止重复入库
            existing = db.query(NewsPost).filter(NewsPost.title == title).first()
            if existing:
                print(f"⏩ 跳过重复内容: {title[:20]}...")
                continue

            db_post = NewsPost(
                title=title,
                content=content,
                author=author,
                category=category,
                language=language,
            )
            added_posts.append(db_post)

        if added_posts:
            db.add_all(added_posts)
            db.commit()
            print(f"✅ 成功存入 {len(added_posts)} 篇文章！")
            return {"status": "success", "count": len(added_posts)}

        return {"status": "ignored", "message": "无有效内容或内容已存在"}

    except Exception as e:
        db.rollback()
        print(f"❌ 写入数据库失败: {e}")
        return {"status": "error", "detail": str(e)}


@app.get("/api/articles")
async def get_articles(db: Session = Depends(get_db)):
    """获取所有新闻给前端展示"""
    try:
        return db.query(NewsPost).order_by(NewsPost.id.desc()).all()
    except Exception as e:
        print(f"❌ 获取文章失败: {e}")
        raise HTTPException(status_code=500, detail="Database fetch error")


@app.delete("/api/articles/clear-test-data")
async def clear_test_articles(db: Session = Depends(get_db)):
    """一键清理测试数据"""
    try:
        db.query(NewsPost).filter(
            (NewsPost.author == "AGENT_NEON")
            | (NewsPost.title.contains("poisonedRag"))
            | (NewsPost.category == "Network Noise")
        ).delete(synchronize_session=False)
        db.commit()
        return {"status": "success", "message": "Test data wiped."}
    except Exception as e:
        db.rollback()
        return {"status": "error", "detail": str(e)}


# --- 执行引擎部分 ---

def start_guava_editorial():
    print("\n" + "🚀" * 10)
    print("GUAVA 全能数字编辑部启动 (M2 硬件保护模式)")
    print("目标领域: [金融, 科技, 医学, 网球, 艺术]")
    print("🚀" * 10 + "\n")

    writer_choice = random.choice([neon_agent, cipher_agent])
    language_label = "中文 (Neon)" if writer_choice == neon_agent else "English (Cipher)"
    print(f"🎲 今日轮值记者: {language_label}")

    tasks = create_editorial_tasks(scout_agent, writer_choice, publisher_agent)

    guava_crew = Crew(
        agents=[scout_agent, writer_choice, publisher_agent],
        tasks=tasks,
        process=Process.sequential,
        verbose=True,
    )

    print(f"📡 任务队列已就绪，共计 {len(tasks)} 个步骤。正在深度采集素材...")

    try:
        start_time = time.time()
        result = guava_crew.kickoff()
        duration = round((time.time() - start_time) / 60, 2)
        print(f"\n✅ 今日快讯生成完毕！耗时: {duration} 分钟\n")
        return result
    except Exception as e:
        print(f"💥 运行过程中出现崩溃: {e}")
        return None


if __name__ == "__main__":
    uvicorn.run(app, host="127.0.0.1", port=8000)
