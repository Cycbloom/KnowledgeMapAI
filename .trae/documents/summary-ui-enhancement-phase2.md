# Summary UI 增强 — 第二阶段计划

## 概述

`summary` 字段已在数据库、API、类型定义中全面就位，部分 UI 已实现展示。本计划将 summary 推广到更多 UI 位置，替代 `content` 截断方式，提供更精准的节点概览信息。

## 现状分析

### 已实现 summary 展示的组件（6个）
| 组件 | 位置 | 状态 |
|------|------|------|
| MindMapNode (detail层级) | `src/components/GraphEditor/canvas/MindMapNode.tsx:914` | ✅ 优先 summary，回退 content 截断 |
| NodeDetailSidebar | `src/components/GraphEditor/sidebar/NodeDetailSidebar.tsx:179` | ✅ 标题下方展示 |
| CombinedNodeDetailSidebar | `src/components/CombinedView/CombinedNodeDetailSidebar.tsx:135` | ✅ 标题下方展示 |
| NodeEditSidebar | `src/components/GraphEditor/sidebar/NodeEditSidebar.tsx:271` | ✅ 可编辑 |
| CombinedNodeEditSidebar | `src/components/CombinedView/CombinedNodeEditSidebar.tsx:83` | ✅ 可编辑 |
| SearchResults | `src/components/common/SearchResults.tsx:186` | ✅ 前端已适配，但**后端未返回 summary** |

### 未实现 summary 展示的组件（8个）
| 组件 | 位置 | 当前行为 | 优先级 |
|------|------|---------|--------|
| NodePreviewCard | `src/components/GraphEditor/shared/NodePreviewCard.tsx:62` | content 截断150字 | **高** |
| MobileNodePreviewCard | `src/components/GraphEditor/mobile/MobileNodePreviewCard.tsx:63` | content 截断120字 | **高** |
| NodeSelectorModal | `src/components/GraphMap/NodeSelectorModal.tsx:282` | 直接展示 content | **高** |
| KnowledgePointSelector | `src/components/Quiz/KnowledgePointSelector.tsx:276` | 直接展示 content | **高** |
| TextToGraphModal | `src/components/GraphEditor/modals/TextToGraphModal.tsx:632` | 直接展示 content | 中 |
| AutoGraphGenerator | `src/components/AutoGraph/AutoGraphGenerator.tsx:231` | 直接展示 content | 中 |
| CommandPalette | `src/components/GraphEditor/shared/CommandPalette.tsx:57,64` | content 做搜索+关键词 | 低 |
| GraphOutline | `src/components/GraphEditor/panels/GraphOutline.tsx:158,448` | content 做搜索过滤 | 低 |

### 后端待修复
| 服务 | 位置 | 问题 |
|------|------|------|
| searchService (普通搜索) | `api/services/ai/searchService.ts:53` | select 未包含 summary |
| searchService (语义搜索) | `api/services/ai/searchService.ts:182-193` | 映射未包含 summary |

## 实施计划

### 第1步：修复后端搜索服务（前置依赖）

**文件**: `api/services/ai/searchService.ts`

1. **普通搜索 select 查询**（第53行）：
   - 原: `.select("id, title, content, owner_id, updated_at")`
   - 改: `.select("id, title, content, summary, owner_id, updated_at")`

2. **普通搜索结果映射**（约第101行）：
   - 添加 `summary: kp?.summary || ""`

3. **语义搜索结果映射**（约第182-193行）：
   - 添加 `summary: kp.summary || ""`

4. **SearchNodeResult 接口**（约第18-28行）：
   - 添加 `summary?: string`（如果尚未添加）

### 第2步：高优先级 UI 组件（4个预览/选择场景）

#### 2.1 NodePreviewCard（桌面端悬停预览）

**文件**: `src/components/GraphEditor/shared/NodePreviewCard.tsx`

修改 `contentPreview` 的 useMemo（第62-66行）：
```typescript
// 原：
const contentPreview = useMemo(() => {
  if (!node.content) return null;
  const text = node.content.replace(/[#*`[\]]/g, '').slice(0, 150);
  return text.length < node.content.length ? `${text}...` : text;
}, [node.content]);

// 改：
const contentPreview = useMemo(() => {
  if (node.summary) return node.summary;
  if (!node.content) return null;
  const text = node.content.replace(/[#*`[\]]/g, '').slice(0, 150);
  return text.length < node.content.length ? `${text}...` : text;
}, [node.summary, node.content]);
```

#### 2.2 MobileNodePreviewCard（移动端预览）

**文件**: `src/components/GraphEditor/mobile/MobileNodePreviewCard.tsx`

修改 `contentPreview` 的 useMemo（第63-67行）：
```typescript
// 原：
const contentPreview = React.useMemo(() => {
  if (!node.content) return null;
  const text = node.content.replace(/[#*`[\]]/g, '').slice(0, 120);
  return text.length < node.content.length ? `${text}...` : text;
}, [node.content]);

// 改：
const contentPreview = React.useMemo(() => {
  if (node.summary) return node.summary;
  if (!node.content) return null;
  const text = node.content.replace(/[#*`[\]]/g, '').slice(0, 120);
  return text.length < node.content.length ? `${text}...` : text;
}, [node.summary, node.content]);
```

#### 2.3 NodeSelectorModal（图谱地图节点选择器）

**文件**: `src/components/GraphMap/NodeSelectorModal.tsx`

修改第282-285行：
```tsx
// 原：
{node.content && (
  <div className={`text-xs truncate ${isDark ? 'text-slate-500' : 'text-gray-400'}`}>
    {node.content}
  </div>
)}

// 改：
{(node.summary || node.content) && (
  <div className={`text-xs truncate ${isDark ? 'text-slate-500' : 'text-gray-400'}`}>
    {node.summary || node.content}
  </div>
)}
```

#### 2.4 KnowledgePointSelector（测验知识点选择器）

**文件**: `src/components/Quiz/KnowledgePointSelector.tsx`

修改第276-279行：
```tsx
// 原：
{node.content && (
  <div className={`text-xs truncate ${isDark ? 'text-slate-500' : 'text-gray-400'}`}>
    {node.content}
  </div>
)}

// 改：
{(node.summary || node.content) && (
  <div className={`text-xs truncate ${isDark ? 'text-slate-500' : 'text-gray-400'}`}>
    {node.summary || node.content}
  </div>
)}
```

### 第3步：中优先级 UI 组件（2个生成预览场景）

#### 3.1 TextToGraphModal（文本生成图谱预览）

**文件**: `src/components/GraphEditor/modals/TextToGraphModal.tsx`

修改第632行：
```tsx
// 原：
<p className="text-gray-500 text-xs mt-1 line-clamp-2">{node.content}</p>

// 改：
<p className="text-gray-500 text-xs mt-1 line-clamp-2">{node.summary || node.content}</p>
```

#### 3.2 AutoGraphGenerator（自动生成图谱预览）

**文件**: `src/components/AutoGraph/AutoGraphGenerator.tsx`

修改第231行：
```tsx
// 原：
{node.content}

// 改：
{node.summary || node.content}
```

### 第4步：低优先级 — 搜索增强（可选）

#### 4.1 CommandPalette

**文件**: `src/components/GraphEditor/shared/CommandPalette.tsx`

- 第57行：搜索匹配增加 summary
  ```typescript
  // 原：
  if (node.title.toLowerCase().includes(lowerQuery) || (node.content && node.content.toLowerCase().includes(lowerQuery))) {
  // 改：
  if (node.title.toLowerCase().includes(lowerQuery) || (node.summary && node.summary.toLowerCase().includes(lowerQuery)) || (node.content && node.content.toLowerCase().includes(lowerQuery))) {
  ```
- 第64行：关键词优先用 summary
  ```typescript
  // 原：
  keywords: [node.content?.slice(0, 50) || '']
  // 改：
  keywords: [node.summary || node.content?.slice(0, 50) || '']
  ```

#### 4.2 GraphOutline

**文件**: `src/components/GraphEditor/panels/GraphOutline.tsx`

- 第158行：搜索过滤增加 summary
  ```typescript
  // 原：
  (node.content && node.content.toLowerCase().includes(query)),
  // 改：
  (node.summary && node.summary.toLowerCase().includes(query)) || (node.content && node.content.toLowerCase().includes(query)),
  ```
- 第448行：搜索匹配增加 summary
  ```typescript
  // 原：
  const nodeContent = (node.content || "").toLowerCase();
  // 改：
  const nodeContent = (node.summary || node.content || "").toLowerCase();
  ```

### 不修改的组件

| 组件 | 原因 |
|------|------|
| LearningPathDetail | 展示完整内容，summary 不应替代 |
| ConnectionDiscovery | 用 content 做语义相似度计算，summary 信息量不足 |

## 验证步骤

1. 运行 `npm run check` 类型检查
2. 运行 `npm run lint` 代码检查
3. 手动验证：
   - 悬停节点时 NodePreviewCard 显示 summary
   - 搜索结果中显示 summary
   - 节点选择器中显示 summary
   - 自动生成图谱预览中显示 summary
