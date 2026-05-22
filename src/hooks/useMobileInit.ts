import { useEffect, useState } from "react";
import { StatusBar } from "@capacitor/status-bar";
import { App } from "@capacitor/app";
import { Network } from "@capacitor/network";
import { SplashScreen } from "@capacitor/splash-screen";
import { useNavigate, useLocation } from "react-router-dom";

export function useMobileInit() {
  const [isMobile, setIsMobile] = useState(false);
  const [isOnline, setIsOnline] = useState(true);
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    const checkMobile = () => {
      const isCapacitor = !!(window as { Capacitor?: { isNativePlatform?: () => boolean } }).Capacitor?.isNativePlatform?.();
      setIsMobile(isCapacitor);
      return isCapacitor;
    };

    const native = checkMobile();
    if (!native) return;

    const initMobile = async () => {
      try {
        await SplashScreen.hide();

        await StatusBar.hide();
      } catch {
        console.warn("Failed to hide splash screen or status bar");
      }

      try {
        const status = await Network.getStatus();
        setIsOnline(status.connected);
      } catch {
        console.warn("Failed to get network status");
      }

      Network.addListener("networkStatusChange", (status) => {
        setIsOnline(status.connected);
      });
    };

    initMobile();

    const backButtonListener = App.addListener("backButton", () => {
      const publicRoutes = ["/login", "/register"];
      const isPublicRoute = publicRoutes.includes(location.pathname);
      const isGraphRoute = location.pathname.startsWith("/graph/");

      if (isPublicRoute || isGraphRoute) {
        App.exitApp();
        return;
      }

      if (location.pathname === "/") {
        App.exitApp();
      } else {
        navigate(-1);
      }
    });

    return () => {
      backButtonListener.then((listener) => listener.remove());
      Network.removeAllListeners();
    };
  }, [location.pathname, navigate]);

  return { isMobile, isOnline };
}

export function useSafeAreaInsets() {
  const [insets, setInsets] = useState({
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
  });

  useEffect(() => {
    const updateInsets = () => {
      const computedStyle = getComputedStyle(document.documentElement);
      const top = parseInt(
        computedStyle.getPropertyValue("--safe-area-inset-top") || "0",
        10,
      );
      const bottom = parseInt(
        computedStyle.getPropertyValue("--safe-area-inset-bottom") || "0",
        10,
      );
      const left = parseInt(
        computedStyle.getPropertyValue("--safe-area-inset-left") || "0",
        10,
      );
      const right = parseInt(
        computedStyle.getPropertyValue("--safe-area-inset-right") || "0",
        10,
      );

      setInsets({ top, bottom, left, right });
    };

    updateInsets();

    window.addEventListener("resize", updateInsets);
    return () => window.removeEventListener("resize", updateInsets);
  }, []);

  return insets;
}
