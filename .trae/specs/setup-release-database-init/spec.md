# Release 数据库初始化与用户引导 Spec

## Why

当前 Electron 桌面应用发布后，普通用户无法开箱即用。用户需要自行注册 Supabase 账号、创建项目、获取凭证、手动填入配置，且连接后数据库为空（无表结构），应用无法正常工作。需要提供完整的首次启动引导流程和数据库 Schema 自动初始化机制，使应用真正可用于分发。

## What Changes

- 新增数据库 Schema 自动初始化服务，当检测到连接的 Supabase 实例为空时，自动执行所有迁移 SQL 文件
- 新增 `_schema_versions` 表，追踪已执行的迁移版本，支持增量迁移
- 新增后端 API 端点 `/api/database/migrate`，执行数据库迁移
- 新增后端 API 端点 `/api/database/status`，检测数据库 Schema 状态（空/部分初始化/完整）
- 新增首次启动引导向导（Setup Wizard）页面，引导用户完成 Supabase 注册、项目创建、凭证配置、Schema 初始化
- 修改 Electron 构建配置，将迁移 SQL 文件打包到应用资源中
- 修改应用启动流程，首次启动时检测配置状态，未配置则跳转引导向导

## Impact

- Affected specs: 用户配置中心、数据库连接配置、应用启动流程
- Affected code:
  - `api/supabase.ts` — 新增数据库状态检测
  - `api/routes/` — 新增迁移和状态检测端点
  - `api/services/` — 新增迁移服务
  - `src/pages/SetupWizard.tsx` — 新增引导向导页面
  - `src/App.tsx` — 修改路由，新增引导流程
  - `electron/main.ts` — 修改启动流程检测
  - `vite.config.ts` — 修改构建配置，打包迁移文件
  - `supabase/migrations/` — 新增 `_schema_versions` 表迁移文件
  - `src/i18n/locales/zh-CN.json` — 新增翻译
  - `src/i18n/locales/en-US.json` — 新增翻译

## ADDED Requirements

### Requirement: 数据库 Schema 状态检测

系统 SHALL 能够检测连接的 Supabase 数据库的 Schema 状态。

#### Scenario: 检测空数据库
- **WHEN** 用户连接到一个全新的 Supabase 实例
- **THEN** 系统应检测到数据库为空（无 `users` 表）
- **AND** 返回状态 `empty`

#### Scenario: 检测部分初始化的数据库
- **WHEN** 数据库中存在部分表但缺少 `_schema_versions` 表
- **THEN** 系统应返回状态 `partial`

#### Scenario: 检测完整初始化的数据库
- **WHEN** 数据库中存在 `_schema_versions` 表且所有必要迁移已执行
- **THEN** 系统应返回状态 `ready`

#### Scenario: 检测需要升级的数据库
- **WHEN** 数据库中存在 `_schema_versions` 表但缺少部分迁移
- **THEN** 系统应返回状态 `needs_upgrade`，并包含缺失的迁移列表

### Requirement: 数据库 Schema 自动初始化

系统 SHALL 在检测到空数据库时，自动执行所有迁移 SQL 文件初始化 Schema。

#### Scenario: 自动初始化空数据库
- **WHEN** 用户首次连接到一个空的 Supabase 实例并确认初始化
- **THEN** 系统应按顺序执行 `00_extensions_and_types.sql` 到 `19_system_tasks.sql` 的所有 Schema 迁移文件
- **AND** 然后执行 `50_seed_app_settings.sql` 到 `57_seed_triggers_and_defaults.sql` 的 Seed 数据文件
- **AND** 不执行 `99_seed_test_user.sql`（测试用户不应出现在生产环境）
- **AND** 在 `_schema_versions` 表中记录每个已执行的迁移

#### Scenario: 增量迁移
- **WHEN** 应用更新后检测到新的迁移文件尚未执行
- **THEN** 系统应只执行缺失的迁移文件
- **AND** 在 `_schema_versions` 表中记录新执行的迁移

#### Scenario: 迁移执行失败
- **WHEN** 某个迁移文件执行失败
- **THEN** 系统应停止后续迁移执行
- **AND** 返回错误信息包含失败的迁移文件名和错误详情
- **AND** 已成功执行的迁移不受影响

#### Scenario: 迁移执行进度
- **WHEN** 迁移正在执行中
- **THEN** 系统应通过 SSE 或轮询机制向前端报告执行进度（当前执行到哪个文件、成功/失败数）

### Requirement: Schema 版本追踪表

系统 SHALL 在数据库中维护 `_schema_versions` 表追踪迁移执行历史。

#### Scenario: 创建版本追踪表
- **WHEN** 数据库初始化时
- **THEN** 系统应创建 `_schema_versions` 表，包含以下字段：
  - `id` SERIAL PRIMARY KEY
  - `version` VARCHAR(100) UNIQUE NOT NULL（迁移文件名，如 `01_core_users`）
  - `executed_at` TIMESTAMP WITH TIME ZONE DEFAULT NOW()
  - `checksum` VARCHAR(64)（文件内容的 SHA256 摘要，用于检测文件变更）

#### Scenario: 检测文件变更
- **WHEN** 已执行的迁移文件的 checksum 与记录不一致
- **THEN** 系统应发出警告但不自动重新执行（防止数据丢失）

### Requirement: 迁移管理 API

系统 SHALL 提供 RESTful API 端点用于数据库迁移管理。

#### Scenario: 获取数据库状态
- **WHEN** 前端请求 `GET /api/database/status`
- **THEN** 系统应返回数据库 Schema 状态（`empty` / `partial` / `ready` / `needs_upgrade`）
- **AND** 如果状态为 `needs_upgrade`，返回缺失的迁移列表

#### Scenario: 执行数据库迁移
- **WHEN** 前端请求 `POST /api/database/migrate`
- **THEN** 系统应按顺序执行所有未执行的迁移文件
- **AND** 返回执行结果（成功/失败的迁移列表）

#### Scenario: 获取迁移历史
- **WHEN** 前端请求 `GET /api/database/migrations`
- **THEN** 系统应返回所有迁移文件的执行状态（已执行/未执行、执行时间、checksum）

### Requirement: 首次启动引导向导

系统 SHALL 在首次启动时提供引导向导，帮助用户完成所有必要配置。

#### Scenario: 检测首次启动
- **WHEN** 应用启动且未检测到有效的数据库连接配置
- **THEN** 系统应自动跳转到引导向导页面，而非主界面

#### Scenario: 引导向导步骤
- **WHEN** 用户进入引导向导
- **THEN** 系统应按以下步骤引导用户：
  1. **欢迎页面** — 介绍应用功能和配置需求
  2. **Supabase 注册** — 引导用户注册 Supabase 账号（提供注册链接和说明）
  3. **创建项目** — 引导用户在 Supabase 创建新项目（提供操作说明和截图指引）
  4. **获取凭证** — 引导用户找到并填入 Supabase URL、Anon Key、Service Role Key
  5. **初始化数据库** — 自动检测数据库状态并执行 Schema 初始化，显示进度
  6. **AI 配置（可选）** — 引导用户配置至少一个 AI 服务商的 API Key
  7. **完成** — 显示配置完成摘要，进入主界面

#### Scenario: 跳过可选步骤
- **WHEN** 用户在 AI 配置步骤选择跳过
- **THEN** 系统应允许跳过，用户可在后续通过设置页面配置

#### Scenario: 配置验证失败
- **WHEN** 用户填入的 Supabase 凭证无法连接
- **THEN** 系统应显示明确的错误信息，并允许用户重新输入

#### Scenario: 已有配置的用户
- **WHEN** 应用启动且已检测到有效的数据库连接配置
- **THEN** 系统应直接进入主界面，不显示引导向导

### Requirement: 迁移文件打包

系统 SHALL 在 Electron 构建时将迁移 SQL 文件打包到应用资源中。

#### Scenario: 构建时打包迁移文件
- **WHEN** 执行 Electron 构建
- **THEN** 系统应将 `supabase/migrations/` 目录下的所有 SQL 文件打包到 `resources/migrations/` 目录

#### Scenario: 运行时读取迁移文件
- **WHEN** 后端需要执行迁移
- **THEN** 系统应从打包的资源目录读取 SQL 文件内容
- **AND** 按文件名前缀数字排序执行

### Requirement: 设置页面增强

系统 SHALL 在设置页面的数据库配置区域增加 Schema 状态显示和手动迁移操作。

#### Scenario: 显示 Schema 状态
- **WHEN** 用户打开设置页面的数据库配置区域
- **THEN** 系统应显示当前 Schema 状态（空/部分/完整/需升级）
- **AND** 显示已执行和未执行的迁移数量

#### Scenario: 手动触发迁移
- **WHEN** 用户点击"执行迁移"按钮
- **THEN** 系统应执行所有未执行的迁移
- **AND** 显示执行进度和结果

#### Scenario: 重新初始化数据库
- **WHEN** 用户点击"重新初始化"按钮并确认
- **THEN** 系统应删除所有表并重新执行所有迁移
- **AND** 此操作需要二次确认，提示数据将丢失

## MODIFIED Requirements

### Requirement: 应用启动流程

系统 SHALL 在启动时检测配置状态，未配置则跳转引导向导。

原有行为：应用启动后直接进入主界面，如果数据库未连接则显示警告横幅

修改后行为：
1. 启动时检测本地配置文件是否存在且包含有效数据库配置
2. 如果未配置，自动跳转到引导向导页面
3. 如果已配置但数据库 Schema 为空，在主界面显示醒目的"初始化数据库"提示
4. 如果已配置且 Schema 完整，正常进入主界面

### Requirement: 数据库配置保存

系统 SHALL 在保存数据库配置后自动检测 Schema 状态。

原有行为：保存配置后仅重新初始化 Supabase 客户端

修改后行为：
1. 保存配置并重新初始化 Supabase 客户端
2. 自动检测 Schema 状态
3. 如果 Schema 为空，提示用户执行初始化
4. 返回 Schema 状态信息

## REMOVED Requirements

无移除的需求。
