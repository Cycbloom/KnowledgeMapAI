export type ContentLanguage = "zh" | "ja" | "ko" | "en" | "other";

/** 采样文本长度：取前 N 个字符做脚本统计即可稳定判定语种 */
const SAMPLE_LENGTH = 800;

const HAN_START = 0x4e00;
const HAN_END = 0x9fff;
const KANA_HIRAGANA_START = 0x3040;
const KANA_KATAKANA_END = 0x30ff;
const KANA_EXTENDED_START = 0x31f0;
const KANA_EXTENDED_END = 0x31ff;
const HANGUL_START = 0xac00;
const HANGUL_END = 0xd7af;
const LATIN_UPPER_START = 0x41;
const LATIN_UPPER_END = 0x5a;
const LATIN_LOWER_START = 0x61;
const LATIN_LOWER_END = 0x7a;

/** 根据文本的字符脚本分布判断内容语言（中文/日文/韩文/英文/其他） */
export function detectContentLanguage(text: string): ContentLanguage {
  const sample = text.slice(0, SAMPLE_LENGTH);
  let han = 0;
  let kana = 0;
  let hangul = 0;
  let latin = 0;
  for (const ch of sample) {
    const code = ch.codePointAt(0) ?? 0;
    if (code >= HAN_START && code <= HAN_END) {
      han++;
    } else if (
      (code >= KANA_HIRAGANA_START && code <= KANA_KATAKANA_END) ||
      (code >= KANA_EXTENDED_START && code <= KANA_EXTENDED_END)
    ) {
      kana++;
    } else if (code >= HANGUL_START && code <= HANGUL_END) {
      hangul++;
    } else if (
      (code >= LATIN_UPPER_START && code <= LATIN_UPPER_END) ||
      (code >= LATIN_LOWER_START && code <= LATIN_LOWER_END)
    ) {
      latin++;
    }
  }
  const total = han + kana + hangul + latin;
  if (total === 0) return "other";
  if (kana > 0) return "ja";
  if (hangul > 0 && hangul >= han) return "ko";
  if (han > latin) return "zh";
  if (latin > 0) return "en";
  return "other";
}

/** 是否为中文内容：中文内容不做选词翻译 */
export const isChineseContent = (language: ContentLanguage): boolean =>
  language === "zh";
