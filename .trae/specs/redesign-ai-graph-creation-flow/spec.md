# AI 图谱创建流程重构 Spec

## Why

当前首页有"新建图谱"和"AI 生成"两个入口，但用户几乎不使用手动新建功能，总是用 AI 生成。手动新建中的模板功能有价值，但应整合到 AI 生成流程中。此外，现有模板分类（learning/story/project/analysis/custom）过于笼统，需要细化为面向不同任务场景的具体模板类型，让 AI 生成时能产出更贴合需求的结构。

## What Changes

- **移除"新建图谱"按钮**：首页不再显示独立的"新建图谱"入口
- **统一为单一"AI 生成"入口**：首页只保留一个"AI 生成"按钮
- **模板优先流程**：AI 生成时先选模板类型，再输入主题
- **空白图谱作为模板选项**：在模板选择中提供"空白图谱"选项，替代手动创建
- **模板分类体系重构**：从 5 个笼统分类改为 4 大类 17 个具体模板
- **TemplateCategory 类型扩展**：支持新的模板分类和具体模板类型

## Impact

- Affected specs: ai-graph-template-generation
- Affected code:
  - `src/pages/Dashboard.tsx` - 移除新建图谱按钮，统一入口
  - `src/components/AutoGraph/AutoGraphGenerator.tsx` - 增加模板选择步骤
  - `shared/types/graph.ts` - TemplateCategory 类型扩展
  - `api/services/ai/templateGeneratorService.ts` - 支持新模板类型的 prompt
  - `src/i18n/locales/zh-CN.json` - 新增模板类型翻译
  - `src/i18n/locales/en-US.json` - 新增模板类型翻译
  - `src/components/Templates/TemplateSelector.tsx` - 适配新分类
  - `src/components/Templates/TemplateCard.tsx` - 适配新分类图标

## ADDED Requirements

### Requirement: 统一 AI 生成入口

系统 SHALL 在首页只提供一个"AI 生成"按钮作为创建图谱的唯一入口。

#### Scenario: 首页操作按钮

- **WHEN** 用户查看首页
- **THEN** 只显示一个"AI 生成"按钮
- **AND** 不再显示独立的"新建图谱"按钮
- **AND** 移动端 FAB 菜单同样只保留"AI 生成"

#### Scenario: 点击 AI 生成按钮

- **WHEN** 用户点击"AI 生成"按钮
- **THEN** 打开 AI 图谱生成器
- **AND** 第一步显示模板类型选择界面

### Requirement: 模板优先生成流程

系统 SHALL 在 AI 生成流程中采用模板优先的设计，用户先选择模板类型再输入主题。

#### Scenario: 生成流程步骤

- **WHEN** 用户打开 AI 图谱生成器
- **THEN** 显示以下步骤流程：
  1. 选择模板类型（必选）
  2. 输入主题和背景信息
  3. AI 生成模板方案
  4. 选择方案并配置风格
  5. 确认生成

#### Scenario: 第一步选择模板类型

- **WHEN** 用户进入 AI 生成器
- **THEN** 显示 4 大模板分类卡片：知识学习、项目规划、问题分析、系统架构
- **AND** 每个分类下展开显示具体模板类型
- **AND** 用户必须选择一个模板类型才能进入下一步
- **AND** 提供"空白图谱"选项作为跳过模板的快捷方式

#### Scenario: 选择空白图谱

- **WHEN** 用户选择"空白图谱"模板
- **THEN** 跳过模板选择步骤
- **AND** 直接进入输入主题步骤
- **AND** AI 生成时不使用特定结构约束，自由生成

### Requirement: 新模板分类体系

系统 SHALL 提供以下 4 大类 17 个具体模板类型：

#### 知识学习类（knowledge）

| 模板 | 说明 | 结构特征 |
|------|------|----------|
| 知识树（knowledge_tree） | 层级学习，从基础到进阶 | 树形层级，root→core→sub→leaf |
| 技能图谱（skill_map） | 前置技能关系，学习路径 | 网络结构，prerequisite 关系为主 |
| 概念网络（concept_network） | 概念间关联和交叉 | 网络结构，related 关系为主 |
| 学习路径（learning_path） | 循序渐进的学习步骤 | 线性/层级，prerequisite 链式 |
| 专题研究（topic_research） | 深度探索某个专题 | 放射状+网络，多角度展开 |

#### 项目规划类（project）

| 模板 | 说明 | 结构特征 |
|------|------|----------|
| 项目生命周期（project_lifecycle） | 规划→执行→交付全流程 | 时间线/阶段，sequential 关系 |
| 开发流程（dev_workflow） | 需求→设计→开发→测试→部署 | 流程图，prerequisite 链式 |
| 任务分解（task_breakdown） | WBS 工作分解结构 | 树形层级，containment 关系 |
| 迭代规划（sprint_planning） | Sprint 迭代规划 | 时间线+层级，phase 关系 |

#### 问题分析类（analysis）

| 模板 | 说明 | 结构特征 |
|------|------|----------|
| 根因分析（root_cause） | 5Why/鱼骨图式分析 | 放射状，cause 关系 |
| SWOT 分析（swot） | 优势/劣势/机会/威胁 | 四象限，quadrant 关系 |
| 对比分析（comparison） | 多维度对比分析 | 分组+对比，compare 关系 |
| 决策树（decision_tree） | 条件分支决策 | 树形，condition 关系 |

#### 系统架构类（architecture）

| 模板 | 说明 | 结构特征 |
|------|------|----------|
| 技术生态（tech_ecosystem） | 技术栈关系和依赖 | 网络结构，depend 关系 |
| 组织架构（org_structure） | 层级与职能关系 | 树形层级，report 关系 |
| 系统架构（system_architecture） | 模块与依赖关系 | 分层网络，depend/contain 关系 |
| 知识体系（knowledge_system） | 跨领域知识关联 | 网络结构，cross_domain 关系 |

#### Scenario: 选择具体模板类型

- **WHEN** 用户点击某个分类（如"项目规划"）
- **THEN** 展开显示该分类下的具体模板列表
- **AND** 每个模板显示名称、简要说明、结构特征图标
- **AND** 用户选择一个具体模板后进入下一步

### Requirement: 模板类型影响 AI 生成

系统 SHALL 让选择的模板类型影响 AI 生成的图谱结构。

#### Scenario: 模板类型指导 AI 生成

- **WHEN** 用户选择了"技能图谱"模板并输入主题"前端开发"
- **THEN** AI 生成时使用技能图谱的 prompt 指导
- **AND** 生成的节点结构体现前置技能关系
- **AND** 边关系以 prerequisite 为主
- **AND** 布局建议偏向网络结构

#### Scenario: 空白图谱不约束结构

- **WHEN** 用户选择"空白图谱"
- **THEN** AI 根据主题自由生成，不使用特定结构约束
- **AND** 布局由 AI 自动判断

## MODIFIED Requirements

### Requirement: TemplateCategory 类型扩展

原有的 TemplateCategory 类型 SHALL 扩展为支持新的分类体系。

原类型：
```typescript
type TemplateCategory = "learning" | "story" | "project" | "analysis" | "custom";
```

新类型：
```typescript
type TemplateCategory = "knowledge" | "project" | "analysis" | "architecture";

type TemplateType =
  | "knowledge_tree" | "skill_map" | "concept_network" | "learning_path" | "topic_research"
  | "project_lifecycle" | "dev_workflow" | "task_breakdown" | "sprint_planning"
  | "root_cause" | "swot" | "comparison" | "decision_tree"
  | "tech_ecosystem" | "org_structure" | "system_architecture" | "knowledge_system"
  | "blank";
```

### Requirement: Dashboard 首页按钮调整

Dashboard 页面 SHALL 移除独立的"新建图谱"按钮，只保留"AI 生成"按钮。

#### Scenario: 桌面端按钮

- **WHEN** 用户在桌面端查看首页
- **THEN** 操作按钮区域只显示"AI 生成"按钮（紫色渐变）
- **AND** 不再显示"新建图谱"蓝色按钮

#### Scenario: 移动端按钮

- **WHEN** 用户在移动端查看首页
- **THEN** 操作区域只显示"AI 生成"按钮
- **AND** FAB 菜单中只保留"AI 生成"选项

### Requirement: AutoGraphGenerator 流程改造

AutoGraphGenerator 组件 SHALL 增加模板类型选择步骤作为第一步。

#### Scenario: 新的生成流程

- **WHEN** 用户打开 AutoGraphGenerator
- **THEN** 显示步骤指示器：①选择模板 → ②输入主题 → ③生成方案 → ④选择风格
- **AND** 第一步默认显示模板分类选择界面
- **AND** 选择模板后自动进入第二步

## REMOVED Requirements

### Requirement: 独立的新建图谱入口

**Reason**: 用户几乎不使用手动新建功能，AI 生成可以覆盖所有创建场景
**Migration**: 空白图谱作为 AI 模板的一种选项保留

### Requirement: story 和 custom 模板分类

**Reason**: 新的分类体系更加具体和实用，story 和 custom 被新体系替代
**Migration**: 原有 story 类型内容可归入知识学习类中的"专题研究"；custom 由"空白图谱"替代
