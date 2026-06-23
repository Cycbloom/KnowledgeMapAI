# SSE 连接安全加固 Checklist

## 连接数限制
- [x] SSEService 新增 `maxConnectionsPerUser`（默认 5）和 `maxWriteFailures`（默认 3）配置
- [x] `addClient` 返回 `boolean`，达到上限时返回 `false` 并记录 warn 日志
- [x] `api/routes/tasks.ts` 检查 `addClient` 返回值，`false` 时返回 429 + 关闭连接

## 心跳可停止
- [x] SSEService 新增 `heartbeatInterval: NodeJS.Timeout | null` 字段保存定时器引用
- [x] `startHeartbeat` 将 `setInterval` 返回值赋给 `heartbeatInterval`，幂等（已有先清除）
- [x] 新增 `stopHeartbeat()` 方法清除定时器并置 null，未启动时无副作用

## 死连接剔除
- [x] 新增 `writeFailures: Map<Response, number>` 跟踪连续写入失败次数
- [x] `sendToUser` 中 `client.write()` 失败（异常或返回 false）时递增失败计数
- [x] 失败计数达到阈值（3）时调用 `removeClient` + `res.end()` 释放资源
- [x] 写入成功时重置失败计数为 0
- [x] 心跳写入复用失败计数逻辑，同样能剔除死连接

## 类型安全
- [x] `sendToUser` 的 `data` 参数类型从 `any` 改为 `unknown`
- [x] 无新增 `any` 类型或非空断言 `!`

## 测试覆盖
- [x] 创建 `api/__tests__/services/sseService.test.ts` 单元测试文件
- [x] 测试"连接数未达上限时接受"通过
- [x] 测试"连接数达上限时拒绝"通过
- [x] 测试"连接关闭后可重新建立"通过
- [x] 测试"写入失败累计剔除"通过
- [x] 测试"中途成功重置失败计数"通过
- [x] 测试"stopHeartbeat 清除定时器"通过
- [x] 测试"stopHeartbeat 未启动时无副作用"通过

## 回归验证
- [x] `npm run check:incremental` 类型检查通过（修改的文件零错误，3 个预先存在的错误在其他文件）
- [x] 新增单元测试全部通过（7/7）
- [x] `sseNotificationSubscriber.ts` 和 `asyncTaskService.ts` 的 `sendToUser` 调用无需修改
