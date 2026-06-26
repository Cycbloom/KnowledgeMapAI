# P1 运行时稳定性与拓扑感知调度 Spec

## Why
P0 修复完成后，P1 层级仍存在四个影响系统稳定性、可观测性与学习科学性的问题：
1. **A2.1 缓存 LRU 算法缺陷**：`cacheService.set` 第 90-97 行依赖 `localCache.keys()[0]` 作为"最旧键"进行淘汰，但 NodeCache 的 `keys()` 不保证插入顺序，导致 LRU 淘汰实际是随机淘汰，可能误删热点数据。
2. **A2.3 AI 监控装饰器重复**：`withAIMonitoring`（aiMonitor.ts）与 `performanceMonitor.withAutoGraphTracking`（performanceMonitor.ts 第 450-541 行）实现几乎完全相同，维护两套逻辑导致行为漂移风险；`withEmbeddingMonitoring` 简化过度（inputTokens=1、estimatedCost=0），无法反映真实 embedding 成本。
3. **A2.6 STT-realtime 连接治理缺失**：每个客户端连接都新建 aliyunWs，无 per-user 连接数限制，同一用户多端/重复连接会重复计费、耗尽连接资源。
4. **B1.1 图谱拓扑关系未被复习调度利用**：`spacedRepetitionBridge.getUnifiedReviewQueue` 仅按 urgency + mastery + 语义相似度排序，未利用 `edges` 表中的 prerequisite 关系；当后置节点先于前置节点复习时，学习者缺乏前置知识支撑，复习效果下降。

## What Changes
- **A2.1**：在 `cacheService` 中引入显式 LRU 跟踪（`accessOrder: Map<string, number>`），在 `get`/`set` 时更新访问时间戳，淘汰时选取时间戳最小的键。
- **A2.3**：将 `withAIMonitoring` 确立为唯一监控入口；`performanceMonitor.withAutoGraphTracking` 改为薄包装委托调用；`withEmbeddingMonitoring` 接入 `pricingService` 计算真实 embedding 成本与 token 数。
- **A2.6**：在 `setupRealtimeSTT` 中维护 `userConnections: Map<string, WebSocket>`，新连接到来时关闭同用户的旧连接（code=1000, reason="replaced"），并清理引用。
- **B1.1**：在 `spacedRepetitionBridge.getUnifiedReviewQueue` 的语义排序之后，新增 `applyTopologyPriority` 步骤——对每个待复习卡片查询其 prerequisite 节点 mastery，若任一前置 mastery < 0.6，则将该卡片在当前 urgency 组内降权 50%（向后移动半个组长度位置）。

## Impact
- Affected specs:
  - `complete-cache-coverage`（A2.1 在其基础上修复 LRU 算法，无冲突）
  - `semantic-aware-review-scheduling`（B1.1 在其语义排序之后追加拓扑排序，串行协作，无冲突）
  - `p0-critical-fixes`（已完成，无冲突）
- Affected code:
  - `api/services/common/cacheService.ts` — LRU 跟踪逻辑
  - `api/services/ai/aiMonitor.ts` — withEmbeddingMonitoring 修复，withAIMonitoring 注释明确为唯一入口
  - `api/services/ai/performanceMonitor.ts` — withAutoGraphTracking 改为薄包装
  - `api/routes/ai/stt-realtime.ts` — per-user 连接治理
  - `api/services/study/spacedRepetitionBridge.ts` — applyTopologyPriority 注入点
  - `api/services/study/topologyScheduler.ts` — **新建**，封装 prerequisite 查询与降权计算

## ADDED Requirements

### Requirement: 真正的 LRU 缓存淘汰
系统 SHALL 在 `cacheService` 中维护显式的访问时间戳（`accessOrder: Map<string, number>`），并在 `get` 命中与 `set` 写入时更新对应键的时间戳为 `Date.now()`。当键数量达到 `MAX_CACHE_KEYS` 上限且需插入新键时，系统 SHALL 选取 `accessOrder` 中时间戳最小的键进行淘汰，而非依赖 `localCache.keys()[0]`。

#### Scenario: 缓存命中时更新访问时间戳
- **WHEN** 调用 `cacheService.get(key)` 返回缓存值
- **THEN** `accessOrder[key]` 被更新为当前 `Date.now()`
- **AND** 后续淘汰不会优先淘汰该热点键

#### Scenario: 缓存达到上限时淘汰最久未访问键
- **GIVEN** 缓存已包含 1000 个键
- **WHEN** 调用 `cacheService.set(newKey, value)` 插入新键
- **THEN** 系统从 `accessOrder` 中找出时间戳最小的键 `evictedKey`
- **AND** 调用 `cacheService.del(evictedKey)` 删除该键及其标签索引
- **AND** 日志记录 `[Cache] LRU evicted: ${evictedKey}`

#### Scenario: 删除键时同步清理访问时间戳
- **WHEN** 调用 `cacheService.del(key)` 删除键
- **THEN** `accessOrder` 中该键的条目也被删除
- **AND** `flush()` 时 `accessOrder.clear()` 同步执行

### Requirement: 统一的 AI 监控装饰器入口
系统 SHALL 将 `withAIMonitoring` 确立为所有 AI 调用监控的唯一规范入口。`performanceMonitor.withAutoGraphTracking` SHALL 改为薄包装，内部委托调用 `withAIMonitoring`，保留原签名以维持向后兼容。

#### Scenario: withAutoGraphTracking 委托 withAIMonitoring
- **WHEN** 调用 `performanceMonitor.withAutoGraphTracking(operation, provider, model, fn, metadata, sessionId)`
- **THEN** 内部转换为 `withAIMonitoring({ operation, provider, model, metadata, sessionId }, fn)` 调用
- **AND** 返回值、副作用（recordLog 调用）、错误传播行为完全一致

### Requirement: Embedding 监控真实成本计算
系统 SHALL 修复 `withEmbeddingMonitoring` 的成本与 token 统计缺陷：通过 `pricingService` 查询对应 provider 的 embedding 计费方式（按 token 或按次），计算真实 `inputTokens` 与 `estimatedCost`，而非硬编码 `inputTokens=1, estimatedCost=0`。

#### Scenario: Embedding 调用记录真实成本
- **WHEN** 通过 `withEmbeddingMonitoring` 包装 embedding API 调用
- **THEN** `recordLog` 中的 `inputTokens` 反映实际 token 数（从 fn 返回的 `tokenCount` 或估算）
- **AND** `estimatedCost` 通过 `pricingService.calculateCost(provider, model, inputTokens, 0, 0)` 计算
- **AND** 不再出现 `inputTokens=1, estimatedCost=0` 的占位值

### Requirement: STT-realtime per-user 连接独占
系统 SHALL 在 `setupRealtimeSTT` 中维护 `userConnections: Map<string, WebSocket>`，确保同一用户同时最多只有一个 realtime STT 连接。新连接到来时 SHALL 关闭同用户的旧连接（close code=1000, reason="replaced"），并清理引用。

#### Scenario: 同用户新连接替换旧连接
- **GIVEN** 用户 A 已有一个活跃 STT 连接 `oldWs`
- **WHEN** 用户 A 发起新的 STT 连接 `newWs`
- **THEN** 服务端在 `wss.on('connection')` 处理新连接前，向 `oldWs` 发送 close 帧（code=1000, reason="replaced"）
- **AND** `userConnections.set(userId, newWs)` 更新引用
- **AND** `oldWs` 的 cleanup 逻辑被触发，关闭对应的 aliyunWs

#### Scenario: 连接关闭时清理 userConnections 引用
- **WHEN** 客户端连接 `ws` 关闭（无论主动或异常）
- **THEN** 若 `userConnections.get(userId) === ws`，从 Map 中删除该条目
- **AND** 避免后续新连接误关闭已不存在的旧连接

#### Scenario: 不同用户连接互不影响
- **GIVEN** 用户 A 与用户 B 各有一个活跃 STT 连接
- **WHEN** 用户 A 发起新连接
- **THEN** 仅用户 A 的旧连接被关闭
- **AND** 用户 B 的连接不受影响

### Requirement: 图谱拓扑感知复习调度
系统 SHALL 在 `spacedRepetitionBridge.getUnifiedReviewQueue` 的语义排序步骤之后，新增 `applyTopologyPriority` 步骤：对每个待复习卡片查询其 prerequisite 节点（来自 `edges` 表 `type='prerequisite'` 的 source 节点）的 mastery，若任一前置节点 mastery < 0.6，则将该卡片在当前 urgency 组内向后移动半个组长度的位置（即降权 50%）。

#### Scenario: 前置未掌握时卡片降权
- **GIVEN** 卡片 A 关联知识点 KP_A，KP_A 的前置节点 KP_prereq 的 mastery = 0.4
- **WHEN** 调用 `getUnifiedReviewQueue`
- **THEN** 卡片 A 在其 urgency 组内的位置向后移动半个组长度
- **AND** 同组内无前置未掌握的卡片相对位置保持不变

#### Scenario: 前置已掌握时不降权
- **GIVEN** 卡片 B 关联知识点 KP_B，KP_B 的所有前置节点 mastery 均 >= 0.6
- **WHEN** 调用 `getUnifiedReviewQueue`
- **THEN** 卡片 B 在其 urgency 组内的位置不因拓扑降权而变化
- **AND** 仅受 urgency + mastery + 语义排序影响

#### Scenario: 无 prerequisite 关系时退化为原行为
- **GIVEN** 图谱中没有任何 `type='prerequisite'` 的边
- **WHEN** 调用 `getUnifiedReviewQueue`
- **THEN** `applyTopologyPriority` 是 no-op
- **AND** 排序结果与不启用拓扑感知时完全一致

#### Scenario: 拓扑查询失败时降级
- **WHEN** `applyTopologyPriority` 内部查询 edges 或 study_cards 失败
- **THEN** 记录 warn 日志并返回未降权的原始顺序
- **AND** 不影响主流程返回

## MODIFIED Requirements
无

## REMOVED Requirements
无
