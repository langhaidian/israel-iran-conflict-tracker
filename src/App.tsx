import { useState, useEffect } from 'react';
import { RefreshCw, AlertCircle, Clock, ExternalLink } from 'lucide-react';
import { motion } from 'motion/react';

import Markdown from 'react-markdown';

interface Article {
  title: string;
  snippet: string;
  publisher: string;
  publishedAt: string;
  url: string;
}

interface NewsData {
  summary: string;
  lastUpdated: string;
  articles: Article[];
}

function LoadingView() {
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    const timer = setInterval(() => setElapsed(s => s + 1), 1000);
    return () => clearInterval(timer);
  }, []);
  const messages = [
    { time: 0, text: '正在连接 AI...' },
    { time: 3, text: '正在搜索最新新闻...' },
    { time: 10, text: '正在分析信息源...' },
    { time: 20, text: '正在整合情报...' },
    { time: 40, text: '即将完成，正在生成摘要...' },
    { time: 60, text: '仍在处理中，该模型响应可能较慢...' },
  ];
  const msg = [...messages].reverse().find(m => elapsed >= m.time)?.text || messages[0].text;
  return (
    <div className="flex flex-col items-center justify-center py-32 text-zinc-500">
      <RefreshCw className="w-8 h-8 animate-spin mb-4 text-zinc-400" />
      <p className="font-mono text-sm tracking-widest uppercase">{msg}</p>
      <p className="font-mono text-xs text-zinc-600 mt-3">{elapsed}s</p>
    </div>
  );
}

const STORAGE_KEY = 'conflict-tracker-data';
const MAX_ARTICLES = 100;

function loadCachedData(): NewsData | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch { }
  return null;
}

function saveCachedData(data: NewsData) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch { }
}

function mergeArticles(existing: Article[], incoming: Article[]): Article[] {
  const seen = new Map<string, Article>();
  // 先加入已有文章
  for (const a of existing) {
    const key = a.url || a.title;
    if (key) seen.set(key, a);
  }
  // 新文章覆盖同 URL 的旧文章
  for (const a of incoming) {
    const key = a.url || a.title;
    if (key) seen.set(key, a);
  }
  // 按时间降序排列
  const merged = Array.from(seen.values()).sort((a, b) => {
    // 处理可能为空的时间字符串
    if (!a.publishedAt && !b.publishedAt) return 0;
    if (!a.publishedAt) return 1; // b放前面
    if (!b.publishedAt) return -1; // a放前面

    // 尝试解析为 Date 对象进行准确的降序对比
    const dateA = new Date(a.publishedAt);
    const dateB = new Date(b.publishedAt);
    
    // 如果解析出的 Date 不是有效数字(比如一些奇怪的相对时间)，则回退到字符串对比
    if (isNaN(dateA.getTime()) || isNaN(dateB.getTime())) {
      return b.publishedAt.localeCompare(a.publishedAt);
    }
    
    return dateB.getTime() - dateA.getTime();
  });
  // 最多保留 MAX_ARTICLES 条
  return merged.slice(0, MAX_ARTICLES);
}

export default function App() {
  const cached = loadCachedData();
  const [data, setData] = useState<NewsData | null>(cached);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchNews = async (force = false) => {
    setLoading(true);
    setError(null);
    try {
      const url = force ? '/api/news?force=true' : '/api/news';
      const response = await fetch(url);
      let result;
      const contentType = response.headers.get('content-type') || '';
      if (contentType.includes('application/json')) {
        result = await response.json();
      } else {
        const text = await response.text();
        throw new Error(
          response.status === 504
            ? '请求超时。AI 模型响应较慢，请稍后重试。'
            : `服务端错误 (${response.status}): ${text.slice(0, 100)}`
        );
      }
      if (!response.ok) {
        throw new Error(result.error || `服务端错误 (${response.status})`);
      }
      // 合并新旧文章
      setData(prev => {
        const existingArticles = prev?.articles || [];
        const merged: NewsData = {
          summary: result.summary,
          lastUpdated: result.lastUpdated,
          articles: mergeArticles(existingArticles, result.articles || []),
        };
        saveCachedData(merged);
        return merged;
      });
    } catch (err: any) {
      console.error(err);
      setError(err.message || '获取新闻失败。');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchNews();
  }, []);

  return (
    <div className="min-h-screen bg-[#050505] text-[#F0EFEA] font-sans selection:bg-[#E63946]/50">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-[#050505] border-b-2 border-[#F0EFEA]/20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h1 className="font-semibold tracking-tight text-lg">以色列-伊朗冲突追踪</h1>
          </div>
          <div className="flex items-center gap-4">
            {data?.lastUpdated && (
              <div className="hidden sm:flex items-center gap-2 text-xs text-[#E63946] font-mono tracking-widest font-bold">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-none bg-[#E63946] opacity-75"></span>
                  <span className="relative inline-flex rounded-none h-2 w-2 bg-[#E63946]"></span>
                </span>
                LIVE
              </div>
            )}
            <button
              onClick={() => fetchNews(true)}
              disabled={loading}
              className="flex items-center gap-2 px-4 py-2 text-sm font-bold font-mono tracking-widest uppercase bg-[#050505] hover:bg-[#F0EFEA] hover:text-[#050505] border border-[#F0EFEA] transition-colors disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              <span className="hidden sm:inline">{loading ? 'SYNCING' : 'FORCE REFRESH'}</span>
            </button>
          </div>
        </div>
      </header>

        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {error && (
          <motion.div
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            className="mb-12 p-6 bg-[#E63946] text-[#050505] flex items-start gap-4"
          >
            <AlertCircle className="w-6 h-6 shrink-0 mt-1" />
            <div>
              <h3 className="font-bold text-xl uppercase tracking-widest font-mono">CRITICAL ERROR</h3>
              <p className="text-sm mt-2 font-mono">{error}</p>
            </div>
          </motion.div>
        )}

        {loading && !data ? (
          <LoadingView />
        ) : data ? (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-16">
            {/* Left Column: Summary */}
            <div className="lg:col-span-5 space-y-8">
              <motion.div
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ ease: [0.16, 1, 0.3, 1], duration: 0.8 }}
                className="pt-2 pb-8"
              >
                <div className="flex items-center gap-3 mb-6 font-mono text-sm tracking-widest text-[#F0EFEA]/60 pb-4 border-b border-[#F0EFEA]/20">
                    <span>// SITREP</span>
                    <span className="flex-1"></span>
                    <span>DOC-ID: {Math.random().toString(36).substr(2, 6).toUpperCase()}</span>
                </div>
                <h2 className="text-4xl md:text-5xl font-bold mb-8 leading-none tracking-tighter">
                  以色列-伊朗冲突升级
                </h2>
                <div className="text-[#F0EFEA]/80 leading-relaxed text-lg font-serif markdown-body prose-invert prose-headings:font-sans prose-headings:tracking-tighter prose-headings:mb-4">
                  <Markdown>{data.summary}</Markdown>
                </div>
                <div className="mt-12 pt-6 border-t border-[#F0EFEA]/20 flex items-center gap-2 text-xs text-[#F0EFEA]/50 font-mono tracking-widest uppercase">
                  LOG_TS: {data.lastUpdated || new Date().toLocaleString()}
                </div>
              </motion.div>
            </div>

            {/* Right Column: News Feed */}
            <div className="lg:col-span-7">
              <div className="flex items-end justify-between mb-8 pb-4 border-b-2 border-[#F0EFEA]">
                <h2 className="text-lg font-bold tracking-widest uppercase">RAW_INTEL_FEED</h2>
                <span className="text-xs font-mono text-[#F0EFEA]/40">[{data.articles.length} EVENTS]</span>
              </div>

              <div className="space-y-0 divide-y divide-[#F0EFEA]/10">
                {data.articles.map((article, index) => (
                  <motion.a
                    href={article.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    key={index}
                    initial={{ opacity: 0, y: 15 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.03, ease: [0.16, 1, 0.3, 1] }}
                    className="group block py-8 transition-colors hover:bg-[#F0EFEA]/5 px-4 -mx-4"
                  >
                    <div className="flex flex-col md:flex-row gap-6">
                        <div className="md:w-32 shrink-0 flex flex-row md:flex-col gap-3 font-mono tracking-tighter text-[#F0EFEA]/60">
                          <span className="text-xs font-bold uppercase truncate">
                            {article.publisher}
                          </span>
                          {article.publishedAt && (
                            <span className="text-xs">
                              {article.publishedAt}
                            </span>
                          )}
                        </div>
                        <div className="flex-1">
                          <h3 className="text-xl md:text-2xl font-bold text-[#F0EFEA] group-hover:text-[#E63946] transition-colors leading-snug mb-3 tracking-tight">
                            {article.title}
                          </h3>
                          <p className="text-base text-[#F0EFEA]/70 line-clamp-3 leading-relaxed font-serif">
                            {article.snippet}
                          </p>
                        </div>
                    </div>
                  </motion.a>
                ))}
              </div>
            </div>
          </div>
        ) : null}
      </main>
    </div>
  );
}
