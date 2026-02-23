# ESLint 错误优化计划

## 当前状态
- **错误数量**: 10 个
- **警告数量**: 1406 个
- **总问题数**: 1416 个

## 剩余错误列表

### 1. setState in Effect 错误 (7个)

| 文件 | 行号 | 问题描述 |
|------|------|----------|
| `src/components/GraphEditor/GraphSettingsModal.tsx` | 31 | 在 effect 中同步调用 setState |
| `src/components/LoadingBar.tsx` | 31 | 在 effect 中同步调用 setState |
| `src/components/Study/QuestionForm.tsx` | 74 | 在 effect 中同步调用 setState |
| `src/pages/CombinedGraphView.tsx` | 189 | 在 effect 中同步调用 setState |
| `src/pages/GraphEditor.tsx` | 159 | 在 effect 中同步调用 setState |
| `src/pages/Settings.tsx` | 42 | 在 effect 中同步调用 setState |
| `src/pages/Study.tsx` | 87 | 在 effect 中同步调用 setState |

### 2. Cannot access refs during render 错误 (2个)

| 文件 | 行号 | 问题描述 |
|------|------|----------|
| `src/three/PlanetView.tsx` | 101 | 在渲染期间访问 ref.current |

## 修复方案

### 方案 A: 禁用 React 19 新 lint 规则 (快速方案)

在 `eslint.config.js` 中禁用以下规则：
- `react-hooks/set-state-in-effect`
- `react-hooks/refs`

**优点**: 快速解决所有错误
**缺点**: 不符合 React 19 最佳实践，可能隐藏潜在问题

### 方案 B: 逐个修复错误 (推荐方案)

#### 1. GraphSettingsModal.tsx
**问题**: 当 `graph.settings` 变化时，在 effect 中更新状态
**修复方案**: 使用 `useSyncExternalStore` 或将状态初始化逻辑移到组件外部，或使用 `key` 属性重置组件

```tsx
// 方案: 使用 key 属性强制重新挂载
<GraphSettingsModal key={graph?.settings} ... />
```

#### 2. LoadingBar.tsx
**问题**: 当 `isLoading` 变化时，在 effect 中设置可见性和进度
**修复方案**: 使用 `useSyncExternalStore` 或将状态计算移到渲染阶段

```tsx
// 方案: 使用派生状态
const [progress, setProgress] = useState(0);
const isVisible = isLoading || progress > 0;
```

#### 3. QuestionForm.tsx
**问题**: 当 `initialData` 变化时，在 effect 中重置表单
**修复方案**: 使用 `key` 属性强制重新挂载表单组件

```tsx
// 父组件中使用
<QuestionForm key={initialData?.id} ... />
```

#### 4. CombinedGraphView.tsx
**问题**: 当节点变化时，在 effect 中设置跨图连接
**修复方案**: 使用 `useMemo` 计算派生状态

```tsx
// 方案: 使用 useMemo 替代 useEffect + setState
const crossGraphConnections = useMemo(() => {
  if (nodes1.length > 0 && nodes2.length > 0 && id1 && id2) {
    return detectCrossGraphConnections(nodes1, nodes2, id1, id2);
  }
  return [];
}, [nodes1, nodes2, id1, id2, detectCrossGraphConnections]);
```

#### 5. GraphEditor.tsx
**问题**: 类似的 setState in effect 问题
**修复方案**: 同上，使用 `useMemo` 或 `key` 属性

#### 6. Settings.tsx
**问题**: 当设置变化时，在 effect 中更新多个状态
**修复方案**: 使用状态初始化函数或 `key` 属性

#### 7. Study.tsx
**问题**: 当参数变化时，在 effect 中重置学习状态
**修复方案**: 使用 `key` 属性或 `useMemo`

#### 8. PlanetView.tsx
**问题**: 在渲染期间访问 `scaleRef.current`
**修复方案**: 使用 `useState` 替代 `useRef`，或使用 `useSyncExternalStore`

```tsx
// 方案: 使用 useState
const [scale, setScale] = useState(1);

// 在 effect 或事件处理中更新
useEffect(() => {
  // ... 计算逻辑
  setScale(newScale);
}, [dependencies]);
```

## 推荐执行顺序

1. **快速修复**: 先修复 `PlanetView.tsx` 的 refs 问题（最简单）
2. **派生状态修复**: 修复 `CombinedGraphView.tsx`（使用 useMemo）
3. **表单重置修复**: 修复 `QuestionForm.tsx`（建议在父组件使用 key）
4. **加载状态修复**: 修复 `LoadingBar.tsx`
5. **设置模态框修复**: 修复 `GraphSettingsModal.tsx`
6. **页面级修复**: 修复 `Settings.tsx` 和 `Study.tsx`
7. **复杂组件修复**: 修复 `GraphEditor.tsx`（最复杂）

## 预期结果

修复完成后：
- **错误数量**: 0 个
- **警告数量**: ~1400 个（主要是 `@typescript-eslint/no-explicit-any` 和 `no-console`）

## 注意事项

1. 这些错误是 React 19 新的 lint 规则产生的，不影响运行时功能
2. 修复这些错误可以提高代码质量和性能
3. 部分修复可能需要重构组件结构，建议逐步进行
