import { createPersistedStore } from './createPersistedStore';
import type {
  NodeShape,
  CenterDotShape,
  LinkCapStyle,
  ArrowStyle,
  GridStyle,
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
  setNodeShape: (shape: NodeShape) => void;
  setCenterDotShape: (shape: CenterDotShape) => void;
  setLinkCap: (cap: LinkCapStyle) => void;
  setArrowStyle: (style: ArrowStyle) => void;
  setLinkWidth: (width: number) => void;
  setGridStyle: (style: GridStyle) => void;
  resetStyleSettings: () => void;
}

export const DEFAULT_STYLE_SETTINGS = {
  nodeShape: 'circle' as NodeShape,
  centerDotShape: 'circle' as CenterDotShape,
  linkCap: 'round' as LinkCapStyle,
  arrowStyle: 'triangle' as ArrowStyle,
  linkWidth: 2,
  gridStyle: 'hidden' as GridStyle,
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
      resetStyleSettings: () => set(DEFAULT_STYLE_SETTINGS),
    }),
    {
      version: 1,
      // 仅持久化用户可调项，忽略 action 函数
      partialize: (state) => ({
        nodeShape: state.nodeShape,
        centerDotShape: state.centerDotShape,
        linkCap: state.linkCap,
        arrowStyle: state.arrowStyle,
        linkWidth: state.linkWidth,
        gridStyle: state.gridStyle,
      }),
    },
  );