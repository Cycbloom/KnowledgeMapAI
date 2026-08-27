export type NodeStyleVariant =
  | "single"
  | "double"
  | "triple"
  | "dashed"
  | "dotted"
  | "gradient"
  | "filled"
  | "outlined"
  | "gradient-fill";

export type NodeShape = "circle" | "square" | "diamond" | "hexagon" | "star";

export type CenterDotShape = "circle" | "diamond" | "star" | "none";

export type LinkStyle = "curved" | "straight" | "step" | "bezier";

export type LinkAnimation = "none" | "flow" | "pulse" | "dash";

/** SVG 连线端点线帽样式 */
export type LinkCapStyle = "round" | "square" | "butt";

/** 有向连线箭头样式 */
export type ArrowStyle = "triangle" | "chevron" | "circle";

/** 画布背景网格样式 */
export type GridStyle = "hidden" | "lines" | "dots";

export type ColorScheme =
  | "default"
  | "nature"
  | "ocean"
  | "sunset"
  | "forest"
  | "custom";

export type ThemePreset = 'default' | 'ocean' | 'forest' | 'sunset' | 'lavender' | 'rose' | 'midnight';

export interface ShadowConfig {
  enabled: boolean;
  blur: number;
  offsetX: number;
  offsetY: number;
  color: string;
}

export interface AnimationConfig {
  hoverScale: number;
  hoverGlow: boolean;
  transitionDuration: number;
  enablePulse: boolean;
  pulseSpeed: number;
}

export interface GradientConfig {
  enabled: boolean;
  type: "linear" | "radial";
  colors: string[];
  angle?: number;
}

export interface NodeStyle {
  variant: NodeStyleVariant;
  rings: number;
  radius: number;
  strokeWidth: number;
  showCenterDot: boolean;
  showGlow: boolean;
  shape: NodeShape;
  centerDotShape: CenterDotShape;
  shadow: ShadowConfig;
  animation: AnimationConfig;
  ringSpacing: number;
  gradient: GradientConfig;
}
