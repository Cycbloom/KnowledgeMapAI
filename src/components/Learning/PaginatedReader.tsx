import React, { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { motion, useAnimate } from "framer-motion";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useReducedMotionOrPreference } from "@/hooks/common/useReducedMotionOrPreference";

interface PaginatedReaderProps {
  /** 文章内容（HighlightedReader 卡片）。必须是单份、跨页稳定的 React 元素——高亮靠单树命令式 DOM，禁止克隆。 */
  children: React.ReactNode;
  /** 底部固定工具条预留高度（px，含安全区），末页不因工具条遮挡。 */
  bottomOffset: number;
  /** 阅读区容器自己的 class（如 "flex-1 min-h-0"）。 */
  className?: string;
}

const SWIPE_THRESHOLD = 60;
/** 平滑滑动缓动曲线（接近 iOS 分页器的 feel） */
const EASE: [number, number, number, number] = [0.32, 0.72, 0, 1];
const FLIP_DURATION = 0.28;

/**
 * 移动端分页/翻页阅读器：内容按一屏高度切成多页（单份内容，translateY 定位）。
 * 切页走横向翻页动效：当前页横向滑出 → 跳到目标页 → 从另一侧横向滑入。
 * 支持左右横滑、点左右两侧 tap 区切页，并显示页码。
 */
export const PaginatedReader: React.FC<PaginatedReaderProps> = ({
  children,
  bottomOffset,
  className,
}) => {
  const { t } = useTranslation();
  const { reduceMotion } = useReducedMotionOrPreference();

  const viewportRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const [scope, animate] = useAnimate();
  const [page, setPage] = useState(0);
  const [pages, setPages] = useState(1);
  const [pageHeight, setPageHeight] = useState(0);
  const pagesRef = useRef(1);
  const flippingRef = useRef(false);

  const recompute = useCallback(() => {
    const viewport = viewportRef.current;
    const content = contentRef.current;
    if (!viewport || !content) return;
    const H = Math.max(1, viewport.clientHeight);
    const contentH = content.scrollHeight;
    const count = Math.max(1, Math.ceil(contentH / H));
    pagesRef.current = count;
    setPageHeight(H);
    setPages(count);
    // 内容缩短时夹取当前页，避免越界
    setPage((p) => Math.max(0, Math.min(p, count - 1)));
  }, []);

  useEffect(() => {
    const viewport = viewportRef.current;
    const content = contentRef.current;
    if (!viewport || !content) return;
    const ro = new ResizeObserver(recompute);
    ro.observe(viewport);
    ro.observe(content);
    // 首帧补测（字体/KaTeX/CodeBlock 异步加载后自纠正）
    const rafId = requestAnimationFrame(recompute);
    recompute();
    return () => {
      ro.disconnect();
      cancelAnimationFrame(rafId);
    };
  }, [recompute]);

  /** 横向翻页：整页像轮播一样平滑滑出 → 跳页 → 从另一侧滑入。dir=1 下一页，dir=-1 上一页。 */
  const flipTo = useCallback(
    async (dir: 1 | -1) => {
      if (flippingRef.current) return;
      const el = scope.current as HTMLElement | null;
      if (!el) return;
      const target = page + dir;
      if (target < 0 || target >= pagesRef.current) return;
      flippingRef.current = true;
      const vw = el.offsetWidth || 1;
      const dur = reduceMotion ? 0 : FLIP_DURATION;
      try {
        if (dur > 0) {
          // 整页以平滑曲线滑出
          await animate(el, { x: -dir * vw }, { duration: dur, ease: EASE });
        }
        setPage(target);
        if (dur > 0) {
          // 屏幕外瞬移到另一侧，再平滑滑入
          animate(el, { x: dir * vw }, { duration: 0 });
          await animate(el, { x: 0 }, { duration: dur, ease: EASE });
        }
      } finally {
        flippingRef.current = false;
      }
    },
    [page, reduceMotion, animate, scope],
  );

  const goNext = useCallback(() => void flipTo(1), [flipTo]);
  const goPrev = useCallback(() => void flipTo(-1), [flipTo]);

  const handleDragEnd = (
    _e: unknown,
    info: { offset: { x: number } },
  ) => {
    flippingRef.current = false;
    if (info.offset.x < -SWIPE_THRESHOLD) goNext();
    else if (info.offset.x > SWIPE_THRESHOLD) goPrev();
  };

  const pageIndicator = t("learning.settings.pageIndicator", {
    current: page + 1,
    total: pages,
  });

  return (
    <div
      className={`${className ?? ""} flex flex-col`}
      style={{ paddingBottom: bottomOffset }}
    >
      <div
        ref={viewportRef}
        className="relative h-full min-h-0 overflow-hidden"
      >
        {/* 整页载体：跟手横向拖动（轮播手感），配合上滑/下滑区做切页 */}
        <motion.div
          ref={scope}
          className="h-full will-change-transform"
          style={{ touchAction: "pan-y" }}
          drag="x"
          dragConstraints={{ left: 0, right: 0 }}
          dragElastic={0.08}
          onDragEnd={handleDragEnd}
          onDragStart={() => {
            flippingRef.current = true;
          }}
        >
          <motion.div
            ref={contentRef}
            className="will-change-transform"
            style={{ width: "100%" }}
            animate={{ y: -page * pageHeight }}
            transition={{ duration: 0 }}
          >
            {children}
          </motion.div>
        </motion.div>

        {/* 左右 tap 区：只盖左右 1/4，stopPropagation 避免误触外层工具条显隐 */}
        <button
          type="button"
          aria-label={t("learning.settings.prevPage")}
          onClick={(e) => {
            e.stopPropagation();
            goPrev();
          }}
          disabled={page === 0}
          className="absolute inset-y-0 left-0 w-1/4 z-10 disabled:opacity-0"
        />
        <button
          type="button"
          aria-label={t("learning.settings.nextPage")}
          onClick={(e) => {
            e.stopPropagation();
            goNext();
          }}
          disabled={page >= pages - 1}
          className="absolute inset-y-0 right-0 w-1/4 z-10 disabled:opacity-0"
        />

        {/* 页码 + 上/下页提示 */}
        <div className="pointer-events-none absolute inset-x-0 bottom-0 z-20 flex items-center justify-center gap-2 pb-1 text-[11px] text-slate-400 dark:text-slate-500">
          {page > 0 && <ChevronLeft size={14} aria-hidden />}
          <span>{pageIndicator}</span>
          {page < pages - 1 && <ChevronRight size={14} aria-hidden />}
        </div>
      </div>
    </div>
  );
};

export default PaginatedReader;