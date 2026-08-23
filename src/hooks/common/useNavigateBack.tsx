import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { getDetailParentPath } from "../../utils/navigation";

interface NavigationContextValue {
  goBack: (fallbackPath?: string) => void;
}

const NavigationContext = createContext<NavigationContextValue | null>(null);

export function NavigationProvider({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const navigate = useNavigate();
  const stackRef = useRef<string[]>([]);

  useEffect(() => {
    const key = location.pathname;
    const stack = stackRef.current;
    if (stack[stack.length - 1] === key) return;
    const idx = stack.indexOf(key);
    if (idx >= 0) {
      stack.length = idx + 1;
    } else {
      stack.push(key);
    }
  }, [location]);

  const goBack = useCallback(
    (fallbackPath?: string) => {
      const stack = stackRef.current;
      const key = location.pathname;
      if (stack[stack.length - 1] === key) {
        stack.pop();
      }
      const prev = stack[stack.length - 1];
      const target = prev ?? fallbackPath ?? getDetailParentPath(location.pathname) ?? "/";
      navigate(target, { replace: true });
    },
    [location, navigate],
  );

  const value = useMemo<NavigationContextValue>(() => ({ goBack }), [goBack]);

  return <NavigationContext.Provider value={value}>{children}</NavigationContext.Provider>;
}

export function useNavigateBack(): NavigationContextValue {
  const ctx = useContext(NavigationContext);
  if (!ctx) {
    throw new Error("useNavigateBack must be used within a NavigationProvider");
  }
  return ctx;
}
