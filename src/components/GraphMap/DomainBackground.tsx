import React, { useMemo } from 'react';
import type { LayoutNode, NodeLevel } from '../../types';
import { useTheme } from '../../hooks';
import { NODE_STYLE_CONFIG } from '../../config/nodeStyleConfig';

// ---------- 圆盘凸包（convex hull of disks） ----------
// 问题：如果只对节点「中心点」求凸包，最外层节点的圆形盘会穿出多边形边界。
// 正确做法：对每个节点沿其圆周采样若干点，把采样点纳入点集做凸包，
// 这样凸包边界会贴住最外层节点的圆弧，实现「完全包围」。

/** 每个节点沿圆周采样点数：点越多，圆弧逼近越光滑 */
const RIM_SAMPLES = 36;
/** 在节点图形半径之外额外预留的包围缓冲（覆盖描边/光晕/抗锯齿） */
const RIM_BUFFER = 6;

/** 节点最外层可见圆半径：baseRadius（最外层 ring 即 index 0）+ 描边 + 缓冲 */
function getNodeRimRadius(level: NodeLevel): number {
  const cfg = NODE_STYLE_CONFIG[level];
  return cfg.baseRadius + cfg.strokeWidth + RIM_BUFFER;
}

interface SampledPoint {
  x: number;
  y: number;
  /** 该点来自哪个节点圆心；用于把同圆两点之间的边界连成圆弧 */
  src: { cx: number; cy: number } | null;
}

/** 对每个节点沿圆周采样，标记来源圆心 */
function sampleDisks(nodes: Array<{ x: number; y: number; level?: NodeLevel }>): SampledPoint[] {
  const pts: SampledPoint[] = [];
  for (const n of nodes) {
    const r = getNodeRimRadius(n.level ?? 'leaf');
    for (let i = 0; i < RIM_SAMPLES; i++) {
      const angle = (i / RIM_SAMPLES) * Math.PI * 2;
      pts.push({ x: n.x + Math.cos(angle) * r, y: n.y + Math.sin(angle) * r, src: { cx: n.x, cy: n.y } });
    }
  }
  return pts;
}

/** 标准凸包（Monotone Chain），返回顺时针多边形顶点（保留 src 标记） */
function convexHull(points: SampledPoint[]): SampledPoint[] {
  if (points.length < 3) return points.slice();
  const sorted = points.slice().sort((a, b) => a.x !== b.x ? a.x - b.x : a.y - b.y);
  const cross = (o: SampledPoint, a: SampledPoint, b: SampledPoint) => (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);
  const lower: SampledPoint[] = [];
  for (const p of sorted) {
    while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], p) <= 0) lower.pop();
    lower.push(p);
  }
  const upper: SampledPoint[] = [];
  for (let i = sorted.length - 1; i >= 0; i--) {
    const p = sorted[i];
    while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], p) <= 0) upper.pop();
    upper.push(p);
  }
  lower.pop();
  upper.pop();
  return [...lower, ...upper];
}

/**
 * 圆盘凸包边：相邻两凸包顶点若来自同一节点圆，则用一段「圆弧」连接，
 * 精确贴合最外层节点的圆周；否则用直线段连接。
 * @returns SVG path（含 fill + stroke 都适用的闭合轮廓）
 */
function diskConvexHullPath(nodes: Array<{ x: number; y: number; level?: NodeLevel }>): string {
  if (nodes.length === 0) return '';
  if (nodes.length === 1) {
    const r = getNodeRimRadius(nodes[0].level ?? 'leaf');
    return `M ${nodes[0].x - r} ${nodes[0].y} A ${r} ${r} 0 1 1 ${nodes[0].x + r - 0.01} ${nodes[0].y} Z`;
  }
  const hull = convexHull(sampleDisks(nodes));
  if (hull.length < 2) return '';

  const sameCircle = (a: SampledPoint, b: SampledPoint): boolean =>
    a.src !== null && b.src !== null && a.src.cx === b.src.cx && a.src.cy === b.src.cy;

  const n = hull.length;
  let path = `M ${hull[0].x} ${hull[0].y}`;
  for (let i = 1; i < n; i++) {
    const prev = hull[i - 1];
    const cur = hull[i];
    if (sameCircle(prev, cur)) {
      // 圆弧：sameCircle 已保证两点的 src 均非空，落在同一节点圆上
      const src = prev.src;
      const cx0 = src ? src.cx : 0;
      const cy0 = src ? src.cy : 0;
      // 半径取该采样点与圆心实际距离，避免硬编码导致弧线与圆盘不贴合
      const r = Math.hypot(prev.x - cx0, prev.y - cy0) || getNodeRimRadius('leaf');
      const a1 = Math.atan2(prev.y - cy0, prev.x - cx0);
      const a2 = Math.atan2(cur.y - cy0, cur.x - cx0);
      const sweep = ((a2 - a1 + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
      // sweep>0 表示逆时针，SVG 中 sweep-flag=1 为顺时针（y 向下）
      const sweepFlag = sweep > 0 ? 0 : 1;
      path += ` A ${r} ${r} 0 0 ${sweepFlag} ${cur.x} ${cur.y}`;
    } else {
      path += ` L ${cur.x} ${cur.y}`;
    }
  }
  path += ' Z';
  return path;
}

interface DomainGroup {
  domainId: string;
  domain: string;
  nodes: LayoutNode[];
  centerX: number;
  centerY: number;
  radius: number;
}

const DOMAIN_COLORS = [
  { bg: 'rgba(99, 102, 241, 0.12)', text: 'rgba(99, 102, 241, 0.85)' },
  { bg: 'rgba(16, 185, 129, 0.12)', text: 'rgba(16, 185, 129, 0.85)' },
  { bg: 'rgba(245, 158, 11, 0.12)', text: 'rgba(245, 158, 11, 0.85)' },
  { bg: 'rgba(239, 68, 68, 0.12)', text: 'rgba(239, 68, 68, 0.85)' },
  { bg: 'rgba(139, 92, 246, 0.12)', text: 'rgba(139, 92, 246, 0.85)' },
  { bg: 'rgba(236, 72, 153, 0.12)', text: 'rgba(236, 72, 153, 0.85)' },
  { bg: 'rgba(6, 182, 212, 0.12)', text: 'rgba(6, 182, 212, 0.85)' },
  { bg: 'rgba(132, 204, 22, 0.12)', text: 'rgba(132, 204, 22, 0.85)' },
];

interface PillPlacement {
  domainId: string;
  x: number;
  cy: number;
  w: number;
  h: number;
}

/** 估算一段文本在指定字号下的像素宽度：全角/中文按 1.0 字宽，半角按 0.55 字宽 */
function estimateTextWidth(text: string, fontSize: number): number {
  let width = 0;
  for (const ch of text) {
    const code = ch.codePointAt(0) ?? 0;
    // CJK 统一表意文字、全角标点/字母数字
    const isWide =
      (code >= 0x2e80 && code <= 0x9fff) ||
      (code >= 0xac00 && code <= 0xd7af) ||
      (code >= 0xff00 && code <= 0xff60) ||
      (code >= 0x3000 && code <= 0x303f);
    width += isWide ? fontSize : fontSize * 0.55;
  }
  return width;
}

/** 胶囊矩形是否压到某个节点圆盘（圆角矩形按外接矩形近似即可，圆角很小） */
function pillHitsDisk(
  px: number, // 胶囊左边缘
  py: number, // 胶囊上边缘
  pw: number,
  ph: number,
  dx: number,
  dy: number,
  dr: number,
): boolean {
  const closestX = Math.max(px, Math.min(dx, px + pw));
  const closestY = Math.max(py, Math.min(dy, py + ph));
  const dx0 = dx - closestX;
  const dy0 = dy - closestY;
  return dx0 * dx0 + dy0 * dy0 <= dr * dr;
}

/**
 * 从起点出发，沿方向 (dx, dy) 逐步外推，返回「第一个不压到任一节点圆盘」的离起点最近位置。
 * 若 maxEject 内找不到，返回 null。step 为单次推出量，保证标签就近避让而不飞远。
 */
function ejectToFreeSpot(
  startX: number,
  startY: number, // 胶囊左边缘+上边缘
  w: number,
  h: number,
  dirX: number,
  dirY: number,
  disks: Array<{ x: number; y: number; r: number }>,
  step = 6,
  maxEject = 200,
): { x: number; y: number } | null {
  for (let dist = 0; dist <= maxEject; dist += step) {
    const x = startX + dirX * dist;
    const y = startY + dirY * dist;
    if (!disks.some(d => pillHitsDisk(x, y, w, h, d.x, d.y, d.r))) {
      return { x, y };
    }
  }
  return null;
}

// 标签胶囊两点碰撞：同水平相交时把下方的往下推，多轮收敛，保证缩小态标签不互相遮挡
function resolvePillOverlap(placements: PillPlacement[]): PillPlacement[] {
  const list = placements.map(p => ({ ...p }));
  for (let pass = 0; pass < 4; pass++) {
    list.sort((a, b) => a.cy - b.cy);
    let moved = false;
    for (let i = 1; i < list.length; i++) {
      const cur = list[i];
      for (let j = 0; j < i; j++) {
        const before = list[j];
        const overlapX =
          Math.min(cur.x + cur.w, before.x + before.w) -
          Math.max(cur.x, before.x);
        const overlapY =
          Math.min(cur.cy + cur.h / 2, before.cy + before.h / 2) -
          Math.max(cur.cy - cur.h / 2, before.cy - before.h / 2);
        if (overlapX > 0 && overlapY > 0) {
          cur.cy = before.cy + before.h / 2 + 6 + cur.h / 2;
          moved = true;
        }
      }
    }
    if (!moved) break;
  }
  return list;
}

interface DomainBackgroundProps {
  layoutNodes: LayoutNode[];
  graphs: Array<{ id: string; domain?: string; domainIds?: string[] }>;
  zoomLevel: number;
  selectedDomainIds?: Set<string>;
  hoveredDomainId?: string | null;
  domainIdToInfo?: Map<string, { name: string; color: string }>;
}

export const DomainBackground: React.FC<DomainBackgroundProps> = ({
  layoutNodes,
  graphs,
  zoomLevel,
  selectedDomainIds,
  hoveredDomainId,
  domainIdToInfo,
}) => {
  const { isDark } = useTheme();

  const domainGroups = useMemo(() => {
    const groups: Map<string, DomainGroup> = new Map();

    // 预构建 graph 索引，将按 id 查找由 O(layoutNodes*graphs) 降为 O(1)
    const graphById = new Map(graphs.map(g => [g.id, g]));

    layoutNodes.forEach(node => {
      const graph = graphById.get(node.id);

      const domainIds = graph?.domainIds || [];
      const legacyDomain = graph?.domain;

      const ids = domainIds.length > 0 ? domainIds : (legacyDomain ? [legacyDomain] : []);

      ids.forEach((domainIdentifier: string) => {
        if (!domainIdentifier) return;

        if (!groups.has(domainIdentifier)) {
          groups.set(domainIdentifier, {
            domainId: domainIdentifier,
            domain: domainIdToInfo?.get(domainIdentifier)?.name || domainIdentifier,
            nodes: [],
            centerX: 0,
            centerY: 0,
            radius: 0
          });
        }

        groups.get(domainIdentifier)?.nodes.push(node);
      });
    });

    groups.forEach(group => {
      if (group.nodes.length === 0) return;

      let sumX = 0, sumY = 0;
      group.nodes.forEach(node => {
        sumX += node.x;
        sumY += node.y;
      });
      group.centerX = sumX / group.nodes.length;
      group.centerY = sumY / group.nodes.length;

      // 外接圆：半径 = 距质心最远的「节点盘外缘」距离，正好包住最外层节点，
      // 避免 p85 + 大 padding + 放大系数把圆撑得过大
      let maxOuter = 0;
      group.nodes.forEach(node => {
        const dx = node.x - group.centerX;
        const dy = node.y - group.centerY;
        const rim = getNodeRimRadius(node.level ?? 'leaf');
        const outer = Math.sqrt(dx * dx + dy * dy) + rim;
        if (outer > maxOuter) maxOuter = outer;
      });
      // 少量视觉余量，圆刚好贴合而不互相压挤
      group.radius = maxOuter + 8;
    });

    return Array.from(groups.values());
  }, [layoutNodes, graphs, domainIdToInfo]);

  const filteredGroups = useMemo(() => {
    if (!selectedDomainIds || selectedDomainIds.size === 0) {
      return domainGroups;
    }
    return domainGroups.filter(group => selectedDomainIds.has(group.domainId));
  }, [domainGroups, selectedDomainIds]);

  // 缩放模式改为连续过渡，避免在 zoomLevel=1.0 时硬切出现画面跳变
  // glowOpacity = 1（缩小态，≤0.85）→ 0（放大态，≥1.15）线性递减
  // hullOpacity 反向
  const glowOpacity = useMemo(() => {
    if (zoomLevel <= 0.85) return 1;
    if (zoomLevel >= 1.15) return 0;
    return 1 - (zoomLevel - 0.85) / 0.3;
  }, [zoomLevel]);
  const hullOpacity = 1 - glowOpacity;

  // hover 联动：悬停某领域时，其区域保持明亮，其余区域线性降暗
  const hovering = hoveredDomainId !== null && hoveredDomainId !== undefined;
  const regionOpacityFor = (domainId: string): number => {
    if (!hovering) return 1;
    return domainId === hoveredDomainId ? 1 : 0.12;
  };

  // 胶囊位置按当前模式线性插值，缩小态→放大态位置变化也平滑
  const useZoomedOutPillPos = glowOpacity > 0.5;

  const getColorsForDomain = (domainId: string): typeof DOMAIN_COLORS[0] => {
    if (domainIdToInfo?.has(domainId)) {
      const info = domainIdToInfo.get(domainId);
      if (info) {
        const color = info.color;
        return {
          bg: `${color}21`,
          text: color,
        };
      }
    }
    const index = domainGroups.findIndex(g => g.domainId === domainId);
    return DOMAIN_COLORS[index % DOMAIN_COLORS.length];
  };

  // 胶囊标签排版：淡领域色胶囊 + 名称 + 右侧实色计数徽章，宽度按名称长度自适应
  // 位置做「就近避让」：先放默认位置，若压到节点则沿上/下/左/右逐格外推，取推出最近的方向
  const pillPlacements = useMemo(() => {
    if (filteredGroups.length === 0) return [];

    const fontSize = Math.max(10, Math.min(18, 14 / zoomLevel));

    // 全部节点的圆盘（中心+外缘半径），用于标签避让
    const disks = layoutNodes.map(n => ({
      x: n.x,
      y: n.y,
      r: getNodeRimRadius(n.level ?? 'leaf'),
    }));

    const placements: PillPlacement[] = filteredGroups.map(group => {
      const nameW = estimateTextWidth(group.domain, fontSize);
      const h = fontSize * 1.6 + 12;
      const badgeR = h * 0.34;
      const w = Math.max(nameW + 14 + badgeR * 2 + 14 + 8, 76);

      // 默认位置：缩小态在光晕圆正上方；放大态在凸块左上角
      const defX = !useZoomedOutPillPos
        ? Math.min(...group.nodes.map(n => n.x)) - 14
        : group.centerX - w / 2;
      const defCy = !useZoomedOutPillPos
        ? Math.min(...group.nodes.map(n => n.y)) - 28
        : group.centerY - group.radius;

      const defTopY = defCy - h / 2;

      // 若默认位置不压任何节点，直接采用（最贴合、最不突兀）
      const hitDef = disks.some(d => pillHitsDisk(defX, defTopY, w, h, d.x, d.y, d.r));

      if (!hitDef) {
        return { domainId: group.domainId, x: defX, cy: defCy, w, h };
      }

      // 默认位置被遮挡：从默认位置出发，朝领域外侧贴近位置就近移动，取推出距离最小者
      const cx = group.centerX;
      const cy = group.centerY;
      // 四个候选方向：上/下/左/右。起点放在「默认位置」附近，方向朝外推
      const attempts: Array<{ dirX: number; dirY: number }> = [
        { dirX: 0, dirY: -1 }, // 上（默认就向上，再往上挪一点即可）
        { dirX: 0, dirY: 1 },  // 下：从上方向下穿过领域中心外缘找空位
        { dirX: -1, dirY: 0 }, // 左
        { dirX: 1, dirY: 0 },  // 右
      ];

      let best: { x: number; y: number; dist: number } | null = null;
      for (const att of attempts) {
        // 起点 = 默认位置（左上角 / 正上方），使其贴着领域顶缘移动
        const ejected = ejectToFreeSpot(defX, defTopY, w, h, att.dirX, att.dirY, disks, 6, 160);
        if (!ejected) continue;
        const dist = Math.abs(ejected.x - cx) + Math.abs(ejected.y - cy);
        if (!best || dist < best.dist) {
          best = { x: ejected.x, y: ejected.y, dist };
        }
      }

      const cyFinal = best ? best.y + h / 2 : defCy;
      const xFinal = best ? best.x : defX;

      return {
        domainId: group.domainId,
        x: xFinal,
        cy: cyFinal,
        w,
        h,
      };
    });

    if (useZoomedOutPillPos) {
      return resolvePillOverlap(placements);
    }
    return placements;
  }, [filteredGroups, zoomLevel, useZoomedOutPillPos, layoutNodes]);

  const pillById = useMemo(
    () => new Map(pillPlacements.map(p => [p.domainId, p])),
    [pillPlacements],
  );

  if (domainGroups.length === 0) return null;

  const fontSize = Math.max(10, Math.min(18, 14 / zoomLevel));

  const renderPill = (group: DomainGroup) => {
    const pill = pillById.get(group.domainId);
    if (!pill) return null;

    const colors = getColorsForDomain(group.domainId);
    const pillX = pill.x;
    const pillY = pill.cy - pill.h / 2;
    // 右侧实色计数徽章直径略小于胶囊高度，保持呼吸感
    const badgeR = pill.h * 0.34;
    const badgeCX = pillX + pill.w - badgeR - 7;

    return (
      <g key={`domain-label-${group.domainId}`} opacity={regionOpacityFor(group.domainId)}>
        {/* 淡领域色胶囊底 */}
        <rect
          x={pillX}
          y={pillY}
          width={pill.w}
          height={pill.h}
          rx={pill.h / 2}
          fill={isDark ? '#1e293b' : colors.bg}
          stroke={colors.text}
          strokeOpacity={0.45}
          strokeWidth={1}
        />
        {/* 名称 */}
        <text
          x={pillX + 16}
          y={pill.cy}
          textAnchor="start"
          dominantBaseline="central"
          fontSize={fontSize * 0.92}
          fontWeight="600"
          fill={isDark ? '#e2e8f0' : '#1e293b'}
        >
          {group.domain}
        </text>
        {/* 右侧实色计数徽章 */}
        <circle cx={badgeCX} cy={pill.cy} r={badgeR} fill={colors.text} opacity={0.92} />
        <text
          x={badgeCX}
          y={pill.cy}
          textAnchor="middle"
          dominantBaseline="central"
          fontSize={badgeR * 0.95}
          fontWeight="700"
          fill="#ffffff"
        >
          {group.nodes.length}
        </text>
      </g>
    );
  };

  return (
    <g className="domain-backgrounds" style={{ pointerEvents: 'none' }}>
      {/* 缩放 0.85-1.15 区间连续 blend：光晕圆淡出 + 凸包淡入同步进行，消除硬切跳变 */}
      {glowOpacity > 0.001 &&
        filteredGroups.map((group) => {
          const colors = getColorsForDomain(group.domainId);
          const gradientId = `glow-gradient-${group.domainId.replace(/\s+/g, '-')}`;
          const blurId = `blur-${group.domainId.replace(/\s+/g, '-')}`;

          return (
            <g key={`glow-${group.domainId}`} opacity={glowOpacity * 0.95 * regionOpacityFor(group.domainId)}>
              <defs>
                <radialGradient
                  id={gradientId}
                  cx="50%"
                  cy="50%"
                  r="50%"
                  fx="50%"
                  fy="50%"
                >
                  <stop
                    offset="0%"
                    stopColor={colors.bg.replace('0.12', '0.20')}
                    stopOpacity={1}
                  />
                  <stop
                    offset="50%"
                    stopColor={colors.bg}
                    stopOpacity={0.8}
                  />
                  <stop
                    offset="100%"
                    stopColor={colors.bg.replace('0.12', '0.02')}
                    stopOpacity={0}
                  />
                </radialGradient>
                <filter
                  id={blurId}
                  x="-50%"
                  y="-50%"
                  width="200%"
                  height="200%"
                >
                  <feGaussianBlur in="SourceGraphic" stdDeviation="8" />
                </filter>
              </defs>

              {/* 柔和光晕圆 */}
              <circle
                cx={group.centerX}
                cy={group.centerY}
                r={group.radius}
                fill={`url(#${gradientId})`}
                filter={`url(#${blurId})`}
              />
              {/* 边界轮廓：移到 radius×0.98 的外圈（不再 0.88 穿节点），改为细实线 + 低透明 */}
              <circle
                cx={group.centerX}
                cy={group.centerY}
                r={group.radius * 0.98}
                fill="none"
                stroke={colors.text}
                strokeWidth={1}
                strokeOpacity={0.18}
              />
            </g>
          );
        })}

      {hullOpacity > 0.001 &&
        filteredGroups.map((group) => {
          const colors = getColorsForDomain(group.domainId);
          const hullShadowId = `hull-shadow-${group.domainId.replace(/\s+/g, '-')}`;
          const hullGradientId = `hull-rg-${group.domainId.replace(/\s+/g, '-')}`;

          return (
            <g key={`block-${group.domainId}`} opacity={hullOpacity * regionOpacityFor(group.domainId)}>
              <defs>
                <filter
                  id={hullShadowId}
                  x="-20%"
                  y="-20%"
                  width="140%"
                  height="140%"
                >
                  <feDropShadow dx="0" dy="6" stdDeviation="10" floodColor={colors.text} floodOpacity="0.08" />
                </filter>
                {/* 质心径向渐变：中心深（55%）→ 边缘透明，层次比平面填色更 3D */}
                <radialGradient
                  id={hullGradientId}
                  cx={`${group.centerX}px`}
                  cy={`${group.centerY}px`}
                  r={`${group.radius * 1.4}px`}
                  gradientUnits="userSpaceOnUse"
                >
                  <stop offset="0%" stopColor={colors.text} stopOpacity="0.32" />
                  <stop offset="55%" stopColor={colors.text} stopOpacity="0.14" />
                  <stop offset="100%" stopColor={colors.text} stopOpacity="0.02" />
                </radialGradient>
              </defs>
              {/* 内层填充：质心径向渐变 + 投影（圆盘凸包，圆弧完全包围最外层节点） */}
              <path
                d={diskConvexHullPath(group.nodes)}
                fill={`url(#${hullGradientId})`}
                stroke="none"
                filter={`url(#${hullShadowId})`}
              />
              {/* 虚线边框：更轻盈不抢视觉 */}
              <path
                d={diskConvexHullPath(group.nodes)}
                fill="none"
                stroke={colors.text}
                strokeWidth={1.5}
                strokeOpacity={0.55}
                strokeDasharray="6 4"
              />
            </g>
          );
        })}

      {filteredGroups.map(renderPill)}
    </g>
  );
};

export default DomainBackground;