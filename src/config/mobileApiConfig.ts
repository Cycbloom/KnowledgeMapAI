import { useEffect, useState } from "react";

export function isCapacitorMobile(): boolean {
  try {
    const capacitor = (window as any).Capacitor;
    if (!capacitor) {
      console.log('[mobileApiConfig] window.Capacitor not found');
      return false;
    }
    console.log('[mobileApiConfig] Capacitor object found:', {
      isNative: capacitor.isNative,
      isNativePlatform: capacitor.isNativePlatform,
      platform: capacitor.getPlatform?.()
    });
    
    if (capacitor.isNative !== undefined) {
      const result = !!capacitor.isNative;
      console.log('[mobileApiConfig] Using capacitor.isNative:', result);
      return result;
    }
    if (capacitor.isNativePlatform !== undefined) {
      if (typeof capacitor.isNativePlatform === 'function') {
        const result = !!capacitor.isNativePlatform();
        console.log('[mobileApiConfig] Using capacitor.isNativePlatform() function:', result);
        return result;
      }
      const result = !!capacitor.isNativePlatform;
      console.log('[mobileApiConfig] Using capacitor.isNativePlatform property:', result);
      return result;
    }
    if (capacitor.getPlatform) {
      const platform = capacitor.getPlatform();
      const result = platform !== 'web';
      console.log('[mobileApiConfig] Using capacitor.getPlatform():', platform, 'result:', result);
      return result;
    }
    console.log('[mobileApiConfig] Falling back to true because Capacitor exists');
    return true;
  } catch (e) {
    console.error('[mobileApiConfig] Error checking isCapacitorMobile:', e);
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
