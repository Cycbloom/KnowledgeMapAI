import type {
  NodeLevel,
  ConceptSource,
} from "../../../shared/types/graph";

export const SIMILARITY_THRESHOLD = parseFloat(
  process.env.CONCEPT_MERGE_THRESHOLD || "0.85",
);
export const CORE_LEVEL_THRESHOLD = 2;
export const ROOT_LEVEL_THRESHOLD = 5;

const HALF_WIDTH_MAP: Record<string, string> = {
  "！": "!",
  "＂": '"',
  "＃": "#",
  "＄": "$",
  "％": "%",
  "＆": "&",
  "＇": "'",
  "（": "(",
  "）": ")",
  "＊": "*",
  "＋": "+",
  "，": ",",
  "－": "-",
  "．": ".",
  "／": "/",
  "０": "0",
  "１": "1",
  "２": "2",
  "３": "3",
  "４": "4",
  "５": "5",
  "６": "6",
  "７": "7",
  "８": "8",
  "９": "9",
  "：": ":",
  "；": ";",
  "＜": "<",
  "＝": "=",
  "＞": ">",
  "？": "?",
  "＠": "@",
  "Ａ": "A",
  "Ｂ": "B",
  "Ｃ": "C",
  "Ｄ": "D",
  "Ｅ": "E",
  "Ｆ": "F",
  "Ｇ": "G",
  "Ｈ": "H",
  "Ｉ": "I",
  "Ｊ": "J",
  "Ｋ": "K",
  "Ｌ": "L",
  "Ｍ": "M",
  "Ｎ": "N",
  "Ｏ": "O",
  "Ｐ": "P",
  "Ｑ": "Q",
  "Ｒ": "R",
  "Ｓ": "S",
  "Ｔ": "T",
  "Ｕ": "U",
  "Ｖ": "V",
  "Ｗ": "W",
  "Ｘ": "X",
  "Ｙ": "Y",
  "Ｚ": "Z",
  "ａ": "a",
  "ｂ": "b",
  "ｃ": "c",
  "ｄ": "d",
  "ｅ": "e",
  "ｆ": "f",
  "ｇ": "g",
  "ｈ": "h",
  "ｉ": "i",
  "ｊ": "j",
  "ｋ": "k",
  "ｌ": "l",
  "ｍ": "m",
  "ｎ": "n",
  "ｏ": "o",
  "ｐ": "p",
  "ｑ": "q",
  "ｒ": "r",
  "ｓ": "s",
  "ｔ": "t",
  "ｕ": "u",
  "ｖ": "v",
  "ｗ": "w",
  "ｘ": "x",
  "ｙ": "y",
  "ｚ": "z",
  "［": "[",
  "］": "]",
  "｛": "{",
  "｝": "}",
  "＾": "^",
  "＿": "_",
  "｀": "`",
  "～": "~",
};

function fullWidthToHalfWidth(str: string): string {
  let result = "";
  for (const ch of str) {
    result += HALF_WIDTH_MAP[ch] || ch;
  }
  return result;
}

const PUNCTUATION_RE = /[\s.,;:!?。，、；：！？…—\-–·""''「」『』【】《》（）()\-_]+$/g;

/** 标题归一化：全角转半角、小写、压缩空白、去尾部标点，用于去重比较 */
export function normalizeTitle(title: string): string {
  let normalized = title.trim();
  normalized = normalized.normalize("NFC");
  normalized = fullWidthToHalfWidth(normalized);
  normalized = normalized.toLowerCase();
  normalized = normalized.replace(/\s+/g, " ");
  normalized = normalized.replace(PUNCTUATION_RE, "").trim();
  return normalized;
}

export interface AggregationResult {
  mergedCount: number;
  upgradedNodes: Array<{
    knowledgePointId: string;
    title: string;
    oldLevel: NodeLevel;
    newLevel: NodeLevel;
    sourceCount: number;
  }>;
  mergedSources: Array<{
    targetId: string;
    sourceIds: string[];
    mergedSourceCount: number;
  }>;
}

export interface HierarchySuggestion {
  parentId: string;
  parentTitle: string;
  childId: string;
  childTitle: string;
  confidence: number;
}

export interface BatchMergeResult {
  mergedGroups: number;
  totalMergedCount: number;
  aliasesAdded: number;
  edgesUpdated: number;
  errors: Array<{
    targetId: string;
    sourceIds: string[];
    error: string;
  }>;
}

/** 依据来源数量决定节点升级后的等级 */
export function determineNewLevel(
  currentLevel: NodeLevel | undefined,
  sourceCount: number,
): NodeLevel {
  const levelPriority: NodeLevel[] = ["root", "core", "sub", "normal", "leaf"];
  const currentIndex = currentLevel ? levelPriority.indexOf(currentLevel) : 3;

  let newLevelIndex = currentIndex;

  if (sourceCount >= ROOT_LEVEL_THRESHOLD) {
    newLevelIndex = 0;
  } else if (sourceCount >= CORE_LEVEL_THRESHOLD) {
    newLevelIndex = Math.min(currentIndex, 1);
  }

  return levelPriority[newLevelIndex];
}

/** 合并来源列表（按 url/fileName/title 去重），供聚合与升级共用 */
export function mergeSources(
  existingSources: ConceptSource[] | undefined,
  newSources: ConceptSource[],
): ConceptSource[] {
  const sourceMap = new Map<string, ConceptSource>();

  if (existingSources) {
    for (const source of existingSources) {
      const key = source.url || source.fileName || source.title;
      if (key) {
        sourceMap.set(key, source);
      }
    }
  }

  for (const source of newSources) {
    const key = source.url || source.fileName || source.title;
    if (key && !sourceMap.has(key)) {
      sourceMap.set(key, source);
    }
  }

  return Array.from(sourceMap.values());
}
