import React, { useMemo } from 'react';
import type { LayoutNode } from '../../types';

interface DomainGroup {
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
  graphs: Array<{ id: string; domain?: string }>;
  zoomLevel: number;
}

export const DomainBackground: React.FC<DomainBackgroundProps> = ({
  layoutNodes,
  graphs,
  zoomLevel,
}) => {
  const domainGroups = useMemo(() => {
    const groups: Map<string, DomainGroup> = new Map();
    
    layoutNodes.forEach(node => {
      const graph = graphs.find(g => g.id === node.id);
      const domain = graph?.domain;
      
      if (!domain) return;
      
      if (!groups.has(domain)) {
        groups.set(domain, {
          domain,
          nodes: [],
          centerX: 0,
          centerY: 0,
          radius: 0
        });
      }
      
      const group = groups.get(domain)!;
      group.nodes.push(node);
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
  }, [layoutNodes, graphs]);
  
  const domainColorMap = useMemo(() => {
    const map = new Map<string, typeof DOMAIN_COLORS[0]>();
    domainGroups.forEach((group, index) => {
      map.set(group.domain, DOMAIN_COLORS[index % DOMAIN_COLORS.length]);
    });
    return map;
  }, [domainGroups]);
  
  if (domainGroups.length === 0) return null;
  
  const fontSize = Math.max(10, Math.min(18, 14 / zoomLevel));
  
  return (
    <g className="domain-backgrounds" style={{ pointerEvents: 'none' }}>
      {domainGroups.map((group) => {
        const colors = domainColorMap.get(group.domain)!;
        const gradientId = `glow-gradient-${group.domain.replace(/\s+/g, '-')}`;
        
        return (
          <g key={group.domain}>
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
                id={`blur-${group.domain.replace(/\s+/g, '-')}`}
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
              filter={`url(#blur-${group.domain.replace(/\s+/g, '-')})`}
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
      })}
    </g>
  );
};

export default DomainBackground;
