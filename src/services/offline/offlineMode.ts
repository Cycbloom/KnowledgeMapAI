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

/** 是否处于离线数据模式（离线构建包 VITE_OFFLINE_MODE=true 时无条件激活） */
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
 * 1. 离线构建包（VITE_OFFLINE_MODE=true）无条件激活；普通包仅 Capacitor 移动端 + 内置数据包时激活；
 *    VITE_OFFLINE_MODE=false 可强制关闭；
 * 2. 读取内置数据包并导入 IndexedDB（首次/版本升级；失败不中断，下次重试）；
 * 3. 将学习主线 API 覆盖为离线实现；
 * 4. 写入本地伪身份（供登录守卫通过，不访问网络）。
 * 返回是否激活离线模式。
 */
export async function initOfflineMode(): Promise<boolean> {
  if (offlineActive) return true;

  const envMode = import.meta.env.VITE_OFFLINE_MODE;
  const isForcedOffline = envMode === "true";

  if (envMode === "false") return false;
  if (!isForcedOffline && !isCapacitorMobile()) return false;

  let bundle: Awaited<ReturnType<typeof ensureOfflineContent>> = null;
  try {
    await ensureOfflineDb();
    bundle = await ensureOfflineContent();
  } catch (error) {
    logger.error("Offline mode setup failed", {
      message: error instanceof Error ? error.message : String(error),
    });
  }

  if (!bundle) {
    // 强制离线：即使数据包异常也进入离线模式（绝不联网），内容为空 + 下次启动重试导入
    if (isForcedOffline) {
      logger.warn("Forced offline mode but bundle unavailable, activating with local data only");
      applyApiOverrides();
      offlineActive = true;
      await applyOfflineAuth();
      return true;
    }
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
}

/** 写入本地伪身份，使 ProtectedRoute 等登录守卫放行；无已存身份时使用占位身份 */
export async function applyOfflineAuth(): Promise<void> {
  const identity = await getLocalIdentity();
  const ownerId = identity?.ownerId ?? "offline-owner";
  const email = identity?.email ?? "offline@local";

  useStore.getState().setUser(
    {
      id: ownerId,
      email,
      name: identity?.name ?? undefined,
      user_metadata: {
        name: identity?.name ?? undefined,
      },
    },
    OFFLINE_SESSION_TOKEN,
    null,
  );
}
