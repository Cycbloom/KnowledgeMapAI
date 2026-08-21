export const levelLabels: Record<string, string> = {
  root: 'graphMap.levelLabels.root',
  core: 'graphMap.levelLabels.core',
  sub: 'graphMap.levelLabels.sub',
  normal: 'graphMap.levelLabels.normal',
  leaf: 'graphMap.levelLabels.leaf'
};

export type SemanticZoomLevel = 'overview' | 'cluster' | 'node' | 'detail';

export const SEMANTIC_ZOOM_CONFIG = {
  levels: {
    overview: { minZoom: 0, maxZoom: 0.3, labelKey: 'graphMap.zoomLevel.overview' },
    cluster: { minZoom: 0.3, maxZoom: 0.7, labelKey: 'graphMap.zoomLevel.cluster' },
    node: { minZoom: 0.7, maxZoom: 1.5, labelKey: 'graphMap.zoomLevel.node' },
    detail: { minZoom: 1.5, maxZoom: 5, labelKey: 'graphMap.zoomLevel.detail' },
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

export const DECAY_CONFIG = {
  // Color gradient stops for decay visualization (fresh → decayed)
  // High retrievability = fresh/bright, Low retrievability = decayed/dim
  // Step (nearest-neighbor) interpolation within MASTERY_THRESHOLDS bands:
  //   [0, 0.25)    → #EF4444 red      (beginner)
  //   [0.25, 0.45) → #F59E0B amber    (introductory)
  //   [0.45, 0.65) → #3B82F6 blue     (familiar)
  //   [0.65, 0.82) → #8B5CF6 violet   (proficient)
  //   [0.82, 1.0]  → #22C55E green    (master)
  colorStops: [
    { value: 0.00000, color: '#EF4444' },
    { value: 0.24999, color: '#EF4444' },
    { value: 0.25000, color: '#F59E0B' },
    { value: 0.44999, color: '#F59E0B' },
    { value: 0.45000, color: '#3B82F6' },
    { value: 0.64999, color: '#3B82F6' },
    { value: 0.65000, color: '#8B5CF6' },
    { value: 0.81999, color: '#8B5CF6' },
    { value: 0.82000, color: '#22C55E' },
    { value: 1.00000, color: '#22C55E' },
  ],
  // Opacity mapping: lower retrievability = more transparent
  opacityRange: { min: 0.5, max: 1.0 },
  // Glow intensity range for decay mode
  glowRange: { min: 0.05, max: 0.4 },
  // No-data fallback color
  noDataColor: '#9CA3AF',
  // Threshold for "severely decayed" nodes (for pulse animation)
  severeDecayThreshold: 0.5,
  // Pulse animation config
  pulse: {
    duration: 2000,  // ms
    minScale: 1.0,
    maxScale: 1.05,
  },
} as const;
