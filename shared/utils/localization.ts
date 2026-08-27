// =====================================================
// 节点多语言（title/content/summary JSONB 化）工具函数
// 存储结构：{ "zh-CN": "中文", "en-US": "English" }，zh-CN 为基础语言
// =====================================================

/** 语言 key 化的字段值：可能是标量字符串（旧数据/直接赋值）或按语言的对象 */
export type LocalizedText = string | Record<string, string> | null | undefined;

/** 基础语言 key，作为回退与存量迁移的默认语言 */
export const BASE_CONTENT_LANG = "zh-CN";

/** 当前节点内容的显示语言（模块级可变，前端切换语言时更新；后端默认 zh-CN） */
let currentDisplayLang = BASE_CONTENT_LANG;

export function setNodeDisplayLanguage(lang: string): void {
  currentDisplayLang = lang;
}

export function getNodeDisplayLanguage(): string {
  return currentDisplayLang;
}

/** 将标量字符串包裹为 { [lang]: value }；空值返回空对象 */
export function toLocalizedMap(
  value: string | undefined | null,
  lang: string = currentDisplayLang,
): Record<string, string> {
  if (!value || value.trim() === "") return {};
  return { [lang]: value };
}

/**
 * 解析语言 key 化的字段值为指定语言文本。
 * 回退顺序：目标语言 → 基础语言(zh-CN) → 首个非空 key → ""
 */
export function resolveLocalizedText(
  value: LocalizedText,
  lang?: string,
): string {
  const target = lang || currentDisplayLang;
  if (typeof value === "string") return value;
  if (!value || typeof value !== "object") return "";
  if (value[target]) return value[target];
  if (value[BASE_CONTENT_LANG]) return value[BASE_CONTENT_LANG];
  const entry = Object.entries(value).find(([, v]) => v && v.trim() !== "");
  return entry ? entry[1] : "";
}

/** 返回该字段已存在的语言 key 列表 */
export function getLocalizedLanguages(value: LocalizedText): string[] {
  if (!value || typeof value !== "object") return [];
  return Object.keys(value).filter((k) => value[k] && value[k].trim() !== "");
}

/**
 * 合并/写入某语言的翻译。为保持基础语言不为空：
 * - 若写入的是非基础语言且当前无基础语言，则同步写入同一文本到基础语言。
 */
export function mergeLocalizedTranslation(
  value: LocalizedText,
  lang: string,
  text: string,
): Record<string, string> {
  const map: Record<string, string> =
    value && typeof value === "object" ? { ...value } : {};
  if (!text || text.trim() === "") {
    // 空文本视为删除该语言
    const next = { ...map };
    delete next[lang];
    return next;
  }
  map[lang] = text;
  if (lang !== BASE_CONTENT_LANG && !map[BASE_CONTENT_LANG]) {
    map[BASE_CONTENT_LANG] = text;
  }
  return map;
}