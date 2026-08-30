import { createPersistedStore } from './createPersistedStore';

export type GraphMapPositionMap = Record<string, { x: number; y: number }>;

interface GraphMapLayoutState {
  /** 图谱地图节点坐标：graphId -> {x,y}，本地持久化用于实现「固定布局」 */
  positions: GraphMapPositionMap;
  saveLayout: (positions: GraphMapPositionMap) => void;
  resetLayout: () => void;
}

export const useGraphMapLayoutStore = createPersistedStore<GraphMapLayoutState>(
  'graph-map-layout',
  (set) => ({
    positions: {},
    saveLayout: (positions) => set({ positions }),
    resetLayout: () => set({ positions: {} }),
  }),
  {
    partialize: (state) => ({ positions: state.positions }),
  },
);