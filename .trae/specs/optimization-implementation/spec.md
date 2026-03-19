# 项目优化实施 - Product Requirement Document

## Overview
- **Summary**: 基于之前的项目优化分析，实施具体的代码质量、性能、测试覆盖和架构改进工作
- **Purpose**: 解决分析中发现的关键问题，提升代码可维护性、性能和测试覆盖率
- **Target Users**: 开发团队

## Goals
- 修复严重的代码质量问题（特别是 `updateTaskStatus` 方法）
- 优化关键性能瓶颈
- 补充核心模块的测试覆盖
- 实施架构改进
- 清理临时代码和调试日志

## Non-Goals (Out of Scope)
- 重写整个应用
- 添加新功能
- 修改核心业务逻辑
- 更换主要技术栈

## Background & Context
基于之前的分析，项目存在以下关键问题需要优先解决：
1. `api/services/taskService.ts` 中的 `updateTaskStatus` 方法存在严重的参数处理混乱问题
2. `getGraphNodes` 缺少缓存
3. 缺少关键的数据库索引
4. useStore 未使用 select 函数
5. 核心模块缺少测试覆盖

## Functional Requirements
- **FR-1**: 重构 `updateTaskStatus` 方法，改善代码质量
- **FR-2**: 添加关键数据库索引
- **FR-3**: 修复 `getGraphNodes` 缓存问题
- **FR-4**: 优化 useStore 使用
- **FR-5**: 补充认证和图服务的测试

## Non-Functional Requirements
- **NFR-1**: 所有修改必须保持现有功能完整性
- **NFR-2**: 代码必须通过现有 lint 和 typecheck
- **NFR-3**: 所有现有测试必须通过

## Constraints
- **Technical**: 保持现有技术栈
- **Business**: 优化不应影响用户正常使用
- **Dependencies**: 依赖现有测试和构建工具

## Assumptions
- 开发团队有时间进行优化工作
- 可以分阶段实施优化
- 有 Supabase 访问权限来执行 SQL

## Acceptance Criteria

### AC-1: updateTaskStatus 重构完成
- **Given**: 重构前的代码
- **When**: 完成重构
- **Then**: 方法使用对象参数模式，代码清晰易读
- **Verification**: `programmatic`
- **Notes**: 保持向后兼容

### AC-2: 数据库索引添加完成
- **Given**: 当前数据库 schema
- **When**: 执行索引添加 SQL
- **Then**: 关键查询性能提升
- **Verification**: `human-judgment`

### AC-3: getGraphNodes 缓存修复完成
- **Given**: 当前无缓存的实现
- **When**: 添加缓存逻辑
- **Then**: 重复查询从缓存返回
- **Verification**: `programmatic`

### AC-4: useStore 优化完成
- **Given**: 当前直接获取整个状态
- **When**: 改用 select 函数
- **Then**: 减少不必要的组件重渲染
- **Verification**: `human-judgment`

### AC-5: 核心测试补充完成
- **Given**: 当前测试覆盖
- **When**: 添加新的测试文件
- **Then**: 认证和图服务有基本测试覆盖
- **Verification**: `programmatic`

## Open Questions
- [ ] 是否需要更激进的优化？
