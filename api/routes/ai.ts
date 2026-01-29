import { Router, type Response } from 'express';
import OpenAI from 'openai';
import { requireAuth, type AuthRequest } from '../middleware/auth.js';
import dotenv from 'dotenv';

dotenv.config();

const router = Router();

const apiKey = process.env.OPENAI_API_KEY;
const openai = apiKey ? new OpenAI({ apiKey }) : null;

// Helper to generate mock response if no API key
const getMockResponse = (type: string, prompt: string) => {
  if (type === 'content') {
    return `[模拟 AI 内容] 为以下主题生成的内容: ${prompt}。 \n\n这是一个占位符响应，因为 OpenAI API 密钥未配置。`;
  }
  if (type === 'expand') {
    return [
      { title: `与 ${prompt} 相关 1`, content: '描述 1' },
      { title: `与 ${prompt} 相关 2`, content: '描述 2' },
      { title: `与 ${prompt} 相关 3`, content: '描述 3' },
    ];
  }
  return '';
};

router.post('/generate-content', requireAuth, async (req: AuthRequest, res: Response) => {
  const { topic, context } = req.body;

  if (!openai) {
    return res.json({ content: getMockResponse('content', topic) });
  }

  try {
    const completion = await openai.chat.completions.create({
      messages: [
        { role: "system", content: "You are a helpful knowledge assistant. Generate detailed content for a knowledge graph node. Please respond in Chinese." },
        { role: "user", content: `Topic: ${topic}\nContext: ${context || 'General knowledge'}` }
      ],
      model: "gpt-3.5-turbo",
    });

    res.json({ content: completion.choices[0].message.content });
  } catch (error: any) {
    console.error('AI Error:', error);
    res.status(500).json({ error: error.message || 'AI 生成失败' });
  }
});

router.post('/expand-knowledge', requireAuth, async (req: AuthRequest, res: Response) => {
  const { node_title } = req.body;

  if (!openai) {
    return res.json({ suggestions: getMockResponse('expand', node_title) });
  }

  try {
    const completion = await openai.chat.completions.create({
      messages: [
        { role: "system", content: "You are a knowledge graph expert. Suggest 3-5 related sub-topics for the given node to expand the graph. Return JSON array of objects with 'title' and 'content'." },
        { role: "user", content: `Node: ${node_title}` }
      ],
      model: "gpt-3.5-turbo",
      response_format: { type: "json_object" }, // Ensure JSON output
    });

    const content = completion.choices[0].message.content;
    const parsed = JSON.parse(content || '{"suggestions": []}');
    res.json({ suggestions: parsed.suggestions || parsed });
  } catch (error: any) {
    console.error('AI Error:', error);
    res.status(500).json({ error: error.message || 'AI expansion failed' });
  }
});

router.post('/search-references', requireAuth, async (req: AuthRequest, res: Response) => {
  // Real web search requires another API (e.g. Google/Bing). We'll just mock it or use AI to hallucinate references (not recommended but okay for demo).
  // Or just return a placeholder.
  const { query } = req.body;
  
  res.json({
    results: [
      { title: `${query} 的参考资料`, url: 'https://example.com/ref1', snippet: '来自参考资料 1 的示例文本...' },
      { title: `${query} 的其他来源`, url: 'https://wikipedia.org/wiki/' + query, snippet: '维基百科条目...' },
    ]
  });
});

export default router;
