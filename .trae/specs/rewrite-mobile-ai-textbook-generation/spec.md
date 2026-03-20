# 移动端 AI 生成教材功能重构 Spec

## Why
移动端 AI 生成教材功能不可用，需要重写相关代码以确保移动端能够直接与 AI 服务商通信并正确生成学习教材。

## What Changes
- 重构 `MobileAIClient` 类，增强错误处理和日志记录
- 重写 `mobileAIService.generateLearningMaterial` 方法，优化提示词和响应解析
- 改进 `mobileAiApi.generateLearningMaterial` 的错误处理逻辑
- 增强 API Key 配置验证机制

## Impact
- Affected specs: 移动端 AI 服务能力
- Affected code:
  - `src/services/mobile/aiClient.ts`
  - `src/services/mobile/aiService.ts`
  - `src/services/mobile/ai.ts`

## ADDED Requirements

### Requirement: 移动端 AI 客户端初始化
系统 SHALL 提供可靠的移动端 AI 客户端初始化机制。

#### Scenario: 成功初始化
- **WHEN** 用户提供有效的 API Key 和 Provider 配置
- **THEN** 系统应成功创建 OpenAI 客户端实例
- **AND** 客户端应配置正确的 baseURL 和模型

#### Scenario: 配置验证失败
- **WHEN** 用户提供的 API Key 为空或无效
- **THEN** 系统应返回明确的错误信息
- **AND** 不应尝试创建客户端实例

### Requirement: 移动端生成学习教材
系统 SHALL 支持移动端直接调用 AI 服务生成学习教材。

#### Scenario: 成功生成教材
- **WHEN** 用户请求生成学习教材
- **AND** AI 服务已正确配置
- **THEN** 系统应返回包含 content 和 keywords 的结构化响应
- **AND** content 应为 Markdown 格式的学习内容
- **AND** keywords 应包含 5-15 个关键词对象

#### Scenario: AI 服务未配置
- **WHEN** 用户请求生成学习教材
- **AND** AI 服务未配置（API Key 缺失）
- **THEN** 系统应抛出明确的错误信息："AI 服务未配置，请先在设置中配置 API Key"

#### Scenario: AI 请求失败
- **WHEN** AI 服务请求失败（网络错误、API 错误等）
- **THEN** 系统应捕获错误并抛出包含原始错误信息的异常
- **AND** 应记录详细的错误日志

### Requirement: JSON 响应解析
系统 SHALL 正确解析 AI 返回的 JSON 响应。

#### Scenario: 有效 JSON 响应
- **WHEN** AI 返回有效的 JSON 格式响应
- **THEN** 系统应正确解析 content 和 keywords 字段
- **AND** keywords 应验证并规范化每个关键词对象

#### Scenario: 无效 JSON 响应
- **WHEN** AI 返回无效的 JSON 格式
- **THEN** 系统应尝试修复常见的 JSON 格式问题
- **AND** 如果修复失败，应抛出明确的解析错误

## MODIFIED Requirements

### Requirement: AI 配置检查
系统 SHALL 提供可靠的 AI 配置检查机制。

原有实现可能存在配置检查不完整的问题，需要增强以下方面：
1. 检查 API Key 是否为空字符串
2. 检查 Provider 是否为有效值
3. 检查环境变量和本地存储配置的优先级

### Requirement: 错误信息本地化
系统 SHALL 提供中文错误信息。

所有面向用户的错误信息应使用中文，便于理解：
- "AI 服务未配置，请先在设置中配置 API Key"
- "生成学习资料失败: {错误详情}"
- "AI 请求超时，请检查网络连接"
