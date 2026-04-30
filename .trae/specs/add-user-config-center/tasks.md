# Tasks

- [x] Task 1: 新增后端 AI 配置管理 API 端点
  - [x] SubTask 1.1: 创建 `api/routes/ai/config.ts`，实现 GET/PUT `/api/ai/config/providers` 端点（获取和更新 AI 服务商配置，API Key 掩码返回）
  - [x] SubTask 1.2: 在 `api/routes/ai/config.ts` 中实现 POST `/api/ai/config/providers/test` 端点（测试 AI 服务商连接）
  - [x] SubTask 1.3: 在 `api/routes/ai/index.ts` 中挂载 config 路由
  - [x] SubTask 1.4: 修改 `api/services/ai/config.ts`，确保 `getProviderConfig` 优先从 `app_settings` 读取用户配置

- [x] Task 2: 新增后端数据库配置管理 API 端点
  - [x] SubTask 2.1: 在 `api/routes/ai/config.ts` 中实现 GET/PUT `/api/ai/config/database` 端点（获取和更新数据库配置）
  - [x] SubTask 2.2: 修改 `api/supabase.ts`，新增 `reinitializeSupabaseClients` 函数支持动态重置 Supabase 客户端
  - [x] SubTask 2.3: 在 PUT `/api/ai/config/database` 端点中调用重置函数并验证新连接

- [x] Task 3: Electron 本地配置文件管理
  - [x] SubTask 3.1: 在 `electron/main.ts` 中新增 IPC 通道 `config:read` 和 `config:write`，读写用户数据目录下的 `config.json`
  - [x] SubTask 3.2: 在 `electron/preload.ts` 中暴露 `electronAPI.config.read()` 和 `electronAPI.config.write()` API
  - [x] SubTask 3.3: 修改 `electron/main.ts` 的 `loadEnvVariables` 函数，优先从本地配置文件读取数据库连接信息

- [x] Task 4: 前端设置页面 - AI 服务配置 UI
  - [x] SubTask 4.1: 在 `src/pages/Settings.tsx` 中新增 AI 服务配置区域，包含每个服务商（Deepseek、火山引擎、阿里云）的 API Key 输入框、Base URL 输入框和默认模型选择
  - [x] SubTask 4.2: 实现 API Key 掩码显示（如 `sk-****abcd`）和显示/隐藏切换
  - [x] SubTask 4.3: 实现保存 AI 配置功能，调用 PUT `/api/ai/config/providers`
  - [x] SubTask 4.4: 实现 AI 连接测试功能，调用 POST `/api/ai/config/providers/test`
  - [x] SubTask 4.5: 实现配置缺失时的引导提示

- [x] Task 5: 前端设置页面 - 数据库配置 UI
  - [x] SubTask 5.1: 在 `src/pages/Settings.tsx` 中新增数据库配置区域，包含 Supabase URL、Anon Key、Service Role Key 输入框
  - [x] SubTask 5.2: 实现数据库连接状态显示（已连接/未连接/连接失败，本地/云端模式）
  - [x] SubTask 5.3: 实现保存数据库配置功能，Electron 环境调用 IPC 写入本地配置文件，Web 环境调用 API
  - [x] SubTask 5.4: 实现数据库配置缺失时的醒目引导横幅

- [x] Task 6: 前端动态 Supabase 配置支持
  - [x] SubTask 6.1: 修改 `src/config/authConfig.ts`，支持从本地存储或 API 动态获取 Supabase 配置
  - [x] SubTask 6.2: 修改 `src/lib/supabase.ts`，支持配置变更后重置客户端

- [x] Task 7: 国际化与收尾
  - [x] SubTask 7.1: 在 `src/i18n/locales/zh-CN.json` 中新增所有配置相关翻译
  - [x] SubTask 7.2: 在 `src/i18n/locales/en-US.json` 中新增所有配置相关翻译
  - [x] SubTask 7.3: 运行 `npm run check` 和 `npm run lint` 确保无类型错误和代码规范问题

# Task Dependencies

- [Task 2] depends on [Task 1] (共享路由文件 `api/routes/ai/config.ts`)
- [Task 3] depends on [Task 2] (数据库配置 API 端点需要先就绪)
- [Task 4] depends on [Task 1] (前端 UI 需要后端 API 端点)
- [Task 5] depends on [Task 2, Task 3] (前端 UI 需要后端 API 和 Electron IPC)
- [Task 6] depends on [Task 5] (动态配置依赖 UI 保存的配置)
- [Task 7] depends on [Task 4, Task 5, Task 6] (翻译在功能完成后添加)
