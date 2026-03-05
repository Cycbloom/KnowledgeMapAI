# Playwright 测试拆分规范

## Why

当前项目有 1000+ 个测试用例，一次完整测试耗时过长，影响开发效率和 CI/CD 效率。按模块拆分测试可以：
- 按需运行特定模块的测试，节省时间
- 支持 CI/CD 并行执行，加速测试流程
- 方便开发时只运行相关模块的测试

## What Changes

### 测试模块拆分

根据现有测试文件结构，将测试拆分为以下模块：

| 模块 | 测试文件 | 预估用例数 | 描述 |
|------|---------|-----------|------|
| auth | login.spec.ts, login-pom.spec.ts, register.spec.ts | ~105 | 认证相关（登录、注册） |
| dashboard | dashboard.spec.ts | ~70 | Dashboard 页面 |
| study | study.spec.ts | ~60 | 学习模式 |
| graph | graph-editor.spec.ts | ~20 | 图谱编辑器 |
| settings | settings.spec.ts | ~50 | 设置页面 |
| profile | profile.spec.ts | ~20 | 个人资料 |
| scheduler | scheduler.spec.ts | ~20 | 任务调度器（已跳过） |
| achievements | achievements.spec.ts | ~40 | 成就系统（已跳过） |
| integration | integration.spec.ts | ~15 | 跨模块集成测试（已跳过） |

### 配置文件变更

创建以下 Playwright 配置文件：

1. `playwright.config.ts` - 主配置（运行所有测试）
2. `playwright.config.auth.ts` - 认证模块测试
3. `playwright.config.dashboard.ts` - Dashboard 模块测试
4. `playwright.config.study.ts` - 学习模式测试
5. `playwright.config.graph.ts` - 图谱编辑器测试
6. `playwright.config.settings.ts` - 设置页面测试
7. `playwright.config.profile.ts` - 个人资料测试
8. `playwright.config.scheduler.ts` - 任务调度器测试
9. `playwright.config.achievements.ts` - 成就系统测试
10. `playwright.config.integration.ts` - 集成测试

### package.json 脚本变更

添加以下 npm 脚本：

```json
{
  "scripts": {
    "test": "npx playwright test",
    "test:auth": "npx playwright test --config=playwright.config.auth.ts",
    "test:dashboard": "npx playwright test --config=playwright.config.dashboard.ts",
    "test:study": "npx playwright test --config=playwright.config.study.ts",
    "test:graph": "npx playwright test --config=playwright.config.graph.ts",
    "test:settings": "npx playwright test --config=playwright.config.settings.ts",
    "test:profile": "npx playwright test --config=playwright.config.profile.ts",
    "test:scheduler": "npx playwright test --config=playwright.config.scheduler.ts",
    "test:achievements": "npx playwright test --config=playwright.config.achievements.ts",
    "test:integration": "npx playwright test --config=playwright.config.integration.ts",
    "test:quick": "npx playwright test --config=playwright.config.auth.ts --config=playwright.config.dashboard.ts"
  }
}
```

## Impact

- Affected specs: 无
- Affected code: 
  - `playwright.config.ts` - 更新主配置
  - 新增 9 个模块配置文件
  - `package.json` - 添加测试脚本

## ADDED Requirements

### Requirement: 模块化测试配置

系统 SHALL 提供按模块拆分的 Playwright 测试配置，允许独立运行特定模块的测试。

#### Scenario: 运行认证模块测试
- **WHEN** 开发者执行 `npm run test:auth`
- **THEN** 只运行 login.spec.ts, login-pom.spec.ts, register.spec.ts 测试文件

#### Scenario: 运行学习模块测试
- **WHEN** 开发者执行 `npm run test:study`
- **THEN** 只运行 study.spec.ts 测试文件

#### Scenario: 运行所有测试
- **WHEN** 开发者执行 `npm run test`
- **THEN** 运行所有测试文件

### Requirement: 测试配置文件结构

每个模块配置文件 SHALL 包含：
- 继承主配置的通用设置
- 指定模块的测试文件路径
- 合理的浏览器项目配置

#### Scenario: 配置文件继承
- **WHEN** 查看模块配置文件
- **THEN** 配置应继承主配置的基础设置（baseURL、timeout 等）

### Requirement: CI/CD 支持

测试配置 SHALL 支持 CI/CD 环境的并行执行。

#### Scenario: CI 环境运行
- **WHEN** 在 CI 环境执行测试
- **THEN** 可以并行运行多个模块的测试

## MODIFIED Requirements

无

## REMOVED Requirements

无
