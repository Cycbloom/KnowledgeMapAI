# 学习模块和前端功能修复 Spec

## Why
根据 Playwright 测试执行报告，学习模块有大量测试失败（100+），部分前端功能尚未实现（学习统计卡片、题库管理标签页等），React Flow 渲染性能需要优化以提升测试稳定性。

## What Changes
- 修复学习模块的选择器问题和超时问题
- 实现缺失的前端功能组件
- 优化 React Flow 渲染性能
- 改进测试等待策略

## Impact
- Affected specs: 学习模式测试、图谱编辑器测试
- Affected code: tests/study.spec.ts, tests/pages/StudyPage.ts, src/components/, src/pages/

## ADDED Requirements
### Requirement: 学习模块测试修复
系统 SHALL 修复学习模块的所有失败测试，确保测试能够稳定运行。

#### Scenario: 修复选择器问题
- **WHEN** 测试选择器无法找到元素
- **THEN** 使用更稳定的选择器（data-testid、role）并增加适当的等待时间

#### Scenario: 修复超时问题
- **WHEN** 测试因为元素不可见或不可点击而超时
- **THEN** 优化等待策略，使用 waitForSelector 和 waitForFunction 替代固定等待时间

### Requirement: 前端功能实现
系统 SHALL 实现测试所需的前端功能组件。

#### Scenario: 实现学习统计卡片
- **WHEN** 用户访问学习页面
- **THEN** 应显示学习统计卡片（总卡片、已掌握、待复习、连续学习天数、本周学习时间）

#### Scenario: 实现题库管理标签页
- **WHEN** 用户在学习页面点击题库管理标签
- **THEN** 应显示题库管理界面

#### Scenario: 实现薄弱知识点区域
- **WHEN** 用户查看学习统计
- **THEN** 应显示薄弱知识点区域

### Requirement: React Flow 性能优化
系统 SHALL 优化 React Flow 渲染性能，减少节点和边的渲染延迟。

#### Scenario: 节点渲染优化
- **WHEN** 创建或更新节点
- **THEN** 节点应在合理时间内（<2秒）渲染到画布上

#### Scenario: 边渲染优化
- **WHEN** 创建或更新边
- **THEN** 边应在合理时间内（<2秒）渲染到画布上

## MODIFIED Requirements
### Requirement: 测试等待策略
改进测试等待策略，使用更智能的等待方法替代固定等待时间。

## REMOVED Requirements
无
