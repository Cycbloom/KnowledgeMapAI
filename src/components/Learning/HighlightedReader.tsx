import React, { useState, useEffect, useRef } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import { motion, AnimatePresence } from "framer-motion";
import { Sparkles, Loader2, Info } from "lucide-react";
import { CodeBlock, TermTooltip } from "../common";
import { preprocessMarkdown } from "../../utils/markdownUtils";
import { useFocusStore } from "../../store/useFocusStore";

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
}

const analyzeTextLocally = (
  content: string,
  intensity: number,
): HighlightRange[] => {
  const highlights: HighlightRange[] = [];
  const patterns = [
    { regex: /【[^】]+】/g, reason: "关键术语" },
    { regex: /「[^」]+」/g, reason: "重要概念" },
    { regex: /第[一二三四五六七八九十]+[章节][^\n]*/g, reason: "章节标题" },
    {
      regex: /[一二三四五六七八九十]+[、.．][^。\n]{1,30}/g,
      reason: "要点列举",
    },
    { regex: /\d+[、.．][^。\n]{1,30}/g, reason: "编号要点" },
    { regex: /关键[是在于：:][^。\n]{1,50}/g, reason: "关键论述" },
    { regex: /重要[的是：:][^。\n]{1,50}/g, reason: "重要说明" },
    { regex: /注意[：:][^。\n]{1,50}/g, reason: "注意事项" },
    { regex: /定义[是为：:][^。\n]{1,80}/g, reason: "定义说明" },
    { regex: /总结[：:][^。\n]{1,100}/g, reason: "总结要点" },
    { regex: /核心[概念是：:][^。\n]{1,50}/g, reason: "核心概念" },
  ];

  patterns.forEach(({ regex, reason }) => {
    let match;
    const globalRegex = new RegExp(regex.source, regex.flags);
    while ((match = globalRegex.exec(content)) !== null) {
      if (Math.random() < intensity) {
        highlights.push({
          start: match.index,
          end: match.index + match[0].length,
          reason,
        });
      }
    }
  });

  highlights.sort((a, b) => a.start - b.start);

  const merged: HighlightRange[] = [];
  highlights.forEach((h) => {
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

const getHighlightClassName = (importance?: number): string => {
  const baseClasses =
    "cursor-help transition-all duration-200 rounded px-0.5 border-b-2";

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
      bg: "bg-cyan-100",
      border: "border-cyan-400",
      hover: "hover:bg-cyan-200",
    },
  };

  const colors = colorMap[importance] || colorMap[3];
  return `${baseClasses} ${colors.bg} ${colors.border} ${colors.hover}`;
};

export const HighlightedReader: React.FC<HighlightedReaderProps> = ({
  content,
  isDark,
  isMobile,
  onAnalyze,
  keywords,
}) => {
  const { highlightEnabled, highlightIntensity } = useFocusStore();
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [highlightRanges, setHighlightRanges] = useState<HighlightRange[]>([]);
  const [hoveredReason, setHoveredReason] = useState<string | null>(null);
  const [tooltipPosition, setTooltipPosition] = useState({ x: 0, y: 0 });
  const contentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (highlightEnabled && content) {
      setIsAnalyzing(true);
      setTimeout(() => {
        let result: Promise<HighlightRange[]>;

        if (keywords && keywords.length > 0) {
          result = Promise.resolve(analyzeKeywords(content, keywords));
        } else if (onAnalyze) {
          result = onAnalyze(content);
        } else {
          result = Promise.resolve(
            analyzeTextLocally(content, highlightIntensity),
          );
        }

        result.then((ranges) => {
          setHighlightRanges(ranges);
          setIsAnalyzing(false);
        });
      }, 100);
    } else {
      setHighlightRanges([]);
    }
  }, [content, highlightEnabled, highlightIntensity, onAnalyze, keywords]);

  useEffect(() => {
    if (
      !highlightEnabled ||
      highlightRanges.length === 0 ||
      !contentRef.current
    ) {
      return;
    }

    const container = contentRef.current;
    const walker = document.createTreeWalker(
      container,
      NodeFilter.SHOW_TEXT,
      null,
    );

    const textNodes: { node: Text; start: number; end: number }[] = [];
    let currentOffset = 0;

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

    highlightRanges.forEach((range, rangeIndex) => {
      textNodes.forEach(({ node, start, end }) => {
        if (start >= range.end || end <= range.start) return;

        const text = node.textContent || "";
        const highlightStart = Math.max(0, range.start - start);
        const highlightEnd = Math.min(text.length, range.end - start);

        if (highlightStart >= highlightEnd) return;

        const before = text.slice(0, highlightStart);
        let highlighted = text.slice(highlightStart, highlightEnd);
        const after = text.slice(highlightEnd);

        if (!highlighted.trim()) return;

        highlighted = highlighted.replace(/\n/g, " ");

        const span = document.createElement("span");
        span.className = getHighlightClassName(range.importance);
        span.dataset.reason = range.reason;
        span.dataset.rangeIndex = String(rangeIndex);
        if (range.importance) {
          span.dataset.importance = String(range.importance);
        }
        if (range.category) {
          span.dataset.category = range.category;
        }
        span.textContent = highlighted;

        const parent = node.parentNode;
        if (!parent) return;

        const fragment = document.createDocumentFragment();
        if (before) fragment.appendChild(document.createTextNode(before));
        fragment.appendChild(span);
        if (after) fragment.appendChild(document.createTextNode(after));

        parent.replaceChild(fragment, node);
      });
    });

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

  return (
    <div className="relative">
      {highlightEnabled && (
        <div className="flex items-center gap-2 mb-3 text-xs text-gray-500">
          {isAnalyzing ? (
            <>
              <Loader2 size={12} className="animate-spin text-yellow-500" />
              <span>分析中...</span>
            </>
          ) : highlightRanges.length > 0 ? (
            <>
              <Sparkles size={12} className="text-yellow-500" />
              <span>已识别 {highlightRanges.length} 处重点</span>
            </>
          ) : null}
        </div>
      )}

      <div
        ref={contentRef}
        className={`max-w-3xl mx-auto prose ${isMobile ? "prose-sm" : "prose-lg"} prose-indigo text-gray-800`}
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
                  className="text-blue-600 hover:underline"
                  target="_blank"
                  rel="noopener noreferrer"
                />
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
            initial={{ opacity: 0, y: 5 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 5 }}
            className="fixed z-50 px-3 py-2 bg-gray-900 text-white text-xs rounded-lg shadow-lg max-w-xs pointer-events-none"
            style={{
              left: tooltipPosition.x + 10,
              top: tooltipPosition.y - 10,
              transform: "translateY(-100%)",
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
