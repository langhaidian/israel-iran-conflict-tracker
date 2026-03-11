import { GoogleGenAI } from '@google/genai';

export const config = {
    maxDuration: 60,
};

// 服务端内存缓存（10 分钟 TTL）
let cachedData: any = null;
let cacheTimestamp = 0;
const CACHE_TTL = 10 * 60 * 1000; // 10 分钟

export default async function handler(req: any, res: any) {
    if (req.method !== 'GET') {
        return res.status(405).json({ error: '仅支持 GET 请求' });
    }

    // 检查是否强制刷新
    const forceRefresh = req.query?.force === 'true';

    // 如果缓存有效且非强制刷新，直接返回缓存
    if (!forceRefresh && cachedData && Date.now() - cacheTimestamp < CACHE_TTL) {
        return res.status(200).json(cachedData);
    }

    const apiKey = process.env.GEMINI_API_KEY;
    const modelName = process.env.GEMINI_MODEL || 'gemini-3-flash-preview';

    if (!apiKey) {
        return res.status(500).json({ error: 'GEMINI_API_KEY 未在 Vercel 环境变量中配置。' });
    }

    try {
        const ai = new GoogleGenAI({ apiKey });

        const response = await ai.models.generateContent({
            model: modelName,
            contents: `搜索以色列与伊朗冲突的最新动态。

重要的信息来源要求：
- 仅使用国际公认的权威媒体来源，包括但不限于：Reuters（路透社）、AP News（美联社）、BBC、CNN、Al Jazeera（半岛电视台）、The Guardian（卫报）、The New York Times（纽约时报）、The Washington Post（华盛顿邮报）、France 24、DW（德国之声）、NHK、The Times of Israel、Haaretz、PBS、NPR 等。
- 严禁使用中国大陆媒体来源，包括但不限于：新华社、人民日报、环球时报、CGTN、中国日报、央视、观察者网、参考消息、联合早报、中国新闻网、财闻网等。
- 优先选择多个不同国家和地区的媒体来源，确保报道视角的多元性。

根据搜索结果，请用简体中文提供以下内容：
1. 当前局势的简要摘要（3-5段），用你自己的语言撰写。
2. 8-12条最新相关新闻的列表，包含标题、简要描述（用你自己的语言撰写）、媒体名称（使用英文原名）、大致发布时间和来源链接。

重要：所有摘要和描述必须用简体中文撰写，用你自己的语言表述，不要逐字复制任何来源的原文。新闻标题也请翻译为中文。

返回一个 JSON 对象，严格使用以下结构（不要使用 markdown 代码块包裹）：
{"summary": "中文摘要内容", "lastUpdated": "${new Date().toISOString()}", "articles": [{"title": "中文标题", "snippet": "中文简要描述", "publisher": "英文媒体名称", "publishedAt": "发布时间", "url": "来源链接"}]}`,
            config: {
                tools: [{ googleSearch: {} }],
            },
        });

        let text = response.text;
        if (!text) {
            const finishReason = response.candidates?.[0]?.finishReason;
            return res.status(500).json({
                error: `AI 未返回数据。终止原因：${finishReason || '未知'}`,
            });
        }

        // 提取 JSON
        const jsonMatch = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
        if (jsonMatch) {
            text = jsonMatch[1];
        } else {
            const start = text.indexOf('{');
            const end = text.lastIndexOf('}');
            if (start !== -1 && end !== -1) {
                text = text.slice(start, end + 1);
            }
        }

        const data = JSON.parse(text);

        // 更新缓存
        cachedData = data;
        cacheTimestamp = Date.now();

        return res.status(200).json(data);
    } catch (err: any) {
        console.error('API Error:', err);
        return res.status(500).json({
            error: err.message || '获取新闻失败。',
        });
    }
}
