# Tasks

- [x] Task 1: 新增 `_schema_versions` 迁移追踪表
  - [x] SubTask 1.1: 创建 `supabase/migrations/00a_schema_versions.sql`，定义 `_schema_versions` 表（id, version, executed_at, checksum）
  - [x] SubTask 1.2: 确保该文件在所有其他迁移文件之前执行（文件名排序在 `01_core_users.sql` 之前）

- [x] Task 2: 新增后端迁移服务
  - [x] SubTask 2.1: 创建 `api/services/migration/migrationService.ts`，实现迁移文件读取、排序、执行逻辑
  - [x] SubTask 2.2: 实现 `getMigrationFiles()` — 从资源目录读取所有迁移 SQL 文件并按序号排序
  - [x] SubTask 2.3: 实现 `getDatabaseStatus()` — 检测数据库 Schema 状态（empty/partial/ready/needs_upgrade）
  - [x] SubTask 2.4: 实现 `executeMigrations()` — 按顺序执行未执行的迁移，记录到 `_schema_versions` 表
  - [x] SubTask 2.5: 实现 `getMigrationHistory()` — 返回所有迁移文件的执行状态
  - [x] SubTask 2.6: 实现 checksum 计算（SHA256），用于检测文件变更
  - [x] SubTask 2.7: 实现迁移执行进度追踪，通过事件机制报告进度

- [x] Task 3: 新增后端迁移管理 API 端点
  - [x] SubTask 3.1: 创建 `api/routes/database.ts`，实现 `GET /api/database/status` 端点
  - [x] SubTask 3.2: 实现 `POST /api/database/migrate` 端点，触发迁移执行
  - [x] SubTask 3.3: 实现 `GET /api/database/migrations` 端点，返回迁移历史
  - [x] SubTask 3.4: 在 `api/app.ts` 中挂载 database 路由
  - [x] SubTask 3.5: 修改 `PUT /api/ai/config/database` 端点，保存配置后自动检测 Schema 状态

- [x] Task 4: Electron 构建配置 — 打包迁移文件
  - [x] SubTask 4.1: 修改 `package.json` 构建配置，将 `supabase/migrations/` 目录打包到 `resources/migrations/`
  - [x] SubTask 4.2: 修改 `electron/main.ts`，在启动时将迁移文件路径传递给后端服务
  - [x] SubTask 4.3: 修改 `api/services/migration/migrationService.ts`，支持从 Electron 资源目录和开发目录两个路径读取迁移文件

- [x] Task 5: 新增首次启动引导向导页面
  - [x] SubTask 5.1: 创建 `src/pages/SetupWizard.tsx`，实现多步骤引导向导 UI
  - [x] SubTask 5.2: 实现步骤 1 — 欢迎页面（应用功能介绍、配置需求说明）
  - [x] SubTask 5.3: 实现步骤 2 — Supabase 注册引导（注册链接、操作说明）
  - [x] SubTask 5.4: 实现步骤 3 — 创建项目引导（操作说明、截图指引占位）
  - [x] SubTask 5.5: 实现步骤 4 — 凭证输入（Supabase URL、Anon Key、Service Role Key，含连接测试）
  - [x] SubTask 5.6: 实现步骤 5 — 数据库初始化（自动检测状态、执行迁移、显示进度）
  - [x] SubTask 5.7: 实现步骤 6 — AI 配置（可选，至少配置一个 AI 服务商 API Key）
  - [x] SubTask 5.8: 实现步骤 7 — 完成页面（配置摘要、进入主界面按钮）
  - [x] SubTask 5.9: 实现步骤间导航（上一步/下一步/跳过可选步骤）

- [x] Task 6: 修改应用启动流程
  - [x] SubTask 6.1: 修改 `src/App.tsx`，添加 `/setup` 路由
  - [x] SubTask 6.2: 添加 SetupWizard 懒加载导入
  - [x] SubTask 6.3: 在 Layout 组件中添加 Schema 状态检测和初始化提示横幅
  - [x] SubTask 6.4: 添加 `apiClient` 导入和 schema 状态检查 useEffect

- [x] Task 7: 设置页面增强
  - [x] SubTask 7.1: 在数据库配置区域增加 Schema 状态显示（空/部分/完整/需升级）
  - [x] SubTask 7.2: 增加"执行迁移"按钮，手动触发迁移
  - [x] SubTask 7.3: 增加"重新初始化"按钮（需二次确认），删除所有表并重新执行迁移
  - [x] SubTask 7.4: 添加 Database URL 字段和迁移执行进度显示

- [x] Task 8: 国际化与收尾
  - [x] SubTask 8.1: 在 `src/i18n/locales/zh-CN.json` 中新增引导向导和迁移相关翻译
  - [x] SubTask 8.2: 在 `src/i18n/locales/en-US.json` 中新增引导向导和迁移相关翻译
  - [x] SubTask 8.3: 运行 `npm run check` 和 `npm run lint` 确保无类型错误和代码规范问题

# Task Dependencies

- [Task 2] depends on [Task 1] (迁移服务需要 `_schema_versions` 表定义)
- [Task 3] depends on [Task 2] (API 端点依赖迁移服务)
- [Task 4] depends on [Task 2] (迁移文件路径配置依赖迁移服务的文件读取逻辑)
- [Task 5] depends on [Task 3] (引导向导需要调用迁移 API)
- [Task 6] depends on [Task 5] (启动流程需要引导向导页面)
- [Task 7] depends on [Task 3] (设置页面增强需要迁移 API)
- [Task 8] depends on [Task 5, Task 6, Task 7] (翻译在功能完成后添加)
