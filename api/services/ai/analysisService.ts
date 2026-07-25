import { getAIProviderForTask, getAIProvider } from "./factory";
import type { AIProviderType } from "@shared/types";
import { promptService } from "./promptService";
import { getSupabaseAdmin } from "../../supabase";
import { logger } from "../../utils/logger";
import { parseAIResponse } from "./utils";
import { withAIMonitoring } from "./aiMonitor";
import {
  getMockConcepts,
  getMockImageGraph,
} from "./mock";
import {
  dedupedRequest,
  generateRequestKey,
} from "./aiUtils";
import {
  withTimeoutAndRetry,
  TimeoutError,
  RetryError,
  DEFAULT_TIMEOUT,
} from "../../../shared/utils/retry";
import { AppError } from "../../middleware/errorHandler";
import { ErrorCodes } from "../../../shared/types/errorCodes";

export class AnalysisService {
  async generateGraphFromImage(
    imageBase64: string,
    options: { provider?: AIProviderType; model?: string } = {},
  ) {
    let providerName = options.provider;

    if (!providerName) {
      const defaultTextProvider = await getAIProviderForTask("text");
      if (defaultTextProvider.providerType === "deepseek") {
        providerName = "aliyun";
      } else {
        providerName = defaultTextProvider.providerType;
      }
    }

    const provider = await getAIProvider(providerName as AIProviderType);

    if (!provider.hasKey) {
      return getMockImageGraph();
    }

    let model = options.model || provider.model;
    if (provider.providerType === "aliyun" && !model.includes("vl")) {
      model = "qwen-vl-max";
    }

    try {
      // Fetch the prompt from the database (DB is the single source of truth)
      const systemPrompt = await promptService.getRenderedPrompt(
        getSupabaseAdmin(),
        "image_to_graph",
        {},
      );

      if (!systemPrompt || systemPrompt.trim().length === 0) {
        throw new AppError(ErrorCodes.SYSTEM_CONFIGURATION_ERROR, {
          message: "image_to_graph prompt template not found in database",
        });
      }

      return withAIMonitoring(
        {
          operation: "generateGraphFromImage",
          provider: provider.providerType,
          model,
        },
        async () => {
          const completion = await provider.client.chat.completions.create({
            messages: [
              {
                role: "system",
                content: systemPrompt,
              },
              {
                role: "user",
                content: [
                  {
                    type: "text",
                    text: "Please analyze this image and generate the knowledge graph JSON.",
                  },
                  { type: "image_url", image_url: { url: imageBase64 } },
                ],
              },
            ],
            model,
            response_format: { type: "json_object" },
            max_tokens: 4000,
          });

          const content = completion.choices[0].message.content || "";
          const result = parseAIResponse<{
            nodes: unknown[];
            edges: unknown[];
          }>(content, "Image to Graph");

          return {
            result,
            usage: completion.usage,
          };
        },
      );
    } catch (error: unknown) {
      const err = error as Error;
      logger.error("Image-to-Graph Error:", error);
      throw new AppError(ErrorCodes.AI_PROVIDER_ERROR, {
        message: err.message || "Image processing failed",
      });
    }
  }

  async extractConcepts(
    text: string,
    existingNodes?: string[],
    options: {
      provider?: AIProviderType;
      model?: string;
      maxConcepts?: number;
    } = {},
  ) {
    const provider = options.provider
      ? await getAIProvider(options.provider)
      : await getAIProviderForTask("text");

    if (!provider.hasKey) {
      return { concepts: getMockConcepts() };
    }

    const requestKey = generateRequestKey("extractConcepts", {
      text: text.slice(0, 200),
      maxConcepts: options.maxConcepts ?? 20,
      model: options.model || provider.model,
    });

    try {
      return await dedupedRequest(requestKey, async () => {
        const model = options.model || provider.model;

        return withAIMonitoring(
          {
            operation: "extractConcepts",
            provider: provider.providerType,
            model,
            metadata: {
              text: text.slice(0, 100) + (text.length > 100 ? "..." : ""),
            },
          },
          async () => {
            const existingNodesContext =
              existingNodes && existingNodes.length > 0
                ? `\nExisting Nodes (DO NOT duplicate these): ${existingNodes
                    .slice(0, 50)
                    .join(", ")}`
                : "";

            const maxConcepts = options.maxConcepts || 5;

            const completion = await withTimeoutAndRetry(
              () =>
                provider.client.chat.completions.create({
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

Please respond in Chinese.`,
                    },
                    {
                      role: "user",
                      content: `Text to analyze:\n${text}${existingNodesContext}`,
                    },
                  ],
                  model,
                  response_format: { type: "json_object" },
                }),
              {
                timeout: DEFAULT_TIMEOUT,
                maxRetries: 3,
                onRetry: (attempt, error) => {
                  logger.warn(
                    `Extract Concepts retry attempt ${attempt}: ${error.message}`,
                  );
                },
              },
            );

            const content = completion.choices[0].message.content || "";
            const parsed = parseAIResponse<{ concepts: unknown[] }>(
              content,
              "Extract Concepts",
            );

            return {
              result: { concepts: parsed.concepts || [] },
              usage: completion.usage,
            };
          },
        );
      });
    } catch (error: unknown) {
      const err = error as Error;
      logger.error("AI Error:", error);

      if (err instanceof TimeoutError) {
        throw new AppError(ErrorCodes.AI_TIMEOUT);
      }
      if (err instanceof RetryError) {
        throw new AppError(ErrorCodes.AI_PROVIDER_ERROR, {
          message: `AI 请求失败，已重试 ${err.attempts} 次: ${err.lastError.message}`,
        });
      }
      throw new AppError(ErrorCodes.AI_PROVIDER_ERROR, {
        message: err.message || "AI concept extraction failed",
      });
    }
  }

  async analyzeCrossGraphConnections(
    graph1: {
      id: string;
      title?: string;
      nodes: Array<{ id: string; title: string; content?: string }>;
    },
    graph2: {
      id: string;
      title?: string;
      nodes: Array<{ id: string; title: string; content?: string }>;
    },
    options: {
      provider?: AIProviderType;
      model?: string;
      userId?: string;
      language?: string;
    } = {},
  ) {
    const provider = options.provider
      ? await getAIProvider(options.provider)
      : await getAIProviderForTask("text");

    if (!provider.hasKey) {
      return {
        connections: [],
        summary: {
          total_connections: 0,
          by_type: {
            same_concept: 0,
            related_concept: 0,
            complementary: 0,
            prerequisite: 0,
          },
          overall_relationship: "需要配置 AI API Key 才能分析连接",
        },
      };
    }

    try {
      const model = options.model || provider.model;

      return withAIMonitoring(
        {
          operation: "analyzeCrossGraphConnections",
          provider: provider.providerType,
          model,
          metadata: {
            graph1: graph1.title || "图谱 1",
            graph2: graph2.title || "图谱 2",
            userId: options.userId,
          },
        },
        async () => {
          const graph1NodesText = graph1.nodes
            .slice(0, 50)
            .map(
              (n) =>
                `- Title: ${n.title}${
                  n.content ? `, Content: ${n.content.slice(0, 200)}...` : ""
                }`,
            )
            .join("\n");

          const graph2NodesText = graph2.nodes
            .slice(0, 50)
            .map(
              (n) =>
                `- Title: ${n.title}${
                  n.content ? `, Content: ${n.content.slice(0, 200)}...` : ""
                }`,
            )
            .join("\n");

          const templateContext = {
            graph1Title: graph1.title || "图谱 1",
            graph2Title: graph2.title || "图谱 2",
            graph1Description: "",
            graph2Description: "",
            graph1Nodes: graph1NodesText,
            graph2Nodes: graph2NodesText,
          };

          const systemPrompt = await promptService.getRenderedPrompt(
            getSupabaseAdmin(),
            "cross_graph_connection_analysis",
            templateContext,
            options.userId,
            undefined,
            options.language,
          );

          const completion = await withTimeoutAndRetry(
            () =>
              provider.client.chat.completions.create({
                messages: [
                  { role: "system", content: systemPrompt },
                  {
                    role: "user",
                    content: `请分析这两个图谱之间的节点连接关系。`,
                  },
                ],
                model,
                response_format: { type: "json_object" },
              }),
            {
              timeout: DEFAULT_TIMEOUT,
              maxRetries: 3,
              onRetry: (attempt, error) => {
                logger.warn(
                  `Cross Graph Connections retry attempt ${attempt}: ${error.message}`,
                );
              },
            },
          );

          const content = completion.choices[0].message.content || "";
          const result = parseAIResponse<{
            connections: Array<{
              node1_title: string;
              node2_title: string;
              connection_type: string;
              similarity: number;
              reason: string;
            }>;
            summary: {
              total_connections: number;
              by_type: Record<string, number>;
              overall_relationship: string;
            };
          }>(content, "Cross Graph Connections");

          return {
            result,
            usage: completion.usage,
          };
        },
      );
    } catch (error: unknown) {
      const err = error as Error;
      logger.error("AI Cross Graph Connections Error:", error);

      if (err instanceof TimeoutError) {
        throw new AppError(ErrorCodes.AI_TIMEOUT);
      }
      if (err instanceof RetryError) {
        throw new AppError(ErrorCodes.AI_PROVIDER_ERROR, {
          message: `AI 请求失败，已重试 ${err.attempts} 次: ${err.lastError.message}`,
        });
      }
      throw new AppError(ErrorCodes.AI_PROVIDER_ERROR, {
        message: err.message || "AI 跨图谱连接分析失败",
      });
    }
  }
}

export const analysisService = new AnalysisService();
