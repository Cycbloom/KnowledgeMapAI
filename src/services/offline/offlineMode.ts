import { api } from "@/services/api";
import { useStore } from "@/store/useStore";
import { isCapacitorMobile } from "@/config/mobileApiConfig";
import { createLogger } from "@/utils/logger";
import { ensureOfflineDb, getLocalIdentity } from "./offlineDb";
import { ensureOfflineContent } from "./offlineImport";
import { offlineApi } from "./offlineApi";

const logger = createLogger("OfflineMode");

/** 离线模式伪会话 token：不对外请求，仅满足前端登录守卫 */
export const OFFLINE_SESSION_TOKEN = "offline-session";

let offlineActive = false;

/** 是否处于离线数据模式（仅 Capacitor 移动端 + 内置数据包存在时激活） */
export function isOfflineActive(): boolean {
  return offlineActive;
}

function applyApiOverrides(): void {
  Object.assign(api.study, offlineApi.study);
  Object.assign(api.quiz, offlineApi.quiz);
  Object.assign(api.dashboard, offlineApi.dashboard);
  Object.assign(api.statistics, offlineApi.statistics);
  Object.assign(api.health, offlineApi.health);
  Object.assign(api.ai, offlineApi.ai);
  Object.assign(api.focus, offlineApi.focus);
  Object.assign(api.nodes, offlineApi.nodes);
  Object.assign(api.graphs, offlineApi.graphs);
}

/**
 * 初始化离线模式（在应用渲染前调用一次）：
 * 1. 仅移动端生效；VITE_OFFLINE_MODE=false 可强制关闭；
 * 2. 读取内置数据包并导入 IndexedDB（首次/版本升级）；
 * 3. 将学习主线 API 覆盖为离线实现；
 * 4. 写入本地伪身份（供登录守卫通过，不访问网络）。
 * 返回是否激活离线模式。
 */
export async function initOfflineMode(): Promise<boolean> {
  if (offlineActive) return true;

  if (!isCapacitorMobile()) return false;
  if (import.meta.env.VITE_OFFLINE_MODE === "false") return false;

  try {
    await ensureOfflineDb();
    const bundle = await ensureOfflineContent();
    if (!bundle) {
      logger.warn("Offline bundle not found, running in online mode");
      return false;
    }

    applyApiOverrides();
    offlineActive = true;
    await applyOfflineAuth();
    logger.warn("Offline mode activated", {
      version: bundle.version,
      exportedAt: bundle.exportedAt,
    });
    return true;
  } catch (error) {
    logger.error("Failed to initialize offline mode, falling back to online", {
      message: error instanceof Error ? error.message : String(error),
    });
    return false;
  }
}

/** 写入本地伪身份，使 ProtectedRoute 等登录守卫放行 */
export async function applyOfflineAuth(): Promise<void> {
  const identity = await getLocalIdentity();
  if (!identity) return;

  useStore.getState().setUser(
    {
      id: identity.ownerId,
      email: identity.email,
      name: identity.name ?? undefined,
      user_metadata: {
        name: identity.name ?? undefined,
      },
    },
    OFFLINE_SESSION_TOKEN,
    null,
  );
}
