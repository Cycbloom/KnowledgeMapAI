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

/** 抓取第 index 次调用传入的 system prompt */
function systemPromptAt(create: ReturnType<typeof vi.fn>, index: number): string {
  const call = create.mock.calls[index][0] as { messages: Array<{ content: string }> };
  return call.messages[0].content;
}

describe("CardGenerationService.generateCards sibling distractor injection", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(promptModule.promptService.getRenderedPrompt).mockResolvedValue("");
  });

  it("injects DISCRIMINATOR OPTIONS when siblingNodes provided and types include choice", async () => {
    const mockProvider = createMockProvider();
    resolveCards(mockProvider.client.chat.completions.create);
    vi.mocked(factory.getAIProviderForTask).mockReturnValue(mockProvider as never);

    await cardGenerationService.generateCards("Current Topic", "Content about current", {
      types: ["choice"],
      count: 3,
      coverage: "with_siblings",
      siblingNodes: [
        { knowledgePointId: "sib-1", title: "Sibling Alpha", content: "alpha details" },
      ],
    });

    const systemPrompt = lastSystemPrompt(mockProvider.client.chat.completions.create);
    expect(systemPrompt).toContain("DISCRIMINATOR OPTIONS");
    expect(systemPrompt).toContain("Sibling Alpha");
  });

  it("does NOT inject DISCRIMINATOR OPTIONS when types is only qa", async () => {
    const mockProvider = createMockProvider();
    resolveCards(mockProvider.client.chat.completions.create);
    vi.mocked(factory.getAIProviderForTask).mockReturnValue(mockProvider as never);

    await cardGenerationService.generateCards("Current Topic", "Content about current", {
      types: ["qa"],
      count: 3,
      coverage: "with_siblings",
      siblingNodes: [
        { knowledgePointId: "sib-1", title: "Sibling Alpha", content: "alpha details" },
      ],
    });

    const systemPrompt = lastSystemPrompt(mockProvider.client.chat.completions.create);
    expect(systemPrompt).not.toContain("DISCRIMINATOR OPTIONS");
  });

  it("calls AI filter then generates when siblings exceed maxSiblingDistractors", async () => {
    const mockProvider = createMockProvider();
    const create = mockProvider.client.chat.completions.create;
    // 第一次调用：相关性筛选，返回 3 个 selected 标题（乱序验证按原顺序映射）
    create.mockResolvedValueOnce({
      choices: [
        {
          message: {
            content: JSON.stringify({ selected: ["Sib 5", "Sib 1", "Sib 3"] }),
          },
        },
      ],
    });
    // 第二次调用：卡片生成
    resolveCards(create);
    vi.mocked(factory.getAIProviderForTask).mockReturnValue(mockProvider as never);

    await cardGenerationService.generateCards("Current Topic", "Content about current", {
      types: ["choice"],
      count: 3,
      coverage: "with_siblings",
      maxSiblingDistractors: 3,
      siblingNodes: [
        { knowledgePointId: "sib-1", title: "Sib 1", content: "one" },
        { knowledgePointId: "sib-2", title: "Sib 2", content: "two" },
        { knowledgePointId: "sib-3", title: "Sib 3", content: "three" },
        { knowledgePointId: "sib-4", title: "Sib 4", content: "four" },
        { knowledgePointId: "sib-5", title: "Sib 5", content: "five" },
      ],
    });

    expect(create).toHaveBeenCalledTimes(2);
    const systemPrompt = systemPromptAt(create, 1);
    expect(systemPrompt).toContain("DISCRIMINATOR OPTIONS");
    expect(systemPrompt).toContain("Sib 1");
    expect(systemPrompt).toContain("Sib 3");
    expect(systemPrompt).toContain("Sib 5");
    expect(systemPrompt).not.toContain("Sib 2");
    expect(systemPrompt).not.toContain("Sib 4");
  });

  it("skips AI filter when siblings are within maxSiblingDistractors", async () => {
    const mockProvider = createMockProvider();
    const create = mockProvider.client.chat.completions.create;
    resolveCards(create);
    vi.mocked(factory.getAIProviderForTask).mockReturnValue(mockProvider as never);

    await cardGenerationService.generateCards("Current Topic", "Content about current", {
      types: ["choice"],
      count: 3,
      coverage: "with_siblings",
      maxSiblingDistractors: 3,
      siblingNodes: [
        { knowledgePointId: "sib-1", title: "Sibling Alpha", content: "alpha details" },
        { knowledgePointId: "sib-2", title: "Sibling Beta", content: "beta details" },
      ],
    });

    expect(create).toHaveBeenCalledTimes(1);
    const systemPrompt = lastSystemPrompt(create);
    expect(systemPrompt).toContain("DISCRIMINATOR OPTIONS");
    expect(systemPrompt).toContain("Sibling Alpha");
    expect(systemPrompt).toContain("Sibling Beta");
  });

  it("falls back to first N siblings when the filter call fails", async () => {
    const mockProvider = createMockProvider();
    const create = mockProvider.client.chat.completions.create;
    // 第一次调用（筛选）reject，第二次（生成）正常返回
    create.mockRejectedValueOnce(new Error("filter boom"));
    resolveCards(create);
    vi.mocked(factory.getAIProviderForTask).mockReturnValue(mockProvider as never);

    await cardGenerationService.generateCards("Current Topic", "Content about current", {
      types: ["choice"],
      count: 3,
      coverage: "with_siblings",
      maxSiblingDistractors: 3,
      siblingNodes: [
        { knowledgePointId: "sib-1", title: "Sibling Alpha", content: "one" },
        { knowledgePointId: "sib-2", title: "Sibling Beta", content: "two" },
        { knowledgePointId: "sib-3", title: "Sibling Gamma", content: "three" },
        { knowledgePointId: "sib-4", title: "Sibling Delta", content: "four" },
        { knowledgePointId: "sib-5", title: "Sibling Epsilon", content: "five" },
      ],
    });

    expect(create).toHaveBeenCalledTimes(2);
    const systemPrompt = systemPromptAt(create, 1);
    expect(systemPrompt).toContain("DISCRIMINATOR OPTIONS");
    expect(systemPrompt).toContain("Sibling Alpha");
    expect(systemPrompt).toContain("Sibling Beta");
    expect(systemPrompt).toContain("Sibling Gamma");
    expect(systemPrompt).not.toContain("Sibling Delta");
    expect(systemPrompt).not.toContain("Sibling Epsilon");
  });

  it("coverage='with_children' injects CHILDREN OUTLINE but not DISCRIMINATOR OPTIONS", async () => {
    const mockProvider = createMockProvider();
    const create = mockProvider.client.chat.completions.create;
    resolveCards(create);
    vi.mocked(factory.getAIProviderForTask).mockReturnValue(mockProvider as never);

    await cardGenerationService.generateCards("Current Topic", "Content about current", {
      types: ["choice"],
      count: 3,
      coverage: "with_children",
      childrenNodes: [
        { knowledgePointId: "c-1", title: "SVM", content: "Support Vector Machine details" },
        { knowledgePointId: "c-2", title: "LR", content: "Logistic Regression details" },
      ],
    });

    expect(create).toHaveBeenCalledTimes(1);
    const systemPrompt = lastSystemPrompt(create);
    expect(systemPrompt).toContain("CHILDREN OUTLINE");
    expect(systemPrompt).toContain("子节点 1：SVM");
    expect(systemPrompt).toContain("子节点 2：LR");
    expect(systemPrompt).not.toContain("DISCRIMINATOR OPTIONS");
  });

  it("coverage='graph' injects both CHILDREN OUTLINE and DISCRIMINATOR OPTIONS without mixing", async () => {
    const mockProvider = createMockProvider();
    const create = mockProvider.client.chat.completions.create;
    resolveCards(create);
    vi.mocked(factory.getAIProviderForTask).mockReturnValue(mockProvider as never);

    await cardGenerationService.generateCards("Current Topic", "Content about current", {
      types: ["choice"],
      count: 3,
      coverage: "graph",
      maxSiblingDistractors: 3,
      childrenNodes: [
        { knowledgePointId: "c-1", title: "SVM", content: "SVM details" },
        { knowledgePointId: "c-2", title: "LR", content: "LR details" },
      ],
      siblingNodes: [
        { knowledgePointId: "s-1", title: "Decision Tree", content: "DT details" },
        { knowledgePointId: "s-2", title: "Random Forest", content: "RF details" },
        { knowledgePointId: "s-3", title: "KNN", content: "KNN details" },
      ],
    });

    expect(create).toHaveBeenCalledTimes(1);
    const systemPrompt = lastSystemPrompt(create);
    expect(systemPrompt).toContain("CHILDREN OUTLINE");
    expect(systemPrompt).toContain("子节点 1：SVM");
    expect(systemPrompt).toContain("子节点 2：LR");
    expect(systemPrompt).toContain("DISCRIMINATOR OPTIONS");
    expect(systemPrompt).toContain("Decision Tree");
    expect(systemPrompt).toContain("Random Forest");
    expect(systemPrompt).toContain("KNN");
    const childrenIndex = systemPrompt.indexOf("CHILDREN OUTLINE");
    const discriminatorIndex = systemPrompt.indexOf("DISCRIMINATOR OPTIONS");
    expect(childrenIndex).toBeGreaterThan(0);
    expect(discriminatorIndex).toBeGreaterThan(childrenIndex);
    const betweenSections = systemPrompt.slice(childrenIndex, discriminatorIndex);
    expect(betweenSections).not.toContain("Decision Tree");
    expect(betweenSections).not.toContain("Random Forest");
    expect(betweenSections).not.toContain("KNN");
  });

  it("coverage='current_only' skips both CHILDREN OUTLINE and DISCRIMINATOR OPTIONS even with arrays provided", async () => {
    const mockProvider = createMockProvider();
    const create = mockProvider.client.chat.completions.create;
    resolveCards(create);
    vi.mocked(factory.getAIProviderForTask).mockReturnValue(mockProvider as never);

    await cardGenerationService.generateCards("Current Topic", "Content about current", {
      types: ["choice"],
      count: 3,
      coverage: "current_only",
      childrenNodes: [
        { knowledgePointId: "c-1", title: "SVM", content: "SVM details" },
      ],
      siblingNodes: [
        { knowledgePointId: "s-1", title: "Decision Tree", content: "DT details" },
      ],
    });

    expect(create).toHaveBeenCalledTimes(1);
    const systemPrompt = lastSystemPrompt(create);
    expect(systemPrompt).not.toContain("CHILDREN OUTLINE");
    expect(systemPrompt).not.toContain("DISCRIMINATOR OPTIONS");
  });
});