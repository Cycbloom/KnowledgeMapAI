import { useStore } from "@/store/useStore";
import { getMobileApiBaseUrl } from "@/config/mobileApiConfig";
import { getSupabaseClient } from "@/utils/supabase";
import { silentSignIn } from "@/utils/silentAuth";
import { toUser } from "@shared/types/database";
import { createLogger } from "@/utils/logger";
import { getAll, deleteRecord, type OfflineOpLogEntry } from "./offlineDb";
import { OFFLINE_SESSION_TOKEN } from "./offlineMode";

const logger = createLogger("OfflineSync");

export interface OfflineSyncResult {
  synced: number;
  failed: number;
  skipped: number;
  /** 需要真实登录后才能同步（无有效 token） */
  authRequired: boolean;
}

const EMPTY_RESULT: OfflineSyncResult = {
  synced: 0,
  failed: 0,
  skipped: 0,
  authRequired: false,
};

/** 待回传操作数（op_log 中 synced=false 的记录） */
export async function countPendingOps(): Promise<number> {
  const ops = await getAll<OfflineOpLogEntry>("op_log");
  return ops.filter((op) => !op.synced).length;
}

/**
 * 获取用于同步的真实 token：
 * - 若当前 token 已是真实会话则直接使用；
 * - 否则尝试用本地凭证静默重登（km-owner-credentials）。
 * 仍无 token 返回 null（需用户显式登录）。
 */
async function ensureRealToken(): Promise<string | null> {
  const current = useStore.getState().token;
  if (current && current !== OFFLINE_SESSION_TOKEN) return current;

  const client = getSupabaseClient();
  if (!client) return null;
  const session = await silentSignIn(client);
  if (session?.access_token) {
    useStore
      .getState()
      .setUser(
        toUser(session.user),
        session.access_token,
        session.refresh_token ?? null,
      );
    return session.access_token;
  }
  return null;
}

/**
 * 将离线期间累积的本地记录回传服务器（study_cards 进度 + 答题会话）。
 * 成功后删除已回传的 op_log 条目；失败条目保留，下次重试。
 */
export async function syncOfflineRecords(): Promise<OfflineSyncResult> {
  const pending = (await getAll<OfflineOpLogEntry>("op_log")).filter(
    (op) => !op.synced,
  );
  if (pending.length === 0) return EMPTY_RESULT;

  const token = await ensureRealToken();
  if (!token) {
    return { synced: 0, failed: 0, skipped: pending.length, authRequired: true };
  }

  const operations = pending.map((op) => ({
    clientOpId: op.id,
    table: op.table,
    action: op.action,
    recordId: op.record_id,
    data: op.data,
    timestamp: op.timestamp,
  }));

  const baseUrl = getMobileApiBaseUrl();
  const response = await fetch(`${baseUrl}/offline-sync`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ operations }),
  });
  if (!response.ok) {
    throw new Error(`Offline sync request failed: ${response.status}`);
  }

  const payload = (await response.json()) as {
    results?: Array<{
      clientOpId: string;
      success: boolean;
      skipped?: boolean;
    }>;
  };
  const resultMap = new Map(
    (payload.results ?? []).map((r) => [r.clientOpId, r]),
  );

  let synced = 0;
  let failed = 0;
  let skipped = 0;
  for (const op of pending) {
    const result = resultMap.get(op.id);
    if (result?.success) {
      await deleteRecord("op_log", op.id);
      if (result.skipped) skipped += 1;
      else synced += 1;
    } else {
      failed += 1;
    }
  }

  logger.warn("Offline sync complete", { synced, failed, skipped });
  return { synced, failed, skipped, authRequired: false };
}
