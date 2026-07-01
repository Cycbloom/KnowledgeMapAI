# 搜索结果导航增强计划

## 摘要

首页搜索节点结果点击后，当前仅跳转到图谱页面但不选中/高亮节点。需要：
1. 修复节点跳转后自动选中并高亮
2. 支持两种跳转目标：图谱（高亮节点）和学习模式（显示学习资料）
3. 在设置中可配置默认跳转目标，默认为图谱

## 当前状态分析

### 问题1：SearchResults 节点点击未传递 node_id
- 文件：[SearchResults.tsx](file:///d:/KnowledgeMap/src/components/common/SearchResults.tsx#L48-L51)
- `handleNodeClick` 仅导航到 `/graph/${graphId}`，缺少 `?node_id=xxx`

### 问题2：GraphEditor 不读取 URL 的 node_id 参数
- 文件：[GraphEditor.tsx](file:///d:/KnowledgeMap/src/pages/GraphEditor.tsx#L202)
- 仅使用 `useParams` 读取路径参数 `id`，不读取 `useSearchParams`
- 已有 `handleCommandPaletteNodeSelect` 和 `searchHighlightNodeId` 机制可实现节点高亮

### 问题3：不支持跳转到学习模式
- 学习模式已支持 `?graph_id=xxx&node_id=xxx` 参数
- 文件：[LearningMode.tsx](file:///d:/KnowledgeMap/src/pages/LearningMode.tsx#L55-L57)
- 但搜索结果没有提供跳转到学习模式的选项

## 方案设计

### 交互方案
- **搜索结果中每个节点添加两个跳转按钮**：小图标按钮，一个跳图谱，一个跳学习模式
- **设置页增加"搜索跳转偏好"**：在 GraphEditorSettings 中添加默认跳转目标选项
- **默认跳转目标为图谱**（用户建议 + 更合理：图谱可看到全局位置）
- 节点主点击区域仍按默认设置跳转，右侧显示两个小图标按钮可快速切换

### 设置存储
- 复用 `GraphEditorSettings.tsx` 的 localStorage 模式
- 新增偏好字段：`searchNodeNavigateTarget: "graph" | "learning"`
- 存储在 `graphEditorPreferences` 的 localStorage key 中

## 具体变更

### 1. 修改 SearchResults.tsx — 添加双跳转目标
**文件**：[SearchResults.tsx](file:///d:/KnowledgeMap/src/components/common/SearchResults.tsx)

- 修改 `handleNodeClick` 为 `handleNodeNavigate`，接受 `graphId`, `nodeId`, `target` 参数
- `target: "graph"` → 导航到 `/graph/${graphId}?node_id=${nodeId}`
- `target: "learning"` → 导航到 `/learning?graph_id=${graphId}&node_id=${nodeId}`
- 节点结果每行添加两个小图标按钮（Network 图标→图谱，BookOpen 图标→学习模式）
- 主点击区域读取 localStorage 中的默认偏好进行跳转
- 新增 `handleGraphClick` 也要传递 node_id（如果是图谱类型的节点结果的话不需要，图谱结果只跳图谱）

### 2. 修改 GraphEditor.tsx — 读取 URL 的 node_id 并高亮选中
**文件**：[GraphEditor.tsx](file:///d:/KnowledgeMap/src/pages/GraphEditor.tsx)

- 添加 `useSearchParams` 读取 `node_id` 参数
- 在图谱数据加载完成后（`nodes` 有值时），检查 URL 中的 `node_id`
- 如果存在 `node_id`，调用已有的 `handleCommandPaletteNodeSelect` 逻辑：选中节点、聚焦、设置高亮动画
- 使用 `useEffect` 监听 `node_id` 和 `nodes` 变化，避免重复触发

### 3. 修改 GraphEditorSettings.tsx — 添加搜索跳转偏好设置
**文件**：[GraphEditorSettings.tsx](file:///d:/KnowledgeMap/src/components/Settings/GraphEditorSettings.tsx)

- 在 `GraphEditorPreferences` 接口添加 `searchNodeNavigateTarget: "graph" | "learning"`
- 默认值设为 `"graph"`
- 在 UI 中添加"搜索节点跳转目标"设置项，使用两个选择按钮（图谱/学习模式）

### 4. 添加 i18n 翻译
**文件**：
- [zh-CN/settings.json](file:///d:/KnowledgeMap/src/i18n/locales/zh-CN/settings.json#L171)
- [en-US/settings.json](file:///d:/KnowledgeMap/src/i18n/locales/en-US/settings.json#L171)
- [zh-CN/dashboard.json](file:///d:/KnowledgeMap/src/i18n/locales/zh-CN/dashboard.json#L14)
- [en-US/dashboard.json](file:///d:/KnowledgeMap/src/i18n/locales/en-US/dashboard.json#L14)

新增 key：
```json
// settings.json - graphEditor 下
"searchNodeNavigateTarget": "搜索节点跳转目标",
"searchNodeNavigateTargetDesc": "点击搜索结果中的节点时，默认跳转到的页面",
"navigateToGraph": "图谱",
"navigateToGraphDesc": "跳转到图谱页面并高亮选中节点",
"navigateToLearning": "学习模式",
"navigateToLearningDesc": "跳转到学习模式并显示节点学习资料"

// dashboard.json - search 下
"navigateToGraph": "跳转到图谱",
"navigateToLearning": "跳转到学习模式"
```

## 假设与决策

1. **默认跳转为图谱**：用户建议 + 图谱模式能看到节点在整体知识结构中的位置，更直观
2. **设置放在 GraphEditorSettings 中**：因为这是搜索→图谱的偏好，与图谱编辑器设置最相关，且已有 localStorage 持久化机制
3. **搜索结果中同时显示两个小按钮**：用户可以在不修改设置的情况下快速切换跳转目标
4. **节点高亮使用已有机制**：复用 `searchHighlightNodeId` + `handleCommandPaletteNodeSelect` 的3秒高亮动画
5. **SearchNodeResult 中使用 `knowledge_point_id` 作为 node_id**：与 API 返回的字段一致

## 验证步骤

1. 搜索节点 → 点击主区域 → 默认跳转到图谱，节点被选中并高亮
2. 搜索节点 → 点击学习模式小图标 → 跳转到学习模式，显示对应节点学习资料
3. 搜索节点 → 点击图谱小图标 → 跳转到图谱，节点被选中并高亮
4. 设置中修改默认跳转为学习模式 → 搜索节点点击主区域 → 跳转到学习模式
5. 搜索图谱结果 → 点击 → 仍跳转到图谱（图谱结果不涉及学习模式跳转）
6. 直接在浏览器地址栏输入 `/graph/xxx?node_id=yyy` → 节点被选中并高亮
7. 运行 `npm run check` 和 `npm run lint` 确保无类型和代码规范错误
