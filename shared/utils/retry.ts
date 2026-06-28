export const DEFAULT_TIMEOUT = 60000;
export const LONG_TIMEOUT = 180000; // 3分钟

export class TimeoutError extends Error {
  constructor(ms: number) {
    super(`AI request timeout after ${ms}ms`);
    this.name = "TimeoutError";
  }
}

export class RetryError extends Error {
  public readonly attempts: number;
  public readonly lastError: Error;

  constructor(attempts: number, lastError: Error) {
    super(`All ${attempts} retry attempts failed. Last error: ${lastError.message}`);
    this.name = "RetryError";
    this.attempts = attempts;
    this.lastError = lastError;
  }
}

export function isRetryableError(error: Error): boolean {
  const retryableMessages = [
    "timeout",
    "ECONNRESET",
    "ENOTFOUND",
    "ECONNREFUSED",
    "ETIMEDOUT",
    "rate limit",
    "429",
    "503",
    "502",
    "500",
    "network",
    "EAI_AGAIN",
  ];

  const message = error.message.toLowerCase();
  return retryableMessages.some((msg) => message.includes(msg.toLowerCase()));
}

export function withTimeout<T>(
  promise: Promise<T>,
  ms: number = DEFAULT_TIMEOUT
): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new TimeoutError(ms)), ms)
    ),
  ]);
}

export async function withRetry<T>(
  fn: () => Promise<T>,
  options: {
    maxRetries?: number;
    initialDelay?: number;
    maxDelay?: number;
    shouldRetry?: (error: Error) => boolean;
    onRetry?: (attempt: number, error: Error) => void;
  } = {}
): Promise<T> {
  const {
    maxRetries = 3,
    initialDelay = 1000,
    maxDelay = 10000,
    shouldRetry = isRetryableError,
    onRetry,
  } = options;

  let lastError: Error = new Error("Unknown error");

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as Error;

      if (attempt < maxRetries - 1 && shouldRetry(lastError)) {
        const delay = Math.min(initialDelay * Math.pow(2, attempt), maxDelay);

        if (onRetry) {
          onRetry(attempt + 1, lastError);
        }

        await new Promise((resolve) => setTimeout(resolve, delay));
      } else {
        break;
      }
    }
  }

  throw new RetryError(maxRetries, lastError);
}

export async function withTimeoutAndRetry<T>(
  fn: () => Promise<T>,
  options: {
    timeout?: number;
    maxRetries?: number;
    initialDelay?: number;
    maxDelay?: number;
    shouldRetry?: (error: Error) => boolean;
    onRetry?: (attempt: number, error: Error) => void;
  } = {}
): Promise<T> {
  const { timeout = DEFAULT_TIMEOUT, ...retryOptions } = options;

  return withRetry(
    () => withTimeout(fn(), timeout),
    retryOptions
  );
}
