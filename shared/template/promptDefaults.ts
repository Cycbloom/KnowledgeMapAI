export const LANGUAGE_INSTRUCTIONS: Record<string, string> = {
  "zh-CN": "请用中文回答。",
  "en-US": "Please respond in English.",
  zh: "请用中文回答。",
  en: "Please respond in English.",
};

export function isEnglishLanguage(language?: string): boolean {
  if (!language) return false;
  return language === "en-US" || language === "en" || language.startsWith("en");
}

export function getLanguageInstruction(language?: string): string {
  if (!language) return LANGUAGE_INSTRUCTIONS["zh-CN"];
  if (isEnglishLanguage(language)) return LANGUAGE_INSTRUCTIONS["en-US"];
  return LANGUAGE_INSTRUCTIONS["zh-CN"];
}

export const CATEGORY_OPTIONS: Record<"en" | "zh", string> = {
  en: "'Definition', 'Concept', 'Method', 'Conclusion', 'Principle', 'Application', 'Terminology'",
  zh: "'定义', '概念', '方法', '结论', '原理', '应用', '术语'",
};

export function getCategoryOptions(language?: string): string {
  return isEnglishLanguage(language)
    ? CATEGORY_OPTIONS.en
    : CATEGORY_OPTIONS.zh;
}
