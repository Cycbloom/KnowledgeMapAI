import { describe, it, expect, vi, beforeEach } from "vitest";
import { AIService } from "../../services/aiService";

vi.mock("../../services/ai/factory", () => ({
  getAIProviderForTask: vi.fn(),
  getAIProvider: vi.fn(),
}));

import * as factory from "../../services/ai/factory";

const createMockProvider = (overrides = {}) => ({
  hasKey: true,
  model: "test-model",
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
  ...overrides,
});

describe("AIService", () => {
  let aiService: AIService;

  beforeEach(() => {
    vi.clearAllMocks();
    aiService = new AIService();
  });

  describe("generateEmbedding", () => {
    it("should return null if text is empty", async () => {
      vi.mocked(factory.getAIProviderForTask).mockReturnValue(
        createMockProvider() as any,
      );

      const result = await aiService.generateEmbedding("");
      expect(result).toBeNull();
    });
  });

  describe("chat", () => {
    it("should use specific provider if specified in options", async () => {
      const mockProvider = createMockProvider();
      mockProvider.client.chat.completions.create.mockResolvedValue({
        choices: [{ message: { content: "Test response" } }],
      });

      vi.mocked(factory.getAIProvider).mockReturnValue(mockProvider as any);

      const result = await aiService.chat([{ role: "user", content: "Hi" }], {
        provider: "deepseek",
      });

      expect(factory.getAIProvider).toHaveBeenCalledWith("deepseek");
      expect(result).toBe("Test response");
    });

    it("should use default text provider if no provider specified", async () => {
      const mockProvider = createMockProvider();
      mockProvider.client.chat.completions.create.mockResolvedValue({
        choices: [{ message: { content: "Test response" } }],
      });

      vi.mocked(factory.getAIProviderForTask).mockReturnValue(
        mockProvider as any,
      );

      await aiService.chat([{ role: "user", content: "Hi" }]);

      expect(factory.getAIProviderForTask).toHaveBeenCalledWith("text");
    });
  });

  describe("generateCards", () => {
    it("should clean markdown code blocks from JSON response", async () => {
      const jsonResponse = {
        cards: [
          { type: "qa", question: "Q1", answer: "A1", explanation: "E1" },
        ],
      };

      const mockProvider = createMockProvider();
      mockProvider.client.chat.completions.create.mockResolvedValue({
        choices: [
          {
            message: {
              content: "```json\n" + JSON.stringify(jsonResponse) + "\n```",
            },
          },
        ],
      });

      vi.mocked(factory.getAIProviderForTask).mockReturnValue(
        mockProvider as any,
      );

      const result = await aiService.generateCards("Topic", "Content");

      expect(result).toEqual(jsonResponse);
    });

    it("should handle malformed JSON response", async () => {
      const mockProvider = createMockProvider();
      mockProvider.client.chat.completions.create.mockResolvedValue({
        choices: [
          {
            message: {
              content: "Not a valid JSON",
            },
          },
        ],
      });

      vi.mocked(factory.getAIProviderForTask).mockReturnValue(
        mockProvider as any,
      );

      const consoleSpy = vi
        .spyOn(console, "error")
        .mockImplementation(() => {});
      const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});

      await expect(aiService.generateCards("Topic", "Content")).rejects.toThrow(
        "Failed to parse AI response",
      );

      consoleSpy.mockRestore();
      logSpy.mockRestore();
    });

    it("should correctly extract JSON from mixed content", async () => {
      const jsonResponse = { cards: [] };
      const mixedContent =
        "Here is the result: ```json " +
        JSON.stringify(jsonResponse) +
        " ``` Hope it helps.";

      const mockProvider = createMockProvider();
      mockProvider.client.chat.completions.create.mockResolvedValue({
        choices: [
          {
            message: {
              content: mixedContent,
            },
          },
        ],
      });

      vi.mocked(factory.getAIProviderForTask).mockReturnValue(
        mockProvider as any,
      );

      const result = await aiService.generateCards("Topic", "Content");
      expect(result).toEqual(jsonResponse);
    });
  });
});
