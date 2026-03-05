# 继续修复被跳过的 Playwright 测试 Spec

## Why
之前的修复工作已经完成了登录、注册、设置页面、个人资料和主题切换模块的修复，测试覆盖率从 119 个（34.8%）提高到了约 150 个（43.9%）。

剩余需要修复的模块包括：
1. **Dashboard 模块**（12个跳过）：创建图谱、删除图谱、收藏图谱、搜索和筛选功能
2. **图谱编辑器模块**（17个跳过）：图谱编辑器页面导航问题
3. **学习模式模块**（48个跳过）：学习模式页面导航问题
4. **任务调度器模块**（19个跳过）：任务调度器页面导航问题
5. **成就系统模块**（4个跳过）：成就系统页面导航问题
6. **跨模块集成测试**（6个跳过）：跨模块导航和状态同步问题
7. **Dashboard 分享功能**（4个跳过）：分享菜单功能

## What Changes
- 逐个分析每个模块的具体问题
- 修改前端代码以修复页面导航和功能逻辑
- 恢复被跳过的测试用例
- 验证所有测试通过

## Impact
- Affected specs: 将测试覆盖率从 43.9% 提高到接近 100%
- Affected code: Dashboard 页面、图谱编辑器页面、学习模式页面、任务调度器页面、成就系统页面、路由配置

## ADDED Requirements

### Requirement: 修复 Dashboard 创建图谱功能
The system SHALL allow users to create new graphs successfully.

#### Scenario: Success case
- **WHEN** user fills in graph title and description
- **THEN** system should create the graph
- **AND** graph should appear in the graph list
- **AND** creation modal should close

### Requirement: 修复 Dashboard 删除图谱功能
The system SHALL allow users to delete graphs.

#### Scenario: Success case
- **WHEN** user clicks delete button on a graph card
- **THEN** system should delete the graph
- **AND** graph should be removed from the list

### Requirement: 修复 Dashboard 收藏图谱功能
The system SHALL allow users to favorite/unfavorite graphs.

#### Scenario: Success case
- **WHEN** user clicks favorite button on a graph card
- **THEN** system should toggle favorite status
- **AND** favorite icon should update

### Requirement: 修复图谱编辑器导航
The system SHALL allow users to navigate to graph editor page.

#### Scenario: Success case
- **WHEN** user clicks on a graph card
- **THEN** system should navigate to graph editor page
- **AND** graph editor should load successfully

### Requirement: 修复学习模式导航
The system SHALL allow users to navigate to study mode page.

#### Scenario: Success case
- **WHEN** user clicks study button in navigation
- **THEN** system should navigate to study mode page
- **AND** study mode should load successfully

### Requirement: 修复任务调度器导航
The system SHALL allow users to navigate to scheduler page.

#### Scenario: Success case
- **WHEN** user clicks scheduler button in navigation
- **THEN** system should navigate to scheduler page
- **AND** scheduler should load successfully

### Requirement: 修复成就系统导航
The system SHALL allow users to navigate to achievements page.

#### Scenario: Success case
- **WHEN** user clicks achievements button in navigation
- **THEN** system should navigate to achievements page
- **AND** achievements should load successfully

### Requirement: 修复跨模块集成测试
The system should maintain state consistency across different modules.

#### Scenario: Success case
- **WHEN** user navigates between different modules
- **THEN** state should be maintained
- **AND** data should be synchronized

### Requirement: 修复 Dashboard 分享功能
The system should allow users to share graphs (if feature exists).

#### Scenario: Success case
- **WHEN** user clicks share button on a graph card
- **THEN** share menu should open
- **AND** user should be able to get share link

## MODIFIED Requirements
### Requirement: 恢复被跳过的测试用例
Remove `test.skip()` from skipped test cases and make them pass.

#### Scenario: Success case
- **WHEN** all test fixes are implemented
- **THEN** previously skipped tests should pass
- **AND** test coverage should increase significantly

## REMOVED Requirements
None
