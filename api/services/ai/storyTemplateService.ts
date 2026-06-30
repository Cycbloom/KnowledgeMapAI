import type { TemplateType, LayoutSuggestion } from "@shared/types/graph";
import { getAIProviderForTask } from "./factory";
import { logger } from "../../utils/logger";
import {
  withTimeoutAndRetry,
  LONG_TIMEOUT,
} from "../../../shared/utils/retry";

export class StoryTemplateService {
  async generateStoryCreationStructure(
    topic: string,
    storyConfig?: {
      genre?: string;
      coreConflict?: string;
      characterHints?: string;
    },
    userId?: string,
    graphId?: string,
    buildSystemPrompt?: (
      category?: undefined,
      templateType?: TemplateType,
      preferredLayout?: undefined,
      userId?: string,
      graphId?: string,
    ) => Promise<string>,
  ): Promise<{
    root: { title: string; content: string; summary?: string };
    coreNodes: Array<{ title: string; content?: string; summary?: string }>;
  }> {
    const genreText = storyConfig?.genre ? `题材: ${storyConfig.genre}` : "";
    const conflictText = storyConfig?.coreConflict
      ? `核心冲突: ${storyConfig.coreConflict}`
      : "";
    const characterText = storyConfig?.characterHints
      ? `角色提示: ${storyConfig.characterHints}`
      : "";

    const userPrompt = `请为以下故事创建结构骨架：

故事标题: ${topic}
${genreText}
${conflictText}
${characterText}

请生成三幕式故事结构，包含：
1. Story根节点（故事整体）
2. 3个Act节点（第一幕：铺垫、第二幕：对抗、第三幕：解决）
3. 每个Act下2-3个Sequence节点（关键情节节拍）
${characterText ? "4. 根据角色提示，在coreNodes末尾包含主要角色节点（每个角色一个节点，summary标注为'角色'）" : ""}

请以JSON格式返回，格式如下：
{
  "root": { "title": "故事标题", "content": "故事整体概述", "summary": "简短摘要" },
  "coreNodes": [
    { "title": "第一幕：铺垫", "content": "第一幕的描述", "summary": "铺垫阶段" },
    ...
  ]
}

注意：coreNodes中的节点按层级排列，Act节点在前，Sequence节点在后。`;

    try {
      const provider = await getAIProviderForTask("text");

      if (!provider.hasKey) {
        logger.info(
          "[Template Generator] No API key configured, using story creation fallback",
        );
        return this.generateStoryCreationFallback(topic, storyConfig);
      }

      const systemPrompt = buildSystemPrompt
        ? await buildSystemPrompt(undefined, "story_creation" as TemplateType, undefined, userId, graphId)
        : `你是一个故事创作专家。请根据用户的要求创建三幕式故事结构。用中文回复。`;

      const model = provider.model;
      const client = provider.client as {
        chat: {
          completions: {
            create: (params: {
              messages: Array<{ role: string; content: string }>;
              model: string;
              response_format?: { type: string };
              max_tokens?: number;
            }) => Promise<{
              choices: Array<{ message: { content: string | null } }>;
            }>;
          };
        };
      };

      const completion = await withTimeoutAndRetry(
        () =>
          client.chat.completions.create({
            messages: [
              { role: "system", content: systemPrompt },
              { role: "user", content: userPrompt },
            ],
            model,
            response_format: { type: "json_object" },
            max_tokens: 4000,
          }),
        {
          timeout: LONG_TIMEOUT,
          maxRetries: 3,
          onRetry: (attempt, error) => {
            logger.warn(
              `[Template Generator] Story creation retry attempt ${attempt}: ${error.message}`,
            );
          },
        },
      );

      const content = completion.choices[0].message.content;

      if (!content) {
        logger.warn(
          "[Template Generator] Empty AI response for story creation, using fallback",
        );
        return this.generateStoryCreationFallback(topic, storyConfig);
      }

      const parsed = this.parseStoryCreationResponse(content);
      return parsed;
    } catch (error) {
      logger.warn(
        "[Template Generator] Story creation AI error, using fallback:",
        error,
      );
      return this.generateStoryCreationFallback(topic, storyConfig);
    }
  }

  parseStoryCreationResponse(aiResult: string): {
    root: { title: string; content: string; summary?: string };
    coreNodes: Array<{ title: string; content?: string; summary?: string }>;
  } {
    try {
      const jsonMatch = aiResult.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        if (parsed.root && parsed.coreNodes) {
          return parsed;
        }
      }
    } catch {
      // Fall through to default
    }

    return {
      root: { title: "故事", content: "故事结构", summary: "故事结构骨架" },
      coreNodes: [
        {
          title: "第一幕：铺垫",
          content: "介绍平凡世界和角色",
          summary: "铺垫",
        },
        { title: "第二幕：对抗", content: "试炼与挑战", summary: "对抗" },
        {
          title: "第三幕：解决",
          content: "最终对决与新的平衡",
          summary: "解决",
        },
      ],
    };
  }

  generateStoryCreationFallback(
    topic: string,
    storyConfig?: {
      genre?: string;
      coreConflict?: string;
      characterHints?: string;
    },
  ): {
    root: { title: string; content: string; summary?: string };
    coreNodes: Array<{ title: string; content?: string; summary?: string }>;
  } {
    const genreDesc = storyConfig?.genre ? `（${storyConfig.genre}题材）` : "";
    const conflictDesc = storyConfig?.coreConflict
      ? ` 核心冲突：${storyConfig.coreConflict}`
      : "";

    return {
      root: {
        title: topic,
        content: `${topic}${genreDesc}的故事结构。${conflictDesc}`,
        summary: `${topic} - 故事结构骨架`,
      },
      coreNodes: [
        {
          title: "第一幕：铺垫",
          content: "介绍平凡世界、角色现状和核心问题",
          summary: "铺垫阶段（0-25%）",
        },
        {
          title: "冒险召唤",
          content: "打破日常的事件发生",
          summary: "第一幕序列",
        },
        {
          title: "跨越门槛",
          content: "主角决定踏上旅程",
          summary: "第一幕序列",
        },
        {
          title: "第二幕：对抗",
          content: "试炼、盟友、敌人，逐渐接近目标",
          summary: "对抗阶段（25-75%）",
        },
        {
          title: "上升动作",
          content: "一系列挑战和考验",
          summary: "第二幕序列",
        },
        {
          title: "中点转折",
          content: "重大转折点，信息揭露或方向改变",
          summary: "第二幕序列",
        },
        {
          title: "危机时刻",
          content: "看似失败的低谷时刻",
          summary: "第二幕序列",
        },
        {
          title: "第三幕：解决",
          content: "最终对决、变革和新的平衡",
          summary: "解决阶段（75-100%）",
        },
        { title: "高潮", content: "最大的冲突和转折", summary: "第三幕序列" },
        { title: "尾声", content: "收尾和新常态", summary: "第三幕序列" },
      ],
    };
  }

  getStoryCreationMockTemplate(
    topic: string,
  ): {
    id: string;
    name: string;
    description: string;
    nodes: Array<{
      id: string;
      title: string;
      description: string;
      level: string;
      parentId: string | undefined;
      suggestedContent: string;
      needsRefinement?: boolean;
    }>;
    edges: Array<{
      source: string;
      target: string;
      relationship_type: string;
      description?: string;
    }>;
    layoutSuggestion: LayoutSuggestion;
    estimatedNodes: number;
    difficulty: string;
    tags: string[];
    reasoning: string;
  } {
    return {
      id: "story-creation-backbone",
      name: `${topic} - 故事创作骨架`,
      description:
        "采用三幕式故事结构，包含铺垫、对抗、解决三大幕及关键情节节拍",
      nodes: [
        {
          id: "root",
          title: topic,
          description: `${topic}的故事结构`,
          level: "root",
          parentId: undefined,
          suggestedContent: `${topic}的故事整体概述`,
          needsRefinement: false,
        },
        {
          id: "act-1",
          title: "第一幕：铺垫",
          description: "介绍平凡世界、角色现状和核心问题",
          level: "core",
          parentId: "root",
          suggestedContent: "铺垫阶段（0-25%）",
          needsRefinement: true,
        },
        {
          id: "seq-1-1",
          title: "冒险召唤",
          description: "打破日常的事件发生",
          level: "sub",
          parentId: "act-1",
          suggestedContent: "第一幕序列",
        },
        {
          id: "seq-1-2",
          title: "跨越门槛",
          description: "主角决定踏上旅程",
          level: "sub",
          parentId: "act-1",
          suggestedContent: "第一幕序列",
        },
        {
          id: "act-2",
          title: "第二幕：对抗",
          description: "试炼、盟友、敌人，逐渐接近目标",
          level: "core",
          parentId: "root",
          suggestedContent: "对抗阶段（25-75%）",
          needsRefinement: true,
        },
        {
          id: "seq-2-1",
          title: "上升动作",
          description: "一系列挑战和考验",
          level: "sub",
          parentId: "act-2",
          suggestedContent: "第二幕序列",
        },
        {
          id: "seq-2-2",
          title: "中点转折",
          description: "重大转折点，信息揭露或方向改变",
          level: "sub",
          parentId: "act-2",
          suggestedContent: "第二幕序列",
        },
        {
          id: "seq-2-3",
          title: "危机时刻",
          description: "看似失败的低谷时刻",
          level: "sub",
          parentId: "act-2",
          suggestedContent: "第二幕序列",
        },
        {
          id: "act-3",
          title: "第三幕：解决",
          description: "最终对决、变革和新的平衡",
          level: "core",
          parentId: "root",
          suggestedContent: "解决阶段（75-100%）",
          needsRefinement: true,
        },
        {
          id: "seq-3-1",
          title: "高潮",
          description: "最大的冲突和转折",
          level: "sub",
          parentId: "act-3",
          suggestedContent: "第三幕序列",
        },
        {
          id: "seq-3-2",
          title: "尾声",
          description: "收尾和新常态",
          level: "sub",
          parentId: "act-3",
          suggestedContent: "第三幕序列",
        },
      ],
      edges: [
        { source: "root", target: "act-1", relationship_type: "contains" },
        { source: "root", target: "act-2", relationship_type: "contains" },
        { source: "root", target: "act-3", relationship_type: "contains" },
        { source: "act-1", target: "seq-1-1", relationship_type: "contains" },
        { source: "act-1", target: "seq-1-2", relationship_type: "contains" },
        { source: "act-2", target: "seq-2-1", relationship_type: "contains" },
        { source: "act-2", target: "seq-2-2", relationship_type: "contains" },
        { source: "act-2", target: "seq-2-3", relationship_type: "contains" },
        { source: "act-3", target: "seq-3-1", relationship_type: "contains" },
        { source: "act-3", target: "seq-3-2", relationship_type: "contains" },
        { source: "act-1", target: "act-2", relationship_type: "prerequisite" },
        { source: "act-2", target: "act-3", relationship_type: "prerequisite" },
      ],
      layoutSuggestion: "hierarchical",
      estimatedNodes: 11,
      difficulty: "medium",
      tags: ["故事创作", "三幕式", "叙事结构", topic],
      reasoning: "采用经典三幕式故事结构，帮助系统化组织故事情节和角色发展",
    };
  }
}

export const storyTemplateService = new StoryTemplateService();
