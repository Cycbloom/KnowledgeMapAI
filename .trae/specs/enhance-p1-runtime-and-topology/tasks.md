# Tasks

- [x] Task 1: 修复 cacheService LRU 淘汰算法 (A2.1)
  - [x] 1.1 在 `api/services/common/cacheService.ts` 顶部新增 `const accessOrder = new Map<string, number>()` 用于显式跟踪键的访问时间戳
  - [x] 1.2 修改 `cacheService.get`：在缓存命中（`value !== undefined`）分支内更新 `accessOrder.set(key, Date.now())`
  - [x] 1.3 修改 `cacheService.set` 的 LRU 淘汰逻辑：当达到 `MAX_CACHE_KEYS` 且需插入新键时，遍历 `accessOrder` 找出时间戳最小的键作为 `oldestKey`（不再使用 `localCache.keys()[0]`）
  - [x] 1.4 在 `cacheService.set` 成功写入后调用 `accessOrder.set(key, Date.now())` 更新新键时间戳
  - [x] 1.5 修改 `cacheService.del`：在删除 localCache 键的同时调用 `accessOrder.delete(k)` 清理时间戳
  - [x] 1.6 修改 `cacheService.flush`：在 `localCache.flushAll()` 后调用 `accessOrder.clear()`
  - [x] 1.7 移除原 `localCache.keys()[0]` 相关的注释，更新为 `// LRU eviction: select least-recently-accessed key from accessOrder`

- [x] Task 2: 统一 AI 监控装饰器入口 (A2.3)
  - [x] 2.1 在 `api/services/ai/aiMonitor.ts` 顶部 `withAIMonitoring` 的 JSDoc 注释中明确："此函数是所有 AI 调用监控的唯一规范入口，performanceMonitor.withAutoGraphTracking 应委托至此"
  - [x] 2.2 修改 `api/services/ai/performanceMonitor.ts` 的 `withAutoGraphTracking` 方法（第 450-541 行）：删除内部计时/token 计算/costBreakdown/recordLog 逻辑，改为单行委托：`return withAIMonitoring({ operation, provider: providerType, model, metadata, sessionId }, fn)`
  - [x] 2.3 在 `performanceMonitor.ts` 顶部新增 `import { withAIMonitoring } from './aiMonitor'`
  - [x] 2.4 修复 `api/services/ai/aiMonitor.ts` 的 `withEmbeddingMonitoring`（第 124-157 行）：
    - 在 `finally` 块中调用 `pricingService.calculateCost(options.provider, options.model || 'embedding-model', inputTokens, 0, 0)` 计算真实 `estimatedCost`
    - `inputTokens` 改为从 fn 返回的 `tokenCount` 读取；若未提供则用文本长度估算（每 4 字符 ≈ 1 token，仅在 tokenCount 缺失时使用）
    - `totalTokens` 改为 `inputTokens`（embedding 无 output）
    - 移除注释 "embedding按次计费，简化处理" 和 "embedding成本单独计算，这里简化为0"
  - [x] 2.5 验证：grep `withAutoGraphTracking` 调用点（应在 `api/services/ai/` 目录下），确认委托后行为一致

- [x] Task 3: STT-realtime per-user 连接独占 (A2.6)
  - [x] 3.1 在 `api/routes/ai/stt-realtime.ts` 的 `setupRealtimeSTT` 函数顶部新增 `const userConnections = new Map<string, WebSocket>()`
  - [x] 3.2 修改 `wss.on('connection')` 的认证回调：在 `getSupabaseAdmin().auth.getUser(token)` 成功后，从 `data.user.id` 获取 `userId`，并将 `userId` 透传到 connection handler（通过闭包或 `wss.emit('connection', ws, request, userId)`）
  - [x] 3.3 在 connection handler 开头（`try` 块内）：检查 `userConnections.get(userId)`，若存在且 `readyState === WebSocket.OPEN`，则向旧连接发送 close 帧 `oldWs.close(1000, 'replaced')`
  - [x] 3.4 在 connection handler 末尾（aliyunWs 创建成功后）调用 `userConnections.set(userId, clientWs)` 注册新连接
  - [x] 3.5 在 `clientWs.on('close')` 的 cleanup 回调中：检查 `if (userConnections.get(userId) === clientWs) userConnections.delete(userId)`，避免删除已被新连接替换的条目
  - [x] 3.6 在 `clientWs.on('error')` 的 cleanup 回调中同步执行上述引用清理
  - [x] 3.7 日志：在替换旧连接时记录 `logger.info('[STT-Realtime] Replaced existing connection for user ${userId}')`

- [x] Task 4: 图谱拓扑感知复习调度 (B1.1)
  - [x] 4.1 新建 `api/services/study/topologyScheduler.ts`，导出 `async function applyTopologyPriority(items: UnifiedReviewItem[], supabase: SupabaseClient, userId: string): Promise<UnifiedReviewItem[]>`
  - [x] 4.2 在 `applyTopologyPriority` 内：
    - 提取所有 `item.knowledgePointId` 数组 `kpIds`
    - 查询 `supabase.from('edges').select('source, target').eq('graph_id', ...).eq('type', 'prerequisite').in('target', kpIds)` 获取 prerequisite 关系（注意：edges 可能不限定 graph_id，需先从 knowledge_points 反查 graph_id，或直接按 target 查询所有 prerequisite 边）
    - 构建 `Map<targetKpId, sourceKpId[]>` 的 prerequisite 映射
    - 收集所有 sourceKpId，批量查询 `supabase.from('study_cards').select('knowledge_point_id, fsrs_retrievability').eq('user_id', userId).in('knowledge_point_id', sourceKpIds)` 获取前置节点 mastery
    - 构建 `Map<sourceKpId, mastery>` 映射
    - 对每个 item，检查其 prerequisite 中是否存在任一 mastery < 0.6，标记 `demoted` 标志
    - 按 urgency 分组（复用 `groupByUrgency`），对每个组内：将 `demoted` 的 item 向后移动 `Math.floor(groupLength / 2)` 个位置
    - 合并各组并保持 urgency 顺序返回
  - [x] 4.3 错误处理：try-catch 包裹整个逻辑，失败时 `logger.warn('[TopologyScheduler] Failed to apply topology priority:', error)` 并返回原始 items
  - [x] 4.4 在 `api/services/study/spacedRepetitionBridge.ts` 的 `getUnifiedReviewQueue` 中，语义排序完成后（第 69 行 `return result` 之前）调用 `applyTopologyPriority(result, supabase, userId)` 并返回其结果
  - [x] 4.5 验证 `UnifiedReviewItem` 类型已从 `spacedRepetitionBridge.ts` 导出（第 207 行已导出），在 `topologyScheduler.ts` 中通过 `import type { UnifiedReviewItem } from './spacedRepetitionBridge'` 引用
  - [x] 4.6 边界情况：当 `items.length === 0` 或 `kpIds.length === 0` 时直接返回 items，不执行查询

# Task Dependencies
- Task 1 / 2 / 3 / 4 互不依赖，可并行实施
- Task 4 的 4.4 修改 `spacedRepetitionBridge.ts` 时需确保不破坏现有 `semanticInterferenceService.getSemanticSpacedOrder` 调用链
