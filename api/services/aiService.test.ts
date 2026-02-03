
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AIService } from './aiService';
import * as factory from './ai/factory';

// Mock factory module
const { mockProvider } = vi.hoisted(() => {
  return {
    mockProvider: {
      hasKey: true,
      model: 'test-model',
      providerType: 'deepseek',
      client: {
        chat: {
          completions: {
            create: vi.fn(),
          },
        },
        embeddings: {
          create: vi.fn(),
        },
      },
    }
  }
});

vi.mock('./ai/factory', () => ({
  getAIProviderForTask: vi.fn(() => mockProvider as any),
  getAIProvider: vi.fn(() => mockProvider as any),
}));

describe('AIService', () => {
  let aiService: AIService;

  beforeEach(() => {
    aiService = new AIService();
    vi.clearAllMocks();
    
    // Reset mock implementation for each test if needed, though default is set in factory mock
    // We can override return values in specific tests using vi.mocked(factory.getAIProviderForTask).mockReturnValue(...)
  });

  describe('generateEmbedding', () => {
    it('should return null if text is empty', async () => {
      const result = await aiService.generateEmbedding('');
      expect(result).toBeNull();
    });

    it('should return null and warn if provider has no key', async () => {
      const noKeyProvider = { ...mockProvider, hasKey: false };
      vi.mocked(factory.getAIProviderForTask).mockReturnValue(noKeyProvider as any);
      
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      
      const result = await aiService.generateEmbedding('test text');
      
      expect(result).toBeNull();
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('No API key for embedding provider'));
      consoleSpy.mockRestore();
    });

    it('should use provider.createEmbedding if available', async () => {
      const customProvider = {
        ...mockProvider,
        createEmbedding: vi.fn().mockResolvedValue([0.1, 0.2, 0.3]),
      };
      vi.mocked(factory.getAIProviderForTask).mockReturnValue(customProvider as any);

      const result = await aiService.generateEmbedding('test text');

      expect(customProvider.createEmbedding).toHaveBeenCalledWith('test text');
      expect(result).toEqual([0.1, 0.2, 0.3]);
    });

    it('should use client.embeddings.create if createEmbedding is not available', async () => {
      vi.mocked(factory.getAIProviderForTask).mockReturnValue(mockProvider as any);
      mockProvider.client.embeddings.create.mockResolvedValue({
        data: [{ embedding: [0.1, 0.2, 0.3] }],
      });

      const result = await aiService.generateEmbedding('test text');

      expect(mockProvider.client.embeddings.create).toHaveBeenCalledWith({
        model: 'test-model',
        input: 'test text',
        encoding_format: 'float',
      });
      expect(result).toEqual([0.1, 0.2, 0.3]);
    });

    it('should handle errors gracefully', async () => {
      vi.mocked(factory.getAIProviderForTask).mockReturnValue(mockProvider as any);
      mockProvider.client.embeddings.create.mockRejectedValue(new Error('API Error'));
      
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const result = await aiService.generateEmbedding('test text');

      expect(result).toBeNull();
      // Logger formats error into the string
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Failed to generate embedding'));
      consoleSpy.mockRestore();
    });
  });

  describe('chat', () => {
    it('should use specific provider if specified in options', async () => {
      vi.mocked(factory.getAIProvider).mockReturnValue(mockProvider as any);
      mockProvider.client.chat.completions.create.mockResolvedValue({
        choices: [{ message: { content: 'Test response' } }],
      });

      const result = await aiService.chat([{ role: 'user', content: 'Hi' }], { provider: 'deepseek' });

      expect(factory.getAIProvider).toHaveBeenCalledWith('deepseek');
      expect(result).toBe('Test response');
    });

    it('should use default text provider if no provider specified', async () => {
      vi.mocked(factory.getAIProviderForTask).mockReturnValue(mockProvider as any);
      mockProvider.client.chat.completions.create.mockResolvedValue({
        choices: [{ message: { content: 'Test response' } }],
      });

      await aiService.chat([{ role: 'user', content: 'Hi' }]);

      expect(factory.getAIProviderForTask).toHaveBeenCalledWith('text');
    });

    it('should return mock response if provider has no key', async () => {
      const noKeyProvider = { ...mockProvider, hasKey: false };
      vi.mocked(factory.getAIProviderForTask).mockReturnValue(noKeyProvider as any);

      const result = await aiService.chat([{ role: 'user', content: 'Hi' }]);

      expect(result).toContain('[模拟 AI 回复]');
    });
  });

  describe('generateCards', () => {
    it('should return mock cards if provider has no key', async () => {
      const noKeyProvider = { ...mockProvider, hasKey: false };
      vi.mocked(factory.getAIProviderForTask).mockReturnValue(noKeyProvider as any);

      const result = await aiService.generateCards('Topic', 'Content');

      expect(result.cards.length).toBeGreaterThan(0);
      expect(result.cards[0].question).toContain('Topic');
    });

    it('should clean markdown code blocks from JSON response', async () => {
      vi.mocked(factory.getAIProviderForTask).mockReturnValue(mockProvider as any);
      
      const jsonResponse = {
        cards: [
          { type: 'qa', question: 'Q1', answer: 'A1', explanation: 'E1' }
        ]
      };
      
      // Simulate response wrapped in markdown code block
      mockProvider.client.chat.completions.create.mockResolvedValue({
        choices: [{ 
          message: { 
            content: "```json\n" + JSON.stringify(jsonResponse) + "\n```" 
          } 
        }],
      });

      const result = await aiService.generateCards('Topic', 'Content');

      expect(result).toEqual(jsonResponse);
    });

    it('should handle malformed JSON response', async () => {
      vi.mocked(factory.getAIProviderForTask).mockReturnValue(mockProvider as any);
      
      mockProvider.client.chat.completions.create.mockResolvedValue({
        choices: [{ 
          message: { 
            content: "Not a valid JSON" 
          } 
        }],
      });

      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {}); // Suppress "Raw result" log

      await expect(aiService.generateCards('Topic', 'Content')).rejects.toThrow('Failed to parse AI response');
      
      consoleSpy.mockRestore();
      logSpy.mockRestore();
    });

    it('should correctly extract JSON from mixed content', async () => {
      vi.mocked(factory.getAIProviderForTask).mockReturnValue(mockProvider as any);
      
      const jsonResponse = { cards: [] };
      const mixedContent = "Here is the result: ```json " + JSON.stringify(jsonResponse) + " ``` Hope it helps.";
      
      mockProvider.client.chat.completions.create.mockResolvedValue({
        choices: [{ 
          message: { 
            content: mixedContent
          } 
        }],
      });

      const result = await aiService.generateCards('Topic', 'Content');
      expect(result).toEqual(jsonResponse);
    });
  });
});
