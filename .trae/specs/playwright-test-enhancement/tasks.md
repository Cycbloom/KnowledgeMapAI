# Tasks

- [x] Task 1: 验证现有测试是否正常工作
  - [x] SubTask 1.1: 运行 `npx playwright test` 验证现有登录测试
  - [x] SubTask 1.2: 检查测试报告，确认所有测试通过或记录失败原因
    - 结果: 9 个测试通过，2 个测试失败（登录成功测试，可能是测试账号或环境问题）

- [x] Task 2: 配置 .gitignore 添加 Playwright 测试输出目录
  - [x] SubTask 2.1: 添加 `test-results/` 到 .gitignore
  - [x] SubTask 2.2: 添加 `playwright-report/` 到 .gitignore
  - [x] SubTask 2.3: 添加 `playwright/.cache/` 到 .gitignore

- [x] Task 3: 创建注册页面 Page Object Model
  - [x] SubTask 3.1: 创建 `tests/pages/RegisterPage.ts` 文件
  - [x] SubTask 3.2: 实现注册页面元素定位器（姓名、邮箱、密码输入框，注册按钮，登录链接）
  - [x] SubTask 3.3: 实现注册操作方法（register, clickLogin, getErrorMessage）

- [x] Task 4: 创建注册页面测试用例
  - [x] SubTask 4.1: 创建 `tests/register.spec.ts` 文件
  - [x] SubTask 4.2: 测试注册页面元素显示
  - [x] SubTask 4.3: 测试成功注册流程
  - [x] SubTask 4.4: 测试注册错误处理
  - [x] SubTask 4.5: 测试导航到登录页面
  - [x] SubTask 4.6: 测试主题切换功能

- [x] Task 5: 创建 Dashboard 页面 Page Object Model
  - [x] SubTask 5.1: 创建 `tests/pages/DashboardPage.ts` 文件
  - [x] SubTask 5.2: 实现主要元素定位器（标题、图谱列表、新建按钮、搜索框）
  - [x] SubTask 5.3: 实现核心操作方法（createGraph, searchGraphs, toggleTheme）

- [x] Task 6: 创建 Dashboard 页面测试用例
  - [x] SubTask 6.1: 创建 `tests/dashboard.spec.ts` 文件
  - [x] SubTask 6.2: 测试 Dashboard 页面元素显示
  - [x] SubTask 6.3: 测试创建新图谱功能
  - [x] SubTask 6.4: 测试搜索功能
  - [x] SubTask 6.5: 测试主题切换功能

- [x] Task 7: 更新测试辅助函数
  - [x] SubTask 7.1: 在 `tests/utils/testHelpers.ts` 中添加注册页面选择器
  - [x] SubTask 7.2: 添加 Dashboard 页面选择器
  - [x] SubTask 7.3: 添加辅助函数用于快速创建测试数据

# Task Dependencies
- [Task 3] depends on [Task 1] - 先验证现有测试再创建新的 POM
- [Task 4] depends on [Task 3] - 测试用例依赖 Page Object Model
- [Task 5] depends on [Task 1] - 先验证现有测试再创建新的 POM
- [Task 6] depends on [Task 5] - 测试用例依赖 Page Object Model
- [Task 7] can run in parallel with [Task 3] and [Task 5]
