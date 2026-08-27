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
  /** 用户是否手动指定过节点显示语言；为 true 时不再跟随系统界面语言 */
  manuallySet: boolean;
  setDisplayLanguage: (lang: string) => void;
  /** 跟随系统界面语言（仅当未手动指定时生效，用于语言变化自动同步） */
  applySystemLanguage: (lang: string) => void;
  /** 显式切回跟随系统：重置手动标记并按当前界面语言应用 */
  followSystem: (uiLanguage: string) => void;
}

/** 将系统界面语言解析为节点内容语言（支持映射的取映射，否则取该语言本身） */
export function resolveContentLanguage(uiLanguage: string): string {
  const normalized = uiLanguage.toLowerCase();
  if (normalized.startsWith("zh")) return "zh-CN";
  if (normalized.startsWith("en")) return "en-US";
  // 其他系统语言：若节点内容支持该语言则直接使用，否则回退到基础语言
  const exact = NODE_CONTENT_LANGUAGES.find(
    (l) => l.code.toLowerCase() === normalized,
  );
  return exact?.code ?? "zh-CN";
}

/**
 * 节点内容的显示语言。切换后同步 shared 的全局显示语言，
 * 使 buildNodeFromGraphNode 按新语言重新解析 title/content/summary。
 *
 * 默认跟随系统界面语言：未被用户手动指定时，界面语言变化会自动同步；
 * 一旦手动切换（setDisplayLanguage），则保持手动选择不再跟随。
 */
export const useNodeDisplayLanguageStore =
  createPersistedStore<NodeDisplayLanguageState>(
    "node-display-language",
    (set) => ({
      displayLanguage: "zh-CN",
      manuallySet: false,
      setDisplayLanguage: (lang) => {
        setNodeDisplayLanguage(lang);
        set({ displayLanguage: lang, manuallySet: true });
      },
      applySystemLanguage: (lang) => {
        // 仅当用户未手动指定时才跟随系统，避免覆盖手动选择
        const current = useNodeDisplayLanguageStore.getState();
        if (current.manuallySet) return;
        const resolved = resolveContentLanguage(lang);
        if (resolved !== current.displayLanguage) {
          setNodeDisplayLanguage(resolved);
          set({ displayLanguage: resolved });
        }
      },
      followSystem: (uiLanguage) => {
        const resolved = resolveContentLanguage(uiLanguage);
        setNodeDisplayLanguage(resolved);
        set({ displayLanguage: resolved, manuallySet: false });
      },
    }),
    {
      version: 2,
      // 必须显式 partialize，避免覆盖 persist 默认的 identity 导致 setItem 报错
      partialize: (state) => ({
        displayLanguage: state.displayLanguage,
        manuallySet: state.manuallySet,
      }),
    },
  );
