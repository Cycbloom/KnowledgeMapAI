import { useEffect } from "react";
import { useRegisterSW } from "virtual:pwa-register/react";
import { useTranslation } from "react-i18next";
import { message } from "@/utils/messageHelper";

/**
 * SW 更新提示组件
 *
 * 通过 `useRegisterSW` 监听 SW 新版本可用事件（needRefresh），
 * 使用 message helper 渲染更新提示：
 * - "立即刷新"：调用 updateServiceWorker(true) 触发 SKIP_WAITING + reload
 *
 * 本组件不渲染 DOM，仅通过 message 反馈；调用方（App.tsx）应通过
 * `isElectron` 判断是否渲染本组件，Electron 端不注册 SW。
 */
export function UpdatePrompt() {
  const { t } = useTranslation();
  const {
    needRefresh: [needRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisterError(error) {
      console.error("[SW] registration failed:", error);
    },
  });

  useEffect(() => {
    if (!needRefresh) return;

    const messageId = "sw-update";
    message.info(t("toast.update.newVersionAvailable"), {
      id: messageId,
      duration: Infinity,
      action: {
        label: t("toast.update.refreshNow"),
        onClick: () => {
          void updateServiceWorker(true);
        },
      },
    });

    return () => {
      message.dismiss(messageId);
    };
  }, [needRefresh, t, updateServiceWorker]);

  // 此组件不渲染 DOM，只通过 message 显示
  return null;
}
