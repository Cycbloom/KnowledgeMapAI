# 修复滚轮缩放 Passive Event Listener 问题

## 问题分析

**错误信息：**
```
Unable to preventDefault inside passive event listener invocation.
```

**根本原因：**
React 的 `onWheel` 事件处理器默认被设置为 `passive: true`。当事件监听器是 passive 时，浏览器假设监听器不会调用 `preventDefault()`，这样可以提前开始滚动处理以提升性能。在 passive 监听器中调用 `preventDefault()` 会触发此警告。

**代码位置：**
- [MindMapCanvas.tsx:670](file:///d:\KnowledgeMap\src\components\GraphEditor\canvas\MindMapCanvas.tsx#L670) - `e.preventDefault()` 调用
- [MindMapCanvas.tsx:1125](file:///d:\KnowledgeMap\src\components\GraphEditor\canvas\MindMapCanvas.tsx#L1125) - `onWheel={handleWheel}` 绑定

## 解决方案

使用 `useEffect` 手动添加非 passive 的 wheel 事件监听器，替代 React 的 `onWheel` 属性。

### 实现步骤

1. **移除 SVG 元素上的 `onWheel` 属性**
   - 删除 `onWheel={handleWheel}` 

2. **添加 `useEffect` 手动绑定 wheel 事件**
   - 使用 `addEventListener` 并设置 `{ passive: false }` 选项
   - 在组件卸载时移除事件监听器

3. **修改 `handleWheel` 函数签名**
   - 从 `React.WheelEvent<SVGSVGElement>` 改为 `WheelEvent`
   - 保持原有的缩放逻辑不变

### 代码变更

```tsx
// 1. 修改 handleWheel 函数签名
const handleWheel = useCallback(
  (e: WheelEvent) => {  // 改为原生 WheelEvent
    e.preventDefault();
    // ... 其余逻辑不变
  },
  [/* deps */]
);

// 2. 添加 useEffect 手动绑定事件
useEffect(() => {
  const svg = svgRef.current;
  if (!svg) return;

  svg.addEventListener('wheel', handleWheel, { passive: false });
  
  return () => {
    svg.removeEventListener('wheel', handleWheel);
  };
}, [handleWheel]);

// 3. 移除 SVG 元素上的 onWheel 属性
<svg
  ref={svgRef}
  // ... 其他属性
  // 删除: onWheel={handleWheel}
  onMouseDown={handleMouseDown}
  // ...
>
```

## 注意事项

- `touchAction: "none"` CSS 属性已存在，这对触摸事件有帮助，但对 wheel 事件无效
- 需要确保 `handleWheel` 的依赖数组正确，避免事件监听器频繁移除/添加
- 使用 `{ passive: false }` 可能会略微影响滚动性能，但对于自定义缩放行为是必要的
