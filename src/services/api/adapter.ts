import { isCapacitorMobile, shouldUseSupabaseDirect } from "@/config/mobileApiConfig";
import { api as webApi } from "./index";
import { mobileApi } from "../mobile";
import type { IApi } from "./contracts/IApi";

let resolvedApi: IApi | null = null;
let lastIsMobile: boolean | null = null;
let lastUseSupabaseDirect: boolean | null = null;

function getResolvedApi(): IApi {
  const isMobile = isCapacitorMobile();
  const useSupabaseDirect = shouldUseSupabaseDirect();

  if (resolvedApi === null || lastIsMobile !== isMobile || lastUseSupabaseDirect !== useSupabaseDirect) {
    lastIsMobile = isMobile;
    lastUseSupabaseDirect = useSupabaseDirect;

    if (isMobile && useSupabaseDirect) {
      // Mobile: use mobileApi for Supabase-direct modules, fall back to webApi for others
      resolvedApi = {
        ...webApi,
        ...mobileApi,
      };
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
