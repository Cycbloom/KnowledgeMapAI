import { useState, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { api } from "@/services/api";
import { useLevelTestNotificationStore } from "@/store/useLevelTestNotificationStore";
import { message } from "@/utils/messageHelper";
import type { GenerateCardsFullConfig } from "@/components/Learning/GenerateCardsModal";

export interface QuestionConfigTarget {
  kpId: string;
  title: string;
}

type GenerateConfig = GenerateCardsFullConfig & {
  targetNodeIds: string[];
};

/**
 * 「题目配置」面板的共用封装（练习用，区别于「创建测验」）。
 * 供概览与子任务编排复用：打开题目配置 → 提交生成后台任务 → 成功后经全局右下角弹窗继续练习。
 */
export function useQuestionConfigModal(graphId?: string) {
  const { t } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);
  const [target, setTarget] = useState<QuestionConfigTarget | null>(null);

  const openFor = useCallback((kpId: string, title: string) => {
    setTarget({ kpId, title });
    setIsOpen(true);
  }, []);

  const close = useCallback(() => {
    setIsOpen(false);
    setTarget(null);
  }, []);

  const handleGenerateCards = useCallback(
    async (config: GenerateConfig) => {
      const tgt = target;
      if (!tgt) return;

      const cardsPerTypeSrc = config.cardsPerType;
      const cardsPerTypeNum: Record<string, number> | undefined = cardsPerTypeSrc
        ? (() => {
            const out: Record<string, number> = {};
            for (const [k, v] of Object.entries(cardsPerTypeSrc)) {
              if (v !== undefined) out[k] = Number(v);
            }
            return Object.keys(out).length > 0 ? out : undefined;
          })()
        : undefined;

      const countPerDiffSrc = config.countPerDifficulty;
      const countPerDiffNum:
        | { easy?: number; medium?: number; hard?: number }
        | undefined = countPerDiffSrc
        ? (() => {
            const out: { easy?: number; medium?: number; hard?: number } = {};
            for (const k of ["easy", "medium", "hard"] as const) {
              const v = countPerDiffSrc[k];
              if (v !== undefined) out[k] = Number(v);
            }
            return Object.values(out).some((x) => x !== undefined) ? out : undefined;
          })()
        : undefined;

      const countMatrixSrc = config.countMatrix;
      const countMatrixNum =
        countMatrixSrc && Object.keys(countMatrixSrc).length > 0
          ? Object.fromEntries(
              Object.entries(countMatrixSrc).map(([k, v]) => [
                k,
                {
                  easy: Number(v.easy ?? 0),
                  medium: Number(v.medium ?? 0),
                  hard: Number(v.hard ?? 0),
                },
              ]),
            )
          : undefined;

      try {
        const result = await api.ai.batchGenerateCards([tgt.kpId], {
          count: config.count,
          types: config.types,
          difficulty: config.difficulty,
          coverage: config.coverage,
          custom_prompt: config.customPrompt || undefined,
          cards_per_type: cardsPerTypeNum,
          count_per_difficulty: countPerDiffNum,
          count_matrix: countMatrixNum,
        });
        if (result.success) {
          if (result.taskIds?.length) {
            setIsOpen(false);
            setTarget(null);
            useLevelTestNotificationStore
              .getState()
              .startGenerationTracking(
                result.taskIds,
                tgt.kpId,
                graphId ?? "",
                "learning",
              );
          } else {
            message.success(t("learning.cards.taskSubmitted"));
          }
        } else {
          const errMsg = result.message || result.error || t("learning.cards.unknownError");
          message.error(errMsg);
        }
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : t("learning.cards.unknownError");
        message.error(errorMessage);
      }
    },
    [target, graphId, t],
  );

  return { isOpen, target, openFor, close, onGenerate: handleGenerateCards };
}