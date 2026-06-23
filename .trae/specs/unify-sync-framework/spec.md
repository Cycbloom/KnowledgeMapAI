# 统一同步框架 Spec

## Why

移动端同步服务（`mobileSyncService.ts`）核心方法 `applyOperation` 完全空实现，调用的后端 API 端点（`/api/sync/receive`、`/api/sync/send`）不存在，整个移动端同步不可用。Electron 端和移动端使用完全不同的冲突策略（Cloud Wins vs Timestamp Wins），代码大量重复且行为不一致。此外存在安全漏洞（`btoa` 编码 token、`Math.random()` 生成密钥）和代码规范违规（`any` 类型、`console.log`、废弃 `substr()`）。

## What Changes

- **新增共享同步逻辑模块**：将操作合并、冲突检测、冲突解决策略提取到 `shared/sync/` 目录，Electron 端和移动端复用
- **统一冲突解决策略**：两端采用一致的冲突策略——默认 Cloud Wins（与后端 `syncService` 一致），同时支持手动解决（local/remote/merge）
- **补全移动端同步核心方法**：实现 `applyOperation`、`getLocalVersion`，修复硬编码 `userId`
- **新增移动端同步 API 端点**：在 Express 后端新增 `/api/sync/receive` 和 `/api/sync/send`，支持 P2P 同步路径
- **修复安全问题**：使用 `crypto.getRandomValues()` 替代 `Math.random()` 生成密钥，使用 HMAC 替代 `btoa` 生成 token
- **修复代码规范**：消除 `any` 类型、替换 `console.log/error` 为 `logger`/`console.warn`、替换废弃 `substr()` 为 `substring()`

## Impact

- Affected specs: local-first-sqlite（同步引擎部分）、sync-operation-tracking（操作日志部分）
- Affected code:
  - `shared/sync/` — 新增共享同步逻辑目录
  - `electron/sync/syncEngine.ts` — 重构为使用共享逻辑，修复 console 违规
  - `src/services/sync/mobileSyncService.ts` — 补全核心方法，使用共享逻辑
  - `src/services/sync/conflictService.ts` — 重构为使用共享冲突策略
  - `src/services/sync/deviceDiscoveryService.ts` — 补全 pollForDevices
  - `src/services/sync/syncAuthService.ts` — 修复安全问题
  - `src/services/sync/syncTypes.ts` — 修复 any 类型
  - `api/routes/sync.ts` — 新增 P2P 同步端点
  - `api/services/sync/` — 新增 P2P 同步服务逻辑

## ADDED Requirements

### Requirement: 共享同步逻辑模块

系统 SHALL 在 `shared/sync/` 目录提供跨端复用的同步核心逻辑，包括操作合并、冲突检测和冲突解决策略。

#### Scenario: 操作合并
- **WHEN** 同一记录存在多条待同步操作（如 create + update、update + update、create + delete）
- **THEN** 系统按以下规则合并：
  - create + update → 合并 update 字段到 create 数据中
  - update + update → 后者字段覆盖前者
  - create + delete → 移除操作（服务端从未见过此记录）
  - update + delete → 保留 delete

#### Scenario: 冲突检测
- **WHEN** 两个操作针对同一记录且存在字段级冲突（同键不同值，排除 created_at/updated_at/id）
- **THEN** 系统检测到冲突，返回冲突详情

#### Scenario: 冲突解决策略
- **WHEN** 检测到同步冲突
- **THEN** 默认采用 Cloud Wins 策略（服务端数据覆盖本地），同时支持手动选择 local/remote/merge 三种策略

---

### Requirement: 移动端同步核心方法补全

系统 SHALL 补全移动端同步服务的核心方法，使移动端同步功能可用。

#### Scenario: applyOperation 实现
- **WHEN** 远程同步操作到达移动端
- **THEN** 系统根据操作类型（create/update/delete）通过 Supabase 客户端执行对应操作，操作失败时创建冲突记录

#### Scenario: getLocalVersion 实现
- **WHEN** 需要获取本地记录版本用于冲突检测
- **THEN** 系统通过 Supabase 客户端查询对应记录，返回实际数据而非模拟数据

#### Scenario: userId 获取
- **WHEN** 移动端同步服务需要用户 ID
- **THEN** 从认证状态（Supabase Auth session）获取实际用户 ID，不再使用硬编码 "user-placeholder"

---

### Requirement: P2P 同步 API 端点

系统 SHALL 在 Express 后端新增 P2P 同步 API 端点，支持设备间直连同步。

#### Scenario: 接收远程操作
- **WHEN** 客户端调用 `POST /api/sync/receive`
- **THEN** 接收 SyncBatch 数据，验证 sync token，将远程操作与本地数据做冲突检测，返回冲突结果和本地待推送操作

#### Scenario: 发送本地操作
- **WHEN** 客户端调用 `GET /api/sync/send`
- **THEN** 验证 sync token，返回该用户待推送的同步操作列表

#### Scenario: Token 验证
- **WHEN** P2P 同步请求到达
- **THEN** 验证 `X-Sync-Token` 和 `X-Device-Id` header，拒绝无效请求

---

### Requirement: 同步认证安全修复

系统 SHALL 修复移动端同步认证中的安全漏洞。

#### Scenario: 密钥生成
- **WHEN** 生成设备配对的共享密钥
- **THEN** 使用 `crypto.getRandomValues()` 生成密码学安全的随机值，不再使用 `Math.random()`

#### Scenario: Token 生成
- **WHEN** 生成同步认证 token
- **THEN** 使用 HMAC-SHA256 签名（基于共享密钥），不再使用 `btoa` 简单编码

#### Scenario: Token 验证
- **WHEN** 验证同步认证 token
- **THEN** 使用 HMAC-SHA256 验证签名，检查 token 有效期（10 分钟），拒绝无效或过期 token

---

### Requirement: 代码规范修复

系统 SHALL 修复同步模块中的代码规范违规。

#### Scenario: 消除 any 类型
- **WHEN** `syncTypes.ts` 中 `SyncOperation.record` 的类型为 `Record<string, any>`
- **THEN** 改为 `Record<string, unknown>`

#### Scenario: 日志规范
- **WHEN** Electron 端 `syncEngine.ts` 使用 `console.log/error`
- **THEN** 改为使用 `logger` 工具（后端规范）

#### Scenario: 废弃 API 替换
- **WHEN** 移动端代码使用 `String.prototype.substr()`
- **THEN** 替换为 `substring()` 或 `slice()`

#### Scenario: 前端日志规范
- **WHEN** 移动端代码使用 `console.error`
- **THEN** 改为 `console.warn`（前端允许 warn/error）

## MODIFIED Requirements

### Requirement: 双向同步引擎（来自 local-first-sqlite spec）

冲突处理逻辑从 Electron 端内联实现改为调用 `shared/sync/` 中的共享冲突策略模块，行为保持 Cloud Wins 不变，但逻辑与移动端统一来源。

### Requirement: 同步冲突处理（来自 sync-operation-tracking spec）

Push 冲突处理逻辑从 `syncEngine.ts` 内联实现改为调用共享冲突策略模块，行为不变。

## REMOVED Requirements

（无移除项，此优化为增量改造）
