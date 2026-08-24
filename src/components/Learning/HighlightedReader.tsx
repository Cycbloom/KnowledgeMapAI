import React, { useState, useEffect, useRef, useMemo } from "react";
import { useTranslation } from "react-i18next";
import ReactMarkdown from "react-markdown";
import { debounce } from "@/utils/performanceUtils";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import "katex/dist/katex.min.css";
import { motion, AnimatePresence } from "framer-motion";
import { Sparkles, Loader2, Info } from "lucide-react";
import { TermTooltip } from "../common";
import { CodeBlock } from "../common/CodeBlock";
import { preprocessMarkdown } from "../../utils/markdownPreprocessor";
import { useFocusStore } from "../../store/useFocusStore";
import { useShallow } from "zustand/react/shallow";
import { useReducedMotionOrPreference } from "@/hooks/common/useReducedMotionOrPreference";
import type {
  UserSettingsReadingMode,
  UserSettingsContentWidthMode,
  UserSettingsFontFamily,
  UserSettingsLineHeight,
} from "@shared/types";
import { resolveFontFamily } from "@shared/constants/fonts";

interface HighlightRange {
  start: number;
  end: number;
  reason: string;
  importance?: number;
  category?: string;
}

interface Keyword {
  term: string;
  importance: number;
  category: string;
  explanation: string;
}

export type { Keyword };

interface HighlightedReaderProps {
  content: string;
  isDark: boolean;
  isMobile: boolean;
  onAnalyze?: (content: string) => Promise<HighlightRange[]>;
  keywords?: Keyword[];
  onKeywordClick?: (keyword: {
    term: string;
    importance: number;
    category: string;
    explanation: string;
  }) => void;
  /** Optional reading appearance settings. Omitted by callers like the focus panel that render their own layout. */
  fontSize?: number;
  readingMode?: UserSettingsReadingMode;
  contentWidthMode?: UserSettingsContentWidthMode;
  fontFamily?: UserSettingsFontFamily;
  lineHeight?: UserSettingsLineHeight;
}

interface ProseStyleVars extends React.CSSProperties {
  "--tw-prose-body"?: string;
  "--tw-prose-headings"?: string;
  "--tw-prose-links"?: string;
  "--tw-prose-bold"?: string;
  "--tw-prose-quotes"?: string;
  "--tw-prose-quote-borders"?: string;
  "--tw-prose-counters"?: string;
  "--tw-prose-bullets"?: string;
  "--tw-prose-hr"?: string;
  "--tw-prose-th-borders"?: string;
  "--tw-prose-td-borders"?: string;
  "--tw-prose-code"?: string;
}

/** 高亮遍历需要整棵子树跳过的元素：pre/code（CodeBlock 内部 Suspense 加载完成后
 *  会删除 fallback 子树，高亮日志不能落入其中）、svg、KaTeX 渲染产物（mathml 与
 *  html 双份文本）、以及显式声明忽略的区域。 */
const shouldSkipElement = (el: Element): boolean => {
  if (el.tagName === "PRE" || el.tagName === "CODE" || el.tagName === "SVG") {
    return true;
  }
  if (el.hasAttribute("data-highlight-ignore")) return true;
  const cls = el.getAttribute("class");
  return cls !== null && cls.includes("katex");
};

interface TextNodeSpan {
  node: Text;
  start: number;
  end: number;
}

/** 按文档顺序收集参与高亮的文本节点及其在全文中的偏移。
 *  「计算 ranges 的文本流」与「应用 ranges 的文本流」必须共用本遍历，
 *  二者严格一致，高亮位置才不可能错位。 */
const collectTextNodes = (container: HTMLElement): TextNodeSpan[] => {
  const walker = document.createTreeWalker(container, NodeFilter.SHOW_ALL, {
    acceptNode: (node) => {
      if (node.nodeType === Node.TEXT_NODE) return NodeFilter.FILTER_ACCEPT;
      if (
        node.nodeType === Node.ELEMENT_NODE &&
        shouldSkipElement(node as Element)
      ) {
        // REJECT：连同整个子树一并跳过
        return NodeFilter.FILTER_REJECT;
      }
      return NodeFilter.FILTER_SKIP;
    },
  });
  const textNodes: TextNodeSpan[] = [];
  let offset = 0;
  let node: Node | null;
  while ((node = walker.nextNode())) {
    if (node.nodeType !== Node.TEXT_NODE) continue;
    const text = node as Text;
    const length = text.textContent?.length ?? 0;
    textNodes.push({ node: text, start: offset, end: offset + length });
    offset += length;
  }
  return textNodes;
};

const extractDomPlainText = (container: HTMLElement): string =>
  collectTextNodes(container)
    .map(({ node }) => node.textContent ?? "")
    .join("");

/** 一次高亮替换的日志条目：恢复时必须把 React 持有的 original 节点原位放回，
 *  而不是新建等价文本节点——否则 React fiber→DOM 的引用仍指向已脱离的节点，
 *  后续 removeChild 依然会抛 NotFoundError。 */
interface HighlightMutation {
  parent: Node;
  original: Text;
  /** 本次插入片段的首/尾节点，恢复时按区间移除 */
  first: Node;
  last: Node;
  /** 替换发生时 original 的后继节点，恢复时 insertBefore 的锚点 */
  anchor: Node | null;
}

/** 逆序还原：高亮按文档顺序应用，靠前的 mutation 可能以靠后的 original 为
 *  锚点，逆序恢复保证锚点先归位。 */
const restoreHighlights = (mutations: HighlightMutation[]): void => {
  for (let i = mutations.length - 1; i >= 0; i--) {
    const { parent, original, first, last, anchor } = mutations[i];
    let node: Node | null = first;
    while (node) {
      const next: Node | null = node.nextSibling;
      if (node.parentNode === parent) {
        parent.removeChild(node);
      }
      if (node === last) break;
      node = next;
    }
    if (original.parentNode !== parent) {
      parent.insertBefore(original, anchor);
    }
  }
};

const analyzeTextLocally = (
  content: string,
  intensity: number,
  patterns: Array<{ regex: RegExp; reason: string; score: number }>,
): HighlightRange[] => {
  if (content.length === 0) return [];

  const highlights: Array<HighlightRange & { score: number }> = [];

  patterns.forEach(({ regex, reason, score }) => {
    let match;
    const globalRegex = new RegExp(regex.source, regex.flags);
    while ((match = globalRegex.exec(content)) !== null) {
      highlights.push({
        start: match.index,
        end: match.index + match[0].length,
        reason,
        score,
      });
    }
  });

  highlights.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return a.start - b.start;
  });

  const densityThreshold = intensity * 0.3;
  const totalLength = content.length;
  let highlightedLength = 0;
  const selected: Array<HighlightRange & { score: number }> = [];

  for (const h of highlights) {
    const matchLength = h.end - h.start;
    const currentDensity = highlightedLength / totalLength;
    if (currentDensity >= densityThreshold) break;
    selected.push(h);
    highlightedLength += matchLength;
  }

  selected.sort((a, b) => a.start - b.start);

  const merged: HighlightRange[] = [];
  selected.forEach(({ score: _, ...h }) => {
    const last = merged[merged.length - 1];
    if (last && h.start <= last.end + 5) {
      last.end = Math.max(last.end, h.end);
      last.reason = `${last.reason}, ${h.reason}`;
    } else {
      merged.push({ ...h });
    }
  });

  return merged;
};

const analyzeKeywords = (
  content: string,
  keywords: Keyword[],
): HighlightRange[] => {
  const highlights: HighlightRange[] = [];

  keywords.forEach((keyword) => {
    const escapedTerm = keyword.term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    // gi：全局 + 忽略大小写。英文关键词 AI 常给首字母大写（如 "Concept"），
    // 而正文中可能小写，忽略大小写可避免漏匹配（中文不受影响）。
    const regex = new RegExp(escapedTerm, "gi");
    let match;

    while ((match = regex.exec(content)) !== null) {
      highlights.push({
        start: match.index,
        end: match.index + match[0].length,
        reason: keyword.explanation,
        importance: keyword.importance,
        category: keyword.category,
      });
    }
  });

  highlights.sort((a, b) => a.start - b.start);

  const merged: HighlightRange[] = [];
  highlights.forEach((h) => {
    const last = merged[merged.length - 1];
    if (last && h.start < last.end) {
      last.end = Math.max(last.end, h.end);
      if (
        h.importance &&
        (!last.importance || h.importance > last.importance)
      ) {
        last.importance = h.importance;
        last.reason = h.reason;
        last.category = h.category;
      }
    } else {
      merged.push({ ...h });
    }
  });

  return merged;
};

const getHighlightClassName = (importance?: number, isDark?: boolean): string => {
  // Force highlight text to a consistent near-black so the light tinted
  // backgrounds (yellow/amber/lime/etc.) always stay readable, no matter
  // what the surrounding prose text color resolves to in dark mode.
  const baseClasses =
    "cursor-help transition-all duration-200 rounded px-0.5 border-b-2 text-slate-900";

  if (isDark) {
    if (!importance) {
      return `${baseClasses} bg-yellow-400/80 border-orange-400 hover:bg-yellow-400`;
    }

    const darkColorMap: Record<
      number,
      { bg: string; border: string; hover: string }
    > = {
      5: {
        bg: "bg-amber-400/80",
        border: "border-amber-400",
        hover: "hover:bg-amber-400",
      },
      4: {
        bg: "bg-yellow-400/80",
        border: "border-yellow-400",
        hover: "hover:bg-yellow-400",
      },
      3: {
        bg: "bg-lime-400/80",
        border: "border-lime-400",
        hover: "hover:bg-lime-400",
      },
      2: {
        bg: "bg-emerald-400/80",
        border: "border-emerald-400",
        hover: "hover:bg-emerald-400",
      },
      1: {
        bg: "bg-primary-400/80",
        border: "border-primary-400",
        hover: "hover:bg-primary-400",
      },
    };

    const colors = darkColorMap[importance] || darkColorMap[3];
    return `${baseClasses} ${colors.bg} ${colors.border} ${colors.hover}`;
  }

  if (!importance) {
    return `${baseClasses} bg-yellow-200 border-orange-400 hover:bg-yellow-300`;
  }

  const colorMap: Record<
    number,
    { bg: string; border: string; hover: string }
  > = {
    5: {
      bg: "bg-amber-300",
      border: "border-amber-600",
      hover: "hover:bg-amber-400",
    },
    4: {
      bg: "bg-yellow-200",
      border: "border-yellow-500",
      hover: "hover:bg-yellow-300",
    },
    3: {
      bg: "bg-lime-200",
      border: "border-lime-500",
      hover: "hover:bg-lime-300",
    },
    2: {
      bg: "bg-emerald-100",
      border: "border-emerald-400",
      hover: "hover:bg-emerald-200",
    },
    1: {
      bg: "bg-primary-100",
      border: "border-primary-400",
      hover: "hover:bg-primary-200",
    },
  };

  const colors = colorMap[importance] || colorMap[3];
  return `${baseClasses} ${colors.bg} ${colors.border} ${colors.hover}`;
};

const calculateTooltipPosition = (
  mouseX: number,
  mouseY: number,
  tooltipWidth: number = 200,
  tooltipHeight: number = 60,
): { left: number; top: number; transform: string } => {
  const viewportWidth = window.innerWidth;
  const padding = 10;

  let left = mouseX + padding;
  let top = mouseY - padding;
  let transform = "translateY(-100%)";

  if (left + tooltipWidth > viewportWidth - padding) {
    left = mouseX - tooltipWidth - padding;
  }

  if (top - tooltipHeight < padding) {
    top = mouseY + padding;
    transform = "translateY(0)";
  }

  left = Math.max(padding, Math.min(left, viewportWidth - tooltipWidth - padding));

  return { left, top, transform };
};

const applyHighlightsToDom = (
  container: HTMLElement,
  ranges: HighlightRange[],
  isDark?: boolean,
): HighlightMutation[] => {
  const mutations: HighlightMutation[] = [];
  if (ranges.length === 0) return mutations;

  const textNodes = collectTextNodes(container);

  // 预构建 range -> 下标 映射，避免给每个高亮片段重复线性 range.indexOf（原为 O(relevantRanges*ranges)）
  const rangeIndexMap = new Map<HighlightRange, number>();
  ranges.forEach((r, i) => {
    rangeIndexMap.set(r, i);
  });

  textNodes.forEach(({ node, start, end }) => {
    const relevantRanges = ranges.filter(
      (r) => !(start >= r.end || end <= r.start),
    );
    if (relevantRanges.length === 0) return;

    const text = node.textContent || "";

    const parts: {
      text: string;
      highlight: boolean;
      range?: HighlightRange;
      rangeIndex?: number;
    }[] = [];
    let pos = 0;

    relevantRanges.forEach((range) => {
      const highlightStart = Math.max(0, range.start - start);
      const highlightEnd = Math.min(text.length, range.end - start);

      if (highlightStart >= highlightEnd) return;

      if (highlightStart > pos) {
        parts.push({
          text: text.slice(pos, highlightStart),
          highlight: false,
        });
      }

      const highlighted = text
        .slice(highlightStart, highlightEnd)
        .replace(/\n/g, " ");
      if (highlighted.trim()) {
        parts.push({
          text: highlighted,
          highlight: true,
          range,
          rangeIndex: rangeIndexMap.get(range) ?? -1,
        });
      } else {
        parts.push({ text: highlighted, highlight: false });
      }

      pos = highlightEnd;
    });

    if (pos < text.length) {
      parts.push({ text: text.slice(pos), highlight: false });
    }

    if (parts.every((p) => !p.highlight)) return;

    const parent = node.parentNode;
    if (!parent) return;

    const fragment = document.createDocumentFragment();
    parts.forEach((part) => {
      if (part.highlight && part.range) {
        const span = document.createElement("span");
        span.className = getHighlightClassName(part.range.importance, isDark);
        span.dataset.highlight = "true";
        span.dataset.reason = part.range.reason;
        span.dataset.rangeIndex = String(part.rangeIndex);
        if (part.range.importance) {
          span.dataset.importance = String(part.range.importance);
        }
        if (part.range.category) {
          span.dataset.category = part.range.category;
          span.addEventListener("click", () => {
            const event = new CustomEvent("highlight-click", {
              bubbles: true,
              detail: {
                term: part.text,
                importance: part.range?.importance,
                category: part.range?.category,
                explanation: part.range?.reason,
              },
            });
            span.dispatchEvent(event);
          });
          span.style.cursor = "pointer";
        }
        span.textContent = part.text;
        fragment.appendChild(span);
      } else {
        fragment.appendChild(document.createTextNode(part.text));
      }
    });

    // 竞态防御：rAF 回调执行时组件可能已卸载或内容被 React 重建，
    // 此时 node 已不是 parent 的子节点，直接 replaceChild 会抛
    // "Failed to execute 'replaceChild'/'removeChild': not a child"。
    // 仅在 node 仍归属 parent 时才替换，否则安全跳过。
    if (node.parentNode !== parent) return;

    // 记录变更日志：React fiber 仍持有 original 引用，恢复时必须原位放回
    const anchor = node.nextSibling;
    const first = fragment.firstChild;
    const last = fragment.lastChild;
    parent.replaceChild(fragment, node);
    if (first && last) {
      mutations.push({ parent, original: node, first, last, anchor });
    }
  });

  return mutations;
};

interface HighlightDomGuardProps {
  contentRef: React.RefObject<HTMLDivElement>;
  mutationsRef: React.MutableRefObject<HighlightMutation[]>;
  onRestored: () => void;
  children: React.ReactNode;
}

/**
 * 在 React 提交 DOM 变更（mutation 阶段）之前，还原高亮对 DOM 的命令式改动。
 *
 * getSnapshotBeforeUpdate 运行于 before-mutation 阶段——早于本子树内任何 DOM
 * 增删——此刻把被替换的原始文本节点原位放回，React 后续的 removeChild /
 * insertBefore 全部作用在与虚拟 DOM 一致的干净树上，从根本上避免
 * "NotFoundError: The node to be removed is not a child of this node"。
 * 随后 componentDidUpdate（layout 阶段、绘制前）同步原位重绘同一批 ranges，
 * 用户不会看到高亮闪断。
 *
 * react-markdown v10 为无状态纯函数组件，只随父组件重渲染、没有独立更新
 * 路径，因此该守卫可覆盖 prose 子树的全部提交。
 */
class HighlightDomGuard extends React.Component<HighlightDomGuardProps> {
  override getSnapshotBeforeUpdate(): boolean {
    const { contentRef, mutationsRef } = this.props;
    if (contentRef.current && mutationsRef.current.length > 0) {
      restoreHighlights(mutationsRef.current);
      mutationsRef.current = [];
      return true;
    }
    return false;
  }

  override componentDidUpdate(
    _prevProps: Readonly<HighlightDomGuardProps>,
    _prevState: Readonly<Record<string, never>>,
    restored: boolean,
  ): void {
    if (restored) {
      this.props.onRestored();
    }
  }

  override componentWillUnmount(): void {
    // 卸载走 deletion 路径：父组件的 componentWillUnmount 先于子树 host 节点
    // 的 removeChild 执行，这里同样先还原，避免删除被替换节点时抛错
    const { contentRef, mutationsRef } = this.props;
    if (contentRef.current && mutationsRef.current.length > 0) {
      restoreHighlights(mutationsRef.current);
      mutationsRef.current = [];
    }
  }

  override render(): React.ReactNode {
    return this.props.children;
  }
}

export const HighlightedReader: React.FC<HighlightedReaderProps> = ({
  content,
  isDark,
  isMobile,
  onAnalyze,
  keywords,
  onKeywordClick,
  fontSize,
  readingMode,
  contentWidthMode,
  fontFamily,
  lineHeight,
}) => {
  const { t } = useTranslation();
  const { highlightEnabled, highlightIntensity } = useFocusStore(
    useShallow((s) => ({
      highlightEnabled: s.highlightEnabled,
      highlightIntensity: s.highlightIntensity,
    })),
  );
  const { reduceMotion, transitionOverride } = useReducedMotionOrPreference();
  const patterns = useMemo(
    () => [
      { regex: /【[^】]+】/g, reason: t("learning.highlightedReader.reasons.keyTerm"), score: 10 },
      { regex: /「[^」]+」/g, reason: t("learning.highlightedReader.reasons.importantConcept"), score: 9 },
      { regex: /第[一二三四五六七八九十]+[章节][^\n]*/g, reason: t("learning.highlightedReader.reasons.chapterTitle"), score: 8 },
      {
        regex: /[一二三四五六七八九十]+[、.．][^。\n]{1,30}/g,
        reason: t("learning.highlightedReader.reasons.keyPoints"),
        score: 5,
      },
      { regex: /\d+[、.．][^。\n]{1,30}/g, reason: t("learning.highlightedReader.reasons.numberedPoints"), score: 4 },
      { regex: /关键[是在于：:][^。\n]{1,50}/g, reason: t("learning.highlightedReader.reasons.keyArgument"), score: 7 },
      { regex: /重要[的是：:][^。\n]{1,50}/g, reason: t("learning.highlightedReader.reasons.importantNote"), score: 7 },
      { regex: /注意[：:][^。\n]{1,50}/g, reason: t("learning.highlightedReader.reasons.notice"), score: 6 },
      { regex: /定义[是为：:][^。\n]{1,80}/g, reason: t("learning.highlightedReader.reasons.definition"), score: 8 },
      { regex: /总结[：:][^。\n]{1,100}/g, reason: t("learning.highlightedReader.reasons.summary"), score: 7 },
      { regex: /核心[概念是：:][^。\n]{1,50}/g, reason: t("learning.highlightedReader.reasons.coreConcept"), score: 9 },
    ],
    [t],
  );
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [highlightRanges, setHighlightRanges] = useState<HighlightRange[]>([]);
  const [hoveredReason, setHoveredReason] = useState<string | null>(null);
  const [tooltipPosition, setTooltipPosition] = useState({ x: 0, y: 0 });
  const [needsHighlight, setNeedsHighlight] = useState(false);
  const [highlightStats, setHighlightStats] = useState<{
    keywordHits: number;
    localHits: number;
    importanceBreakdown: Record<number, number>;
  } | null>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  /** 高亮对 DOM 的改动日志：记录被替换的原始文本节点，恢复时原位放回 React 持有的节点引用 */
  const mutationsRef = useRef<HighlightMutation[]>([]);
  /** 当前 highlightRanges 所分析的 content：重绘前校验，内容已变则丢弃，防止旧偏移落到新文本 */
  const analyzedContentRef = useRef<string | null>(null);
  /** rAF 异步回调里读取最新主题：主题切换由守卫的原位重绘即时生效，无需触发重新分析 */
  const isDarkRef = useRef(isDark);
  useEffect(() => {
    isDarkRef.current = isDark;
  }, [isDark]);
  const debouncedSetNeedsHighlight = useMemo(
    () =>
      debounce(() => {
        setNeedsHighlight(true);
        setIsAnalyzing(true);
      }, 300),
    [],
  );

  // 守卫还原 DOM 后立即原位重绘：内容未变 → DOM 文本与 ranges 计算时完全一致，
  // 落点不可能偏移；内容已变则跳过，交给防抖后的重新分析。
  const handleDomRestored = () => {
    const container = contentRef.current;
    if (!container || highlightRanges.length === 0) return;
    if (analyzedContentRef.current !== content) return;
    mutationsRef.current = applyHighlightsToDom(
      container,
      highlightRanges,
      isDark,
    );
  };

  useEffect(() => {
    if (highlightEnabled && content) {
      debouncedSetNeedsHighlight();
    } else {
      debouncedSetNeedsHighlight.cancel();
      setHighlightRanges([]);
      setIsAnalyzing(false);
      setNeedsHighlight(false);
      setHighlightStats(null);
      if (contentRef.current && mutationsRef.current.length > 0) {
        restoreHighlights(mutationsRef.current);
        mutationsRef.current = [];
      }
    }
  }, [content, highlightEnabled, highlightIntensity, keywords, debouncedSetNeedsHighlight]);

  useEffect(() => {
    return () => {
      debouncedSetNeedsHighlight.cancel();
    };
  }, [debouncedSetNeedsHighlight]);

  useEffect(() => {
    if (!needsHighlight || !contentRef.current) return;

    let cancelled = false;
    const container = contentRef.current;

    const rafId = requestAnimationFrame(() => {
      // 先还原为 React 原始节点：旧高亮 span 不参与新一轮文本收集，
      // 保证分析与作用在同一份干净 DOM 上
      if (mutationsRef.current.length > 0) {
        restoreHighlights(mutationsRef.current);
        mutationsRef.current = [];
      }

      const plainText = extractDomPlainText(container);
      if (!plainText) {
        setHighlightRanges([]);
        setIsAnalyzing(false);
        setNeedsHighlight(false);
        return;
      }

      const finishHighlight = (ranges: HighlightRange[]) => {
        if (cancelled) return;
        // 异步分析（onAnalyze）期间内容可能已切换：文本不一致说明结果过期，
        // 直接丢弃，等待内容 effect 触发的重新分析，避免旧 ranges 偏移到新文本
        if (extractDomPlainText(container) !== plainText) {
          setHighlightRanges([]);
          setHighlightStats(null);
          setIsAnalyzing(false);
          setNeedsHighlight(false);
          return;
        }
        mutationsRef.current = applyHighlightsToDom(
          container,
          ranges,
          isDarkRef.current,
        );
        analyzedContentRef.current = content;
        setHighlightRanges(ranges);
        setIsAnalyzing(false);
        setNeedsHighlight(false);

        // 单趟统计关键词命中与本地命中，替代两次 filter 的 O(2*ranges) 扫描
        let keywordHits = 0;
        let localHits = 0;
        const importanceBreakdown: Record<number, number> = {};
        ranges.forEach((r) => {
          if (r.category) keywordHits++;
          else localHits++;
          const imp = r.importance || 0;
          importanceBreakdown[imp] = (importanceBreakdown[imp] || 0) + 1;
        });
        setHighlightStats({ keywordHits, localHits, importanceBreakdown });
      };

      if (keywords && keywords.length > 0) {
        finishHighlight(analyzeKeywords(plainText, keywords));
      } else if (onAnalyze) {
        onAnalyze(plainText).then(finishHighlight);
      } else {
        finishHighlight(analyzeTextLocally(plainText, highlightIntensity, patterns));
      }
    });

    return () => {
      cancelled = true;
      cancelAnimationFrame(rafId);
    };
  }, [needsHighlight, highlightIntensity, keywords, onAnalyze, patterns, content]);

  useEffect(() => {
    const container = contentRef.current;
    if (!container) return;

    const handleMouseOver = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (target.dataset?.reason) {
        setHoveredReason(target.dataset.reason);
        setTooltipPosition({ x: e.clientX, y: e.clientY });
      }
    };

    const handleMouseOut = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (target.dataset?.reason) {
        setHoveredReason(null);
      }
    };

    container.addEventListener("mouseover", handleMouseOver);
    container.addEventListener("mouseout", handleMouseOut);

    return () => {
      container.removeEventListener("mouseover", handleMouseOver);
      container.removeEventListener("mouseout", handleMouseOut);
    };
  }, [highlightEnabled, highlightRanges]);

  useEffect(() => {
    const container = contentRef.current;
    if (!container || !onKeywordClick) return;

    const handleHighlightClick = (e: Event) => {
      const customEvent = e as CustomEvent<{
        term: string;
        importance: number;
        category: string;
        explanation: string;
      }>;
      onKeywordClick(customEvent.detail);
    };

    container.addEventListener("highlight-click", handleHighlightClick);

    return () => {
      container.removeEventListener("highlight-click", handleHighlightClick);
    };
  }, [onKeywordClick]);

  const safePosition = calculateTooltipPosition(tooltipPosition.x, tooltipPosition.y);

  // Reading appearance. When explicit reading settings are provided (article
  // reader) we control width, font size, family, line height and theme here;
  // otherwise keep the original prose-sm/prose-lg default sizing.
  const sizingClass =
    fontSize === undefined ? (isMobile ? "prose-sm" : "prose-lg") : "";
  const widthClass =
    contentWidthMode === "full"
      ? "max-w-none"
      : contentWidthMode === "narrow"
        ? "max-w-3xl mx-auto"
        : contentWidthMode === "comfortable"
          ? "max-w-4xl mx-auto"
          : "max-w-3xl mx-auto";

  let themeVars: ProseStyleVars | undefined;
  if (readingMode === "eye-care") {
    // 护眼模式在暗色主题下换用深墨绿背景，文字需切换为浅绿系以保持对比度
    themeVars = isDark
      ? {
          "--tw-prose-body": "#cfe8d9",
          "--tw-prose-headings": "#e6f2ea",
          "--tw-prose-links": "#6ee7b7",
          "--tw-prose-bold": "#f0faf4",
          "--tw-prose-quotes": "#cfe8d9",
          "--tw-prose-quote-borders": "#2e4a3a",
          "--tw-prose-counters": "#8fb69f",
          "--tw-prose-bullets": "#8fb69f",
          "--tw-prose-hr": "#24402f",
          "--tw-prose-th-borders": "#2e4a3a",
          "--tw-prose-td-borders": "#1f382b",
          "--tw-prose-code": "#e6f2ea",
        }
      : {
          "--tw-prose-body": "#1f2937",
          "--tw-prose-headings": "#111827",
          "--tw-prose-links": "#1d4ed8",
          "--tw-prose-bold": "#111827",
          "--tw-prose-quotes": "#111827",
          "--tw-prose-counters": "#4b5563",
          "--tw-prose-bullets": "#4b5563",
        };
  } else if (readingMode === "sepia") {
    // 羊皮纸模式在暗色主题下换用深褐背景，文字切换为浅驼色系
    themeVars = isDark
      ? {
          "--tw-prose-body": "#e3d3bd",
          "--tw-prose-headings": "#f3e8d5",
          "--tw-prose-links": "#e0b98f",
          "--tw-prose-bold": "#faf3e5",
          "--tw-prose-quotes": "#e3d3bd",
          "--tw-prose-quote-borders": "#5a4632",
          "--tw-prose-counters": "#bd9e7b",
          "--tw-prose-bullets": "#bd9e7b",
          "--tw-prose-hr": "#4a3826",
          "--tw-prose-th-borders": "#5a4632",
          "--tw-prose-td-borders": "#3a2c1c",
          "--tw-prose-code": "#faf3e5",
        }
      : {
          "--tw-prose-body": "#433422",
          "--tw-prose-headings": "#292018",
          "--tw-prose-links": "#9a3412",
          "--tw-prose-bold": "#292018",
          "--tw-prose-quotes": "#292018",
          "--tw-prose-counters": "#6b5d4a",
          "--tw-prose-bullets": "#6b5d4a",
        };
  } else if (isDark) {
    // Default reading mode on dark theme: prose-indigo ships light-tokens
    // only, so headings/quotes/bold/links would stay dark and become
    // invisible on a deep-slate background. Override them explicitly so
    // every markdown element keeps WCAG AA contrast in dark mode.
    themeVars = {
      "--tw-prose-body": "#e5e7eb",
      "--tw-prose-headings": "#f9fafb",
      "--tw-prose-links": "#a5b4fc",
      "--tw-prose-bold": "#f9fafb",
      "--tw-prose-quotes": "#e5e7eb",
      "--tw-prose-quote-borders": "#475569",
      "--tw-prose-counters": "#94a3b8",
      "--tw-prose-bullets": "#94a3b8",
      "--tw-prose-hr": "#334155",
      "--tw-prose-th-borders": "#475569",
      "--tw-prose-td-borders": "#334155",
      "--tw-prose-code": "#f9fafb",
    };
  }

  const resolvedFontFamily =
    fontFamily !== undefined
      ? resolveFontFamily(fontFamily, "reading")
      : undefined;
  const lineHeightClass =
    lineHeight === "compact"
      ? "[&_p]:!leading-snug [&_li]:!leading-snug [&_blockquote]:!leading-snug"
      : lineHeight === "relaxed"
        ? "[&_p]:!leading-loose [&_li]:!leading-loose [&_blockquote]:!leading-loose"
        : "";

  const bodyStyle: ProseStyleVars = {
    ...(fontSize !== undefined ? { fontSize } : {}),
    ...(resolvedFontFamily !== undefined
      ? { fontFamily: resolvedFontFamily }
      : {}),
    ...(themeVars ?? {}),
  };

  return (
    <div className="relative">
      {highlightEnabled && (
        <div className="flex items-center gap-2 mb-3 text-xs text-gray-500">
          {isAnalyzing ? (
            <>
              <Loader2 size={12} className="animate-spin text-yellow-500" />
              <span>{t("learning.highlightedReader.analyzing")}</span>
            </>
          ) : highlightStats ? (
            <>
              <Sparkles size={12} className="text-yellow-500" />
              <span>
                {t("learning.highlightedReader.statsFormat", { keywordHits: highlightStats.keywordHits, localHits: highlightStats.localHits })}
                {Object.entries(highlightStats.importanceBreakdown)
                  .sort(([a], [b]) => Number(b) - Number(a))
                  .map(([imp, count]) => ` | ★${imp}:${count}`)
                  .join("")}
              </span>
            </>
          ) : highlightRanges.length > 0 ? (
            <>
              <Sparkles size={12} className="text-yellow-500" />
              <span>{t("learning.highlightedReader.identifiedCount", { count: highlightRanges.length })}</span>
            </>
          ) : null}
        </div>
      )}

      <div
        ref={contentRef}
        className={`prose prose-indigo ${sizingClass} ${widthClass} ${lineHeightClass} ${
          // 暗色主题下默认/护眼/羊皮纸三种模式均为深色背景，统一用浅色文字兜底；
          // 具体 markdown 元素颜色由 themeVars 按模式分别覆盖以保持对比度。
          isDark
            ? "dark:text-gray-200 text-gray-200"
            : "text-gray-800"
        }`}
        style={bodyStyle}
      >
        <HighlightDomGuard
          contentRef={contentRef}
          mutationsRef={mutationsRef}
          onRestored={handleDomRestored}
        >
          <ReactMarkdown
            remarkPlugins={[remarkGfm, remarkMath]}
            rehypePlugins={[[rehypeKatex, { output: "html" }]]}
            components={{
              code: ({ className, children, node: _node }) => (
                <CodeBlock className={className} isDark={isDark} node={_node}>
                  {children}
                </CodeBlock>
              ),
              a: ({ node: _node, ...props }) => {
                const { href, children } = props;
                if (href && href.startsWith("term:")) {
                  const explanation = href.replace("term:", "");
                  return (
                    <TermTooltip
                      term={String(children)}
                      explanation={decodeURIComponent(explanation)}
                    />
                  );
                }
                return (
                  <a
                    {...props}
                    className="text-primary-600 underline"
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={props.href}
                  >
                    {props.href}
                  </a>
                );
              },
            }}
          >
            {preprocessMarkdown(content)}
          </ReactMarkdown>
        </HighlightDomGuard>
      </div>

      <AnimatePresence>
        {hoveredReason && (
          <motion.div
            initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 5 }}
            animate={reduceMotion ? { opacity: 1 } : { opacity: 1, y: 0 }}
            exit={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 5 }}
            transition={transitionOverride}
            className="fixed z-50 px-3 py-2 bg-gray-900 text-white text-xs rounded-lg shadow-lg max-w-xs pointer-events-none"
            style={{
              left: safePosition.left,
              top: safePosition.top,
              transform: safePosition.transform,
            }}
          >
            <div className="flex items-start gap-2">
              <Info
                size={14}
                className="text-yellow-400 flex-shrink-0 mt-0.5"
              />
              <span>{hoveredReason}</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
