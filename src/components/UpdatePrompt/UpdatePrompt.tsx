import { useEffect } from "react";
import { useRegisterSW } from "virtual:pwa-register/react";
import toast from "react-hot-toast";

/**
 * SW 更新提示组件
 *
 * 通过 `useRegisterSW` 监听 SW 新版本可用事件（needRefresh），
 * 使用 react-hot-toast 渲染自定义更新提示：
 * - "立即刷新"：调用 updateServiceWorker(true) 触发 SKIP_WAITING + reload
 * - "稍后"：关闭 toast 并重置 needRefresh
 *
 * 本组件不渲染 DOM，仅通过 toast 反馈；调用方（App.tsx）应通过
 * `isElectron` 判断是否渲染本组件，Electron 端不注册 SW。
 */
export function UpdatePrompt() {
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisterError(error) {
      console.error("[SW] registration failed:", error);
    },
  });

  useEffect(() => {
    if (!needRefresh) return;

    const toastId = "sw-update";
    toast(
      (t) => (
        <div
          data-testid="update-prompt-toast"
          className="flex items-center gap-3"
        >
          <span>新版本可用</span>
          <button
            type="button"
            data-testid="update-prompt-refresh"
            onClick={() => {
              toast.dismiss(t.id);
              void updateServiceWorker(true);
            }}
            className="px-3 py-1 bg-blue-500 text-white rounded text-sm hover:bg-blue-600"
          >
            立即刷新
          </button>
          <button
            type="button"
            data-testid="update-prompt-dismiss"
            onClick={() => {
              toast.dismiss(t.id);
              setNeedRefresh(false);
            }}
            className="px-3 py-1 bg-gray-500 text-white rounded text-sm hover:bg-gray-600"
          >
            稍后
          </button>
        </div>
      ),
      {
        id: toastId,
        duration: Infinity,
      },
    );

    return () => {
      toast.dismiss(toastId);
    };
  }, [needRefresh, setNeedRefresh, updateServiceWorker]);

  // 此组件不渲染 DOM，只通过 toast 显示
  return null;
}
