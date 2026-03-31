# 图谱地图AI分析下拉框UI优化规范

## Why

当前图谱地图工具栏中的AI分析下拉框（包含"基础分析"和"智能分析"两个选项）视觉美观度不足，缺乏清晰的视觉层次和交互反馈。需要优化其颜色搭配、边框样式、交互反馈、字体样式等视觉元素，提升用户体验和界面一致性。

## What Changes

- 优化下拉框触发按钮的视觉样式
- 改进下拉菜单的视觉设计（渐变背景、圆角、阴影）
- 增强选项的交互反馈效果（hover动画、选中状态）
- 优化图标和文字的排版布局
- 添加分隔线和分组视觉效果
- 统一深色模式下的样式表现

## Impact

- **Affected specs**: 图谱地图工具栏
- **Affected code**: `src/components/GraphMap/GraphMapToolbar.tsx`

---

## ADDED Requirements

### Requirement: 下拉框触发按钮优化

系统 SHALL 提供美观的AI分析下拉框触发按钮。

#### Scenario: 触发按钮样式
- **WHEN** 用户查看工具栏
- **THEN** AI分析按钮使用渐变背景或品牌色
- **AND** 按钮有清晰的边框和圆角
- **AND** 按钮有微妙的阴影效果
- **AND** hover状态有明显但优雅的视觉反馈

#### 按钮样式设计
```css
/* 触发按钮 */
- 背景：渐变紫色 (from-purple-500 to-indigo-600) 或品牌色
- 文字：白色
- 边框：可选，1px 透明或半透明
- 圆角：rounded-lg (8px)
- 阴影：shadow-md
- Hover：亮度提升或阴影增强
- 过渡：transition-all duration-200
```

---

### Requirement: 下拉菜单视觉优化

系统 SHALL 提供美观的下拉菜单视觉设计。

#### Scenario: 下拉菜单样式
- **WHEN** 用户点击AI分析按钮展开下拉菜单
- **THEN** 菜单有优雅的入场动画
- **AND** 菜单有足够的圆角和阴影
- **AND** 菜单背景与内容有良好的对比度
- **AND** 菜单边框细腻但不突兀

#### 菜单样式设计
```css
/* 下拉菜单容器 */
- 背景：白色 (dark: slate-800)
- 圆角：rounded-xl (12px)
- 阴影：shadow-xl 或 shadow-2xl
- 边框：border border-gray-100 (dark: border-slate-700)
- 内边距：p-2
- 最小宽度：min-w-[220px]
- 动画：animate-in fade-in slide-in-from-top-2 duration-200
```

---

### Requirement: 选项卡片化设计

系统 SHALL 将下拉选项设计为卡片样式，提升视觉层次。

#### Scenario: 选项卡片样式
- **WHEN** 用户查看下拉菜单中的选项
- **THEN** 每个选项呈现为独立卡片
- **AND** 卡片有清晰的图标和文字排版
- **AND** hover状态有明显但优雅的背景变化
- **AND** 选项之间有适当的间距

#### 选项卡片样式设计
```css
/* 选项卡片 */
- 布局：flex items-start gap-3
- 内边距：p-3
- 圆角：rounded-lg
- 间距：space-y-1 (菜单内)
- Hover背景：
  - 基础分析：bg-purple-50 (dark: bg-purple-900/20)
  - 智能分析：bg-indigo-50 (dark: bg-indigo-900/20)
- Hover边框：ring-1 ring-purple-200 (dark: ring-purple-700)
- 过渡：transition-all duration-150

/* 图标容器 */
- 尺寸：w-8 h-8
- 圆角：rounded-lg
- 背景：
  - 基础分析：bg-purple-100 (dark: bg-purple-900/40)
  - 智能分析：bg-indigo-100 (dark: bg-indigo-900/40)
- 图标颜色：
  - 基础分析：text-purple-600 (dark: text-purple-400)
  - 智能分析：text-indigo-600 (dark: text-indigo-400)
```

---

### Requirement: 文字排版优化

系统 SHALL 优化选项文字的排版和样式。

#### Scenario: 文字样式
- **WHEN** 用户查看选项内容
- **THEN** 标题使用清晰加粗的字体
- **AND** 描述文字使用较小字号和较浅颜色
- **AND** 文字与图标对齐良好

#### 文字样式设计
```css
/* 标题 */
- 字号：text-sm
- 字重：font-semibold
- 颜色：text-gray-900 (dark: text-white)

/* 描述 */
- 字号：text-xs
- 颜色：text-gray-500 (dark: text-gray-400)
- 行高：leading-relaxed
```

---

### Requirement: 深色模式适配

系统 SHALL 确保下拉框在深色模式下同样美观。

#### Scenario: 深色模式样式
- **WHEN** 用户切换到深色模式
- **THEN** 所有颜色自动适配深色主题
- **AND** 对比度保持良好可读性
- **AND** 阴影和边框在深色背景下可见

---

## MODIFIED Requirements

### Requirement: GraphMapToolbar 下拉框更新

原有的AI分析下拉框 SHALL 更新为优化后的视觉设计。

**修改前**:
- 简单的列表式下拉菜单
- 缺乏视觉层次
- hover效果单调
- 无明显分组

**修改后**:
- 卡片化选项设计
- 清晰的视觉层次
- 丰富的hover动画效果
- 图标容器突出显示
- 渐变按钮触发器

---

## 技术实现要点

### 触发按钮样式

```tsx
<button
  onClick={() => setShowAnalyzeMenu(!showAnalyzeMenu)}
  className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-purple-500 to-indigo-600 text-white rounded-lg shadow-md hover:shadow-lg hover:from-purple-600 hover:to-indigo-700 transition-all duration-200"
>
  <Sparkles className="w-4 h-4" />
  <span className="text-sm font-medium">AI 分析</span>
  <ChevronDown className={`w-4 h-4 transition-transform duration-200 ${showAnalyzeMenu ? 'rotate-180' : ''}`} />
</button>
```

### 下拉菜单样式

```tsx
{showAnalyzeMenu && (
  <div className="absolute top-full right-0 mt-2 bg-white dark:bg-slate-800 rounded-xl shadow-xl border border-gray-100 dark:border-slate-700 z-50 min-w-[220px] p-2 animate-in fade-in slide-in-from-top-2 duration-200">
    <button
      onClick={() => { onAnalyze(); setShowAnalyzeMenu(false); }}
      className="w-full flex items-start gap-3 p-3 rounded-lg hover:bg-purple-50 dark:hover:bg-purple-900/20 hover:ring-1 hover:ring-purple-200 dark:hover:ring-purple-700 transition-all duration-150 group"
    >
      <div className="w-8 h-8 rounded-lg bg-purple-100 dark:bg-purple-900/40 flex items-center justify-center flex-shrink-0">
        <Sparkles className="w-4 h-4 text-purple-600 dark:text-purple-400" />
      </div>
      <div className="text-left flex-1 min-w-0">
        <div className="text-sm font-semibold text-gray-900 dark:text-white">基础分析</div>
        <div className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed">分析孤岛图谱和关系建议</div>
      </div>
    </button>
    <button
      onClick={() => { onIntelligentAnalyze(); setShowAnalyzeMenu(false); }}
      className="w-full flex items-start gap-3 p-3 rounded-lg hover:bg-indigo-50 dark:hover:bg-indigo-900/20 hover:ring-1 hover:ring-indigo-200 dark:hover:ring-indigo-700 transition-all duration-150 group"
    >
      <div className="w-8 h-8 rounded-lg bg-indigo-100 dark:bg-indigo-900/40 flex items-center justify-center flex-shrink-0">
        <Brain className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
      </div>
      <div className="text-left flex-1 min-w-0">
        <div className="text-sm font-semibold text-gray-900 dark:text-white">智能分析</div>
        <div className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed">AI发现潜在关系和跨学科关联</div>
      </div>
    </button>
  </div>
)}
```

### 移动端适配

移动端下拉菜单同样应用优化后的样式，但保持紧凑布局。
