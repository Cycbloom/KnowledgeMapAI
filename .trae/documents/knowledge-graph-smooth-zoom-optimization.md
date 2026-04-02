# 知识图谱滚轮缩放丝滑优化计划

## 问题分析

### 当前实现的问题
1. **滚轮事件直接跳变**：[handleWheel](src/components/GraphMap/GraphMapCanvas.tsx#L300-L325) 函数在每次滚轮事件时直接计算并应用新的 transform 值，没有任何动画过渡
2. **已有动画机制未利用**：项目中已有 [animateCamera](src/components/GraphMap/GraphMapCanvas.tsx#L206-L251) 函数实现了基于 `requestAnimationFrame` 的平滑缓动动画，但仅在点击节点居中时使用
3. **DOM 直接操作**：通过 `setAttribute` 直接设置 SVG transform 属性（第187-190行），没有使用任何过渡效果

### 用户反馈的具体问题
- ✗ 滚轮滚动后直接跳到目标位置，中间没有动画过渡
- ✗ 节点标题文字等元素放大时瞬间变化，缺乏视觉连贯性
- ✓ 期望：类似专业思维导图工具（XMind、MindMaster）那样的丝滑缩放体验

## 解决方案

### 核心策略：平滑插值动画（Smooth Interpolation）

采用**目标值 + 实时插值**的方式，而非简单的 CSS transition 或单次动画调用。这种方式能够：
- ✅ 处理快速连续滚动的场景（不会出现动画堆积）
- ✅ 保持响应灵敏度（不会感觉迟钝）
- ✅ 提供流畅的视觉体验（有明显的过渡效果）

### 技术实现方案

#### 1. 新增目标 Transform 状态管理
```typescript
// 新增 ref 存储目标变换值
const targetTransformRef = useRef<Transform>(initialTransform);
```

#### 2. 创建持续运行的平滑动画循环
```typescript
// 使用 requestAnimationFrame 创建持续的平滑过渡
const smoothAnimationRef = useRef<number | null>(null);

const startSmoothAnimation = () => {
  const animate = () => {
    // 计算当前值与目标值的插值（使用 lerp 线性插值）
    const lerpFactor = 0.15; // 插值系数，控制平滑度
    
    const current = transformRef.current;
    const target = targetTransformRef.current;
    
    // 对 x, y, k 分别进行插值
    const newX = current.x + (target.x - current.x) * lerpFactor;
    const newY = current.y + (target.y - current.y) * lerpFactor;
    const newK = current.k + (target.k - current.k) * lerpFactor;
    
    // 应用插值后的值
    const newTransform = { x: newX, y: newY, k: newK };
    transformRef.current = newTransform;
    updateTransformDOM(newTransform);
    
    // 继续下一帧
    smoothAnimationRef.current = requestAnimationFrame(animate);
  };
  
  smoothAnimationRef.current = requestAnimationFrame(animate);
};
```

#### 3. 修改 handleWheel 事件处理
```typescript
const handleWheel = useCallback((e: WheelEvent) => {
  e.preventDefault();
  
  // 计算新的目标值（不直接应用）
  const scaleFactor = 1.1;
  const delta = e.deltaY > 0 ? 1 / scaleFactor : scaleFactor;
  
  const prev = targetTransformRef.current; // 使用目标值作为基准
  const newK = Math.max(0.1, Math.min(5, prev.k * delta));
  
  const rect = svgRef.current?.getBoundingClientRect();
  if (!rect) return;
  
  const mouseX = e.clientX - rect.left;
  const mouseY = e.clientY - rect.top;
  
  const newX = mouseX - (mouseX - prev.x) * delta;
  const newY = mouseY - (mouseY - prev.y) * delta;
  
  // 只更新目标值，让动画循环自动平滑过渡
  targetTransformRef.current = { x: newX, y: newY, k: newK };
}, []);
```

#### 4. 组件挂载/卸载时启动/停止动画循环
```typescript
useEffect(() => {
  // 启动平滑动画循环
  startSmoothAnimation();
  
  return () => {
    // 清理动画帧
    if (smoothAnimationRef.current) {
      cancelAnimationFrame(smoothAnimationRef.current);
    }
  };
}, []);
```

#### 5. 同步优化其他交互（拖拽、触摸等）
确保拖拽和触摸操作也使用相同的目标值机制，保持一致性。

#### 6. 可选优化：添加惯性效果（Inertia）
对于鼠标滚轮，可以添加轻微的惯性效果，让缩放更自然：
```typescript
// 在滚轮事件中累积增量
wheelAccumulatorRef.current += e.deltaY * inertiaFactor;

// 在动画循环中逐渐衰减
wheelAccumulatorRef.current *= inertiaDecay;
```

## 实施步骤

### 步骤 1：添加目标 Transform 引用
- 文件：`src/components/GraphMap/GraphMapCanvas.tsx`
- 位置：在现有 transformRef 附近（约第170行）
- 操作：新增 `targetTransformRef`

### 步骤 2：创建平滑动画函数
- 文件：`src/components/GraphMap/GraphMapCanvas.tsx`
- 位置：在 `animateCamera` 函数之后（约第251行）
- 操作：新增 `startSmoothAnimation` 和相关逻辑

### 步骤 3：重构 handleWheel 函数
- 文件：`src/components/GraphMap/GraphMapCanvas.tsx`
- 位置：第300-325行
- 操作：修改为只更新目标值，移除直接的 DOM 更新

### 步骤 4：集成动画循环到组件生命周期
- 文件：`src/components/GraphMap/GraphMapCanvas.tsx`
- 位置：useEffect 区域
- 操作：添加启动/清理动画循环的逻辑

### 步骤 5：同步更新拖拽和触摸事件处理
- 文件：`src/components/GraphMap/GraphMapCanvas.tsx`
- 位置：handleMouseDown、handleTouchStart 等
- 操作：确保这些事件也更新 targetTransformRef

### 步骤 6：调整插值系数和测试
- 测试不同的 lerpFactor 值（0.1 - 0.2）
- 验证快速连续滚动的表现
- 确保不影响其他交互（点击、拖拽等）

### 步骤 7：运行测试验证
- 运行类型检查：`npm run check`
- 运行 lint：`npm run lint`
- 运行 E2E 测试：`npx playwright test --grep="图谱"` （如果存在相关测试）

## 预期效果

### 改进前
- ❌ 滚轮滚动 → 图谱瞬间跳到新位置
- ❌ 文字大小突变 → 视觉上不连贯
- ❌ 快速滚动 → 可能出现卡顿或闪烁

### 改进后
- ✅ 滚轮滚动 → 图谱平滑过渡到新位置（类似 iOS 地图）
- ✅ 文字渐变 → 缩放时有流畅的大小变化
- ✅ 快速连续滚动 → 依然保持丝滑，无动画堆积
- ✅ 拖拽操作 → 同样具有平滑的手感

## 技术细节说明

### 为什么选择 LERP 插值而非 CSS Transition？

1. **SVG transform 兼容性**：CSS transition 对 SVG transform 的支持在某些浏览器中不一致
2. **精细控制**：LERP 可以精确控制每帧的插值系数，提供更好的手感调优
3. **性能优化**：只在值真正变化时才触发重绘，避免不必要的渲染
4. **复杂交互兼容**：需要同时处理缩放、平移等多个属性，JS 控制更灵活

### LerpFactor 参数建议

| 值 | 效果 | 适用场景 |
|---|------|---------|
| 0.05 | 非常平滑但稍慢 | 追求极致体验 |
| **0.10** | **平衡的选择** | **推荐默认值** |
| 0.15 | 响应迅速且平滑 | 大多数场景 |
| 0.20 | 接近即时但有过渡 | 快速操作偏好 |

**初始建议使用 0.12**，根据实际测试效果微调。

## 风险评估与应对

### 潜在风险
1. **性能影响**：持续运行的 requestAnimationFrame
   - 应对：仅在值变化时才进行实际更新，接近目标时降低更新频率
   
2. **与其他动画冲突**：animateCamera 用于节点居中
   - 应对：当 animateCamera 运行时，暂停平滑动画循环，或让 animateCamera 也更新 targetTransformRef

3. **触摸设备体验差异**
   - 应对：针对触摸设备可能需要调整 lerpFactor 或禁用平滑效果

## 相关文件清单

- [GraphMapCanvas.tsx](src/components/GraphMap/GraphMapCanvas.tsx) - 主要修改文件
