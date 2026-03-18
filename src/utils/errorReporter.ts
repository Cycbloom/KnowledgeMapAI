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
  metadata?: Record<string, unknown>;
}

const errorQueue: ErrorReport[] = [];
const MAX_QUEUE_SIZE = 10;
const FLUSH_INTERVAL = 5000;

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

setInterval(flushErrors, FLUSH_INTERVAL);

const getUserId = (): string | undefined => {
  try {
    const userStr = localStorage.getItem("user");
    if (userStr) {
      const user = JSON.parse(userStr);
      return user.id;
    }
  } catch {
    return undefined;
  }
  return undefined;
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
      metadata: {
        type: "unhandledrejection",
      },
    });
  };

  const originalConsoleError = console.error;
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
        metadata: { type: "console.error" },
      });
    }

    originalConsoleError.apply(console, args);
  };
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
    metadata,
  });
};

export const setUserContext = (userId: string, email?: string): void => {
  try {
    localStorage.setItem("errorContext", JSON.stringify({ userId, email }));
  } catch {
    // Ignore storage errors
  }
};

export const clearUserContext = (): void => {
  try {
    localStorage.removeItem("errorContext");
  } catch {
    // Ignore storage errors
  }
};

export const getErrorQueue = (): ErrorReport[] => {
  return [...errorQueue];
};

export const flushErrorsNow = async (): Promise<void> => {
  await flushErrors();
};
