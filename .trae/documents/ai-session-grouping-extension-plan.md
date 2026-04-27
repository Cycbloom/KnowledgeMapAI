# AI 服务会话分组扩展方案

## 调研结果

### 已实现 sessionId 分组的功能

| 功能模块 | 操作 | 状态 |
|---------|------|------|
| 图谱自动生成 | `auto_graph_init`, `auto_graph_expand` | ✅ 已实现 |
| 递归图谱生成 | `recursive_graph_init`, `recursive_graph_expand_depth2/3` | ✅ 已实现 |
| 图谱节点生成 | `generate_nodes_for_graph`, `expand_node_for_graph` | ✅ 已实现 |

### 需要添加 sessionId 分组的功能

#### 1. 关系发现服务 (`relationDiscoveryService.ts`)

**场景**：用户在"图谱关系分析"功能中，可能会连续调用多个分析操作

| 操作 | 说明 | 分组建议 |
|------|------|---------|
| `discover_relations` | 发现图谱关系 | 核心操作 |
| `get_intelligent_suggestions` | 获取智能建议 | 内部调用 discover_relations，需要传递 sessionId |
| `analyze_cross_domain_insights` | 分析跨域洞察 | 独立操作，可选分组 |
| `generate_learning_path_suggestions` | 生成学习路径建议 | 独立操作，可选分组 |
| `analyze_knowledge_gaps` | 分析知识缺口 | 独立操作，可选分组 |

**建议**：在 `getIntelligentSuggestions` 方法中，两次 AI 调用共享 sessionId

#### 2. 聊天服务 (`chat.ts`)

**场景**：用户与 AI 进行多轮对话，每次对话应该属于同一个会话

| 操作 | 说明 |
|------|------|
| `chat` | 普通聊天 |
| `tutor_chat` | 导师聊天 |

**建议**：每次对话生成 sessionId，前端保存并传递

#### 3. 内容生成服务 (`content.ts`)

**场景**：用户可能连续生成多个相关内容

| 操作 | 说明 |
|------|------|
| `generate_content` | 生成内容 |
| `generate_content_stream` | 流式生成内容 |

**建议**：可选分组，如果用户连续生成相关内容

#### 4. 文档转图谱 (`document.ts`)

**场景**：文档转图谱可能涉及多个步骤

| 操作 | 说明 |
|------|------|
| `text_to_graph` | 文本转图谱 |
| `document_to_graph` | 文档转图谱 |
| `image_to_graph` | 图片转图谱 |

**建议**：每个转换操作是独立的，通常不需要分组

#### 5. 模板生成 (`templateGeneratorService.ts`)

**场景**：模板生成是单次操作

| 操作 | 说明 |
|------|------|
| `template_generation` | 模板生成 |

**建议**：单次操作，不需要分组

#### 6. AI 动作服务 (`aiActionService.ts`)

**场景**：用户可能连续执行多个 AI 动作

| 操作 | 说明 |
|------|------|
| `ai_action_execute` | 执行 AI 动作 |

**建议**：可选分组，如果用户连续执行相关动作

## 实现优先级

### 高优先级（推荐实现）

1. **关系发现服务** - `getIntelligentSuggestions` 内部有两次 AI 调用，应该共享 sessionId
2. **聊天服务** - 多轮对话应该属于同一会话

### 中优先级（可选实现）

3. **内容生成服务** - 连续生成相关内容时分组
4. **AI 动作服务** - 连续执行相关动作时分组

### 低优先级（暂不实现）

5. **文档转图谱** - 独立操作
6. **模板生成** - 单次操作

## 实现步骤

### 步骤 1：关系发现服务

修改 `api/services/graph/relationDiscoveryService.ts`：

1. `discoverRelations` 方法添加 `sessionId` 参数
2. `getIntelligentSuggestions` 方法：
   - 生成 sessionId
   - 传递给 `discoverRelations`
   - 传递给第二次 AI 调用
3. 其他方法添加可选 `sessionId` 参数

### 步骤 2：聊天服务

修改 `api/routes/ai/chat.ts`：

1. 路由接收可选 `session_id` 参数
2. 如果没有提供，生成新的 sessionId
3. 返回 sessionId 给前端

修改前端聊天组件：

1. 保存 sessionId
2. 后续对话传递 sessionId

### 步骤 3：更新前端会话名称映射

修改 `src/components/Console/PerformanceTab.tsx` 中的 `getSessionName` 函数：

```typescript
const getSessionName = (logs: AIPerformanceLog[], getOperationLabel: (operation: string) => string): string => {
  const operations = new Set(logs.map((l) => l.operation));
  
  if (operations.has('auto_graph_init') || operations.has('auto_graph_expand')) {
    return '图谱自动生成';
  }
  if (operations.has('recursive_graph_init') || operations.has('recursive_graph_expand_depth2') || operations.has('recursive_graph_expand_depth3')) {
    return '递归图谱生成';
  }
  if (operations.has('generate_nodes_for_graph') || operations.has('expand_node_for_graph')) {
    return '图谱节点生成';
  }
  // 新增
  if (operations.has('discover_relations') || operations.has('get_intelligent_suggestions')) {
    return '图谱关系分析';
  }
  if (operations.has('chat') || operations.has('tutor_chat')) {
    return 'AI 对话';
  }
  if (operations.has('generate_content') || operations.has('generate_content_stream')) {
    return '内容生成';
  }
  if (operations.has('ai_action_execute')) {
    return 'AI 动作执行';
  }
  
  const firstLog = logs.sort((a, b) => a.timestamp - b.timestamp)[0];
  return getOperationLabel(firstLog.operation);
};
```

## 文件清单

需要修改的文件：

1. `api/services/graph/relationDiscoveryService.ts` - 关系发现服务
2. `api/routes/ai/chat.ts` - 聊天路由
3. `src/components/Console/PerformanceTab.tsx` - 会话名称映射
4. 前端聊天组件（待确认具体文件）

## 预期效果

1. 关系发现服务的多次 AI 调用会显示在同一会话下
2. 多轮聊天对话会显示在同一会话下
3. 监控面板会显示更有意义的会话名称
