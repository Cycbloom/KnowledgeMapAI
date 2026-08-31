import { useMemo, useState, useEffect } from "react";
import { api } from "@/services/api";
import { computeCardDisplayMastery } from "@shared/utils/fsrs/masteryContract";

export interface KnowledgePointMasteryResult {
  /** 知识点 id → 实时掌握度（0-1）。无卡/未拉取成功时不含该项 */
  masteryByKp: ReadonlyMap<string, number>;
  loading: boolean;
}

/**
 * 按知识点拉取学习卡并实时计算掌握度。
 * 一次请求（knowledge_point_ids 逗号拼接），客户端按 card.knowledge_point_id 分组求均值。
 * 用 cancelled 守卫丢弃过期响应，避免快速切换 task 时旧结果覆盖新结果。
 */
export function useKnowledgePointMastery(
  kpIds: readonly string[],
): KnowledgePointMasteryResult {
  const deduped = useMemo(
    () => Array.from(new Set(kpIds.filter((id) => !!id))),
    [kpIds],
  );
  const [masteryByKp, setMasteryByKp] = useState<Map<string, number>>(
    new Map(),
  );
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (deduped.length === 0) {
      setMasteryByKp(new Map());
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);

    api.study
      .getCards({ knowledge_point_ids: deduped })
      .then((cards) => {
        if (cancelled) return;
        const buckets = new Map<string, number[]>();
        const nowMs = Date.now();
        for (const card of cards ?? []) {
          if (!card.knowledge_point_id) continue;
          const bucket = buckets.get(card.knowledge_point_id);
          const value = computeCardDisplayMastery(card, nowMs);
          if (bucket) {
            bucket.push(value);
          } else {
            buckets.set(card.knowledge_point_id, [value]);
          }
        }
        const next = new Map<string, number>();
        for (const [kp, values] of buckets) {
          const avg =
            values.length > 0
              ? values.reduce((sum, v) => sum + v, 0) / values.length
              : 0;
          next.set(kp, avg);
        }
        setMasteryByKp(next);
      })
      .catch(() => {
        if (!cancelled) setMasteryByKp(new Map());
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [deduped]);

  return { masteryByKp, loading };
}