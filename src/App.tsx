import { useState, useEffect } from 'react';
import { RefreshCw, AlertCircle, Clock, ExternalLink, ShieldAlert, Globe, ChevronRight } from 'lucide-react';
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
    const da = a.publishedAt || '';
    const db = b.publishedAt || '';
    return db.localeCompare(da);
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
    <div className="min-h-screen bg-zinc-950 text-zinc-100 font-sans selection:bg-red-500/30">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-zinc-800 bg-zinc-950/80 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-red-500/10 flex items-center justify-center border border-red-500/20">
              <ShieldAlert className="w-4 h-4 text-red-500" />
            </div>
            <h1 className="font-semibold tracking-tight text-lg">冲突追踪</h1>
          </div>
          <div className="flex items-center gap-4">
            {data?.lastUpdated && (
              <div className="hidden sm:flex items-center gap-2 text-xs text-zinc-400 font-mono">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500"></span>
                </span>
                实时更新
              </div>
            )}
            <button
              onClick={() => fetchNews(true)}
              disabled={loading}
              className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 rounded-md transition-colors disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              <span className="hidden sm:inline">{loading ? '更新中...' : '刷新'}</span>
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {error && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-8 p-4 bg-red-500/10 border border-red-500/20 rounded-lg flex items-start gap-3 text-red-400"
          >
            <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
            <div>
              <h3 className="font-medium text-red-300">加载更新失败</h3>
              <p className="text-sm mt-1 opacity-80">{error}</p>
            </div>
          </motion.div>
        )}

        {loading && !data ? (
          <LoadingView />
        ) : data ? (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            {/* Left Column: Summary */}
            <div className="lg:col-span-4 space-y-6">
              <motion.div
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-6"
              >
                <div className="flex items-center gap-2 mb-4">
                  <Globe className="w-5 h-5 text-zinc-400" />
                  <h2 className="text-sm font-mono tracking-widest uppercase text-zinc-400">局势概览</h2>
                </div>
                <h3 className="text-2xl font-semibold mb-4 leading-tight">以色列-伊朗冲突升级</h3>
                <div className="text-zinc-300 leading-relaxed text-sm markdown-body">
                  <Markdown>{data.summary}</Markdown>
                </div>
                <div className="mt-6 pt-6 border-t border-zinc-800 flex items-center gap-2 text-xs text-zinc-500 font-mono">
                  <Clock className="w-3.5 h-3.5" />
                  更新于：{data.lastUpdated || new Date().toLocaleString()}
                </div>
              </motion.div>
            </div>

            {/* Right Column: News Feed */}
            <div className="lg:col-span-8">
              <div className="flex items-center gap-2 mb-6">
                <h2 className="text-sm font-mono tracking-widest uppercase text-zinc-400">最新报道</h2>
                <div className="h-px bg-zinc-800 flex-1 ml-4"></div>
              </div>

              <div className="space-y-4">
                {data.articles.map((article, index) => (
                  <motion.a
                    href={article.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    key={index}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.1 }}
                    className="group block bg-zinc-900/30 hover:bg-zinc-900 border border-zinc-800/50 hover:border-zinc-700 rounded-xl p-5 transition-all"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <span className="text-xs font-semibold text-zinc-300 bg-zinc-800 px-2 py-1 rounded">
                            {article.publisher}
                          </span>
                          {article.publishedAt && (
                            <span className="text-xs text-zinc-500 flex items-center gap-1">
                              <Clock className="w-3 h-3" />
                              {article.publishedAt}
                            </span>
                          )}
                        </div>
                        <h3 className="text-lg font-medium text-zinc-100 group-hover:text-blue-400 transition-colors mb-2 leading-snug">
                          {article.title}
                        </h3>
                        <p className="text-sm text-zinc-400 line-clamp-2 leading-relaxed">
                          {article.snippet}
                        </p>
                      </div>
                      <div className="shrink-0 sm:mt-1">
                        <div className="w-8 h-8 rounded-full bg-zinc-800 flex items-center justify-center group-hover:bg-blue-500/10 group-hover:text-blue-400 text-zinc-500 transition-colors">
                          <ChevronRight className="w-4 h-4" />
                        </div>
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
