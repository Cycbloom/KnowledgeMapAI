# 统一 AI 语言上下文管理 Spec

## Why
项目中存在多处重复的 `getCurrentLanguage` / `getCurrentAILanguage` 函数实现（至少 3 处），违反 DRY 原则，维护成本高，且容易出现不一致。需要统一管理 AI 语言设置，提供一致的接口。

## What Changes
- 创建统一的 `useAILanguage` Hook，封装 AI 语言获取逻辑
- 创建 `AILanguageContext` 提供全局 AI 语言状态管理
- 重构所有使用 `getCurrentLanguage` / `getCurrentAILanguage` 的地方，统一使用新 Hook
- 提供工具函数供非 React 组件使用

## Impact
- Affected code:
  - `src/services/api/ai.ts`
  - `src/services/api/autoGraph.ts`
  - `src/services/mobile/ai.ts`
  - `src/pages/LearningMode.tsx`（可简化）
- Affected features: 所有 AI 生成功能（学习材料、知识图谱、卡片等）

## ADDED Requirements

### Requirement: 统一的 AI 语言管理 Hook
系统 SHALL 提供 `useAILanguage` Hook，封装 AI 语言获取和判断逻辑。

#### Scenario: 获取当前 AI 语言
- **WHEN** 组件调用 `useAILanguage()`
- **THEN** 返回当前 AI 语言设置（'zh-CN' | 'en-US'）
- **AND** 自动处理 'auto' 模式，根据界面语言返回对应值

#### Scenario: 判断是否英文模式
- **WHEN** 组件调用 `useAILanguage().isEnglish`
- **THEN** 返回布尔值表示当前是否为英文模式

### Requirement: 非组件环境下的语言获取
系统 SHALL 提供 `getAILanguage()` 工具函数，供非 React 组件（如 API 服务层）使用。

#### Scenario: API 服务层获取语言
- **WHEN** API 服务调用 `getAILanguage()`
- **THEN** 返回当前 AI 语言设置
- **AND** 行为与 Hook 版本一致

### Requirement: 语言判断工具函数
系统 SHALL 提供 `isEnglishLanguage(language?: string)` 工具函数，统一判断语言是否为英文。

#### Scenario: 判断语言代码
- **WHEN** 调用 `isEnglishLanguage('en-US')`
- **THEN** 返回 `true`

- **WHEN** 调用 `isEnglishLanguage('zh-CN')`
- **THEN** 返回 `false`

- **WHEN** 调用 `isEnglishLanguage(undefined)`
- **THEN** 返回 `false`（默认中文）

## MODIFIED Requirements

### Requirement: API 服务层语言获取
`src/services/api/ai.ts` 和 `src/services/api/autoGraph.ts` SHALL 使用统一的 `getAILanguage()` 函数，删除重复的 `getCurrentLanguage` / `getCurrentAILanguage` 函数。

### Requirement: 移动端服务层语言获取
`src/services/mobile/ai.ts` SHALL 使用统一的 `getAILanguage()` 函数，删除重复的 `getCurrentLanguage` 函数。

### Requirement: React 组件语言获取
React 组件（如 `LearningMode.tsx`）SHALL 使用 `useAILanguage()` Hook 获取语言，简化代码逻辑。

## REMOVED Requirements

### Requirement: 分散的语言判断函数
**Reason**: 代码重复，维护困难
**Migration**: 统一使用新的 `useAILanguage` Hook 和 `getAILanguage` 工具函数
