# 时间线播放进度条动画优化方案

## 摘要

优化 TimelineView 中播放进度条的动画，解决卡顿问题，实现丝滑的进度条移动效果。

## 当前状态分析

**文件**: `src/components/GraphEditor/views/TimelineView.tsx`

### 当前实现

- 使用 `setInterval(50ms)` 驱动进度更新，每 tick 增加 `0.5 * playSpeed`
- 每次 tick 调用 `setProgress()` 触发 React 状态更新
- 状态更新导致整个组件重渲染（所有节点、边、SVG 元素）
- 进度条使用 `<input type="range">` + `linear-gradient` 背景，无 CSS transition
- 节点/边可见性通过 `opacity` + CSS `transition` 实现

### 卡顿根因

1. **`setInterval` 不精确** — 定时器回调可能被延迟，无法与屏幕刷新率对齐
2. **高频 React 重渲染** — 每 50ms 一次 `setProgress` 导致完整组件重渲染（所有 SVG 节点/边重新计算可见性）
3. **进度条视觉与状态耦合** — 进度条的视觉位置完全依赖 React 状态，无法绕过渲染周期
4. **无帧率优化** — 未使用 `requestAnimationFrame`，无法利用浏览器的 VSync 机制

## 优化方案

### 核心思路：解耦动画帧与 React 状态更新

将进度条动画分为两层：
- **视觉层**（高频，60fps）：使用 `requestAnimationFrame` + DOM 直接操作，驱动进度条滑块平滑移动
- **逻辑层**（低频，按需）：仅在节点可见性实际变化时更新 React 状态，触发组件重渲染

### 具体修改

#### 1. 新增 ref 存储动画进度值

```typescript
const progressRef = useRef(progress);  // 动画帧使用的高精度进度值
const rangeRef = useRef<HTMLInputElement>(null);  // 进度条 DOM 引用
const rafRef = useRef<number>(0);  // requestAnimationFrame ID
const lastTimeRef = useRef<number>(0);  // 上一帧时间戳
```

#### 2. 替换 `setInterval` 为 `requestAnimationFrame` + delta time

删除现有的 `useEffect` 中 `setInterval` 逻辑，替换为基于 `requestAnimationFrame` 的动画循环：

```typescript
useEffect(() => {
  if (!isPlaying) return;

  lastTimeRef.current = performance.now();

  const animate = (currentTime: number) => {
    const deltaTime = currentTime - lastTimeRef.current;
    lastTimeRef.current = currentTime;

    // 基于实际经过时间计算进度增量，确保速度一致
    // playSpeed=1 时，10秒从0到100，即每秒10单位
    const increment = (deltaTime / 1000) * 10 * playSpeed;
    const newProgress = Math.min(100, progressRef.current + increment);

    progressRef.current = newProgress;

    // 直接操作 DOM 更新进度条视觉（绕过 React 渲染周期）
    if (rangeRef.current) {
      rangeRef.current.value = String(newProgress);
      rangeRef.current.style.background = isDark
        ? `linear-gradient(to right, #6366f1 ${newProgress}%, #334155 ${newProgress}%)`
        : `linear-gradient(to right, #6366f1 ${newProgress}%, #e5e7eb ${newProgress}%)`;
    }

    // 仅在节点可见性实际变化时更新 React 状态
    const currentNodeCount = sortedNodes.filter(
      n => (nodeTimeMap.get(n.id) || 0) <= newProgress
    ).length;
    const prevNodeCount = sortedNodes.filter(
      n => (nodeTimeMap.get(n.id) || 0) <= progressRef.current - increment
    ).length;

    if (currentNodeCount !== prevNodeCount || newProgress >= 100) {
      setProgress(newProgress);
    }

    if (newProgress >= 100) {
      setIsPlaying(false);
      return;
    }

    rafRef.current = requestAnimationFrame(animate);
  };

  rafRef.current = requestAnimationFrame(animate);

  return () => {
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
    }
  };
}, [isPlaying, playSpeed, isDark, sortedNodes, nodeTimeMap]);
```

#### 3. 优化节点可见性变化检测

为避免每帧都遍历所有节点计算可见性，使用一个 ref 跟踪当前可见节点数：

```typescript
const visibleCountRef = useRef(0);
```

在动画循环中，仅当 `visibleCountRef` 变化时才触发 React 状态更新：

```typescript
// 在动画帧中
const newVisibleCount = sortedNodes.filter(
  n => (nodeTimeMap.get(n.id) || 0) <= newProgress
).length;

if (newVisibleCount !== visibleCountRef.current || newProgress >= 100) {
  visibleCountRef.current = newVisibleCount;
  setProgress(newProgress);  // 触发 React 重渲染以更新节点可见性
}
```

#### 4. 为进度条添加 CSS transition 作为兜底平滑

在 `<input type="range">` 上添加微小的 CSS transition，确保即使有微小的帧间隔差异，视觉上也是平滑的：

```tsx
<input
  ref={rangeRef}
  type="range"
  min="0"
  max="100"
  value={progress}
  onChange={handleProgressChange}
  className="flex-1 h-2 rounded-lg appearance-none cursor-pointer"
  style={{
    background: isDark
      ? `linear-gradient(to right, #6366f1 ${progress}%, #334155 ${progress}%)`
      : `linear-gradient(to right, #6366f1 ${progress}%, #e5e7eb ${progress}%)`,
    transition: 'background 0.05s linear'  // 微小过渡兜底
  }}
/>
```

#### 5. 同步 progressRef 与 progress 状态

确保在手动操作（拖拽、步进、重置）时，`progressRef` 与 React 状态保持同步：

```typescript
const handleProgressChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
  const value = Number(e.target.value);
  progressRef.current = value;
  setProgress(value);
  setIsPlaying(false);
}, []);

const handleReset = useCallback(() => {
  progressRef.current = 0;
  setProgress(0);
  setIsPlaying(false);
}, []);

const handleStepForward = useCallback(() => {
  const nextIndex = Math.ceil(progress / 100 * sortedNodes.length);
  if (nextIndex < sortedNodes.length) {
    const newProgress = ((nextIndex + 1) / sortedNodes.length) * 100;
    progressRef.current = newProgress;
    setProgress(newProgress);
  }
}, [progress, sortedNodes.length]);

const handleStepBack = useCallback(() => {
  const currentIndex = Math.floor(progress / 100 * sortedNodes.length);
  if (currentIndex > 0) {
    const newProgress = ((currentIndex - 1) / sortedNodes.length) * 100;
    progressRef.current = newProgress;
    setProgress(newProgress);
  }
}, [progress, sortedNodes.length]);
```

#### 6. 播放开始时同步 progressRef

```typescript
const handlePlayPause = useCallback(() => {
  if (progress >= 100) {
    progressRef.current = 0;
    setProgress(0);
  }
  progressRef.current = progress;  // 确保从当前进度开始
  setIsPlaying(prev => !prev);
}, [progress]);
```

## 修改文件清单

| 文件 | 修改内容 |
|------|---------|
| `src/components/GraphEditor/views/TimelineView.tsx` | 所有优化改动集中在此文件 |

## 优化效果预期

| 指标 | 优化前 | 优化后 |
|------|--------|--------|
| 动画帧率 | ~20fps（50ms interval + 渲染开销） | ~60fps（requestAnimationFrame） |
| React 重渲染频率 | 每 50ms 一次 | 仅节点可见性变化时 |
| 进度条视觉 | 离散步进，卡顿 | 连续平滑移动 |
| 速度一致性 | 受 setInterval 精度影响 | 基于 delta time，速度精确 |

## 验证步骤

1. 启动开发服务器 `npm run electron:dev`
2. 打开一个有多个节点的知识图谱
3. 切换到时间线模式
4. 点击播放按钮，观察进度条是否平滑移动
5. 切换不同速度（0.5x, 1x, 2x, 4x），验证速度一致性
6. 拖拽进度条，验证手动操作正常
7. 使用步进按钮，验证功能正常
8. 重置后重新播放，验证从0开始正常
9. 运行 `npm run check:incremental` 确保类型检查通过
