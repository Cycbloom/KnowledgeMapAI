import React, { useState, useEffect, useRef, useMemo } from "react";
import { useTranslation } from "react-i18next";
import ReactMarkdown, { type Components } from "react-markdown";
import { debounce } from "@/utils/performanceUtils";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
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

// 提取用于高亮分析的纯文本。跳过的区域必须与 React 侧 transform 的跳过规则
// 完全一致（pre/code、KaTeX、data-highlight-ignore 包裹的自定义组件），否则
// 文本偏移会错位。NodeFilter.FILTER_REJECT 会连同整个子树一起跳过。
const extractDomPlainText = (container: HTMLElement): string => {
  const walker = document.createTreeWalker(
    container,
    NodeFilter.SHOW_ALL,
    {
      acceptNode: (node) => {
        if (node.nodeType === Node.TEXT_NODE) return NodeFilter.FILTER_ACCEPT;
        if (node.nodeType === Node.ELEMENT_NODE) {
          const el = node as Element;
          if (
            el.tagName === "PRE" ||
            el.tagName === "CODE" ||
            el.hasAttribute("data-highlight-ignore") ||
            (typeof el.className === "string" &&
              el.className.includes("katex"))
          ) {
            return NodeFilter.FILTER_REJECT;
          }
          return NodeFilter.FILTER_SKIP;
        }
        return NodeFilter.FILTER_SKIP;
      },
    },
  );
  let text = "";
  let node: Node | null;
  while ((node = walker.nextNode())) {
    if (node.nodeType === Node.TEXT_NODE) {
      text += node.textContent || "";
    }
  }
  return text;
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

const splitTextByRanges = (
  text: string,
  ranges: HighlightRange[],
  startOffset: number,
): Array<{ text: string; highlight: boolean; range?: HighlightRange }> => {
  const parts: Array<{
    text: string;
    highlight: boolean;
    range?: HighlightRange;
  }> = [];
  let pos = 0;

  ranges.forEach((range) => {
    const highlightStart = Math.max(0, range.start - startOffset);
    const highlightEnd = Math.min(text.length, range.end - startOffset);

    if (highlightStart >= highlightEnd) return;

    if (highlightStart > pos) {
      parts.push({ text: text.slice(pos, highlightStart), highlight: false });
    }

    const highlighted = text
      .slice(highlightStart, highlightEnd)
      .replace(/\n/g, " ");
    if (highlighted.trim()) {
      parts.push({ text: highlighted, highlight: true, range });
    } else {
      parts.push({ text: highlighted, highlight: false });
    }

    pos = highlightEnd;
  });

  if (pos < text.length) {
    parts.push({ text: text.slice(pos), highlight: false });
  }

  return parts;
};

// Highlights are rendered through React instead of mutating the DOM directly.
// The previous implementation walked the rendered DOM and replaceChild'd text
// nodes with <span data-highlight> elements. That detached React-owned nodes
// from their parents, so when React later reconciled/deleted them (e.g. on
// content change) it threw "NotFoundError: Failed to execute 'removeChild' on
// 'Node': The node to be removed is not a child of this node". Transforming
// the React element tree keeps the virtual DOM in sync with the real DOM.
const transformHighlightedTree = (
  node: React.ReactNode,
  ranges: HighlightRange[],
  rangeIndexMap: Map<HighlightRange, number>,
  state: { offset: number },
  isDark?: boolean,
): React.ReactNode => {
  if (typeof node === "string" || typeof node === "number") {
    const text = String(node);
    const startOffset = state.offset;
    state.offset += text.length;

    const parts = splitTextByRanges(text, ranges, startOffset);
    if (parts.every((p) => !p.highlight)) return text;

    return parts.map((part, i) => {
      if (!part.highlight || !part.range) return part.text;
      const { range } = part;
      return (
        <span
          key={`hl-${startOffset}-${i}`}
          data-highlight="true"
          data-reason={range.reason}
          data-range-index={rangeIndexMap.get(range) ?? -1}
          data-importance={
            range.importance ? String(range.importance) : undefined
          }
          data-category={range.category}
          className={getHighlightClassName(range.importance, isDark)}
          onClick={(e) => {
            if (!range.category) return;
            const event = new CustomEvent("highlight-click", {
              bubbles: true,
              detail: {
                term: part.text,
                importance: range.importance,
                category: range.category,
                explanation: range.reason,
              },
            });
            e.currentTarget.dispatchEvent(event);
          }}
        >
          {part.text}
        </span>
      );
    });
  }

  if (Array.isArray(node)) {
    return node.map((child) =>
      transformHighlightedTree(child, ranges, rangeIndexMap, state, isDark),
    );
  }

  if (React.isValidElement(node)) {
    if (typeof node.type !== "string") {
      // Custom React components (CodeBlock, TermTooltip, ...) manage their own
      // internals — leave untouched to avoid breaking them.
      return node;
    }
    const tag = node.type;
    const className = (node.props as { className?: string }).className;
    if (
      tag === "pre" ||
      tag === "code" ||
      tag === "svg" ||
      tag === "math" ||
      (typeof className === "string" && className.includes("katex"))
    ) {
      return node;
    }
    const children = (node.props as { children?: React.ReactNode }).children;
    if (children == null) return node;
    return React.cloneElement(
      node,
      undefined,
      transformHighlightedTree(children, ranges, rangeIndexMap, state, isDark),
    );
  }

  return node;
};

const HighlightedBody: React.FC<{
  content: string;
  ranges: HighlightRange[];
  isDark: boolean;
}> = ({ content, ranges, isDark }) => {
  const rangeIndexMap = useMemo(() => {
    const map = new Map<HighlightRange, number>();
    ranges.forEach((r, i) => {
      map.set(r, i);
    });
    return map;
  }, [ranges]);
  // 每个渲染周期独立创建；块级 override 按文档顺序同步推进 offset
  const state = { offset: 0 };

  const transform = (children: React.ReactNode) =>
    transformHighlightedTree(children, ranges, rangeIndexMap, state, isDark);

  const SplitBlock: React.FC<{
    tag: string;
    node?: unknown;
    children?: React.ReactNode;
    [key: string]: unknown;
  }> = ({ tag, node: _node, children, ...props }) =>
    React.createElement(tag, props, transform(children));

  const components: Components = {
    p: (props) => <SplitBlock tag="p" {...props} />,
    li: (props) => <SplitBlock tag="li" {...props} />,
    h1: (props) => <SplitBlock tag="h1" {...props} />,
    h2: (props) => <SplitBlock tag="h2" {...props} />,
    h3: (props) => <SplitBlock tag="h3" {...props} />,
    h4: (props) => <SplitBlock tag="h4" {...props} />,
    h5: (props) => <SplitBlock tag="h5" {...props} />,
    h6: (props) => <SplitBlock tag="h6" {...props} />,
    blockquote: (props) => <SplitBlock tag="blockquote" {...props} />,
    td: (props) => <SplitBlock tag="td" {...props} />,
    th: (props) => <SplitBlock tag="th" {...props} />,
    figcaption: (props) => <SplitBlock tag="figcaption" {...props} />,
    code: ({ className, children, node: _node }) => (
      <span data-highlight-ignore style={{ display: "contents" }}>
        <CodeBlock className={className} isDark={isDark} node={_node}>
          {children}
        </CodeBlock>
      </span>
    ),
    a: ({ node: _node, ...props }) => {
      const { href, children } = props;
      if (href && href.startsWith("term:")) {
        return (
          <span data-highlight-ignore style={{ display: "contents" }}>
            <TermTooltip
              term={String(children)}
              explanation={decodeURIComponent(href.replace("term:", ""))}
            />
          </span>
        );
      }
      return (
        <SplitBlock
          tag="a"
          href={href}
          className="text-primary-600 underline"
          target="_blank"
          rel="noopener noreferrer"
          aria-label={href}
        >
          {children}
        </SplitBlock>
      );
    },
  };

  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm, remarkMath]}
      rehypePlugins={[[rehypeKatex, { output: "html" }]]}
      components={components}
    >
      {preprocessMarkdown(content)}
    </ReactMarkdown>
  );
};

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
  const debouncedSetNeedsHighlight = useMemo(
    () =>
      debounce(() => {
        setNeedsHighlight(true);
        setIsAnalyzing(true);
      }, 300),
    [],
  );

  useEffect(() => {
    // Content/keywords/intensity changed → previously computed ranges no longer
    // map onto the freshly rendered text. Clear them immediately (the debounced
    // re-analysis re-applies correct ranges) so stale highlights never render.
    setHighlightRanges([]);
    setHighlightStats(null);
    if (highlightEnabled && content) {
      debouncedSetNeedsHighlight();
    } else {
      debouncedSetNeedsHighlight.cancel();
      setIsAnalyzing(false);
      setNeedsHighlight(false);
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
      const plainText = extractDomPlainText(container);
      if (!plainText) {
        setHighlightRanges([]);
        setIsAnalyzing(false);
        setNeedsHighlight(false);
        return;
      }

      const finishHighlight = (ranges: HighlightRange[]) => {
        if (cancelled) return;
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
  }, [needsHighlight, highlightIntensity, keywords, onAnalyze, isDark, patterns]);

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
        <HighlightedBody content={content} ranges={highlightRanges} isDark={isDark} />
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
