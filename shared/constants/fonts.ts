/**
 * Global typeface registry used by both the UI switcher and the learning
 * article reader. Every entry doubles as a system-font-first fallback stack so
 * the UI still renders correctly before users drop the self-hosted woff2 files
 * into public/fonts/.
 *
 * Self-hosted files (when present): public/fonts/<id>-400.woff2 [Regular] and
 * optional <id>-700.woff2 [Bold]. They are loaded via @font-face in
 * src/index.css using the exact `fontFamily` string below as the CSS name.
 */

export type UiFontFamilyId =
  | "system"
  | "noto-sans-sc"
  | "noto-serif-sc"
  | "lxgw-wenkai"
  | "sarasa-gothic-sc"
  | "inter";

export type ReadingFontFamilyId =
  | "sans"
  | "serif"
  | "mono"
  | "noto-sans-sc"
  | "noto-serif-sc"
  | "lxgw-wenkai"
  | "sarasa-gothic-sc"
  | "inter"
  | "jetbrains-mono";

export interface FontEntry {
  id: UiFontFamilyId | ReadingFontFamilyId;
  /** CSS font-family name used by @font-face and font stack declarations. */
  fontFamily: string;
  /** Fallback system font stack. Joined into the Tailwind fontFamily value. */
  fallback: string[];
  /**
   * Regular weight woff2 source. Prefers `/fonts/<id>-400.woff2` when present,
   * otherwise falls back to a Google Fonts URL for Latin/Chinese coverage.
   *
   * Electron users can drop the woff2 file into public/fonts to fully offline
   * this; the @font-face declaration loads the local path first and the
   * runtime silently skips failed @font-face src candidates.
   */
  woff2Regular?: string;
  /** Optional bold weight woff2 source. */
  woff2Bold?: string;
  /** Reading prose-only flag: monospace, serif, or sans-style. */
  style: "sans" | "serif" | "mono";
  /** Short i18n key (lowercased suffix) registered under settings.fonts.*. */
  labelKey: string;
}

export const UI_FONT_FAMILIES: ReadonlyArray<FontEntry & { id: UiFontFamilyId }> = [
  {
    id: "system",
    fontFamily: '"KnowledgeMap UI System"',
    fallback: [
      "system-ui",
      "-apple-system",
      "BlinkMacSystemFont",
      '"PingFang SC"',
      '"Microsoft YaHei"',
      '"Hiragino Sans GB"',
      '"Segoe UI"',
      "Roboto",
      "sans-serif",
    ],
    style: "sans",
    labelKey: "systemSans",
  },
  {
    id: "inter",
    fontFamily: "Inter",
    fallback: [
      "ui-sans-serif",
      "system-ui",
      "-apple-system",
      "BlinkMacSystemFont",
      '"PingFang SC"',
      '"Microsoft YaHei"',
      "Roboto",
      "sans-serif",
    ],
    woff2Regular: "/fonts/inter-400.woff2",
    woff2Bold: "/fonts/inter-700.woff2",
    style: "sans",
    labelKey: "inter",
  },
  {
    id: "noto-sans-sc",
    fontFamily: '"Noto Sans SC"',
    fallback: [
      "ui-sans-serif",
      "system-ui",
      "-apple-system",
      "BlinkMacSystemFont",
      '"PingFang SC"',
      '"Microsoft YaHei"',
      '"Hiragino Sans GB"',
      '"Source Han Sans SC"',
      "sans-serif",
    ],
    woff2Regular: "/fonts/noto-sans-sc-400.woff2",
    woff2Bold: "/fonts/noto-sans-sc-700.woff2",
    style: "sans",
    labelKey: "notoSansSC",
  },
  {
    id: "noto-serif-sc",
    fontFamily: '"Noto Serif SC"',
    fallback: [
      "ui-serif",
      '"Source Han Serif SC"',
      '"Songti SC"',
      '"SimSun"',
      '"Noto Serif"',
      "Georgia",
      "serif",
    ],
    woff2Regular: "/fonts/noto-serif-sc-400.woff2",
    woff2Bold: "/fonts/noto-serif-sc-700.woff2",
    style: "serif",
    labelKey: "notoSerifSC",
  },
  {
    id: "lxgw-wenkai",
    fontFamily: '"LXGW WenKai"',
    fallback: [
      '"KaiTi"',
      '"STKaiti"',
      '"Songti SC"',
      '"SimSun"',
      '"Microsoft YaHei"',
      "serif",
    ],
    woff2Regular: "/fonts/lxgw-wenkai-400.woff2",
    woff2Bold: "/fonts/lxgw-wenkai-700.woff2",
    style: "serif",
    labelKey: "lxgwWenkai",
  },
  {
    id: "sarasa-gothic-sc",
    fontFamily: '"Sarasa Gothic SC"',
    fallback: [
      "ui-monospace",
      "ui-sans-serif",
      '"PingFang SC"',
      '"Microsoft YaHei"',
      '"Cascadia Mono"',
      '"JetBrains Mono"',
      'Consolas',
      'monospace',
    ],
    woff2Regular: "/fonts/sarasa-gothic-sc-400.woff2",
    woff2Bold: "/fonts/sarasa-gothic-sc-700.woff2",
    style: "mono",
    labelKey: "sarasaGothicSC",
  },
] as const;

export const READING_FONT_FAMILIES: ReadonlyArray<
  FontEntry & { id: ReadingFontFamilyId }
> = [
  {
    id: "sans",
    fontFamily: '"KM Reading Sans"',
    fallback: [
      "ui-sans-serif",
      "system-ui",
      "-apple-system",
      "BlinkMacSystemFont",
      '"PingFang SC"',
      '"Microsoft YaHei"',
      '"Hiragino Sans GB"',
      '"Noto Sans SC"',
      '"Inter"',
      "sans-serif",
    ],
    style: "sans",
    labelKey: "sans",
  },
  {
    id: "serif",
    fontFamily: '"KM Reading Serif"',
    fallback: [
      "ui-serif",
      '"Noto Serif SC"',
      '"Source Han Serif SC"',
      '"Songti SC"',
      '"SimSun"',
      'Georgia',
      'Times New Roman',
      "serif",
    ],
    style: "serif",
    labelKey: "serif",
  },
  {
    id: "mono",
    fontFamily: '"KM Reading Mono"',
    fallback: [
      "ui-monospace",
      "SFMono-Regular",
      'Menlo',
      'Monaco',
      '"Cascadia Mono"',
      '"JetBrains Mono"',
      '"Sarasa Gothic SC"',
      'Consolas',
      '"Liberation Mono"',
      'Courier New',
      'monospace',
    ],
    style: "mono",
    labelKey: "mono",
  },
  ...(UI_FONT_FAMILIES.filter(
    (f) => f.id !== "system",
  ) as unknown as ReadonlyArray<FontEntry & { id: ReadingFontFamilyId }>),
  {
    id: "jetbrains-mono",
    fontFamily: '"JetBrains Mono"',
    fallback: [
      "ui-monospace",
      "SFMono-Regular",
      '"Cascadia Mono"',
      'Menlo',
      'Monaco',
      '"Sarasa Gothic SC"',
      'Consolas',
      '"Liberation Mono"',
      'Courier New',
      'monospace',
    ],
    woff2Regular: "/fonts/jetbrains-mono-400.woff2",
    woff2Bold: "/fonts/jetbrains-mono-700.woff2",
    style: "mono",
    labelKey: "jetbrainsMono",
  },
] as const;

/** Builds a font-stack array for Tailwind or CSS, starting with self-hosted name. */
export function buildFontStack(entry: FontEntry): string[] {
  return [entry.fontFamily, ...entry.fallback];
}

/**
 * Utility helper used by both the UI layout hook and HighlightedReader: maps a
 * persisted id to a concrete CSS font-family string (the full stack).
 */
export function resolveFontFamily(
  id: UiFontFamilyId | ReadingFontFamilyId,
  forScope: "ui" | "reading",
): string {
  const list = forScope === "ui" ? UI_FONT_FAMILIES : READING_FONT_FAMILIES;
  const hit = (list as ReadonlyArray<FontEntry>).find((f) => f.id === id);
  const stack = hit ? buildFontStack(hit) : [];
  return stack.join(", ");
}
