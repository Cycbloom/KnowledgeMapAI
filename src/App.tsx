import React, { Suspense, lazy, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { Routes, Route, Navigate, useLocation } from "react-router-dom";
import { Layout } from "./components/Layout";
import { useStore } from "./store/useStore";
import { LoadingBar } from "./components/common/LoadingBar";
import { ErrorBoundary } from "./components/common/ErrorBoundary";
import { RouteErrorFallback } from "./components/common/RouteErrorFallback";
import { ScrollToTop } from "./components/common/ScrollToTop";
import { LazyLoadFallback } from "./components/common/LazyLoadFallback";
import { PageLoadingProvider, usePageLoading } from "./hooks/common/usePageLoading";
import { GlobalErrorBoundary } from "./components/common/GlobalErrorBoundary";
import { RenderProfiler } from "./components/dev/RenderProfiler";
import { QueryErrorResetBoundary, useQueryClient } from "@tanstack/react-query";
import { useDeepLink } from "./hooks/common/useDeepLink";
import { useMobileInit } from "./hooks/mobile/useMobileInit";
import { useNetworkStatus } from "./hooks/common/useNetworkStatus";
import { useUiFont } from "./hooks/common/useUiFont";
import { useDocumentTitle } from "./hooks/common/useDocumentTitle";
import { useTranslation } from "react-i18next";
import { message } from "@/utils/messageHelper";
import { getSupabaseClient } from "./utils/supabase";
import { restoreSession as silentRestoreSession } from "./utils/silentAuth";
import { authConfig, isSupabaseConfigured } from "./config/authConfig";
import { isElectron } from "./config/electronConfig";
import { toUser } from "@shared/types/database";
import { initializeFrontendPlugins } from "./services/kernel/plugins";
import type { RouteRegistration } from "./services/kernel/types";
import "./i18n";

// P7: 主入口常驻壳层瘦身（第二轮）——仅在 Web 端渲染、且触发时才显示的壳层组件改为
// React.lazy 条件挂载。这些组件在 Electron 端永不渲染，懒加载后其代码不再进入主入口，
// 减小首屏 index chunk 体积与解析开销。渲染条件与行为不变，Suspense fallback={null} 避免布局抖动。
const LazyOfflineBanner = React.lazy(() =>
  import("@/components/OfflineBanner").then((m) => ({ default: m.OfflineBanner })),
);
const LazySyncStatusBadge = React.lazy(() =>
  import("@/components/SyncStatusBadge").then((m) => ({ default: m.SyncStatusBadge })),
);
const LazyConflictResolutionDialog = React.lazy(() =>
  import("@/components/ConflictResolutionDialog").then((m) => ({ default: m.ConflictResolutionDialog })),
);
const LazyUpdatePrompt = React.lazy(() =>
  import("@/components/UpdatePrompt").then((m) => ({ default: m.UpdatePrompt })),
);
const LazyOfflineSyncProgress = React.lazy(() =>
  import("./components/common/OfflineSyncProgress").then((m) => ({ default: m.OfflineSyncProgress })),
);
const LazyCelebrationOverlay = React.lazy(() =>
  import("./components/common/CelebrationOverlay").then((m) => ({ default: m.CelebrationOverlay })),
);

const frontendKernel = initializeFrontendPlugins();
frontendKernel.activateAll().catch((err: unknown) => {
  console.error("[Kernel] Failed to activate frontend plugins:", err);
});

const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { token } = useStore();
  if (!isSupabaseConfigured()) return <Navigate to="/login" replace />;
  if (!token) return <Navigate to="/login" replace />;
  return <>{children}</>;
};

// Cache lazy components by path to avoid recreating them on every render
const lazyComponentCache = new Map<string, React.LazyExoticComponent<React.ComponentType>>();

function getLazyComponent(registration: RouteRegistration): React.LazyExoticComponent<React.ComponentType> | null {
  if (registration.redirect) return null;
  const cached = lazyComponentCache.get(registration.path);
  if (cached) return cached;
  const Component = lazy(registration.component);
  lazyComponentCache.set(registration.path, Component);
  return Component;
}

/* eslint-disable react-hooks/static-components */
function LazyRoute({ registration }: { registration: RouteRegistration }) {
  const { t } = useTranslation();
  const title = registration.title ? (t(registration.title as never) as string) : undefined;
  useDocumentTitle(title, t('documentTitle.suffix'));
  const Component = getLazyComponent(registration);
  if (!Component) return null;
  return (
    <ErrorBoundary
      fallbackRender={(error, resetErrorBoundary) => (
        <RouteErrorFallback error={error} resetErrorBoundary={resetErrorBoundary} />
      )}
    >
      <Component />
    </ErrorBoundary>
  );
}
/* eslint-enable react-hooks/static-components */

// Wrap the 4 core route elements with RenderProfiler (dev-only, zero overhead in prod).
function withProfiler(path: string, element: React.ReactNode): React.ReactNode {
  switch (path) {
    case "/":
      return <RenderProfiler id="Dashboard">{element}</RenderProfiler>;
    case "/graph/:id":
      return <RenderProfiler id="GraphEditor">{element}</RenderProfiler>;
    case "/scheduler":
      return <RenderProfiler id="Scheduler">{element}</RenderProfiler>;
    case "/study":
      return <RenderProfiler id="Study">{element}</RenderProfiler>;
    default:
      return element;
  }
}

function useKernelRoutes(layoutType: "public" | "protected") {
  return useMemo(() => {
    const allRoutes = frontendKernel.getRoutes();
    return allRoutes.filter((registration) => {
      const layout = registration.layout ?? "protected";
      return layout === layoutType;
    });
  }, [layoutType]);
}

function App() {
  useMobileInit();
  useDeepLink();
  useUiFont();
  const { t } = useTranslation();
  const queryClient = useQueryClient();

  // 记录上一次在线状态，仅"离线→在线"的真实切换触发"已恢复在线"提示与数据刷新，
  // 避免应用启动时或已在线状态下误触发。
  const prevOnlineRef = useRef<boolean>(true);

  const handleOnline = useCallback(() => {
    if (prevOnlineRef.current) {
      // 上一状态即在网，非由离线恢复，忽略
      return;
    }
    message.success(t("toast.common.backOnline"));
    void queryClient.refetchQueries({ type: "active" });
  }, [queryClient, t]);

  const { online } = useNetworkStatus({
    enableSlowDetection: true,
    onOnline: handleOnline,
  });

  const location = useLocation();
  const { startLoading } = usePageLoading();
  const prevPathnameRef = useRef(location.pathname);

  // 检测路由切换，同步触发页面加载进度条
  useLayoutEffect(() => {
    if (location.pathname !== prevPathnameRef.current) {
      prevPathnameRef.current = location.pathname;
      startLoading();
    }
  }, [location.pathname, startLoading]);

  useEffect(() => {
    prevOnlineRef.current = online;
    if (!online) {
      message.error(t('toast.network.offline'), { id: 'network-status', duration: Infinity });
    } else {
      message.dismiss('network-status');
    }
  }, [online, t]);

  const setUser = useStore((state) => state.setUser);
  const clearAuth = useStore((state) => state.clearAuth);
  const storeToken = useStore((state) => state.token);
  const storeRefreshToken = useStore((state) => state.refreshToken);

  // Supabase 模式下，应用启动时阻塞渲染直到 restoreSession() 完成，
  // 避免子组件在 token 恢复前发出 API 请求导致 401 竞态。
  const [isRestoringSession, setIsRestoringSession] = useState(
    authConfig.isSupabase() && isSupabaseConfigured(),
  );

  const publicRoutes = useKernelRoutes("public");
  const protectedRoutes = useKernelRoutes("protected");
  const publicMainRef = useRef<HTMLElement>(null);
  const isPublicRoute = publicRoutes.some((r) => r.path === location.pathname);

  // 公共路由切换时聚焦到 main 元素，使键盘用户跳过 skip link 后从主内容开始 Tab
  useEffect(() => {
    if (isPublicRoute) {
      publicMainRef.current?.focus();
    }
  }, [location.pathname, isPublicRoute]);

  useEffect(() => {
    if (!authConfig.isSupabase()) return;
    if (!isSupabaseConfigured()) return;

    const client = getSupabaseClient();
    if (!client) return;

    const restoreSession = async () => {
      try {
        // 统一自愈链路：校验本地 session（用户被删时清僵尸会话）→
        // 本地凭证静默重登（失效时清死凭证）→ 兜底创建新专属用户。
        // 数据库重置后应用可无感恢复，不会卡死在旧凭证上。
        const session = await silentRestoreSession(client);

        if (session?.user) {
          setUser(
            toUser(session.user),
            session.access_token,
            session.refresh_token,
          );
        } else if (storeToken || storeRefreshToken) {
          clearAuth();
        }
      } finally {
        // 无论 getSession 成功或失败，都解除渲染阻塞。
        // 这是解除 isRestoringSession 的唯一路径——onAuthStateChange 不再
        // 负责解除阻塞，因为 INITIAL_SESSION 事件可能在 getSession() 完成
        // 前触发，此时 session 可能为 null 或 token 已过期。
        setIsRestoringSession(false);
      }
    };

    restoreSession();

    const {
      data: { subscription },
    } = client.auth.onAuthStateChange((event, session) => {
      // 注意：此处不调用 setIsRestoringSession(false)。
      // INITIAL_SESSION 事件在 getSession() 完成前触发，此时 session 可能为
      // null 或 token 已过期，过早解除阻塞会导致子组件在 token 写入 Zustand
      // 前发出 API 请求（401 竞态）。解除阻塞的唯一路径是 restoreSession()
      // 的 finally 块。
      if (session?.user) {
        setUser(
          toUser(session.user),
          session.access_token,
          session.refresh_token,
        );
      } else if (event === "SIGNED_OUT") {
        // 仅在显式登出时清除 token。
        // INITIAL_SESSION 事件在 getSession() 完成前可能触发，此时 session
        // 为 null 但 token 可能仍有效（从 localStorage 恢复）。如果在此处
        // 清除 token，会导致页面加载时短暂的 401 竞态条件。
        setUser(null, null, null);
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [setUser, clearAuth, storeToken, storeRefreshToken]);

  // 会话恢复期间渲染 Loading 占位，不渲染受保护路由树，避免子组件
  // 在 token 写入 Zustand 前发出 API 请求（E2E 401 竞态根因）。
  if (isRestoringSession) {
    return <LazyLoadFallback />;
  }

  const routesElement = (
    <Routes>
      {/* Public routes (outside Layout) */}
      {publicRoutes.map((registration) => {
        if (registration.redirect) {
          return (
            <Route
              key={registration.path}
              path={registration.path}
              element={<Navigate to={registration.redirect} replace />}
            />
          );
        }
        return (
          <Route
            key={registration.path}
            path={registration.path}
            element={withProfiler(
              registration.path,
              <LazyRoute registration={registration} />,
            )}
          />
        );
      })}

      {/* Protected routes (inside Layout) */}
      <Route
        element={
          <ProtectedRoute>
            <Layout />
          </ProtectedRoute>
        }
      >
        {protectedRoutes.map((registration) => {
          const isIndex = registration.options?.index === true;
          if (registration.redirect) {
            return (
              <Route
                key={registration.path}
                path={registration.path.replace(/^\//, "")}
                element={<Navigate to={registration.redirect} replace />}
              />
            );
          }
          return (
            <Route
              key={registration.path}
              {...(isIndex ? { index: true } : { path: registration.path.replace(/^\//, "") })}
              element={withProfiler(
                registration.path,
                <LazyRoute registration={registration} />,
              )}
            />
          );
        })}
      </Route>
    </Routes>
  );

  return (
    <PageLoadingProvider>
      <QueryErrorResetBoundary>
        {({ reset }) => (
          <GlobalErrorBoundary onReset={reset}>
            <LoadingBar />
            <ScrollToTop />
            {/* Web 端 PWA 组件：Electron 不依赖 SW/IndexedDB，不渲染 */}
            {!isElectron && (
              <>
                <LazyOfflineBanner />
                <LazySyncStatusBadge />
                <LazyOfflineSyncProgress />
                <LazyConflictResolutionDialog />
                <LazyUpdatePrompt />
              </>
            )}
            <Suspense fallback={<LazyLoadFallback />}>
              {/*
                Skip link 只在 Web 渲染：Electron 使用 HashRouter，裸 href="#xxx" 会被解析
                成新的 hash 路由，破坏 #/login 等公共路由并导致页面置空。
              */}
              {isPublicRoute && !isElectron && (
                <button
                  type="button"
                  onClick={() => {
                    publicMainRef.current?.focus();
                    publicMainRef.current?.scrollIntoView({ block: "start" });
                  }}
                  className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-skip-link focus:px-4 focus:py-2 focus:bg-primary-600 focus:text-white focus:rounded cursor-pointer"
                >
                  {t('common.skipToContent')}
                </button>
              )}
              {isPublicRoute ? (
                <main
                  id="public-main"
                  tabIndex={-1}
                  ref={publicMainRef}
                  className="outline-none"
                >
                  {routesElement}
                </main>
              ) : (
                routesElement
              )}
            </Suspense>
            <LazyCelebrationOverlay />
          </GlobalErrorBoundary>
        )}
      </QueryErrorResetBoundary>
    </PageLoadingProvider>
  );
}

export default App;
export { frontendKernel };
