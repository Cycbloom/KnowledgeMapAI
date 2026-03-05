# Playwright 测试执行第二轮 Spec

## Why
用户需要重新执行所有 Playwright 测试，按照特定策略分析超时问题，并生成详细的测试报告，以评估当前测试状态和识别需要修复的问题。

## What Changes
- 按模块顺序执行测试，使用单个测试进程和多个 worker
- 分析30秒超时设置导致的测试卡住问题
- 执行所有已编写的测试用例并记录结果
- 生成详细的测试执行报告，包括失败原因分析

## Impact
- Affected specs: 所有依赖 Playwright 测试的功能
- Affected code: tests/ 目录下的所有测试文件

## ADDED Requirements
### Requirement: 按模块顺序执行测试
系统 SHALL 按模块顺序执行测试，使用单个测试进程和多个 worker，避免创建多个独立的测试执行实例。

#### Scenario: 顺序执行测试
- **WHEN** 执行测试命令时
- **THEN** 测试按模块顺序执行，使用配置的 worker 数量

### Requirement: 超时问题分析
系统 SHALL 分析30秒超时设置导致的测试卡住问题，确定超时发生的具体测试用例和场景。

#### Scenario: 识别超时测试
- **WHEN** 测试执行时发生超时
- **THEN** 记录超时的测试用例、场景和原因

### Requirement: 测试结果报告
系统 SHALL 生成详细的测试执行报告，包括通过/失败数量、失败原因、截图，并区分测试代码问题和前端功能缺陷。

#### Scenario: 生成测试报告
- **WHEN** 所有测试执行完成
- **THEN** 生成包含详细信息的测试报告
