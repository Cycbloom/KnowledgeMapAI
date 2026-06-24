# 事件总线去除 await 阻塞 Spec

## Why

`appEventBus.publish()` 是 async 函数，所有 32 处调用都使用 `await`，导致主请求被事件处理器的 I/O 操作（缓存失效、SSE 推送）阻塞。事件处理器都是副作用，不应阻塞主请求返回。跨实例通信（Redis Pub/Sub）对 Electron 桌面应用无必要，不在本次范围内。

## What Changes

- 将 `appEventBus.publish()` 的返回类型从 `Promise<void>` 改为 `void`（fire-and-forget），内部异步执行所有处理器
- 将所有 32 处 `await appEventBus.publish(...)` 改为 `appEventBus.publish(...)`
- 处理器错误仍由 EventBus 内部捕获并记录日志

## Impact

- Affected code:
  - `api/services/core/eventBus.ts` — `publish()` 改为同步 fire-and-forget
  - 32 处 `await appEventBus.publish(...)` 调用点 — 移除 `await`

## ADDED Requirements

### Requirement: EventBus publish 为 fire-and-forget

`appEventBus.publish()` SHALL 以 fire-and-forget 模式执行所有处理器，不阻塞调用方。

#### Scenario: publish 不阻塞调用方
- **WHEN** `appEventBus.publish("graph_created", payload, userId)` 被调用
- **THEN** SHALL 立即返回（同步），处理器异步执行

#### Scenario: 处理器错误不传播
- **WHEN** 某个事件处理器抛出异常
- **THEN** SHALL 由 EventBus 内部捕获并记录 error 日志，不影响其他处理器和调用方

## MODIFIED Requirements

### Requirement: appEventBus.publish 返回类型

`publish()` 的返回类型 SHALL 从 `Promise<void>` 改为 `void`。

## REMOVED Requirements

（无移除）
