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
  } catch {
    console.warn("[ErrorReporter] Failed to flush errors");
  }
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

  // 仅在生产环境 override console.error；dev 环境保持原生行为
  // 避免拦截 errors.ts/useError.ts 主动输出的 console.error 造成噪音
  if (import.meta.env.PROD) {
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
  }
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
