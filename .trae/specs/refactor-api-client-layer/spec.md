# API 调用层优化规范

## Why
当前 `client.ts` 中的 token 刷新逻辑和错误处理分散在模块级变量和 request 函数中，代码可读性和可维护性较差。通过使用 Axios 拦截器模式和独立的 `TokenRefreshManager` 类，可以显著提升代码的清晰度和可测试性。

## What Changes
- 创建 `TokenRefreshManager` 类封装 token 刷新逻辑
- 使用 Axios 拦截器替代手动请求/响应处理
- 重构 `client.ts` 使用新的架构
- 保持现有 API 接口不变，确保向后兼容

## Impact
- Affected specs: API 调用层架构
- Affected code:
  - `src/services/api/client.ts`
  - 新增 `src/services/api/TokenRefreshManager.ts`
  - 新增 `src/services/api/createApiClient.ts`

## ADDED Requirements

### Requirement: TokenRefreshManager 类
系统 SHALL 提供 `TokenRefreshManager` 类用于管理 token 刷新逻辑。

#### Scenario: 单例模式获取实例
- **WHEN** 多次调用 `TokenRefreshManager.getInstance()`
- **THEN** 返回同一个实例

#### Scenario: Token 刷新请求队列
- **WHEN** 多个请求同时遇到 token 过期
- **THEN** 只有第一个请求触发刷新，其他请求等待刷新完成后使用新 token 重试

#### Scenario: 刷新成功
- **WHEN** token 刷新成功
- **THEN** 更新 store 中的 token，所有等待的请求使用新 token 重试

#### Scenario: 刷新失败
- **WHEN** token 刷新失败
- **THEN** 清除用户登录状态，所有等待的请求抛出认证错误

#### Scenario: 检查是否需要刷新
- **WHEN** 调用 `shouldRefreshToken(error)`
- **THEN** 根据错误类型返回是否需要刷新 token

### Requirement: Axios 拦截器模式
系统 SHALL 使用 Axios 拦截器处理请求和响应。

#### Scenario: 请求拦截器添加认证头
- **WHEN** 发起 API 请求
- **THEN** 自动添加 Authorization 和 CSRF token 头

#### Scenario: 响应拦截器处理错误
- **WHEN** 收到错误响应
- **THEN** 自动转换为对应的 AppError 类型

#### Scenario: 响应拦截器处理 token 过期
- **WHEN** 收到 401 错误且需要刷新 token
- **THEN** 自动触发 token 刷新并重试请求

### Requirement: 向后兼容的 API 接口
系统 SHALL 保持现有 `client.ts` 导出的函数签名不变。

#### Scenario: request 函数
- **WHEN** 调用 `request<T>(url, options)`
- **THEN** 行为与重构前完全一致

#### Scenario: getHeaders 函数
- **WHEN** 调用 `getHeaders()`
- **THEN** 返回包含认证信息的 headers 对象

#### Scenario: initCsrf 函数
- **WHEN** 调用 `initCsrf()`
- **THEN** 初始化 CSRF token

#### Scenario: 辅助函数
- **WHEN** 调用 `getAIConfig`、`injectAIConfig`、`getApiUrl`
- **THEN** 行为与重构前完全一致

## MODIFIED Requirements

### Requirement: 错误处理统一化
原有的 `handleResponse` 函数逻辑 SHALL 通过 Axios 拦截器实现。

#### Scenario: 响应解析
- **WHEN** 收到成功响应
- **THEN** 自动解析 JSON 数据

#### Scenario: 错误转换
- **WHEN** 收到错误响应
- **THEN** 使用 `createErrorFromResponse` 转换为 AppError
