export interface AIConfig {
  provider: string;
  model: string;
}

export interface AvailableModels {
  deepseek: string[];
  volcengine: string[];
  aliyun: string[];
  [key: string]: string[];
}

export interface User {
  id: string;
  email: string;
  name?: string;
  user_metadata?: {
    name?: string;
    [key: string]: any;
  };
  profile?: {
    settings?: {
      request_retention?: number;
      maximum_interval?: number;
      ai_config?: {
        text?: AIConfig;
        embedding?: AIConfig;
        reasoning?: AIConfig;
      };
      available_models?: AvailableModels;
    };
    [key: string]: any;
  };
}

export interface Graph {
  id: string;
  title: string;
  description?: string;
  settings?: {
    gamification_enabled?: boolean;
    learning_direction?: 'top_down' | 'bottom_up';
    text_display_level?: 'all' | 'important' | 'root_only';
    [key: string]: any;
  };
  created_at: string;
  nodes_count?: number;
}

export type NodeLevel = 'root' | 'core' | 'sub' | 'normal' | 'leaf';

export interface Node {
  id: string;
  graph_id: string;
  title: string;
  content?: string;
  x_position: number;
  y_position: number;
  color?: string;
  level?: NodeLevel;
  properties?: Record<string, any>;
  learning_material?: string;
  updated_at?: string;
  created_at?: string;
}

export interface Edge {
  id: string;
  source_node_id: string;
  target_node_id: string;
  relationship_type?: string;
}

export interface StudyCard {
  id: string;
  node_id: string;
  question: string;
  answer: string;
  card_type: 'qa' | 'choice' | 'true_false' | 'multi_choice' | 'fill_in_the_blank' | 'essay';
  options?: string[];
  explanation?: string;
  next_review: string;
  review_count?: number;
  fsrs_state?: number;
}

export interface Task {
  id: string;
  user_id: string;
  type: 'generate_questions' | 'expand_graph' | 'batch_generate_questions' | string;
  name?: string;
  status: 'pending' | 'processing' | 'completed' | 'failed' | string;
  payload: any;
  result: any;
  error?: string;
  created_at: string;
  updated_at: string;
}

export type LearningStatus = 'mastered' | 'due' | 'locked' | 'new' | 'learning';

export interface NodeStatus {
  locked: boolean;
  mastered: boolean;
  due_today?: boolean;
  due?: boolean;
  review_count?: number;
  next_review?: string;
}

export interface LayoutNode extends Node {
  x: number;
  y: number;
  vx?: number;
  vy?: number;
  fx?: number | null;
  fy?: number | null;
}

export interface LayoutLink extends Edge {
  source: string | LayoutNode;
  target: string | LayoutNode;
}

export type NodeStyleVariant = 'single' | 'double' | 'triple' | 'dashed' | 'dotted' | 'gradient' | 'filled' | 'outlined' | 'gradient-fill';

export type NodeShape = 'circle' | 'square' | 'diamond' | 'hexagon' | 'star';

export type CenterDotShape = 'circle' | 'diamond' | 'star' | 'none';

export type LinkStyle = 'curved' | 'straight' | 'step' | 'bezier';

export type LinkAnimation = 'none' | 'flow' | 'pulse' | 'dash';

export type ColorScheme = 'default' | 'nature' | 'ocean' | 'sunset' | 'forest' | 'custom';

export type ThemePreset = 'minimal' | 'colorful' | 'professional' | 'custom';

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
  type: 'linear' | 'radial';
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

export type ExplorationMode = 'none' | 'branch' | 'timeline';

export interface BranchSuggestion {
  id: string;
  title: string;
  description: string;
  priority: 'high' | 'medium' | 'low';
  estimatedDifficulty: number;
  relatedTopics: string[];
}

export interface ExplorationPathItem {
  nodeId: string;
  nodeTitle: string;
  timestamp: Date;
  branchChoice: string;
  parentNodeId?: string;
  branchSuggestionId?: string;
}
