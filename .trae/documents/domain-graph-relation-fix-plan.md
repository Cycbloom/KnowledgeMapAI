# 领域图谱生成 - 关系连线问题修复计划

## 问题分析

### 当前现象
用户在生成"高等数学"领域图谱后，发现所有图谱节点都连接到同一个中心节点（如"导数与微分"），而不是反映真实的知识依赖关系。

### 根本原因

经过代码分析，发现两个关键问题：

#### 1. AI 提示词问题 ([graphs.ts:620-634](file:///d:/KnowledgeMap/api/routes/graphs.ts#L620-L634))

当前的提示词：
```
你是知识图谱专家。用户想学习「${domain}」领域。
请推荐 ${count} 个该领域的知识图谱主题。
要求：
1. 每个主题一行，格式：标题|简述|类型|优先级
2. 类型：prerequisite(前置)/extension(扩展)/related(相关)
...
```

**问题**：提示词只要求 AI 标注每个图谱与"领域主题"的关系类型，而没有要求分析**图谱之间的相互依赖关系**。

#### 2. 关系创建逻辑问题 ([graphs.ts:800-880](file:///d:/KnowledgeMap/api/routes/graphs.ts#L800-L880))

当前逻辑：
```typescript
if (createdGraphs.length >= 2) {
  const mainGraph = createdGraphs[0];  // 第一个图谱作为"主图谱"
  
  for (let i = 1; i < createdGraphs.length; i++) {
    const graph = createdGraphs[i];
    // 所有其他图谱都与 mainGraph 建立关系
    switch (graph.relationType) {
      case "prerequisite":
        // mainGraph -> graph (mainGraph 依赖 graph)
        break;
      case "extension":
        // graph -> mainGraph (graph 依赖 mainGraph)
        break;
      case "related":
        // mainGraph -> graph
        break;
    }
  }
}
```

**问题**：
- `createdGraphs[0]` 被硬编码为"主图谱"
- 所有图谱都只与第一个图谱建立关系
- 这导致所有节点都连接到同一个中心节点

### 问题示例

假设 AI 生成了以下推荐：
1. 导数与微分 | ... | prerequisite | high
2. 极限理论 | ... | prerequisite | high  
3. 积分学 | ... | extension | medium
4. 微分方程 | ... | extension | medium

当前逻辑会：
- 将"导数与微分"作为主图谱
- 创建关系：导数与微分 -> 极限理论
- 创建关系：积分学 -> 导数与微分
- 创建关系：微分方程 -> 导数与微分

**正确的关系应该是**：
- 极限理论 -> 导数与微分（极限是导数的前置）
- 导数与微分 -> 积分学（导数是积分的前置）
- 积分学 -> 微分方程（积分是微分方程的前置）

## 解决方案

### 方案概述

修改 AI 提示词，让 AI 在推荐图谱的同时，也分析并返回图谱之间的依赖关系。

### 修改内容

#### 1. 修改 AI 提示词 ([graphs.ts:620-634](file:///d:/KnowledgeMap/api/routes/graphs.ts#L620-L634))

**新的提示词结构**：
```
你是知识图谱专家。用户想学习「${domain}」领域。

请推荐 ${count} 个该领域的知识图谱主题，并分析它们之间的依赖关系。

要求：
1. 推荐主题覆盖领域各方面，避免重复
2. 分析主题之间的学习依赖关系（如：学A之前需要先学B）
3. 优先级：high(核心基础)/medium(重要内容)/low(扩展内容)

返回JSON格式：
{
  "graphs": [
    {"title": "主题名", "description": "简述", "priority": "high/medium/low"}
  ],
  "relations": [
    {"from": "主题A", "to": "主题B", "type": "prerequisite", "reason": "A是B的前置知识"}
  ]
}

关系类型说明：
- prerequisite: from 是 to 的前置知识（学to之前需要先学from）
- extension: from 是 to 的扩展知识（学完to后可以学习from）
- related: from 和 to 相关但无直接依赖

已有图谱：${existingTitles.length > 0 ? existingTitles.slice(0, 15).join("、") : "无"}
```

#### 2. 修改返回数据结构

**新的返回类型**：
```typescript
interface DomainAnalysisResult {
  recommendations: Array<{
    title: string;
    description: string;
    priority: 'high' | 'medium' | 'low';
  }>;
  relations: Array<{
    from_title: string;
    to_title: string;
    type: 'prerequisite' | 'extension' | 'related';
    reason?: string;
  }>;
}
```

#### 3. 修改批量创建逻辑 ([graphs.ts:800-880](file:///d:/KnowledgeMap/api/routes/graphs.ts#L800-L880))

**新的逻辑**：
1. 创建所有图谱
2. 根据 AI 返回的 `relations` 数组建立图谱之间的关系
3. 使用图谱标题匹配来找到对应的图谱 ID

#### 4. 修改前端组件

更新 `DomainGraphGenerator.tsx` 以支持新的数据结构：
- 显示图谱之间的预览关系
- 允许用户查看和确认关系

## 实施步骤

### Step 1: 修改后端 API

1. 修改 `/domain/analyze` 接口的提示词
2. 更新返回数据结构
3. 修改 `/domain/batch-create` 接口的关系创建逻辑

### Step 2: 修改前端组件

1. 更新 `DomainGraphGenerator.tsx` 的数据类型
2. 添加关系预览功能
3. 优化用户界面展示

### Step 3: 测试验证

1. 测试领域分析功能
2. 验证关系创建是否正确
3. 检查图谱地图展示效果

## 预期效果

修复后，生成"高等数学"领域图谱时：
- 极限理论 -> 导数与微分 -> 积分学 -> 微分方程（形成正确的学习路径）
- 相关但无依赖的知识点显示为 related 关系
- 图谱地图展示真实的知识结构

## 风险评估

- **兼容性**：需要确保前端和后端的数据结构变更同步
- **AI 响应质量**：需要测试 AI 是否能正确分析图谱间关系
- **性能**：关系分析可能增加 AI 响应时间
