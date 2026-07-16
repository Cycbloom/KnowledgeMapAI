import React, { memo, useCallback } from "react";
import { useTranslation } from "react-i18next";

interface TransformControlsProps {
  fromGraphId?: string | null;
  fromGraphTitle?: string;
  onReturnToGraph?: () => void;
  showMiniMap: boolean;
  onToggleMiniMap: () => void;
  showLegend: boolean;
  onToggleLegend: () => void;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onResetView: () => void;
  transformK: number;
  graphsCount: number;
  relationsCount: number;
}

const TransformControlsComponent: React.FC<TransformControlsProps> = ({
  fromGraphId,
  fromGraphTitle,
  onReturnToGraph,
  showMiniMap,
  onToggleMiniMap,
  showLegend,
  onToggleLegend,
  onZoomIn,
  onZoomOut,
  onResetView,
  transformK,
  graphsCount,
  relationsCount,
}) => {
  const { t } = useTranslation();
  const handleReturnClick = useCallback(() => {
    onReturnToGraph?.();
  }, [onReturnToGraph]);

  const handleMiniMapClick = useCallback(() => {
    onToggleMiniMap();
  }, [onToggleMiniMap]);

  const handleLegendClick = useCallback(() => {
    onToggleLegend();
  }, [onToggleLegend]);

  const handleZoomInClick = useCallback(() => {
    onZoomIn();
  }, [onZoomIn]);

  const handleZoomOutClick = useCallback(() => {
    onZoomOut();
  }, [onZoomOut]);

  const handleResetClick = useCallback(() => {
    onResetView();
  }, [onResetView]);

  return (
    <>
      <div className="absolute bottom-[calc(3.5rem+var(--safe-area-inset-bottom))] md:bottom-4 right-4 flex flex-col gap-2">
        <div className="flex flex-col gap-2">
          {fromGraphId && onReturnToGraph && (
            <button
              onClick={handleReturnClick}
              className="p-2 bg-primary-500 dark:bg-primary-600 rounded shadow-lg hover:bg-primary-600 dark:hover:bg-primary-700 text-white transition-colors"
              title={`返回 ${fromGraphTitle || "来源图谱"}`}
            >
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M19 12H5M12 19l-7-7 7-7" />
              </svg>
            </button>
          )}
          <button
            onClick={handleMiniMapClick}
            className="p-2 bg-white dark:bg-slate-800 rounded shadow-lg hover:bg-gray-50 dark:hover:bg-slate-700 text-gray-700 dark:text-gray-300 transition-colors"
            title={showMiniMap ? "隐藏小地图" : "显示小地图"}
          >
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
              <line x1="3" y1="9" x2="21" y2="9" />
              <line x1="9" y1="21" x2="9" y2="9" />
            </svg>
          </button>

          <button
            onClick={handleZoomInClick}
            className="p-2 bg-white dark:bg-slate-800 rounded shadow-lg hover:bg-gray-50 dark:hover:bg-slate-700 text-gray-700 dark:text-gray-300 transition-colors"
            title={t('common.aria.zoomIn')}
            aria-label={t('common.aria.zoomIn')}
          >
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path
                d="M12 5v14M5 12h14"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>

          <button
            onClick={handleZoomOutClick}
            className="p-2 bg-white dark:bg-slate-800 rounded shadow-lg hover:bg-gray-50 dark:hover:bg-slate-700 text-gray-700 dark:text-gray-300 transition-colors"
            title={t('common.aria.zoomOut')}
            aria-label={t('common.aria.zoomOut')}
          >
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path
                d="M5 12h14"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>

          <button
            onClick={handleResetClick}
            className="p-2 bg-white dark:bg-slate-800 rounded shadow-lg hover:bg-gray-50 dark:hover:bg-slate-700 text-gray-700 dark:text-gray-300 transition-colors"
            title={t('common.aria.resetView')}
            aria-label={t('common.aria.resetView')}
          >
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path
                d="M3 3v5h5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>

          <button
            onClick={handleLegendClick}
            className={`p-2 rounded shadow-lg transition-colors ${
              showLegend
                ? "bg-primary-500 dark:bg-primary-600 text-white"
                : "bg-white dark:bg-slate-800 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-slate-700"
            }`}
            title={showLegend ? "隐藏图例" : "显示关系类型图例"}
          >
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path d="M4 6h16M4 12h16M4 18h16" strokeLinecap="round" />
            </svg>
          </button>
        </div>
      </div>

      <div className="absolute bottom-[calc(3.5rem+var(--safe-area-inset-bottom))] md:bottom-4 left-4 text-xs text-gray-500 dark:text-gray-400 bg-white/80 dark:bg-slate-800/80 px-2 py-1 rounded backdrop-blur-sm">
        缩放: {Math.round(transformK * 100)}% | 图谱: {graphsCount} | 关系:{" "}
        {relationsCount}
      </div>
    </>
  );
};

export const TransformControls = memo(TransformControlsComponent);
