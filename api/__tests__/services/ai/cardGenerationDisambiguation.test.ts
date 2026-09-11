import { describe, it, expect, vi, beforeEach } from "vitest";
import { cardGenerationService } from "../../../services/ai/cardGenerationService";

vi.mock("../../../services/ai/factory", () => ({
  getAIProviderForTask: vi.fn(),
  getAIProvider: vi.fn(),
}));

vi.mock("../../../services/ai/promptService", () => ({
  promptService: {
    getRenderedPrompt: vi.fn().mockResolvedValue(""),
  },
}));

import * as factory from "../../../services/ai/factory";
import * as promptModule from "../../../services/ai/promptService";

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

/** 让 provider.create 解析出有效 JSON，并抓取传入的 system prompt */
function resolveCards(create: ReturnType<typeof vi.fn>) {
  create.mockResolvedValue({
    choices: [
      {
        message: {
          content: JSON.stringify({
            cards: [
              { type: "choice", question: "Q?", answer: "A", options: ["A", "B"] },
            ],
          }),
        },
      },
    ],
  });
}

function lastSystemPrompt(create: ReturnType<typeof vi.fn>): string {
  const call = create.mock.calls[0][0] as { messages: Array<{ content: string }> };
  return call.messages[0].content;
}

describe("CardGenerationService.generateCards disambiguation injection", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(promptModule.promptService.getRenderedPrompt).mockResolvedValue("");
  });

  it("injects Knowledge Graph Context block when disambiguation provided", async () => {
    const mockProvider = createMockProvider();
    resolveCards(mockProvider.client.chat.completions.create);
    vi.mocked(factory.getAIProviderForTask).mockReturnValue(mockProvider as never);

    await cardGenerationService.generateCards("Transformer", "Content", {
      types: ["qa"],
      count: 1,
      disambiguation: {
        graphTitle: "深度学习",
        graphDomain: "AI",
        parentChain: "神经网络基础 → 注意力机制",
        childrenOutline: "- 自注意力机制：计算 Query/Key/Value",
        hasContext: true,
      },
    });

    const systemPrompt = lastSystemPrompt(mockProvider.client.chat.completions.create);
    expect(systemPrompt).toContain("## Knowledge Graph Context");
    expect(systemPrompt).toContain('belongs to the knowledge graph "深度学习" domain: AI');
    expect(systemPrompt).toContain("Position in this graph's hierarchy: 神经网络基础 → 注意力机制");
    expect(systemPrompt).toContain("自注意力机制");
    expect(systemPrompt).toContain("Interpret the topic strictly within this knowledge graph's context");
  });

  it("does NOT inject disambiguation block when disambiguation is empty", async () => {
    const mockProvider = createMockProvider();
    resolveCards(mockProvider.client.chat.completions.create);
    vi.mocked(factory.getAIProviderForTask).mockReturnValue(mockProvider as never);

    await cardGenerationService.generateCards("Topic", "Content", {
      types: ["qa"],
      count: 1,
      disambiguation: { hasContext: false },
    });

    const systemPrompt = lastSystemPrompt(mockProvider.client.chat.completions.create);
    expect(systemPrompt).not.toContain("## Knowledge Graph Context");
  });

  it("does NOT inject disambiguation block when option omitted（零回归）", async () => {
    const mockProvider = createMockProvider();
    resolveCards(mockProvider.client.chat.completions.create);
    vi.mocked(factory.getAIProviderForTask).mockReturnValue(mockProvider as never);

    await cardGenerationService.generateCards("Topic", "Content", {
      types: ["qa"],
      count: 1,
    });

    const systemPrompt = lastSystemPrompt(mockProvider.client.chat.completions.create);
    expect(systemPrompt).not.toContain("## Knowledge Graph Context");
  });
});
