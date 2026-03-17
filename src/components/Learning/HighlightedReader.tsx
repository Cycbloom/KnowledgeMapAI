import React, { useState, useEffect, useMemo, useCallback } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, Highlighter, Loader2, Info } from 'lucide-react';
import { CodeBlock, TermTooltip } from '../common';
import { preprocessMarkdown } from '../../utils/markdownUtils';
import { useFocusStore } from '../../store/useFocusStore';

interface HighlightSegment {
  text: string;
  isHighlight: boolean;
  reason?: string;
  startIndex: number;
  endIndex: number;
}

interface HighlightedReaderProps {
  content: string;
  isDark: boolean;
  isMobile: boolean;
  onAnalyze?: (content: string) => Promise<HighlightSegment[]>;
}

const analyzeTextLocally = (content: string, intensity: number): HighlightSegment[] => {
  const segments: HighlightSegment[] = [];
  const patterns = [
    { regex: /【[^】]+】/g, reason: '关键术语' },
    { regex: /「[^」]+」/g, reason: '重要概念' },
    { regex: /\*\*[^*]+\*\*/g, reason: '加粗内容' },
    { regex: /第[一二三四五六七八九十]+[章节]/g, reason: '章节标题' },
    { regex: /[一二三四五六七八九十]+[、.．][^。\n]{1,30}/g, reason: '要点列举' },
    { regex: /\d+[、.．][^。\n]{1,30}/g, reason: '编号要点' },
    { regex: /关键[是在于：:][^。\n]{1,50}/g, reason: '关键论述' },
    { regex: /重要[的是：:][^。\n]{1,50}/g, reason: '重要说明' },
    { regex: /注意[：:][^。\n]{1,50}/g, reason: '注意事项' },
    { regex: /定义[是为：:][^。\n]{1,80}/g, reason: '定义说明' },
    { regex: /总结[：:][^。\n]{1,100}/g, reason: '总结要点' },
    { regex: /核心[概念是：:][^。\n]{1,50}/g, reason: '核心概念' },
  ];

  const highlights: { start: number; end: number; reason: string }[] = [];
  
  patterns.forEach(({ regex, reason }) => {
    let match;
    const globalRegex = new RegExp(regex.source, regex.flags);
    while ((match = globalRegex.exec(content)) !== null) {
      const shouldInclude = Math.random() < intensity;
      if (shouldInclude) {
        highlights.push({
          start: match.index,
          end: match.index + match[0].length,
          reason
        });
      }
    }
  });

  highlights.sort((a, b) => a.start - b.start);

  const mergedHighlights: { start: number; end: number; reason: string }[] = [];
  highlights.forEach(h => {
    const last = mergedHighlights[mergedHighlights.length - 1];
    if (last && h.start <= last.end) {
      last.end = Math.max(last.end, h.end);
      last.reason = `${last.reason}, ${h.reason}`;
    } else {
      mergedHighlights.push({ ...h });
    }
  });

  let lastIndex = 0;
  mergedHighlights.forEach(h => {
    if (h.start > lastIndex) {
      segments.push({
        text: content.slice(lastIndex, h.start),
        isHighlight: false,
        startIndex: lastIndex,
        endIndex: h.start
      });
    }
    segments.push({
      text: content.slice(h.start, h.end),
      isHighlight: true,
      reason: h.reason,
      startIndex: h.start,
      endIndex: h.end
    });
    lastIndex = h.end;
  });

  if (lastIndex < content.length) {
    segments.push({
      text: content.slice(lastIndex),
      isHighlight: false,
      startIndex: lastIndex,
      endIndex: content.length
    });
  }

  return segments;
};

export const HighlightedReader: React.FC<HighlightedReaderProps> = ({
  content,
  isDark,
  isMobile,
  onAnalyze
}) => {
  const { highlightEnabled, highlightIntensity, setHighlightEnabled, setHighlightIntensity } = useFocusStore();
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [segments, setSegments] = useState<HighlightSegment[]>([]);
  const [hoveredSegment, setHoveredSegment] = useState<HighlightSegment | null>(null);
  const [tooltipPosition, setTooltipPosition] = useState({ x: 0, y: 0 });

  useEffect(() => {
    if (highlightEnabled && content) {
      setIsAnalyzing(true);
      setTimeout(() => {
        const result = onAnalyze 
          ? onAnalyze(content)
          : Promise.resolve(analyzeTextLocally(content, highlightIntensity));
        
        result.then(segs => {
          setSegments(segs);
          setIsAnalyzing(false);
        });
      }, 100);
    } else {
      setSegments([]);
    }
  }, [content, highlightEnabled, highlightIntensity, onAnalyze]);

  const handleMouseMove = useCallback((e: React.MouseEvent, segment: HighlightSegment) => {
    if (segment.isHighlight && segment.reason) {
      setHoveredSegment(segment);
      setTooltipPosition({ x: e.clientX, y: e.clientY });
    }
  }, []);

  const handleMouseLeave = useCallback(() => {
    setHoveredSegment(null);
  }, []);

  const renderContent = useMemo(() => {
    if (!highlightEnabled || segments.length === 0) {
      return (
        <ReactMarkdown
          remarkPlugins={[remarkGfm, remarkMath]}
          rehypePlugins={[[rehypeKatex, { output: 'html' }]]}
          components={{
            code: ({ className, children, node: _node }) => (
              <CodeBlock className={className} isDark={isDark} node={_node}>
                {children}
              </CodeBlock>
            ),
            a: ({ node: _node, ...props }) => {
              const { href, children } = props;
              if (href && href.startsWith('term:')) {
                const explanation = href.replace('term:', '');
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
      );
    }

    return (
      <div className="relative">
        {segments.map((segment, index) => (
          <span
            key={index}
            className={`${segment.isHighlight 
              ? `bg-yellow-100 dark:bg-yellow-900/30 border-b-2 border-yellow-400 dark:border-yellow-500 cursor-help transition-all duration-200 hover:bg-yellow-200 dark:hover:bg-yellow-900/50` 
              : ''}`}
            onMouseMove={(e) => handleMouseMove(e, segment)}
            onMouseLeave={handleMouseLeave}
          >
            {segment.text}
          </span>
        ))}
      </div>
    );
  }, [content, highlightEnabled, segments, isDark, handleMouseMove, handleMouseLeave]);

  return (
    <div className="relative">
      <div className="flex items-center justify-between mb-4 sticky top-0 z-10 bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm py-2 px-3 rounded-lg border border-gray-100 dark:border-slate-700">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setHighlightEnabled(!highlightEnabled)}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
              highlightEnabled
                ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/50 dark:text-yellow-300'
                : 'bg-gray-100 text-gray-600 dark:bg-slate-700 dark:text-slate-300 hover:bg-gray-200 dark:hover:bg-slate-600'
            }`}
          >
            <Highlighter size={16} />
            智能高亮
          </button>
          
          {highlightEnabled && (
            <motion.div
              initial={{ opacity: 0, width: 0 }}
              animate={{ opacity: 1, width: 'auto' }}
              exit={{ opacity: 0, width: 0 }}
              className="flex items-center gap-2"
            >
              <span className="text-xs text-gray-500 dark:text-slate-400">强度</span>
              <input
                type="range"
                min="0.1"
                max="1"
                step="0.1"
                value={highlightIntensity}
                onChange={(e) => setHighlightIntensity(parseFloat(e.target.value))}
                className="w-20 h-1.5 bg-gray-200 dark:bg-slate-600 rounded-full appearance-none cursor-pointer accent-yellow-500"
              />
              <span className="text-xs text-gray-500 dark:text-slate-400 w-8">
                {Math.round(highlightIntensity * 100)}%
              </span>
            </motion.div>
          )}
        </div>
        
        {isAnalyzing && (
          <div className="flex items-center gap-2 text-sm text-yellow-600 dark:text-yellow-400">
            <Loader2 size={14} className="animate-spin" />
            <span>分析中...</span>
          </div>
        )}
        
        {highlightEnabled && !isAnalyzing && segments.filter(s => s.isHighlight).length > 0 && (
          <div className="flex items-center gap-1 text-xs text-gray-500 dark:text-slate-400">
            <Sparkles size={12} className="text-yellow-500" />
            已识别 {segments.filter(s => s.isHighlight).length} 处重点
          </div>
        )}
      </div>

      <div className={`max-w-3xl mx-auto prose ${isMobile ? 'prose-sm' : 'prose-lg'} dark:prose-invert prose-indigo ${isDark ? 'text-slate-50' : 'text-gray-900'}`}>
        <div className={isMobile ? 'leading-relaxed space-y-4' : ''}>
          {renderContent}
        </div>
      </div>

      <AnimatePresence>
        {hoveredSegment && hoveredSegment.reason && (
          <motion.div
            initial={{ opacity: 0, y: 5 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 5 }}
            className="fixed z-50 px-3 py-2 bg-gray-900 dark:bg-slate-700 text-white text-xs rounded-lg shadow-lg max-w-xs pointer-events-none"
            style={{
              left: tooltipPosition.x + 10,
              top: tooltipPosition.y - 30,
              transform: 'translateY(-100%)'
            }}
          >
            <div className="flex items-start gap-2">
              <Info size={14} className="text-yellow-400 flex-shrink-0 mt-0.5" />
              <span>{hoveredSegment.reason}</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
