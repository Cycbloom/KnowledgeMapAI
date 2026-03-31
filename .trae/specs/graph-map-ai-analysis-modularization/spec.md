# 图谱地图AI智能分析模块化拆分规范

## Why

当前图谱地图的AI智能分析功能采用集中式设计，一次性执行所有分析任务（关系发现、跨学科洞察、学习建议），导致生成时间过长（可能需要30-60秒），用户体验较差。用户无法选择性触发特定分析功能，必须等待全部分析完成才能看到结果。

## What Changes

- 将现有的集中式AI分析功能拆解为4个独立的子功能模块
- 每个子功能模块可独立触发、独立执行、独立展示结果
- 实现用户可选择性触发不同AI分析子功能
- 优化前端交互，支持渐进式结果展示
- 保持数据交互顺畅，分析结果有效整合

## Impact

- **Affected specs**: 图谱地图分析功能
- **Affected code**:
  - `src/components/GraphMap/GraphRelationDiscoveryPanel.tsx` - 重构为模块化面板
  - `src/components/GraphMap/GraphMapToolbar.tsx` - 更新分析入口
  - `src/pages/GraphMap.tsx` - 更新状态管理
  - `api/services/graph/relationDiscoveryService.ts` - 拆分为独立服务方法
  - `api/routes/graphs.ts` - 新增独立API端点
  - `src/services/api/graphs.ts` - 新增前端API调用

---

## ADDED Requirements

### Requirement: 模块化AI分析架构

系统 SHALL 提供模块化的AI分析功能，支持用户选择性触发不同的分析子功能。

#### 子功能模块划分

| 模块名称 | 功能描述 | 预计耗时 | 独立API |
|---------|---------|---------|---------|
| 关系发现 | 发现图谱间潜在的关联关系 | 5-10秒 | `/graphs/discover-relations` |
| 跨学科洞察 | 分析跨领域知识交叉点 | 5-8秒 | `/graphs/cross-domain-insights` |
| 学习路径建议 | 推荐最优学习顺序 | 3-5秒 | `/graphs/learning-path-suggestions` |
| 知识缺口分析 | 识别知识体系中的空白 | 3-5秒 | `/graphs/knowledge-gaps` |

#### Scenario: 用户选择性触发分析
- **WHEN** 用户点击"智能分析"按钮
- **THEN** 系统显示分析模块选择面板，列出所有可用的分析子功能
- **AND** 用户可勾选需要执行的分析模块（默认全选）
- **AND** 用户点击"开始分析"后，系统仅执行选中的模块

#### Scenario: 渐进式结果展示
- **WHEN** 某个分析模块执行完成
- **THEN** 系统立即展示该模块的分析结果
- **AND** 其他仍在执行中的模块显示加载状态
- **AND** 用户可随时查看已完成模块的结果

---

### Requirement: 关系发现模块

系统 SHALL 提供独立的图谱关系发现功能。

#### Scenario: 发现潜在关系
- **WHEN** 用户触发"关系发现"分析
- **THEN** 系统分析用户所有图谱（或指定图谱）
- **AND** 返回发现的潜在关系列表，包含：
  - 源图谱和目标图谱信息
  - 关系类型（前置知识/扩展知识/相关知识/跨学科）
  - 置信度分数
  - 关系原因说明
  - 共享概念列表

#### 接口设计

**请求**:
```typescript
POST /graphs/discover-relations
{
  graph_ids?: string[],      // 可选，指定分析的图谱ID
  max_suggestions?: number,  // 最大建议数，默认20
  relation_types?: ('prerequisite' | 'extension' | 'related' | 'cross_domain')[]  // 可选，筛选关系类型
}
```

**响应**:
```typescript
{
  discovered_relations: DiscoveredRelation[],
  analysis_summary: {
    total_graphs_analyzed: number,
    relations_discovered: number,
    isolated_graphs: string[]
  }
}
```

---

### Requirement: 跨学科洞察模块

系统 SHALL 提供独立的跨学科洞察分析功能。

#### Scenario: 分析跨学科交叉
- **WHEN** 用户触发"跨学科洞察"分析
- **THEN** 系统分析图谱的领域分布
- **AND** 返回跨学科洞察列表，包含：
  - 交叉领域名称
  - 交叉主题列表
  - 洞察描述
  - 相关图谱ID列表

#### 接口设计

**请求**:
```typescript
POST /graphs/cross-domain-insights
{
  graph_ids?: string[],
  min_intersection?: number  // 最小交叉主题数，默认2
}
```

**响应**:
```typescript
{
  cross_domain_insights: CrossDomainInsight[],
  domain_distribution: Record<string, number>,
  analysis_summary: {
    total_domains: number,
    cross_domain_clusters: number
  }
}
```

---

### Requirement: 学习路径建议模块

系统 SHALL 提供独立的学习路径建议功能。

#### Scenario: 生成学习路径
- **WHEN** 用户触发"学习路径建议"分析
- **THEN** 系统基于现有图谱关系生成学习路径建议
- **AND** 返回学习路径列表，包含：
  - 路径描述
  - 预计学习时间
  - 难度等级
  - 包含的图谱序列

#### 接口设计

**请求**:
```typescript
POST /graphs/learning-path-suggestions
{
  graph_ids?: string[],
  difficulty?: 'beginner' | 'intermediate' | 'advanced'  // 目标难度
}
```

**响应**:
```typescript
{
  learning_path_suggestions: Array<{
    path: string[],
    path_titles: string[],
    description: string,
    estimated_time: string,
    difficulty: 'beginner' | 'intermediate' | 'advanced'
  }>,
  analysis_summary: {
    total_paths: number,
    avg_path_length: number
  }
}
```

---

### Requirement: 知识缺口分析模块

系统 SHALL 提供独立的知识缺口分析功能。

#### Scenario: 识别知识缺口
- **WHEN** 用户触发"知识缺口分析"
- **THEN** 系统分析用户知识体系的完整性
- **AND** 返回知识缺口列表，包含：
  - 缺失主题名称
  - 相关图谱列表
  - 重要程度
  - 建议操作（创建新图谱/合并/扩展）

#### 接口设计

**请求**:
```typescript
POST /graphs/knowledge-gaps
{
  graph_ids?: string[],
  min_importance?: 'high' | 'medium' | 'low'  // 最小重要程度
}
```

**响应**:
```typescript
{
  knowledge_gaps: Array<{
    missing_topic: string,
    related_graphs: string[],
    related_graph_titles: string[],
    importance: 'high' | 'medium' | 'low',
    suggested_action: 'create' | 'merge' | 'expand',
    reason: string
  }>,
  analysis_summary: {
    total_gaps: number,
    high_priority_count: number
  }
}
```

---

### Requirement: 模块化前端面板

系统 SHALL 提供模块化的分析面板，支持选择性执行和渐进式结果展示。

#### Scenario: 模块选择界面
- **WHEN** 用户打开智能分析面板
- **THEN** 显示4个可选的分析模块卡片
- **AND** 每个卡片显示模块名称、描述、预计耗时
- **AND** 用户可勾选/取消勾选各模块
- **AND** 显示"开始分析"按钮

#### Scenario: 执行状态展示
- **WHEN** 分析任务执行中
- **THEN** 每个模块显示独立的状态（等待中/执行中/已完成/失败）
- **AND** 已完成的模块可立即查看结果
- **AND** 执行中的模块显示进度指示器

#### Scenario: 结果整合展示
- **WHEN** 所有选中模块执行完成
- **THEN** 系统整合各模块结果
- **AND** 提供"一键应用建议"功能
- **AND** 用户可单独接受/拒绝每条建议

---

## MODIFIED Requirements

### Requirement: 智能分析入口更新

原有的"智能分析"入口 SHALL 更新为模块化分析入口。

**修改前**:
- 单一"智能分析"按钮
- 点击后执行全部分析
- 等待所有结果返回

**修改后**:
- "智能分析"按钮打开模块选择面板
- 用户选择需要执行的模块
- 渐进式展示各模块结果

---

## 性能优化预期目标

| 指标 | 优化前 | 优化后 | 提升 |
|-----|-------|-------|-----|
| 全量分析耗时 | 30-60秒 | 15-25秒（并行） | 50%+ |
| 单模块分析耗时 | N/A | 3-10秒 | - |
| 用户可操作性 | 必须等待 | 可随时查看已完成结果 | 显著提升 |
| 首次结果展示 | 等待全部完成 | 3-10秒内展示首个结果 | 显著提升 |

---

## 技术实现要点

### 后端服务拆分

```typescript
// relationDiscoveryService.ts 拆分后的方法
class RelationDiscoveryService {
  // 保留原有方法用于兼容
  async discoverRelations(...) { ... }
  
  // 新增独立方法
  async discoverRelationsOnly(...) { ... }
  async analyzeCrossDomainInsights(...) { ... }
  async generateLearningPathSuggestions(...) { ... }
  async analyzeKnowledgeGaps(...) { ... }
}
```

### 前端状态管理

```typescript
// GraphMap.tsx 状态定义
interface AnalysisModuleState {
  id: string;
  name: string;
  status: 'idle' | 'loading' | 'completed' | 'error';
  result: any;
  error?: string;
}

const [analysisModules, setAnalysisModules] = useState<AnalysisModuleState[]>([
  { id: 'relations', name: '关系发现', status: 'idle', result: null },
  { id: 'crossDomain', name: '跨学科洞察', status: 'idle', result: null },
  { id: 'learningPaths', name: '学习路径', status: 'idle', result: null },
  { id: 'knowledgeGaps', name: '知识缺口', status: 'idle', result: null },
]);
```

### 并行执行策略

```typescript
// 前端并行调用多个API
const executeSelectedModules = async (selectedIds: string[]) => {
  const promises = selectedIds.map(async (moduleId) => {
    updateModuleStatus(moduleId, 'loading');
    try {
      const result = await api.graphs[moduleId](options);
      updateModuleResult(moduleId, result);
      updateModuleStatus(moduleId, 'completed');
    } catch (error) {
      updateModuleStatus(moduleId, 'error');
    }
  });
  
  await Promise.allSettled(promises);
};
```
