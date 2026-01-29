import { Router, type Response } from 'express';
import OpenAI from 'openai';
import { requireAuth, type AuthRequest } from '../middleware/auth.js';
import dotenv from 'dotenv';
import { validate } from '../middleware/validate.js';
import { generateContentSchema, expandKnowledgeSchema, generateCardsSchema } from '../schemas/index.js';

dotenv.config();

const router = Router();

const apiKey = process.env.OPENAI_API_KEY || process.env.DEEPSEEK_API_KEY;
const baseURL = process.env.DEEPSEEK_API_KEY ? 'https://api.deepseek.com' : undefined;
const model = process.env.DEEPSEEK_API_KEY ? 'deepseek-chat' : 'gpt-3.5-turbo';

const openai = apiKey ? new OpenAI({ apiKey, baseURL }) : null;

// Helper to generate mock response if no API key
const getMockResponse = (type: string, prompt: string) => {
  if (type === 'content') {
    return `[模拟 AI 内容] 为以下主题生成的内容: ${prompt}。 \n\n这是一个占位符响应，因为 API 密钥未配置。`;
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

router.post('/generate-content', requireAuth, validate(generateContentSchema), async (req: AuthRequest, res: Response) => {
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
      model: model,
    });

    res.json({ content: completion.choices[0].message.content });
  } catch (error: any) {
    console.error('AI Error:', error);
    res.status(500).json({ error: error.message || 'AI 生成失败' });
  }
});

router.post('/generate-content-stream', requireAuth, validate(generateContentSchema), async (req: AuthRequest, res: Response) => {
  const { topic, context } = req.body;

  // Set headers for SSE
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  if (!openai) {
    // Mock Streaming
    const mockContent = getMockResponse('content', topic) as string;
    const chunks = mockContent.split('');
    
    const sendMockChunks = async () => {
      for (const chunk of chunks) {
         res.write(`data: ${JSON.stringify({ content: chunk })}\n\n`);
         await new Promise(resolve => setTimeout(resolve, 30)); // Simulate delay
      }
      res.write('data: [DONE]\n\n');
      res.end();
    };
    
    sendMockChunks();
    return;
  }

  try {
    const stream = await openai.chat.completions.create({
      messages: [
        { role: "system", content: "You are a helpful knowledge assistant. Generate detailed content for a knowledge graph node. Please respond in Chinese." },
        { role: "user", content: `Topic: ${topic}\nContext: ${context || 'General knowledge'}` }
      ],
      model: model,
      stream: true,
    });

    for await (const chunk of stream) {
      const content = chunk.choices[0]?.delta?.content || '';
      if (content) {
        res.write(`data: ${JSON.stringify({ content })}\n\n`);
      }
    }
    res.write('data: [DONE]\n\n');
    res.end();
  } catch (error: any) {
    console.error('AI Error:', error);
    res.write(`data: ${JSON.stringify({ error: error.message || 'AI 生成失败' })}\n\n`);
    res.end();
  }
});

router.post('/expand-knowledge', requireAuth, validate(expandKnowledgeSchema), async (req: AuthRequest, res: Response) => {
  const { node_title } = req.body;

  if (!openai) {
    return res.json({ suggestions: getMockResponse('expand', node_title) });
  }

  try {
    const completion = await openai.chat.completions.create({
      messages: [
        { role: "system", content: "You are a knowledge graph expert. Suggest 3-5 related sub-topics for the given node to expand the graph. Return JSON array of objects with 'title' and 'content'. Please respond in Chinese." },
        { role: "user", content: `Node: ${node_title}` }
      ],
      model: model,
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

router.post('/generate-cards', requireAuth, validate(generateCardsSchema), async (req: AuthRequest, res: Response) => {
  const { node_title, node_content } = req.body;

  if (!openai) {
    // Mock response
    return res.json({ 
      cards: [
        { type: 'qa', question: `什么是 ${node_title}?`, answer: `${node_title} 的定义是... (Mock)` },
        { type: 'choice', question: `${node_title} 属于哪一类?`, options: ['A类', 'B类', 'C类', 'D类'], answer: 'A类' },
        { type: 'true_false', question: `${node_title} 是一个重要的概念吗?`, answer: 'True' }
      ] 
    });
  }

  try {
    const completion = await openai.chat.completions.create({
      messages: [
        { role: "system", content: "You are an educational expert. Generate 3-5 flashcards based on the provided topic and content. Mix different types: 'qa' (Question/Answer), 'choice' (Multiple Choice with 4 options), and 'true_false'. Return a JSON object with a 'cards' array. Each card object must have: 'type' (qa|choice|true_false), 'question', 'answer'. For 'choice' type, add 'options' array. Please respond in Chinese." },
        { role: "user", content: `Topic: ${node_title}\nContent: ${node_content || 'No detailed content provided.'}` }
      ],
      model: model,
      response_format: { type: "json_object" },
    });

    const content = completion.choices[0].message.content;
    const parsed = JSON.parse(content || '{"cards": []}');
    res.json({ cards: parsed.cards || [] });
  } catch (error: any) {
    console.error('AI Error:', error);
    res.status(500).json({ error: error.message || 'AI card generation failed' });
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
