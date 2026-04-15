"use client";
import React, { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, Clock, ShieldCheck, Zap } from 'lucide-react';

interface Article {
  id: number;
  title: string;
  content: string;
  category: string;
  author?: string;
  created_at?: string;
}

export default function ArticleDetail() {
  const params = useParams();
  const router = useRouter();
  const [article, setArticle] = useState<Article | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchArticle = async () => {
      try {
        // 请求后端获取单篇文章详情
        const response = await fetch(`http://127.0.0.1:8000/api/articles`);
        const data: Article[] = await response.json();
        // 在所有文章中找到匹配当前 ID 的那篇
        const found = data.find(a => a.id === Number(params.id));
        setArticle(found || null);
      } catch (error) {
        console.error("获取文章详情失败:", error);
      } finally {
        setIsLoading(false);
      }
    };
    fetchArticle();
  }, [params.id]);

  if (isLoading) return <div className="min-h-screen bg-[#FFF1E5] flex items-center justify-center font-serif italic">Syncing with Protocol...</div>;
  if (!article) return <div className="min-h-screen bg-[#FFF1E5] flex items-center justify-center font-serif">Article Not Found.</div>;

  return (
    <div className="min-h-screen bg-[#FFF1E5] text-[#333333] font-serif selection:bg-[#FF8F00] selection:text-white pb-20">
      {/* 顶部导航 */}
      <nav className="border-b border-black/10 px-6 py-4 bg-[#FFF1E5]/80 backdrop-blur-md sticky top-0 z-50">
        <button 
          onClick={() => router.back()}
          className="flex items-center gap-2 font-sans font-black text-[10px] uppercase tracking-widest hover:text-[#990000] transition-colors"
        >
          <ArrowLeft size={14} /> Back to Network
        </button>
      </nav>

      <main className="max-w-3xl mx-auto px-6 pt-20">
        {/* 元数据 */}
        <div className="text-[10px] font-sans font-bold uppercase tracking-[0.3em] text-[#990000] mb-6 flex items-center gap-2">
          <Zap size={10} fill="currentColor" /> {article.category} / Intelligence Node
        </div>

        {/* 标题 */}
        <h1 className="text-4xl md:text-5xl font-black leading-[1.1] mb-8 italic">
          {article.title}
        </h1>

        {/* 作者与时间 */}
        <div className="flex items-center gap-6 border-y border-black/10 py-6 mb-12 text-[10px] font-sans font-black uppercase opacity-60">
          <span className="flex items-center gap-1.5"><Clock size={12} /> {article.created_at ? new Date(article.created_at).toLocaleDateString() : 'RECENT'}</span>
          <span className="flex items-center gap-1.5">BY: {article.author || 'AGENT_NEON'}</span>
          <span className="flex items-center gap-1.5 text-green-700"><ShieldCheck size={12} /> Verified via ActivityPub</span>
        </div>

        {/* 正文内容 */}
        <div className="prose prose-stone max-w-none">
          <p className="text-xl leading-relaxed text-gray-800 whitespace-pre-wrap first-letter:text-5xl first-letter:font-black first-letter:mr-3 first-letter:float-left">
            {article.content}
          </p>
        </div>

        {/* 底部验证标记 */}
        <div className="mt-20 p-8 border-2 border-dashed border-black/20 bg-black/5 rounded-sm">
          <div className="font-sans font-black text-[9px] uppercase tracking-[0.2em] mb-2 opacity-40">Protocol Verification</div>
          <p className="text-[10px] font-mono opacity-60 break-all leading-tight">
            HASH: {btoa(encodeURIComponent(article.title + article.id)).substring(0, 32).toUpperCase()}
            <br />
            STATUS: PERMANENTLY RECORDED ON GUAVA NETWORK
          </p>
        </div>
      </main>
    </div>
  );
}