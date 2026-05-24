# AI 操作类型中文翻译补全 Plan

## 问题诊断

### 核心问题

前端 `getOperationLabel()` 通过 `console.performance.operations.${operation}` 查找翻译，找不到时**直接显示英文原名**（如 `backbone_generation`、`classifyConcept`、`generateCards` 等）。

### 当前翻译覆盖情况

**已有翻译（匹配后端 operation 名称的）**：约 23 个
**缺失翻译（后端在用但无对应 key 的）**：约 15 个

### 缺失翻译完整清单

| # | 后端 operation 名称 | 建议中文翻译 | 英文翻译 |
|---|---------------------|-------------|---------|
| 1 | `tutorChat` | 导师对话 | Tutor Chat |
| 2 | `generateCards` | 生成卡片 | Generate Cards |
| 3 | `expandKnowledge` | 扩展知识 | Expand Knowledge |
| 4 | `classifyConcept` | 概念分类 | Classify Concept |
| 5 | `locateBackboneModule` | 定位主干模块 | Locate Backbone Module |
| 6 | `detectLiteratureType` | 检测文献类型 | Detect Literature Type |
| 7 | `backbone_generation` | 主干网络生成 | Backbone Generation |
| 8 | `backbone_validation` | 主干网络验证 | Backbone Validation |
| 9 | `rag_suggest_questions` | RAG 建议问题 | RAG Suggest Questions |
| 10 | `generate_embedding` | 生成嵌入向量 | Generate Embedding |
| 11 | `generate_embedding_batch` | 批量生成嵌入 | Batch Generate Embedding |
| 12 | `generate_podcast_script` | 生成播客脚本 | Generate Podcast Script |
| 13 | `text_to_graph` | 文本转图谱 | Text to Graph |
| 14 | `document_to_graph` | 文档转图谱 | Document to Graph |
| 15 | `image_to_graph` | 图像转图谱 | Image to Graph |

> 注：zh-CN.json 中存在一些使用 **连字符** 命名的 key（如 `tutor-chat`、`text-to-graph`），但后端实际 operation 使用的是 **下划线/驼峰**（如 `tutorChat`、`text_to_graph`）。这些连字符 key 实际上永远不会被匹配到，属于死 key。

## 实施方案

### Step 1: 补充 zh-CN.json 翻译

**文件**: `src/i18n/locales/zh-CN.json`

在 `console.performance.operations` 对象内（当前第 1082 行 `}` 之前）添加以上 15 个缺失条目。

### Step 2: 补充 en-US.json 翻译

**文件**: `src/i18n/locales/en-US.json`

同步添加对应的英文翻译。

### Step 3: 清理无效的死 key（可选）

zh-CN.json 中以下 key 使用了与后端不匹配的命名（连字符 vs 下划线/驼峰），永远不会被命中：
- `tutor-chat` → 已有 `tutorChat` 需求，但后端用的是 `tutor_chat`
- `text-to-graph` → 后端用 `text_to_graph`
- `document-to-graph` → 后端用 `document_to_graph`
- `image_to_graph` → 后端用 `image_to_graph`（这个倒是一致的）
- `generate-cards` → 后端用 `generateCards`
- `expand-knowledge` → 后端用 `expandKnowledge`
- `extract-concepts` → 后端用 `extractConcepts`
- `branch-suggestions` → 后端用 `getBranchSuggestions`
- `cross-graph-connections` → 后端用 `analyzeCrossGraphConnections`
- `podcast-script` → 后端用 `generate_podcast_script`
- `generate-content` → 后端用 `generate_content`

**建议**：保留这些旧 key 不删除（避免破坏其他可能引用它们的地方），只添加新的正确命名的 key。

### Step 4: 验证

- 运行 `npm run check` — JSON 格式检查通过
- 确认所有后端 operation 都能找到对应翻译

## 影响范围

仅修改 **2 个文件**：
- `src/i18n/locales/zh-CN.json` — 添加 ~15 条中文翻译
- `src/i18n/locales/en-US.json` — 添加 ~15 条英文翻译

## 预期效果

修复前：
```
✓ backbone_generation   deepseek-chat    5.2K tokens   ¥0.015    ← 显示英文原名
✓ classifyConcept      deepseek-chat    3.1K tokens   ¥0.008
✓ generateCards        deepseek-chat    1.8K tokens   ¥0.005
```

修复后：
```
✓ 主干网络生成         deepseek-chat    5.2K tokens   ¥0.015    ← 显示中文
✓ 概念分类             deepseek-chat    3.1K tokens   ¥0.008
✓ 生成卡片             deepseek-chat    1.8K tokens   ¥0.005
```
