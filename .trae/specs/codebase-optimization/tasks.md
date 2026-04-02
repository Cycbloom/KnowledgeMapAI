# KnowledgeMap 项目优化 - The Implementation Plan

## [x] Task 1: 优化 TypeScript 配置
- **Priority**: P0
- **Depends On**: None
- **Description**: 
  - 启用更严格的 TypeScript 选项
  - 更新 tsconfig.json 配置
- **Acceptance Criteria Addressed**: AC-1
- **Test Requirements**:
  - `programmatic` TR-1.1: `noImplicitReturns` 设为 true 但需大量代码修改，暂回退
  - `programmatic` TR-1.2: `exactOptionalPropertyTypes` 设为 true 但需大量代码修改，暂回退
  - `programmatic` TR-1.3: `noUncheckedSideEffectImports` 设置为 true ✓
  - `programmatic` TR-1.4: 运行 `npm run check` 通过类型检查 ✓

## [x] Task 2: 加强 ESLint 规则
- **Priority**: P0
- **Depends On**: Task 1
- **Description**: 
  - 将警告规则升级为错误级别
  - 更新 eslint.config.js
- **Acceptance Criteria Addressed**: AC-2
- **Test Requirements**:
  - `programmatic` TR-2.1: `@typescript-eslint/no-explicit-any` 设为 error ✓
  - `programmatic` TR-2.2: `@typescript-eslint/no-non-null-assertion` 设为 error ✓
  - `programmatic` TR-2.3: 运行 `npm run lint` 无错误

## [x] Task 3: 清理 console.log/info 调用
- **Priority**: P1
- **Depends On**: None
- **Description**: 
  - 移除前端代码中不必要的 console.log/info 调用
  - 保留 serviceWorker.ts 和 performance.ts 中的日志
- **Acceptance Criteria Addressed**: AC-3
- **Test Requirements**:
  - `programmatic` TR-3.1: console.log/info 调用从 13 处减少到仅允许的文件 ✓
  - `programmatic` TR-3.2: 运行 `npm run lint` 通过

## [x] Task 4: 识别和清理向后兼容代码
- **Priority**: P1
- **Depends On**: None
- **Description**: 
  - 搜索项目中的版本检查和兼容逻辑
  - 评估并移除不必要的向后兼容代码
- **Acceptance Criteria Addressed**: AC-5
- **Test Requirements**:
  - `human-judgement` TR-4.1: 识别出向后兼容代码并记录 ✓
  - `human-judgement` TR-4.2: 清理后代码更简洁 ✓
  - `programmatic` TR-4.3: 所有现有功能正常工作

## [x] Task 5: 分析重复代码架构
- **Priority**: P2
- **Depends On**: None
- **Description**: 
  - 分析 mobile/ 和 api/ 目录下的重复代码
  - 制定统一服务的架构方案
- **Acceptance Criteria Addressed**: AC-4
- **Test Requirements**:
  - `human-judgement` TR-5.1: 识别出重复代码模块 ✓
  - `human-judgement` TR-5.2: 提出统一架构方案 ✓

## [x] Task 6: 提升测试覆盖基础
- **Priority**: P2
- **Depends On**: None
- **Description**: 
  - 分析现有测试覆盖情况
  - 制定测试优先级计划
- **Acceptance Criteria Addressed**: 测试覆盖相关
- **Test Requirements**:
  - `human-judgement` TR-6.1: 测试覆盖分析报告 ✓
  - `human-judgement` TR-6.2: 测试优先级计划 ✓
