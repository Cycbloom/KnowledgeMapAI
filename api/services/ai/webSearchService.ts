import { appSettingsService } from "../core/appSettingsService";
import { logger } from "../../utils/logger";
import { AppError } from "../../middleware/errorHandler";
import { ErrorCodes } from "../../../shared/types/errorCodes";

const DEFAULT_BASE_URL = "https://api.tavily.com/search";
const DEFAULT_MAX_RESULTS = 5;
const REQUEST_TIMEOUT_MS = 30000;

const WEB_SEARCH_CONFIG_KEY = "web_search_config";
// 建议首选 Tavily：免费额度对单用户工具足够，返回干净正文，无需解析 HTML/JSON
const envApiKey = process.env.TAVILY_API_KEY ?? "";

interface WebSearchConfig {
  apiKey: string;
  baseUrl: string;
  maxResults: number;
}

interface TavilyResponse {
  answer?: string;
  query?: string;
  results?: Array<{
    title: string;
    url: string;
    content: string;
    score?: number;
  }>;
}

let cachedConfig: WebSearchConfig | undefined;

/**
 * 读取联网搜索配置：优先数据库 app_settings.web_search_config，回退环境变量 TAVILY_API_KEY。
 * 调用方更新配置后需调用 clearWebSearchConfigCache 以清除缓存。
 */
export const getWebSearchConfig = async (): Promise<WebSearchConfig> => {
  if (cachedConfig) return cachedConfig;

  let apiKey = envApiKey;
  let baseUrl = process.env.TAVILY_BASE_URL ?? DEFAULT_BASE_URL;
  let maxResults = DEFAULT_MAX_RESULTS;

  try {
    const dbConfig = await appSettingsService.getSetting<{
      apiKey?: string;
      baseUrl?: string;
      maxResults?: number;
    }>(WEB_SEARCH_CONFIG_KEY);
    if (dbConfig?.apiKey) apiKey = dbConfig.apiKey;
    if (dbConfig?.baseUrl) baseUrl = dbConfig.baseUrl;
    if (dbConfig?.maxResults) maxResults = dbConfig.maxResults;
  } catch (error) {
    logger.warn(
      "[WebSearch] Failed to read app_settings, fallback to env.",
      error,
    );
  }

  cachedConfig = { apiKey, baseUrl, maxResults };
  return cachedConfig;
};

export const clearWebSearchConfigCache = (): void => {
  cachedConfig = undefined;
};

/** 是否已配置联网搜索 Key（决定是否向模型注入 web_search 工具） */
export const hasWebSearchKey = async (): Promise<boolean> => {
  const config = await getWebSearchConfig();
  return !!config.apiKey;
};

/**
 * 调用 Tavily 执行一次联网搜索，返回可直接喂给 LLM 的清洗文本。
 * 多条结果用 [来源 N] 分块，并附源 URL 供模型引用。
 */
export const webSearch = async (
  query: string,
  options: { maxResults?: number } = {},
): Promise<string> => {
  const config = await getWebSearchConfig();
  if (!config.apiKey) {
    throw new AppError(ErrorCodes.AI_PROVIDER_ERROR, {
      message: "未配置 Tavily 搜索 API Key，无法联网搜索",
    });
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(config.baseUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        api_key: config.apiKey,
        query,
        search_depth: "advanced",
        max_results: options.maxResults ?? config.maxResults,
        include_answer: false,
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      const body = await response.text().catch(() => "");
      throw new AppError(ErrorCodes.AI_PROVIDER_ERROR, {
        message: `Tavily 搜索失败 (${response.status}): ${body.slice(0, 200)}`,
      });
    }

    const data = (await response.json().catch(() => ({}))) as TavilyResponse;

    if (!data.results?.length) {
      return `未找到关于"${query}"的联网搜索结果。`;
    }

    return data.results
      .map((result, index) => {
        const source = `[来源 ${index + 1}] ${result.title}\n${result.url}\n${result.content}`;
        return source;
      })
      .join("\n\n");
  } catch (error) {
    controller.abort();
    if (error instanceof AppError) throw error;
    logger.error("[WebSearch] Request failed:", error);
    throw new AppError(ErrorCodes.AI_PROVIDER_ERROR, {
      message: "联网搜索请求失败，请稍后重试",
    });
  } finally {
    clearTimeout(timeout);
  }
};