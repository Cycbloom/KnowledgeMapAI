import { useCallback } from "react";
import { useTranslation } from "react-i18next";

import { message } from "../utils/messageHelper";

export interface UndoableActionOptions<TPayload, TResource> {
  /** 执行删除（应返回 TPayload 用于 restore，比如 deletedIds 数组） */
  deleteFn: (payload: TPayload) => Promise<TResource>;
  /** 执行恢复，参数为 deleteFn 返回的 TResource */
  restoreFn: (resource: TResource) => Promise<void>;
  /** 资源名称 i18n key 已解析后的字符串，用于 toast 文案，例如 "图谱「数学」" 或 "3 个图谱" */
  deletedMessage: string;
  /**
   * 可选：基于 payload 动态计算删除 toast 文案。
   * 提供时覆盖 deletedMessage，用于需要根据 payload 渲染动态文案的场景
   * （如 "已删除图谱「{{title}}」"）。
   */
  getDeletedMessage?: (payload: TPayload) => string;
  /** 恢复成功后的回调（通常是 invalidate queries） */
  onRestored?: () => void;
  /** 恢复失败后的回调 */
  onRestoreFailed?: () => void;
  /** toast 持续时间（毫秒），默认 6000 */
  toastDuration?: number;
  /** 撤销按钮文案，默认 t("common.undo") */
  undoLabel?: string;
  /** 恢复成功 toast 文案，默认 t("common.restored") */
  restoredMessage?: string;
  /** 恢复失败 toast 文案，默认 t("common.restoreFailed") */
  restoreFailedMessage?: string;
}

/**
 * 通用撤销操作 hook：执行删除后显示 X 秒撤销 toast，点击撤销调用 restoreFn 恢复。
 *
 * 替代旧的 useUndoableDelete（保留为 deprecated alias）。
 * 计划清理：可在 R25+ 删除 useUndoableDelete re-export。
 */
export function useUndoableAction<TPayload, TResource>(
  options: UndoableActionOptions<TPayload, TResource>,
) {
  const { t } = useTranslation();

  const handleRestore = useCallback(
    async (resource: TResource) => {
      try {
        await options.restoreFn(resource);
        options.onRestored?.();
        message.success(options.restoredMessage ?? t("common.restored"));
      } catch {
        message.error(options.restoreFailedMessage ?? t("common.restoreFailed"));
        options.onRestoreFailed?.();
      }
    },
    [options, t],
  );

  const executeDelete = useCallback(
    async (payload: TPayload): Promise<TResource> => {
      const resource = await options.deleteFn(payload);
      const msg = options.getDeletedMessage
        ? options.getDeletedMessage(payload)
        : options.deletedMessage;
      message.success(msg, {
        duration: options.toastDuration ?? 6000,
        action: {
          label: options.undoLabel ?? t("common.undo"),
          onClick: () => {
            void handleRestore(resource);
          },
        },
      });
      return resource;
    },
    [options, t, handleRestore],
  );

  return { executeDelete, handleRestore };
}
