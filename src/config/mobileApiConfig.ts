import { useEffect, useState } from "react";

export const MOBILE_API_BASE_URL = "http://192.168.0.6:3001";

export function useMobileApiConfig() {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const isCapacitor = !!(window as any).Capacitor?.isNativePlatform?.();
    setIsMobile(isCapacitor);
  }, []);

  return { isMobile, apiBaseUrl: MOBILE_API_BASE_URL };
}

export function getMobileApiBaseUrl(): string {
  const isCapacitor = !!(window as any).Capacitor?.isNativePlatform?.();
  if (isCapacitor) {
    return MOBILE_API_BASE_URL;
  }
  return "";
}
