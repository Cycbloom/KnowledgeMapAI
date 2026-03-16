# 修复 GraphMapCanvas.tsx 中 passive event listener 错误

## 问题分析

**错误信息：** `Unable to preventDefault inside passive event listener invocation`

**发生位置：** `GraphMapCanvas.tsx:283` - `handleWheel` 函数中的 `e.preventDefault()`

**根本原因：**
现代浏览器为了优化滚动性能，将 `wheel`、`touchstart` 和 `touchmove` 事件默认设置为 `passive: true`。当事件监听器是 passive 时，调用 `preventDefault()` 会触发此警告/错误。

**受影响的代码位置：**
1. 第 283 行：`handleWheel` 中的 `e.preventDefault()`
2. 第 310 行：`handleTouchStart` 中的 `e.preventDefault()`
3. 第 357 行：`handleTouchMove` 中的 `e.preventDefault()`

## 解决方案

使用 `useRef` + `useEffect` + `addEventListener` 手动绑定事件，显式设置 `{ passive: false }`。

### 实施步骤

1. **修改 `handleWheel` 事件绑定方式**
   - 将 `onWheel={handleWheel}` 从 JSX 中移除
   - 使用 `useEffect` 手动添加 wheel 事件监听器，设置 `{ passive: false }`
   - 在组件卸载时移除事件监听器

2. **修改 `handleTouchStart` 事件绑定方式**
   - 将 `onTouchStart={handleTouchStart}` 从 JSX 中移除
   - 使用 `useEffect` 手动添加 touchstart 事件监听器，设置 `{ passive: false }`

3. **修改 `handleTouchMove` 事件绑定方式**
   - 将 `onTouchMove={handleTouchMove}` 从 JSX 中移除
   - 使用 `useEffect` 手动添加 touchmove 事件监听器，设置 `{ passive: false }`

4. **更新事件处理函数签名**
   - 将事件处理函数的参数类型从 React 合成事件改为原生事件
   - `React.WheelEvent<SVGSVGElement>` → `WheelEvent`
   - `React.TouchEvent<SVGSVGElement>` → `TouchEvent`

## 代码变更详情

### 变更 1：修改事件处理函数类型

```typescript
// 修改前
const handleWheel = useCallback(
  (e: React.WheelEvent<SVGSVGElement>) => {
    e.preventDefault();
    // ...
  },
  [updateTransformDOM, updateTransformState],
);

// 修改后
const handleWheel = useCallback(
  (e: WheelEvent) => {
    e.preventDefault();
    // ...
  },
  [updateTransformDOM, updateTransformState],
);
```

同样的修改应用于 `handleTouchStart` 和 `handleTouchMove`。

### 变更 2：添加 useEffect 手动绑定事件

```typescript
useEffect(() => {
  const svg = svgRef.current;
  if (!svg) return;

  const options = { passive: false };

  svg.addEventListener('wheel', handleWheel, options);
  svg.addEventListener('touchstart', handleTouchStart, options);
  svg.addEventListener('touchmove', handleTouchMove, options);

  return () => {
    svg.removeEventListener('wheel', handleWheel);
    svg.removeEventListener('touchstart', handleTouchStart);
    svg.removeEventListener('touchmove', handleTouchMove);
  };
}, [handleWheel, handleTouchStart, handleTouchMove]);
```

### 变更 3：从 JSX 中移除事件属性

```tsx
// 修改前
<svg
  // ...
  onWheel={handleWheel}
  onTouchStart={handleTouchStart}
  onTouchMove={handleTouchMove}
  onTouchEnd={handleTouchEnd}
  onTouchCancel={handleTouchEnd}
>

// 修改后
<svg
  // ...
  onTouchEnd={handleTouchEnd}
  onTouchCancel={handleTouchEnd}
>
```

注意：`onTouchEnd` 和 `onTouchCancel` 不需要 `preventDefault()`，可以保留 React 事件绑定。

## 验证步骤

1. 运行类型检查：`npm run check`
2. 启动开发服务器测试触摸/滚轮交互
3. 确认控制台不再出现 passive event listener 错误
