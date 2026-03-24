# 移动端接入统一后端 API（Vercel）Spec

## Why

移动端当前通过 `src/services/mobile/` 目录下的直连 Supabase 实现与后端交互，而 Web/Electron 端使用统一的 `/api` 后端。这导致：
1. 移动端与桌面端代码路径不一致，维护成本高
2. 错误处理、token 刷新、埋点/重试策略无法复用
3. 部分敏感逻辑（如 AI、scheduler）在移动端直连可能泄露 service role key 或绕过权限
4. 离线回放逻辑直接读取 localStorage，与 store 状态不同步

## What Changes

### 阶段 0：打通后端连接基础
- 引入可配置的 API 基址环境变量 `VITE_API_BASE_URL`
- 修改 Axios client 的 baseURL 逻辑，支持移动端指向 Vercel 域名
- 确保移动端请求携带 `x-mobile-client: true` header（已实现）

### 阶段 1：适配器迁移开关
- 调整 `adapter.ts`，默认走 webApi 而非 Supabase 直连
- 引入 feature flag `VITE_MOBILE_USE_SUPABASE_DIRECT` 支持快速回退

### 阶段 2：逐模块迁移
- 优先迁移基础数据模块：graphs/nodes/edges
- 统一 auth 模块，确保 token 存储单一事实来源
- 迁移高级模块（AI、scheduler、quiz 等）

### 阶段 3：离线同步与缓存一致性
- 统一离线回放的 token/headers 获取函数
- 确保离线队列只回放到 HTTP API

### 阶段 4：修复 SW 更新消息协议
- 统一 Service Worker 的 skipWaiting 消息格式

## Impact

- Affected specs: 移动端 API 适配层、离线同步机制、Service Worker
- Affected code:
  - `src/services/api/createApiClient.ts`
  - `src/services/api/adapter.ts`
  - `src/config/mobileApiConfig.ts`
  - `src/utils/backgroundSync.ts`
  - `public/sw.js`
  - `src/main.tsx`

## ADDED Requirements

### Requirement: 可配置的 API 基址

系统 SHALL 支持通过环境变量 `VITE_API_BASE_URL` 配置 API 基址。

#### Scenario: Web 端同源部署
- **WHEN** 应用运行在 Web 端（非 Capacitor、非 Electron）
- **THEN** API 基址使用默认值 `/api`，通过 Vite 代理访问本地后端

#### Scenario: 移动端原生 App
- **WHEN** 应用运行在 Capacitor 原生环境
- **THEN** API 基址使用 `VITE_API_BASE_URL` 环境变量（如 `https://<app>.vercel.app/api`）

#### Scenario: Electron 生产环境
- **WHEN** 应用运行在 Electron 生产环境
- **THEN** 继续使用现有 `getElectronApiUrl()` 获取 API 基址

### Requirement: 移动端 API 适配器迁移

系统 SHALL 支持移动端通过适配器使用统一后端 API。

#### Scenario: 默认使用统一后端
- **WHEN** 移动端应用启动且未设置 `VITE_MOBILE_USE_SUPABASE_DIRECT=true`
- **THEN** 所有 API 模块通过 webApi 调用统一后端

#### Scenario: 回退到 Supabase 直连
- **WHEN** 设置 `VITE_MOBILE_USE_SUPABASE_DIRECT=true`
- **THEN** 移动端回退到 Supabase 直连模式

### Requirement: 离线同步 Token 统一

系统 SHALL 使用统一的 token 获取函数进行离线同步。

#### Scenario: 离线队列回放
- **WHEN** 网络恢复后执行离线队列回放
- **THEN** 从 `useStore.getState().token` 获取 token，而非直接读取 localStorage

### Requirement: Service Worker 消息协议统一

系统 SHALL 统一 Service Worker 的 skipWaiting 消息格式。

#### Scenario: 触发 SW 更新
- **WHEN** 页面检测到新版本并发送更新消息
- **THEN** Service Worker 正确接收并执行 skipWaiting

## MODIFIED Requirements

### Requirement: 移动端 API 客户端配置

原实现：`getMobileApiBaseUrl()` 返回空字符串，移动端通过适配器使用 Supabase 直连。

新实现：`getMobileApiBaseUrl()` 返回 `VITE_API_BASE_URL` 环境变量值，移动端通过适配器默认使用统一后端。

### Requirement: 适配器模块映射

原实现：移动端环境下，适配器将多个模块映射到 Supabase 直连实现。

新实现：移动端环境下，适配器默认将所有模块映射到 webApi，仅保留 feature flag 支持回退。

## REMOVED Requirements

### Requirement: 移动端 Supabase 直连（逐步淘汰）

**Reason**: 统一后端 API 可降低维护成本，避免敏感信息泄露，复用错误处理和重试策略。

**Migration**: 通过 feature flag 支持渐进式迁移，保留 Supabase 直连代码作为回退方案。
