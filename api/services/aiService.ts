
import OpenAI from 'openai';
import dotenv from 'dotenv';
import { AppError } from '../middleware/errorHandler.js';
import { ErrorCodes } from '../constants/errorCodes.js';
import { getAIProviderForTask, getAIProvider } from './ai/factory.js';
import { AIProviderType } from './ai/types.js';

dotenv.config();

// Backward compatibility: export openai and getAIModel based on default 'text' provider
const defaultProvider = getAIProviderForTask('text');
export const openai = defaultProvider.hasKey ? defaultProvider.client : null;
export const getAIModel = () => defaultProvider.model;

// Helper to generate mock response if no API key
export const getMockResponse = (type: string, prompt: string): any => {
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

export interface GenerateCardsOptions {
  context?: string;
  type?: 'qa' | 'choice' | 'true_false' | 'multi_choice' | 'fill_in_the_blank' | 'essay';
  types?: ('qa' | 'choice' | 'true_false' | 'multi_choice' | 'fill_in_the_blank' | 'essay')[];
  count?: number;
  pack_type?: 'standard' | 'comprehensive' | 'custom';
  provider?: AIProviderType;
  model?: string;
}

export class AIService {
  // Helper to clean JSON string from Markdown code blocks
  private cleanJsonString(str: string): string {
    if (!str) return '';
    // Remove ```json and ``` wrapping
    let cleaned = str.replace(/^```json\s*/, '').replace(/^```\s*/, '').replace(/\s*```$/, '');
    return cleaned.trim();
  }

  async generateEmbedding(text: string): Promise<number[] | null> {
    if (!text) return null;

    const provider = getAIProviderForTask('embedding');
    if (!provider.hasKey) {
        console.warn('No API key for embedding provider');
        // Return a mock embedding if needed, or null
        return null;
    }

    try {
        // Use provider-specific implementation if available (e.g., for custom dimensions)
        if (provider.createEmbedding) {
            return await provider.createEmbedding(text);
        }

        const response = await provider.client.embeddings.create({
            model: provider.embeddingModel || provider.model,
            input: text,
            encoding_format: 'float',
        });
        return response.data[0].embedding;
    } catch (error) {
        console.error('Failed to generate embedding:', error);
        return null;
    }
  }

  async chat(messages: any[], options: { provider?: AIProviderType; model?: string } = {}): Promise<string> {
    const provider = options.provider
      ? getAIProvider(options.provider)
      : getAIProviderForTask('text');

    if (!provider.hasKey) {
      return getMockResponse('chat', messages[messages.length - 1].content);
    }

    try {
      const completion = await provider.client.chat.completions.create({
        messages,
        model: options.model || provider.model,
      });

      return completion.choices[0].message.content || '';
    } catch (error: any) {
      console.error('AI Chat Error:', error);
      throw new Error(error.message || 'AI chat failed');
    }
  }

  async generateCards(topic: string, content: string, options: GenerateCardsOptions = {}) {
    // If options.type is provided (single string), wrap it in array for types (compatibility)
    const inputOptions: any = options;
    const types = inputOptions.type ? [inputOptions.type] : (options.types || ['qa', 'choice']);
    const count = options.count || 3;
    const context = options.context;

    // Get provider for 'text' task
    const provider = options.provider 
      ? getAIProvider(options.provider) 
      : getAIProviderForTask('text');

    if (!provider.hasKey) {
      return { 
        cards: [
          { type: 'qa', question: `什么是 ${topic}?`, answer: `${topic} 的定义是... (Mock)`, explanation: '这是详细解析...' },
          { type: 'choice', question: `${topic} 属于哪一类?`, options: ['A类', 'B类', 'C类', 'D类'], answer: 'A类', explanation: '解析：因为...' },
          { type: 'true_false', question: `${topic} 是一个重要的概念吗?`, answer: 'True', explanation: '解析：是的...' },
          { type: 'multi_choice', question: `${topic} 的特点有哪些?`, options: ['特点A', '特点B', '特点C', '特点D'], answer: '["特点A", "特点B"]', explanation: '解析：AB是正确的...' },
          { type: 'fill_in_the_blank', question: `${topic} 是在 ___ 年被提出的。`, answer: '2024', explanation: '解析：根据文献...' },
          { type: 'essay', question: `请详细阐述 ${topic} 的原理及其应用。`, answer: '原理是... 应用于...', explanation: '解析：得分点包括...' }
        ].filter(c => types.includes(c.type as any)).slice(0, count)
      };
    }

    const typePrompts: Record<string, string> = {
      qa: "For 'qa' type: Create thought-provoking open-ended questions that test deep understanding. Provide a detailed 'explanation' analyzing the answer.",
      choice: "For 'choice' type: Create multiple-choice questions with 4 plausible options. Provide the correct answer and a detailed 'explanation' of why it is correct and others are wrong.",
      true_false: "For 'true_false' type: Create statements focusing on common misconceptions or key details. Provide a detailed 'explanation'.",
      multi_choice: "For 'multi_choice' type: Create multiple-choice questions where ONE OR MORE options can be correct. Provide 4 options, the 'answer' as a JSON array of correct strings, and a detailed 'explanation'.",
      fill_in_the_blank: "For 'fill_in_the_blank' type: Create a sentence with one or more '___' (3 underscores) as blanks. The 'answer' should be the missing text. Provide a detailed 'explanation'.",
      essay: "For 'essay' type: Create complex questions requiring a long-form structured answer. The 'answer' should be a model response with key points. Provide a detailed 'explanation' with scoring criteria."
    };

    const selectedPrompts = types.map(t => typePrompts[t] || "").join("\n");

    try {
      const completion = await provider.client.chat.completions.create({
        messages: [
          { role: "system", content: `You are an educational expert. Generate ${count} flashcards based on the provided topic and content. 
          
Context: The current node is part of a larger knowledge structure. 
${context ? `Parent/Context Info: ${context}` : ''}

Requirements:
1. Generate exactly ${count} cards.
2. Allowed Types: ${types.join(', ')}.
3. Mix the types if multiple are selected.
${selectedPrompts}

Return a JSON object with a 'cards' array. Each card object must have: 
- 'type' (qa|choice|true_false|multi_choice|fill_in_the_blank|essay)
- 'question'
- 'answer'
- 'explanation' (Detailed analysis/reasoning)
- 'options' (Array of 4 strings, ONLY for 'choice' and 'multi_choice' types)

Please respond in Chinese.` },
          { role: "user", content: `Topic: ${topic}\nContent: ${content || 'No detailed content provided.'}` }
        ],
        model: options.model || provider.model,
        response_format: { type: "json_object" },
      });

      const result = completion.choices[0].message.content || '';
      const cleanedResult = this.cleanJsonString(result);
      
      console.log(`[AI] Raw result for ${topic}:`, result.substring(0, 100) + '...');
      
      let parsed;
      try {
        parsed = JSON.parse(cleanedResult || '{"cards": []}');
      } catch (e) {
        console.error('[AI] JSON Parse Error. Raw:', result);
        throw new Error('Failed to parse AI response');
      }
      
      return { cards: parsed.cards || [] };
    } catch (error: any) {
      console.error('AI Error:', error);
      throw new Error(error.message || 'AI card generation failed');
    }
  }

  async expandKnowledge(nodeTitle: string, nodeContent?: string, existingNodes?: string[], childNodes?: string[], options: { provider?: AIProviderType; model?: string; contextLevel?: string } = {}) {
    const provider = options.provider
      ? getAIProvider(options.provider)
      : getAIProviderForTask('text');

    if (!provider.hasKey) {
      return { suggestions: getMockResponse('expand', nodeTitle) };
    }

    try {
      const existingNodesContext = existingNodes && existingNodes.length > 0 
        ? `\nExisting Nodes in Graph: ${existingNodes.slice(0, 300).join(', ')}`
        : '';
        
      const childrenContext = childNodes && childNodes.length > 0
        ? `\nCurrent Direct Children (DO NOT suggest these): ${childNodes.join(', ')}`
        : '';

      const contextLevel = options.contextLevel || 'normal';
      let linkingStrategy = "Linking Strategy: Check the provided 'Existing Nodes'. If a suggested concept is SEMANTICALLY IDENTICAL to an existing node, use the EXACT same title to create a link. \n" +
            "Constraint: Do NOT force links to loosely related existing nodes. It is better to create a new specific node than to link to a generic existing one.";

      let generationStrategy = "Content Strategy: Generate diverse sub-topics. Content should be informative.";

      if (['root', 'core'].includes(contextLevel)) {
        linkingStrategy = "Linking Strategy (HIERARCHICAL): \n" +
          "1. **NO Same-Level Links**: Do NOT link to nodes that are at the SAME level (siblings/cousins). \n" +
          "2. **Vertical Links OK**: You MAY link to nodes that would be considered a 'parent' (higher level) or 'child' (lower level) contextually. \n" +
          "3. **Focus**: Primary goal is to generate NEW specific child nodes for the current node.";
        
        generationStrategy = "Content Strategy (HIGH LEVEL): Suggest BROAD CATEGORIES or MAJOR BRANCHES. The 'content' should be a high-level summary or definition.";
      } else if (['sub', 'normal'].includes(contextLevel)) {
        linkingStrategy = "Linking Strategy (HIERARCHICAL): \n" +
          "1. **NO Same-Level Links**: Do NOT link to nodes that are at the SAME level (siblings/cousins). \n" +
          "2. **Vertical Links OK**: You MAY link to nodes that would be considered a 'parent' (higher level) or 'child' (lower level) contextually. \n" +
          "3. **Focus**: Primary goal is to generate NEW specific child nodes for the current node.";

        generationStrategy = "Content Strategy (MID LEVEL): Suggest SPECIFIC CONCEPTS or FUNCTIONAL COMPONENTS. The 'content' should be descriptive and explain 'how' or 'why'.";
      } else if (contextLevel === 'leaf') {
        linkingStrategy = "Linking Strategy (NETWORK): You are expanding a leaf node. You are encouraged to link to 'Existing Nodes' if they are highly relevant, especially other leaf nodes, to form knowledge connections.";
        
        generationStrategy = "Content Strategy (LEAF LEVEL): Suggest ATOMIC DETAILS, EXAMPLES, or ATTRIBUTES. The 'content' should be very specific, technical, and detailed.";
      }

      const completion = await provider.client.chat.completions.create({
        messages: [
          { role: "system", content: "You are a knowledge graph expert. Suggest a comprehensive list of related sub-topics or concepts for the given node to expand the graph deeply. \n" +
            "Goal: Prioritize generating NEW, specific concepts to broaden the graph's coverage.\n" +
            "Quantity: Generate up to 8 nodes. Focus on representativeness and hierarchy.\n" +
            `${linkingStrategy}\n` +
            `${generationStrategy}\n` +
            "Do not suggest topics that are already listed in 'Current Direct Children'.\n" +
            "Return JSON array of objects with 'title' and 'content'.\n" +
            "Please respond in Chinese." },
          { role: "user", content: `Node Title: ${nodeTitle}\nNode Content: ${nodeContent || ''}${existingNodesContext}${childrenContext}` }
        ],
        model: options.model || provider.model,
        response_format: { type: "json_object" },
      });

      const content = completion.choices[0].message.content || '';
      const cleanedContent = this.cleanJsonString(content);
      
      let parsed;
      try {
        parsed = JSON.parse(cleanedContent || '{"suggestions": []}');
      } catch (e) {
         console.error('[AI] JSON Parse Error (Expand). Raw:', content);
         // Fallback: try to find JSON array/object inside text
         const match = content.match(/\{[\s\S]*\}|\[[\s\S]*\]/);
         if (match) {
             try {
                 parsed = JSON.parse(match[0]);
             } catch (e2) {
                 throw new Error('Failed to parse AI response');
             }
         } else {
             throw new Error('Failed to parse AI response');
         }
      }

      return { suggestions: parsed.suggestions || parsed };
    } catch (error: any) {
      console.error('AI Error:', error);
      throw new Error(error.message || 'AI expansion failed');
    }
  }
}

export const aiService = new AIService();
