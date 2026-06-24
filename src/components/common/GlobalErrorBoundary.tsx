import { Component, ErrorInfo, ReactNode, useState, useCallback } from "react";
import { cn } from "@/lib/utils";
import {
  RefreshCcw,
  AlertTriangle,
  Home,
  Bug,
  Copy,
  Check,
  Send,
} from "lucide-react";
import {
  AppError,
  isAppError,
  wrapUnknownError,
  ErrorCode,
  SharedErrorCodes,
} from "../../utils/errors";
import { captureException } from "../../utils/errorReporter";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
  resetKeys?: unknown[];
  showReportButton?: boolean;
}

interface State {
  hasError: boolean;
  error: Error | AppError | null;
  errorInfo: ErrorInfo | null;
  errorReported: boolean;
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      console.error("Failed to copy");
    }
  };

  return (
    <button
      onClick={handleCopy}
      className="absolute top-2 right-2 p-1.5 rounded-md bg-gray-200 hover:bg-gray-300 dark:bg-slate-600 dark:hover:bg-slate-500 transition-colors"
      title="复制错误信息"
    >
      {copied ? (
        <Check className="w-4 h-4 text-green-600 dark:text-green-400" />
      ) : (
        <Copy className="w-4 h-4 text-gray-600 dark:text-gray-300" />
      )}
    </button>
  );
}

function getErrorTypeDisplay(code?: ErrorCode): {
  label: string;
  color: string;
} {
  switch (code) {
    case "NETWORK_ERROR":
      return { label: "网络错误", color: "text-orange-500" };
    case SharedErrorCodes.AUTH_UNAUTHORIZED:
    case SharedErrorCodes.AUTH_TOKEN_EXPIRED:
    case SharedErrorCodes.AUTH_TOKEN_INVALID:
    case SharedErrorCodes.AUTH_TOKEN_REVOKED:
      return { label: "认证错误", color: "text-yellow-500" };
    case SharedErrorCodes.VALIDATION_ERROR:
      return { label: "验证错误", color: "text-primary-500" };
    case SharedErrorCodes.SYSTEM_INTERNAL_ERROR:
      return { label: "服务器错误", color: "text-red-500" };
    default:
      return { label: "应用错误", color: "text-red-500" };
  }
}

export class GlobalErrorBoundary extends Component<Props, State> {
  override state: State = {
    hasError: false,
    error: null,
    errorInfo: null,
    errorReported: false,
  };

  public static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error };
  }

  override componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    this.setState({ errorInfo });

    const appError = wrapUnknownError(error);
    captureException(
      error instanceof Error ? error : new Error(appError.message),
      {
        componentStack: errorInfo.componentStack,
        errorBoundary: "GlobalErrorBoundary",
      },
    );

    if (this.props.onError) {
      this.props.onError(error, errorInfo);
    }
  }

  override componentDidUpdate(prevProps: Props) {
    const { resetKeys } = this.props;
    const { hasError } = this.state;

    if (hasError && prevProps.resetKeys !== resetKeys) {
      if (resetKeys && resetKeys.length > 0) {
        const hasKeyChanged = resetKeys.some(
          (key, index) => key !== prevProps.resetKeys?.[index],
        );
        if (hasKeyChanged) {
          this.reset();
        }
      }
    }
  }

  reset = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
      errorReported: false,
    });
  };

  handleRetry = () => {
    this.reset();
  };

  handleReload = () => {
    window.location.reload();
  };

  handleGoHome = () => {
    window.location.href = "/";
  };

  handleReportError = () => {
    this.setState({ errorReported: true });
  };

  override render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      const appError = isAppError(this.state.error)
        ? this.state.error
        : wrapUnknownError(this.state.error);
      const errorType = getErrorTypeDisplay(appError.code);
      const errorDetails = [
        `[${errorType.label}] ${appError.message}`,
        `错误码: ${appError.code}`,
        `状态码: ${appError.statusCode}`,
        this.state.error?.stack?.split("\n").slice(0, 3).join("\n") || "",
      ]
        .filter(Boolean)
        .join("\n");

      return (
        <div className="flex flex-col items-center justify-center min-h-screen bg-gray-50 dark:bg-slate-900 p-4">
          <div className="bg-white dark:bg-slate-800 p-8 rounded-xl shadow-lg max-w-lg w-full text-center border border-gray-100 dark:border-slate-700">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-red-100 dark:bg-red-900/30 mb-6">
              <AlertTriangle className="h-8 w-8 text-red-600 dark:text-red-400" />
            </div>

            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
              {errorType.label}
            </h2>
            <p className={cn("text-sm font-medium mb-2", errorType.color)}>
              {appError.code}
            </p>
            <p className="text-gray-500 dark:text-gray-400 mb-6">
              {appError.message}
            </p>

            <div className="relative bg-gray-50 dark:bg-slate-700 p-4 rounded-lg text-left text-xs font-mono mb-8 overflow-auto max-h-48 border border-gray-200 dark:border-slate-600 text-gray-700 dark:text-gray-300">
              <CopyButton text={errorDetails} />
              <pre className="whitespace-pre-wrap break-all">
                {errorDetails}
              </pre>
              {this.state.errorInfo?.componentStack && (
                <details className="mt-2">
                  <summary className="cursor-pointer text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200">
                    组件堆栈
                  </summary>
                  <pre className="mt-2 text-xs overflow-auto whitespace-pre-wrap">
                    {this.state.errorInfo.componentStack}
                  </pre>
                </details>
              )}
            </div>

            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <button
                onClick={this.handleRetry}
                className="inline-flex items-center justify-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 transition-colors"
              >
                <RefreshCcw className="w-4 h-4 mr-2" />
                重试
              </button>

              <button
                onClick={this.handleReload}
                className="inline-flex items-center justify-center px-4 py-2 border border-gray-300 dark:border-slate-600 shadow-sm text-sm font-medium rounded-md text-gray-700 dark:text-gray-200 bg-white dark:bg-slate-700 hover:bg-gray-50 dark:hover:bg-slate-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 transition-colors"
              >
                <Bug className="w-4 h-4 mr-2" />
                刷新页面
              </button>

              <button
                onClick={this.handleGoHome}
                className="inline-flex items-center justify-center px-4 py-2 border border-gray-300 dark:border-slate-600 shadow-sm text-sm font-medium rounded-md text-gray-700 dark:text-gray-200 bg-white dark:bg-slate-700 hover:bg-gray-50 dark:hover:bg-slate-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 transition-colors"
              >
                <Home className="w-4 h-4 mr-2" />
                返回首页
              </button>

              {this.props.showReportButton !== false && (
                <button
                  onClick={this.handleReportError}
                  disabled={this.state.errorReported}
                  className="inline-flex items-center justify-center px-4 py-2 border border-gray-300 dark:border-slate-600 shadow-sm text-sm font-medium rounded-md text-gray-700 dark:text-gray-200 bg-white dark:bg-slate-700 hover:bg-gray-50 dark:hover:bg-slate-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Send className="w-4 h-4 mr-2" />
                  {this.state.errorReported ? "已上报" : "上报错误"}
                </button>
              )}
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export function withGlobalErrorBoundary<P extends object>(
  WrappedComponent: React.ComponentType<P>,
  errorBoundaryProps?: Omit<Props, "children">,
) {
  return function WithGlobalErrorBoundaryWrapper(props: P) {
    return (
      <GlobalErrorBoundary {...errorBoundaryProps}>
        <WrappedComponent {...props} />
      </GlobalErrorBoundary>
    );
  };
}

export function useErrorBoundary() {
  const [error, setError] = useState<Error | null>(null);

  const showBoundary = useCallback((err: Error | AppError) => {
    if (err instanceof Error) {
      setError(err);
    } else {
      const appErr = err as AppError;
      setError(new Error(appErr.message));
    }
  }, []);

  if (error) {
    throw error;
  }

  return { showBoundary };
}
