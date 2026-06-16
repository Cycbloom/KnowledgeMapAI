# 专注模式拖动时误触展开问题修复计划

## 问题概述

**现象**: 用户拖动专注模式浮动计时器（FocusTimer）后，计时器会自动从 Mini 模式切换到 Expanded 模式（或反之），导致意外展开/收起。

**根本原因**: [FocusTimer.tsx](src/components/common/FocusTimer.tsx#L120-L123) 中，同一个元素同时绑定了拖动启动事件和点击切换事件，但点击事件未检查是否刚结束拖动。

## 当前状态分析

### 问题代码位置

**文件**: `src/components/common/FocusTimer.tsx`

**第 120-123 行（Mini 模式的交互区域）**:
```tsx
<motion.div
  className="flex items-center gap-2 p-2 cursor-pointer"
  onPointerDown={(e) => dragControls.start(e)}  // 启动拖动
  onClick={() => setIsExpanded(!isExpanded)}     // ⚠️ 切换展开 - 未检查 isDragging!
>
```

**第 51 行（已定义但未使用的拖动标志）**:
```tsx
const isDragging = useRef(false);
```

**第 92-99 行（拖动状态跟踪逻辑 - 已正确实现）**:
```tsx
onDragStart={() => {
  isDragging.current = true;  // ✅ 正确设置
}}
onDragEnd={() => {
  setTimeout(() => {
    isDragging.current = false;  // ✅ 延迟100ms重置
  }, 100);
}}
```

### 问题触发流程

```
用户按下鼠标 → onPointerDown 触发 → dragControls.start(e) 启动拖动
    ↓
用户拖动移动 → onDragStart → isDragging.current = true
    ↓
用户释放鼠标 → onDragEnd → setTimeout 设置 100ms 后重置 isDragging
              ↓
              同时触发 onClick → setIsExpanded(!isExpanded) ← ❌ 未检查 isDragging！
    ↓
结果：每次拖动结束后都会意外触发展开/收起
```

## 修复方案

### 修改内容

**文件**: `src/components/common/FocusTimer.tsx`

**位置**: 第 122 行

**修改前**:
```tsx
onClick={() => setIsExpanded(!isExpanded)}
```

**修改后**:
```tsx
onClick={() => {
  if (!isDragging.current) {
    setIsExpanded(!isExpanded);
  }
}}
```

### 修复原理

1. **利用已有的 `isDragging` ref**: 代码中已经定义了 `isDragging` ref 并在拖动开始/结束时正确更新其值
2. **添加守卫条件**: 在 `onClick` 处理函数中检查 `isDragging.current`
3. **时间窗口保护**: `onDragEnd` 中使用 `setTimeout(..., 100)` 延迟重置，确保在拖动结束后的 100ms 内点击事件会被忽略
4. **不影响正常点击**: 当用户只是单击（非拖动）时，`isDragging.current` 为 `false`，点击行为正常

### 影响范围

- **仅影响 Mini 模式的标题区域点击展开功能**
- **不影响 Expanded 模式的任何交互**（Expanded 模式的拖动区域在第 149 行，无 onClick）
- **不影响其他按钮的点击**（设置、最小化、播放/暂停等按钮都有独立的事件处理）

## 实施步骤

1. **修改 FocusTimer.tsx 第 122 行**
   - 在 `onClick` 回调中添加 `isDragging.current` 检查
   - 保持原有展开/收起逻辑不变

2. **验证测试**
   - 测试场景 1：单击 Mini 计时器 → 应正常展开为 Expanded 模式
   - 测试场景 2：拖动 Mini 计时器到新位置 → 不应自动展开
   -测试场景 3：拖动后立即点击 → 应正常响应点击（超过 100ms 后）
   - 测试场景 4：Expanded 模式下拖动标题栏 → 不应影响展开状态
   - 测试场景 5：快速连续拖动 → 不应有异常行为

## 技术细节

### 为什么使用 100ms 延迟？

浏览器的事件触发顺序：
1. `pointerup` → `dragend` → `click`
2. 这三个事件在同一个事件循环微任务队列中依次执行
3. 使用 `setTimeout(..., 0)` 即可确保 `click` 事件处理完成后才重置
4. 代码中使用 100ms 是为了增加安全余量，防止极端情况下的竞态条件

### 为什么不使用其他方案？

| 方案 | 优点 | 缺点 | 选择 |
|------|------|------|------|
| **检查 isDragging（推荐）** | 简单、已有基础设施、无副作用 | 需要维护 ref 状态 | ✅ 采用 |
| 使用 CSS pointer-events | 彻底阻止点击 | 可能影响子元素交互 | ❌ 过度 |
| 记录鼠标移动距离 | 更精确判断 | 增加复杂度 | ❌ 过度设计 |
| 使用 debounce 包装 onClick | 统一防抖 | 引入延迟感 | ❌ 影响体验 |

## 假设与决策

1. **假设**: 用户反馈的"自动打开第一个"指的是 Mini 模式自动展开为 Expanded 模式
2. **决策**: 采用最简单的守卫条件方案，复用现有的 `isDragging` 机制
3. **决策**: 不修改拖动延迟时间（100ms 已足够且经过验证）

## 验证方法

### 手动测试清单

- [ ] 单击 Mini 计时器 → 展开 ✓
- [ ] 再次单击 → 收起 ✓
- [ ] 拖动 Mini 计时器 → 位置改变，保持 Mini 模式 ✓
- [ ] 拖动后等待 200ms 再点击 → 正常展开 ✓
- [ ] Expanded 模式拖动标题栏 → 不收起 ✓
- [ ] 快速拖动多次 → 无异常 ✓

### 自动化测试（可选）

如果项目有 Playwright E2E 测试，可添加以下测试用例：

```typescript
test('拖动计时器不应触发展开', async ({ page }) => {
  // 定位 Mini 计时器
  const timer = page.locator('[data-testid="focus-timer-mini"]');
  
  // 拖动操作
  const box = await timer.boundingBox();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2 + 100, box.y + box.height / 2 + 50);
  await page.mouse.up();
  
  // 验证仍处于 Mini 模式
  await expect(timer).toBeVisible();
});
```

## 风险评估

| 风险项 | 级别 | 缓解措施 |
|--------|------|----------|
| 影响正常点击功能 | 低 | 仅在拖动后的 100ms 内拦截，几乎无感知 |
| 与现有代码冲突 | 低 | 完全复用现有机制，无新依赖 |
| 跨浏览器兼容性 | 低 | 使用标准 React 事件和 ref API |

## 总结

这是一个典型的**拖拽与点击事件冲突**问题。通过在已有基础设施上添加一行守卫条件即可完美解决，无需引入新的复杂性。修复方案符合最小改动原则，风险极低。
