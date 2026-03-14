# 类型定义统一重构 Spec

## Why
当前 `api/types` 和 `src/types` 存在部分类型定义混乱的问题，特别是 `api/utils/nodeHelpers.ts` 从 `../../src/types` 导入类型，违反了模块边界原则。需要统一类型定义位置，确保共享类型集中在 `shared/types` 目录。

## What Changes
- 将 `api/types/ai.ts` 中的 AI 相关类型移至 `shared/types/ai.ts`
- 将 `src/types/api.ts` 中的 AIAction 相关类型移至 `shared/types/ai.ts`
- 修复 `api/utils/nodeHelpers.ts` 从 `../../src/types` 的错误导入，改为从 `@shared/types` 导入
- 更新所有相关文件的导入路径
- 删除 `api/types` 目录（如果不再需要）
- 删除 `src/types/api.ts`（内容已迁移）

## Impact
- Affected specs: 类型系统
- Affected code:
  - `api/types/ai.ts` - 迁移至 shared
  - `api/types/index.ts` - 删除
  - `api/utils/nodeHelpers.ts` - 修复导入路径
  - `src/types/api.ts` - 迁移至 shared
  - `src/types/index.ts` - 更新导出
  - 所有引用这些类型的文件

## ADDED Requirements

### Requirement: 共享 AI 类型定义
系统 SHALL 在 `shared/types/ai.ts` 中集中定义所有 AI 相关的共享类型。

#### Scenario: AI 类型共享
- **WHEN** 前端或后端需要使用 AI 相关类型
- **THEN** 应从 `@shared/types` 导入

### Requirement: API 层类型导入规范
系统 SHALL 确保 API 层不直接从前端 src 目录导入类型。

#### Scenario: API 类型导入
- **WHEN** API 层代码需要使用共享类型
- **THEN** 应从 `@shared/types` 导入，而非 `../../src/types`

### Requirement: 前端专用类型保留
系统 SHALL 将前端专用类型保留在 `src/types` 目录。

#### Scenario: 前端专用类型
- **WHEN** 类型仅在前端使用（如 calendar 相关）
- **THEN** 应保留在 `src/types` 目录并单独导出

## MODIFIED Requirements

### Requirement: 类型目录结构
类型定义 SHALL 按以下结构组织：
- `shared/types/` - 前后端共享类型
- `src/types/` - 前端专用类型
- ~~`api/types/`~~ - 移除，所有共享类型移至 shared

## REMOVED Requirements

### Requirement: API 专用类型目录
**Reason**: 类型应按共享/专用划分，而非按 API/前端划分
**Migration**: 将共享类型移至 `shared/types`
