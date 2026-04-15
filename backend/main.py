import sys
import os
import time
import uvicorn
import random

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
from fastapi import FastAPI, Depends, HTTPException, Body
from sqlalchemy.orm import Session
from core.database import get_db, engine, Base
from models.post import NewsPost
from typing import Any
from fastapi.middleware.cors import CORSMiddleware

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
