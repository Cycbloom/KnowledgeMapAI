# Electron 打包后 API 请求路径修复

## Why

Electron 打包后的应用启动时，前端代码尝试访问 `/api/csrf-token`，但由于没有 Vite 代理，请求变成了 `file:///D:/api/csrf-token`，导致 `ERR_FILE_NOT_FOUND` 错误。

**根本原因：**
- 开发模式下，Vite 代理将 `/api` 请求转发到 `http://localhost:3001`
- 打包后没有代理机制，且 Electron 主进程没有启动后端 API 服务器
- 前端代码使用相对路径 `/api`，在 `file://` 协议下无法正常工作

## What Changes

- **BREAKING** 修改 Electron 主进程，在应用启动时自动启动内置 Express API 服务器
- 修改前端 API 客户端配置，在 Electron 环境下使用绝对 URL（如 `http://localhost:3001/api`）
- 添加 Electron 环境检测工具函数
- 更新构建配置，确保 API 服务器代码正确打包

## Impact

- Affected specs: 无
- Affected code:
  - `electron/main.ts` - 启动 API 服务器
  - `src/services/api/createApiClient.ts` - API 客户端配置
  - `src/services/api/client.ts` - CSRF 初始化
  - `vite.config.ts` - 构建配置
  - `package.json` - 构建脚本

## ADDED Requirements

### Requirement: Electron API Server Startup

The Electron main process SHALL start the Express API server when the application launches in production mode.

#### Scenario: API server starts successfully
- **WHEN** Electron app is packaged and launched
- **THEN** the Express API server starts on port 3001
- **AND** the server is ready before the browser window loads

#### Scenario: API server port conflict handling
- **WHEN** port 3001 is already in use
- **THEN** the app should try alternative ports (3002, 3003, etc.)
- **AND** the frontend should be notified of the actual port

### Requirement: Electron Environment Detection

The frontend code SHALL detect when running in Electron environment and use appropriate API base URL.

#### Scenario: Electron production mode
- **WHEN** running in packaged Electron app
- **THEN** API requests use `http://localhost:3001/api` as base URL
- **AND** CSRF token initialization works correctly

#### Scenario: Electron development mode
- **WHEN** running with `npm run electron:dev`
- **THEN** API requests use Vite proxy (relative `/api`)
- **AND** development workflow remains unchanged

#### Scenario: Web or mobile mode
- **WHEN** running in browser or Capacitor mobile
- **THEN** existing behavior is preserved
- **AND** no regression in web/mobile functionality

### Requirement: API Server Process Management

The Electron main process SHALL properly manage the API server lifecycle.

#### Scenario: Clean shutdown
- **WHEN** the Electron app is closed
- **THEN** the API server is gracefully shut down
- **AND** no orphan processes remain

#### Scenario: Server error handling
- **WHEN** the API server encounters an error
- **THEN** the error is logged appropriately
- **AND** the user is notified if the app cannot function

## MODIFIED Requirements

### Requirement: API Client Configuration

The API client SHALL support different base URLs based on the runtime environment.

**Previous behavior:** Always uses relative `/api` path
**New behavior:** Uses environment-appropriate base URL:
- Electron production: `http://localhost:{port}/api`
- Electron development: `/api` (via Vite proxy)
- Web: `/api` (via server proxy)
- Mobile: Direct Supabase (already implemented)
