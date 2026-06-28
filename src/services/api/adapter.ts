import { isCapacitorMobile, shouldUseSupabaseDirect } from "@/config/mobileApiConfig";
import { api as webApi } from "./index";
import type { IApi } from "./contracts/IApi";

let resolvedApi: IApi | null = null;
let lastIsMobile: boolean | null = null;
let lastUseSupabaseDirect: boolean | null = null;
let mobileApiLoaded: IApi | null = null;

export async function preloadMobileApi(): Promise<void> {
  if (mobileApiLoaded !== null) return;
  if (isCapacitorMobile() && shouldUseSupabaseDirect()) {
    const m = await import("../mobile");
    mobileApiLoaded = m.mobileApi;
  }
}

function getResolvedApi(): IApi {
  const isMobile = isCapacitorMobile();
  const useSupabaseDirect = shouldUseSupabaseDirect();

  if (resolvedApi === null || lastIsMobile !== isMobile || lastUseSupabaseDirect !== useSupabaseDirect) {
    lastIsMobile = isMobile;
    lastUseSupabaseDirect = useSupabaseDirect;

    if (isMobile && useSupabaseDirect) {
      if (mobileApiLoaded !== null) {
        // Mobile: use mobileApi for Supabase-direct modules, fall back to webApi for others
        resolvedApi = {
          ...webApi,
          ...mobileApiLoaded,
        };
      } else {
        // 防御性处理：未 preload 时 fallback 到 webApi
        resolvedApi = webApi;
      }
    } else {
      resolvedApi = webApi;
    }
  }

  return resolvedApi;
}

export const getApi = getResolvedApi;

export const api = new Proxy({} as IApi, {
  get(_target, prop) {
    const currentApi = getResolvedApi();
    return currentApi[prop as keyof IApi];
  },
}) as IApi;
