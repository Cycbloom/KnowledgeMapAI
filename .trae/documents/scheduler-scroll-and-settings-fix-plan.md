# 任务调度器滚动和设置面板修复计划

## 问题概述

用户反馈了两个问题：

1. **页面无法上下滚动**：看不到下面的队列（Q2），如果有更多队列（Q3、Q4）更无法查看
2. **设置面板无法打开**：点击设置按钮没有反应

---

## 问题分析

### 问题1：页面无法上下滚动

**根本原因**：在 [Layout.tsx:210](file:///d:\KnowledgeMap\src\components\Layout.tsx#L210) 和 [Layout.tsx:272](file:///d:\KnowledgeMap\src\components\Layout.tsx#L272) 中，主内容区域使用了 `overflow-hidden`：

```tsx
// 第 210 行
<div className="flex-1 overflow-hidden flex flex-col w-full relative">

// 第 272 行
<div className="flex-1 overflow-hidden relative">
```

这个 `overflow-hidden` 会阻止所有子组件的滚动行为，即使 Scheduler 组件设置了 `overflow-y-auto`，由于父容器限制了高度且隐藏溢出，滚动无法生效。

**解决方案**：
- 将主内容区域的 `overflow-hidden` 改为 `overflow-y-auto`
- 或者保持 `overflow-hidden` 但给 Scheduler 页面特殊处理

### 问题2：设置面板无法打开

**分析**：查看 [Scheduler.tsx:347-381](file:///d:\KnowledgeMap\src\pages\Scheduler.tsx#L347-L381)，设置面板使用 `AnimatePresence` 和条件渲染：

```tsx
<AnimatePresence>
  {showSettings && (
    <motion.div ...>
      {/* 设置面板内容 */}
    </motion.div>
  )}
</AnimatePresence>
```

代码逻辑看起来正确，需要检查：
1. `showSettings` 状态是否正确切换
2. 是否有其他元素遮挡了设置面板

**可能原因**：设置面板在页面底部，如果页面无法滚动，设置面板可能被挤到视口外面看不到。

---

## 修复步骤

### 步骤1：修复 Layout.tsx 的滚动限制

**文件**：`src/components/Layout.tsx`

**修改内容**：
- 第 210 行：将 `overflow-hidden` 改为 `overflow-y-auto`
- 第 272 行：将 `overflow-hidden` 改为 `overflow-y-auto`
- 添加 `custom-scrollbar` 类使滚动条可见

### 步骤2：验证设置面板功能

修复滚动后，设置面板应该可以正常显示。如果仍有问题，需要进一步检查：
- 设置面板的 z-index 是否正确
- 是否有其他元素遮挡

---

## 详细实现

### Layout.tsx 修改

```tsx
// 修改前 (第 210 行)
<div className="flex-1 overflow-hidden flex flex-col w-full relative">

// 修改后
<div className="flex-1 overflow-y-auto custom-scrollbar flex flex-col w-full relative">

// 修改前 (第 272 行)
<div className="flex-1 overflow-hidden relative">

// 修改后
<div className="flex-1 overflow-y-auto custom-scrollbar relative">
```

---

## 文件修改清单

| 文件 | 修改类型 |
|------|----------|
| `src/components/Layout.tsx` | 修改 overflow 属性允许滚动 |
