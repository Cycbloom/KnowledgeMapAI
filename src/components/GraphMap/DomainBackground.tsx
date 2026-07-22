import React, { useMemo } from 'react';
import type { LayoutNode } from '../../types';

function getConvexHullPath(nodes: Array<{ x: number; y: number }>): string {
  if (nodes.length < 3) {
    if (nodes.length === 0) return '';
    if (nodes.length === 1) {
      const r = 60;
      return `M ${nodes[0].x - r} ${nodes[0].y - r}
              L ${nodes[0].x + r} ${nodes[0].y - r}
              L ${nodes[0].x + r} ${nodes[0].y + r}
              L ${nodes[0].x - r} ${nodes[0].y + r} Z`;
    }
    const dx = nodes[1].x - nodes[0].x;
    const dy = nodes[1].y - nodes[0].y;
    const perpX = -dy;
    const perpY = dx;
    const len = Math.sqrt(perpX * perpX + perpY * perpY) || 1;
    const nx = (perpX / len) * 50;
    const ny = (perpY / len) * 50;
    return `M ${nodes[0].x + nx} ${nodes[0].y + ny}
            L ${nodes[0].x - nx} ${nodes[0].y - ny}
            L ${nodes[1].x - nx} ${nodes[1].y - ny}
            L ${nodes[1].x + nx} ${nodes[1].y + ny} Z`;
  }

  const points = nodes.map(n => ({ x: n.x, y: n.y }));

  function cross(o: typeof points[0], a: typeof points[0], b: typeof points[0]) {
    return (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);
  }

  points.sort((a, b) => a.x !== b.x ? a.x - b.x : a.y - b.y);

  const lower: typeof points = [];
  for (const p of points) {
    while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], p) <= 0) {
      lower.pop();
    }
    lower.push(p);
  }

  const upper: typeof points = [];
  for (let i = points.length - 1; i >= 0; i--) {
    const p = points[i];
    while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], p) <= 0) {
      upper.pop();
    }
    upper.push(p);
  }

  lower.pop();
  upper.pop();

  const hull = [...lower, ...upper];

  let path = `M ${hull[0].x} ${hull[0].y}`;
  for (let i = 1; i < hull.length; i++) {
    path += ` L ${hull[i].x} ${hull[i].y}`;
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

interface DomainBackgroundProps {
  layoutNodes: LayoutNode[];
  graphs: Array<{ id: string; domain?: string; domainIds?: string[] }>;
  zoomLevel: number;
  selectedDomainIds?: Set<string>;
  domainIdToInfo?: Map<string, { name: string; color: string }>;
}

export const DomainBackground: React.FC<DomainBackgroundProps> = ({
  layoutNodes,
  graphs,
  zoomLevel,
  selectedDomainIds,
  domainIdToInfo,
}) => {
  const domainGroups = useMemo(() => {
    const groups: Map<string, DomainGroup> = new Map();

    layoutNodes.forEach(node => {
      const graph = graphs.find(g => g.id === node.id);

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
      
      let maxDistance = 0;
      group.nodes.forEach(node => {
        const dx = node.x - group.centerX;
        const dy = node.y - group.centerY;
        const distance = Math.sqrt(dx * dx + dy * dy);
        maxDistance = Math.max(maxDistance, distance);
      });
      
      group.radius = maxDistance + 120;
    });
    
    return Array.from(groups.values());
  }, [layoutNodes, graphs, domainIdToInfo]);

  const filteredGroups = useMemo(() => {
    if (!selectedDomainIds || selectedDomainIds.size === 0) {
      return domainGroups;
    }
    return domainGroups.filter(group => selectedDomainIds.has(group.domainId));
  }, [domainGroups, selectedDomainIds]);

  const isZoomedOut = zoomLevel < 1.0;

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

  if (domainGroups.length === 0) return null;
  
  const fontSize = Math.max(10, Math.min(18, 14 / zoomLevel));
  
  return (
    <g className="domain-backgrounds" style={{ pointerEvents: 'none' }}>
      {isZoomedOut ? (
        filteredGroups.map((group) => {
          const colors = getColorsForDomain(group.domainId);
          const gradientId = `glow-gradient-${group.domainId.replace(/\s+/g, '-')}`;

          return (
            <g key={`glow-${group.domainId}`}>
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
                    stopColor={colors.bg.replace('0.12', '0.18')}
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
                  id={`blur-${group.domainId.replace(/\s+/g, '-')}`}
                  x="-50%"
                  y="-50%"
                  width="200%"
                  height="200%"
                >
                  <feGaussianBlur in="SourceGraphic" stdDeviation="8" />
                </filter>
              </defs>

              <circle
                cx={group.centerX}
                cy={group.centerY}
                r={group.radius}
                fill={`url(#${gradientId})`}
                filter={`url(#blur-${group.domainId.replace(/\s+/g, '-')})`}
                opacity={0.9}
              />

              <text
                x={group.centerX}
                y={group.centerY - group.radius + 40}
                textAnchor="middle"
                dominantBaseline="middle"
                fontSize={fontSize * 1.2}
                fontWeight="600"
                fill={colors.text}
                opacity={0.95}
                style={{
                  fontFamily: 'system-ui, -apple-system, sans-serif',
                  letterSpacing: '0.08em',
                  textShadow: '0 1px 2px rgba(0,0,0,0.1)',
                }}
              >
                {group.domain}
              </text>

              <text
                x={group.centerX}
                y={group.centerY - group.radius + 40 + fontSize * 1.5}
                textAnchor="middle"
                dominantBaseline="middle"
                fontSize={fontSize * 0.8}
                fontWeight="500"
                fill={colors.text}
                opacity={0.75}
                style={{
                  fontFamily: 'system-ui, -apple-system, sans-serif',
                  textShadow: '0 1px 2px rgba(0,0,0,0.1)',
                }}
              >
                {group.nodes.length} 个图谱
              </text>
            </g>
          );
        })
      ) : (
        filteredGroups.map((group) => {
          const colors = getColorsForDomain(group.domainId);

          return (
            <g key={`block-${group.domainId}`}>
              <path
                d={getConvexHullPath(group.nodes)}
                fill={`${colors.bg.replace('0.12', '0.25')}`}
                stroke={colors.text}
                strokeWidth={1.5}
                strokeOpacity={0.4}
              />

              <rect
                x={Math.min(...group.nodes.map(n => n.x)) - 20}
                y={Math.min(...group.nodes.map(n => n.y)) - 28}
                width={group.domain.length * fontSize * 0.7 + 24}
                height={22}
                rx={6}
                fill={colors.text}
                opacity={0.9}
              />
              <text
                x={Math.min(...group.nodes.map(n => n.x)) - 8}
                y={Math.min(...group.nodes.map(n => n.y)) - 14}
                textAnchor="start"
                dominantBaseline="middle"
                fontSize={fontSize * 0.85}
                fontWeight="600"
                fill="#fff"
              >
                {group.domain}
              </text>
            </g>
          );
        })
      )}
    </g>
  );
};

export default DomainBackground;
