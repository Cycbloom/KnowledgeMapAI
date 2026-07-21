import { useEffect, useRef } from 'react';

export interface UseUrlSearchParamsField<T> {
  /** state 中对应字段名 */
  key: keyof T;
  /** URL 查询参数名 */
  urlParam: string;
  /**
   * 将 state 字段值序列化为 URL 字符串。
   * 返回 undefined 表示该字段为默认值，不应出现在 URL 中。
   */
  serialize: (value: T[keyof T]) => string | undefined;
  /**
   * 将 URL 字符串反序列化为 state 字段值。
   * 返回 undefined 表示不更新 state（保留原值或丢弃该字段更新）。
   */
  deserialize: (str: string | null) => T[keyof T] | undefined;
}

export interface UseUrlSearchParamsOptions<T> {
  /** 需要双向同步的字段配置（每个字段独立的 serialize/deserialize） */
  fields: UseUrlSearchParamsField<T>[];
  /** 默认 true：使用 replaceState 而非 pushState，避免污染浏览器历史 */
  replace?: boolean;
}

/**
 * 将 state 字段与 URL 查询参数双向同步。
 *
 * - state 变化 → URL 更新（默认 replaceState，可配置 pushState）
 * - popstate（浏览器前进/后退）→ state 反向更新
 * - mount 时若 URL 有参数，优先用 URL 值覆盖 state（一次性，避免循环）
 * - 仅同步 serialize 返回非 undefined 的字段（默认值不出现在 URL）
 * - SSR 安全：所有 window 访问均包裹在 useEffect + typeof window !== 'undefined' 中，
 *   SSR 环境 effect 不会执行，不会因访问 window 而抛错
 */
export function useUrlSearchParams<T>(
  state: T,
  setState: (value: Partial<T>) => void,
  options: UseUrlSearchParamsOptions<T>,
): void {
  const { fields, replace = true } = options;

  // 持有最新的 fields/setState 引用，避免重新注册 popstate listener。
  // 在 effect 中同步 ref（避免在 render 阶段写入 ref.current，符合 react-hooks/refs 规则）
  const fieldsRef = useRef(fields);
  const setStateRef = useRef(setState);
  useEffect(() => {
    fieldsRef.current = fields;
  });
  useEffect(() => {
    setStateRef.current = setState;
  });

  // 标记：URL→state 同步触发的 state 变化，应跳过随后的 state→URL 写回（避免循环）
  const skipNextUrlSync = useRef(false);
  // 仅在 mount 时执行一次 init 同步
  const hasInitSynced = useRef(false);

  // 1. mount 时：URL → state（URL 优先于初始 state）
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (hasInitSynced.current) return;
    hasInitSynced.current = true;

    const searchParams = new URLSearchParams(window.location.search);
    const updates: Partial<T> = {};
    let hasUpdate = false;
    for (const field of fieldsRef.current) {
      const urlValue = searchParams.get(field.urlParam);
      const deserialized = field.deserialize(urlValue);
      if (deserialized !== undefined) {
        updates[field.key] = deserialized;
        hasUpdate = true;
      }
    }
    if (hasUpdate) {
      skipNextUrlSync.current = true;
      setStateRef.current(updates);
    }
    // 仅在 mount 时运行一次：使用 ref 持有最新 fields/setState（refs 不触发 exhaustive-deps）
  }, []);

  // 2. state 变化 → URL（跳过由 URL→state 同步触发的写回）
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (skipNextUrlSync.current) {
      skipNextUrlSync.current = false;
      return;
    }

    const url = new URL(window.location.href);
    for (const field of fieldsRef.current) {
      const value = state[field.key];
      const serialized = field.serialize(value);
      if (serialized === undefined) {
        url.searchParams.delete(field.urlParam);
      } else {
        url.searchParams.set(field.urlParam, serialized);
      }
    }

    const newUrl = url.toString();
    if (newUrl !== window.location.href) {
      const method = replace ? 'replaceState' : 'pushState';
      window.history[method]({}, '', newUrl);
    }
  }, [state, replace]);

  // 3. popstate（浏览器前进/后退）→ state
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handlePopstate = () => {
      const searchParams = new URLSearchParams(window.location.search);
      const updates: Partial<T> = {};
      let hasUpdate = false;
      for (const field of fieldsRef.current) {
        const urlValue = searchParams.get(field.urlParam);
        const deserialized = field.deserialize(urlValue);
        if (deserialized !== undefined) {
          updates[field.key] = deserialized;
          hasUpdate = true;
        }
      }
      if (hasUpdate) {
        skipNextUrlSync.current = true;
        setStateRef.current(updates);
      }
    };

    window.addEventListener('popstate', handlePopstate);
    return () => {
      window.removeEventListener('popstate', handlePopstate);
    };
    // 仅在 mount 时注册一次：使用 ref 持有最新 fields/setState（refs 不触发 exhaustive-deps）
  }, []);
}
