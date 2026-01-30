# 实现 AI 文本一键生成图谱 (Text-to-Graph)

我们将实现一个功能，允许用户输入文本，AI 自动提取概念和关系，并在当前图谱中生成节点和连线。

## 1. 后端 API 开发
### 1.1 定义 Schema
在 `api/schemas/index.ts` 中添加 `textToGraphSchema`，用于验证请求参数。
- 输入: `text` (文本内容), `graph_id` (目标图谱ID)

### 1.2 实现路由处理
在 `api/routes/ai.ts` 中新增 `POST /text-to-graph` 接口。
- **Prompt 设计**: 指示 AI 从文本中提取节点和边，并以结构化 JSON 格式返回（包含临时 ID 用于构建关系）。
- **ID 映射与入库**:
    1.  解析 AI 返回的 JSON。
    2.  为每个新节点生成真实的 UUID，建立 `Temp ID -> Real UUID` 的映射。
    3.  批量插入 `nodes` 表（设置随机初始坐标以免重叠）。
    4.  使用映射后的 UUID 批量插入 `edges` 表。
- **返回**: 成功消息及生成的节点/边数量。

## 2. 前端开发
### 2.1 新增 API Hook
在 `src/hooks/useQueries.ts` 中添加 `useTextToGraphMutation`，封装对后端接口的调用。

### 2.2 创建模态框组件
新建 `src/components/GraphEditor/TextToGraphModal.tsx`:
- 包含一个多行文本输入框 (Textarea)。
- “开始生成”按钮。
- 加载状态展示 (Loading Spinner)。

### 2.3 集成到编辑器
修改 `src/pages/GraphEditor.tsx`:
- 引入 `TextToGraphModal` 组件。
- 在顶部工具栏（Toolbar）添加“AI 生成”按钮（使用 `Sparkles` 或 `Wand2` 图标）。
- 处理生成成功后的回调：关闭模态框并自动刷新图谱数据。

## 3. 验证计划
1.  启动前后端服务。
2.  进入图谱编辑器，点击新加的“AI 生成”按钮。
3.  输入一段测试文本（如：“太阳系由太阳和八大行星组成，其中地球孕育了生命。”）。
4.  确认图谱中是否正确生成了“太阳系”、“太阳”、“地球”、“生命”等节点及其连接关系。
