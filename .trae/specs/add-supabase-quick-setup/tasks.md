# Tasks

- [x] Task 1: 新增后端 Supabase Management API 代理服务
  - [x] SubTask 1.1: 创建 `api/services/supabase/managementApi.ts`，封装 Supabase Management API 调用
  - [x] SubTask 1.2: 实现 `listOrganizations(accessToken)` — 获取用户组织列表
  - [x] SubTask 1.3: 实现 `listRegions(accessToken)` — 获取可用区域列表
  - [x] SubTask 1.4: 实现 `createProject(accessToken, options)` — 创建项目并等待就绪
  - [x] SubTask 1.5: 实现 `getProjectApiKeys(accessToken, projectRef)` — 获取项目 API Keys
  - [x] SubTask 1.6: 实现 `waitForProjectReady(accessToken, projectRef, timeout)` — 轮询等待项目就绪
  - [x] SubTask 1.7: 实现 `quickSetup(accessToken, options)` — 完整一键配置流程

- [x] Task 2: 新增后端 Supabase 管理 API 端点
  - [x] SubTask 2.1: 创建 `api/routes/supabase.ts`，实现 `GET /api/supabase/organizations` 端点
  - [x] SubTask 2.2: 实现 `GET /api/supabase/regions` 端点
  - [x] SubTask 2.3: 实现 `POST /api/supabase/create-project` 端点
  - [x] SubTask 2.4: 实现 `POST /api/supabase/quick-setup` 端点
  - [x] SubTask 2.5: 在 `api/app.ts` 中挂载 supabase 路由

- [x] Task 3: 修改 Login.tsx 添加一键配置 UI
  - [x] SubTask 3.1: 添加 Tab 切换组件（「一键配置」和「手动配置」）
  - [x] SubTask 3.2: 实现步骤 1 — 输入 PAT（含获取 PAT 链接）
  - [x] SubTask 3.3: 实现步骤 2 — 选择组织（验证 PAT 后自动加载组织列表）
  - [x] SubTask 3.4: 实现步骤 3 — 配置项目（项目名、数据库密码、区域选择）
  - [x] SubTask 3.5: 实现步骤 4 — 一键创建（调用 quick-setup API，显示进度）
  - [x] SubTask 3.6: 实现步骤 5 — 完成页面（显示结果，自动认证跳转）
  - [x] SubTask 3.7: 实现步骤间导航和验证
  - [x] SubTask 3.8: 实现失败重试和回退逻辑

- [x] Task 4: 国际化与收尾
  - [x] SubTask 4.1: 在 `zh-CN.json` 中新增一键配置相关翻译（quickSetup 前缀，28 个 key）
  - [x] SubTask 4.2: 在 `en-US.json` 中新增一键配置相关翻译
  - [x] SubTask 4.3: 运行 `npm run check` 和 `npm run lint` 确保无错误

# Task Dependencies

- [Task 2] depends on [Task 1]
- [Task 3] depends on [Task 2]
- [Task 4] depends on [Task 3]
