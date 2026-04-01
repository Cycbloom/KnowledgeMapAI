# 图谱地图AI分析功能整合与优化规范

## Why

当前图谱地图存在三个分析模块（基础分析、智能分析、Agent深度分析），存在以下问题：
1. **功能重叠严重**：孤岛检测、关系推荐、学习路径建议在多个模块中重复实现
2. **用户体验混乱**：用户需要理解三个模块的区别，选择困难
3. **基础分析功能薄弱**：基于规则的分析无法提供深度洞察，且与AI分析功能重复
4. **Agent工具不足**：当前仅有6个工具，限制了分析能力和场景覆盖
5. **缺乏自主调用机制**：Agent无法根据分析需求智能选择工具组合

## What Changes

- **BREAKING**: 移除基础分析模块（MapAnalysisPanel）
- 将基础分析的合并建议功能整合至Agent分析
- 扩展Agent工具集，新增12个分析工具
- 实现Agent自主工具选择机制
- 优化智能分析模块，作为快速分析的入口
- 统一分析入口，提供分层分析体验

## Impact

- **Affected specs**: 
  - graph-map-ai-analysis-modularization（智能分析模块）
  - graph-map-intelligent-selection-agent-analysis（Agent分析系统）
- **Affected code**:
  - `src/components/GraphMap/MapAnalysisPanel.tsx` - 移除
  - `src/components/GraphMap/GraphMapToolbar.tsx` - 更新分析入口
  - `src/pages/GraphMap.tsx` - 移除基础分析状态
  - `api/services/agent/tools/` - 新增工具
  - `api/services/agent/AgentService.ts` - 增强自主调用
  - `src/components/GraphMap/AgentAnalysisPanel.tsx` - 整合合并建议

---

## ADDED Requirements

### Requirement: 统一分析入口架构

系统 SHALL 提供统一的分析入口，支持分层分析体验。

#### 分析层级设计

| 层级 | 名称 | 入口 | 特点 | 适用场景 |
|------|------|------|------|---------|
| L1 | 快速分析 | 智能分析面板 | 模块化、可选执行、快速响应 | 日常快速检查 |
| L2 | 深度分析 | Agent分析面板 | 自主工具调用、渐进式获取、深度洞察 | 深度研究分析 |
| L3 | 自定义分析 | Agent自定义 | 用户自定义Prompt、灵活工具组合 | 特定需求分析 |

#### Scenario: 用户选择分析模式
- **WHEN** 用户点击"AI分析"按钮
- **THEN** 显示分析模式选择面板
- **AND** 默认推荐"快速分析"模式
- **AND** 用户可选择"深度分析"或"自定义分析"

---

### Requirement: Agent工具集扩展

系统 SHALL 扩展Agent可调用的工具种类与数量，提升分析能力。

#### 新增工具列表

| 工具名称 | 功能描述 | 参数 |
|---------|---------|------|
| `get_domain_distribution` | 获取知识领域分布统计 | 无 |
| `analyze_graph_structure` | 分析图谱结构特征 | `graph_id` |
| `get_learning_paths` | 获取学习路径 | `start_graph_id?`, `end_graph_id?` |
| `get_similar_graphs` | 获取相似图谱 | `graph_id`, `threshold?` |
| `get_graph_tags` | 获取图谱标签 | `graph_id` |
| `get_node_relations` | 获取节点关系 | `node_id`, `depth?` |
| `get_knowledge_coverage` | 获取知识覆盖度 | `domain?` |
| `get_study_progress` | 获取学习进度 | `graph_ids?` |
| `analyze_difficulty` | 分析图谱难度 | `graph_id` |
| `get_prerequisite_chain` | 获取前置知识链 | `graph_id` |
| `get_extension_suggestions` | 获取扩展建议 | `graph_id` |
| `analyze_merge_candidates` | 分析合并候选图谱 | `similarity_threshold?` |

#### Scenario: Agent自主选择工具
- **WHEN** Agent需要分析用户的知识图谱
- **THEN** Agent根据分析目标自主决定调用哪些工具
- **AND** 工具调用顺序由Agent智能决定
- **AND** Agent可根据中间结果调整后续工具调用

---

### Requirement: Agent自主调用机制

系统 SHALL 实现Agent对工具的自主决策与调用能力。

#### 自主调用策略

```typescript
interface AutonomousCallStrategy {
  // 分析目标识别
  identifyGoal(userPrompt: string): AnalysisGoal;
  
  // 工具选择策略
  selectTools(goal: AnalysisGoal, context: AnalysisContext): Tool[];
  
  // 执行顺序优化
  optimizeExecutionOrder(tools: Tool[]): Tool[];
  
  // 动态调整策略
  adjustStrategy(intermediateResults: Result[]): Tool[];
}
```

#### Scenario: 智能工具选择
- **WHEN** 用户请求"分析我的知识体系完整性"
- **THEN** Agent识别目标为"知识完整性分析"
- **AND** 自主选择工具组合：
  1. `get_graph_overview` - 获取概览
  2. `get_domain_distribution` - 分析领域分布
  3. `get_isolated_graphs` - 检测孤岛
  4. `get_knowledge_coverage` - 计算覆盖度
  5. `analyze_merge_candidates` - 发现合并候选
- **AND** 根据中间结果动态调整后续调用

#### Scenario: 渐进式深度分析
- **WHEN** Agent发现某个图谱存在异常
- **THEN** Agent自主决定深入分析该图谱
- **AND** 调用 `get_graph_details` 获取详情
- **AND** 调用 `analyze_graph_structure` 分析结构
- **AND** 调用 `get_similar_graphs` 查找相似图谱

---

### Requirement: 合并建议功能整合

系统 SHALL 将基础分析的合并建议功能整合至Agent分析模块。

#### Scenario: 智能合并建议
- **WHEN** Agent执行知识完整性分析
- **THEN** 自动调用 `analyze_merge_candidates` 工具
- **AND** 返回相似度超过阈值的图谱对
- **AND** 提供合并理由和建议

#### 合并建议数据结构

```typescript
interface MergeSuggestion {
  graph_ids: string[];
  graph_titles: string[];
  similarity_score: number;
  reason: string;
  suggested_action: 'merge' | 'link' | 'keep_separate';
  shared_concepts: string[];
}
```

---

### Requirement: 智能分析模块优化

系统 SHALL 优化智能分析模块，作为快速分析的入口。

#### 优化内容

1. **简化模块选择**
   - 默认推荐常用模块组合
   - 提供"一键快速分析"选项
   - 支持保存用户偏好

2. **结果展示优化**
   - 整合多模块结果
   - 提供可执行的建议
   - 支持一键应用建议

3. **与Agent联动**
   - 快速分析结果可传递给Agent进行深度分析
   - Agent可基于快速分析结果优化工具选择

---

## MODIFIED Requirements

### Requirement: 分析入口更新

原有的三入口分析 SHALL 更新为统一入口。

**修改前**:
- 基础分析（MapAnalysisPanel）
- 智能分析（ModularAnalysisPanel）
- Agent深度分析（AgentAnalysisPanel）

**修改后**:
- 快速分析（ModularAnalysisPanel优化版）
- 深度分析（AgentAnalysisPanel增强版）
- 自定义分析（Agent自定义Prompt）

---

## REMOVED Requirements

### Requirement: 基础分析模块

**Reason**: 功能与智能分析和Agent分析高度重叠，且基于规则的分析能力有限

**Migration**: 
- 孤岛图谱检测 → Agent的 `island_detection` Skill
- 前置知识建议 → Agent的 `get_prerequisite_chain` 工具
- 学习路径建议 → Agent的 `learning_path` Skill
- 合并建议 → 新增 `analyze_merge_candidates` 工具

---

## 技术实现要点

### 新增工具实现示例

```typescript
// api/services/agent/tools/analysisTools.ts

export const analyzeMergeCandidatesTool: AgentTool = {
  name: 'analyze_merge_candidates',
  description: '分析可能需要合并的相似图谱，基于标题、描述、标签和知识点的相似度',
  parameters: {
    type: 'object',
    properties: {
      similarity_threshold: {
        type: 'number',
        description: '相似度阈值，默认0.7',
      },
      max_candidates: {
        type: 'number',
        description: '最大候选数量，默认10',
      },
    },
  },
  execute: async (params, context) => {
    const { supabase, userId } = context;
    const threshold = (params.similarity_threshold as number) || 0.7;
    
    // 1. 获取所有图谱
    const { data: graphs } = await supabase
      .from('knowledge_graphs')
      .select('id, title, description')
      .eq('user_id', userId);
    
    // 2. 计算相似度矩阵
    const candidates: MergeSuggestion[] = [];
    
    for (let i = 0; i < graphs.length; i++) {
      for (let j = i + 1; j < graphs.length; j++) {
        const similarity = calculateSimilarity(graphs[i], graphs[j]);
        if (similarity >= threshold) {
          candidates.push({
            graph_ids: [graphs[i].id, graphs[j].id],
            graph_titles: [graphs[i].title, graphs[j].title],
            similarity_score: similarity,
            reason: `标题和描述相似度: ${(similarity * 100).toFixed(1)}%`,
            suggested_action: similarity > 0.9 ? 'merge' : 'link',
            shared_concepts: [],
          });
        }
      }
    }
    
    return {
      merge_candidates: candidates
        .sort((a, b) => b.similarity_score - a.similarity_score)
        .slice(0, (params.max_candidates as number) || 10),
      total_candidates: candidates.length,
    };
  },
};

export const getDomainDistributionTool: AgentTool = {
  name: 'get_domain_distribution',
  description: '获取用户知识图谱的领域分布统计',
  parameters: {
    type: 'object',
    properties: {},
  },
  execute: async (_params, context) => {
    const { supabase, userId } = context;
    
    const { data: graphs } = await supabase
      .from('knowledge_graphs')
      .select('domain')
      .eq('user_id', userId);
    
    const distribution: Record<string, number> = {};
    graphs?.forEach(g => {
      const domain = g.domain || '未分类';
      distribution[domain] = (distribution[domain] || 0) + 1;
    });
    
    return {
      distribution,
      total_domains: Object.keys(distribution).length,
      total_graphs: graphs?.length || 0,
    };
  },
};

export const getKnowledgeCoverageTool: AgentTool = {
  name: 'get_knowledge_coverage',
  description: '分析用户知识体系的覆盖度',
  parameters: {
    type: 'object',
    properties: {
      domain: {
        type: 'string',
        description: '指定领域，为空则分析全部',
      },
    },
  },
  execute: async (params, context) => {
    const { supabase, userId } = context;
    const domain = params.domain as string | undefined;
    
    let query = supabase
      .from('knowledge_graphs')
      .select('id, title, domain')
      .eq('user_id', userId);
    
    if (domain) {
      query = query.eq('domain', domain);
    }
    
    const { data: graphs } = await query;
    
    // 分析覆盖度
    const graphIds = graphs?.map(g => g.id) || [];
    
    const { count: totalNodes } = await supabase
      .from('graph_nodes')
      .select('id', { count: 'exact', head: true })
      .in('graph_id', graphIds);
    
    const { data: relations } = await supabase
      .from('graph_relations')
      .select('id')
      .or(`source_graph_id.in.(${graphIds.join(',')}),target_graph_id.in.(${graphIds.join(',')})`);
    
    const connectedGraphs = new Set<string>();
    relations?.forEach(r => {
      connectedGraphs.add(r.source_graph_id);
      connectedGraphs.add(r.target_graph_id);
    });
    
    const coverage = {
      total_graphs: graphs?.length || 0,
      total_nodes: totalNodes || 0,
      connected_graphs: connectedGraphs.size,
      isolated_graphs: (graphs?.length || 0) - connectedGraphs.size,
      connectivity_rate: graphs?.length 
        ? (connectedGraphs.size / graphs.length * 100).toFixed(1) 
        : '0',
    };
    
    return coverage;
  },
};
```

### Agent自主调用增强

```typescript
// api/services/agent/AgentService.ts 增强版

export class EnhancedAgentService extends AgentService {
  
  // 工具选择策略映射
  private toolSelectionStrategies: Map<AnalysisGoal, ToolSelectionStrategy> = new Map([
    ['knowledge_completeness', {
      primaryTools: ['get_graph_overview', 'get_domain_distribution', 'get_isolated_graphs'],
      secondaryTools: ['get_knowledge_coverage', 'analyze_merge_candidates'],
      depthTools: ['get_graph_details', 'analyze_graph_structure'],
    }],
    ['relation_discovery', {
      primaryTools: ['get_graph_overview', 'get_graph_relations'],
      secondaryTools: ['get_similar_graphs', 'search_graphs'],
      depthTools: ['get_graph_details', 'get_node_relations'],
    }],
    ['learning_optimization', {
      primaryTools: ['get_graph_overview', 'get_learning_paths'],
      secondaryTools: ['get_study_progress', 'analyze_difficulty'],
      depthTools: ['get_prerequisite_chain', 'get_extension_suggestions'],
    }],
  ]);
  
  async executeWithAutonomy(
    sessionId: string, 
    userId: string, 
    goal: AnalysisGoal
  ): Promise<ExecuteResult> {
    const strategy = this.toolSelectionStrategies.get(goal);
    if (!strategy) {
      return this.executeSession(sessionId, userId);
    }
    
    // 1. 执行主要工具
    const primaryResults = await this.executeToolSet(
      sessionId, 
      strategy.primaryTools,
      userId
    );
    
    // 2. 分析结果，决定是否需要次要工具
    if (this.needsSecondaryAnalysis(primaryResults)) {
      await this.executeToolSet(
        sessionId,
        strategy.secondaryTools,
        userId
      );
    }
    
    // 3. 根据中间结果决定深度分析
    const depthTargets = this.identifyDepthTargets(primaryResults);
    for (const target of depthTargets) {
      await this.executeDepthAnalysis(sessionId, target, strategy.depthTools, userId);
    }
    
    return this.finalizeSession(sessionId);
  }
  
  private needsSecondaryAnalysis(results: ToolResult[]): boolean {
    // 基于结果判断是否需要更深入分析
    return results.some(r => 
      r.data?.totalIsolated > 3 || 
      r.data?.anomalies?.length > 0
    );
  }
  
  private identifyDepthTargets(results: ToolResult[]): string[] {
    // 识别需要深入分析的目标
    const targets: string[] = [];
    results.forEach(r => {
      if (r.data?.isolatedGraphs) {
        targets.push(...r.data.isolatedGraphs.slice(0, 3).map((g: { id: string }) => g.id));
      }
    });
    return targets;
  }
}
```

### 前端分析入口优化

```tsx
// src/components/GraphMap/GraphMapToolbar.tsx 更新

interface AnalysisMode {
  id: string;
  name: string;
  description: string;
  icon: React.ReactNode;
  color: string;
}

const analysisModes: AnalysisMode[] = [
  {
    id: 'quick',
    name: '快速分析',
    description: '模块化分析，快速获取洞察',
    icon: <Brain className="w-4 h-4" />,
    color: 'indigo',
  },
  {
    id: 'deep',
    name: '深度分析',
    description: 'Agent自主分析，深度挖掘',
    icon: <Bot className="w-4 h-4" />,
    color: 'emerald',
  },
  {
    id: 'custom',
    name: '自定义分析',
    description: '自定义Prompt，灵活分析',
    icon: <Sparkles className="w-4 h-4" />,
    color: 'purple',
  },
];

// 分析模式选择面板
const AnalysisModeSelector: React.FC<{
  onSelect: (mode: string) => void;
}> = ({ onSelect }) => (
  <div className="space-y-2">
    {analysisModes.map(mode => (
      <button
        key={mode.id}
        onClick={() => onSelect(mode.id)}
        className={`w-full flex items-start gap-3 p-3 rounded-lg hover:bg-${mode.color}-50 transition-all`}
      >
        <div className={`w-8 h-8 rounded-lg bg-${mode.color}-100 flex items-center justify-center`}>
          {mode.icon}
        </div>
        <div className="text-left">
          <div className="font-semibold">{mode.name}</div>
          <div className="text-xs text-gray-500">{mode.description}</div>
        </div>
      </button>
    ))}
  </div>
);
```

---

## 迁移计划

### Phase 1: 工具扩展（第1周）
- 实现新增的12个Agent工具
- 更新ToolRegistry
- 添加工具测试

### Phase 2: 自主调用机制（第2周）
- 实现工具选择策略
- 实现动态调整逻辑
- 增强AgentService

### Phase 3: 模块整合（第3周）
- 移除MapAnalysisPanel
- 整合合并建议功能
- 更新GraphMapToolbar
- 更新GraphMap页面状态

### Phase 4: 测试与优化（第4周）
- 端到端测试
- 性能优化
- 用户验收测试

---

## 预期效果

| 指标 | 优化前 | 优化后 | 提升 |
|-----|-------|-------|-----|
| 分析模块数量 | 3个 | 2个（快速+深度） | 简化33% |
| Agent工具数量 | 6个 | 18个 | 增加200% |
| 功能重叠度 | 高 | 无 | 完全消除 |
| 用户选择复杂度 | 3选1 | 分层引导 | 显著降低 |
| 分析深度 | 固定 | 自适应 | 显著提升 |
