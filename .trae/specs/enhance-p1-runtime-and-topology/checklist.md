# Checklist

## A2.1 缓存 LRU 淘汰
- [x] `cacheService.ts` 顶部新增 `accessOrder: Map<string, number>` 声明
- [x] `cacheService.get` 在缓存命中分支调用 `accessOrder.set(key, Date.now())`
- [x] `cacheService.set` 的 LRU 淘汰逻辑改为遍历 `accessOrder` 找最小时间戳键，不再使用 `localCache.keys()[0]`
- [x] `cacheService.set` 成功写入后更新 `accessOrder.set(key, Date.now())`
- [x] `cacheService.del` 同步调用 `accessOrder.delete(k)`
- [x] `cacheService.flush` 同步调用 `accessOrder.clear()`
- [x] 日志 `[Cache] LRU evicted: ${evictedKey}` 保留，且被淘汰的键确实是 accessOrder 中时间戳最小者

## A2.3 监控装饰器统一
- [x] `aiMonitor.ts` 的 `withAIMonitoring` JSDoc 注释明确"唯一规范入口"定位
- [x] `performanceMonitor.ts` 的 `withAutoGraphTracking` 方法体仅剩委托调用，无独立的计时/token/cost 计算
- [x] `performanceMonitor.ts` 顶部新增 `import { withAIMonitoring } from './aiMonitor'`
- [x] `withEmbeddingMonitoring` 的 `inputTokens` 从 fn 返回的 `tokenCount` 读取（或文本长度估算）
- [x] `withEmbeddingMonitoring` 的 `estimatedCost` 通过 `pricingService.calculateCost` 计算，不再硬编码 0
- [x] `withEmbeddingMonitoring` 的 `totalTokens` 等于 `inputTokens`，不再硬编码 1
- [x] grep `withAutoGraphTracking` 调用点确认签名未变、行为一致

## A2.6 STT 连接治理
- [x] `setupRealtimeSTT` 函数顶部新增 `userConnections: Map<string, WebSocket>`
- [x] 认证回调中提取 `userId` 并透传到 connection handler
- [x] connection handler 开头检查并关闭同用户旧连接（close code=1000, reason="replaced"）
- [x] connection handler 末尾调用 `userConnections.set(userId, clientWs)`
- [x] `clientWs.on('close')` 回调中执行 `if (userConnections.get(userId) === clientWs) userConnections.delete(userId)`
- [x] `clientWs.on('error')` 回调同步清理引用
- [x] 替换旧连接时记录 info 日志
- [x] 不同用户的连接互不影响（逻辑用 userId 作为 Map key 隔离）

## B1.1 图谱拓扑感知调度
- [x] 新建 `api/services/study/topologyScheduler.ts` 并导出 `applyTopologyPriority`
- [x] 函数签名：`(items: UnifiedReviewItem[], supabase: SupabaseClient, userId: string) => Promise<UnifiedReviewItem[]>`
- [x] 查询 `edges` 表 `type='prerequisite'` 且 `target in kpIds` 的关系
- [x] 批量查询 `study_cards` 获取前置节点 mastery（`fsrs_retrievability` 字段）
- [x] 对任一前置 mastery < 0.6 的 item 标记 `demoted`
- [x] 按 urgency 分组，组内 demoted item 向后移动 `Math.floor(groupLength / 2)` 个位置
- [x] 整个逻辑 try-catch 包裹，失败时 warn 日志并返回原始 items
- [x] `items.length === 0` 或 `kpIds.length === 0` 时直接返回，不查询
- [x] `spacedRepetitionBridge.getUnifiedReviewQueue` 在语义排序后调用 `applyTopologyPriority`
- [x] `topologyScheduler.ts` 通过 `import type { UnifiedReviewItem } from './spacedRepetitionBridge'` 引用类型
- [x] 不破坏 `semanticInterferenceService.getSemanticSpacedOrder` 调用链

## 类型检查与回归
- [x] `npm run check` 通过（exit 0）
- [x] grep 确认无新增 `console.log`（API 层应使用 logger）
- [x] grep 确认无 `any` 类型新增
- [x] grep 确认无非空断言 `!` 新增
