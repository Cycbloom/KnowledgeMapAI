import { getAIProviderForTask, getAIProvider } from '../ai/factory.js';
import type { AIProviderType } from '../ai/types.js';
import { promptService } from '../promptService.js';
import { cacheService, CacheKeys } from '../cache.js';
import { supabaseAdmin } from '../../supabase.js';
import { logger } from '../../utils/logger.js';
import { parseAIResponse, buildTutorContext } from './utils.js';
import { 
  getMockResponse, 
  getMockCards, 
  getMockBranchSuggestions, 
  getMockConcepts, 
  getMockNextTopics,
  getMockImageGraph 
} from './mock.js';

const DEFAULT_TIMEOUT = 60000;
const pendingRequests = new Map<string, Promise<unknown>>();

function withTimeout<T>(promise: Promise<T>, ms: number = DEFAULT_TIMEOUT): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => 
      setTimeout(() => reject(new Error(`AI request timeout after ${ms}ms`)), ms)
    ),
  ]);
}

async function dedupedRequest<T>(key: string, fn: () => Promise<T>): Promise<T> {
  const pending = pendingRequests.get(key) as Promise<T> | undefined;
  if (pending) {
    logger.debug(`Reusing pending request for key: ${key}`);
    return pending;
  }
  
  const promise = fn().finally(() => pendingRequests.delete(key));
  pendingRequests.set(key, promise);
  return promise;
}

function generateRequestKey(operation: string, params: Record<string, unknown>): string {
  const sortedParams = Object.keys(params)
    .sort()
    .map(k => `${k}=${JSON.stringify(params[k])}`)
    .join('&');
  return `${operation}:${sortedParams}`;
}

export interface GenerateCardsOptions {
  type?: string;
  types?: string[];
  count?: number;
  context?: string;
  provider?: AIProviderType;
  model?: string;
  userId?: string;
  graphId?: string;
  pack_type?: string;
}

export class AIService {
  async generateEmbedding(text: string): Promise<number[] | null> {
    const provider = await getAIProviderForTask('embedding');

    if (!provider.hasKey) {
      return null;
    }

    try {
      if (provider.createEmbedding) {
        return await provider.createEmbedding(text);
      }
      
      const response = await provider.client.embeddings.create({
        model: provider.embeddingModel || provider.model,
        input: text,
      });
      return response.data[0].embedding;
    } catch (error) {
      logger.error('Failed to generate embedding:', error);
      return null;
    }
  }

  async generateEmbeddingsBatch(texts: string[]): Promise<(number[] | null)[]> {
    const provider = await getAIProviderForTask('embedding');

    if (!provider.hasKey) {
      return texts.map(() => null);
    }

    if (texts.length === 0) {
      return [];
    }

    if (provider.createEmbedding) {
      const concurrencyLimit = 5;
      const results: (number[] | null)[] = new Array(texts.length).fill(null);
      
      for (let i = 0; i < texts.length; i += concurrencyLimit) {
        const batch = texts.slice(i, i + concurrencyLimit);
        const batchResults = await Promise.all(
          batch.map(text => provider.createEmbedding!(text).catch(() => null))
        );
        
        for (let j = 0; j < batch.length; j++) {
          results[i + j] = batchResults[j];
        }
        
        if (i + concurrencyLimit < texts.length) {
          await new Promise(resolve => setTimeout(resolve, 100));
        }
      }
      
      return results;
    }

    try {
      const response = await provider.client.embeddings.create({
        model: provider.embeddingModel || provider.model,
        input: texts,
      });
      
      const results: (number[] | null)[] = new Array(texts.length).fill(null);
      for (const item of response.data) {
        results[item.index] = item.embedding;
      }
      return results;
    } catch (error) {
      logger.error('Failed to generate embeddings batch:', error);
      return texts.map(() => null);
    }
  }

  async chat(messages: Array<{ role: 'user' | 'assistant' | 'system'; content: string }>, options: { provider?: AIProviderType; model?: string; timeout?: number } = {}): Promise<string> {
    const provider = options.provider
      ? await getAIProvider(options.provider)
      : await getAIProviderForTask('text');

    if (!provider.hasKey) {
      const response = getMockResponse('chat', messages[messages.length - 1].content);
      return typeof response === 'string' ? response : JSON.stringify(response);
    }

    const requestKey = generateRequestKey('chat', { 
      model: options.model || provider.model, 
      lastMessage: messages[messages.length - 1].content.slice(0, 100) 
    });

    try {
      return await dedupedRequest(requestKey, async () => {
        const completion = await withTimeout(
          provider.client.chat.completions.create({
            messages,
            model: options.model || provider.model,
          }),
          options.timeout || DEFAULT_TIMEOUT
        );

        return completion.choices[0].message.content || '';
      });
    } catch (error: unknown) {
      const err = error as Error;
      logger.error('AI Chat Error:', error);
      throw new Error(err.message || 'AI chat failed');
    }
  }

  async generatePodcastScript(context: string, language: string = 'zh'): Promise<string> {
    const prompt = `You are a professional podcast host. 
Your task is to create an engaging, educational podcast script based on the provided knowledge graph content.
The script should be:
1. Conversational and easy to listen to.
2. Structured with an intro, key points (deep dive), and a conclusion.
3. About 3-5 minutes long when spoken.
4. Written in ${language} (if the content is mixed, prefer ${language}).
5. Use clear markers for the speaker (e.g., "Host:").

Content to cover:
${context}

Please output the script in raw Markdown format.
IMPORTANT: Do NOT wrap the output in a code block (e.g., no \`\`\`markdown ... \`\`\`). Just return the raw Markdown text directly.`;

    const provider = await getAIProviderForTask('text');
    
    if (!provider.hasKey) {
      return `**主持人**: 大家好，欢迎来到今天的知识播客！今天我们要聊的主题非常有意思。

**主持人**: 不过，很遗憾，由于我还没有连接到 AI 大脑（API Key 未配置），我只能简单和你打个招呼。

**主持人**: 请配置好 API Key 后，我将为你带来精彩的深度解读！`;
    }

    try {
      const completion = await withTimeout(
        provider.client.chat.completions.create({
          messages: [
            { role: 'system', content: 'You are an expert podcast script writer.' },
            { role: 'user', content: prompt }
          ],
          model: provider.model,
        }),
        DEFAULT_TIMEOUT
      );

      return completion.choices[0].message.content || '';
    } catch (error: unknown) {
      const err = error as Error;
      logger.error('Generate Podcast Script Error:', error);
      throw new Error(err.message || 'Failed to generate podcast script');
    }
  }

  async generateCards(topic: string, content: string, options: GenerateCardsOptions = {}) {
    const types = options.type ? [options.type] : (options.types || ['qa', 'choice']);
    const count = options.count || 3;
    const context = options.context;

    const provider = options.provider 
      ? await getAIProvider(options.provider) 
      : await getAIProviderForTask('text');

    if (!provider.hasKey) {
      return { cards: getMockCards(topic, types, count) };
    }

    const typePrompts: Record<string, string> = {
      qa: "For 'qa' type: Create thought-provoking open-ended questions that test deep understanding.",
      choice: "For 'choice' type: Create multiple-choice questions with 4 plausible options.",
      true_false: "For 'true_false' type: Create statements focusing on common misconceptions.",
      multi_choice: "For 'multi_choice' type: Create multiple-choice questions where ONE OR MORE options can be correct.",
      fill_in_the_blank: "For 'fill_in_the_blank' type: Create a sentence with '___' as blanks.",
      essay: "For 'essay' type: Create complex questions requiring a long-form structured answer."
    };

    try {
      const promptParts = await Promise.all(types.map(async (type) => {
        const code = `generate_cards_${type}`;
        const rendered = await promptService.getRenderedPrompt(
          supabaseAdmin,
          code,
          { count: Math.ceil(count / types.length) },
          options.userId,
          options.graphId
        );

        if (rendered && rendered.trim().length > 0) {
          return rendered;
        }

        return typePrompts[type] || "";
      }));

      let systemPrompt = promptParts.filter(p => p.length > 0).join('\n\n---\n\n');

      if (!systemPrompt.trim()) {
        systemPrompt = await promptService.getRenderedPrompt(
          supabaseAdmin,
          'generate_cards',
          {
            count,
            allowedTypes: types.join(', '),
            context: context ? `Parent/Context Info: ${context}` : '',
          },
          options.userId,
          options.graphId
        );
      } else {
        systemPrompt = `You are an educational expert. Generate ${count} flashcards based on the provided topic.\n\nContext: ${context || 'None'}\n\n${systemPrompt}`;
      }

      const completion = await withTimeout(
        provider.client.chat.completions.create({
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: `Topic: ${topic}\nContent: ${content || 'No detailed content provided.'}` }
          ],
          model: options.model || provider.model,
          response_format: { type: "json_object" },
        }),
        DEFAULT_TIMEOUT
      );

      const result = completion.choices[0].message.content || '';
      const parsed = parseAIResponse<{ cards: unknown[] }>(result, 'Generate Cards');
      
      return { cards: parsed.cards || [] };
    } catch (error: unknown) {
      const err = error as Error;
      logger.error('AI Error:', error);
      throw new Error(err.message || 'AI card generation failed');
    }
  }

  async expandKnowledge(nodeTitle: string, nodeContent?: string, existingNodes?: string[], childNodes?: string[], options: { provider?: AIProviderType; model?: string; contextLevel?: string; expandPrompt?: string; userId?: string; graphId?: string } = {}) {
    const provider = options.provider
      ? await getAIProvider(options.provider)
      : await getAIProviderForTask('text');

    if (!provider.hasKey) {
      return getMockResponse('expand', nodeTitle) as { suggestions: unknown[] };
    }

    const cacheKey = CacheKeys.AI_EXPAND(nodeTitle, options.contextLevel || 'normal');
    const cached = await cacheService.get<{ suggestions: unknown[] }>(cacheKey);
    if (cached) {
      return cached;
    }

    try {
      const existingNodesContext = existingNodes && existingNodes.length > 0 
        ? `\nExisting Nodes in Graph: ${existingNodes.slice(0, 300).join(', ')}`
        : '';
        
      const childrenContext = childNodes && childNodes.length > 0
        ? `\nCurrent Direct Children (DO NOT suggest these): ${childNodes.join(', ')}`
        : '';

      const contextLevel = options.contextLevel || 'normal';
      
      const templateContext = {
        customPrompt: options.expandPrompt,
        nodeTitle,
        nodeContent: nodeContent || '',
        existingNodes: existingNodesContext,
        childrenContext,
        isRootOrCore: ['root', 'core'].includes(contextLevel),
        isLeaf: contextLevel === 'leaf'
      };

      const systemPrompt = await promptService.getRenderedPrompt(
        supabaseAdmin,
        'expand_knowledge',
        templateContext,
        options.userId,
        options.graphId
      );

      const completion = await provider.client.chat.completions.create({
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: `Node Title: ${nodeTitle}\nNode Content: ${nodeContent || ''}${existingNodesContext}${childrenContext}` }
        ],
        model: options.model || provider.model,
        response_format: { type: "json_object" },
      });

      const content = completion.choices[0].message.content || '';
      
      if (!content || content.trim() === '') {
        logger.error('[AI] Empty response from AI provider for expandKnowledge');
        return getMockResponse('expand', nodeTitle) as { suggestions: unknown[] };
      }
      
      const parsed = parseAIResponse<{ suggestions: unknown[] }>(content, 'Expand Knowledge');
      const result = { suggestions: parsed.suggestions || parsed };
      
      await cacheService.set(cacheKey, result, 60 * 60 * 24);
      
      return result;
    } catch (error: unknown) {
      const err = error as Error;
      logger.error('AI Error:', error);
      
      if (err.message?.includes('parse') || err.message?.includes('JSON')) {
        logger.warn('[AI] Returning mock response due to parse error');
        return getMockResponse('expand', nodeTitle) as { suggestions: unknown[] };
      }
      
      throw new Error(err.message || 'AI expansion failed');
    }
  }

  async getBranchSuggestions(nodeTitle: string, nodeContent?: string, existingNodes?: string[], childNodes?: string[], options: { provider?: AIProviderType; model?: string; contextLevel?: string; userId?: string; graphId?: string } = {}) {
    const provider = options.provider
      ? await getAIProvider(options.provider)
      : await getAIProviderForTask('text');

    if (!provider.hasKey) {
      return { suggestions: getMockBranchSuggestions(nodeTitle) };
    }

    try {
      const existingNodesContext = existingNodes && existingNodes.length > 0 
        ? `\nExisting Nodes in Graph: ${existingNodes.slice(0, 300).join(', ')}`
        : '';
        
      const childrenContext = childNodes && childNodes.length > 0
        ? `\nCurrent Direct Children (DO NOT suggest these): ${childNodes.join(', ')}`
        : '';

      const contextLevel = options.contextLevel || 'normal';

      const templateContext = {
        nodeTitle,
        nodeContent: nodeContent || '',
        existingNodes: existingNodesContext,
        childrenContext,
        isRootOrCore: ['root', 'core'].includes(contextLevel),
        isLeaf: contextLevel === 'leaf'
      };

      const systemPrompt = await promptService.getRenderedPrompt(
        supabaseAdmin,
        'branch_suggestions',
        templateContext,
        options.userId,
        options.graphId
      );

      const completion = await provider.client.chat.completions.create({
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: `Node Title: ${nodeTitle}\nNode Content: ${nodeContent || ''}${existingNodesContext}${childrenContext}` }
        ],
        model: options.model || provider.model,
        response_format: { type: "json_object" },
      });

      const content = completion.choices[0].message.content || '';
      const parsed = parseAIResponse<{ suggestions: unknown[] }>(content, 'Branch Suggestions');

      return { suggestions: parsed.suggestions || [] };
    } catch (error: unknown) {
      const err = error as Error;
      logger.error('AI Error:', error);
      throw new Error(err.message || 'AI branch suggestions failed');
    }
  }

  async generateGraphFromImage(imageBase64: string, options: { provider?: AIProviderType; model?: string } = {}) {
    let providerName = options.provider;
    
    if (!providerName) {
      const defaultTextProvider = await getAIProviderForTask('text');
      if (defaultTextProvider.providerType === 'deepseek') {
        providerName = 'aliyun';
      } else {
        providerName = defaultTextProvider.providerType;
      }
    }

    const provider = await getAIProvider(providerName as AIProviderType);

    if (!provider.hasKey) {
      return getMockImageGraph();
    }

    let model = options.model || provider.model;
    if (provider.providerType === 'aliyun' && !model.includes('vl')) {
      model = 'qwen-vl-max';
    }

    try {
      const completion = await provider.client.chat.completions.create({
        messages: [
          { 
            role: "system", 
            content: `You are a knowledge graph expert capable of analyzing visual content.
            
Your task:
1. Analyze the provided image to extract the structured knowledge hierarchy.
2. Output a JSON object with 'nodes' and 'edges' arrays.
   - Nodes: { "id": "temp_id", "title": "Title", "content": "Description", "level": "root|core|sub|normal|leaf" }
   - Edges: { "source": "parent_id", "target": "child_id", "relationship": "contains|related" }
3. Limit to 30-50 nodes.
4. Respond in Chinese.`
          },
          { 
            role: "user", 
            content: [
              { type: "text", text: "Please analyze this image and generate the knowledge graph JSON." },
              { type: "image_url", image_url: { url: imageBase64 } }
            ]
          }
        ],
        model,
        response_format: { type: "json_object" },
        max_tokens: 4000,
      });

      const content = completion.choices[0].message.content || '';
      return parseAIResponse<{ nodes: unknown[]; edges: unknown[] }>(content, 'Image to Graph');

    } catch (error: unknown) {
      const err = error as Error;
      logger.error('Image-to-Graph Error:', error);
      throw new Error(err.message || 'Image processing failed');
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
    } catch (error: unknown) {
      const err = error as Error;
      logger.error('AI Learning Material Error:', error);
      throw new Error(err.message || 'AI generation failed');
    }
  }

  async suggestNextTopic(nodeTitle: string, nodeContent?: string, existingNodes?: string[], options: { provider?: AIProviderType; model?: string; userProgress?: { masteredCount?: number; currentLevel?: string } } = {}) {
    const provider = options.provider
      ? await getAIProvider(options.provider)
      : await getAIProviderForTask('text');

    if (!provider.hasKey) {
      return { suggestions: getMockNextTopics(nodeTitle) };
    }

    try {
      const progressContext = options.userProgress 
        ? `\nUser Progress:\n- Mastered nodes: ${options.userProgress.masteredCount || 0}\n- Current level: ${options.userProgress.currentLevel || 'beginner'}`
        : '';

      const completion = await provider.client.chat.completions.create({
        messages: [
          { 
            role: "system", 
            content: "You are an expert knowledge tutor. Based on the current node and user's learning progress, suggest 2-3 next topics to explore.\n" +
              "Return a JSON object with a 'suggestions' array. Each object must have:\n" +
              "- 'title': Brief topic title (max 30 chars)\n" +
              "- 'description': Short explanation (max 80 chars)\n" +
              "- 'priority': 'high', 'medium', or 'low'\n" +
              "- 'estimatedDifficulty': Number from 1-5\n" +
              "Please respond in Chinese." 
          },
          { 
            role: "user", 
            content: `Current Node:\nTitle: ${nodeTitle}\nContent: ${nodeContent || ''}${progressContext}` 
          }
        ],
        model: options.model || provider.model,
        response_format: { type: "json_object" },
      });

      const content = completion.choices[0].message.content || '';
      const parsed = parseAIResponse<{ suggestions: unknown[] }>(content, 'Suggest Next Topic');

      return { suggestions: parsed.suggestions || [] };
    } catch (error: unknown) {
      const err = error as Error;
      logger.error('AI Error:', error);
      throw new Error(err.message || 'AI suggestion failed');
    }
  }

  async tutorChat(messages: Array<{ role: string; content: string }>, context: {
    graphId?: string;
    currentNodeId?: string;
    currentNodeTitle?: string;
    currentNodeContent?: string;
    existingNodes?: string[];
    userProgress?: { masteredCount?: number; dueCount?: number };
    mode?: 'free' | 'guided';
    learningPath?: string[];
  } = {}, options: { provider?: AIProviderType; model?: string } = {}) {
    const provider = options.provider
      ? await getAIProvider(options.provider)
      : await getAIProviderForTask('text');

    if (!provider.hasKey) {
      const lastMessage = messages[messages.length - 1];
      return `[模拟助教回复] 我收到了你的消息: "${lastMessage?.content || ''}"。这是一个模拟回复，因为后端没有配置 API Key。`;
    }

    try {
      const contextText = buildTutorContext(context);
      const modePrompt = context.mode === 'guided' 
        ? "Guided Mode: Follow a structured learning path. Guide the user step-by-step."
        : "Free Mode: Allow open-ended discussion. Answer questions freely.";

      const completion = await provider.client.chat.completions.create({
        messages: [
          { 
            role: "system", 
            content: `You are an intelligent knowledge tutor for a Knowledge Graph application.

${modePrompt}

Current Context:
${contextText}

Instructions:
1. Be conversational and engaging
2. Use markdown formatting for better readability
3. When explaining concepts, provide examples
4. Respond in the same language as the user (default to Chinese)
5. All mathematical formulas must be wrapped in LaTeX: $inline$ or $$block$$`
          },
          ...messages.map((msg) => ({ role: msg.role as 'user' | 'assistant' | 'system', content: msg.content }))
        ],
        model: options.model || provider.model,
      });

      return completion.choices[0].message.content || '';
    } catch (error: unknown) {
      const err = error as Error;
      logger.error('AI Tutor Chat Error:', error);
      throw new Error(err.message || 'AI tutor chat failed');
    }
  }

  async extractConcepts(text: string, existingNodes?: string[], options: { provider?: AIProviderType; model?: string; maxConcepts?: number } = {}) {
    const provider = options.provider
      ? await getAIProvider(options.provider)
      : await getAIProviderForTask('text');

    if (!provider.hasKey) {
      return { concepts: getMockConcepts() };
    }

    try {
      const existingNodesContext = existingNodes && existingNodes.length > 0
        ? `\nExisting Nodes (DO NOT duplicate these): ${existingNodes.slice(0, 50).join(', ')}`
        : '';

      const maxConcepts = options.maxConcepts || 5;

      const completion = await provider.client.chat.completions.create({
        messages: [
          { 
            role: "system", 
            content: `You are a concept extraction expert. Analyze the given text and extract key concepts.

Requirements:
1. Extract ${maxConcepts} most important concepts
2. Each concept should be a standalone knowledge point
3. Avoid duplicating existing nodes
4. Provide a brief description for each concept
5. Assign a priority level based on importance

Return a JSON object with a 'concepts' array. Each object must have:
- 'title': Concept name (max 20 chars)
- 'description': Brief explanation (max 100 chars)
- 'priority': 'high', 'medium', or 'low'

Please respond in Chinese.` 
          },
          { 
            role: "user", 
            content: `Text to analyze:\n${text}${existingNodesContext}` 
          }
        ],
        model: options.model || provider.model,
        response_format: { type: "json_object" },
      });

      const content = completion.choices[0].message.content || '';
      const parsed = parseAIResponse<{ concepts: unknown[] }>(content, 'Extract Concepts');

      return { concepts: parsed.concepts || [] };
    } catch (error: unknown) {
      const err = error as Error;
      logger.error('AI Error:', error);
      throw new Error(err.message || 'AI concept extraction failed');
    }
  }
}

export const aiService = new AIService();
