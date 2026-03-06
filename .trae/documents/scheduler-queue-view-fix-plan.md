# 任务调度器队列视图问题修复计划

## 问题概述

任务调度器的队列视图存在以下三个问题：

1. **拖动位置偏移**：拖动任务卡片时，元素实际位置与鼠标指针位置不一致
2. **Z-index 层级问题**：跨队列拖拽时，拖拽元素被目标队列遮挡
3. **滚动条不可见**：页面内容超出视口时，无法看到滚动指示器

---

## 问题分析

### 问题1：拖动位置偏移

**根本原因**：在 [DraggableTaskCard.tsx:89](file:///d:\KnowledgeMap\src\components\Scheduler\DraggableTaskCard.tsx#L89) 中，拖拽时应用了 `scale-105 rotate-2` 变换效果：

```tsx
${snapshot.isDragging 
  ? 'shadow-2xl z-50 ring-2 ring-offset-2 ring-offset-white dark:ring-offset-slate-900 scale-105 rotate-2' 
  : 'hover:shadow-lg'
}
```

`@hello-pangea/dnd` 库在计算拖拽位置时，元素的 `transform` 属性会影响位置计算，导致视觉偏移。

**解决方案**：
- 移除拖拽时的 `scale-105 rotate-2` 效果
- 或者使用 `@hello-pangea/dnd` 提供的 `enableDefaultSensors` 和自定义拖拽层来正确处理变换

---

### 问题2：Z-index 层级问题

**根本原因**：
1. 三个队列按 DOM 顺序垂直排列（Q0 → Q1 → Q2）
2. 拖拽元素虽然设置了 `z-50`，但仍在队列容器内部
3. 当从 Q0 拖到 Q2 时，Q1 和 Q2 的容器会在视觉上覆盖拖拽元素

**解决方案**：
使用 `@hello-pangea/dnd` 的 Portal 功能，将拖拽元素渲染到 `body` 层级，脱离队列容器的层叠上下文。

需要修改 `HorizontalQueueView.tsx`，添加自定义的 `DragDropContext` 配置。

---

### 问题3：滚动条不可见

**根本原因**：在 [index.css:59-77](file:///d:\KnowledgeMap\src\index.css#L59-L77) 中，全局隐藏了滚动条：

```css
.custom-scrollbar {
  -ms-overflow-style: none;
  scrollbar-width: none;
}
.custom-scrollbar::-webkit-scrollbar {
  display: none;
}
```

**解决方案**：
修改滚动条样式，使其可见但美观：
- 默认状态：半透明、细窄
- 悬停状态：更明显
- 保持跨浏览器兼容性

---

## 修复步骤

### 步骤1：修复拖拽位置偏移

**文件**：`src/components/Scheduler/DraggableTaskCard.tsx`

**修改内容**：
- 移除拖拽时的 `scale-105 rotate-2` 变换
- 保留阴影和边框效果以提供视觉反馈
- 添加轻微的透明度变化替代缩放效果

### 步骤2：修复 Z-index 层级问题

**文件**：`src/components/Scheduler/HorizontalQueueView.tsx`

**修改内容**：
- 创建一个 Portal 容器用于渲染拖拽元素
- 使用 `DragDropContext` 的自定义渲染功能
- 确保拖拽元素始终在最顶层显示

### 步骤3：修复滚动条不可见

**文件**：`src/index.css`

**修改内容**：
- 修改 `.custom-scrollbar` 类，显示美观的滚动条
- 添加悬停效果
- 保持暗色/亮色模式兼容

---

## 详细实现

### 1. DraggableTaskCard.tsx 修改

```tsx
// 修改前
${snapshot.isDragging 
  ? 'shadow-2xl z-50 ring-2 ring-offset-2 ring-offset-white dark:ring-offset-slate-900 scale-105 rotate-2' 
  : 'hover:shadow-lg'
}

// 修改后
${snapshot.isDragging 
  ? 'shadow-2xl z-[9999] ring-2 ring-offset-2 ring-offset-white dark:ring-offset-slate-900 opacity-90' 
  : 'hover:shadow-lg'
}
```

### 2. HorizontalQueueView.tsx 修改

需要添加自定义的拖拽层组件，使用 Portal 将拖拽元素渲染到 body：

```tsx
// 添加 Portal 容器
const DragOverlay: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  return createPortal(children, document.body);
};

// 在 DragDropContext 中使用
<DragDropContext onDragEnd={handleDragEnd}>
  {/* 队列内容 */}
</DragDropContext>
```

### 3. index.css 修改

```css
/* Custom Scrollbar Utility - 可见的美观滚动条 */
.custom-scrollbar {
  scrollbar-width: thin;
  scrollbar-color: rgba(148, 163, 184, 0.3) transparent;
}

.custom-scrollbar:hover {
  scrollbar-color: rgba(148, 163, 184, 0.5) transparent;
}

.custom-scrollbar::-webkit-scrollbar {
  width: 6px;
  height: 6px;
}

.custom-scrollbar::-webkit-scrollbar-track {
  background: transparent;
}

.custom-scrollbar::-webkit-scrollbar-thumb {
  background: rgba(148, 163, 184, 0.3);
  border-radius: 3px;
}

.custom-scrollbar::-webkit-scrollbar-thumb:hover {
  background: rgba(148, 163, 184, 0.5);
}

/* 暗色模式 */
.dark .custom-scrollbar {
  scrollbar-color: rgba(71, 85, 105, 0.4) transparent;
}

.dark .custom-scrollbar:hover {
  scrollbar-color: rgba(71, 85, 105, 0.6) transparent;
}

.dark .custom-scrollbar::-webkit-scrollbar-thumb {
  background: rgba(71, 85, 105, 0.4);
}

.dark .custom-scrollbar::-webkit-scrollbar-thumb:hover {
  background: rgba(71, 85, 105, 0.6);
}
```

---

## 测试验证

修复完成后需要验证：

1. **拖拽位置测试**
   - 拖动任务卡片，确认鼠标指针与卡片位置一致
   - 测试三个队列之间的拖拽

2. **Z-index 测试**
   - 从 Q0 拖动任务到 Q2，确认拖拽元素不被遮挡
   - 从 Q2 拖动任务到 Q0，确认正常显示

3. **滚动条测试**
   - 添加足够多的任务使内容超出视口
   - 确认滚动条可见且美观
   - 测试暗色/亮色模式下的显示效果

---

## 文件修改清单

| 文件 | 修改类型 |
|------|----------|
| `src/components/Scheduler/DraggableTaskCard.tsx` | 修改拖拽样式 |
| `src/components/Scheduler/HorizontalQueueView.tsx` | 添加 Portal 支持 |
| `src/index.css` | 修改滚动条样式 |
