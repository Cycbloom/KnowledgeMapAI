# 知识图谱（CombinedGraphView）着色模式修复计划

## 问题摘要

用户报告知识星球（CombinedGraphView）视图存在以下问题：
1. **节点颜色缺失**：节点的着色模式（结构状态、热力图等）没有正确应用到视图上
2. **工具栏下拉菜单自动关闭 bug**：点击着色模式选项后，工具栏下拉菜单会自动关闭

## 当前状态分析

### 问题根因 1：nodeStatus 数据缺失
- **文件**: [CombinedGraphView.tsx](src/pages/CombinedGraphView.tsx)
- **问题**: 第 302-310 行，`MindMapCanvas` 组件没有被传入 `nodeStatus` prop
- **影响**: [MindMapNode.tsx](src/components/GraphEditor/canvas/MindMapNode.tsx) 第 214-228 行的颜色计算逻辑依赖 `nodeStatus`：
  - `status` 模式 → 需要 `learningStatus`
  - `heatmap` 模式 → 需要 `calculateNodeHeat(nodeStatus)`
  - `decay` 模式 → 需要 `fsrs_retrievability`
  - 只有 `level` 模式不依赖 `nodeStatus`（使用节点的 level 属性）
- **对比**: 正常的 [GraphEditor.tsx](src/pages/GraphEditor.tsx) 第 429 行通过 `useGraphNodeStatus(id)` 获取数据并在第 1274 行传给 MindMapCanvas

### 问题根因 2：着色模式切换逻辑不完整
- **文件**: [CombinedGraphView.tsx](src/pages/CombinedGraphView.tsx) 第 203-205 行
- **问题**: `handleToggleColoringMode` 只在 `'level'` 和 `'status'` 之间切换
- **应有模式**: `GraphColorMode = "level" | "status" | "heatmap" | "decay"` （共 4 种）
- **对比**: [GraphToolbar.tsx](src/components/GraphEditor/toolbar/GraphToolbar.tsx) 第 1488-1495 行实现了完整的 4 模式循环

### 问题根因 3：工具栏下拉菜单自动关闭
- **文件**: [GraphToolbar.tsx](src/components/GraphEditor/toolbar/GraphToolbar.tsx) 第 1016-1023 行
- **问题**: `MenuItem` 组件的点击处理逻辑中，当菜单项没有子菜单（`!children`）时，会执行 `setOpenDropdown(null)` 关闭下拉菜单
- **影响**: 着色模式切换项点击后下拉菜单关闭，用户体验差

## 修改方案

### 修改 1：CombinedGraphView 添加 nodeStatus 数据获取和传递

**文件**: `src/pages/CombinedGraphView.tsx`

**具体改动**:
1. 导入 `useBatchGraphStatus` hook（来自 `src/hooks/queries/useGraphQueries.ts`）
2. 在组件内调用 `useBatchGraphStatus([id1, id2])` 获取两个图谱的节点状态数据
3. 合并两个图谱的 nodeStatus 数据为一个对象
4. 将合并后的 `nodeStatus` 传递给 `MindMapCanvas` 组件

```typescript
// 新增导入
import { useBatchGraphStatus } from '../hooks/queries/useGraphQueries';

// 在组件内添加
const { data: graphStatusData } = useBatchGraphStatus([id1 || '', id2 || '']);

const mergedNodeStatus = useMemo(() => {
  const status1 = graphStatusData?.[id1 || ''] as Record<string, any> | undefined;
  const status2 = graphStatusData?.[id2 || ''] as Record<string, any> | undefined;
  return { ...(status1 || {}), ...(status2 || {}) };
}, [graphStatusData, id1, id2]);

// MindMapCanvas 添加 nodeStatus prop
<MindMapCanvas
  nodes={mergedNodes}
  edges={mergedEdges}
  selectedNodeId={selectedNode?.id || null}
  onNodeClick={handleNodeClick}
  coloringMode={coloringMode}
  nodeStatus={mergedNodeStatus}        // <-- 新增
  isRightPanelOpen={isSidebarOpen}
  rightPanelWidth={sidebarWidth}
/>
```

### 修改 2：完善着色模式切换逻辑

**文件**: `src/pages/CombinedGraphView.tsx`

**具体改动**: 更新 `handleToggleColoringMode` 函数，支持全部 4 种模式的循环切换：

```typescript
const handleToggleColoringMode = useCallback(() => {
  const nextMode: Record<GraphColorMode, GraphColorMode> = {
    level: 'status',
    status: 'heatmap',
    heatmap: 'decay',
    decay: 'level',
  };
  setColoringMode(prev => nextMode[prev] || 'level');
}, []);
```

### 修改 3：修复工具栏下拉菜单自动关闭

**文件**: `src/components/GraphEditor/toolbar/GraphToolbar.tsx`

**具体改动**: 为 `MenuItem` 组件添加 `keepDropdownOpen` 可选属性，当该属性为 true 时，点击后不关闭父级下拉菜单：

1. 在 `MenuItem` 接口中添加 `keepDropdownOpen?: boolean` 属性
2. 在点击处理逻辑中，根据 `keepDropdownOpen` 决定是否调用 `setOpenDropdown(null)`
3. 在着色模式 MenuItem 上设置 `keepDropdownOpen={true}`

```typescript
// MenuItem 接口添加
interface MenuItemProps {
  // ... 现有属性
  keepDropdownOpen?: boolean;  // <-- 新增
}

// 点击处理逻辑修改（约第 1016-1023 行）
onClick={(e) => {
  e.stopPropagation();
  if (children && keepOpenOnChildClick) {
    handleToggle?.();
  } else if (!children) {
    onClick?.();
    if (!keepDropdownOpen) {     // <-- 新增判断
      setOpenDropdown(null);
    }
  }
}}

// 着色模式 MenuItem 使用（约第 1487 行）
<MenuItem
  keepDropdownOpen={true}       // <-- 新增
  onClick={() => { /* 切换逻辑 */ }}
  // ... 其他属性
/>
```

## 假设与决策

1. **使用 `useBatchGraphStatus` 而非两次 `useGraphNodeStatus`**：项目中已有此批量查询 hook，可以一次性获取两个图谱的状态数据
2. **保持下拉菜单开启**：着色模式切换是高频操作，用户可能需要连续切换多次查看效果，保持菜单打开更符合用户预期
3. **不修改 CombinedGraphToolbar 的 UI**：CombinedGraphToolbar 使用的是简化的按钮式切换（非下拉菜单），主要问题集中在 GraphToolbar 的通用下拉菜单组件上

## 验证步骤

1. 启动开发服务器 `npm run electron:dev` 或 `npm run dev`
2. 导航到知识星球（CombinedGraphView）页面
3. **验证节点颜色**：
   - 切换着色模式，确认节点颜色随模式变化
   - level 模式：按层级显示颜色
   - status 模式：按学习状态显示颜色
   - heatmap 模式：按热力值显示颜色渐变
   - decay 模式：按遗忘曲线显示颜色
4. **验证工具栏**：
   - 打开"视图"下拉菜单
   - 点击着色模式选项，确认下拉菜单保持打开状态
   - 可以连续点击多次切换不同模式
5. 运行类型检查 `npm run check:incremental` 确保无类型错误
