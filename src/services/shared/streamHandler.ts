import { useStore } from "../../store/useStore";
import { logger } from "@/utils/logger";
import { AppError, SharedErrorCodes } from "@/utils/errors";
import { isCapacitorMobile } from "@/config/mobileApiConfig";

interface StreamHandlerOptions {
  baseUrl?: string;
  token?: string | null;
  csrfToken?: string | null;
  onUnauthorized?: () => void;
}

export const createStreamHandler = async (
  url: string,
  payload: unknown,
  onChunk: (content: string) => void,
  options?: StreamHandlerOptions,
) => {
  const { baseUrl = "", token, csrfToken, onUnauthorized } = options || {};
  const fullUrl = baseUrl ? `${baseUrl}${url}` : url;

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
  });

  if (!response.ok) {
    if (response.status === 401 && onUnauthorized) {
      onUnauthorized();
    }
    const errorText = await response.text();
    throw new AppError(errorText || "Stream failed", SharedErrorCodes.AI_PROVIDER_ERROR, 502);
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
        try {
          const parsed = JSON.parse(dataStr);
          if (parsed.content) onChunk(parsed.content);
          if (parsed.error) throw new AppError(parsed.error, SharedErrorCodes.AI_INVALID_RESPONSE, 502);
        } catch (e) {
          logger.error("Stream parse error:", e);
        }
      }
    }
  }
};

export const handleUnauthorized = () => {
  useStore.getState().setUser(null, null);
};
