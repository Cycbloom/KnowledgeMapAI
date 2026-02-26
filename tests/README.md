# Playwright 自动化测试配置指南

## 概述

本项目已配置完整的 Playwright 自动化测试环境，包括登录功能的测试用例。

## 配置文件

### 1. Playwright 配置文件
- **位置**: `playwright.config.ts`
- **功能**: 配置测试环境、浏览器、报告等

### 2. 环境变量配置
在 `.env` 文件中添加测试账号信息：

```env
# Test Account Configuration
TEST_USER_EMAIL=test@example.com
TEST_USER_PASSWORD=test123456
```

## 测试文件结构

```
tests/
├── login.spec.ts              # 基础登录测试
├── login-pom.spec.ts          # Page Object Model 模式登录测试
├── pages/
│   └── LoginPage.ts           # 登录页面对象
└── utils/
    └── testHelpers.ts         # 测试辅助函数
```

## 测试用例

### 基础测试 (login.spec.ts)

1. **应该显示登录页面** - 验证页面元素是否正确显示
2. **应该能够成功登录** - 测试正常登录流程
3. **应该显示登录错误信息** - 测试错误处理
4. **应该验证必填字段** - 测试表单验证
5. **应该能够导航到注册页面** - 测试页面导航
6. **应该支持主题切换** - 测试主题切换功能

### POM 测试 (login-pom.spec.ts)

使用 Page Object Model 模式编写的相同测试用例，更易于维护。

## 运行测试

### 运行所有测试
```bash
npx playwright test
```

### 运行特定浏览器测试
```bash
npx playwright test --project=chromium
npx playwright test --project=firefox
npx playwright test --project=webkit
```

### 运行特定测试
```bash
npx playwright test --grep="应该显示登录页面"
```

### 查看测试报告
```bash
npx playwright show-report
```

### 调试模式
```bash
npx playwright test --debug
```

### 显示浏览器窗口
```bash
npx playwright test --headed
```

## 测试配置说明

### 支持的浏览器
- Chromium (Chrome, Edge, Brave)
- Firefox
- WebKit (Safari)
- Mobile Chrome (Pixel 5)
- Mobile Safari (iPhone 12)

### 自动重试
- CI 环境: 2 次重试
- 本地环境: 不重试

### 失败时收集证据
- 截图
- 视频录制
- Trace 文件

## 使用示例

### 在代码中使用测试辅助函数

```typescript
import { login } from './utils/testHelpers';

test('自定义测试', async ({ page }) => {
  await login(page, 'test@example.com', 'password123');
  // 继续测试...
});
```

### 使用 Page Object Model

```typescript
import { LoginPage } from './pages/LoginPage';

test('自定义测试', async ({ page }) => {
  const loginPage = new LoginPage(page);
  await loginPage.goto();
  await loginPage.login('test@example.com', 'password123');
  // 继续测试...
});
```

## 注意事项

1. **测试账号**: 确保在 `.env` 文件中配置了有效的测试账号
2. **开发服务器**: 测试会自动启动开发服务器，无需手动启动
3. **端口冲突**: 确保端口 5173 未被占用
4. **超时设置**: 默认超时时间为 30 秒，可在配置文件中调整

## 下一步

1. 根据实际需求修改测试账号
2. 添加更多测试用例
3. 配置 CI/CD 集成
4. 添加性能测试
