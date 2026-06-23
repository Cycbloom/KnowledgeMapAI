# SSE 连接安全加固 Spec

## Why
`api/services/core/sseService.ts` 的 `addClient` 无最大连接数限制，单用户可建立任意数量连接，存在资源耗尽风险（内存、文件描述符）。第 49 行 `setInterval` 返回值未保存，无法停止心跳，测试环境会泄漏定时器。`sendToUser` 同步调用 `client.write()`，写入失败仅记录日志不剔除死连接，慢客户端或已断开连接会持续占用资源并产生错误日志噪声。

现有 `fix-security-vulnerabilities` spec 聚焦 ShareModal 权限问题，与 SSE 无关。本 spec 补充 SSE 层的连接安全加固。

## What Changes
- `addClient` 增加单用户连接数上限（默认 5），超出时拒绝并记录 warn 日志，返回 `boolean` 表示是否接受
- `startHeartbeat` 保存 `setInterval` 返回值，新增 `stopHeartbeat()` 方法用于清理（测试场景）
- `sendToUser` 和心跳写入检测 `client.write()` 返回值，返回 `false`（背压）或抛异常时累计失败次数，连续失败超过阈值（默认 3 次）自动剔除该客户端
- 修复 `sendToUser` 的 `data: any` 类型为 `unknown`（符合项目类型安全规范）
- 调用方 `api/routes/tasks.ts` 根据 `addClient` 返回值处理拒绝场景（发送 429 + 关闭连接）

## Impact
- Affected code: `api/services/core/sseService.ts`, `api/routes/tasks.ts`
- Affected specs: 无破坏性变更，与 `fix-security-vulnerabilities` 互补
- 调用方 `sseNotificationSubscriber.ts`、`asyncTaskService.ts` 的 `sendToUser` 调用无需修改（签名仅放宽类型）

## ADDED Requirements

### Requirement: 单用户 SSE 连接数限制
系统 SHALL 限制单用户最大 SSE 连接数为 5（可配置），超出时拒绝新连接。

#### Scenario: 连接数未达上限
- **WHEN** 用户已有 3 个连接，请求第 4 个
- **THEN** 接受连接，`addClient` 返回 `true`

#### Scenario: 连接数达到上限
- **WHEN** 用户已有 5 个连接，请求第 6 个
- **THEN** 拒绝连接，`addClient` 返回 `false`，记录 warn 日志

#### Scenario: 连接关闭后可重新建立
- **WHEN** 用户关闭一个连接后（连接数从 5 降至 4），请求新连接
- **THEN** 接受连接，`addClient` 返回 `true`

### Requirement: 心跳定时器可停止
系统 SHALL 保存心跳 `setInterval` 返回值，并提供 `stopHeartbeat()` 方法停止心跳。

#### Scenario: 停止心跳
- **WHEN** 调用 `stopHeartbeat()`
- **THEN** 清除心跳定时器，不再发送 keep-alive 消息

#### Scenario: 重复停止心跳
- **WHEN** 心跳未启动时调用 `stopHeartbeat()`
- **THEN** 无副作用，不抛出异常

### Requirement: 死连接自动剔除
系统 SHALL 在客户端写入连续失败超过阈值（默认 3 次）时自动剔除该连接。

#### Scenario: 写入成功
- **WHEN** `client.write()` 返回 `true` 或正常执行
- **THEN** 重置该客户端失败计数为 0

#### Scenario: 写入失败累计
- **WHEN** `client.write()` 抛出异常或返回 `false`
- **THEN** 该客户端失败计数 +1

#### Scenario: 连续失败超阈值剔除
- **WHEN** 客户端失败计数达到 3
- **THEN** 从 `clients` Map 中移除该连接，记录 warn 日志，触发 `res.end()` 释放资源

#### Scenario: 中途成功重置
- **WHEN** 客户端失败 2 次后第 3 次写入成功
- **THEN** 失败计数重置为 0，不剔除

## MODIFIED Requirements

### Requirement: addClient 方法签名
`addClient(userId: string, res: Response)` SHALL 返回 `boolean`，`true` 表示接受，`false` 表示因连接数上限拒绝。

### Requirement: sendToUser 方法签名
`sendToUser(userId: string, data: any)` 的 `data` 类型 SHALL 改为 `unknown`，符合项目类型安全规范。

### Requirement: 路由处理器拒绝处理
`api/routes/tasks.ts` 的 SSE 端点 SHALL 检查 `addClient` 返回值，`false` 时返回 429 状态码并关闭连接。
