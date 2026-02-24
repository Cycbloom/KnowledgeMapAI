# ESLint 警告深度重构计划

## 概述

当前剩余 **424 个警告**，主要分为两类：
1. `react-refresh/only-export-components` - 组件文件同时导出工具函数
2. `react-hooks/exhaustive-deps` - 依赖数组中的变量每次渲染都会变化

## 重构任务

### 任务 1: 拆分 LazyImage.tsx 中的 Hook

**问题**: 文件同时导出 `LazyImage`、`LazyBackground` 组件和 `useIntersectionObserver` hook

**解决方案**: 
- 创建新文件 `src/hooks/useIntersectionObserver.ts`
- 将 `useIntersectionObserver` hook 移动到新文件
- 更新 `LazyImage.tsx` 的导入

**涉及文件**:
- `src/components/LazyImage.tsx` (修改)
- `src/hooks/useIntersectionObserver.ts` (新建)

---

### 任务 2: 拆分 VirtualList.tsx 中的 Hook

**问题**: 文件同时导出 `VirtualList`、`VirtualGrid` 组件和 `useVirtualScroll` hook

**解决方案**:
- 创建新文件 `src/hooks/useVirtualScroll.ts`
- 将 `useVirtualScroll` hook 移动到新文件
- 更新 `VirtualList.tsx` 的导入

**涉及文件**:
- `src/components/VirtualList.tsx` (修改)
- `src/hooks/useVirtualScroll.ts` (新建)

---

### 任务 3: 修复 Dashboard.tsx 的依赖问题

**问题**: `graphs` 变量在 useMemo 依赖中每次渲染都会变化

**当前代码**:
```tsx
const graphs = Array.isArray(graphsData) ? graphsData : [];

const filteredGraphs = useMemo(() => {
  // ... 使用 graphs
}, [graphs, selectedFilterTags]);
```

**解决方案**:
```tsx
const graphs = useMemo(() => 
  Array.isArray(graphsData) ? graphsData : [], 
  [graphsData]
);

const filteredGraphs = useMemo(() => {
  // ... 使用 graphs
}, [graphs, selectedFilterTags]);
```

**涉及文件**:
- `src/pages/Dashboard.tsx`

---

### 任务 4: 修复 GraphEditor.tsx 的依赖问题

**问题**: `nodes` 和 `edges` 变量在多个 hooks 依赖中每次渲染都会变化

**当前代码**:
```tsx
const nodes = graphData?.nodes || [];
const edges = graphData?.edges || [];
```

**解决方案**:
```tsx
const nodes = useMemo(() => graphData?.nodes || [], [graphData?.nodes]);
const edges = useMemo(() => graphData?.edges || [], [graphData?.edges]);
```

**涉及文件**:
- `src/pages/GraphEditor.tsx`

---

### 任务 5: 修复 GraphMap.tsx 的依赖问题

**问题**: `graphs` 变量在 useCallback 依赖中每次渲染都会变化

**当前代码**:
```tsx
const graphs: Graph[] = mapData?.graphs || [];
const relations: GraphRelation[] = mapData?.relations || [];
```

**解决方案**:
```tsx
const graphs = useMemo(() => mapData?.graphs || [], [mapData?.graphs]);
const relations = useMemo(() => mapData?.relations || [], [mapData?.relations]);
```

**涉及文件**:
- `src/pages/GraphMap.tsx`

---

### 任务 6: 修复 RecycleBin.tsx 的依赖问题

**问题**: `graphs` 变量在 useMemo 依赖中每次渲染都会变化

**当前代码**:
```tsx
const graphs = Array.isArray(trashData) ? trashData : [];

const filteredGraphs = useMemo(() => graphs.filter(...), [graphs, searchQuery]);
```

**解决方案**:
```tsx
const graphs = useMemo(() => 
  Array.isArray(trashData) ? trashData : [], 
  [trashData]
);

const filteredGraphs = useMemo(() => graphs.filter(...), [graphs, searchQuery]);
```

**涉及文件**:
- `src/pages/RecycleBin.tsx`

---

## 预期结果

完成所有任务后，警告数量预计将从 **424 减少到约 410**（剩余的警告主要是其他类型的警告）。

## 执行顺序

1. 任务 1: 拆分 LazyImage.tsx
2. 任务 2: 拆分 VirtualList.tsx
3. 任务 3: 修复 Dashboard.tsx
4. 任务 4: 修复 GraphEditor.tsx
5. 任务 5: 修复 GraphMap.tsx
6. 任务 6: 修复 RecycleBin.tsx
7. 验证修复结果
