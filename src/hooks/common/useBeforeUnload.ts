import { useEffect } from 'react';

/**
 * 在用户尝试关闭/刷新页面时触发浏览器原生的「未保存更改」提示。
 *
 * 仅在 `enabled` 为 true 时挂载 `beforeunload` 监听器，
 * 避免在表单无脏数据时干扰用户导航。
 *
 * 注意：现代浏览器大多忽略自定义 message，但仍保留参数以兼容旧版浏览器。
 */
export function useBeforeUnload(enabled: boolean, message?: string): void {
  useEffect(() => {
    if (!enabled) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = message ?? '';
      return message ?? '';
    };
    window.addEventListener('beforeunload', handler);
    return () => {
      window.removeEventListener('beforeunload', handler);
    };
  }, [enabled, message]);
}
