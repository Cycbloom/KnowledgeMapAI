# 开发指南 - 自动化测试流程

## 概述

本项目已配置完整的自动化测试流程，包括代码质量检查、单元测试和端到端测试。在开发过程中，必须遵循以下规范。

## 开发工作流

### 1. 开始开发

```bash
# 克隆项目
git clone <repository-url>
cd KnowledgeMap

# 安装依赖
npm install

# 配置测试账号（编辑 .env 文件）
TEST_USER_EMAIL=test@example.com
TEST_USER_PASSWORD=test123456

# 安装 Playwright 浏览器
npx playwright install
```

### 2. 开发新功能

```bash
# 启动开发服务器
npm run dev

# 在另一个终端运行测试（实时监控）
npm run test:e2e -- --watch
```

### 3. 提交代码前检查

**必须执行以下步骤：**

```bash
# 1. 类型检查
npm run check

# 2. 代码检查
npm run lint

# 3. 运行所有测试
npm run test:ci
```

**如果任何步骤失败，必须修复后再提交。**

### 4. 推送代码

```bash
# 提交代码
git add .
git commit -m "feat: 添加新功能"

# 推送到远程仓库
git push origin <branch-name>
```

推送后，GitHub Actions 会自动运行所有测试。

## 测试命令详解

### 单元测试

```bash
# 运行所有单元测试
npm test

# 运行特定测试文件
npm test -- login.test.ts

# 监听模式（文件变化时自动运行）
npm test -- --watch
```

### 端到端测试

```bash
# 运行所有 E2E 测试
npm run test:e2e

# 运行特定测试
npm run test:e2e -- --grep="登录"

# 调试模式（显示浏览器窗口）
npm run test:e2e:debug

# UI 模式（可视化测试界面）
npm run test:e2e:ui

# 查看测试报告
npm run test:e2e:report
```

### 综合测试

```bash
# 运行所有测试（单元 + E2E）
npm run test:all

# CI 模式（检查 + Lint + 所有测试）
npm run test:ci
```

## 测试开发规范

### 编写测试用例

#### 1. 使用 Page Object Model

```typescript
// tests/pages/DashboardPage.ts
import { Page, Locator } from '@playwright/test';

export class DashboardPage {
  readonly page: Page;
  readonly title: Locator;

  constructor(page: Page) {
    this.page = page;
    this.title = page.getByRole('heading', { name: /dashboard/i });
  }

  async goto() {
    await this.page.goto('/dashboard');
  }

  async isVisible() {
    return await this.title.isVisible();
  }
}
```

#### 2. 编写测试用例

```typescript
// tests/dashboard.spec.ts
import { test, expect } from '@playwright/test';
import { DashboardPage } from './pages/DashboardPage';

test.describe('Dashboard 功能测试', () => {
  test('应该显示 Dashboard 页面', async ({ page }) => {
    const dashboard = new DashboardPage(page);
    await dashboard.goto();
    await expect(dashboard.title).toBeVisible();
  });
});
```

### 选择器最佳实践

**推荐使用：**

```typescript
// 1. 语义化属性
page.getByRole('button', { name: '登录' })
page.getByLabel('邮箱')
page.getByPlaceholder('请输入密码')

// 2. 测试 ID（需要在代码中添加）
page.getByTestId('login-button')

// 3. 文本内容
page.getByText('登录')
```

**避免使用：**

```typescript
// ❌ 不要使用 CSS 选择器（除非必要）
page.locator('.btn-primary')

// ❌ 不要使用 XPath（除非必要）
page.locator('//button[@class="btn"]')
```

### 等待策略

**使用 Playwright 的自动等待：**

```typescript
// ✅ 正确：使用自动等待
await page.click('button');
await expect(page.locator('.success')).toBeVisible();

// ❌ 错误：使用硬编码等待
await page.click('button');
await page.waitForTimeout(1000); // 不要这样做
await expect(page.locator('.success')).toBeVisible();
```

## CI/CD 流程

### GitHub Actions 自动化

当您推送代码或创建 Pull Request 时，GitHub Actions 会自动运行：

1. **代码检查** - ESLint
2. **类型检查** - TypeScript
3. **单元测试** - Vitest
4. **E2E 测试** - Playwright

### 查看测试结果

1. 进入 GitHub 仓库的 "Actions" 标签
2. 选择对应的工作流运行
3. 查看测试结果和日志
4. 如果失败，下载测试报告和截图进行分析

## 常见问题

### 测试失败怎么办？

1. **查看测试报告**
   ```bash
   npm run test:e2e:report
   ```

2. **查看失败截图**
   - 失败截图保存在 `test-results/` 目录
   - 文件名格式：`test-failed-1.png`

3. **使用 Trace 文件分析**
   ```bash
   npx playwright show-trace test-results/trace.zip
   ```

4. **调试模式**
   ```bash
   npm run test:e2e:debug
   ```

### 如何添加新的测试？

1. 在 `tests/pages/` 创建 Page Object
2. 在 `tests/` 创建测试文件（`*.spec.ts`）
3. 运行测试验证
4. 提交代码

### 测试账号如何配置？

在 `.env` 文件中配置：
```env
TEST_USER_EMAIL=test@example.com
TEST_USER_PASSWORD=test123456
```

**注意：**
- 使用专门的测试账号
- 不要使用生产账号
- 定期清理测试数据

## 最佳实践

### 1. 测试独立性

每个测试应该独立运行，不依赖其他测试：

```typescript
test('测试 1', async ({ page }) => {
  // 独立的测试
});

test('测试 2', async ({ page }) => {
  // 不依赖测试 1
});
```

### 2. 清晰的测试名称

使用描述性的测试名称：

```typescript
// ✅ 好的测试名称
test('应该能够成功登录', async ({ page }) => {});

test('应该显示错误信息当密码错误时', async ({ page }) => {});

// ❌ 不好的测试名称
test('test1', async ({ page }) => {});
test('login test', async ({ page }) => {});
```

### 3. 使用 beforeEach 和 afterEach

```typescript
test.describe('测试组', () => {
  test.beforeEach(async ({ page }) => {
    // 每个测试前执行
    await page.goto('/');
  });

  test.afterEach(async ({ page }) => {
    // 每个测试后执行
    await page.close();
  });
});
```

## 快速参考

### 常用命令

| 命令 | 说明 |
|------|------|
| `npm run dev` | 启动开发服务器 |
| `npm run check` | 类型检查 |
| `npm run lint` | 代码检查 |
| `npm run test` | 运行单元测试 |
| `npm run test:e2e` | 运行 E2E 测试 |
| `npm run test:ci` | 运行所有检查和测试 |
| `npm run test:e2e:debug` | 调试模式 |
| `npm run test:e2e:report` | 查看测试报告 |

### 文件结构

```
tests/
├── pages/              # Page Object Model
│   ├── LoginPage.ts
│   └── DashboardPage.ts
├── utils/              # 测试辅助函数
│   └── testHelpers.ts
├── login.spec.ts       # 登录测试
└── dashboard.spec.ts    # Dashboard 测试
```

## 获取帮助

- 查看 [Playwright 官方文档](https://playwright.dev/)
- 查看 [项目规则](.trae/rules/project_rules.md)
- 查看 [测试 README](tests/README.md)
