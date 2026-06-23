# Tasks

- [x] Task 1: 为 SSEService 增加连接数限制和死连接剔除
  - [x] SubTask 1.1: 在 `api/services/core/sseService.ts` 的 `SSEService` 类中新增私有字段 `maxConnectionsPerUser: number = 5` 和 `maxWriteFailures: number = 3`
  - [x] SubTask 1.2: 新增私有字段 `writeFailures: Map<Response, number>` 跟踪每个客户端的连续写入失败次数
  - [x] SubTask 1.3: 修改 `addClient` 方法：在 push 前检查当前连接数，达到上限时记录 warn 日志并返回 `false`，否则正常添加并返回 `true`
  - [x] SubTask 1.4: 修改 `sendToUser` 方法：`data` 参数类型从 `any` 改为 `unknown`；`client.write()` 包裹在 try/catch 中，捕获异常或返回 `false` 时递增失败计数，达到阈值调用 `removeClient` + `res.end()`；成功时重置失败计数为 0
  - [x] SubTask 1.5: 提取私有方法 `handleWriteResult(userId: string, client: Response, writeResult: boolean): void` 封装失败计数逻辑，供 `sendToUser` 和心跳复用
  - [x] SubTask 1.6: 修改 `startHeartbeat` 中的心跳写入：复用 `handleWriteResult` 处理写入失败，使心跳也能剔除死连接

- [x] Task 2: 心跳定时器可停止
  - [x] SubTask 2.1: 在 `SSEService` 类中新增私有字段 `heartbeatInterval: NodeJS.Timeout | null = null`
  - [x] SubTask 2.2: 修改 `startHeartbeat` 方法：将 `setInterval` 返回值赋给 `this.heartbeatInterval`；若已有心跳先清除再启动（幂等）
  - [x] SubTask 2.3: 新增 `stopHeartbeat(): void` 方法：若 `heartbeatInterval` 非空则 `clearInterval` 并置 null，空时无副作用

- [x] Task 3: 路由处理器处理连接拒绝
  - [x] SubTask 3.1: 修改 `api/routes/tasks.ts` 第 40 行：检查 `sseService.addClient(userId, res)` 返回值
  - [x] SubTask 3.2: 若返回 `false`（连接数上限），写入 429 状态码和错误消息后 `res.end()`，不发送 connected 消息

- [x] Task 4: 编写单元测试
  - [x] SubTask 4.1: 创建 `api/__tests__/services/sseService.test.ts`，使用 mock Response 对象（模拟 `write`、`on`、`end` 方法）
  - [x] SubTask 4.2: 测试用例"连接数未达上限时接受"：addClient 返回 true，clients 数组包含新连接
  - [x] SubTask 4.3: 测试用例"连接数达上限时拒绝"：连续 addClient 6 次，第 6 次返回 false
  - [x] SubTask 4.4: 测试用例"连接关闭后可重新建立"：addClient 5 次后 removeClient 1 次，再 addClient 返回 true
  - [x] SubTask 4.5: 测试用例"写入失败累计剔除"：mock write 返回 false 3 次，验证客户端被移除并调用 res.end
  - [x] SubTask 4.6: 测试用例"中途成功重置失败计数"：write 失败 2 次后成功 1 次，再失败 2 次不应剔除
  - [x] SubTask 4.7: 测试用例"stopHeartbeat 清除定时器"：startHeartbeat 后 stopHeartbeat，验证 clearInterval 被调用
  - [x] SubTask 4.8: 测试用例"stopHeartbeat 未启动时无副作用"：直接调用 stopHeartbeat 不抛异常

- [x] Task 5: 验证与回归
  - [x] SubTask 5.1: 运行 `npm run check:incremental` 确认类型检查通过（修改的文件零错误，3 个预先存在的错误在其他文件）
  - [x] SubTask 5.2: 运行新增的单元测试确认全部通过（7/7 通过）
  - [x] SubTask 5.3: 验证 `sseNotificationSubscriber.ts` 和 `asyncTaskService.ts` 的 `sendToUser` 调用无需修改（`unknown` 类型兼容原 `any` 调用）

# Task Dependencies
- [Task 2] 独立于 [Task 1]，可并行
- [Task 3] 依赖 [Task 1] -- 路由处理依赖 addClient 返回值
- [Task 4] 依赖 [Task 1] 和 [Task 2] -- 测试验证两者行为
- [Task 5] 依赖 [Task 4]
