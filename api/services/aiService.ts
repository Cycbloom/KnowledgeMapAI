
import OpenAI from 'openai';
import dotenv from 'dotenv';
import { AppError } from '../middleware/errorHandler.js';
import { ErrorCodes } from '../constants/errorCodes.js';

dotenv.config();

const apiKey = process.env.OPENAI_API_KEY || process.env.DEEPSEEK_API_KEY;
const baseURL = process.env.DEEPSEEK_API_KEY ? 'https://api.deepseek.com' : undefined;
const model = process.env.DEEPSEEK_API_KEY ? 'deepseek-chat' : 'gpt-3.5-turbo';

export const openai = apiKey ? new OpenAI({ apiKey, baseURL }) : null;

export const getAIModel = () => model;

// Helper to generate mock response if no API key
export const getMockResponse = (type: string, prompt: string) => {
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
  if (type === 'chat') {
     return `[模拟 AI 回复] 我收到了你的问题: "${prompt}"。这是一个模拟回复，因为后端没有配置 API Key。`;
  }
  return '';
};

export class AIService {
  async generateCards(topic: string, content: string) {
    if (!openai) {
      return { 
        cards: [
          { type: 'qa', question: `什么是 ${topic}?`, answer: `${topic} 的定义是... (Mock)` },
          { type: 'choice', question: `${topic} 属于哪一类?`, options: ['A类', 'B类', 'C类', 'D类'], answer: 'A类' },
          { type: 'true_false', question: `${topic} 是一个重要的概念吗?`, answer: 'True' }
        ] 
      };
    }

    try {
      const completion = await openai.chat.completions.create({
        messages: [
          { role: "system", content: "You are an educational expert. Generate 3-5 flashcards based on the provided topic and content. Mix different types: 'qa' (Question/Answer), 'choice' (Multiple Choice with 4 options), and 'true_false'. Return a JSON object with a 'cards' array. Each card object must have: 'type' (qa|choice|true_false), 'question', 'answer'. For 'choice' type, add 'options' array. Please respond in Chinese." },
          { role: "user", content: `Topic: ${topic}\nContent: ${content || 'No detailed content provided.'}` }
        ],
        model: model,
        response_format: { type: "json_object" },
      });

      const result = completion.choices[0].message.content;
      const parsed = JSON.parse(result || '{"cards": []}');
      return { cards: parsed.cards || [] };
    } catch (error: any) {
      console.error('AI Error:', error);
      throw new Error(error.message || 'AI card generation failed');
    }
  }

  async expandKnowledge(nodeTitle: string, nodeContent?: string, existingNodes?: string[], childNodes?: string[]) {
    if (!openai) {
      return { suggestions: getMockResponse('expand', nodeTitle) };
    }

    try {
      const existingNodesContext = existingNodes && existingNodes.length > 0 
        ? `\nExisting Nodes in Graph: ${existingNodes.slice(0, 50).join(', ')}`
        : '';
        
      const childrenContext = childNodes && childNodes.length > 0
        ? `\nCurrent Direct Children (DO NOT suggest these): ${childNodes.join(', ')}`
        : '';

      const completion = await openai.chat.completions.create({
        messages: [
          { role: "system", content: "You are a knowledge graph expert. Suggest a comprehensive list of related sub-topics or concepts for the given node to expand the graph deeply. \n" +
            "Quantity: Generate as many relevant nodes as necessary to cover the topic thoroughly (up to 20 nodes), but quality and representativeness are more important than quantity.\n" +
            "If a suggested concept matches an 'Existing Node', please use the EXACT same title so we can link to it.\n" +
            "Do not suggest topics that are already listed in 'Current Direct Children'.\n" +
            "Return JSON array of objects with 'title' and 'content'.\n" +
            "Please respond in Chinese." },
          { role: "user", content: `Node Title: ${nodeTitle}\nNode Content: ${nodeContent || ''}${existingNodesContext}${childrenContext}` }
        ],
        model: model,
        response_format: { type: "json_object" },
      });

      const content = completion.choices[0].message.content;
      const parsed = JSON.parse(content || '{"suggestions": []}');
      return { suggestions: parsed.suggestions || parsed };
    } catch (error: any) {
      console.error('AI Error:', error);
      throw new Error(error.message || 'AI expansion failed');
    }
  }
}

export const aiService = new AIService();
