import { isAxiosError } from "axios";
import { request } from "../services/api/client";

interface ErrorReport {
  message: string;
  stack?: string;
  componentStack?: string;
  url: string;
  lineNumber?: number;
  columnNumber?: number;
  timestamp: string;
  userAgent: string;
  userId?: string;
  email?: string;
  metadata?: Record<string, unknown>;
}

const errorQueue: ErrorReport[] = [];
const MAX_QUEUE_SIZE = 10;
const FLUSH_INTERVAL = 5000;

let flushIntervalId: ReturnType<typeof setInterval> | null = null;
let originalConsoleError: typeof console.error | null = null;
let currentUserId: string | undefined;
let currentEmail: string | undefined;

const flushErrors = async (): Promise<void> => {
  if (errorQueue.length === 0) return;

  const errors = [...errorQueue];
  errorQueue.length = 0;

  try {
    await request("/analytics/errors", {
      method: "POST",
      body: JSON.stringify({ errors }),
    });
  } catch (error) {
    console.warn("[ErrorReporter] Failed to flush errors", error);
    // 瞬时失败（网络错误 / 5xx）：重新入队，避免错误静默丢失；仍受队列上限约束
    if (isTransientFlushError(error)) {
      errorQueue.unshift(...errors);
      errorQueue.splice(MAX_QUEUE_SIZE);
    }
    // 4xx 校验类失败：丢弃，避免无限重试
  }
};

/**
 * 判断上报失败是否属于瞬时类（可重试）：axios 网络错误（无响应）或 5xx 服务端错误。
 * 4xx（如 400 校验失败）非瞬时，重试只会重复失败，应丢弃。
 */
const isTransientFlushError = (error: unknown): boolean => {
  if (!isAxiosError(error)) return false;
  if (!error.response) return true; // 网络层失败（无 HTTP 响应）
  return error.response.status >= 500;
};

const getUserId = (): string | undefined => {
  return currentUserId;
};

const reportError = (error: ErrorReport): void => {
  if (errorQueue.length >= MAX_QUEUE_SIZE) {
    errorQueue.shift();
  }
  errorQueue.push(error);

  if (errorQueue.length >= 3) {
    flushErrors();
  }
};

export const initErrorReporter = (): void => {
  if (import.meta.env.DEV) {
    // 开发环境：轻量错误捕获，仅 console 输出，不入队不上报
    window.onerror = (message, source, lineno, colno, error) => {
      console.error("[ErrorReporter]", {
        message,
        source,
        lineno,
        colno,
        error,
      });

      return false;
    };

    window.onunhandledrejection = (event) => {
      console.error(
        "[ErrorReporter] Unhandled Promise Rejection:",
        event.reason,
      );
    };

    return;
  }

  // 生产环境：入队 + 定时上报
  if (flushIntervalId === null) {
    flushIntervalId = setInterval(flushErrors, FLUSH_INTERVAL);
  }

  window.onerror = (message, source, lineno, colno, error) => {
    reportError({
      message: String(message),
      stack: error?.stack,
      url: source || window.location.href,
      lineNumber: lineno,
      columnNumber: colno,
      timestamp: new Date().toISOString(),
      userAgent: navigator.userAgent,
      userId: getUserId(),
      email: currentEmail,
    });

    return false;
  };

  window.onunhandledrejection = (event) => {
    const error = event.reason;

    reportError({
      message: error?.message || "Unhandled Promise Rejection",
      stack: error?.stack,
      url: window.location.href,
      timestamp: new Date().toISOString(),
      userAgent: navigator.userAgent,
      userId: getUserId(),
      email: currentEmail,
      metadata: {
        type: "unhandledrejection",
      },
    });
  };

  if (originalConsoleError !== null) return;

  originalConsoleError = console.error;
  const savedOriginal = originalConsoleError;
  console.error = (...args) => {
    const message = args
      .map((arg) =>
        typeof arg === "object" ? JSON.stringify(arg) : String(arg),
      )
      .join(" ");

    if (!message.includes("[ErrorReporter]") && !message.includes("Warning:")) {
      reportError({
        message,
        url: window.location.href,
        timestamp: new Date().toISOString(),
        userAgent: navigator.userAgent,
        userId: getUserId(),
        email: currentEmail,
        metadata: { type: "console.error" },
      });
    }

    savedOriginal.apply(console, args);
  };
};

export const destroyErrorReporter = (): void => {
  if (flushIntervalId !== null) {
    clearInterval(flushIntervalId);
    flushIntervalId = null;
  }
  if (originalConsoleError !== null) {
    console.error = originalConsoleError;
    originalConsoleError = null;
  }
};

export const captureException = (
  error: Error,
  metadata?: Record<string, unknown>,
): void => {
  reportError({
    message: error.message,
    stack: error.stack,
    url: window.location.href,
    timestamp: new Date().toISOString(),
    userAgent: navigator.userAgent,
    userId: getUserId(),
    email: currentEmail,
    metadata,
  });
};

export const captureMessage = (
  message: string,
  metadata?: Record<string, unknown>,
): void => {
  reportError({
    message,
    url: window.location.href,
    timestamp: new Date().toISOString(),
    userAgent: navigator.userAgent,
    userId: getUserId(),
    email: currentEmail,
    metadata,
  });
};

export const setUserContext = (userId: string, email?: string): void => {
  currentUserId = userId;
  currentEmail = email;
};

export const clearUserContext = (): void => {
  currentUserId = undefined;
  currentEmail = undefined;
};

export const getErrorQueue = (): ErrorReport[] => {
  return [...errorQueue];
};

export const flushErrorsNow = async (): Promise<void> => {
  await flushErrors();
};
