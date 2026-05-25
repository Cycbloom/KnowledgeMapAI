# 统一文献卡片 UI 实施计划

## 问题分析

当前存在两个展示文献信息的卡片组件，UI 风格和信息丰富度不一致：

### 1. LiteratureMetadataCard（文献提取面板）
- **位置**: `src/components/LiteratureExtract/LiteratureMetadataCard.tsx`
- **特点**: 信息丰富，UI 完整
- **展示内容**:
  - ✅ 文献类型图标（带颜色区分）
  - ✅ 标题（完整显示）
  - ✅ 完整作者列表
  - ✅ 年份
  - ✅ 期刊名称
  - ✅ 文献类型彩色标签
  - ✅ DOI 链接（可点击）
  - ✅ 关键词标签（最多5个）

### 2. LiteratureHoverCard（大纲视图悬停卡片）
- **位置**: `src/components/GraphEditor/LiteratureHoverCard.tsx`
- **特点**: 信息较简陋，UI 风格不同
- **当前展示内容**:
  - ✅ 图标 + 标题
  - ✅ 作者（简化版：et al. 格式）
  - ✅ 年份
  - ⚠️ 已提取概念数量（这个是特有的）
  - ❌ 缺少期刊名称的独立展示
  - ❌ 缺少文献类型彩色标签
  - ❌ DOI/URL 展示不够醒目
  - ❌ 关键词展示样式不一致

## 解决方案

**采用方案 A：复用 LiteratureMetadataCard 的渲染逻辑**

将 `LiteratureMetadataCard` 的 `renderFullContent()` 方法提取为共享组件，让 `LiteratureHoverCard` 复用相同的 UI 风格和布局。

## 实施步骤

### 步骤 1: 创建共享的文献内容组件
- **文件**: `src/components/LiteratureExtract/shared/LiteratureCardContent.tsx`
- **目的**: 提取 LiteratureMetadataCard 的核心渲染逻辑为独立组件
- **功能**:
  - 接收 `LiteratureMetadata` 类型的 props
  - 渲染标准的文献信息布局（图标、标题、作者、年份、期刊、类型标签、DOI、关键词）
  - 支持深色模式 (`isDark` prop)
  - 保持与原 LiteratureMetadataCard 完全一致的视觉风格

### 步骤 2: 重构 LiteratureMetadataCard
- **文件**: `src/components/LiteratureExtract/LiteratureMetadataCard.tsx`
- **改动**:
  - 导入并使用新的 `LiteratureCardContent` 组件
  - 将 `renderFullContent()` 方法替换为 `<LiteratureCardContent />`
  - 保持原有的 compact 模式和编辑/删除功能不变

### 步骤 3: 重构 LiteratureHoverCard
- **文件**: `src/components/GraphEditor/LiteratureHoverCard.tsx`
- **改动**:
  - 导入 `LiteratureCardContent` 组件
  - 将当前的元数据区域替换为 `<LiteratureCardContent />`
  - 保留悬停卡片特有功能:
    - ✅ 固定定位逻辑 (`position` prop)
    - ✅ 视口边界检测和自动调整
    - ✅ 已提取概念数量的 footer 区域
    - ✅ 文件名显示（如果有的话）
  - 移除重复的格式化函数（`formatAuthors`, `formatKeywords` 等）

### 步骤 4: 数据适配层
- **位置**: `GraphOutline.tsx` 中的 `literatureGroups` 构建逻辑
- **确保数据完整性**:
  - 验证从 `literatureSourcesMap` 获取的数据是否包含所有必要字段
  - 添加 fallback 逻辑：当某些字段缺失时优雅降级
  - 确保传递给 LiteratureHoverCard 的数据结构与 LiteratureMetadata 兼容

### 步骤 5: 样式微调（如果需要）
- 对比两个场景下的视觉效果
- 确保悬停卡片在固定定位下的布局合理（宽度、内边距等）
- 调整字体大小以适应悬停卡片的紧凑空间（如有必要）

## 技术细节

### LiteratureCardContent 组件接口

```typescript
interface LiteratureCardContentProps {
  metadata: {
    title: string;
    authors: string[];
    year?: number;
    journal?: string;
    type: LiteratureType;  // paper | book | article | report | webpage | document
    doi?: string;
    keywords?: string[];
  };
  isDark: boolean;
  className?: string;  // 可选的自定义样式
}
```

### 视觉一致性保证

1. **图标系统**: 使用与 LiteratureMetadataCard 相同的 `LITERATURE_TYPE_CONFIG` 配置
2. **颜色方案**: 复用相同的类型颜色映射
3. **布局结构**: 
   - Header: 类型图标 + 标题 + 类型标签
   - Metadata: 作者、年份、期刊（带图标前缀）
   - Links: DOI/URL（可点击）
   - Tags: 关键词（圆角标签）
4. **响应式**: 保持在悬停卡片宽度限制（320px）内的良好展示

## 预期效果

✅ **统一性**: 两个场景下看到完全一致的文献信息展示
✅ **信息完整性**: 悬停卡片将展示期刊、DOI、关键词等之前缺失的信息
✅ **可维护性**: 核心渲染逻辑集中管理，未来修改只需改一处
✅ **用户体验**: 无论在哪个界面，用户获得相同质量的信息预览

## 测试要点

1. 在专题研究模板的大纲视图中，鼠标悬停文献项
2. 验证显示内容包括：标题、完整作者、年份、期刊、类型标签、DOI、关键词
3. 对比文献提取面板中的卡片，确保视觉一致
4. 测试深色模式下的显示效果
5. 测试边界情况：缺少某些字段时的优雅降级
6. 验证已提取概念数量仍然正常显示（footer 区域）
7. 测试视口边界情况下的定位调整是否正常

## 影响范围

- **修改文件**:
  - `src/components/LiteratureExtract/shared/LiteratureCardContent.tsx` (新建)
  - `src/components/LiteratureExtract/LiteratureMetadataCard.tsx` (重构)
  - `src/components/GraphEditor/LiteratureHoverCard.tsx` (重构)
  
- **可能影响的调用处**:
  - `src/components/LiteratureExtract/LiteratureExtractPanel.tsx` (使用 LiteratureMetadataCard)
  - `src/components/GraphEditor/panels/GraphOutline.tsx` (使用 LiteratureHoverCard)

## 风险评估

- **低风险**: 主要是 UI 重构，不涉及业务逻辑变更
- **注意事项**:
  - 确保 LiteratureMetadataCard 的 compact 模式不受影响
  - 保持 LiteratureHoverCard 的定位逻辑完好
  - 注意 TypeScript 类型定义的一致性
