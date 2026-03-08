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

export type ColorScheme =
  | "default"
  | "nature"
  | "ocean"
  | "sunset"
  | "forest"
  | "custom";

export type ThemePreset = "minimal" | "colorful" | "professional" | "custom";

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
