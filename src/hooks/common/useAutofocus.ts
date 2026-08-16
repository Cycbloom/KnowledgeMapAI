import { useEffect, useRef } from 'react';

/**
 * useAutofocus：在组件挂载后将返回的 ref 指向的元素聚焦。
 *
 * 不使用 JSX 的 `autoFocus` 属性（被 jsx-a11y/no-autofocus 禁用，
 * 因其会降低键盘/屏幕阅读器用户的可用性）。此 hook 仅在挂载时聚焦一次，
 * 适用于「打开即录入」的表单首字段。
 *
 * @example
 * const titleRef = useAutofocus<HTMLInputElement>();
 * return <input ref={titleRef} />;
 */
export function useAutofocus<T extends HTMLElement>() {
  const ref = useRef<T | null>(null);

  useEffect(() => {
    ref.current?.focus();
  }, []);

  return ref;
}