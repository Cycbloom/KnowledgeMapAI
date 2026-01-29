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
    return `[MOCK AI CONTENT] Generated content for: ${prompt}. \n\nThis is a placeholder response because OpenAI API key is not configured.`;
  }
  if (type === 'expand') {
    return [
      { title: `Related to ${prompt} 1`, content: 'Description 1' },
      { title: `Related to ${prompt} 2`, content: 'Description 2' },
      { title: `Related to ${prompt} 3`, content: 'Description 3' },
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
        { role: "system", content: "You are a helpful knowledge assistant. Generate detailed content for a knowledge graph node." },
        { role: "user", content: `Topic: ${topic}\nContext: ${context || 'General knowledge'}` }
      ],
      model: "gpt-3.5-turbo",
    });

    res.json({ content: completion.choices[0].message.content });
  } catch (error: any) {
    console.error('AI Error:', error);
    res.status(500).json({ error: error.message || 'AI generation failed' });
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
      { title: `Reference for ${query}`, url: 'https://example.com/ref1', snippet: 'Sample text from reference 1...' },
      { title: `Another source for ${query}`, url: 'https://wikipedia.org/wiki/' + query, snippet: 'Wikipedia entry...' },
    ]
  });
});

export default router;
