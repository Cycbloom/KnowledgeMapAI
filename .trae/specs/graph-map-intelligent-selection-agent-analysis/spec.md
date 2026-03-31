# 图谱地图智能选择与AI Agent分析系统规范

## Why

当前图谱地图面临两大核心问题：
1. **数据展示问题**：随着图谱规模扩大，一次性展示全部信息导致界面拥挤和性能问题
2. **AI分析效率问题**：现有AI分析一次性传递全部图谱数据，导致Token消耗大、响应慢、分析深度不足

通过引入**渐进式披露（Progressive Disclosure）**的Agent架构，让AI按需调用工具获取信息，实现更智能、更高效的分析。

## What Changes

- 实现图谱智能选择功能（单选/多选/组选）
- 构建AI Agent工具系统，支持渐进式数据获取
- 新增AI分析Skills供Agent调用
- 优化图谱关系管理功能
- 扩展AI分析维度和能力

## Impact

- **Affected specs**: 图谱地图、AI分析功能
- **Affected code**:
  - `src/pages/GraphMap.tsx` - 智能选择状态管理
  - `src/components/GraphMap/GraphMapCanvas.tsx` - 选择交互
  - `api/services/agent/` - 新增Agent服务
  - `api/routes/agent.ts` - 新增Agent API路由
  - `src/services/api/agent.ts` - 前端Agent API

---

## ADDED Requirements

### Requirement: 图谱智能选择功能

系统 SHALL 提供智能的图谱选择功能，支持多种选择模式。

#### 选择模式

| 模式 | 操作方式 | 用途 |
|------|---------|------|
| 单选 | 左键点击图谱 | 查看详情、执行操作 |
| 多选 | Ctrl/Cmd + 左键点击 | 选择多个图谱进行批量操作 |
| 框选 | 左键拖拽绘制选择框 | 批量选择区域内的图谱 |
| 组选 | Shift + 左键点击 | 选择两个图谱之间的所有图谱 |
| 关联选 | 右键菜单"选择关联图谱" | 选择与当前图谱有关系的所有图谱 |

#### Scenario: 多选图谱
- **WHEN** 用户按住Ctrl/Cmd键点击多个图谱
- **THEN** 系统高亮显示所有选中的图谱
- **AND** 显示批量操作面板
- **AND** 支持批量创建关系、批量分析、批量删除

#### Scenario: 框选图谱
- **WHEN** 用户在画布上拖拽绘制选择框
- **THEN** 系统选中框内的所有图谱
- **AND** 显示选中数量和批量操作选项

---

### Requirement: AI Agent工具系统

系统 SHALL 提供Agent工具系统，支持AI渐进式获取图谱信息。

#### 工具定义

```typescript
interface AgentTool {
  name: string;           // 工具名称
  description: string;    // 工具描述（供AI理解）
  parameters: JSONSchema; // 参数定义
  execute: Function;      // 执行函数
}
```

#### 可用工具列表

| 工具名称 | 功能 | 参数 |
|---------|------|------|
| `get_graph_overview` | 获取图谱概览列表 | `limit`, `domain`, `sort_by` |
| `get_graph_details` | 获取图谱详细信息 | `graph_id` |
| `get_graph_nodes` | 获取图谱知识点 | `graph_id`, `level`, `limit` |
| `get_graph_relations` | 获取图谱关系 | `graph_id`, `relation_type` |
| `search_graphs` | 搜索图谱 | `query`, `filters` |
| `get_isolated_graphs` | 获取孤岛图谱 | `min_nodes`, `domain` |
| `get_domain_distribution` | 获取领域分布 | 无 |
| `analyze_graph_structure` | 分析图谱结构 | `graph_id` |
| `get_learning_paths` | 获取学习路径 | `start_graph_id`, `end_graph_id` |

#### Scenario: AI渐进式分析
- **WHEN** 用户请求AI分析
- **THEN** AI首先调用 `get_graph_overview` 获取概览
- **AND** 根据概览决定需要深入分析的图谱
- **AND** 调用 `get_graph_details` 获取特定图谱详情
- **AND** 根据需要调用其他工具获取更多信息
- **AND** 最终生成分析报告

---

### Requirement: Agent分析会话

系统 SHALL 支持Agent分析会话，记录AI的工具调用过程。

#### Scenario: 创建分析会话
- **WHEN** 用户启动Agent分析
- **THEN** 系统创建新的分析会话
- **AND** 显示会话面板，实时展示AI的思考和工具调用
- **AND** 用户可查看AI获取的每一步数据

#### 会话状态

```typescript
interface AgentSession {
  id: string;
  status: 'running' | 'completed' | 'failed';
  messages: AgentMessage[];
  tool_calls: ToolCall[];
  result: AnalysisResult;
  created_at: string;
  updated_at: string;
}

interface AgentMessage {
  role: 'assistant' | 'tool' | 'system';
  content: string;
  tool_name?: string;
  tool_args?: object;
  tool_result?: object;
}
```

---

### Requirement: AI分析Skills

系统 SHALL 提供预定义的分析Skills，用户可选择执行。

#### Skills列表

| Skill名称 | 描述 | 使用工具 |
|----------|------|---------|
| `知识孤岛检测` | 发现没有关联的图谱 | `get_graph_overview`, `get_graph_relations`, `get_isolated_graphs` |
| `学习路径规划` | 规划最优学习顺序 | `get_graph_overview`, `get_graph_relations`, `get_learning_paths` |
| `跨领域发现` | 发现跨学科知识交叉 | `get_domain_distribution`, `get_graph_details`, `search_graphs` |
| `知识缺口分析` | 识别知识体系空白 | `get_graph_overview`, `get_graph_nodes`, `analyze_graph_structure` |
| `关系推荐` | 推荐潜在的图谱关系 | `get_graph_details`, `get_graph_nodes`, `search_graphs` |
| `自定义分析` | 用户自定义分析任务 | 所有工具 |

#### Scenario: 执行预定义Skill
- **WHEN** 用户选择一个Skill执行
- **THEN** 系统使用预设的Prompt和工具配置启动Agent
- **AND** Agent自动调用所需工具完成分析
- **AND** 展示分析过程和结果

---

### Requirement: 选中图谱关系管理

系统 SHALL 提供选中图谱之间的关系管理功能。

#### Scenario: 批量创建关系
- **WHEN** 用户选中多个图谱
- **THEN** 显示"批量创建关系"选项
- **AND** 用户可设置源图谱组和目标图谱组
- **AND** 用户可选择关系类型
- **AND** 系统批量创建关系

#### Scenario: 分析选中图谱关系
- **WHEN** 用户选中多个图谱并选择"分析关系"
- **THEN** Agent分析选中图谱之间的现有关系
- **AND** 推荐可能的新关系
- **AND** 识别关系缺口

---

### Requirement: 组内图谱关联分析

系统 SHALL 支持组内图谱元素间的关联分析。

#### Scenario: 分析组内知识点关联
- **WHEN** 用户选中一组图谱并选择"组内分析"
- **THEN** Agent获取组内所有图谱的知识点
- **AND** 分析知识点之间的语义关联
- **AND** 推荐跨图谱的知识点关系
- **AND** 生成组内知识网络图

---

## MODIFIED Requirements

### Requirement: AI分析入口更新

原有的AI分析入口 SHALL 更新为支持Agent模式。

**修改前**:
- 直接执行分析，一次性传递全部数据
- 用户等待结果

**修改后**:
- 选择分析模式：快速分析 / Agent深度分析
- Agent模式显示实时进度和工具调用
- 支持用户干预和引导

---

## 技术实现要点

### Agent服务架构

```
┌─────────────────────────────────────────────────────────────┐
│                      Frontend                                │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐  │
│  │ GraphMap    │  │ AgentPanel  │  │ SkillSelector       │  │
│  │ (Selection) │  │ (Session)   │  │ (Predefined Skills) │  │
│  └─────────────┘  └─────────────┘  └─────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                      Backend API                             │
│  ┌─────────────────────────────────────────────────────────┐│
│  │                    /api/agent                            ││
│  │  POST /sessions      - 创建分析会话                      ││
│  │  POST /sessions/:id/execute - 执行分析步骤               ││
│  │  GET  /sessions/:id  - 获取会话状态                      ││
│  │  POST /sessions/:id/interrupt - 用户干预                 ││
│  └─────────────────────────────────────────────────────────┘│
│                              │                               │
│  ┌─────────────────────────────────────────────────────────┐│
│  │                   AgentService                           ││
│  │  - 管理会话生命周期                                       ││
│  │  - 调用AI Provider                                        ││
│  │  - 执行工具函数                                           ││
│  │  - 流式返回结果                                           ││
│  └─────────────────────────────────────────────────────────┘│
│                              │                               │
│  ┌─────────────────────────────────────────────────────────┐│
│  │                    ToolRegistry                          ││
│  │  - 注册可用工具                                           ││
│  │  - 验证工具参数                                           ││
│  │  - 执行工具逻辑                                           ││
│  └─────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────┘
```

### 工具实现示例

```typescript
// api/services/agent/tools/graphTools.ts

export const graphTools: AgentTool[] = [
  {
    name: 'get_graph_overview',
    description: '获取用户的图谱概览列表，包含标题、描述、节点数、关系数等基本信息',
    parameters: {
      type: 'object',
      properties: {
        limit: { type: 'number', description: '返回数量限制，默认20' },
        domain: { type: 'string', description: '按领域筛选' },
        sort_by: { type: 'string', enum: ['created_at', 'node_count', 'relation_count'] }
      }
    },
    execute: async (params, context) => {
      const { limit = 20, domain, sort_by = 'created_at' } = params;
      const graphs = await context.supabase
        .from('graphs')
        .select('id, title, description, domain, created_at')
        .eq('user_id', context.userId)
        .limit(limit);
      return graphs;
    }
  },
  
  {
    name: 'get_graph_details',
    description: '获取指定图谱的详细信息，包括完整描述、标签、统计信息',
    parameters: {
      type: 'object',
      properties: {
        graph_id: { type: 'string', description: '图谱ID' }
      },
      required: ['graph_id']
    },
    execute: async (params, context) => {
      const graph = await context.supabase
        .from('graphs')
        .select('*')
        .eq('id', params.graph_id)
        .single();
      return graph;
    }
  },
  
  {
    name: 'get_graph_nodes',
    description: '获取图谱的知识点列表',
    parameters: {
      type: 'object',
      properties: {
        graph_id: { type: 'string' },
        level: { type: 'string', enum: ['root', 'core', 'sub', 'all'] },
        limit: { type: 'number' }
      },
      required: ['graph_id']
    },
    execute: async (params, context) => {
      let query = context.supabase
        .from('nodes')
        .select('id, title, content, level')
        .eq('graph_id', params.graph_id);
      
      if (params.level && params.level !== 'all') {
        query = query.eq('level', params.level);
      }
      if (params.limit) {
        query = query.limit(params.limit);
      }
      
      return await query;
    }
  }
];
```

### Agent执行流程

```typescript
// api/services/agent/AgentService.ts

export class AgentService {
  async executeSession(sessionId: string, initialPrompt: string) {
    const session = await this.getSession(sessionId);
    const messages: Message[] = [
      { role: 'system', content: this.getSystemPrompt() },
      { role: 'user', content: initialPrompt }
    ];
    
    while (session.status === 'running') {
      // 1. 调用AI获取下一步行动
      const response = await this.aiProvider.chat({
        messages,
        tools: this.tools,
        tool_choice: 'auto'
      });
      
      // 2. 如果AI返回工具调用
      if (response.tool_calls) {
        for (const toolCall of response.tool_calls) {
          // 3. 执行工具
          const result = await this.executeTool(
            toolCall.name, 
            toolCall.arguments
          );
          
          // 4. 将结果返回给AI
          messages.push({
            role: 'tool',
            name: toolCall.name,
            content: JSON.stringify(result)
          });
          
          // 5. 流式通知前端
          await this.notifyFrontend(sessionId, {
            type: 'tool_call',
            tool: toolCall.name,
            args: toolCall.arguments,
            result
          });
        }
      }
      
      // 6. 如果AI返回最终答案
      if (response.content && !response.tool_calls?.length) {
        session.status = 'completed';
        session.result = response.content;
        break;
      }
    }
    
    return session;
  }
}
```

### 前端Agent面板

```tsx
// src/components/GraphMap/AgentAnalysisPanel.tsx

export const AgentAnalysisPanel: React.FC<Props> = ({ isOpen, onClose }) => {
  const [session, setSession] = useState<AgentSession | null>(null);
  const [messages, setMessages] = useState<AgentMessage[]>([]);
  
  const startAnalysis = async (skillId: string, selectedGraphIds?: string[]) => {
    const response = await api.agent.createSession({
      skill_id: skillId,
      graph_ids: selectedGraphIds,
      context: { selection_mode: 'multi' }
    });
    
    setSession(response.session);
    
    // SSE流式接收更新
    const eventSource = new EventSource(`/api/agent/sessions/${response.session.id}/stream`);
    eventSource.onmessage = (event) => {
      const update = JSON.parse(event.data);
      if (update.type === 'tool_call') {
        setMessages(prev => [...prev, {
          role: 'tool',
          content: `调用工具: ${update.tool}`,
          tool_name: update.tool,
          tool_result: update.result
        }]);
      }
    };
  };
  
  return (
    <div className="agent-panel">
      <div className="skill-selector">
        {SKILLS.map(skill => (
          <SkillCard key={skill.id} skill={skill} onSelect={() => startAnalysis(skill.id)} />
        ))}
      </div>
      
      <div className="session-log">
        {messages.map((msg, i) => (
          <MessageCard key={i} message={msg} />
        ))}
      </div>
      
      <div className="result-panel">
        {session?.result && <AnalysisResult result={session.result} />}
      </div>
    </div>
  );
};
```
