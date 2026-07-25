import { useEffect } from 'react';

/**
 * 更新 document.title 以反映当前路由。
 * 当 title 为 undefined 时跳过，避免覆盖计时器等其他 title 写入逻辑。
 *
 * @param title - 当前页面的标题（i18n 翻译后的字符串），undefined 时跳过
 * @param suffix - 可选后缀（如 "KnowledgeMap"），提供时格式为 "{title} - {suffix}"
 */
export function useDocumentTitle(title: string | undefined, suffix?: string): void {
  useEffect(() => {
    if (!title) return;
    document.title = suffix ? `${title} - ${suffix}` : title;
  }, [title, suffix]);
}
