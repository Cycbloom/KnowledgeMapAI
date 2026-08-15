import React, { useState, useEffect, useRef, useMemo } from "react";
import { useTranslation } from "react-i18next";
import ReactMarkdown from "react-markdown";
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
}

const cleanupHighlights = (container: HTMLElement) => {
  const highlights = container.querySelectorAll('span[data-highlight="true"]');
  highlights.forEach((span) => {
    const text = document.createTextNode(span.textContent || "");
    span.parentNode?.replaceChild(text, span);
  });
  container.normalize();
};

const extractDomPlainText = (container: HTMLElement): string => {
  const walker = document.createTreeWalker(
    container,
    NodeFilter.SHOW_TEXT,
    null,
  );
  let text = "";
  let node: Text | null;
  while ((node = walker.nextNode() as Text)) {
    text += node.textContent || "";
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
    const regex = new RegExp(escapedTerm, "g");
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
  const baseClasses =
    "cursor-help transition-all duration-200 rounded px-0.5 border-b-2";

  if (isDark) {
    if (!importance) {
      return `${baseClasses} bg-yellow-500/20 border-orange-400 hover:bg-yellow-500/40`;
    }

    const darkColorMap: Record<
      number,
      { bg: string; border: string; hover: string }
    > = {
      5: {
        bg: "bg-amber-500/30",
        border: "border-amber-400",
        hover: "hover:bg-amber-500/50",
      },
      4: {
        bg: "bg-yellow-500/20",
        border: "border-yellow-400",
        hover: "hover:bg-yellow-500/40",
      },
      3: {
        bg: "bg-lime-500/20",
        border: "border-lime-400",
        hover: "hover:bg-lime-500/40",
      },
      2: {
        bg: "bg-emerald-500/20",
        border: "border-emerald-400",
        hover: "hover:bg-emerald-500/40",
      },
      1: {
        bg: "bg-primary-500/20",
        border: "border-primary-400",
        hover: "hover:bg-primary-500/40",
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
) => {
  if (ranges.length === 0) return;

  const walker = document.createTreeWalker(
    container,
    NodeFilter.SHOW_TEXT,
    null,
  );

  const textNodes: { node: Text; start: number; end: number }[] = [];
  let currentOffset = 0;

  // 预构建 range -> 下标 映射，避免给每个高亮片段重复线性 range.indexOf（原为 O(relevantRanges*ranges)）
  const rangeIndexMap = new Map<HighlightRange, number>();
  ranges.forEach((r, i) => {
    rangeIndexMap.set(r, i);
  });

  let node: Text | null;
  while ((node = walker.nextNode() as Text)) {
    const length = node.textContent?.length || 0;
    textNodes.push({
      node,
      start: currentOffset,
      end: currentOffset + length,
    });
    currentOffset += length;
  }

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

    parent.replaceChild(fragment, node);
  });
};

export const HighlightedReader: React.FC<HighlightedReaderProps> = ({
  content,
  isDark,
  isMobile,
  onAnalyze,
  keywords,
  onKeywordClick,
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
    if (highlightEnabled && content) {
      debouncedSetNeedsHighlight();
    } else {
      debouncedSetNeedsHighlight.cancel();
      setHighlightRanges([]);
      setIsAnalyzing(false);
      setNeedsHighlight(false);
      setHighlightStats(null);
      if (contentRef.current) {
        cleanupHighlights(contentRef.current);
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
      cleanupHighlights(container);

      const plainText = extractDomPlainText(container);
      if (!plainText) {
        setHighlightRanges([]);
        setIsAnalyzing(false);
        setNeedsHighlight(false);
        return;
      }

      const finishHighlight = (ranges: HighlightRange[]) => {
        if (cancelled) return;
        applyHighlightsToDom(container, ranges, isDark);
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
        className={`max-w-3xl mx-auto prose ${isMobile ? "prose-sm" : "prose-lg"} prose-indigo ${isDark ? "dark:text-gray-200 text-gray-200" : "text-gray-800"}`}
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
