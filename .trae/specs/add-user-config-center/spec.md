# 用户配置中心 Spec

## Why

当前 Electron 桌面应用发布后，普通用户无法方便地配置 AI API Key 和数据库连接信息。AI API Key 只能通过环境变量配置，数据库连接信息硬编码在 `.env.production` 中，这对非技术用户极不友好。需要提供 UI 界面让用户自行配置这些关键参数，使应用真正可用于分发。

## What Changes

- 在设置页面新增 **AI 服务配置** 区域，允许用户为每个 AI 服务商（Deepseek、火山引擎、阿里云）配置 API Key、Base URL 和默认模型
- 在设置页面新增 **数据库配置** 区域，允许用户配置 Supabase URL、Anon Key 和 Service Role Key
- 新增后端 API 端点用于保存/读取 AI 服务商配置和数据库配置
- 修改后端 AI 配置加载逻辑，优先从用户配置读取，环境变量作为后备
- 新增首次启动引导流程，当检测到关键配置缺失时引导用户完成配置
- 修改 Electron 主进程，支持从用户配置文件动态加载数据库连接信息
- 新增 Electron IPC 通道，支持前端读写本地配置文件
- 新增数据库连接动态重置能力，配置变更后无需重启应用

## Impact

- Affected specs: AI 服务配置、数据库连接配置、用户设置
- Affected code:
  - `src/pages/Settings.tsx` — 新增 AI 服务配置和数据库配置 UI
  - `api/services/ai/config.ts` — 修改配置加载优先级
  - `api/services/core/settingsService.ts` — 扩展配置管理
  - `api/supabase.ts` — 支持动态重置 Supabase 客户端
  - `api/routes/ai/index.ts` — 新增配置管理端点
  - `electron/main.ts` — 新增 IPC 通道、支持本地配置文件
  - `electron/preload.ts` — 暴露配置读写 API
  - `src/config/authConfig.ts` — 支持动态 Supabase 配置
  - `src/lib/supabase.ts` — 支持动态重置客户端
  - `src/i18n/locales/zh-CN.json` — 新增翻译
  - `src/i18n/locales/en-US.json` — 新增翻译

## ADDED Requirements

### Requirement: AI 服务商 API Key 配置 UI

系统 SHALL 在设置页面提供 AI 服务商配置区域，允许用户为每个服务商配置 API Key、Base URL 和默认模型。

#### Scenario: 配置 AI 服务商 API Key
- **WHEN** 用户在设置页面的 AI 服务配置区域输入某个服务商的 API Key 并保存
- **THEN** 系统应将配置保存到后端 `app_settings` 表的 `ai_provider_config` 键中
- **AND** 后续 AI 请求应优先使用用户配置的 API Key，而非环境变量

#### Scenario: 查看已配置的 API Key
- **WHEN** 用户打开设置页面
- **THEN** 系统应显示每个服务商的配置状态（已配置/未配置），已配置的 API Key 应以掩码形式显示（如 `sk-****abcd`）

#### Scenario: 清除 AI 服务商配置
- **WHEN** 用户清除某个服务商的 API Key 配置
- **THEN** 系统应从 `app_settings` 中移除该服务商的配置
- **AND** 后续 AI 请求应回退到环境变量配置

#### Scenario: 配置验证
- **WHEN** 用户保存 AI 服务商配置
- **THEN** 系统应验证 API Key 非空，Base URL 格式合法
- **AND** 可选地发起测试请求验证 API Key 有效性

### Requirement: 数据库连接配置 UI

系统 SHALL 在设置页面提供数据库配置区域，允许用户配置 Supabase 连接信息。

#### Scenario: 配置数据库连接
- **WHEN** 用户在设置页面的数据库配置区域输入 Supabase URL、Anon Key 和 Service Role Key 并保存
- **THEN** 系统应将配置保存到本地配置文件（Electron 环境）或 `app_settings` 表（Web 环境）
- **AND** 系统应动态重新初始化 Supabase 客户端使用新配置

#### Scenario: 查看数据库连接状态
- **WHEN** 用户打开设置页面
- **THEN** 系统应显示当前数据库连接状态（已连接/未连接/连接失败）和连接模式（本地/云端）

#### Scenario: 数据库配置缺失
- **WHEN** 应用首次启动且未检测到数据库配置
- **THEN** 系统应在设置页面显示醒目的配置引导提示

### Requirement: 后端 AI 配置管理 API

系统 SHALL 提供 RESTful API 端点用于管理 AI 服务商配置。

#### Scenario: 获取 AI 服务商配置
- **WHEN** 前端请求 `GET /api/ai/config/providers`
- **THEN** 系统应返回所有服务商的配置信息（API Key 以掩码形式返回）

#### Scenario: 更新 AI 服务商配置
- **WHEN** 前端请求 `PUT /api/ai/config/providers` 并提供服务商配置数据
- **THEN** 系统应将配置保存到 `app_settings` 表
- **AND** 返回保存成功的确认

#### Scenario: 测试 AI 服务商连接
- **WHEN** 前端请求 `POST /api/ai/config/providers/test` 并指定服务商
- **THEN** 系统应使用配置的 API Key 发起测试请求
- **AND** 返回连接测试结果（成功/失败及原因）

### Requirement: 后端数据库配置管理 API

系统 SHALL 提供 RESTful API 端点用于管理数据库连接配置。

#### Scenario: 获取数据库配置状态
- **WHEN** 前端请求 `GET /api/ai/config/database`
- **THEN** 系统应返回当前数据库配置状态（已配置/未配置，连接模式，URL 掩码）

#### Scenario: 更新数据库配置
- **WHEN** 前端请求 `PUT /api/ai/config/database` 并提供 Supabase 连接信息
- **THEN** 系统应将配置保存并动态重新初始化 Supabase 客户端
- **AND** 返回新连接的测试结果

### Requirement: Electron 本地配置文件管理

系统 SHALL 在 Electron 环境下通过 IPC 通道支持本地配置文件的读写。

#### Scenario: 读取本地配置
- **WHEN** 前端通过 `electronAPI.config.read()` 请求读取本地配置
- **THEN** Electron 主进程应读取用户数据目录下的 `config.json` 文件并返回配置内容

#### Scenario: 写入本地配置
- **WHEN** 前端通过 `electronAPI.config.write(data)` 请求写入本地配置
- **THEN** Electron 主进程应将配置数据写入用户数据目录下的 `config.json` 文件

#### Scenario: 配置文件不存在
- **WHEN** 首次启动且配置文件不存在
- **THEN** 系统应返回空配置对象，前端据此显示配置引导

### Requirement: 首次启动配置引导

系统 SHALL 在检测到关键配置缺失时，在设置页面显示醒目的配置引导提示。

#### Scenario: AI 配置缺失引导
- **WHEN** 用户首次打开设置页面且未配置任何 AI 服务商 API Key
- **THEN** 系统应在 AI 配置区域显示引导提示，说明如何获取和配置 API Key

#### Scenario: 数据库配置缺失引导
- **WHEN** 应用启动且未检测到有效的数据库连接配置
- **THEN** 系统应在设置页面顶部显示醒目的数据库配置引导横幅

### Requirement: 配置优先级

系统 SHALL 按以下优先级加载配置：用户 UI 配置 > 环境变量 > 默认值。

#### Scenario: 配置加载优先级
- **WHEN** 系统需要获取 AI 服务商配置
- **THEN** 系统应按以下顺序查找：`app_settings` 表中的用户配置 > 环境变量 > 硬编码默认值

#### Scenario: 数据库配置加载优先级
- **WHEN** 系统需要获取数据库连接配置
- **THEN** 系统应按以下顺序查找：本地配置文件（Electron）或 `app_settings` 表（Web）> 环境变量 > 默认值

## MODIFIED Requirements

### Requirement: AI 服务商配置加载

系统 SHALL 在获取 AI 服务商配置时优先从用户 UI 配置读取。

原有行为：仅从环境变量读取 API Key

修改后行为：
1. 首先检查 `app_settings` 表中 `ai_provider_config` 键的用户配置
2. 如果用户配置中存在对应服务商的 API Key，使用用户配置
3. 否则回退到环境变量
4. 最后使用硬编码默认值

### Requirement: Supabase 客户端初始化

系统 SHALL 支持动态重新初始化 Supabase 客户端。

原有行为：Supabase 客户端在服务启动时初始化一次，不可更改

修改后行为：
1. 支持通过 API 调用重新初始化 Supabase 客户端
2. 重新初始化时清除旧的客户端实例缓存
3. 新客户端使用最新的配置信息

## REMOVED Requirements

无移除的需求。
