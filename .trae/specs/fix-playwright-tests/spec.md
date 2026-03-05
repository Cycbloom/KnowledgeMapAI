# 修复 Playwright 测试 Spec

## Why
当前 Playwright 测试用例已经编写完成，但运行时存在多个测试失败的情况。测试失败可能由于前端代码问题、测试数据问题或测试用例本身的问题。需要系统性地运行测试、分析失败原因并修复所有问题。

## What Changes
- 运行所有 Playwright 测试并识别失败的测试用例
- 分析每个失败测试的根本原因
- 修复前端代码以通过测试
- 修复测试用例中的问题（如选择器、超时设置等）
- 优化测试配置以减少超时和资源占用
- 确保所有测试最终通过

## Impact
- Affected specs: playwright-test-enhancement
- Affected code: tests/, src/components/, src/pages/

## ADDED Requirements
### Requirement: 测试修复
系统 SHALL 确保所有 Playwright 测试用例能够成功通过。

#### Scenario: 运行测试并修复
- **WHEN** 运行 `npx playwright test`
- **THEN** 所有测试用例应该通过，没有失败或超时

#### Scenario: 按模块运行测试
- **WHEN** 按模块运行测试（如 `--grep="登录"`）
- **THEN** 该模块的所有测试应该通过

## MODIFIED Requirements
### Requirement: 测试超时配置
测试超时时间应该根据实际需要合理配置，避免因超时导致的测试失败。

## REMOVED Requirements
无
