import { useEffect, useState } from "react";

export function isCapacitorMobile(): boolean {
  try {
    const capacitor = (window as any).Capacitor;
    if (!capacitor) {
      return false;
    }

    if (capacitor.isNative !== undefined) {
      return !!capacitor.isNative;
    }
    if (capacitor.isNativePlatform !== undefined) {
      if (typeof capacitor.isNativePlatform === "function") {
        return !!capacitor.isNativePlatform();
      }
      return !!capacitor.isNativePlatform;
    }
    if (capacitor.getPlatform) {
      const platform = capacitor.getPlatform();
      return platform !== "web";
    }
    return true;
  } catch {
    return false;
  }
}

export function isElectronDesktop(): boolean {
  return !!(window as any).electronAPI || !!(window as any).electron;
}

export function isWebOnly(): boolean {
  return !isCapacitorMobile() && !isElectronDesktop();
}

export function useMobileApiConfig() {
  const [isMobile, setIsMobile] = useState(false);
  const [isDesktop, setIsDesktop] = useState(false);
  const [isWeb, setIsWeb] = useState(false);

  useEffect(() => {
    const mobile = isCapacitorMobile();
    const desktop = isElectronDesktop();
    const web = isWebOnly();
    setIsMobile(mobile);
    setIsDesktop(desktop);
    setIsWeb(web);
  }, []);

  return {
    isMobile,
    isDesktop,
    isWeb,
    useSupabaseDirectly: isMobile,
  };
}

export function getEnvironmentInfo() {
  return {
    isMobile: isCapacitorMobile(),
    isDesktop: isElectronDesktop(),
    isWeb: isWebOnly(),
    useSupabaseDirectly: isCapacitorMobile(),
  };
}

export function getMobileApiBaseUrl(): string {
  return "";
}
