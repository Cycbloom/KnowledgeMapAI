# AI 图谱生成器适配故事创作模板 Spec

## Why
当前 AI 知识图谱生成器对 `story_creation` 模板类型没有特殊处理，走的是与其他模板完全相同的通用流程（主题+背景+风格+来源）。但故事创作不需要这些通用配置，用户需要的是输入基本信息后，AI 生成初始的故事结构骨架和角色节点，详细内容在 StoryEditor 工作区中完成。

## What Changes
- AutoGraphGenerator 中为 `story_creation` 添加专属配置界面（简化表单）
- 故事创作模式下隐藏不适用的通用配置项（风格选择、参考来源等）
- 添加故事专属配置项：故事类型/题材、核心冲突简述、主要角色提示
- 后端 templateGeneratorService 为 `story_creation` 添加专属生成逻辑（生成故事结构节点+角色节点）
- 保存时自动初始化三幕式结构模板

## Impact
- Affected specs: [story-creation-mvp/spec.md](story-creation-mvp/spec.md)
- Affected code:
  - `src/components/AutoGraph/AutoGraphGenerator.tsx` — 添加 story_creation 专属 UI 分支
  - `api/services/ai/templateGeneratorService.ts` — 添加 story_creation 专属生成逻辑
  - `api/routes/autoGraph.ts` — 传递 story 专属参数
  - `shared/types/graph.ts` — 添加 story 专属配置类型
  - `src/i18n/locales/zh-CN.json` — 添加新 i18n key
  - `src/i18n/locales/en-US.json` — 添加新 i18n key

---

## ADDED Requirements

### Requirement: 故事创作专属生成界面
系统 SHALL 在 AutoGraphGenerator 中为 `story_creation` 模板类型提供简化的专属配置界面，替代通用的主题+背景+风格+来源表单。

#### Scenario: 选择故事创作模板后显示专属界面
- **WHEN** 用户在模板选择器中选择"创意写作 → 小说/故事创作"
- **THEN** 系统 SHALL 显示故事创作专属配置界面
- **AND** 隐藏通用的"生成风格选择"和"参考来源"区域
- **AND** 显示以下故事专属输入项：
  - 故事标题（必填，复用现有 topic 输入框）
  - 故事题材/类型（可选，下拉选择：奇幻/科幻/悬疑/言情/历史/都市/武侠/其他）
  - 核心冲突简述（可选，textarea，1-2 句话描述故事核心矛盾）
  - 主要角色提示（可选，textarea，列出 2-5 个角色的名字和简要描述，每行一个）

#### Scenario: 故事创作模式下的生成流程
- **WHEN** 用户在故事创作模式下点击"开始生成"
- **THEN** 系统 SHALL 调用 AI 生成接口，传入 `template_type: "story_creation"` 和故事专属参数
- **AND** AI SHALL 生成初始的故事结构节点（Story → Act → Sequence 层级）
- **AND** AI SHALL 根据角色提示生成初始角色节点（如有提供）
- **AND** 生成的结果树应展示故事结构骨架

#### Scenario: 故事创作模式下的保存流程
- **WHEN** 用户在故事创作模式下保存生成结果
- **THEN** 系统 SHALL 创建 `template_type: "story_creation"` 的图谱
- **AND** 保存后跳转到 StoryEditor 编辑器
- **AND** StoryEditor 中应能看到 AI 生成的初始结构骨架和角色

### Requirement: 后端故事创作专属生成逻辑
系统 SHALL 在 templateGeneratorService 中为 `story_creation` 提供专属的 AI 生成逻辑，生成故事结构骨架和角色节点。

#### Scenario: AI 生成故事结构骨架
- **WHEN** 后端收到 `template_type: "story_creation"` 的生成请求
- **THEN** 系统 SHALL 使用专属 prompt 指导 AI 生成故事结构
- **AND** 生成的节点应包含：Story 根节点、3 个 Act 节点、7-10 个 Sequence 节点
- **AND** 节点间应有正确的父子层级关系
- **AND** 如果提供了角色提示，应额外生成角色节点

#### Scenario: 无角色提示时的默认行为
- **WHEN** 用户未提供角色提示
- **THEN** 系统 SHALL 仍然生成故事结构骨架
- **AND** 不生成角色节点（用户后续在 StoryEditor 中手动添加）

## MODIFIED Requirements

### Requirement: AutoGraphGenerator 模板选择流程
原有流程中，所有非 `topic_research` 模板走完全相同的通用表单。现修改为：`story_creation` 也获得专属处理分支，类似 `topic_research` 的模式但内容不同。

#### Scenario: 切换到故事创作模板时清除通用配置
- **WHEN** 用户从其他模板切换到 `story_creation`
- **THEN** 系统 SHALL 清除通用配置状态（style、sources、customPrompt）
- **AND** 初始化故事专属配置状态（genre、coreConflict、characterHints）

#### Scenario: 从故事创作切换到其他模板时清除故事配置
- **WHEN** 用户从 `story_creation` 切换到其他模板类型
- **THEN** 系统 SHALL 清除故事专属配置状态
- **AND** 恢复通用配置界面
