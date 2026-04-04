# 图谱地图 AI 分析优化规范

## Why

当前图谱地图的 AI 分析功能存在以下问题：

1. **自定义分析功能缺失**：点击"自定义分析"后只是打开了 Agent 分析面板，没有提供自定义输入的界面，用户无法输入自己的分析目标
2. **数据范围未限制**：即使用户选中了特定图谱，AI 分析时仍会获取全部图谱数据，导致 TOKEN 消耗过大（一次可能消耗几十万 TOKEN）
3. **缺少确认步骤**：点击分析类型后立即开始执行，用户无法预览将要消耗的资源，也无法取消

## What Changes

- 实现真正的自定义分析功能，提供输入框让用户描述分析目标
- 限制数据获取范围，选中图谱时只获取相关数据
- 添加分析确认步骤，显示预估 TOKEN 消耗和操作预览
- 优化工具调用逻辑，减少不必要的数据获取

## Impact

- **Affected specs**: 图谱地图 AI 分析功能
- **Affected code**:
  - `src/components/GraphMap/AgentAnalysisPanel.tsx` - 添加确认步骤和自定义输入
  - `src/components/GraphMap/SkillSelector.tsx` - 添加确认界面
  - `api/services/agent/AgentService.ts` - 限制数据获取范围
  - `api/services/agent/tools/graphTools.ts` - 优化工具参数

---

## ADDED Requirements

### Requirement: 自定义分析输入功能

系统 SHALL 提供自定义分析输入界面，允许用户输入自己的分析目标。

#### Scenario: 使用自定义分析
- **WHEN** 用户选择"自定义分析"模式
- **THEN** 系统显示文本输入区域
- **AND** 用户可以输入自定义的分析目标、问题或指令
- **AND** 用户输入的内容将作为 AI 分析的主要指令

#### 界面设计

```
┌─────────────────────────────────────────────┐
│ 🎯 自定义分析                                │
├─────────────────────────────────────────────┤
│ 请描述您的分析目标：                          │
│ ┌─────────────────────────────────────────┐ │
│ │ 例如：分析这些图谱之间的知识关联，        │ │
│ │ 找出可以合并的重复内容...                │ │
│ │                                         │ │
│ │                                         │ │
│ └─────────────────────────────────────────┘ │
│                                             │
│ 📊 分析范围：已选择 3 个图谱                  │
│    - 机器学习基础                            │
│    - 深度学习入门                            │
│    - 神经网络原理                            │
│                                             │
│ ⚡ 预估消耗：约 5,000 - 15,000 tokens        │
│                                             │
│ [取消] [开始分析]                            │
└─────────────────────────────────────────────┘
```

---

### Requirement: 分析确认步骤

系统 SHALL 在执行分析前显示确认界面，让用户了解将要执行的操作。

#### Scenario: 分析确认流程
- **WHEN** 用户选择任何分析类型（快速/深度/自定义）
- **THEN** 系统显示确认面板
- **AND** 显示分析类型说明
- **AND** 显示分析范围（全部图谱 / 选中的 N 个图谱）
- **AND** 显示预估 TOKEN 消耗范围
- **AND** 用户可以选择"开始分析"或"取消"

#### TOKEN 消耗预估规则

| 分析类型 | 基础消耗 | 每个图谱额外消耗 |
|---------|---------|----------------|
| 快速分析 | 2,000 | 500 |
| 深度分析 | 5,000 | 2,000 |
| 自定义分析 | 3,000 | 1,500 |

---

### Requirement: 数据范围限制

系统 SHALL 根据用户选择的图谱范围限制数据获取。

#### Scenario: 选中图谱时限制数据范围
- **WHEN** 用户选中了特定图谱进行分析
- **THEN** AI 工具只获取选中图谱及其直接关联的数据
- **AND** 不获取未选中图谱的详细信息
- **AND** 关系查询只返回涉及选中图谱的关系

#### Scenario: 未选中图谱时使用全部数据
- **WHEN** 用户未选中任何图谱进行分析
- **THEN** 系统显示警告提示
- **AND** 用户确认后可以继续分析全部图谱
- **AND** 显示全部图谱分析的预估消耗

#### 工具参数传递

当 `selectedGraphIds` 有值时，工具调用应自动传入 `graphIds` 参数：

```typescript
// AgentService 中的 context
const context: ToolContext = {
  supabase: this.supabase,
  userId,
  graphIds: session.graphIds,  // 传递选中的图谱ID
  graphIndexMap,
};

// 工具执行时使用 graphIds 限制查询范围
if (context.graphIds && context.graphIds.length > 0) {
  query = query.in('id', context.graphIds);
}
```

---

### Requirement: 分析模式差异化

系统 SHALL 为不同分析模式提供差异化的功能和界面。

#### 快速分析模式

- **目的**：快速获取图谱概览和基本建议
- **特点**：
  - 只调用概览工具，不获取详细节点信息
  - 输出简洁的分析报告
  - TOKEN 消耗最低

#### 深度分析模式

- **目的**：深入分析图谱结构和关系
- **特点**：
  - 可获取节点和边的详细信息
  - 支持多轮工具调用
  - 输出详细的分析报告和建议

#### 自定义分析模式

- **目的**：根据用户特定需求进行分析
- **特点**：
  - 用户输入自定义分析目标
  - AI 根据目标选择合适的工具
  - 灵活的分析深度

---

## MODIFIED Requirements

### Requirement: AgentAnalysisPanel 组件更新

原有的 AgentAnalysisPanel SHALL 更新为支持确认步骤和自定义输入。

**修改前**:
- 选择 Skill 后立即执行
- 无确认步骤
- 无自定义输入

**修改后**:
- 选择分析类型后显示确认面板
- 自定义分析模式提供输入框
- 显示预估 TOKEN 消耗
- 用户确认后才开始执行

---

### Requirement: SkillSelector 组件更新

原有的 SkillSelector SHALL 更新为不直接执行分析。

**修改前**:
- 点击 Skill 卡片直接执行

**修改后**:
- 点击 Skill 卡片进入确认步骤
- 显示分析预览和预估消耗
- 用户确认后才执行

---

## 技术实现要点

### 确认流程状态机

```
┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│   选择类型    │ ──▶ │   确认预览    │ ──▶ │   执行分析    │
│  (SELECT)    │     │  (CONFIRM)   │     │  (EXECUTE)   │
└──────────────┘     └──────────────┘     └──────────────┘
       │                    │                    
       │                    ▼                    
       │             ┌──────────────┐           
       │             │    取消      │           
       │             └──────────────┘           
       ▼                                        
  自定义输入                                      
  (仅自定义模式)                                  
```

### 组件结构更新

```tsx
// AgentAnalysisPanel.tsx
type AnalysisStep = 'select' | 'confirm' | 'execute';

interface ConfirmState {
  mode: 'quick' | 'deep' | 'custom';
  skill?: SkillDefinition;
  customPrompt?: string;
  selectedGraphIds: string[];
  estimatedTokens: { min: number; max: number };
}

// 新增确认步骤组件
<AnalysisConfirmPanel
  mode={confirmState.mode}
  skill={confirmState.skill}
  customPrompt={confirmState.customPrompt}
  selectedGraphIds={selectedGraphIds}
  estimatedTokens={confirmState.estimatedTokens}
  onConfirm={handleExecuteAnalysis}
  onCancel={() => setStep('select')}
/>
```

### TOKEN 预估函数

```typescript
function estimateTokenConsumption(
  mode: 'quick' | 'deep' | 'custom',
  graphCount: number
): { min: number; max: number } {
  const baseTokens = {
    quick: 2000,
    deep: 5000,
    custom: 3000,
  };
  
  const perGraphTokens = {
    quick: 500,
    deep: 2000,
    custom: 1500,
  };
  
  const base = baseTokens[mode];
  const additional = graphCount * perGraphTokens[mode];
  
  return {
    min: base + additional,
    max: base + additional * 2,
  };
}
```

### 工具调用优化

```typescript
// 在 AgentService 中传递 graphIds 到工具
const context: ToolContext = {
  supabase: this.supabase,
  userId,
  graphIds: session.graphIds,  // 确保传递选中的图谱
  graphIndexMap,
};

// 在工具中检查并使用 graphIds
execute: async (params, context) => {
  let query = supabase.from('knowledge_graphs').select('*');
  
  // 如果有选中的图谱，限制查询范围
  if (context.graphIds && context.graphIds.length > 0) {
    query = query.in('id', context.graphIds);
  }
  
  return await query;
}
```
