
import OpenAI from 'openai';
import dotenv from 'dotenv';
import { AppError } from '../middleware/errorHandler.js';
import { ErrorCodes } from '../constants/errorCodes.js';
import { getAIProviderForTask, getAIProvider } from './ai/factory.js';
import { AIProviderType } from './ai/types.js';
import { logger } from '../utils/logger.js';

dotenv.config();

// Helper to generate mock response if no API key
export const getMockResponse = (type: string, prompt: string): string | any[] => {
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
  /** @deprecated Use types instead */
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
    
    // 1. Try to locate the JSON content by finding the first { or [ and the last } or ]
    const firstBrace = str.indexOf('{');
    const firstBracket = str.indexOf('[');
    
    let startIndex = -1;
    if (firstBrace !== -1 && firstBracket !== -1) {
      startIndex = Math.min(firstBrace, firstBracket);
    } else if (firstBrace !== -1) {
      startIndex = firstBrace;
    } else if (firstBracket !== -1) {
      startIndex = firstBracket;
    }
    
    if (startIndex !== -1) {
      const lastBrace = str.lastIndexOf('}');
      const lastBracket = str.lastIndexOf(']');
      const endIndex = Math.max(lastBrace, lastBracket);
      
      if (endIndex > startIndex) {
        return str.substring(startIndex, endIndex + 1);
      }
    }

    // Fallback: simple markdown removal if no clear JSON structure found
    // (This handles cases where the string might be just a value or malformed)
    let cleaned = str.replace(/^```json\s*/, '').replace(/^```\s*/, '').replace(/\s*```$/, '');
    return cleaned.trim();
  }

  async generateEmbedding(text: string): Promise<number[] | null> {
    if (!text) return null;

    const provider = await getAIProviderForTask('embedding');
    if (!provider.hasKey) {
        logger.warn('No API key for embedding provider');
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
        logger.error('Failed to generate embedding:', error);
        return null;
    }
  }

  async chat(messages: any[], options: { provider?: AIProviderType; model?: string } = {}): Promise<string> {
    const provider = options.provider
      ? await getAIProvider(options.provider)
      : await getAIProviderForTask('text');

    if (!provider.hasKey) {
      const response = getMockResponse('chat', messages[messages.length - 1].content);
      return typeof response === 'string' ? response : JSON.stringify(response);
    }

    try {
      const completion = await provider.client.chat.completions.create({
        messages,
        model: options.model || provider.model,
      });

      return completion.choices[0].message.content || '';
    } catch (error: any) {
      logger.error('AI Chat Error:', error);
      throw new Error(error.message || 'AI chat failed');
    }
  }

  async generateCards(topic: string, content: string, options: GenerateCardsOptions = {}) {
    // If options.type is provided (single string), wrap it in array for types (compatibility)
    const types = options.type ? [options.type] : (options.types || ['qa', 'choice']);
    const count = options.count || 3;
    const context = options.context;

    // Get provider for 'text' task
    const provider = options.provider 
      ? await getAIProvider(options.provider) 
      : await getAIProviderForTask('text');

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
      
      logger.debug(`[AI] Raw result for ${topic}:`, { preview: result.substring(0, 100) + '...' });
      
      let parsed;
      try {
        parsed = JSON.parse(cleanedResult || '{"cards": []}');
      } catch (e) {
        logger.error('[AI] JSON Parse Error. Raw:', { result });
        throw new Error('Failed to parse AI response');
      }
      
      return { cards: parsed.cards || [] };
    } catch (error: any) {
      logger.error('AI Error:', error);
      throw new Error(error.message || 'AI card generation failed');
    }
  }

  async expandKnowledge(nodeTitle: string, nodeContent?: string, existingNodes?: string[], childNodes?: string[], options: { provider?: AIProviderType; model?: string; contextLevel?: string } = {}) {
    const provider = options.provider
      ? await getAIProvider(options.provider)
      : await getAIProviderForTask('text');

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
            "Return a JSON object with a 'suggestions' array. Each object in the array must have 'title' and 'content' fields.\n" +
            "Example format: { \"suggestions\": [{ \"title\": \"Example Title\", \"content\": \"Example content\" }] }\n" +
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
         logger.error('[AI] JSON Parse Error (Expand). Raw:', { content });
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
      logger.error('AI Error:', error);
      throw new Error(error.message || 'AI expansion failed');
    }
  }

  async generateGraphFromImage(imageBase64: string, options: { provider?: AIProviderType; model?: string } = {}) {
    // Default to 'aliyun' (Qwen-VL) or 'volcengine' if available, as they support vision well.
    // Deepseek currently doesn't support vision via API (as of standard V3).
    // We try to get a provider that supports vision. For now, we manually check or default.
    let providerName = options.provider;
    
    // If no provider specified, try Aliyun or Volcengine
    if (!providerName) {
        // This is a heuristic. Ideally we should have a 'vision' task type.
        // But for now let's just use 'text' provider and hope it supports vision, 
        // OR explicitly fallback to Aliyun if the default text provider is Deepseek (which is text-only).
        const defaultTextProvider = await getAIProviderForTask('text');
        if (defaultTextProvider.providerType === 'deepseek') {
            providerName = 'aliyun'; // Fallback to Aliyun for Vision
        } else {
            providerName = defaultTextProvider.providerType;
        }
    }

    const provider = await getAIProvider(providerName as AIProviderType);

    if (!provider.hasKey) {
       // Mock response
       return {
          nodes: [
            { id: 'mock_img_1', title: '识别的主题', content: '这是从图片识别的内容', level: 'root' },
            { id: 'mock_img_2', title: '视觉元素 A', content: '图片中的元素 A', level: 'core' }
          ],
          edges: [
            { source: 'mock_img_1', target: 'mock_img_2', relationship: 'contains' }
          ]
       };
    }

    // Check if using Qwen-VL or similar model that supports images
    // Qwen-VL-Max/Plus/Turbo
    let model = options.model || provider.model;
    if (provider.providerType === 'aliyun' && !model.includes('vl')) {
        model = 'qwen-vl-max'; // Force VL model for Aliyun
    } else if (provider.providerType === 'volcengine' && !model.includes('vision')) {
        // Doubao vision model name guess or config needed. 
        // For now, assume user configured it or we use a safe default if known.
        // But better to trust the config or let it fail if model doesn't support vision.
    }

    try {
      const completion = await provider.client.chat.completions.create({
        messages: [
          { 
            role: "system", 
            content: `You are a knowledge graph expert capable of analyzing visual content (diagrams, mind maps, slides, or text-heavy images).
            
Your task:
1. Analyze the provided image to extract the structured knowledge hierarchy.
2. If it's a diagram/mind map, capture the structure exactly.
3. If it's a slide/text, structure the information logically.
4. Output a JSON object with 'nodes' and 'edges' arrays.
   - Nodes: { "id": "temp_id", "title": "Title", "content": "Description (100-200 words)", "level": "root|core|sub|normal|leaf" }
   - Edges: { "source": "parent_id", "target": "child_id", "relationship": "contains|related" }
5. Ensure the 'root' node represents the main topic of the image.
6. Limit to 30-50 nodes.
7. Respond in Chinese.`
          },
          { 
            role: "user", 
            content: [
                { type: "text", text: "Please analyze this image and generate the knowledge graph JSON." },
                { type: "image_url", image_url: { url: imageBase64 } }
            ]
          }
        ],
        model: model,
        response_format: { type: "json_object" },
        max_tokens: 4000,
      });

      const content = completion.choices[0].message.content || '';
      const cleanedContent = this.cleanJsonString(content);
      
      let parsed;
      try {
        parsed = JSON.parse(cleanedContent || '{"nodes": [], "edges": []}');
      } catch (e) {
        throw new Error('Failed to parse AI response');
      }

      return parsed;

    } catch (error: any) {
      logger.error('Image-to-Graph Error:', error);
      throw new Error(error.message || 'Image processing failed');
    }
  }

  async generateLearningMaterial(topic: string, context: string, options: { provider?: AIProviderType; model?: string; level?: string } = {}) {
    const provider = options.provider
      ? await getAIProvider(options.provider)
      : await getAIProviderForTask('text');

    if (!provider.hasKey) {
      return getMockResponse('content', `Learning Material for ${topic}`);
    }

    try {
      const completion = await provider.client.chat.completions.create({
        messages: [
          { 
            role: "system", 
            content: "You are a distinguished textbook author and educator. Write a comprehensive, structured learning module for the given topic.\n" +
                     "Target Audience: University students or professionals learning this concept.\n" +
                     "Structure:\n" +
                     "1. **Introduction (Hook)**: Briefly explain what this is and why it matters.\n" +
                     "2. **Core Concepts (Deep Dive)**: Explain the theoretical foundations. Use analogies.\n" +
                     "3. **Key Mechanisms/Details**: Technical details, 'how it works', or step-by-step logic.\n" +
                     "4. **Real-world Examples**: Concrete use cases or historical context.\n" +
                     "5. **Summary**: Key takeaways.\n\n" +
                     "Formatting:\n" +
                     "- Use Markdown headers (##, ###).\n" +
                     "- Use bolding for key terms.\n" +
                     "- **IMPORTANT**: Wrap ALL mathematical formulas in LaTeX: $inline$ or $$block$$.\n" +
                     "- Use lists and bullet points for readability.\n" +
                     "- Length: Comprehensive (approx 800-1500 words).\n" +
                     "Please respond in Chinese." 
          },
          { role: "user", content: `Topic: ${topic}\nContext/Background: ${context || 'General knowledge'}` }
        ],
        model: options.model || provider.model,
      });

      return completion.choices[0].message.content || '';
    } catch (error: any) {
      logger.error('AI Learning Material Error:', error);
      throw new Error(error.message || 'AI generation failed');
    }
  }
}

export const aiService = new AIService();
