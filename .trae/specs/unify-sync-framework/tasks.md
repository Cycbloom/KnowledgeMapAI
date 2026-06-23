# Tasks

## Phase 1: 共享同步逻辑提取

- [x] Task 1: 创建共享同步逻辑模块
  - [x] SubTask 1.1: 创建 `shared/sync/operationMerger.ts`，从 `electron/sync/syncEngine.ts` 第 203-241 行提取操作合并逻辑为纯函数 `mergeOperations(ops: SyncOperation[]): SyncOperation[]`
  - [x] SubTask 1.2: 创建 `shared/sync/conflictDetector.ts`，从 `src/services/sync/conflictService.ts` 第 102-153 行提取冲突检测逻辑为纯函数 `detectConflict(local: SyncOperation, remote: SyncOperation): boolean`
  - [x] SubTask 1.3: 创建 `shared/sync/conflictResolver.ts`，统一冲突解决策略：默认 Cloud Wins + 可选手动解决（local/remote/merge），从 `conflictService.ts` 的 `autoResolveConflict` 和 `resolveConflict` 方法提取
  - [x] SubTask 1.4: 创建 `shared/sync/types.ts`，从 `src/services/sync/syncTypes.ts` 迁移类型定义，修复 `Record<string, any>` 为 `Record<string, unknown>`
  - [x] SubTask 1.5: 创建 `shared/sync/index.ts` 统一导出

## Phase 2: Electron 端重构

- [x] Task 2: 重构 Electron SyncEngine 使用共享逻辑
  - [x] SubTask 2.1: 修改 `electron/sync/syncEngine.ts` 的 `pushToCloud()` 方法（第 203-241 行），将内联操作合并逻辑替换为调用 `shared/sync/operationMerger.mergeOperations()`
  - [x] SubTask 2.2: 修改 `electron/sync/syncEngine.ts` 的冲突处理（第 304-316 行），将 Cloud Wins 逻辑替换为调用 `shared/sync/conflictResolver.resolveConflict()`
  - [x] SubTask 2.3: 修复 `electron/sync/syncEngine.ts` 中 12 处 `console.log/error`，替换为 `logger` 工具调用（需引入 `api/utils/logger` 或创建 Electron 专用 logger）

## Phase 3: 移动端同步补全

- [x] Task 3: 补全移动端同步核心方法
  - [x] SubTask 3.1: 实现 `mobileSyncService.ts` 的 `applyOperation()` 方法（第 201-202 行）：根据 operation.type 通过 Supabase 客户端执行 create/update/delete 操作
  - [x] SubTask 3.2: 实现 `mobileSyncService.ts` 的 `getLocalVersion()` 方法（第 204-218 行）：通过 Supabase 客户端查询实际记录，返回真实数据
  - [x] SubTask 3.3: 修复 `mobileSyncService.ts` 中 3 处硬编码 `userId: "user-placeholder"`（第 99、125、216 行），改为从 Supabase Auth session 获取实际用户 ID
  - [x] SubTask 3.4: 重构 `mobileSyncService.ts` 使用 `shared/sync/operationMerger` 和 `shared/sync/conflictResolver`，替换 `conflictService.ts` 的直接调用
  - [x] SubTask 3.5: 重构 `conflictService.ts` 为 `shared/sync/conflictResolver` 的薄封装（保持向后兼容），或直接删除并更新引用

- [x] Task 4: 补全设备发现服务
  - [x] SubTask 4.1: 实现 `deviceDiscoveryService.ts` 的 `pollForDevices()` 方法（第 40-41 行）：通过后端 API 查询在线设备列表（而非空实现）

## Phase 4: P2P 同步 API 端点

- [x] Task 5: 新增后端 P2P 同步端点
  - [x] SubTask 5.1: 在 `api/routes/sync.ts` 新增 `POST /api/sync/receive` 端点：验证 sync token，接收 SyncBatch，做冲突检测，返回冲突结果和本地待推送操作
  - [x] SubTask 5.2: 在 `api/routes/sync.ts` 新增 `GET /api/sync/send` 端点：验证 sync token，返回该用户待推送的同步操作
  - [x] SubTask 5.3: 在 `api/services/sync/` 中实现 P2P 同步业务逻辑：token 验证、操作接收、冲突检测、操作返回

## Phase 5: 安全修复

- [x] Task 6: 修复同步认证安全漏洞
  - [x] SubTask 6.1: 修改 `syncAuthService.ts` 的 `generateSharedSecret()` 方法（第 169-171 行），使用 `crypto.getRandomValues()` 替代 `Math.random()`
  - [x] SubTask 6.2: 修改 `syncAuthService.ts` 的 `generateSyncToken()` 方法（第 119-131 行），使用 HMAC-SHA256 签名替代 `btoa` 编码
  - [x] SubTask 6.3: 修改 `syncAuthService.ts` 的 `validateSyncToken()` 方法（第 133-159 行），使用 HMAC-SHA256 验证替代 `atob` 解码

## Phase 6: 代码规范修复

- [x] Task 7: 修复代码规范违规
  - [x] SubTask 7.1: 修改 `syncTypes.ts` 第 5 行 `Record<string, any>` 为 `Record<string, unknown>`（若 Task 1.4 已迁移类型则跳过）
  - [x] SubTask 7.2: 修改移动端代码中 7 处 `substr()` 调用为 `substring()` 或 `slice()`（mobileSyncService.ts 第 28、29、121、186、210 行，conflictService.ts 第 91 行，syncAuthService.ts 第 59 行）
  - [x] SubTask 7.3: 修改移动端代码中 `console.error` 为 `console.warn`（mobileSyncService.ts 第 79、172、183 行，syncAuthService.ts 第 11、19、44、53 行，deviceDiscoveryService.ts 无 console 调用）

## Phase 7: 验证

- [x] Task 8: 验证统一同步框架
  - [x] SubTask 8.1: 验证共享逻辑模块：操作合并、冲突检测、冲突解决策略的单元测试通过
  - [x] SubTask 8.2: 验证 Electron 端重构后同步行为不变（Cloud Wins 策略、操作合并结果一致）
  - [x] SubTask 8.3: 验证移动端 `applyOperation` 和 `getLocalVersion` 实现正确
  - [x] SubTask 8.4: 验证 P2P 同步端点可正常接收和返回操作
  - [x] SubTask 8.5: 验证安全修复：token 使用 HMAC 签名、密钥使用密码学安全随机数
  - [x] SubTask 8.6: 运行 `npm run check` 确认无类型错误

# Task Dependencies

- Task 2 依赖 Task 1（需要共享逻辑模块）
- Task 3 依赖 Task 1（需要共享逻辑模块）
- Task 4 可独立开始
- Task 5 可与 Task 2-4 并行开发
- Task 6 可独立开始
- Task 7 可独立开始
- Task 8 依赖 Task 1-7 全部完成
