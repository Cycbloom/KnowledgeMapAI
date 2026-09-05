import { useStore } from "../../store/useStore";
import { logger } from "@/utils/logger";
import { AppError, SharedErrorCodes } from "@/utils/errors";
import { isCapacitorMobile } from "@/config/mobileApiConfig";
import { getApiUrl, getCsrfToken } from "../api/client";

interface StreamHandlerOptions {
  /** 覆盖默认鉴权头（默认自动取全局登录态 token） */
  token?: string | null;
  /** 覆盖 CSRF 头（默认自动取内存中的 csrf token） */
  csrfToken?: string | null;
  /** 401 时的处理（默认清除登录态回到登录页） */
  onUnauthorized?: () => void;
  /** 中止流式请求 */
  signal?: AbortSignal;
  /** 除 content 外的扩展事件字段回调（如 RAG 的 sources） */
  onEvent?: (event: Record<string, unknown>) => void;
}

export const handleUnauthorized = () => {
  useStore.getState().setUser(null, null);
};

/**
 * 全局唯一的 SSE 流式 POST 出口。约定：
 * - `url` 是 /api/v1 之后的路径（如 "/ai/chat"），完整地址统一经 getApiUrl() 解析
 *   （Web=相对 /api/v1，移动端 APK=VITE_API_BASE_URL，Electron=本地端口）——
 *   调用方不得自行拼接 baseUrl；
 * - 鉴权 / CSRF / 移动端标识头统一在此补齐，与 createApiClient 的拦截器语义一致；
 * - 服务端事件遵循 `{ content }` / `{ error }` 约定，`[DONE]` 结束，扩展字段走 onEvent。
 */
export const createStreamHandler = async (
  url: string,
  payload: unknown,
  onChunk: (content: string) => void,
  options?: StreamHandlerOptions,
) => {
  const {
    token = useStore.getState().token,
    csrfToken = getCsrfToken(),
    onUnauthorized = handleUnauthorized,
    signal,
    onEvent,
  } = options || {};

  const fullUrl = `${await getApiUrl()}${url}`;

  const response = await fetch(fullUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      // 与 createApiClient 的拦截器一致：移动端请求带此头，后端 CSRF 中间件据此豁免
      // （手机跨源场景下 SameSite cookie 无法随请求送达，仅靠 csrf 头过不了校验）。
      ...(isCapacitorMobile() ? { "x-mobile-client": "true" } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(csrfToken ? { "x-csrf-token": csrfToken } : {}),
    },
    credentials: "include",
    body: JSON.stringify(payload),
    ...(signal ? { signal } : {}),
  });

  if (!response.ok) {
    if (response.status === 401 && onUnauthorized) {
      onUnauthorized();
    }
    const errorText = await response.text();
    throw new AppError(errorText || "Stream request failed", SharedErrorCodes.AI_PROVIDER_ERROR, 502);
  }

  const reader = response.body?.getReader();
  const decoder = new TextDecoder();
  if (!reader) return;

  let buffer = "";
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n\n");
    buffer = lines.pop() || "";

    for (const line of lines) {
      if (line.startsWith("data: ")) {
        const dataStr = line.replace("data: ", "");
        if (dataStr === "[DONE]") return;
        let parsed: Record<string, unknown>;
        try {
          parsed = JSON.parse(dataStr);
        } catch (e) {
          if (signal?.aborted) {
            throw e;
          }
          logger.error("Stream parse error:", e);
          continue;
        }
        if (parsed.content) onChunk(parsed.content as string);
        if (onEvent) onEvent(parsed);
        if (parsed.error) {
          // 服务端错误必须向外抛（此前被 parse 的 catch 吞掉的缺陷在此修正）
          throw new AppError(
            String(parsed.error),
            SharedErrorCodes.AI_INVALID_RESPONSE,
            502,
          );
        }
      }
    }
  }
};
