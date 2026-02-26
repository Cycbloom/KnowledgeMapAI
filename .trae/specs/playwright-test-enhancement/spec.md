# Playwright 网页测试增强 Spec

## Why
当前项目只有登录页面的测试用例，需要验证现有测试是否正常工作，并扩展测试覆盖范围，同时配置 gitignore 忽略测试输出文件。

## What Changes
- 验证现有登录测试是否正常工作
- 配置 .gitignore 添加 Playwright 测试输出目录
- 添加注册页面测试用例
- 添加 Dashboard 页面测试用例
- 创建对应的 Page Object Model 类

## Impact
- Affected specs: 测试覆盖范围
- Affected code: `tests/` 目录, `.gitignore`

## ADDED Requirements

### Requirement: 测试验证
系统 SHALL 能够正常运行现有的登录测试用例。

#### Scenario: 运行现有测试
- **WHEN** 执行 `npx playwright test` 命令
- **THEN** 所有现有登录测试用例应该通过

### Requirement: Gitignore 配置
系统 SHALL 忽略 Playwright 测试输出文件。

#### Scenario: 测试输出文件
- **WHEN** 运行测试生成输出文件
- **THEN** 以下目录应被 git 忽略:
  - `test-results/` - 测试结果目录
  - `playwright-report/` - HTML 测试报告
  - `playwright/.cache/` - Playwright 缓存

### Requirement: 注册页面测试
系统 SHALL 提供注册页面的完整测试覆盖。

#### Scenario: 注册页面显示
- **WHEN** 用户访问注册页面
- **THEN** 应该显示姓名、邮箱、密码输入框和注册按钮

#### Scenario: 成功注册
- **WHEN** 用户填写有效信息并提交
- **THEN** 应该成功注册并跳转到 Dashboard

#### Scenario: 注册错误处理
- **WHEN** 用户填写已存在的邮箱
- **THEN** 应该显示错误信息

### Requirement: Dashboard 页面测试
系统 SHALL 提供 Dashboard 页面的核心功能测试。

#### Scenario: Dashboard 页面显示
- **WHEN** 登录用户访问 Dashboard
- **THEN** 应该显示图谱列表、创建按钮、搜索框等元素

#### Scenario: 创建新图谱
- **WHEN** 用户点击新建图谱并填写信息
- **THEN** 应该成功创建图谱并显示在列表中

#### Scenario: 搜索功能
- **WHEN** 用户在搜索框输入关键词
- **THEN** 应该显示匹配的搜索结果

#### Scenario: 主题切换
- **WHEN** 用户切换主题
- **THEN** 页面应该在亮色和暗色模式之间切换
