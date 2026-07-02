import React, { Suspense, lazy, useEffect, useMemo } from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import { Layout } from "./components/Layout";
import { useStore } from "./store/useStore";
import { LoadingBar, ErrorBoundary, RouteErrorFallback } from "./components/common";
import { useMobileInit } from "./hooks/useMobileInit";
import { getSupabaseClient } from "./lib/supabase";
import { authConfig, isSupabaseConfigured } from "./config/authConfig";
import { toUser } from "@shared/types/database";
import { initializeFrontendPlugins } from "./services/kernel/plugins";
import type { RouteRegistration } from "./services/kernel/types";
import "./i18n";

const frontendKernel = initializeFrontendPlugins();
frontendKernel.activateAll().catch((err: unknown) => {
  console.error("[Kernel] Failed to activate frontend plugins:", err);
});

const LoadingFallback = () => (
  <div className="flex items-center justify-center min-h-screen bg-gray-50">
    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
  </div>
);

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
  const setUser = useStore((state) => state.setUser);
  const clearAuth = useStore((state) => state.clearAuth);
  const storeToken = useStore((state) => state.token);
  const storeRefreshToken = useStore((state) => state.refreshToken);

  const publicRoutes = useKernelRoutes("public");
  const protectedRoutes = useKernelRoutes("protected");

  useEffect(() => {
    if (!authConfig.isSupabase()) return;
    if (!isSupabaseConfigured()) return;

    const client = getSupabaseClient();
    if (!client) return;

    const restoreSession = async () => {
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
            const testPassword = "test123456";
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
    };

    restoreSession();

    const {
      data: { subscription },
    } = client.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        setUser(
          toUser(session.user),
          session.access_token,
          session.refresh_token,
        );
      } else {
        setUser(null, null, null);
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [setUser, clearAuth, storeToken, storeRefreshToken]);

  return (
    <ErrorBoundary>
      <LoadingBar />
      <Suspense fallback={<LoadingFallback />}>
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
                element={<LazyRoute registration={registration} />}
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
                  element={<LazyRoute registration={registration} />}
                />
              );
            })}
          </Route>
        </Routes>
      </Suspense>
    </ErrorBoundary>
  );
}

export default App;
export { frontendKernel };
