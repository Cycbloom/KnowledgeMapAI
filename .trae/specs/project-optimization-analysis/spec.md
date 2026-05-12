# 项目优化分析 Spec

## Why
KnowledgeMap 项目经过长期开发，在性能和代码质量方面存在一些可优化点。通过针对性优化，可以提升应用性能和改善代码可维护性。

## What Changes
- **性能优化**：减少前端日志输出、优化组件渲染、改进缓存策略
- **代码质量**：减少代码重复、优化错误处理
- **开发体验**：完善核心模块文档

## Impact
- Affected specs: 前端性能、缓存机制
- Affected code: 
  - `src/` 目录下的组件和 hooks
  - `api/services/` 目录下的服务文件

## ADDED Requirements

### Requirement: 前端日志规范优化
系统应严格遵守前端日志规范，禁止使用 `console.log/info`，仅允许 `console.warn/error`。

#### Scenario: 移除违规日志
- **WHEN** 执行代码检查
- **THEN** 前端代码中不应存在 `console.log` 或 `console.info` 调用
- **AND** 所有调试日志应使用条件编译或开发环境判断

### Requirement: 组件性能优化
大型组件应拆分为更小的、可复用的子组件，并优化渲染性能。

#### Scenario: GraphMapCanvas 组件拆分
- **WHEN** 组件代码超过 300 行
- **THEN** 应拆分为多个子组件
- **AND** 使用 `React.memo` 优化不必要的重渲染
- **AND** 使用 `useMemo` 和 `useCallback` 优化计算和回调

### Requirement: 缓存策略优化
系统应优化缓存策略，减少不必要的数据库查询和 API 调用。

#### Scenario: 图谱数据缓存
- **WHEN** 用户访问图谱列表
- **THEN** 应使用缓存避免重复查询
- **AND** 缓存应在数据变更时自动失效
- **AND** 支持缓存预热和懒加载

### Requirement: 代码重复消除
系统应消除重复代码，提取公共逻辑为可复用函数或类。

#### Scenario: Fallback 函数模式
- **WHEN** 多个服务有相似的 fallback 逻辑
- **THEN** 应提取为通用的 fallback 工具函数
- **AND** 保持一致的错误处理模式

### Requirement: 核心模块文档完善
核心模块应有清晰的文档说明，便于理解和维护。

#### Scenario: JSDoc 注释
- **WHEN** 编写核心服务或工具函数
- **THEN** 应添加 JSDoc 注释说明功能和参数
- **AND** 复杂逻辑应有行内注释解释
