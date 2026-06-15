import { logger } from "../../utils/logger";

export function isEnglishLanguage(language?: string): boolean {
  if (!language) return false;
  return language === "en-US" || language === "en" || language.startsWith("en");
}

const pendingRequests = new Map<string, Promise<unknown>>();

export { pendingRequests };

async function dedupedRequest<T>(
  key: string,
  fn: () => Promise<T>,
): Promise<T> {
  const pending = pendingRequests.get(key) as Promise<T> | undefined;
  if (pending) {
    logger.debug(`Reusing pending request for key: ${key}`);
    return pending;
  }

  const promise = fn().finally(() => pendingRequests.delete(key));
  pendingRequests.set(key, promise);
  return promise;
}

export { dedupedRequest };

function generateRequestKey(
  operation: string,
  params: Record<string, unknown>,
): string {
  const sortedParams = Object.keys(params)
    .sort()
    .map((k) => `${k}=${JSON.stringify(params[k])}`)
    .join("&");
  return `${operation}:${sortedParams}`;
}

export { generateRequestKey };
