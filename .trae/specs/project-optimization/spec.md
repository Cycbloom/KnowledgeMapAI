# 项目优化建议 Spec

## Why
项目经过多轮迭代开发，存在一些技术债务和可改进的地方，包括测试覆盖率不足、代码质量问题、TypeScript 配置不够严格、CI/CD 流程不完善等。通过系统性优化，可以提升代码质量、开发效率和用户体验。

## What Changes
- 提升测试覆盖率（单元测试和 E2E 测试）
- 清理代码中的 console 日志调用
- 减少 `any` 类型的使用
- 加强 TypeScript 严格模式配置
- 完善 CI/CD 流程
- 优化性能监控

## Impact
- Affected specs: 代码质量、测试、CI/CD
- Affected code: 全项目范围

## ADDED Requirements

### Requirement: 测试覆盖率提升
系统 SHALL 具有足够的测试覆盖率以确保代码质量。

#### Scenario: 单元测试覆盖核心模块
- **WHEN** 运行 `npm test` 时
- **THEN** 核心业务逻辑模块（hooks、services、utils）应有测试覆盖

#### Scenario: E2E 测试覆盖关键流程
- **WHEN** 运行 E2E 测试时
- **THEN** 登录、图谱编辑、学习模式等关键流程应有测试覆盖

### Requirement: 代码日志规范化
系统 SHALL 使用统一的日志系统而非 console 直接调用。

#### Scenario: 前端日志统一
- **WHEN** 需要记录日志时
- **THEN** 应使用统一的 logger 工具或移除不必要的日志

#### Scenario: 后端日志统一
- **WHEN** 后端需要记录日志时
- **THEN** 应使用 `api/utils/logger.ts` 提供的 Logger 类

### Requirement: TypeScript 类型安全
系统 SHALL 尽量避免使用 `any` 类型以提高类型安全性。

#### Scenario: 减少 any 类型使用
- **WHEN** 编写新代码时
- **THEN** 应使用具体类型或泛型替代 `any`

#### Scenario: 启用更严格的 TypeScript 选项
- **WHEN** 进行类型检查时
- **THEN** 应启用 `noImplicitReturns`、`noImplicitOverride` 等选项

### Requirement: CI/CD 流程完善
系统 SHALL 在 CI/CD 中包含完整的构建和测试流程。

#### Scenario: Electron 构建验证
- **WHEN** 提交代码时
- **THEN** CI 应验证 Electron 构建是否成功

#### Scenario: 安全审计
- **WHEN** 运行 CI 时
- **THEN** 应包含依赖安全检查步骤

## MODIFIED Requirements

### Requirement: ESLint 规则加强
原有 ESLint 配置中的警告规则应升级为错误级别。

**变更内容：**
- `@typescript-eslint/no-explicit-any`: `warn` → `error`
- `@typescript-eslint/no-non-null-assertion`: `warn` → `error`

### Requirement: 移动端测试验证
移动端统一 API 的 checklist 中有 5 项需要实际设备测试的任务未完成。

**变更内容：**
- 添加移动端测试任务到 CI/CD 流程
- 或在文档中明确标注需要手动测试的项目

## REMOVED Requirements

### Requirement: 无移除项
本次优化不涉及功能移除。

## 当前状态分析

### 测试覆盖情况
| 类型 | 文件数 | 状态 |
|------|--------|------|
| 单元测试 | 5 | 不足 |
| E2E 测试 | 3 | 不足 |
| API 测试 | 3 | 基本覆盖 |

### 代码质量问题
| 问题 | 数量 | 严重程度 |
|------|------|----------|
| console.log 调用（前端） | 364处/100文件 | 中 |
| console.log 调用（后端） | 41处/15文件 | 中 |
| any 类型使用 | 100文件 | 高 |
| TODO/FIXME 注释 | 3处 | 低 |

### TypeScript 配置建议
```json
{
  "noImplicitReturns": true,
  "noImplicitOverride": true,
  "exactOptionalPropertyTypes": true
}
```

### CI/CD 改进建议
1. 添加 Electron 构建验证步骤
2. 添加移动端构建验证步骤
3. 添加依赖安全审计（npm audit）
4. 添加构建产物大小监控
