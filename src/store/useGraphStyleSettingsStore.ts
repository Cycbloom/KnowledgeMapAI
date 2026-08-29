import { createPersistedStore } from './createPersistedStore';
import type {
  NodeShape,
  CenterDotShape,
  LinkCapStyle,
  ArrowStyle,
  GridStyle,
  ColorScheme,
  LinkStyle,
  LinkAnimation,
} from '@shared/types';

interface GraphStyleSettingsState {
  /** 全局节点形状（覆盖各层级默认圆形） */
  nodeShape: NodeShape;
  /** 全局中心圆点形状 */
  centerDotShape: CenterDotShape;
  /** 连线端点线帽 */
  linkCap: LinkCapStyle;
  /** 有向连线箭头样式 */
  arrowStyle: ArrowStyle;
  /** 固定粗细模式下的连线基础宽度 */
  linkWidth: number;
  /** 画布背景网格样式 */
  gridStyle: GridStyle;
  /** 配色方案 */
  colorScheme: ColorScheme;
  /** 连线样式（曲直/折线/贝塞尔） */
  linkStyle: LinkStyle;
  /** 连线动画 */
  linkAnimation: LinkAnimation;
  /** 全局「节点光晕」开关 */
  nodeGlow: boolean;
  setNodeShape: (shape: NodeShape) => void;
  setCenterDotShape: (shape: CenterDotShape) => void;
  setLinkCap: (cap: LinkCapStyle) => void;
  setArrowStyle: (style: ArrowStyle) => void;
  setLinkWidth: (width: number) => void;
  setGridStyle: (style: GridStyle) => void;
  setColorScheme: (scheme: ColorScheme) => void;
  setLinkStyle: (style: LinkStyle) => void;
  setLinkAnimation: (animation: LinkAnimation) => void;
  setNodeGlow: (enabled: boolean) => void;
  resetStyleSettings: () => void;
}

export const DEFAULT_STYLE_SETTINGS = {
  nodeShape: 'circle' as NodeShape,
  centerDotShape: 'circle' as CenterDotShape,
  linkCap: 'round' as LinkCapStyle,
  arrowStyle: 'triangle' as ArrowStyle,
  linkWidth: 2,
  gridStyle: 'hidden' as GridStyle,
  colorScheme: 'default' as ColorScheme,
  linkStyle: 'curved' as LinkStyle,
  linkAnimation: 'none' as LinkAnimation,
  nodeGlow: false,
};

export const useGraphStyleSettingsStore =
  createPersistedStore<GraphStyleSettingsState>(
    'graph-style-settings',
    (set) => ({
      ...DEFAULT_STYLE_SETTINGS,
      setNodeShape: (shape) => set({ nodeShape: shape }),
      setCenterDotShape: (shape) => set({ centerDotShape: shape }),
      setLinkCap: (cap) => set({ linkCap: cap }),
      setArrowStyle: (style) => set({ arrowStyle: style }),
      setLinkWidth: (width) =>
        set({
          linkWidth: Math.max(1, Math.min(6, Math.round(width))),
        }),
      setGridStyle: (style) => set({ gridStyle: style }),
      setColorScheme: (scheme) => set({ colorScheme: scheme }),
      setLinkStyle: (style) => set({ linkStyle: style }),
      setLinkAnimation: (animation) => set({ linkAnimation: animation }),
      setNodeGlow: (enabled) => set({ nodeGlow: enabled }),
      resetStyleSettings: () => set(DEFAULT_STYLE_SETTINGS),
    }),
    {
      version: 2,
      // 升版本后旧持久化缺新字段，用默认值浅合并补齐，避免旧数据丢失
      migrate: (persistedState) => {
        const data =
          persistedState && typeof persistedState === 'object'
            ? (persistedState as Partial<GraphStyleSettingsState>)
            : {};
        return {
          ...DEFAULT_STYLE_SETTINGS,
          ...data,
        } as unknown as GraphStyleSettingsState;
      },
      // 仅持久化用户可调项，忽略 action 函数
      partialize: (state) => ({
        nodeShape: state.nodeShape,
        centerDotShape: state.centerDotShape,
        linkCap: state.linkCap,
        arrowStyle: state.arrowStyle,
        linkWidth: state.linkWidth,
        gridStyle: state.gridStyle,
        colorScheme: state.colorScheme,
        linkStyle: state.linkStyle,
        linkAnimation: state.linkAnimation,
        nodeGlow: state.nodeGlow,
      }),
    },
  );