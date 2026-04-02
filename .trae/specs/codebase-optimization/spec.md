# KnowledgeMap 项目优化 - Product Requirement Document

## Overview
- **Summary**: 系统性优化 KnowledgeMap 项目，提升代码质量、性能和可维护性，清理不必要的向后兼容代码
- **Purpose**: 解决技术债务，提升开发效率和用户体验，减少维护成本
- **Target Users**: 开发团队、维护者和终端用户

## Goals
- 提升 TypeScript 类型安全性
- 清理不必要的向后兼容代码
- 提升测试覆盖率
- 优化代码质量和性能
- 完善 CI/CD 流程
- 简化架构，减少重复代码

## Non-Goals (Out of Scope)
- 不添加新的用户功能
- 不重构核心业务逻辑（除非必要）
- 不破坏现有功能

## Background & Context
项目经过多轮迭代开发，积累了技术债务：
- 存在大量 `any` 类型使用（322 处/93 个文件）
- 存在 console.log/info 调用（13 处）
- TypeScript 配置不够严格
- 测试覆盖率不足
- 存在重复的 API 服务（Web、Electron、移动端）
- 有不必要的向后兼容代码

## Functional Requirements
- **FR-1**: 清理不必要的向后兼容代码
- **FR-2**: 优化 TypeScript 配置，启用更严格的检查
- **FR-3**: 加强 ESLint 规则，将警告升级为错误
- **FR-4**: 清理 console.log/info 调用
- **FR-5**: 重构重复代码，统一 API 服务

## Non-Functional Requirements
- **NFR-1**: 所有优化不影响现有功能正常运行
- **NFR-2**: 构建时间不显著增加
- **NFR-3**: 代码可维护性显著提升

## Constraints
- **Technical**: 保持与现有 Supabase、Electron、Capacitor 集成
- **Business**: 优化需在现有功能稳定的前提下进行
- **Dependencies**: React 18、TypeScript 5.8、Vite 6

## Assumptions
- 项目用户主要使用最新版本，无需过度兼容旧版本
- 可以接受适度的破坏性变更来提升代码质量
- 测试可以验证功能的正确性

## Acceptance Criteria

### AC-1: TypeScript 严格模式
- **Given**: 项目的 TypeScript 配置
- **When**: 启用严格模式选项
- **Then**: `noImplicitReturns`、`exactOptionalPropertyTypes`、`noUncheckedSideEffectImports` 设为 true
- **Verification**: `programmatic`

### AC-2: ESLint 规则升级
- **Given**: ESLint 配置
- **When**: 将警告规则升级为错误
- **Then**: `@typescript-eslint/no-explicit-any`、`@typescript-eslint/no-non-null-assertion` 设为 error
- **Verification**: `programmatic`

### AC-3: Console 日志清理
- **Given**: 前端代码中的 console.log/info
- **When**: 清理不必要的日志
- **Then**: 除特殊文件外，移除所有 console.log/info 调用
- **Verification**: `programmatic`

### AC-4: 重复代码重构
- **Given**: 项目中的 API 服务
- **When**: 统一服务架构
- **Then**: 减少 mobile/ 和 api/ 目录下的重复代码
- **Verification**: `human-judgment`

### AC-5: 向后兼容代码清理
- **Given**: 项目中的旧版本兼容代码
- **When**: 识别并清理
- **Then**: 移除不必要的版本检查和兼容逻辑
- **Verification**: `human-judgment`

## Open Questions
- [ ] 确定需要保留的最低兼容版本
- [ ] 确认哪些重复代码可以安全重构
- [ ] 评估测试覆盖范围的优先级
