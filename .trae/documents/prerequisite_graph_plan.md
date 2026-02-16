# 前置知识图谱功能实现计划

## 功能概述

当用户在学习路径规划中评估前置知识时，如果某些知识点"不了解"，系统可以：
1. 自动为这些前置知识创建新的知识图谱
2. 建立图谱间的依赖关系
3. 在 UI 中展示和管理关联图谱

## 数据库设计

### 新增表：graph_relations

```sql
CREATE TABLE graph_relations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_graph_id UUID REFERENCES knowledge_graphs(id) ON DELETE CASCADE,
  target_graph_id UUID REFERENCES knowledge_graphs(id) ON DELETE CASCADE,
  relation_type VARCHAR(50) NOT NULL,  -- 'prerequisite', 'extension', 'related'
  context TEXT,                         -- 关联的上下文说明
  metadata JSONB DEFAULT '{}',          -- 额外元数据
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  UNIQUE(source_graph_id, target_graph_id, relation_type)
);

-- 索引
CREATE INDEX idx_graph_relations_source ON graph_relations(source_graph_id);
CREATE INDEX idx_graph_relations_target ON graph_relations(target_graph_id);
```

### 更新 knowledge_graphs 表

```sql
ALTER TABLE knowledge_graphs ADD COLUMN IF NOT EXISTS 
  parent_graph_id UUID REFERENCES knowledge_graphs(id) ON DELETE SET NULL;
```

## API 设计

### 1. 创建前置知识图谱

**POST /api/graphs/:id/prerequisite-graph**

```typescript
// Request
{
  topic: string;           // 前置知识主题
  description?: string;    // 描述
  autoGenerate?: boolean;  // 是否自动生成节点
}

// Response
{
  graphId: string;
  graph: KnowledgeGraph;
  relation: GraphRelation;
}
```

### 2. 获取关联图谱

**GET /api/graphs/:id/relations**

```typescript
// Response
{
  prerequisites: GraphRelation[];  // 前置图谱
  extensions: GraphRelation[];     // 扩展图谱
  related: GraphRelation[];        // 相关图谱
}
```

### 3. 批量创建前置知识图谱

**POST /api/graphs/:id/prerequisite-graphs/batch**

```typescript
// Request
{
  topics: Array<{
    topic: string;
    description?: string;
    masteryLevel: string;  // 用户选择的掌握程度
  }>;
}

// Response
{
  created: Array<{
    topic: string;
    graphId: string;
    graph: KnowledgeGraph;
  }>;
}
```

## 前端实现

### 1. LearningPathWizard 增强

在完成第 2 步（评估前置知识）后，显示"不了解"的知识点：

```
┌─────────────────────────────────────────────────────────────┐
│ 📋 前置知识评估结果                                          │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│ ⚠️ 以下知识你标注为"不了解"，建议先学习：                    │
│                                                             │
│ ☑ Python 编程基础                                           │
│ ☑ 数学基础（线性代数/概率统计）                             │
│ ☐ 数据处理与分析                                            │
│                                                             │
│ [为选中的知识创建学习图谱]                                   │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### 2. 新增组件：RelatedGraphsPanel

在图谱编辑器中显示关联图谱：

```
┌─────────────────────────────────────────────────────────────┐
│ 📁 关联图谱                                                  │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│ 前置知识 (2)                                                 │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ 📚 Python 编程基础                    [打开] [查看关系] │ │
│ │    12 节点 · 上次学习: 2天前                             │ │
│ └─────────────────────────────────────────────────────────┘ │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ 📚 数学基础                           [打开] [查看关系] │ │
│ │    8 节点 · 未开始学习                                   │ │
│ └─────────────────────────────────────────────────────────┘ │
│                                                             │
│ 扩展知识 (1)                                                 │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ 📚 深度学习入门                       [打开] [查看关系] │ │
│ │    15 节点 · 学习中                                      │ │
│ └─────────────────────────────────────────────────────────┘ │
│                                                             │
│ [+ 添加关联图谱]                                             │
└─────────────────────────────────────────────────────────────┘
```

### 3. 图谱切换器

在顶部导航栏添加快速切换功能：

```
┌─────────────────────────────────────────────────────────────┐
│ [机器学习基础 ▼]  ← 点击展开图谱切换器                       │
├─────────────────────────────────────────────────────────────┤
│ 当前图谱                                                     │
│ ● 机器学习基础 (15 节点)                                     │
│                                                             │
│ 前置图谱                                                     │
│ ○ Python 编程基础 (12 节点)                                 │
│ ○ 数学基础 (8 节点)                                         │
│                                                             │
│ 扩展图谱                                                     │
│ ○ 深度学习入门 (15 节点)                                    │
└─────────────────────────────────────────────────────────────┘
```

## 任务列表

### 第一阶段：数据库和基础 API

1. **创建数据库迁移文件**
   - 添加 `graph_relations` 表
   - 添加 `parent_graph_id` 字段

2. **创建后端 API**
   - `POST /graphs/:id/prerequisite-graph` - 创建单个前置图谱
   - `POST /graphs/:id/prerequisite-graphs/batch` - 批量创建
   - `GET /graphs/:id/relations` - 获取关联图谱

### 第二阶段：前端集成

3. **更新 LearningPathWizard**
   - 在第 2 步后显示"不了解"的知识点列表
   - 添加"创建前置知识图谱"功能
   - 调用 AutoGraph API 生成图谱

4. **创建 RelatedGraphsPanel 组件**
   - 显示前置/扩展/相关图谱
   - 支持快速切换
   - 显示学习进度

5. **更新图谱编辑器**
   - 集成 RelatedGraphsPanel
   - 添加图谱切换器

### 第三阶段：增强功能

6. **图谱网络视图**（可选）
   - 可视化图谱间的关系
   - 支持拖拽建立关联

## 文件变更

### 新增文件
- `supabase/migrations/20260215000003_add_graph_relations.sql`
- `api/routes/graphRelations.ts`
- `src/components/Graph/RelatedGraphsPanel.tsx`
- `src/components/Graph/GraphSwitcher.tsx`

### 修改文件
- `api/app.ts` - 注册新路由
- `src/components/LearningPath/LearningPathWizard.tsx` - 添加创建前置图谱功能
- `src/pages/GraphEditor.tsx` - 集成关联图谱面板
- `src/services/api.ts` - 添加新 API 调用

## 实现优先级

| 优先级 | 任务 | 预计工作量 |
|--------|------|-----------|
| P0 | 数据库迁移 | 小 |
| P0 | 创建前置图谱 API | 中 |
| P1 | LearningPathWizard 集成 | 中 |
| P1 | RelatedGraphsPanel 组件 | 中 |
| P2 | 图谱切换器 | 小 |
| P3 | 图谱网络视图 | 大 |
