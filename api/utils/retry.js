export const DEFAULT_TIMEOUT = 30000;
export class TimeoutError extends Error {
    constructor(ms) {
        super(`AI request timeout after ${ms}ms`);
        this.name = "TimeoutError";
    }
}
export class RetryError extends Error {
    attempts;
    lastError;
    constructor(attempts, lastError) {
        super(`All ${attempts} retry attempts failed. Last error: ${lastError.message}`);
        this.name = "RetryError";
        this.attempts = attempts;
        this.lastError = lastError;
    }
}
export function isRetryableError(error) {
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
export function withTimeout(promise, ms = DEFAULT_TIMEOUT) {
    return Promise.race([
        promise,
        new Promise((_, reject) => setTimeout(() => reject(new TimeoutError(ms)), ms)),
    ]);
}
export async function withRetry(fn, options = {}) {
    const { maxRetries = 3, initialDelay = 1000, maxDelay = 10000, shouldRetry = isRetryableError, onRetry, } = options;
    let lastError = new Error("Unknown error");
    for (let attempt = 0; attempt < maxRetries; attempt++) {
        try {
            return await fn();
        }
        catch (error) {
            lastError = error;
            if (attempt < maxRetries - 1 && shouldRetry(lastError)) {
                const delay = Math.min(initialDelay * Math.pow(2, attempt), maxDelay);
                if (onRetry) {
                    onRetry(attempt + 1, lastError);
                }
                await new Promise((resolve) => setTimeout(resolve, delay));
            }
            else {
                break;
            }
        }
    }
    throw new RetryError(maxRetries, lastError);
}
export async function withTimeoutAndRetry(fn, options = {}) {
    const { timeout = DEFAULT_TIMEOUT, ...retryOptions } = options;
    return withRetry(() => withTimeout(fn(), timeout), retryOptions);
}
//# sourceMappingURL=retry.js.map