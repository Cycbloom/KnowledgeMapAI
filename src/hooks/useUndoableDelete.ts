import { useCallback } from "react";
import { useTranslation } from "react-i18next";

import { message } from "../utils/messageHelper";

interface UndoableDeleteOptions<TPayload, TResource> {
  /** 执行删除（应返回 TPayload 用于 restore，比如 deletedIds 数组） */
  deleteFn: (payload: TPayload) => Promise<TResource>;
  /** 执行恢复，参数为 deleteFn 返回的 TResource */
  restoreFn: (resource: TResource) => Promise<void>;
  /** 资源名称 i18n key 已解析后的字符串，用于 toast 文案，例如 "图谱「数学」" 或 "3 个图谱" */
  deletedMessage: string;
  /** 恢复成功后的回调（通常是 invalidate queries） */
  onRestored?: () => void;
}

export function useUndoableDelete<TPayload, TResource>(
  options: UndoableDeleteOptions<TPayload, TResource>,
) {
  const { t } = useTranslation();

  const handleRestore = useCallback(
    async (resource: TResource) => {
      try {
        await options.restoreFn(resource);
        options.onRestored?.();
        message.success(t("common.restored"));
      } catch {
        message.error(t("common.restoreFailed"));
      }
    },
    [options, t],
  );

  const executeDelete = useCallback(
    async (payload: TPayload): Promise<TResource> => {
      const resource = await options.deleteFn(payload);
      message.success(options.deletedMessage, {
        duration: 5000,
        action: {
          label: t("common.undo"),
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
