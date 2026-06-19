# 修复思维导图节点聚焦偏移问题

## 问题概述

点击思维导图节点后，节点聚焦位置偏左，没有在可用画布区域的正中央显示。从截图可见，右侧面板（节点详情）打开后，被选中的节点（"无监督学习"）明显偏左。

## 根因分析

### 关键代码路径

用户点击节点时的调用链：

1. `MindMapNode.onClick` → `interaction.handleNodeClick(node)` → `onNodeClick(node)`
2. GraphEditor 的 `handleNodeClick()` 同时执行：
   - `setFocusedNodeId(node.id)` — 触发聚焦动画
   - `setSidebarMode("detail")` — 打开右侧面板
3. MindMapCanvas 的 `focusedNodeId` useEffect（[MindMapCanvas.tsx:585-595](src/components/GraphEditor/canvas/MindMapCanvas.tsx#L585-L595)）响应变化，执行聚焦动画

### 视口中心计算

`visualCenterX` 在 [useCanvasInteraction.ts:466-468](src/components/GraphEditor/canvas/MindMapCanvas/useCanvasInteraction.ts#L466-L468) 中计算：

```typescript
const visualCenterX = useMemo(() => {
    return (containerSize.width - rightPanelWidth + leftPanelWidth) / 2;
}, [rightPanelWidth, leftPanelWidth, containerSize.width]);
```

### 问题定位：`centerNode` 与 `focusedNodeId` effect 的计算不一致

对比两处聚焦逻辑：

| | `centerNode` 命令式方法 ([L434-453](src/components/GraphEditor/canvas/MindMapCanvas.tsx#L434-L453)) | `focusedNodeId` effect ([L585-595](src/components/GraphEditor/canvas/MindMapCanvas.tsx#L585-L595)) |
|---|---|---|
| 中心X计算 | `(containerSize.width - effectiveRightWidth) / 2` | `interaction.visualCenterX` = `(width - rightPanelWidth + leftPanelWidth) / 2` |
| rightPanel回退 | `rightPanelWidth \|\| 340` （有 forceRightPanelOpen 选项） | 无回退，直接使用 prop 值 |
| leftPanel处理 | **未包含** leftPanelWidth | **包含** leftPanelWidth |

**核心问题**：`centerNode` 方法明确知道面板可能正在打开，提供了 `forceRightPanelOpen` 选项和 `|| 340` 的回退值。但 `focusedNodeId` effect 没有类似的保护机制。

虽然 `state.sidebarWidth` 初始值为 340（[useSidebarState.ts:20](src/hooks/graphEditor/useSidebarState.ts#L20)），且右侧面板是 `absolute` 定位的覆盖层（不影响容器宽度），但存在以下潜在风险：

1. **React 批量更新的时序**：`setFocusedNodeId` 和 `setSidebarMode` 虽然在同一事件处理中批量更新，但 `focusedNodeId` effect 依赖的 `visualCenterX` 是一个 `useMemo`，其依赖链较长
2. **`centerNode` 已有的防御性代码**说明开发者已意识到此问题——它用 `|| 340` 作为回退值，而 `focusedNodeId` effect 缺少同样的保护

## 修复方案

### 修改文件

**文件**: [src/components/GraphEditor/canvas/MindMapCanvas.tsx](src/components/GraphEditor/canvas/MindMapCanvas.tsx)

**修改 `focusedNodeId` useEffect（第 585-595 行）**：

将 effect 内的中心点计算改为与 `centerNode` 方法一致的方式，直接基于 props 计算有效中心点，而非依赖 `interaction.visualCenterX`：

```typescript
// 修改前
useEffect(() => {
    if (focusedNodeId && layout) {
        const node = layout.nodes.find((n) => n.id === focusedNodeId);
        if (node) {
            const targetK = 1.2;
            const targetX = interaction.visualCenterX - node.x * targetK;
            const targetY = interaction.visualCenterY - node.y * targetK;
            animateCamera(targetX, targetY, targetK, 800);
        }
    }
}, [focusedNodeId, layout, interaction.visualCenterX, interaction.visualCenterY, animateCamera]);

// 修改后
useEffect(() => {
    if (focusedNodeId && layout) {
        const node = layout.nodes.find((n) => n.id === focusedNodeId);
        if (node) {
            // 与 centerNode 方法保持一致的计算方式
            const effectiveRightWidth = rightPanelWidth || 0;
            const effectiveVisualCenterX =
                (containerSize.width - effectiveRightWidth) / 2;

            const targetK = 1.2;
            const targetX = effectiveVisualCenterX - node.x * targetK;
            const targetY = interaction.visualCenterY - node.y * targetK;
            animateCamera(targetX, targetY, targetK, 800);
        }
    }
}, [focusedNodeId, layout, containerSize.width, rightPanelWidth, interaction.visualCenterY, animateCamera]);
```

### 同时修复初始定位 effect（第 551-583 行）

该 effect 也使用 `interaction.visualCenterX`，在首次加载且 `focusedNodeId` 为 null 时定位根节点。为保持一致性，同样改用直接计算：

```typescript
// 修改前
const targetX = interaction.visualCenterX - rootNode.x * targetK;
const targetY = interaction.visualCenterY - rootNode.y * targetK;

// 修改后（在同一 effect 内）
const effectiveRightWidth = rightPanelWidth || 0;
const effectiveLeftWidth = leftPanelWidth || 0;
const initVisualCenterX =
    (effectiveLeftWidth + containerSize.width - effectiveRightWidth) / 2;

const targetX = initVisualCenterX - rootNode.x * targetK;
const targetY = interaction.visualCenterY - rootNode.y * targetK;
```

effect 依赖数组需同步更新，加入 `containerSize.width`, `rightPanelWidth`, `leftPanelWidth`。

## 验证步骤

1. 打开思维导图页面，确认初始状态下根节点居中
2. 点击任意节点，验证：
   - 右侧面板打开
   - 被点击节点在**可用画布区域**（排除右侧面板后）的水平中心
3. 再次点击其他节点，验证聚焦位置正确
4. 关闭右侧面板（点击空白处），验证根节点复位到完整画布中心
5. 运行 `npm run check:incremental` 和 `npm run lint` 确保无类型/代码错误
