import React, { Suspense, lazy, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { Routes, Route, Navigate, useLocation } from "react-router-dom";
import { Layout } from "./components/Layout";
import { useStore } from "./store/useStore";
import { LoadingBar, ErrorBoundary, RouteErrorFallback, ScrollToTop, LazyLoadFallback, CelebrationOverlay } from "./components/common";
import { PageLoadingProvider, usePageLoading } from "./hooks/common/usePageLoading";
import { GlobalErrorBoundary } from "./components/common/GlobalErrorBoundary";
import { RenderProfiler } from "./components/dev/RenderProfiler";
import { QueryErrorResetBoundary } from "@tanstack/react-query";
import { useDeepLink } from "./hooks/common/useDeepLink";
import { useMobileInit } from "./hooks/mobile/useMobileInit";
import { useNetworkStatus } from "./hooks/common/useNetworkStatus";
import { useDocumentTitle } from "./hooks/common/useDocumentTitle";
import { useTranslation } from "react-i18next";
import { message } from "@/utils/messageHelper";
import { getSupabaseClient } from "./utils/supabase";
import { authConfig, isSupabaseConfigured } from "./config/authConfig";
import { isElectron } from "./config/electronConfig";
import { toUser } from "@shared/types/database";
import { initializeFrontendPlugins } from "./services/kernel/plugins";
import type { RouteRegistration } from "./services/kernel/types";
import { OfflineBanner } from "@/components/OfflineBanner";
import { SyncStatusBadge } from "@/components/SyncStatusBadge";
import { ConflictResolutionDialog } from "@/components/ConflictResolutionDialog";
import { UpdatePrompt } from "@/components/UpdatePrompt";
import "./i18n";

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
  const { t } = useTranslation();
  const { online } = useNetworkStatus();
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
    if (!online) {
      message.error(t('toast.network.offline'), { id: 'network-status', duration: Infinity });
    } else {
      message.success(t('toast.network.restored'), { id: 'network-status', duration: 2000 });
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
        const {
          data: { session },
        } = await client.auth.getSession();

        if (session?.user) {
          setUser(
            toUser(session.user),
            session.access_token,
            session.refresh_token,
          );
        } else {
          const isDev =
            authConfig.supabase.url.includes("127.0.0.1") ||
            authConfig.supabase.url.includes("localhost");
          if (isDev) {
            try {
              const testEmail = "test@example.com";
              const testPassword = import.meta.env.VITE_DEV_TEST_PASSWORD ?? "";
              const { data } = await client.auth.signInWithPassword({
                email: testEmail,
                password: testPassword,
              });
              if (data.session?.user) {
                setUser(
                  toUser(data.session.user),
                  data.session.access_token,
                  data.session.refresh_token,
                );
              }
            } catch {
              try {
                const { data } = await client.auth.signInAnonymously();
                if (data.session?.user) {
                  setUser(
                    toUser(data.session.user),
                    data.session.access_token,
                    data.session.refresh_token,
                  );
                }
              } catch {
                // auto auth failed
              }
            }
          } else if (storeToken || storeRefreshToken) {
            clearAuth();
          }
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
                <OfflineBanner />
                <SyncStatusBadge />
                <ConflictResolutionDialog />
                <UpdatePrompt />
              </>
            )}
            <Suspense fallback={<LazyLoadFallback />}>
              {isPublicRoute && (
                <a
                  href="#public-main"
                  className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-skip-link focus:px-4 focus:py-2 focus:bg-primary-600 focus:text-white focus:rounded"
                >
                  {t('common.skipToContent')}
                </a>
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
            <CelebrationOverlay />
          </GlobalErrorBoundary>
        )}
      </QueryErrorResetBoundary>
    </PageLoadingProvider>
  );
}

export default App;
export { frontendKernel };
