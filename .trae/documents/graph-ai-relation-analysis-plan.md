# 知识图谱智能关系分析功能实施计划

## 需求概述

改进现有的图谱AI分析功能，使其能够：
1. **自动关联不同知识图谱** - 识别交叉学科的知识图谱
2. **智能识别图谱之间的关系** - 基于内容分析而非仅依赖现有关系
3. **给出智能建议** - 基于分析结果提供学习建议
4. **揭示图谱间的关系** - 可视化展示图谱间的潜在关联

## 现有功能分析

### 已有功能
1. **图谱地图分析** (`/graphs/map/analyze`)
   - 识别孤岛图谱
   - 建议添加前置知识
   - 学习路径建议
   - 合并建议

2. **跨图谱节点连接分析** (`cross_graph_connection_analysis`)
   - 分析两个图谱之间节点的连接关系
   - 支持连接类型：same_concept, related_concept, complementary, prerequisite

3. **领域分析** (`/domain/analyze`)
   - 分析某个领域，推荐相关图谱主题
   - 分析主题之间的学习依赖关系

### 现有问题
1. 图谱地图分析仅基于现有关系，无法发现潜在关系
2. 缺少基于内容相似度、主题交叉的智能关联发现
3. 没有交叉学科识别功能
4. 缺少图谱关系发现和可视化功能

## 实施方案

### 第一阶段：智能图谱关系发现API

#### 1.1 新增API端点：`/graphs/discover-relations`

**功能**：基于图谱内容智能发现图谱间的潜在关系

**请求参数**：
```typescript
{
  graph_ids?: string[];  // 可选，指定要分析的图谱ID，不传则分析用户所有图谱
  max_suggestions?: number;  // 最大建议数量，默认20
  include_cross_domain?: boolean;  // 是否包含跨领域分析，默认true
}
```

**响应结构**：
```typescript
{
  discovered_relations: Array<{
    source_graph_id: string;
    source_graph_title: string;
    target_graph_id: string;
    target_graph_title: string;
    relation_type: 'prerequisite' | 'extension' | 'related' | 'cross_domain';
    confidence: number;  // 0-1的置信度
    reason: string;  // AI生成的关联原因
    shared_concepts: string[];  // 共享的核心概念
    suggested_learning_order?: 'source_first' | 'target_first' | 'parallel';
  }>;
  cross_domain_insights: Array<{
    domains: string[];  // 涉及的领域
    intersection_topics: string[];  // 交叉主题
    description: string;  // 交叉学科分析描述
    related_graph_ids: string[];  // 相关图谱ID
  }>;
  analysis_summary: {
    total_graphs_analyzed: number;
    relations_discovered: number;
    cross_domain_clusters: number;
    isolated_graphs: string[];  // 仍然孤立的图谱
  };
}
```

#### 1.2 新增提示词模板：`discover_graph_relations`

```markdown
你是一个知识图谱专家，擅长分析不同知识领域之间的关联。

## 任务
分析以下知识图谱之间的潜在关系，识别：
1. 前置知识关系：学习一个图谱前需要先掌握另一个图谱
2. 扩展知识关系：一个图谱是另一个图谱的深入或扩展
3. 相关知识关系：两个图谱有概念交叉但无直接依赖
4. 跨领域关系：属于不同学科但有交叉点的图谱

## 图谱信息
{{#each graphs}}
### 图谱：{{title}}
- 描述：{{description}}
- 领域：{{domain}}
- 核心概念：{{core_concepts}}
- 知识点数量：{{node_count}}
{{/each}}

## 分析要求
1. 识别图谱间的概念重叠和交叉点
2. 分析学习依赖关系（哪些图谱需要先学）
3. 发现跨学科的交叉领域
4. 给出关联的置信度和原因

## 输出格式
返回JSON格式的分析结果。
```

### 第二阶段：图谱关系可视化增强

#### 2.1 更新 `MapAnalysisPanel` 组件

新增功能：
- 显示发现的潜在关系（虚线连接）
- 交叉学科区域高亮
- 关系置信度可视化
- 一键创建关系按钮

#### 2.2 新增图谱关系发现面板

创建 `GraphRelationDiscoveryPanel.tsx`：
- 显示AI发现的关系列表
- 支持筛选（按关系类型、置信度）
- 支持一键创建关系
- 显示交叉学科分析结果

### 第三阶段：智能建议系统

#### 3.1 新增API端点：`/graphs/intelligent-suggestions`

**功能**：基于图谱关系分析给出学习建议

**响应结构**：
```typescript
{
  learning_path_suggestions: Array<{
    path: string[];  // 图谱ID序列
    description: string;
    estimated_time: string;
    difficulty: 'beginner' | 'intermediate' | 'advanced';
  }>;
  knowledge_gaps: Array<{
    missing_topic: string;
    related_graphs: string[];
    importance: 'high' | 'medium' | 'low';
    suggested_action: 'create' | 'merge' | 'expand';
  }>;
  cross_domain_opportunities: Array<{
    domains: string[];
    intersection_graphs: string[];
    potential_benefits: string;
    recommended_order: string[];
  }>;
}
```

### 第四阶段：前端集成

#### 4.1 更新图谱地图页面

- 添加"智能分析"按钮
- 集成关系发现面板
- 更新图谱地图可视化（显示发现的关系）

#### 4.2 更新API客户端

在 `src/services/api/graphs.ts` 中添加：
- `discoverRelations()`
- `getIntelligentSuggestions()`

## 技术实现细节

### 后端实现

#### 文件修改清单

1. **新增文件**
   - `api/routes/graphRelations.ts` - 图谱关系发现API路由
   - `api/services/graph/relationDiscoveryService.ts` - 关系发现服务

2. **修改文件**
   - `api/routes/graphs.ts` - 添加新端点
   - `api/services/ai/promptService.ts` - 添加新提示词schema
   - `supabase/migrations/00000000000000_initial_schema.sql` - 可能需要添加字段

### 前端实现

#### 文件修改清单

1. **新增文件**
   - `src/components/GraphMap/GraphRelationDiscoveryPanel.tsx` - 关系发现面板
   - `src/hooks/useGraphRelationDiscovery.ts` - 关系发现hook

2. **修改文件**
   - `src/components/GraphMap/MapAnalysisPanel.tsx` - 增强分析面板
   - `src/components/GraphMap/GraphMapCanvas.tsx` - 显示发现的关系
   - `src/services/api/graphs.ts` - 添加API方法
   - `src/types/index.ts` - 添加类型定义

## 实施步骤

### Step 1: 后端API开发
1. 创建关系发现服务 `relationDiscoveryService.ts`
2. 添加提示词模板和schema
3. 创建API端点 `/graphs/discover-relations`
4. 创建API端点 `/graphs/intelligent-suggestions`

### Step 2: 前端组件开发
1. 创建 `GraphRelationDiscoveryPanel` 组件
2. 创建 `useGraphRelationDiscovery` hook
3. 更新API客户端

### Step 3: 集成与优化
1. 集成到图谱地图页面
2. 更新图谱地图可视化
3. 添加一键创建关系功能

### Step 4: 测试与验证
1. 编写单元测试
2. 编写E2E测试
3. 性能优化

## 数据库变更

可能需要的数据库变更：
```sql
-- 为 graph_relations 添加置信度字段
ALTER TABLE graph_relations 
ADD COLUMN IF NOT EXISTS confidence DECIMAL(3,2) DEFAULT 1.0;

-- 添加关系来源字段
ALTER TABLE graph_relations 
ADD COLUMN IF NOT EXISTS source VARCHAR(20) DEFAULT 'manual'
CHECK (source IN ('manual', 'ai_discovered', 'ai_suggested'));

-- 添加共享概念字段
ALTER TABLE graph_relations 
ADD COLUMN IF NOT EXISTS shared_concepts TEXT[] DEFAULT '{}';
```

## 预期效果

1. **更智能的关系发现**：AI能够基于内容分析发现图谱间的潜在关系
2. **交叉学科识别**：自动识别跨领域的知识图谱
3. **学习建议**：基于关系分析给出个性化学习建议
4. **可视化增强**：在图谱地图上直观展示发现的关系
