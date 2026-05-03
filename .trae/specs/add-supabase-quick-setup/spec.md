# Supabase Management API 一键配置 Spec

## Why

当前用户需要手动注册 Supabase 账号、创建项目、在 Dashboard 中查找并复制 4 个凭证（URL、Anon Key、Service Role Key、Database URL），流程繁琐且容易出错。通过集成 Supabase Management API，用户只需提供一个 Personal Access Token，应用即可自动完成项目创建、凭证获取和数据库初始化，实现一键配置。

## What Changes

- 新增后端 Supabase Management API 代理服务，封装项目创建、凭证获取等 API 调用
- 新增后端 API 端点 `/api/supabase/organizations`、`/api/supabase/create-project`、`/api/supabase/quick-setup`
- 修改 Login.tsx 配置页面，新增"一键配置"模式（与手动模式并列）
- 一键配置流程：输入 PAT → 选择组织 → 输入项目名/密码/区域 → 自动创建项目 → 自动获取凭证 → 自动初始化数据库 → 自动认证

## Impact

- Affected specs: 替换登录页为配置页
- Affected code:
  - `api/services/supabase/managementApi.ts` — 新增
  - `api/routes/supabase.ts` — 新增
  - `api/app.ts` — 挂载新路由
  - `src/pages/Login.tsx` — 新增一键配置 UI
  - `src/i18n/locales/zh-CN.json` — 新增翻译
  - `src/i18n/locales/en-US.json` — 新增翻译

## ADDED Requirements

### Requirement: Supabase Management API 代理服务

系统 SHALL 提供后端代理服务，封装 Supabase Management API 调用，避免前端直接暴露 PAT。

#### Scenario: 获取用户组织列表
- **WHEN** 前端请求 `GET /api/supabase/organizations?accessToken={PAT}`
- **THEN** 系统应调用 `https://api.supabase.com/v1/organizations` 获取用户的组织列表
- **AND** 返回 `{ organizations: [{ id, name, slug }] }`

#### Scenario: 获取可用区域
- **WHEN** 前端请求 `GET /api/supabase/regions?accessToken={PAT}`
- **THEN** 系统应调用 `https://api.supabase.com/v1/projects/available-regions` 获取可用区域
- **AND** 返回 `{ regions: [{ code, name, location }] }`

#### Scenario: 创建 Supabase 项目
- **WHEN** 前端请求 `POST /api/supabase/create-project`
- **AND** 请求体包含 `{ accessToken, organizationSlug, projectName, dbPassword, region }`
- **THEN** 系统应调用 `POST https://api.supabase.com/v1/projects` 创建项目
- **AND** 轮询 `GET /v1/projects/{ref}/health` 等待项目就绪（最长 3 分钟）
- **AND** 获取 API Keys（`GET /v1/projects/{ref}/api-keys?reveal=true`）
- **AND** 返回 `{ projectRef, supabaseUrl, anonKey, serviceRoleKey, databaseUrl }`

#### Scenario: 一键配置（完整流程）
- **WHEN** 前端请求 `POST /api/supabase/quick-setup`
- **AND** 请求体包含 `{ accessToken, organizationSlug, projectName, dbPassword, region }`
- **THEN** 系统应依次执行：
  1. 创建 Supabase 项目
  2. 等待项目就绪
  3. 获取 API Keys
  4. 构造 Database URL（`postgresql://postgres:{dbPassword}@db.{ref}.supabase.co:5432/postgres`）
  5. 保存数据库配置到 settingsService
  6. 重新初始化 Supabase 客户端
  7. 执行数据库迁移（初始化 Schema）
- **AND** 返回 `{ success: true, supabaseUrl, anonKey, serviceRoleKey, databaseUrl, migrationResults }`

#### Scenario: PAT 无效
- **WHEN** 提供的 Personal Access Token 无效或过期
- **THEN** 系统应返回 401 错误，提示"PAT 无效或已过期"

#### Scenario: 项目创建失败
- **WHEN** Supabase 项目创建失败（如名称冲突、配额不足）
- **THEN** 系统应返回错误信息包含 Supabase API 的原始错误

#### Scenario: 项目创建超时
- **WHEN** 项目创建后 3 分钟内未就绪
- **THEN** 系统应返回超时错误，但提供项目 ref 供用户稍后手动配置

### Requirement: 一键配置 UI

系统 SHALL 在配置页面提供"一键配置"模式，与手动配置模式并列。

#### Scenario: 切换配置模式
- **WHEN** 用户在配置页面
- **THEN** 应显示两个 Tab：「一键配置」和「手动配置」
- **AND** 默认选中「一键配置」

#### Scenario: 一键配置步骤
- **WHEN** 用户选择「一键配置」
- **THEN** 应按以下步骤引导：
  1. **输入 PAT** — 输入 Supabase Personal Access Token，附带获取 PAT 的链接（https://supabase.com/dashboard/account/tokens）
  2. **选择组织** — 验证 PAT 后自动加载用户的组织列表，选择一个组织
  3. **配置项目** — 输入项目名称、数据库密码、选择区域
  4. **一键创建** — 点击"创建并配置"按钮，自动完成：创建项目 → 获取凭证 → 初始化数据库
  5. **完成** — 显示配置结果，自动认证并跳转主界面

#### Scenario: 步骤间导航
- **WHEN** 用户在步骤间切换
- **THEN** 每一步验证通过后才能进入下一步
- **AND** 可以返回上一步修改

#### Scenario: 创建进度显示
- **WHEN** 项目正在创建中
- **THEN** 应显示进度指示器，包含：
  - "正在创建项目..."（带旋转动画）
  - "正在等待项目就绪..."（带旋转动画）
  - "正在获取凭证..."（带旋转动画）
  - "正在初始化数据库..."（带旋转动画）
  - 每步完成显示绿色勾号

#### Scenario: 创建失败回退
- **WHEN** 一键配置过程中某步失败
- **THEN** 应显示具体错误信息
- **AND** 提供"重试"按钮
- **AND** 如果项目已创建但后续步骤失败，提示用户可切换到手动配置模式使用已创建的项目凭证

## MODIFIED Requirements

### Requirement: 配置页面布局

原有行为：配置页面包含"连接 Supabase"和"配置 AI 服务"两个卡片

修改后行为：
- 配置页面顶部增加 Tab 切换：「一键配置」和「手动配置」
- 「一键配置」Tab 显示 PAT 输入 + 项目创建流程
- 「手动配置」Tab 显示原有的手动输入凭证界面
- 「配置 AI 服务」卡片在两个 Tab 中都可见（底部共享区域）

## REMOVED Requirements

无移除的需求。
