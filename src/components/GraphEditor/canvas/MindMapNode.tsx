import React, { useMemo, useCallback, useState } from "react";
import { useTranslation } from "react-i18next";
import type {
  LayoutNode,
  NodeLevel,
  ColorScheme,
  GraphColorMode,
  Edge,
  NodeSizeMode,
  Node,
  NodeStatus,
} from "../../../types";
import { BACKBONE_MODULE_COLORS, type BackboneModule } from "@shared/types/graph";
import { NodeRing } from "./NodeRing";
import {
  NODE_STYLE_CONFIG,
  getRingRadius,
  getRingOpacity,
  getCenterDotRadius,
  getShadowStyle,
  getGradientId,
  getCenterDotPath,
} from "../../../config/nodeStyleConfig";
import {
  getLearningStatus,
  getStatusColors,
  getLevelColors,
  LEVEL_COLORS,
  getHeatmapColors,
  calculateNodeHeat,
  getDecayColors,
} from "../../../config/learningStatusColors";
import { HEATMAP_CONFIG, DECAY_CONFIG, type SemanticZoomLevel } from "../../../config/graphConfig";
import { getLevel, calculateNodeImportance } from "../../../utils/graph/graphUtils";
import type { NodeImportanceMaps } from "../../../utils/graph/analysis";
import { truncateText } from "../../../utils/textUtils";
import { BackboneNodeIcon } from "../BackboneNodeIcon";

interface MindMapNodeProps {
  node: LayoutNode;
  edges: Edge[];
  nodeStatus?: Record<string, NodeStatus>;
  selected: boolean;
  multiSelected?: boolean;
  isDark: boolean;
  zoomLevel: number;
  onClick: (e?: React.MouseEvent) => void;
  onMouseEnter?: (e: React.MouseEvent) => void;
  onMouseLeave?: () => void;
  focused?: boolean;
  forceShowText?: boolean;
  hasFocusMode?: boolean;
  colorScheme?: ColorScheme;
  coloringMode?: GraphColorMode;
  isNew?: boolean;
  nodeSizeMode?: NodeSizeMode;
  nodeImportance?: number;
  allNodes?: Node[];
  onContextMenu?: (event: React.MouseEvent, node: LayoutNode) => void;
  isSelectableAsParent?: boolean;
  isExcludedAsParent?: boolean;
  isSelectedAsParent?: boolean;
  isTouchPressed?: boolean;
  learningOrder?: number;
  isInLearningPath?: boolean;
  learningPathHighlighted?: boolean;
  isNarrativeCurrent?: boolean;
  isSearchHighlight?: boolean;
  semanticZoomLevel?: SemanticZoomLevel;
  showContentPreview?: boolean;
  showLearningStatus?: boolean;
  showReviewCount?: boolean;
  maxTitleLength?: number;
  childCount?: number;
  levelMap?: Map<string, NodeLevel>;
  importanceMaps?: NodeImportanceMaps;
  /** 全局「节点光晕」开关：开启时所有层级节点都渲染光晕 */
  nodeGlow?: boolean;
}

// 提取到函数外部，避免每次调用都创建新对象
const TEXT_VISIBILITY_THRESHOLDS: Record<
  NodeLevel,
  { minZoom: number; maxZoom: number; maxOpacity: number }
> = {
  root: { minZoom: 0, maxZoom: 5, maxOpacity: 1 },
  core: { minZoom: 0.05, maxZoom: 5, maxOpacity: 1 },
  sub: { minZoom: 0.15, maxZoom: 5, maxOpacity: 0.95 },
  normal: { minZoom: 0.25, maxZoom: 5, maxOpacity: 0.9 },
  leaf: { minZoom: 0.4, maxZoom: 5, maxOpacity: 0.85 },
};

const getTextVisibility = (
  level: NodeLevel,
  zoomLevel: number,
  forceShowText: boolean = false,
): { visible: boolean; opacity: number } => {
  if (forceShowText) {
    return { visible: true, opacity: 1 };
  }

  const threshold =
    TEXT_VISIBILITY_THRESHOLDS[level] || TEXT_VISIBILITY_THRESHOLDS.leaf;
  // 根据缩放级别和节点层级决定是否显示文字
  const visible = zoomLevel >= threshold.minZoom;

  let opacity = 0;
  if (visible) {
    if (zoomLevel <= threshold.minZoom + 0.2) {
      // 进入阈值范围时的淡入效果
      opacity = Math.min(
        threshold.maxOpacity,
        (zoomLevel - threshold.minZoom) * 5,
      );
    } else {
      // 近处视角保持完全不透明，只有远处才淡化
      opacity = threshold.maxOpacity;
    }
  }

  return { visible, opacity };
};

const MindMapNodeComponent: React.FC<MindMapNodeProps> = ({
  node,
  edges,
  nodeStatus,
  selected,
  multiSelected = false,
  isDark,
  zoomLevel,
  onClick,
  onMouseEnter,
  onMouseLeave,
  focused = false,
  forceShowText = false,
  hasFocusMode = false,
  colorScheme = "default",
  coloringMode = "status",
  isNew = false,
  nodeSizeMode = "fixed",
  nodeImportance,
  allNodes = [],
  onContextMenu,
  isSelectableAsParent = false,
  isExcludedAsParent = false,
  isSelectedAsParent = false,
  isTouchPressed = false,
  learningOrder,
  isInLearningPath = false,
  learningPathHighlighted = false,
  isNarrativeCurrent = false,
  isSearchHighlight = false,
  semanticZoomLevel,
  showContentPreview = false,
  showLearningStatus = false,
  showReviewCount = false,
  maxTitleLength,
  childCount = 0,
  levelMap,
  importanceMaps,
  nodeGlow = false,
}) => {
  /** @mastery display - 思维导图节点渲染：display_mastery 用于 decay 着色、不透明度、严重衰退标记等纯视觉效果 */
  const { t } = useTranslation();
  const [isHovered, setIsHovered] = useState(false);
  const level = getLevel(node, edges, levelMap);
  const tags = useMemo(
    () => node.tags || node.properties?.tags || [],
    [node.tags, node.properties],
  );
  const needsRefinement = node.properties?.needsRefinement ?? false;
  const backboneModule = node.properties?.backboneModule as
    | BackboneModule
    | undefined;
  const sourceCount =
    node.properties?.sourceCount ?? node.properties?.sources?.length ?? 0;
  const titleInfo = useMemo(
    () => truncateText(node.title || t("graphEditor.mindMap.unnamed")),
    [node.title, t],
  );

  // Apply semantic zoom title truncation
  const displayTitle = useMemo(() => {
    if (maxTitleLength !== undefined && maxTitleLength > 0 && maxTitleLength < Infinity) {
      const raw = node.title || t("graphEditor.mindMap.unnamed");
      if (raw.length > maxTitleLength) {
        return `${raw.slice(0, maxTitleLength)  }...`;
      }
      return raw;
    }
    return titleInfo.truncated;
  }, [maxTitleLength, node.title, t, titleInfo.truncated]);

  const dynamicSize = useMemo(() => {
    if (nodeSizeMode === "fixed") {
      return 1.0;
    }

    if (nodeImportance !== undefined) {
      return 0.8 + nodeImportance * 0.7;
    }

    if (allNodes.length > 0) {
      const importance = calculateNodeImportance(
        node as Node,
        allNodes,
        edges,
        nodeStatus,
        undefined,
        undefined,
        importanceMaps,
      );
      return 0.8 + importance.score * 0.7;
    }

    return 1.0;
  }, [nodeSizeMode, nodeImportance, allNodes, node, edges, nodeStatus, importanceMaps]);

  const styleConfig = useMemo(() => {
    const baseConfig = NODE_STYLE_CONFIG[level];
    return {
      ...baseConfig,
      baseRadius: baseConfig.baseRadius * dynamicSize,
    };
  }, [level, dynamicSize]);

  const status = getLearningStatus(nodeStatus?.[node.id]);
  const colors = useMemo(() => {
    let result: typeof LEVEL_COLORS.normal;
    if (coloringMode === "level") {
      result = getLevelColors(level, isDark);
    } else if (coloringMode === "heatmap") {
      const heatValue = calculateNodeHeat(nodeStatus?.[node.id]);
      result = getHeatmapColors(heatValue, isDark);
    } else if (coloringMode === "decay") {
      const status = nodeStatus?.[node.id];
      /** @mastery display - decay 模式节点颜色：display_mastery 优先于 retrievability 用于颜色映射 */
      const displayMastery = status?.display_mastery;
      const retrievability = status?.fsrs_retrievability;
      const decayValue = displayMastery != null
        ? displayMastery
        : (retrievability != null ? retrievability : -1);
      result = getDecayColors(decayValue, 'displayMastery', isDark);
    } else {
      result = getStatusColors(status, isDark, colorScheme);
    }
    if (!result.primary) {
      result = LEVEL_COLORS.normal;
    }
    return result;
  }, [coloringMode, level, status, isDark, colorScheme, nodeStatus, node.id]);

  const textVisibility = getTextVisibility(level, zoomLevel, forceShowText);

  const heatGlowIntensity = useMemo(() => {
    if (coloringMode === "heatmap") {
      const heat = calculateNodeHeat(nodeStatus?.[node.id]);
      if (heat < 0) return undefined;
      const { glowRange } = HEATMAP_CONFIG;
      return glowRange.min + (glowRange.max - glowRange.min) * heat;
    }
    if (coloringMode === "decay") {
      const status = nodeStatus?.[node.id];
      /** @mastery display - heat glow 强度：基于 display_mastery 计算辉光效果（视觉） */
      const displayMastery = status?.display_mastery;
      const retrievability = status?.fsrs_retrievability;
      const decayValue = displayMastery != null ? displayMastery : retrievability;
      if (decayValue == null) return undefined;
      const { glowRange } = DECAY_CONFIG;
      return glowRange.min + (glowRange.max - glowRange.min) * decayValue;
    }
    return undefined;
  }, [coloringMode, nodeStatus, node.id]);

  const nodeOpacity = !hasFocusMode ? 1 : focused ? 1 : 0.3;
  const decayOpacity = coloringMode === "decay" && colors.opacity != null ? colors.opacity : 1;
  const learningPathOpacity = isInLearningPath
    ? 1
    : learningPathHighlighted
      ? 0.4
      : 1;
  const finalOpacity = learningPathHighlighted
    ? learningPathOpacity
    : Math.min(nodeOpacity, decayOpacity);
  const isAccepted = node.is_accepted !== false;
  const decayStatus = nodeStatus?.[node.id];
  /** @mastery display - 严重衰退高亮判定：display_mastery 低于阈值显示警告样式（视觉） */
  const displayMasteryForDecay = decayStatus?.display_mastery;
  const fsrsRetrievability = decayStatus?.fsrs_retrievability;
  const decayMetric = displayMasteryForDecay != null ? displayMasteryForDecay : fsrsRetrievability;
  const isSeverelyDecayed = coloringMode === "decay" &&
    decayMetric != null &&
    decayMetric < DECAY_CONFIG.severeDecayThreshold;
  const hoverScale =
    isHovered || isTouchPressed ? styleConfig.animation.hoverScale : 1;
  const showHoverGlow = isHovered && styleConfig.animation.hoverGlow;
  const shadowStyle = getShadowStyle(styleConfig.shadow);
  const transitionDuration = styleConfig.animation.transitionDuration;

  const animationTransform = useMemo(() => {
    if (!isNew) return { scale: 1, opacity: 1 };
    return { scale: 0, opacity: 0 };
  }, [isNew]);

  const currentScale = isNew ? hoverScale : animationTransform.scale;
  const narrativeScale = isNarrativeCurrent ? 1.2 : 1;
  const effectiveScale = currentScale * narrativeScale;
  const currentOpacity = isNew
    ? isAccepted
      ? finalOpacity
      : finalOpacity * 0.5
    : finalOpacity;

  const rings = useMemo(() => {
    const result = [];
    // 全局光晕开关开启时，所有层级节点均渲染渐变光晕盘
    const glowEnabled = nodeGlow || styleConfig.showGlow;
    for (let i = 0; i < styleConfig.rings; i++) {
      const radius = getRingRadius(
        styleConfig.baseRadius,
        i,
        styleConfig.rings,
        styleConfig.ringSpacing,
      );
      const opacity = getRingOpacity(i, styleConfig.rings);
      const color = i === 0 ? colors.primary : colors.secondary;
      const gradientId = getGradientId(node.id, i);

      result.push(
        <NodeRing
          key={`ring-${i}`}
          radius={radius}
          strokeWidth={styleConfig.strokeWidth}
          color={color}
          opacity={opacity}
          dashArray={styleConfig.dashArray}
          showGlow={i === 0 && glowEnabled}
          glowColor={colors.glow}
          glowId={i === 0 && glowEnabled ? `glow-${node.id}` : undefined}
          gradient={styleConfig.gradient}
          gradientId={gradientId}
          enableRotation={styleConfig.animation.enablePulse && i === 0}
          rotationSpeed={styleConfig.animation.pulseSpeed}
          shadowBlur={styleConfig.shadow.enabled ? styleConfig.shadow.blur : 0}
          shadowColor={styleConfig.shadow.color}
        />,
      );
    }
    return result;
  }, [styleConfig, colors.primary, colors.secondary, colors.glow, node.id, nodeGlow]);

  const gradientDefinitions = useMemo(() => {
    const defs = [];
    defs.push(
      <linearGradient
        key="multiSelectGradient"
        id="multiSelectGradient"
        x1="0%"
        y1="0%"
        x2="100%"
        y2="100%"
      >
        <stop offset="0%" stopColor="#3b82f6" stopOpacity="1" />
        <stop offset="50%" stopColor="#8b5cf6" stopOpacity="1" />
        <stop offset="100%" stopColor="#ec4899" stopOpacity="1" />
      </linearGradient>,
    );
    defs.push(
      <linearGradient
        key="learningOrderGradient"
        id="learningOrderGradient"
        x1="0%"
        y1="0%"
        x2="100%"
        y2="100%"
      >
        <stop offset="0%" stopColor="#6366f1" stopOpacity="1" />
        <stop offset="100%" stopColor="#a855f7" stopOpacity="1" />
      </linearGradient>,
    );
    for (let i = 0; i < styleConfig.rings; i++) {
      const gradientId = getGradientId(node.id, i);
      const gradientColors =
        styleConfig.gradient.colors.length > 0
          ? styleConfig.gradient.colors
          : [colors.primary, colors.secondary];

      if (styleConfig.gradient.enabled) {
        if (styleConfig.gradient.type === "radial") {
          defs.push(
            <radialGradient
              key={gradientId}
              id={gradientId}
              cx="50%"
              cy="50%"
              r="50%"
            >
              <stop
                offset="0%"
                stopColor={gradientColors[0]}
                stopOpacity="0.8"
              />
              <stop
                offset="100%"
                stopColor={gradientColors[1] || gradientColors[0]}
                stopOpacity="0.2"
              />
            </radialGradient>,
          );
        } else {
          const angle = styleConfig.gradient.angle || 0;
          const rad = (angle * Math.PI) / 180;
          const x1 = 50 - Math.cos(rad) * 50;
          const y1 = 50 - Math.sin(rad) * 50;
          const x2 = 50 + Math.cos(rad) * 50;
          const y2 = 50 + Math.sin(rad) * 50;

          defs.push(
            <linearGradient
              key={gradientId}
              id={gradientId}
              x1={`${x1}%`}
              y1={`${y1}%`}
              x2={`${x2}%`}
              y2={`${y2}%`}
            >
              <stop
                offset="0%"
                stopColor={gradientColors[0]}
                stopOpacity="0.8"
              />
              <stop
                offset="100%"
                stopColor={gradientColors[1] || gradientColors[0]}
                stopOpacity="0.2"
              />
            </linearGradient>,
          );
        }
      }
    }
    return defs;
  }, [
    styleConfig.gradient,
    colors.primary,
    colors.secondary,
    node.id,
    styleConfig.rings,
  ]);

  const centerDotRadius = styleConfig.showCenterDot
    ? getCenterDotRadius(styleConfig.baseRadius)
    : 0;
  const centerDotPath = getCenterDotPath(
    centerDotRadius,
    styleConfig.centerDotShape,
  );
  const maxRadius = useMemo(
    () =>
      getRingRadius(
        styleConfig.baseRadius,
        0,
        styleConfig.rings,
        styleConfig.ringSpacing,
      ) +
      styleConfig.strokeWidth / 2,
    [
      styleConfig.baseRadius,
      styleConfig.rings,
      styleConfig.strokeWidth,
      styleConfig.ringSpacing,
    ],
  );
  const textOffset = useMemo(() => maxRadius + 14, [maxRadius]);
  const baseFontSize = level === "root" ? 18 : level === "core" ? 16 : 14;
  const scaledFontSize = useMemo(() => {
    const calculatedSize = baseFontSize / zoomLevel;
    const englishScale = titleInfo.isEnglish ? 0.85 : 1;
    const adjustedSize = calculatedSize * englishScale;
    // 根据缩放级别调整文字大小范围
    let minSize, maxSize;
    if (zoomLevel < 0.5) {
      // 远距离，文字更小
      minSize = 6;
      maxSize = 16;
    } else if (zoomLevel < 1.5) {
      // 中距离，文字适中
      minSize = 8;
      maxSize = 20;
    } else {
      // 近距离，文字较大
      minSize = 12;
      maxSize = 28;
    }
    return Math.max(minSize, Math.min(maxSize, adjustedSize));
  }, [baseFontSize, zoomLevel, titleInfo.isEnglish]);
  const tagOffset = useMemo(
    () => textOffset + scaledFontSize * 1.4,
    [textOffset, scaledFontSize],
  );

  const handleClick = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      onClick(e);
    },
    [onClick],
  );

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
  }, []);

  const handleCircleClick = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      onClick(e);
    },
    [onClick],
  );

  const handleCircleMouseDown = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
  }, []);

  const handleMouseEnter = useCallback(
    (e: React.MouseEvent) => {
      setIsHovered(true);
      onMouseEnter?.(e);
    },
    [onMouseEnter],
  );

  const handleMouseLeave = useCallback(() => {
    setIsHovered(false);
    onMouseLeave?.();
  }, [onMouseLeave]);

  const handleContextMenu = useCallback(
    (e: React.MouseEvent) => {
      if (onContextMenu) {
        e.preventDefault();
        onContextMenu(e, node);
      }
    },
    [onContextMenu, node],
  );

  return (
    <g
      data-node-id={node.id}
      transform={`translate(${node.x}, ${node.y})`}
      className={isSeverelyDecayed ? "decay-pulse" : undefined}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onClick={handleClick}
      onMouseDown={handleMouseDown}
      onContextMenu={handleContextMenu}
      style={{
        cursor: isExcludedAsParent
          ? "not-allowed"
          : isSelectableAsParent
            ? "crosshair"
            : "pointer",
        opacity: isExcludedAsParent ? 0.3 : currentOpacity,
        transition: `opacity ${transitionDuration}ms ease`,
      }}
    >
      <title>{node.title ?? t("graphEditor.mindMap.unnamed")}</title>
      <svg width={0} height={0} aria-hidden="true">
        <defs>{gradientDefinitions}</defs>
      </svg>

      {isSelectableAsParent && !isSelectedAsParent && (
        <circle
          r={styleConfig.baseRadius + 12}
          fill="none"
          stroke="#f59e0b"
          strokeWidth={2}
          strokeDasharray="6 3"
          opacity={0.6}
          className="animate-pulse"
        />
      )}
      {isSelectableAsParent && isSelectedAsParent && (
        <circle
          r={styleConfig.baseRadius + 12}
          fill="none"
          stroke="#3b82f6"
          strokeWidth={3}
          opacity={0.8}
        />
      )}
      {isTouchPressed && (
        <circle
          r={styleConfig.baseRadius + 16}
          fill="none"
          stroke={colors.primary}
          strokeWidth={3}
          opacity={0.6}
          className="animate-pulse"
        />
      )}
      {learningPathHighlighted && (
        <circle
          r={styleConfig.baseRadius + 8}
          fill="none"
          stroke="#a855f7"
          strokeWidth={3}
          opacity={0.8}
          style={{
            filter: `drop-shadow(0 0 12px rgba(168, 85, 247, 0.6)) drop-shadow(0 0 24px rgba(168, 85, 247, 0.4))`,
          }}
        >
          <animate
            attributeName="r"
            values={`${styleConfig.baseRadius + 6};${styleConfig.baseRadius + 10};${styleConfig.baseRadius + 6}`}
            dur="2s"
            repeatCount="indefinite"
          />
          <animate
            attributeName="opacity"
            values="0.6;0.9;0.6"
            dur="2s"
            repeatCount="indefinite"
          />
        </circle>
      )}
      {isNarrativeCurrent && (
        <circle
          r={styleConfig.baseRadius + 12}
          fill="none"
          stroke="#3B82F6"
          strokeWidth={3}
          opacity={0.7}
        >
          <animate
            attributeName="r"
            values={`${styleConfig.baseRadius + 10};${styleConfig.baseRadius + 16};${styleConfig.baseRadius + 10}`}
            dur="1.5s"
            repeatCount="indefinite"
          />
          <animate
            attributeName="opacity"
            values="0.5;0.9;0.5"
            dur="1.5s"
            repeatCount="indefinite"
          />
        </circle>
      )}
      {isSearchHighlight && (
        <circle
          r={styleConfig.baseRadius + 4}
          fill="none"
          stroke="rgba(99, 102, 241, 0.7)"
          strokeWidth={3}
          opacity={0}
        >
          <animate
            attributeName="r"
            values={`${styleConfig.baseRadius + 4};${styleConfig.baseRadius + 20};${styleConfig.baseRadius + 4}`}
            dur="1s"
            repeatCount="3"
            begin="0s"
          />
          <animate
            attributeName="opacity"
            values="0.7;0;0.7"
            dur="1s"
            repeatCount="3"
            begin="0s"
          />
          <animate
            attributeName="strokeWidth"
            values="3;0;3"
            dur="1s"
            repeatCount="3"
            begin="0s"
          />
        </circle>
      )}
      <g
        style={{
          transition: `transform ${transitionDuration}ms ease`,
          transform: `scale(${effectiveScale})`,
          filter: heatGlowIntensity !== undefined
            ? `${shadowStyle} drop-shadow(0 0 ${12 / zoomLevel}px ${colors.glow}${Math.round(heatGlowIntensity * 255).toString(16).padStart(2, '0')})`
            : shadowStyle,
        }}
      >
        {isAccepted ? (
          <>
            {rings}

            {styleConfig.showCenterDot &&
              centerDotRadius > 0 &&
              styleConfig.centerDotShape === "circle" && (
                <circle
                  r={centerDotRadius}
                  fill={colors.primary}
                  style={{
                    filter:
                      selected || showHoverGlow
                        ? `drop-shadow(0 0 ${8 / zoomLevel}px ${colors.glow})`
                        : "none",
                  }}
                />
              )}

            {styleConfig.showCenterDot &&
              centerDotRadius > 0 &&
              styleConfig.centerDotShape !== "circle" &&
              centerDotPath && (
                <path
                  d={centerDotPath}
                  fill={colors.primary}
                  style={{
                    filter:
                      selected || showHoverGlow
                        ? `drop-shadow(0 0 ${8 / zoomLevel}px ${colors.glow})`
                        : "none",
                  }}
                />
              )}

            {selected && (
              <circle
                r={styleConfig.baseRadius + 8}
                fill="none"
                stroke={colors.primary}
                strokeWidth={2}
                opacity={0.5}
                strokeDasharray="4 4"
              />
            )}

            {needsRefinement && (
              <>
                <circle
                  r={styleConfig.baseRadius + 4}
                  fill="none"
                  stroke={
                    backboneModule
                      ? BACKBONE_MODULE_COLORS[backboneModule]
                      : "#f59e0b"
                  }
                  strokeWidth={2}
                  strokeDasharray="6 3"
                  opacity={0.8}
                >
                  <animate
                    attributeName="stroke-dashoffset"
                    values="0;18"
                    dur="2s"
                    repeatCount="indefinite"
                  />
                </circle>
              </>
            )}

            {multiSelected && !selected && (
              <>
                <circle
                  r={styleConfig.baseRadius + 14}
                  fill="none"
                  stroke="url(#multiSelectGradient)"
                  strokeWidth={3}
                  opacity={0.9}
                  className="animate-pulse"
                />
                <circle
                  r={styleConfig.baseRadius + 10}
                  fill="none"
                  stroke="#8b5cf6"
                  strokeWidth={2}
                  strokeDasharray="4 2"
                  opacity={0.7}
                />
              </>
            )}
          </>
        ) : (
          <>
            <rect
              x={-styleConfig.baseRadius}
              y={-styleConfig.baseRadius}
              width={styleConfig.baseRadius * 2}
              height={styleConfig.baseRadius * 2}
              rx={4}
              fill={
                isDark ? "rgba(156, 163, 175, 0.3)" : "rgba(107, 114, 128, 0.3)"
              }
              stroke={
                isDark ? "rgba(156, 163, 175, 0.5)" : "rgba(107, 114, 128, 0.5)"
              }
              strokeWidth={1.5}
            />
            {selected && (
              <rect
                x={-styleConfig.baseRadius - 4}
                y={-styleConfig.baseRadius - 4}
                width={styleConfig.baseRadius * 2 + 8}
                height={styleConfig.baseRadius * 2 + 8}
                rx={6}
                fill="none"
                stroke={colors.primary}
                strokeWidth={2}
                opacity={0.5}
                strokeDasharray="4 4"
              />
            )}
          </>
        )}
      </g>

      <circle
        r={maxRadius}
        fill="transparent"
        onClick={handleCircleClick}
        onMouseDown={handleCircleMouseDown}
      />

      {backboneModule && textVisibility.visible && (
        <g
          transform={`translate(${-styleConfig.baseRadius * 0.6}, ${-styleConfig.baseRadius * 0.8})`}
          opacity={textVisibility.opacity}
        >
          <foreignObject
            x={-10}
            y={-10}
            width={20}
            height={20}
            style={{ overflow: "visible" }}
          >
            <BackboneNodeIcon
              module={backboneModule}
              size="small"
              showTooltip={true}
            />
          </foreignObject>
        </g>
      )}

      {textVisibility.visible && (
        <text
          x={backboneModule ? styleConfig.baseRadius * 0.3 : 0}
          y={textOffset}
          textAnchor="middle"
          dominantBaseline="middle"
          fontSize={scaledFontSize}
          fontWeight={level === "root" ? 700 : level === "core" ? 600 : 500}
          fill={isDark ? "#f1f5f9" : "#0f172a"}
          opacity={textVisibility.opacity * (isAccepted ? 1 : 0.6)}
          style={{
            pointerEvents: "none",
            transition: `opacity ${transitionDuration}ms ease`,
            textShadow: isDark
              ? `0 ${2 / zoomLevel}px ${4 / zoomLevel}px rgba(0,0,0,0.8), 0 0 ${8 / zoomLevel}px rgba(0,0,0,0.4)`
              : `0 ${2 / zoomLevel}px ${4 / zoomLevel}px rgba(0,0,0,0.15), 0 0 ${8 / zoomLevel}px rgba(0,0,0,0.1)`,
          }}
        >
          {displayTitle}
          {titleInfo.isTruncated && <title>{titleInfo.original}</title>}
        </text>
      )}

      {textVisibility.visible && tags && tags.length > 0 && (
        <text
          x={0}
          y={tagOffset}
          textAnchor="middle"
          dominantBaseline="middle"
          fontSize={scaledFontSize * 0.8}
          fontWeight={400}
          fill={isDark ? "#cbd5e1" : "#475569"}
          opacity={textVisibility.opacity * 0.8}
          style={{
            pointerEvents: "none",
            transition: `opacity ${transitionDuration}ms ease`,
            textShadow: isDark
              ? `0 ${1 / zoomLevel}px ${2 / zoomLevel}px rgba(0,0,0,0.8)`
              : "none",
          }}
        >
          {tags.slice(0, 3).join(", ") + (tags.length > 3 ? "..." : "")}
        </text>
      )}

      {textVisibility.visible && needsRefinement && (
        <g
          transform={`translate(0, ${tagOffset + (tags && tags.length > 0 ? scaledFontSize * 1.2 : 0)})`}
        >
          <rect
            x={-30}
            y={-8}
            width={60}
            height={16}
            rx={8}
            fill={
              backboneModule
                ? BACKBONE_MODULE_COLORS[backboneModule]
                : "#f59e0b"
            }
            opacity={0.9}
          />
          <text
            textAnchor="middle"
            dominantBaseline="middle"
            fontSize={10}
            fontWeight={500}
            fill="white"
            style={{ pointerEvents: "none" }}
          >
            {t("graphEditor.mindMapNode.needsRefinement")}
          </text>
        </g>
      )}

      {learningOrder !== undefined && learningOrder > 0 && (
        <g
          transform={`translate(${styleConfig.baseRadius * 0.7}, ${-styleConfig.baseRadius * 0.7})`}
        >
          <circle
            r={10}
            fill="url(#learningOrderGradient)"
            style={{
              filter: "drop-shadow(0 2px 4px rgba(0,0,0,0.3))",
            }}
          />
          {status === "mastered" ? (
            <path
              d="M-4 0 L-1 3 L4 -3"
              fill="none"
              stroke="white"
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          ) : (
            <text
              textAnchor="middle"
              dominantBaseline="central"
              fontSize={10}
              fontWeight={700}
              fill="white"
              style={{ pointerEvents: "none" }}
            >
              {learningOrder}
            </text>
          )}
        </g>
      )}

      {sourceCount > 0 && !learningOrder && (
        <g
          transform={`translate(${styleConfig.baseRadius * 0.7}, ${-styleConfig.baseRadius * 0.7})`}
        >
          <circle
            r={10}
            fill="#6366f1"
            style={{
              filter: "drop-shadow(0 2px 4px rgba(0,0,0,0.3))",
            }}
          />
          <text
            textAnchor="middle"
            dominantBaseline="central"
            fontSize={9}
            fontWeight={700}
            fill="white"
            style={{ pointerEvents: "none" }}
          >
            {sourceCount}
          </text>
        </g>
      )}

      {/* Semantic Zoom: Overview mode aggregate rendering */}
      {semanticZoomLevel === 'overview' && (level === 'root' || level === 'core') && childCount > 0 && (
        <g>
          <circle
            r={styleConfig.baseRadius * 1.5}
            fill={colors.primary}
            opacity={0.15}
          />
          <text
            textAnchor="middle"
            dominantBaseline="central"
            fontSize={12}
            fontWeight={700}
            fill={colors.primary}
            style={{ pointerEvents: "none" }}
          >
            {childCount}
          </text>
        </g>
      )}

      {/* Semantic Zoom: Detail level content preview */}
      {showContentPreview && (node.summary || node.content) && textVisibility.visible && (() => {
        const previewText = node.summary || (node.content ? node.content.slice(0, 30) + (node.content.length > 30 ? '...' : '') : '');
        return previewText ? (
          <text
            x={0}
            y={textOffset + scaledFontSize * 1.4}
            textAnchor="middle"
            dominantBaseline="middle"
            fontSize={scaledFontSize * 0.7}
            fontWeight={400}
            fill={isDark ? "#94A3B8" : "#64748B"}
            opacity={textVisibility.opacity * 0.8}
            style={{ pointerEvents: "none" }}
          >
            {previewText}
          </text>
        ) : null;
      })()}

      {/* Semantic Zoom: Detail level learning status badge */}
      {showLearningStatus && nodeStatus?.[node.id] && textVisibility.visible && (
        <g transform={`translate(0, ${textOffset + scaledFontSize * (showContentPreview && (node.summary || node.content) ? 2.6 : 1.4)})`}>
          <rect
            x={-24}
            y={-7}
            width={48}
            height={14}
            rx={7}
            fill={colors.primary}
            opacity={0.2}
          />
          <text
            textAnchor="middle"
            dominantBaseline="middle"
            fontSize={8}
            fontWeight={500}
            fill={colors.primary}
            style={{ pointerEvents: "none" }}
          >
            {status === 'mastered' ? t('graphEditor.mindMap.statusMastered') : status === 'learning' ? t('graphEditor.mindMap.statusLearning') : status === 'due' ? t('graphEditor.mindMap.statusDue') : status === 'locked' ? t('graphEditor.mindMap.statusLocked') : t('graphEditor.mindMap.statusNew')}
          </text>
        </g>
      )}

      {/* Semantic Zoom: Detail level review count */}
      {showReviewCount && nodeStatus?.[node.id]?.review_count !== undefined && textVisibility.visible && (
        <text
          x={0}
          y={textOffset + scaledFontSize * (showContentPreview && (node.summary || node.content) ? (showLearningStatus ? 3.8 : 2.6) : (showLearningStatus ? 2.6 : 1.4))}
          textAnchor="middle"
          dominantBaseline="middle"
          fontSize={scaledFontSize * 0.6}
          fontWeight={400}
          fill={isDark ? "#64748B" : "#94A3B8"}
          opacity={textVisibility.opacity * 0.6}
          style={{ pointerEvents: "none" }}
        >
          {t('graphEditor.mindMap.reviewCount', { count: nodeStatus?.[node.id].review_count })}
        </text>
      )}
    </g>
  );
};

export const MindMapNode = React.memo(
  MindMapNodeComponent,
  (prevProps, nextProps) => {
    const nodeStatusEqual =
      (!prevProps.nodeStatus && !nextProps.nodeStatus) ||
      (prevProps.nodeStatus &&
        nextProps.nodeStatus &&
        prevProps.nodeStatus[prevProps.node.id] ===
          nextProps.nodeStatus[nextProps.node.id]);

    return Boolean(
      prevProps.node.id === nextProps.node.id &&
      prevProps.selected === nextProps.selected &&
      prevProps.multiSelected === nextProps.multiSelected &&
      prevProps.focused === nextProps.focused &&
      prevProps.hasFocusMode === nextProps.hasFocusMode &&
      prevProps.zoomLevel === nextProps.zoomLevel &&
      prevProps.forceShowText === nextProps.forceShowText &&
      prevProps.isDark === nextProps.isDark &&
      prevProps.isNew === nextProps.isNew &&
      prevProps.isSelectableAsParent === nextProps.isSelectableAsParent &&
      prevProps.isExcludedAsParent === nextProps.isExcludedAsParent &&
      prevProps.isSelectedAsParent === nextProps.isSelectedAsParent &&
      prevProps.isTouchPressed === nextProps.isTouchPressed &&
      prevProps.learningOrder === nextProps.learningOrder &&
      prevProps.learningPathHighlighted === nextProps.learningPathHighlighted &&
      prevProps.isNarrativeCurrent === nextProps.isNarrativeCurrent &&
      prevProps.semanticZoomLevel === nextProps.semanticZoomLevel &&
      prevProps.showContentPreview === nextProps.showContentPreview &&
      prevProps.showLearningStatus === nextProps.showLearningStatus &&
      prevProps.showReviewCount === nextProps.showReviewCount &&
      prevProps.maxTitleLength === nextProps.maxTitleLength &&
      prevProps.childCount === nextProps.childCount &&
      prevProps.node.x === nextProps.node.x &&
      prevProps.node.y === nextProps.node.y &&
      prevProps.node.title === nextProps.node.title &&
      prevProps.node.level === nextProps.node.level &&
      prevProps.node.is_accepted === nextProps.node.is_accepted &&
      prevProps.colorScheme === nextProps.colorScheme &&
      prevProps.coloringMode === nextProps.coloringMode &&
      prevProps.nodeSizeMode === nextProps.nodeSizeMode &&
      prevProps.nodeImportance === nextProps.nodeImportance &&
      prevProps.nodeGlow === nextProps.nodeGlow &&
      nodeStatusEqual,
    );
  },
);
