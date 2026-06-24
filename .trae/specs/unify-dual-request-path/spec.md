# 统一双路径请求逻辑 Spec

## Why

`client.ts` 的 `request()` 和 `createApiClient.ts` 的 `apiClient` 存在 token/CSRF 注入逻辑重复（两处各 ~10 行），且 `client.ts` 中存在 3 个无人使用的死代码导出（`getHeaders`、`handleResponse`、`getCookie`）。此外，`request()` 中的 Local-First 决策逻辑（tryLocalQuery → fallback to apiClient）可以通过 Axios 适配器模式更优雅地集成到 `apiClient` 中，使所有请求统一走 Axios 管道。

## What Changes

- 移除 `client.ts` 中无人使用的导出：`getHeaders`、`handleResponse`、`getCookie`（仅 `client.ts` 内部使用 `getCookie`）
- 将 `request()` 中的 Local-First 逻辑（tryLocalQuery + fallback）提取为 Axios 请求适配器，注册到 `apiClient` 的拦截器中
- `client.ts` 的 `request()` 简化为 `apiClient.request()` 的薄包装（仅做参数格式转换）
- 将 `initCsrf` 移入 `createApiClient.ts`，在 Axios 实例创建时初始化

## Impact

- Affected code:
  - `src/services/api/client.ts` — 移除死代码，简化 `request()`
  - `src/services/api/createApiClient.ts` — 添加 Local-First 适配器 + CSRF 初始化
  - `src/services/api/localClient.ts` — 无变更
- Affected consumers: 无（`request()` 签名不变，`apiClient` 行为不变）

## ADDED Requirements

### Requirement: Local-First 请求适配器

`apiClient` SHALL 通过 Axios 请求适配器实现 Local-First 逻辑，在 Electron 生产环境中优先尝试 IPC → SQLite，失败时 fallback 到远程 API。

#### Scenario: Electron 生产环境 GET 请求
- **WHEN** `apiClient.get('/scheduler/tasks')` 在 Electron 生产环境中调用
- **THEN** SHALL 先尝试 `localQuery`，若返回非 null 则直接返回；否则继续远程请求

#### Scenario: 非 Electron 环境
- **WHEN** `apiClient.get('/scheduler/tasks')` 在浏览器中调用
- **THEN** SHALL 直接发起远程请求，不尝试 Local-First

### Requirement: 统一 CSRF 初始化

CSRF 初始化 SHALL 在 `apiClient` 创建时自动完成，无需调用方手动调用 `initCsrf()`。

#### Scenario: apiClient 创建时自动初始化 CSRF
- **WHEN** `createApiClient()` 被调用
- **THEN** SHALL 自动获取 CSRF token（非阻塞，失败时仅 warn）

## MODIFIED Requirements

### Requirement: client.ts 职责

`client.ts` SHALL 仅导出 `request()` 函数和辅助工具（`initCsrf`、`getAIConfig`、`injectAIConfig`、`getApiUrl`），不再负责 token/CSRF 注入和响应处理。

## REMOVED Requirements

### Requirement: getHeaders / handleResponse 导出
**Reason**: 无任何消费者使用，属于死代码
**Migration**: 直接删除

### Requirement: client.ts 中的 getCookie 重导出
**Reason**: `getCookie` 仅在 `client.ts` 内部使用（`initCsrf` 和 `getHeaders`），无需重导出
**Migration**: 移除 `export { getCookie }`，改为仅从 `createApiClient.ts` 导入
