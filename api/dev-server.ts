/**
 * 本地开发用 API 服务器
 * 在 Vercel 上部署时不需要此文件，Vercel 会自动处理 /api 路由
 * 本地开发时运行: npx tsx api/dev-server.ts
 */
import express from 'express';
import dotenv from 'dotenv';
import handler from './news.js';

dotenv.config();

const app = express();
const PORT = 3001;

app.get('/api/news', (req, res) => {
    handler(req, res);
});

app.listen(PORT, () => {
    console.log(`🚀 API 开发服务器运行在 http://localhost:${PORT}`);
    console.log(`📡 模型: ${process.env.GEMINI_MODEL || 'gemini-3.1-pro-preview'}`);
    console.log(`🔑 API Key: ${process.env.GEMINI_API_KEY ? '已配置 ✓' : '未配置 ✗'}`);
});
