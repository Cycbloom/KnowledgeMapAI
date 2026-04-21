# 修复关键词语言本地化 Spec

## Why
在英文模式下生成学习资料时，关键词（term、category、explanation）仍然输出中文。根本原因是多处代码存在硬编码中文，且移动端完全不支持语言参数传递。

## What Changes
- 修复服务端 aiService 中关键词 category 的硬编码中文回退值，改为根据语言参数动态选择
- 修复服务端 aiService 中 Mock 响应的硬编码中文，改为根据语言参数动态生成
- 修复移动端 aiService 中 `LEARNING_MATERIAL_SYSTEM_PROMPT` 的硬编码中文，改为根据语言参数动态生成 prompt
- 修复移动端 aiService 中 `generateLearningMaterial` 方法，增加 `language` 参数支持
- 修复移动端 API 层 `generateLearningMaterial` 的 data 类型，增加 `language` 字段并正确传递

## Impact
- Affected code: `api/services/ai/aiService.ts`, `src/services/mobile/aiService.ts`, `src/services/mobile/ai.ts`
- Affected features: 学习资料生成、关键词提取

## ADDED Requirements

### Requirement: 关键词字段语言一致性
系统 SHALL 在生成学习资料关键词时，确保所有字段（term、category、explanation）的语言与用户选择的语言设置一致。

#### Scenario: 英文模式下生成关键词
- **WHEN** 用户选择英文模式并生成学习资料
- **THEN** 所有关键词的 term、category、explanation 字段必须为英文
- **AND** category 的回退值应为 "Concept" 而非 "概念"

#### Scenario: 中文模式下生成关键词
- **WHEN** 用户选择中文模式并生成学习资料
- **THEN** 所有关键词的 term、category、explanation 字段必须为中文
- **AND** category 的回退值应为 "概念"

### Requirement: 移动端语言参数传递
移动端 aiService 和 API 层 SHALL 支持 language 参数，并将其正确传递到 prompt 生成流程中。

#### Scenario: 移动端英文模式
- **WHEN** 移动端用户选择英文模式并生成学习资料
- **THEN** language 参数应从前端传递到移动端 aiService
- **AND** 生成的 prompt 应包含英文语言指令
- **AND** 关键词类别选项应为英文

## MODIFIED Requirements

### Requirement: 服务端 aiService 关键词回退逻辑
服务端 aiService 的关键词 category 回退值 SHALL 根据语言参数动态选择：
- 英文模式：回退值为 "Concept"
- 中文模式：回退值为 "概念"

### Requirement: 移动端 LEARNING_MATERIAL_SYSTEM_PROMPT
移动端 `LEARNING_MATERIAL_SYSTEM_PROMPT` SHALL 根据语言参数动态生成：
- 英文模式：使用英文 prompt 模板，关键词类别选项为英文，末尾追加 "Please respond in English."
- 中文模式：使用中文 prompt 模板，关键词类别选项为中文，末尾追加 "请用中文回答。"

### Requirement: 移动端 generateLearningMaterial 方法签名
移动端 `generateLearningMaterial` 方法的 options 参数 SHALL 增加 `language?: string` 字段。

### Requirement: 移动端 API 层 language 传递
移动端 API 层的 `generateLearningMaterial` 函数 SHALL 在 data 类型中增加 `language?: string` 字段，并在调用本地服务和 API 时正确传递。
