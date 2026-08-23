import React from 'react';
import { useTranslation } from 'react-i18next';
import { Skeleton } from '../common/Skeleton';

interface SkeletonNode {
  /** 水平位置（百分比） */
  x: number;
  /** 垂直位置（百分比） */
  y: number;
  /** 节点占位宽度（px） */
  w: number;
  /** 节点占位高度（px） */
  h: number;
}

/** 模拟画布上图谱节点的分布（根节点在左，分支向右展开） */
const SKELETON_NODES: SkeletonNode[] = [
  { x: 16, y: 50, w: 132, h: 44 },
  { x: 40, y: 20, w: 112, h: 40 },
  { x: 43, y: 52, w: 104, h: 36 },
  { x: 39, y: 82, w: 112, h: 40 },
  { x: 65, y: 12, w: 96, h: 36 },
  { x: 69, y: 38, w: 124, h: 44 },
  { x: 67, y: 68, w: 96, h: 36 },
  { x: 64, y: 90, w: 88, h: 32 },
  { x: 89, y: 26, w: 88, h: 32 },
  { x: 91, y: 56, w: 96, h: 36 },
];

/** 节点连接关系（对应 SKELETON_NODES 下标） */
const SKELETON_EDGES: Array<[number, number]> = [
  [0, 1],
  [0, 2],
  [0, 3],
  [1, 4],
  [1, 5],
  [2, 5],
  [3, 6],
  [3, 7],
  [5, 8],
  [5, 9],
  [6, 9],
];

/**
 * 图谱地图画布骨架屏：模拟「节点 + 连线」的画布布局，
 * 替代与实际页面不符的卡片列表样式。
 */
const GraphMapSkeletonComponent: React.FC = () => {
  const { t } = useTranslation();

  const edgePaths = SKELETON_EDGES.map(([from, to]) => {
    const a = SKELETON_NODES[from];
    const b = SKELETON_NODES[to];
    const mx = (a.x + b.x) / 2;
    const my = (a.y + b.y) / 2;
    // 控制点沿法线方向偏移，形成自然弯曲的边
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const len = Math.hypot(dx, dy) || 1;
    const offset = Math.min(8, len * 0.15);
    const cx = mx + (-dy / len) * offset;
    const cy = my + (dx / len) * offset;
    return `M ${a.x} ${a.y} Q ${cx} ${cy} ${b.x} ${b.y}`;
  });

  return (
    <div
      className="absolute inset-0 overflow-hidden bg-gray-50 dark:bg-slate-900"
      role="status"
    >
      <svg
        className="absolute inset-0 w-full h-full text-gray-200 dark:text-slate-700"
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
        aria-hidden="true"
      >
        {edgePaths.map((d) => (
          <path
            key={d}
            d={d}
            fill="none"
            stroke="currentColor"
            strokeWidth={1.5}
            vectorEffect="non-scaling-stroke"
          />
        ))}
      </svg>

      {SKELETON_NODES.map((node, index) => (
        <div
          key={index}
          className="absolute -translate-x-1/2 -translate-y-1/2"
          style={{ left: `${node.x}%`, top: `${node.y}%` }}
        >
          <Skeleton
            variant="rectangular"
            width={node.w}
            height={node.h}
            className="rounded-full"
          />
        </div>
      ))}

      <span className="sr-only">{t('graphMap.empty.loading')}</span>
    </div>
  );
};

export const GraphMapSkeleton = React.memo(GraphMapSkeletonComponent);
