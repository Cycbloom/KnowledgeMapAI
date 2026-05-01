# 扩展 AI 服务商与简化任务配置 Spec

## Why

当前 AI 服务商仅支持 Deepseek、火山引擎、阿里云三家，且用户需要分别为文本/向量化/推理任务配置不同的服务商和模型，这对普通用户来说过于复杂。大多数用户只有一个 API Key，不需要也不了解如何配置向量化模型。需要扩展更多服务商（如 OpenAI、智谱、月之暗面等），同时简化配置模型：用户只需配置一个主 AI 即可使用全部文本功能，向量化功能单独可选配置，未配置时优雅降级。

## What Changes

- 扩展 `AIProviderType` 类型，新增 `openai`、`zhipu`、`moonshot` 服务商
- 新增对应的后端 Provider 实现类（均基于 OpenAI 兼容接口）
- 简化 AI 任务配置模型：将原来的 text/embedding/reasoning 三任务独立配置，改为「主 AI 配置」+「向量化配置（可选）」两层
- 主 AI 配置用于所有文本类任务（对话、生成、推理等），用户只需配一个服务商 + API Key + 模型
- 向量化配置为可选，未配置时禁用相关功能（语义搜索、相似度计算等），而非报错
- 推理任务默认使用主 AI，不再需要单独配置
- 更新前端设置页面，移除原来的三任务配置区域，替换为简化的两层配置
- 更新后端 `getProviderForTask` 逻辑，embedding 任务使用向量化配置，其余任务使用主 AI
- 更新前端移动端 AI 配置，同步支持新服务商

## Impact

- Affected specs: AI 服务商类型、AI 任务配置模型、用户设置
- Affected code:
  - `shared/types/ai.ts` — 扩展 `AIProviderType`
  - `api/services/ai/providers/` — 新增 OpenAI、智谱、月之暗面 Provider
  - `api/services/ai/factory.ts` — 支持新 Provider
  - `api/services/ai/config.ts` — 简化任务映射逻辑
  - `api/routes/ai/config.ts` — 更新 PROVIDER_DEFAULTS 和 PROVIDER_ENV_KEY_MAP
  - `src/pages/Settings.tsx` — 简化 AI 配置 UI
  - `src/services/mobile/aiClient.ts` — 扩展 PROVIDER_CONFIGS
  - `src/services/mobile/aiService.ts` — 扩展 ENV_API_KEYS
  - `src/i18n/locales/zh-CN.json` — 新增翻译
  - `src/i18n/locales/en-US.json` — 新增翻译

## ADDED Requirements

### Requirement: 新增 AI 服务商

系统 SHALL 支持以下 AI 服务商：Deepseek、火山引擎、阿里云、OpenAI、智谱 AI、月之暗面。

#### Scenario: 新增 OpenAI 服务商
- **WHEN** 用户选择 OpenAI 作为 AI 服务商
- **THEN** 系统应使用 `https://api.openai.com/v1` 作为默认 Base URL，`gpt-4o-mini` 作为默认模型
- **AND** OpenAI Provider 应使用标准 OpenAI 兼容接口

#### Scenario: 新增智谱 AI 服务商
- **WHEN** 用户选择智谱 AI 作为 AI 服务商
- **THEN** 系统应使用 `https://open.bigmodel.cn/api/paas/v4` 作为默认 Base URL，`glm-4-flash` 作为默认模型
- **AND** 智谱 AI Provider 应使用标准 OpenAI 兼容接口

#### Scenario: 新增月之暗面服务商
- **WHEN** 用户选择月之暗面作为 AI 服务商
- **THEN** 系统应使用 `https://api.moonshot.cn/v1` 作为默认 Base URL，`moonshot-v1-8k` 作为默认模型
- **AND** 月之暗面 Provider 应使用标准 OpenAI 兼容接口

#### Scenario: 自定义服务商
- **WHEN** 用户在设置中输入自定义的 Base URL 和模型名称
- **THEN** 系统应支持使用任意 OpenAI 兼容接口的服务商

### Requirement: 简化 AI 任务配置模型

系统 SHALL 将 AI 任务配置从三任务独立配置简化为「主 AI」+「向量化（可选）」两层。

#### Scenario: 主 AI 配置
- **WHEN** 用户配置了主 AI（服务商 + API Key + 模型）
- **THEN** 所有文本类任务（对话、生成、推理、TTS 等）应使用主 AI
- **AND** 用户无需分别为不同任务配置不同的服务商

#### Scenario: 向量化配置（可选）
- **WHEN** 用户额外配置了向量化服务商和 API Key
- **THEN** 向量化任务（语义搜索、相似度计算、知识图谱嵌入等）应使用向量化配置
- **AND** 向量化配置独立于主 AI，可以使用不同的服务商

#### Scenario: 向量化未配置
- **WHEN** 用户未配置向量化服务商
- **THEN** 系统应禁用依赖向量化的功能（语义搜索、相似度推荐等）
- **AND** 不依赖向量化的功能（对话、内容生成等）应正常工作
- **AND** 设置页面应显示向量化功能已停用的提示

#### Scenario: 推理任务回退
- **WHEN** 系统执行推理任务
- **THEN** 系统应使用主 AI 配置，而非单独的推理配置
- **AND** 不再需要独立的推理任务配置

### Requirement: 前端设置页面简化

系统 SHALL 更新设置页面，将原来的三任务配置区域替换为简化的两层配置。

#### Scenario: 主 AI 配置区域
- **WHEN** 用户打开设置页面
- **THEN** 系统应显示「主 AI 配置」区域，包含：服务商选择、API Key 输入、模型选择
- **AND** 服务商下拉应包含所有支持的服务商（Deepseek、火山引擎、阿里云、OpenAI、智谱 AI、月之暗面）
- **AND** 选择服务商后自动填充默认 Base URL 和模型

#### Scenario: 向量化配置区域
- **WHEN** 用户打开设置页面
- **THEN** 系统应显示「向量化配置（可选）」区域，包含：服务商选择、API Key 输入、模型选择
- **AND** 该区域应标注为「可选」，并说明未配置时相关功能将停用
- **AND** 向量化服务商下拉应仅列出支持 embedding 的服务商（火山引擎、阿里云、OpenAI 等）

#### Scenario: 移除三任务独立配置
- **WHEN** 用户打开设置页面
- **THEN** 系统不应再显示原来的「文本生成任务」「向量化任务」「推理任务」三个独立配置区域
- **AND** 原有的模型管理功能（添加/删除模型）应保留

### Requirement: 向量化功能优雅降级

系统 SHALL 在向量化未配置时优雅降级相关功能。

#### Scenario: 语义搜索降级
- **WHEN** 用户使用搜索功能且向量化未配置
- **THEN** 系统应使用关键词搜索替代语义搜索
- **AND** 应提示用户配置向量化服务以获得更好的搜索体验

#### Scenario: 知识图谱嵌入降级
- **WHEN** 系统需要生成知识节点嵌入且向量化未配置
- **THEN** 系统应跳过嵌入生成，知识节点正常创建但无嵌入向量
- **AND** 后台嵌入生成任务应检测配置状态，未配置时不执行

## MODIFIED Requirements

### Requirement: AI 服务商类型

系统 SHALL 支持以下 AI 服务商类型。

原有行为：仅支持 `deepseek` | `volcengine` | `aliyun`

修改后行为：支持 `deepseek` | `volcengine` | `aliyun` | `openai` | `zhipu` | `moonshot`

### Requirement: AI 任务映射

系统 SHALL 按简化后的两层配置映射任务到服务商。

原有行为：text → deepseek, embedding → volcengine, reasoning → aliyun, tts → aliyun

修改后行为：
1. text/reasoning/tts 等所有文本类任务 → 使用主 AI 配置（用户选择的服务商）
2. embedding → 使用向量化配置（如果已配置），否则返回 null/跳过

### Requirement: AI 服务商配置 UI

系统 SHALL 在设置页面提供简化的 AI 配置界面。

原有行为：分别为 text/embedding/reasoning 三个任务配置服务商和模型

修改后行为：主 AI 配置（服务商+Key+模型）+ 向量化配置（可选，服务商+Key+模型）

## REMOVED Requirements

无移除的需求（原有三任务配置被简化替代，功能不丢失）。
