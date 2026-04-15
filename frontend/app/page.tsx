"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { Menu, X, Clock, TrendingUp, Lock, Unlock, Zap, Search } from "lucide-react";
import { CustomConnectButton } from "@/components/CustomConnectButton";
import { useSubscribe } from "@/hooks/useSubscribe";
import { useRouter } from "next/navigation";
import { useAccount } from "wagmi";

interface Article {
  id: number;
  title: string;
  content: string;
  category: string;
  author?: string;
  created_at?: string;
}

interface AuthUser {
  id: number;
  email: string;
  is_premium: boolean;
}

const API_BASE = "http://127.0.0.1:8000";
const AUTH_TOKEN_KEY = "guava_auth_token";

const GuavaLogo = ({ size = 32 }: { size?: number }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 100 100"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className="shrink-0 opacity-95"
  >
    <path
      d="M25 55C25 35 38 18 55 18C75 18 88 35 88 55C88 78 72 88 50 88C32 88 25 75 25 55Z"
      fill="#4ADE80"
      stroke="#16423C"
      strokeWidth="2"
    />
    <ellipse
      cx="45"
      cy="52"
      rx="22"
      ry="28"
      fill="#990000"
      transform="rotate(-15 45 52)"
    />
    <g transform="rotate(-15 45 52)">
      {[40, 45, 52, 59, 66].map((y, i) => (
        <circle
          key={i}
          cx={i % 2 === 0 ? 45 : i === 1 ? 52 : 38}
          cy={y}
          r="1.8"
          fill="white"
          fillOpacity="0.9"
        />
      ))}
    </g>
    <rect x="48" y="5" width="4" height="15" rx="2" fill="#16423C" />
  </svg>
);

const TRENDS = [
  { rank: 1, topic: "ActivityPub 2.0 协议标准提案", change: "+124%" },
  { rank: 2, topic: "ZK-EVM 主网开发者智库", change: "+89%" },
  { rank: 3, topic: "去中心化科学 (DeSci) 融资报告", change: "+56%" },
  { rank: 4, topic: "RWA 资产链上化法律框架", change: "+32%" },
];

const FOOTER_LINKS = {
  Support: ["Help Centre", "Subscription Sign Up", "Contact Us", "Accessibility"],
  Legal: ["Terms & Conditions", "Privacy Policy", "Cookie Policy", "Copyright"],
  Services: ["Newsletter", "Guava API Access", "Corporate Access", "Job Board"],
};

const CATEGORY_MAP: { [key: string]: string } = {
  Medicine: "医学研究",
  Technology: "Technology",
  Finance: "金融投资",
  Literature: "文学艺术",
  Tennis: "职业网球",
  "Network Noise": "网络噪音",
};

export default function Home() {
  const [mounted, setMounted] = useState(false);
  const [activeCategory, setActiveCategory] = useState("Technology");
  const [articles, setArticles] = useState<Article[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [newPost, setNewPost] = useState({ title: "", content: "" });
  const [authMode, setAuthMode] = useState<"login" | "register">("register");
  const [authForm, setAuthForm] = useState({ email: "", password: "" });
  const [authToken, setAuthToken] = useState("");
  const [authUser, setAuthUser] = useState<AuthUser | null>(null);
  const [authError, setAuthError] = useState("");
  const [authPending, setAuthPending] = useState(false);
  const [stripePending, setStripePending] = useState(false);
  const [billingNotice, setBillingNotice] = useState("");
  const [walletIsSubscribed, setWalletIsSubscribed] = useState(false);
  const { address, isConnected } = useAccount();
  const { handleSubscribe, txHash, isPending: walletSubscribePending, isSuccess: walletSubscribeSuccess } = useSubscribe();
  const subscriptionRef = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const categories = ["Technology", "Finance", "Literature", "Medicine", "Tennis", "Network Noise"];

  const getExpiryDate = () => {
    const date = new Date();
    date.setDate(date.getDate() + 30);
    return date.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
  };

  const fetchCurrentUser = async (token: string) => {
    const response = await fetch(`${API_BASE}/api/auth/me`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!response.ok) {
      throw new Error("Session expired");
    }
    const result = await response.json();
    const user = result.user as AuthUser;
    setAuthUser(user);
    return user;
  };

  const syncWalletSubscription = useCallback(async (walletAddress?: string) => {
    if (!walletAddress || !isConnected) {
      setWalletIsSubscribed(false);
      return false;
    }

    try {
      const response = await fetch(`${API_BASE}/api/wallet-subscriptions/${walletAddress.toLowerCase()}`);
      if (!response.ok) {
        throw new Error("Unable to load wallet subscription");
      }
      const result = await response.json();
      const nextState = Boolean(result.is_active);
      setWalletIsSubscribed(nextState);
      return nextState;
    } catch (error) {
      console.error("获取钱包订阅状态失败:", error);
      setWalletIsSubscribed(false);
      return false;
    }
  }, [isConnected]);

  const storeAuthSession = async (token: string, user?: AuthUser) => {
    localStorage.setItem(AUTH_TOKEN_KEY, token);
    setAuthToken(token);
    if (user) {
      setAuthUser(user);
      return;
    }
    await fetchCurrentUser(token);
  };

  const handleArticleClick = (articleId: number) => {
    if (!isSubscribed) {
      if (subscriptionRef.current) {
        subscriptionRef.current.scrollIntoView({ behavior: "smooth", block: "center" });
        subscriptionRef.current.classList.add("ring-2", "ring-[#FF8E9E]", "ring-offset-4", "duration-500");
        setTimeout(() => {
          subscriptionRef.current?.classList.remove("ring-2", "ring-[#FF8E9E]", "ring-offset-4");
        }, 2000);
      }
      return;
    }
    router.push(`/article/${articleId}`);
  };

  const handlePublish = async () => {
    if (!newPost.title || !newPost.content) {
      alert("请填写完整内容");
      return;
    }

    try {
      const response = await fetch(`${API_BASE}/api/articles`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: newPost.title,
          content: newPost.content,
          author: authUser?.email || "UserAddressOrID",
          protocol: "activity-pub",
          category: activeCategory,
        }),
      });

      if (response.ok) {
        alert(`成功发布到 [${activeCategory}] 分类`);
        setIsModalOpen(false);
        setNewPost({ title: "", content: "" });
      } else {
        alert("后端接口未就绪，但在控制台已打印数据");
        console.log("发送的数据:", newPost);
      }
    } catch (error) {
      console.error("发布失败:", error);
    }
  };

  const handleAuthSubmit = async () => {
    if (!authForm.email || !authForm.password) {
      setAuthError("Please enter both email and password.");
      return;
    }

    setAuthPending(true);
    setAuthError("");
    try {
      const response = await fetch(`${API_BASE}/api/auth/${authMode}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(authForm),
      });
      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.detail || "Authentication failed");
      }
      await storeAuthSession(result.token, result.user);
      setIsAuthModalOpen(false);
      setAuthForm({ email: "", password: "" });
    } catch (error) {
      setAuthError(error instanceof Error ? error.message : "Authentication failed");
    } finally {
      setAuthPending(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem(AUTH_TOKEN_KEY);
    setAuthToken("");
    setAuthUser(null);
    setIsSubscribed(walletIsSubscribed);
  };

  const handleStripeSubscribe = async () => {
    if (!authToken) {
      setAuthMode("register");
      setAuthError("Please sign in with email before starting a Stripe subscription.");
      setIsAuthModalOpen(true);
      return;
    }

    setStripePending(true);
    try {
      const response = await fetch(`${API_BASE}/api/billing/create-checkout-session`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify({
          success_url: `${window.location.origin}?billing=success`,
          cancel_url: `${window.location.origin}?billing=cancel`,
        }),
      });
      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.detail || "Unable to start Stripe checkout");
      }
      if (result.checkout_url) {
        window.location.href = result.checkout_url;
      }
    } catch (error) {
      alert(error instanceof Error ? error.message : "Stripe checkout failed");
    } finally {
      setStripePending(false);
    }
  };

  useEffect(() => {
    const bootstrapAuth = async () => {
      const savedToken = localStorage.getItem(AUTH_TOKEN_KEY) || "";
      const billingState = new URLSearchParams(window.location.search).get("billing");
      if (billingState === "success") {
        setBillingNotice("Stripe checkout completed. Refreshing your subscription status...");
      } else if (billingState === "cancel") {
        setBillingNotice("Stripe checkout was canceled.");
      }

      if (savedToken) {
        try {
          localStorage.setItem(AUTH_TOKEN_KEY, savedToken);
          setAuthToken(savedToken);
          const response = await fetch(`${API_BASE}/api/auth/me`, {
            headers: { Authorization: `Bearer ${savedToken}` },
          });
          if (!response.ok) {
            throw new Error("Session expired");
          }
          const result = await response.json();
          const user = result.user as AuthUser;
          setAuthUser(user);
        } catch {
          localStorage.removeItem(AUTH_TOKEN_KEY);
          setAuthToken("");
          setAuthUser(null);
        }
      }
    };

    bootstrapAuth();
  }, []);

  useEffect(() => {
    setIsSubscribed(Boolean(authUser?.is_premium) || walletIsSubscribed);
  }, [authUser, walletIsSubscribed]);

  useEffect(() => {
    if (!isConnected || !address) {
      setWalletIsSubscribed(false);
      return;
    }
    void syncWalletSubscription(address);
  }, [isConnected, address, syncWalletSubscription]);

  useEffect(() => {
    const confirmWalletSubscription = async () => {
      if (!walletSubscribeSuccess || !isConnected || !address) {
        return;
      }

      try {
        const response = await fetch(`${API_BASE}/api/wallet-subscriptions/confirm`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            wallet_address: address,
            tx_hash: txHash ?? null,
          }),
        });
        if (!response.ok) {
          throw new Error("Unable to confirm wallet subscription");
        }
        await syncWalletSubscription(address);
        setBillingNotice("Wallet subscription confirmed for the connected address.");
      } catch (error) {
        console.error("确认钱包订阅失败:", error);
        setBillingNotice("Wallet payment succeeded, but subscription sync needs a retry.");
      }
    };

    void confirmWalletSubscription();
  }, [walletSubscribeSuccess, isConnected, address, txHash, syncWalletSubscription]);

  useEffect(() => {
    const fetchArticles = async () => {
      setIsLoading(true);
      try {
        const response = await fetch(`${API_BASE}/api/articles`);
        const result = await response.json();
        const rawData = Array.isArray(result) ? result : result.articles || result.data || [];
        const targetCategory = CATEGORY_MAP[activeCategory] || activeCategory;

        const filtered = rawData
          .filter((a: Article) => a.category === activeCategory || a.category === targetCategory)
          .sort((a: Article, b: Article) => {
            const dateA = a.created_at ? new Date(a.created_at).getTime() : 0;
            const dateB = b.created_at ? new Date(b.created_at).getTime() : 0;
            return dateB - dateA;
          });

        setArticles(filtered);
      } catch (error) {
        console.error("获取新闻失败:", error);
        setArticles([]);
      } finally {
        setIsLoading(false);
      }
    };

    if (mounted) {
      fetchArticles();
    }
  }, [activeCategory, mounted]);

  useEffect(() => setMounted(true), []);

  if (!mounted) {
    return <div className="min-h-screen bg-[#FFF1E5]" />;
  }

  return (
    <div className="min-h-screen bg-[#FFF1E5] text-[#333333] font-serif transition-all duration-700 selection:bg-[#FF8F00] selection:text-white">
      <div
        className={`fixed inset-0 z-[100] transition-opacity duration-300 ${isMenuOpen ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"}`}
      >
        <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setIsMenuOpen(false)} />
        <aside
          className={`absolute top-0 left-0 h-full w-[280px] bg-white shadow-2xl transition-transform duration-500 transform ${isMenuOpen ? "translate-x-0" : "-translate-x-full"}`}
        >
          <div className="p-6 flex justify-between items-center border-b border-black/5">
            <span className="font-sans font-black text-[10px] uppercase tracking-[0.3em]">Quick Access</span>
            <X size={20} className="cursor-pointer" onClick={() => setIsMenuOpen(false)} />
          </div>
          <nav className="p-6 space-y-4">
            {categories.map((cat) => (
              <button
                key={cat}
                onClick={() => {
                  setActiveCategory(cat);
                  setIsMenuOpen(false);
                }}
                className="block w-full text-left font-sans font-black uppercase text-sm hover:text-[#990000]"
              >
                {cat}
              </button>
            ))}
          </nav>
        </aside>
      </div>

      <nav className="border-b border-black/10 px-6 py-1.5 flex justify-between items-center text-[9px] font-sans font-black uppercase tracking-[0.2em] bg-[#FFF1E5]/80 backdrop-blur-md sticky top-0 z-50">
        <div className="flex gap-6 items-center">
          <Menu size={16} className="cursor-pointer" onClick={() => setIsMenuOpen(true)} />
          <span className="hidden md:inline font-serif font-bold italic">
            {new Date().toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" })}
          </span>
        </div>
        <div className="flex items-center gap-4">
          {authUser ? (
            <div className="hidden md:flex items-center gap-2 border border-black px-2.5 py-1 bg-white text-[9px] font-sans font-black uppercase tracking-[0.2em]">
              <span className="max-w-[160px] truncate">{authUser.email}</span>
              <button onClick={handleLogout} className="text-[#990000] hover:text-black transition-colors">
                Logout
              </button>
            </div>
          ) : (
            <button
              onClick={() => setIsAuthModalOpen(true)}
              className="hidden md:flex items-center gap-1.5 border border-black px-2.5 py-1 hover:bg-black hover:text-white transition-all"
            >
              <span>Email Login</span>
            </button>
          )}
          <button
            onClick={async () => {
              if (confirm("确定清理所有测试数据和重复文章吗？")) {
                try {
                  await fetch(`${API_BASE}/api/articles/clear-test-data`, { method: "DELETE" });
                  setArticles([]);
                  window.location.reload();
                } catch (err) {
                  console.error("Cleanup failed:", err);
                  alert("清理失败，请检查后端服务是否运行");
                }
              }
            }}
            className="hidden md:flex items-center gap-1.5 border border-red-500/30 px-2.5 py-1 text-red-600 hover:bg-red-500 hover:text-white transition-all text-[9px] tracking-tighter"
          >
            <span>WIPE TEST DATA</span>
          </button>
          <button
            onClick={() => setIsModalOpen(true)}
            className="hidden md:flex items-center gap-1.5 border border-black px-2.5 py-1 hover:bg-black hover:text-white transition-all"
          >
            <Zap size={10} fill="currentColor" />
            <span>Submit</span>
          </button>
          <CustomConnectButton />
        </div>
      </nav>

      <header className="py-12 text-center border-b border-black/10 mx-6">
        <div className="inline-flex items-center gap-6">
          <GuavaLogo size={58} />
          <h1 className="text-4xl md:text-5xl font-serif font-black tracking-tight uppercase leading-none opacity-95 select-none text-center">
            GUAVA
          </h1>
        </div>
        <p className="mt-4 font-sans text-[10px] font-black uppercase tracking-[0.6em] opacity-40 italic">
          Global Consensus & Intelligence Network
        </p>
      </header>

      <div className="mx-6 border-b-2 border-black py-4 sticky top-[49px] bg-[#FFF1E5] z-40">
        <div className="max-w-[1300px] mx-auto flex flex-col md:flex-row justify-between items-center gap-6">
          <ul className="flex justify-center gap-10 font-sans text-xl font-black uppercase tracking-widest overflow-x-auto no-scrollbar">
            {categories.map((cat) => (
              <li key={cat}>
                <button
                  onClick={() => setActiveCategory(cat)}
                  className={`transition-all duration-300 relative pb-1 whitespace-nowrap ${activeCategory === cat ? "text-[#990000]" : "text-black/80 hover:text-black"}`}
                >
                  {cat}
                  {activeCategory === cat && <span className="absolute bottom-0 left-0 w-full h-[3px] bg-[#990000]" />}
                </button>
              </li>
            ))}
          </ul>

          <div className="relative group w-full md:w-64">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-black/60 group-focus-within:text-[#990000] transition-colors" />
            <input
              type="text"
              placeholder="SEARCH INTELLIGENCE..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-black/5 border-none py-2 pl-9 pr-4 font-sans text-[10px] font-bold tracking-widest focus:outline-none focus:bg-black/10 transition-all rounded-sm uppercase"
            />
          </div>
        </div>
      </div>

      <main className="max-w-[1300px] mx-auto px-6 py-12 grid grid-cols-12 gap-12 min-h-[60vh]">
        <div className="col-span-12 lg:col-span-8 space-y-12">
          {isLoading ? (
            <div className="py-20 text-center font-sans animate-pulse">Syncing with Protocol...</div>
          ) : articles.length > 0 ? (
            articles.map((article) => (
              <article
                key={article.id}
                onClick={() => handleArticleClick(article.id)}
                className="group cursor-pointer border-b border-black/5 pb-10 flex flex-col md:flex-row gap-8 items-start transition-opacity hover:opacity-80 rounded-sm"
              >
                <div className="flex-1">
                  <div className="text-[10px] font-sans font-bold uppercase tracking-widest text-[#990000] mb-3 flex items-center gap-2">
                    <Zap size={10} fill="currentColor" /> {article.category} / Intelligence
                  </div>
                  <h3 className="text-2xl font-bold leading-tight mb-4 flex items-center gap-2 group-hover:underline decoration-1 decoration-[#990000]">
                    {article.title}
                    {isSubscribed ? (
                      <Unlock size={18} className="text-green-600 shrink-0 transform translate-y-1" />
                    ) : (
                      <Lock size={18} className="text-gray-300 shrink-0 transform translate-y-1" />
                    )}
                  </h3>
                  <p className="text-sm text-gray-600 leading-relaxed line-clamp-3 font-serif opacity-80 italic">
                    {isSubscribed ? article.content : `${article.content?.substring(0, 100)}...`}
                  </p>
                  <div className="mt-6 flex items-center gap-4 text-[10px] font-sans font-bold uppercase opacity-40">
                    <span className="flex items-center gap-1">
                      <Clock size={12} /> {article.created_at ? new Date(article.created_at).toLocaleDateString() : "RECENT"}
                    </span>
                    <span className="flex items-center gap-1">BY: {article.author || "AGENT_NEON"}</span>
                    <span className={isSubscribed ? "text-black" : "text-[#990000] italic"}>
                      {isSubscribed ? "Full Access" : "Premium Required"}
                    </span>
                  </div>
                </div>
                <div className="w-full md:w-36 h-24 bg-gray-200 grayscale opacity-20 border border-black/5 rounded-sm" />
              </article>
            ))
          ) : (
            <div className="py-20 text-center font-serif italic opacity-40">
              No intelligence recorded in [{activeCategory}] segment yet.
            </div>
          )}
        </div>

        <aside className="col-span-12 lg:col-span-4 space-y-10">
          <section
            ref={subscriptionRef}
            className={`p-8 border-t-2 transition-all duration-700 rounded-sm sticky top-[120px] ${isSubscribed ? "bg-white border-green-600 text-black shadow-lg" : "bg-black border-[#990000] text-[#FFF1E5]"}`}
          >
            <div className="mb-8 flex justify-between items-start">
              <div>
                <h4 className="font-sans font-bold text-[9px] uppercase tracking-[0.2em] opacity-50 mb-1">
                  Guava Premium Access
                </h4>
                <div className="text-2xl font-bold italic leading-none tracking-tighter">
                  {isSubscribed ? "Welcome back, Subscriber." : "Subscribe with email and Stripe."}
                </div>
              </div>
              <Zap size={14} className={isSubscribed ? "text-green-600" : "text-[#990000]"} fill="currentColor" />
            </div>

            {isSubscribed ? (
              <div className="space-y-6">
                <p className="text-[11px] leading-relaxed text-gray-700 font-serif italic border-l-2 border-green-500 pl-3">
                  Your premium access is active. Full reports are now unlocked across the site.
                </p>
                <div className="pt-4 border-t border-black/5 space-y-4">
                  <div className="flex justify-between items-end">
                    <div className="flex flex-col gap-1">
                      <span className="text-[9px] font-sans font-black uppercase opacity-40 tracking-widest">Total Duration</span>
                      <span className="text-xl font-black font-sans text-black italic leading-none">30 DAYS</span>
                    </div>
                    <div className="flex flex-col gap-1 text-right">
                      <span className="text-[9px] font-sans font-black uppercase opacity-40 tracking-widest text-[#990000]">
                        Terminates On
                      </span>
                      <span className="text-sm font-bold font-sans text-[#990000] tracking-tight underline decoration-red-200 underline-offset-4">
                        {getExpiryDate()}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-6">
                <p className="text-[11px] opacity-70 leading-relaxed font-serif">
                  Use your email account for membership access, then complete Stripe checkout to unlock premium intelligence.
                </p>
                <div className="py-4 border-y border-white/10 flex justify-between items-center text-[10px] font-sans font-black uppercase tracking-widest text-white/50">
                  Monthly Pass
                  <span className="text-3xl font-black text-white">$20</span>
                </div>
                <button
                  disabled={stripePending}
                  onClick={(e) => {
                    e.stopPropagation();
                    handleStripeSubscribe();
                  }}
                  className="w-full bg-[#990000] text-white py-4 font-sans text-[11px] font-black uppercase tracking-[0.3em] hover:bg-white hover:text-black transition-all disabled:opacity-50"
                >
                  {stripePending ? "Starting Stripe..." : "Subscribe With Stripe"}
                </button>
                <button
                  disabled={!isConnected || walletSubscribePending}
                  onClick={(e) => {
                    e.stopPropagation();
                    handleSubscribe();
                  }}
                  className="w-full border border-white/30 text-white py-4 font-sans text-[11px] font-black uppercase tracking-[0.3em] hover:bg-white hover:text-black transition-all disabled:opacity-40"
                >
                  {walletSubscribePending ? "Waiting For Wallet..." : "Use Wallet Prototype"}
                </button>
                {billingNotice && <p className="text-[10px] font-sans opacity-60">{billingNotice}</p>}
                {!isConnected && (
                  <p className="text-[10px] font-sans opacity-60">
                    Wallet subscription status only appears when the paying wallet is connected.
                  </p>
                )}
              </div>
            )}
          </section>

          <section className="pt-6 border-t border-black">
            <h4 className="font-sans font-black text-[10px] uppercase tracking-[0.3em] mb-6 flex items-center gap-2">
              <TrendingUp size={14} /> Breaking News
            </h4>
            <div className="space-y-6">
              {TRENDS.map((item) => (
                <div key={item.rank} className="flex gap-4 group cursor-pointer border-b border-black/5 pb-3">
                  <span className="text-xl font-serif font-black opacity-10 group-hover:opacity-100 italic transition-opacity">
                    0{item.rank}
                  </span>
                  <div>
                    <h5 className="text-[13px] font-bold leading-tight mb-1 group-hover:underline">{item.topic}</h5>
                    <div className="text-[8px] font-sans font-bold text-green-700 uppercase tracking-tighter">
                      {item.change} Momentum
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>
        </aside>
      </main>

      <footer className="mt-20 border-t-2 border-black bg-white/40 pt-16 pb-12 mx-6">
        <div className="max-w-[1300px] mx-auto text-center md:text-left">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-12 mb-16">
            <div className="lg:col-span-2 space-y-6">
              <div className="flex items-center gap-3 justify-center md:justify-start">
                <GuavaLogo size={28} />
                <div className="text-4xl font-extrabold italic text-[#1a1a1a]">GUAVA</div>
              </div>
              <p className="text-xs text-gray-500 font-serif leading-relaxed max-w-sm mx-auto md:mx-0">
                作为全球领先的去中心化媒体网络，番石榴新闻致力于通过 Web3 协议与链上共识机制，提供真实、透明且不可篡改的资讯服务。
              </p>
            </div>
            {Object.entries(FOOTER_LINKS).map(([title, links]) => (
              <div key={title} className="space-y-5">
                <h5 className="font-sans font-black text-[10px] uppercase tracking-[0.2em] text-[#990000]">{title}</h5>
                <ul className="space-y-3">
                  {links.map((link) => (
                    <li key={link} className="text-[11px] font-sans font-bold text-gray-500 hover:text-black cursor-pointer">
                      {link}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
          <div className="pt-8 border-t border-black/5 flex flex-col md:flex-row justify-between items-center gap-6 text-[9px] font-sans font-bold text-gray-400 uppercase tracking-widest">
            <div>© 2026 GUAVA INTELLIGENCE NETWORK.</div>
            <div className="flex gap-8">
              <span className="flex items-center gap-1.5 text-green-600">
                Network <div className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse" /> Synced
              </span>
            </div>
          </div>
        </div>
      </footer>

      {isModalOpen && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setIsModalOpen(false)} />
          <div className="relative bg-[#FFF1E5] border-2 border-black w-full max-w-2xl p-8 shadow-[12px_12px_0px_0px_rgba(0,0,0,1)]">
            <div className="flex justify-between items-center mb-6 border-b-2 border-black pb-4">
              <h2 className="text-2xl font-black italic uppercase tracking-tight">Broadcast to Network</h2>
              <X size={24} className="cursor-pointer hover:rotate-90 transition-transform" onClick={() => setIsModalOpen(false)} />
            </div>
            <div className="space-y-6">
              <div>
                <label className="block text-[10px] font-black uppercase tracking-widest mb-2 text-black">Headline</label>
                <input
                  type="text"
                  value={newPost.title}
                  onChange={(e) => setNewPost({ ...newPost, title: e.target.value })}
                  className="w-full bg-transparent border-b-2 border-black/20 focus:border-black outline-none py-2 font-serif text-xl italic text-black"
                  placeholder="Enter article title..."
                />
              </div>
              <div>
                <label className="block text-[10px] font-black uppercase tracking-widest mb-2 text-black">Intelligence Content</label>
                <textarea
                  rows={6}
                  value={newPost.content}
                  onChange={(e) => setNewPost({ ...newPost, content: e.target.value })}
                  className="w-full bg-white/50 border-2 border-black/10 focus:border-black outline-none p-4 font-serif text-sm leading-relaxed text-black"
                  placeholder="What's happening in the Fediverse?"
                />
              </div>
              <button
                onClick={handlePublish}
                className="w-full bg-[#990000] text-white py-4 font-sans text-xs font-black uppercase tracking-[0.4em] hover:bg-black transition-all"
              >
                Publish to Protocol
              </button>
            </div>
          </div>
        </div>
      )}

      {isAuthModalOpen && (
        <div className="fixed inset-0 z-[220] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setIsAuthModalOpen(false)} />
          <div className="relative w-full max-w-md bg-[#FFF1E5] border-2 border-black p-8 shadow-[12px_12px_0px_0px_rgba(0,0,0,1)]">
            <div className="flex justify-between items-center mb-6 border-b-2 border-black pb-4">
              <div>
                <h2 className="text-2xl font-black italic uppercase tracking-tight">Email Access</h2>
                <p className="text-[10px] font-sans font-bold uppercase tracking-[0.2em] opacity-50 mt-2">
                  Register or sign in before Stripe checkout
                </p>
              </div>
              <X size={24} className="cursor-pointer hover:rotate-90 transition-transform" onClick={() => setIsAuthModalOpen(false)} />
            </div>
            <div className="flex gap-2 mb-6">
              <button
                onClick={() => setAuthMode("register")}
                className={`flex-1 border px-3 py-2 text-[10px] font-sans font-black uppercase tracking-[0.2em] ${authMode === "register" ? "bg-black text-white border-black" : "border-black/20"}`}
              >
                Register
              </button>
              <button
                onClick={() => setAuthMode("login")}
                className={`flex-1 border px-3 py-2 text-[10px] font-sans font-black uppercase tracking-[0.2em] ${authMode === "login" ? "bg-black text-white border-black" : "border-black/20"}`}
              >
                Login
              </button>
            </div>
            <div className="space-y-5">
              <div>
                <label className="block text-[10px] font-black uppercase tracking-widest mb-2 text-black">Email</label>
                <input
                  type="email"
                  value={authForm.email}
                  onChange={(e) => setAuthForm({ ...authForm, email: e.target.value })}
                  className="w-full bg-white/70 border border-black/10 focus:border-black outline-none px-4 py-3 font-sans text-sm"
                  placeholder="name@example.com"
                />
              </div>
              <div>
                <label className="block text-[10px] font-black uppercase tracking-widest mb-2 text-black">Password</label>
                <input
                  type="password"
                  value={authForm.password}
                  onChange={(e) => setAuthForm({ ...authForm, password: e.target.value })}
                  className="w-full bg-white/70 border border-black/10 focus:border-black outline-none px-4 py-3 font-sans text-sm"
                  placeholder="At least 8 characters"
                />
              </div>
              {authError && <p className="text-[11px] font-sans text-[#990000]">{authError}</p>}
              <button
                onClick={handleAuthSubmit}
                disabled={authPending}
                className="w-full bg-[#990000] text-white py-4 font-sans text-xs font-black uppercase tracking-[0.4em] hover:bg-black transition-all disabled:opacity-50"
              >
                {authPending ? "Please Wait" : authMode === "register" ? "Create Account" : "Sign In"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
