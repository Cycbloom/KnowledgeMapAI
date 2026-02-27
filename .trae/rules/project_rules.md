# 项目规则

## 数据库操作

### 数据库修改流程（无迁移模式）

**项目采用直接修改 schema 文件的方式，不使用增量迁移：**

1. **修改数据库架构**：直接编辑 `supabase/migrations/00000000000000_initial_schema.sql`
2. **修改种子数据**：直接编辑 `supabase/migrations/00000000000001_initial_seed.sql`
3. **重置数据库**：运行 `npx supabase db reset`
4. **插入测试数据**：运行 `npm run db:seed`

**注意事项：**
- 不创建新的迁移文件（如 `20250301_xxx.sql`）
- 所有架构变更直接在 `00000000000000_initial_schema.sql` 中修改
- 所有种子数据变更直接在 `00000000000001_initial_seed.sql` 中修改
- db reset 会删除所有本地数据库数据
- 测试用户: `test@example.com` / `test123456`

### 数据库重置完整流程

```bash
# 1. 重置数据库（应用 schema 和 seed 文件）
npx supabase db reset

# 2. 插入测试数据
npm run db:seed
```

### 修改数据库的最佳实践

1. **添加新表**：在 schema 文件的 `TABLES` 部分添加
2. **添加新字段**：找到对应表定义，添加字段
3. **添加索引**：在 `INDEXES` 部分添加
4. **添加 RLS 策略**：在 `ROW LEVEL SECURITY` 部分添加
5. **添加函数/触发器**：在 `FUNCTIONS` 部分添加
6. **添加种子数据**：在 seed 文件中添加 INSERT 语句

### 远程数据库同步

**注意**：此方式仅适用于本地开发环境。远程生产环境需要谨慎处理：

1. 本地开发完成后，导出 schema 差异
2. 在远程环境手动执行变更 SQL
3. 或使用 `npx supabase db push` 推送（需要先 link）

## 自动化测试

### 测试运行时机

**必须运行测试的场景：**

1. **提交代码前** - 必须运行 `npm run lint` 和 `npm run check` 确保代码质量
2. **功能开发完成后** - 必须运行 `npx playwright test` 确保功能正常
3. **修改登录/认证相关代码后** - 必须运行登录测试 `npx playwright test --grep="登录"`
4. **修改 UI 组件后** - 必须运行相关页面的测试用例
5. **CI/CD 流程中** - 自动运行所有测试

### 测试配置

**环境变量配置：**

在 `.env` 文件中配置测试账号：
```env
TEST_USER_EMAIL=test@example.com
TEST_USER_PASSWORD=test123456
```

**测试账号管理：**

1. 使用专门的测试账号，不要使用生产账号
2. 测试账号密码应该简单易记，如 `test123456`
3. 定期清理测试数据，避免污染数据库

### 测试命令

**常用测试命令：**

```bash
# 运行所有测试
npx playwright test

# 运行特定浏览器测试
npx playwright test --project=chromium

# 运行特定测试
npx playwright test --grep="登录"

# 调试模式
npx playwright test --debug

# 显示浏览器窗口
npx playwright test --headed

# 查看测试报告
npx playwright show-report
```

### 测试开发规范

**编写测试用例时：**

1. **使用 Page Object Model** - 新的测试应该使用 POM 模式（参考 `tests/pages/LoginPage.ts`）
2. **语义化选择器** - 优先使用 `data-testid`、`role`、`label` 等语义化属性
3. **避免硬编码等待** - 使用 Playwright 的自动等待机制，不要使用 `sleep`
4. **测试独立性** - 每个测试应该独立运行，不依赖其他测试
5. **清晰的测试名称** - 使用描述性的测试名称，如"应该能够成功登录"

**测试文件结构：**

```
tests/
├── pages/              # Page Object Model
│   └── LoginPage.ts
├── utils/              # 测试辅助函数
│   └── testHelpers.ts
└── *.spec.ts          # 测试用例文件
```

### 测试失败处理

**测试失败时的处理流程：**

1. 查看测试报告 `npx playwright show-report`
2. 检查失败截图和视频
3. 使用 Trace 文件分析问题 `npx playwright show-trace test-results/...`
4. 修复代码或测试用例
5. 重新运行测试验证

### 开发工作流

**推荐的开发流程：**

1. 编写代码
2. 运行类型检查 `npm run check`
3. 运行代码检查 `npm run lint`
4. 运行相关测试 `npx playwright test --grep="功能名称"`
5. 修复发现的问题
6. 提交代码
