import { useStore } from "../../store/useStore";

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
    throw new Error(errorText || "Stream failed");
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
          if (parsed.error) throw new Error(parsed.error);
        } catch (e) {
          console.error("Stream parse error:", e);
        }
      }
    }
  }
};

export const handleUnauthorized = () => {
  useStore.getState().setUser(null, null);
};
