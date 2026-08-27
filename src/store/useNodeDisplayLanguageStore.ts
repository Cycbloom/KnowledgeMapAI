import { createPersistedStore } from "./createPersistedStore";
import { setNodeDisplayLanguage } from "@shared/utils/localization";

export const NODE_CONTENT_LANGUAGES = [
  { code: "zh-CN", label: "简体中文", short: "中" },
  { code: "en-US", label: "English", short: "EN" },
  { code: "ja", label: "日本語", short: "日" },
  { code: "ko", label: "한국어", short: "한" },
] as const;

interface NodeDisplayLanguageState {
  displayLanguage: string;
  setDisplayLanguage: (lang: string) => void;
}

/**
 * 节点内容的显示语言。切换后同步 shared 的全局显示语言，
 * 使 buildNodeFromGraphNode 按新语言重新解析 title/content/summary。
 */
export const useNodeDisplayLanguageStore =
  createPersistedStore<NodeDisplayLanguageState>(
    "node-display-language",
    (set) => ({
      displayLanguage: "zh-CN",
      setDisplayLanguage: (lang) => {
        setNodeDisplayLanguage(lang);
        set({ displayLanguage: lang });
      },
    }),
    {
      version: 1,
      // 必须显式 partialize，避免覆盖 persist 默认的 identity 导致 setItem 报错
      partialize: (state) => ({
        displayLanguage: state.displayLanguage,
      }),
    },
  );