/** 悬浮覆盖面板的关键类型与工具函数：按「图谱 + 布局模式」缓存节点坐标，跨视图切换保留布局 */

export interface LayoutSeedPos {
  x: number;
  y: number;
}

export interface HasLayoutPos {
  id: string;
  x: number;
  y: number;
}

const layoutSeedCache = new Map<string, Map<string, LayoutSeedPos>>();

export const layoutCacheKey = (graphId?: string, mode?: string): string =>
  `${graphId ?? "anon"}:${mode ?? "force"}`;

/**
 * 汇总指定图谱模式的已知坐标。
 * 返回 complete=true 表示所有当前节点都有坐标（可直接复用上次布局）；
 * 同时返回带坐标的 Map（即使 incomplete）用于布局重算时的初始播种。
 */
export function collectLayoutSeeds(
  key: string,
  nodeIds: string[],
): { positions: Map<string, LayoutSeedPos>; complete: boolean } {
  const positions = new Map<string, LayoutSeedPos>(layoutSeedCache.get(key) ?? []);
  let complete = true;
  for (const id of nodeIds) {
    if (!positions.has(id)) {
      complete = false;
      break;
    }
  }
  return { positions, complete };
}

/** 写入布局结果坐标到缓存 */
export function cacheLayoutPositions(key: string, layoutNodes: HasLayoutPos[]): void {
  const positions = new Map<string, LayoutSeedPos>();
  for (const n of layoutNodes) {
    positions.set(String(n.id), { x: n.x, y: n.y });
  }
  layoutSeedCache.set(key, positions);
}

/**
 * 清除指定图谱（所有布局模式）的坐标缓存。
 * 用于「整理布局」这类需要重新布局的操作：清空后下次布局计算会真正重新运算，而非复用旧布局。
 */
export function invalidateGraphLayoutCache(graphId?: string): void {
  const prefix = `${graphId ?? "anon"}:`;
  for (const key of Array.from(layoutSeedCache.keys())) {
    if (key.startsWith(prefix)) {
      layoutSeedCache.delete(key);
    }
  }
}