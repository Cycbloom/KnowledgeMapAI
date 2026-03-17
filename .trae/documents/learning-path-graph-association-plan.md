# 学习路径规划 - 前置知识图谱关联优化方案

## 问题分析

### 当前实现情况

1. **学习路径规划流程**（[LearningPathWizard.tsx](file:///d:/KnowledgeMap/src/components/Learning/LearningPathWizard.tsx)）
   - 用户选择学习目标 → 评估前置知识掌握程度 → 为"不了解"的知识创建图谱 → 生成学习路径
   - 调用 `api.graphs.createPrerequisiteGraphs` 批量创建前置图谱

2. **前置图谱创建逻辑**（[graphRelations.ts](file:///d:/KnowledgeMap/api/routes/graphRelations.ts#L269-L359)）
   - 使用 `ilike` 进行标题匹配检查现有图谱
   - 找到现有图谱时复用并建立关系
   - 未找到时创建新图谱

### 存在的问题

1. **匹配方式不够智能**
   - 批量创建只使用 `ilike` 标题匹配，无法识别语义相似但表述不同的图谱
   - 例如：用户已有"JavaScript基础"，AI 规划建议"JS入门"，无法关联

2. **缺少语义相似度检测**
   - 单个创建接口使用了 `checkDuplicateGraphTopic`（阈值 0.85）
   - 批量创建接口没有使用语义相似度检测

3. **用户体验问题**
   - 用户不知道哪些前置知识已有对应图谱
   - 创建时没有明确提示是"关联现有图谱"还是"创建新图谱"

## 解决方案

### 方案概述

在 AI 规划学习路径时，增强前置知识与现有图谱的智能关联能力，避免重复创建图谱。

### 实现步骤

#### 步骤 1：优化批量创建前置图谱的匹配逻辑

**修改文件**: [api/routes/graphRelations.ts](file:///d:/KnowledgeMap/api/routes/graphRelations.ts)

**改动内容**:
1. 在批量创建接口 `/:graphId/prerequisite-graphs/batch` 中引入语义相似度检测
2. 复用 `checkDuplicateGraphTopic` 函数进行智能匹配
3. 返回结果中明确区分"关联现有图谱"和"创建新图谱"

**具体改动**:
```typescript
// 在 for (const item of topics) 循环中
// 替换现有的 ilike 匹配逻辑
const duplicateCheck = await checkDuplicateGraphTopic(
  supabase,
  req.user.id,
  item.topic,
  { threshold: 0.85 }
);

if (duplicateCheck.isDuplicate && duplicateCheck.similarGraphs[0]) {
  // 复用现有图谱
  const existingGraph = duplicateCheck.similarGraphs[0];
  // ... 建立关系
} else {
  // 创建新图谱
  // ...
}
```

#### 步骤 2：增强学习路径规划 API 返回现有图谱信息

**修改文件**: [api/routes/learningPath.ts](file:///d:/KnowledgeMap/api/routes/learningPath.ts)

**新增接口或修改现有接口**:
- 在 `/questions` 接口中，为每个前置知识问题返回对应的现有图谱信息（如果存在）
- 让用户在评估阶段就能看到哪些知识已有图谱

**返回数据结构增强**:
```typescript
interface PrerequisiteQuestion {
  topic: string;
  description?: string;
  options: string[];
  existingGraph?: {
    id: string;
    title: string;
    nodeCount: number;
    progress?: number;
  };
}
```

#### 步骤 3：优化前端用户体验

**修改文件**: [LearningPathWizard.tsx](file:///d:/KnowledgeMap/src/components/Learning/LearningPathWizard.tsx)

**改动内容**:
1. 在前置知识评估界面显示已有图谱的提示
2. 在创建图谱步骤中，明确区分"关联现有图谱"和"创建新图谱"
3. 对于已有图谱的前置知识，提供"直接关联"选项而非重复创建

**UI 改进**:
- 如果前置知识已有对应图谱，显示"已有图谱：xxx"标签
- 用户可以选择：关联现有图谱 / 创建新图谱 / 跳过

#### 步骤 4：添加图谱关联确认机制

**新增功能**:
- 在创建前置图谱前，展示匹配到的相似图谱列表
- 用户可以确认关联或选择创建新图谱
- 避免自动关联错误图谱

### 数据流程图

```
用户选择学习目标
       ↓
AI 分析前置知识需求
       ↓
查询数据库中是否存在相似图谱（语义匹配）
       ↓
返回前置知识列表 + 现有图谱匹配结果
       ↓
用户评估掌握程度 + 选择关联/创建
       ↓
建立图谱关系 / 创建新图谱
       ↓
生成学习路径
```

### 技术细节

#### 语义相似度检测

复用现有的 `checkDuplicateGraphTopic` 函数：
- 使用 embedding 向量计算相似度
- 阈值设为 0.85（可配置）
- 返回相似图谱列表及相似度分数

#### 关系类型

使用现有的 `graph_relations` 表：
- `relation_type`: "prerequisite"（前置知识）
- `context`: 描述关系原因

### 影响范围

1. **后端 API**
   - `api/routes/graphRelations.ts` - 批量创建接口优化
   - `api/routes/learningPath.ts` - 问题接口增强

2. **前端组件**
   - `src/components/Learning/LearningPathWizard.tsx` - UI 优化

3. **类型定义**
   - `shared/types/` - 相关接口类型更新

### 测试要点

1. 语义相似度匹配准确性测试
2. 现有图谱关联流程测试
3. 新图谱创建流程测试
4. 边界情况：无匹配、多个相似匹配、完全匹配

## 预期效果

1. **避免重复数据**：智能识别已有图谱，减少重复创建
2. **提升用户体验**：清晰展示关联关系，用户可自主选择
3. **知识图谱网络化**：建立图谱间的关联关系，形成知识网络
