# 文献视图悬浮卡片功能实施计划

## 需求概述

在专题研究类型（topic_research）图谱的学习模式（Learning Mode）页面中，左侧大纲视图切换到"文献视图"时，当鼠标悬浮在文献条目上，需要在右侧展示该论文的详细信息卡片，UI 类似于右侧面板文献提取时的文献信息卡片。

## 当前代码结构分析

### 关键文件
1. **GraphOutline.tsx** (第754-870行) - 文献视图渲染函数 `renderLiteratureView()`
2. **LiteratureMetadataCard.tsx** - 已有的文献信息卡片组件（支持 compact 模式）
3. **LearningMode.tsx** - 学习模式主页面

### 数据结构
- **ConceptSource** (`shared/types/graph.ts`): 文献来源数据
  ```typescript
  interface ConceptSource {
    title: string;
    authors?: string[];
    year?: number;
    url?: string;
    fileName?: string;
    addedAt: string;
  }
  ```

- **LiteratureMetadata** (`LiteratureExtract/LiteratureMetadataForm.tsx`): 文献元数据
  ```typescript
  interface LiteratureMetadata {
    title: string;
    authors: string[];
    year?: number;
    type: LiteratureType;  // paper | book | article | report | webpage | document
    journal?: string;
    doi?: string;
    keywords: string[];
    notes?: string;
  }
  ```

### 现有功能
- `LiteratureMetadataCard` 组件已支持 `compact` 模式（第69-161行），鼠标悬浮时会显示完整信息
- 文献视图中的每个条目显示：标题、作者、年份、关联节点数量

## 实施方案

### 方案选择：使用 Popover/Tooltip 悬浮卡片

在文献列表项上添加鼠标悬浮事件，显示一个定位的悬浮卡片，复用 `LiteratureMetadataCard` 的内容展示逻辑。

## 详细实施步骤

### 步骤 1：修改 GraphOutline.tsx - 添加状态管理

**文件**: `src/components/GraphEditor/panels/GraphOutline.tsx`

**位置**: 第506-509行附近（state 声明区域）

添加新的 state 来跟踪当前悬浮的文献：
```typescript
const [hoveredLiterature, setHoveredLiterature] = useState<{
  key: string;
  title: string;
  authors?: string[];
  year?: number;
  nodes: Node[];
} | null>(null);
const [hoverPosition, setHoverPosition] = useState<{ x: number; y: number } | null>(null);
```

### 步骤 2：修改 renderLiteratureView() 函数 - 添加 hover 事件

**文件**: `src/components/GraphEditor/panels/GraphOutline.tsx`

**位置**: 第763-870行

修改文献组标题部分（第769-828行）：
1. 添加 `onMouseEnter` 和 `onMouseLeave` 事件处理
2. 计算悬浮位置
3. 只对非"未分类"条目启用 hover 功能

```typescript
<div
  className={`flex items-center gap-2 px-3 py-2 cursor-pointer rounded-md transition-colors relative group/literature ${
    isUncategorized
      ? "hover:bg-slate-50 dark:hover:bg-slate-800 border border-dashed border-slate-300 dark:border-slate-600"
      : "hover:bg-slate-50 dark:hover:bg-slate-800"
  }`}
  style={{
    borderLeft: isUncategorized
      ? "3px solid var(--slate-400)"
      : "3px solid var(--tertiary-500)",
  }}
  onClick={() => toggleLiteratureExpand(group.key)}
  onMouseEnter={(e) => {
    if (!isUncategorized) {
      const rect = e.currentTarget.getBoundingClientRect();
      setHoveredLiterature({
        key: group.key,
        title: group.title,
        authors: group.authors,
        year: group.year,
        nodes: group.nodes,
      });
      setHoverPosition({ x: rect.right, y: rect.top });
    }
  }}
  onMouseLeave={() => {
    setHoveredLiterature(null);
    setHoverPosition(null);
  }}
>
```

### 步骤 3：创建文献信息悬浮卡片组件

**新建文件**: `src/components/GraphEditor/LiteratureHoverCard.tsx`

创建专用的悬浮卡片组件，展示文献详细信息：
- 显示文献标题、作者、年份
- 显示关联的概念节点列表（节点标题和级别标识）
- 支持点击节点跳转
- 使用绝对定位，跟随触发元素
- 支持深色模式

**组件特性**：
1. 接收 `ConceptSource` 类型的数据和关联节点列表
2. 展示格式化的作者信息
3. 展示年份
4. 列出所有从该文献提取的概念节点
5. 节点可点击（调用 onNodeClick）
6. 动画效果（淡入淡出）
7. 自动定位（避免超出屏幕边界）

### 步骤 4：集成悬浮卡片到文献视图

**文件**: `src/components/GraphEditor/panels/GraphOutline.tsx`

**位置**: renderLiteratureView() 函数返回的 JSX 中

在文献列表容器内添加条件渲染的悬浮卡片：
```typescript
{hoveredLiterature && hoverPosition && (
  <LiteratureHoverCard
    literature={hoveredLiterature}
    position={hoverPosition}
    onNodeClick={onNodeClick}
    isDark={/* 从 context 或 props 获取 */}
  />
)}
```

### 步骤 5：样式优化

确保：
1. 悬浮卡片有合适的 z-index（高于大纲视图但低于模态框）
2. 卡片宽度适中（约 320-380px）
3. 最大高度限制，内部可滚动
4. 平滑的过渡动画
5. 边框和阴影效果
6. 响应式设计（移动端禁用或改为点击触发）

## 技术细节

### 定位策略
- 使用 `position: fixed` 定位
- 根据触发元素的 `getBoundingClientRect()` 计算
- 智能调整位置（如果右侧空间不足则显示在左侧）
- 如果底部空间不足则向上偏移

### 性能优化
- 使用 `useMemo` 缓存文献分组数据
- 防抖处理快速移入移出
- 延迟显示（200ms 延迟，避免误触）

### 可访问性
- 支持 keyboard 导航（可选：Tab 键聚焦时显示）
- ESC 键关闭
- ARIA 标签

## 测试要点

1. **基本功能**
   - [ ] 鼠标悬浮在文献条目上显示卡片
   - [ ] 鼠标离开后卡片消失
   - [ ] 卡片显示正确的文献信息（标题、作者、年份）
   - [ ] 卡片显示关联的概念节点列表

2. **交互测试**
   - [ ] 点击卡片中的节点可以跳转到对应节点
   - [ ] 快速移动鼠标不会导致卡片闪烁
   - [ ] 展开文献组后悬浮仍正常工作

3. **边界情况**
   - [ ] 文献列表很长时（滚动场景）
   - [ ] 屏幕边缘的文献条目（自动调整位置）
   - [ ] "未分类"条目不显示悬浮卡片
   - [ ] 没有关联节点的文献
   - [ ] 作者信息缺失的情况

4. **视觉测试**
   - [ ] 浅色模式下的显示效果
   - [ ] 深色模式下的显示效果
   - [ ] 移动端适配（触摸设备不触发或改为长按）

5. **性能测试**
   - [ ] 大量文献（50+）时的性能
   - [ ] 快速滚动时的表现

## 实施顺序建议

1. ✅ 步骤 1：添加状态管理
2. ✅ 步骤 2：修改 renderLiteratureView 添加事件
3. ✅ 步骤 3：创建 LiteratureHoverCard 组件
4. ✅ 步骤 4：集成到文献视图
5. ✅ 步骤 5：样式调优和测试

## 预期效果

用户在 Learning Mode 页面的左侧大纲视图中：
1. 切换到"文献视图"模式
2. 将鼠标移动到任意文献条目上（非"未分类"）
3. 在条目右侧出现一个精美的悬浮卡片
4. 卡片展示：
   - 📄 文献图标和标题（加粗）
   - 👥 作者列表
   - 📅 发表年份
   - 🔗 关联概念节点列表（带颜色标识）
5. 点击节点可直接跳转到该节点的学习内容
6. 鼠标移开后卡片平滑消失

## 备选方案（如果方案1复杂度高）

**简化方案**：直接复用 `LiteratureMetadataCard` 的 compact 模式
- 优点：代码复用高，实现快
- 缺点：需要将 ConceptSource 转换为 LiteratureMetadata 格式，且 compact 模式的 UI 可能不完全符合需求

**推荐采用方案1**：创建专用组件，更灵活且符合特定需求。
