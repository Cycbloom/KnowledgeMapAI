# 象限视图点击高亮改为直接邻居 — 实施计划

## 现状分析

### 当前行为（问题所在）
用户点击节点 A 时，`getFocusedNodes()` 执行**双向 BFS 遍历所有祖先+后代**，返回的是以 A 为根的**整棵连通子图**。对于密集连接的图谱（如专题研究的 ~30 节点），几乎所有节点都被标记为 focused → 全部保持 opacity=1，**失去了"聚焦"的筛选效果**。

### 数据流
```
用户点击节点
  → GraphEditor.handleNodeClick()
    → getFocusedNodes(nodeId)     ← 双向BFS，返回整连通分量 ❌ 范围太大
    → getFocusedLinks(focusedNodes)
    → setFocusedNodeId / setFocusedNodeIds / setFocusedLinkIds
  → QuadrantCanvas 接收 props
    → QuadrantNode: opacity=1(focused) vs 0.3(其他) ✅ 已实现
    → QuadrantEdge: highlighted prop 未传入 ❌ 缺失
```

### 关键文件
| 文件 | 角色 | 需要修改 |
|------|------|---------|
| [traversal.ts](src/lib/graph/traversal.ts) | 邻居发现算法 | 新增 `getDirectNeighbors()` |
| [GraphEditor.tsx](src/pages/GraphEditor.tsx) | 状态管理中心 | handleNodeClick 改用新函数 |
| [QuadrantCanvas.tsx](src/components/GraphEditor/canvas/QuadrantCanvas.tsx) | 渲染层 | 向 QuadrantEdge 传入 highlighted |

## 实施步骤

### Step 1: 在 traversal.ts 中新增直接邻居函数
- 文件：`src/lib/graph/traversal.ts`
- 新增函数 `getDirectNeighbors(nodeId: string, edges: Edge[]): Set<string>`
- 逻辑：遍历 edges，收集 source 或 target 等于 nodeId 的另一端点
- 返回值：仅包含 1 跳距离的直接邻居（不含自身）
- 同时新增 `getDirectNeighborEdges(nodeId: string, neighborIds: Set<string>, edges: Edge[]): Set<string>`
- 逻辑：返回两端点都在 {nodeId ∪ neighborIds} 中的边 ID 集合

### Step 2: 修改 GraphEditor.tsx 的 handleNodeClick
- 文件：`src/pages/GraphEditor.tsx`
- 找到 `handleNodeClick` 回调（约第 919 行）
- 将 `getFocusedNodes(node.id, nodes, edges)` 替换为：
  ```typescript
  const neighbors = getDirectNeighbors(node.id, edges);
  const focusedNodes = new Set([node.id, ...neighbors]);
  ```
- 将 `getFocusedLinks(focusedNodes, edges)` 替换为：
  ```typescript
  const focusedLinks = getDirectNeighborEdges(node.id, focusedNodes, edges);
  ```
- 其余逻辑不变（setSelectedNode、setSidebarMode 等）

### Step 3: QuadrantCanvas 向 QuadrantEdge 传入 highlighted
- 文件：`src/components/GraphEditor/canvas/QuadrantCanvas.tsx`
- 需要接收新 prop `focusedLinkIds?: Set<string>`（或从现有 props 推导）
- 方案 A（推荐）：在 QuadrantCanvasProps 中添加 `focusedLinkIds?: Set<string>`
- 在渲染 `<QuadrantEdge>` 时：
  ```tsx
  <QuadrantEdge
    ...
    highlighted={focusedLinkIds?.has(String(edge.id))}
  />
  ```
- 在 GraphEditor.tsx 传递 QuadrantCanvas 处补充 `focusedLinkIds={focusedLinkIds}`

### Step 4: 验证
- 点击节点 → 仅该节点和直接邻居保持不透明，其余变淡 (opacity=0.3)
- 连接焦点节点与邻居的边线宽加粗 (strokeWidth=2)、透明度提升 (0.9)
- 点击空白区域 → 所有节点恢复不透明、边恢复正常样式
- MindMap 视图的聚焦行为不受影响（MindMap 有自己的独立逻辑）
