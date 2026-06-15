export const levelLabels: Record<string, string> = {
  root: '根节点',
  core: '核心节点',
  sub: '次级节点',
  normal: '普通节点',
  leaf: '叶子节点'
};

export type SemanticZoomLevel = 'overview' | 'cluster' | 'node' | 'detail';

export const SEMANTIC_ZOOM_CONFIG = {
  levels: {
    overview: { minZoom: 0, maxZoom: 0.3, label: '概览', labelEn: 'Overview' },
    cluster: { minZoom: 0.3, maxZoom: 0.7, label: '集群', labelEn: 'Cluster' },
    node: { minZoom: 0.7, maxZoom: 1.5, label: '节点', labelEn: 'Node' },
    detail: { minZoom: 1.5, maxZoom: 5, label: '详情', labelEn: 'Detail' },
  },
  // Which node levels are visible at each zoom level
  visibleLevels: {
    overview: ['root', 'core'] as const,
    cluster: ['root', 'core', 'sub'] as const,
    node: ['root', 'core', 'sub', 'normal', 'leaf'] as const,
    detail: ['root', 'core', 'sub', 'normal', 'leaf'] as const,
  },
  // Text display rules
  textRules: {
    overview: { showText: false, maxTitleLength: 0 },
    cluster: { showText: true, maxTitleLength: 8 },
    node: { showText: true, maxTitleLength: Infinity },
    detail: { showText: true, maxTitleLength: Infinity },
  },
  // Detail level extra info
  detailInfo: {
    showContentPreview: true,
    contentPreviewLength: 30,
    showLearningStatus: true,
    showReviewCount: true,
  },
  // Transition duration between levels
  transitionDuration: 300,
} as const;

export const getSemanticZoomLevel = (zoomK: number): SemanticZoomLevel => {
  const { levels } = SEMANTIC_ZOOM_CONFIG;
  if (zoomK < levels.cluster.minZoom) return 'overview';
  if (zoomK < levels.node.minZoom) return 'cluster';
  if (zoomK < levels.detail.minZoom) return 'node';
  return 'detail';
};

export const HEATMAP_CONFIG = {
  // Color temperature gradient stops (cold to hot)
  colorStops: [
    { value: 0.0, color: '#3B82F6' },  // Blue (cold)
    { value: 0.25, color: '#06B6D4' },  // Cyan
    { value: 0.5, color: '#10B981' },   // Green
    { value: 0.75, color: '#F59E0B' },  // Orange
    { value: 1.0, color: '#EF4444' },   // Red (hot)
  ],
  // Heat calculation weights
  weights: {
    reviewCount: 0.3,      // Weight for review frequency
    masteryStatus: 0.4,    // Weight for mastery level
    recentActivity: 0.3,   // Weight for recent activity
  },
  // Mastery status values
  masteryValues: {
    mastered: 1.0,
    learning: 0.6,
    due: 0.4,
    new: 0.2,
    locked: 0.0,
  },
  // Glow intensity range
  glowRange: { min: 0.1, max: 0.5 },
  // No-data fallback color
  noDataColor: '#9CA3AF',
  // Recent activity decay window (days)
  activityDecayDays: 7,
} as const;
