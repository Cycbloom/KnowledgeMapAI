# Agent 分析功能优化计划

## 用户需求确认

1. **执行模式**：Agent 自动运行 → 推荐关联图谱 → 用户确认后创建连接
2. **报告展示**：需要 Markdown 渲染（目前没有）
3. **工具调用**：前端不展示或默认折叠，用户不需要看工具调用细节

---

## 实施计划

### 步骤 1：优化前端展示

#### 1.1 添加 Markdown 渲染
- 使用 `react-markdown` 渲染分析结果
- 支持代码高亮、链接等

#### 1.2 隐藏/折叠工具调用日志
- 默认折叠 `SessionLog` 组件
- 或完全隐藏工具调用细节

### 步骤 2：结构化 Agent 输出

#### 2.1 修改 Agent 返回结构
```typescript
interface AnalysisResult {
  summary: string;           // Markdown 格式的分析报告
  recommendations: Array<{   // 推荐的图谱关联
    source_graph_id: string;
    source_graph_title: string;
    target_graph_id: string;
    target_graph_title: string;
    relation_type: 'prerequisite' | 'extension' | 'related' | 'cross_domain';
    reason: string;          // 推荐理由
  }>;
}
```

#### 2.2 修改 System Prompt
- 要求 AI 返回结构化的 JSON 格式
- 包含推荐的图谱关联列表

### 步骤 3：添加"创建连接"功能

#### 3.1 后端新增工具
- `create_graph_relation`：创建图谱关系

#### 3.2 前端交互
- 展示推荐列表（可勾选）
- 提供"应用选中项"按钮
- 点击后调用 API 创建连接

---

## 详细实施步骤

### 第一阶段：前端优化（立即实施）

1. **安装 react-markdown**
2. **修改 AnalysisResultView**：渲染 Markdown
3. **修改 SessionLog**：默认折叠或隐藏

### 第二阶段：结构化输出

1. **修改 types.ts**：定义 AnalysisResult 结构
2. **修改 AgentService**：解析 AI 返回的 JSON
3. **修改前端**：展示推荐列表

### 第三阶段：创建连接功能

1. **新增后端工具**：create_graph_relation
2. **新增前端 API**：应用推荐
3. **前端交互**：勾选 + 应用按钮
