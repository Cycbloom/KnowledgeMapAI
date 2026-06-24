# 语义感知智能复习调度 Spec

## Why

当前复习队列排序仅基于 urgency（到期紧急度）和 masteryLevel（掌握度），Quiz 模式使用纯随机打乱（`Math.random() - 0.5`），完全不感知知识点间的语义相似性。这导致语义高度相似的知识点（如 "TCP 三次握手" 与 "TCP 四次挥手"、"affect" 与 "effect"）可能连续出现，引发前摄/倒摄干扰，降低复习效率。项目已具备完整的 embedding 基础设施（vector(1024)、HNSW 索引、`search_similar_knowledge_points` RPC），可直接复用，零额外 AI 成本实现语义感知调度。

## What Changes

- 新增 `api/services/study/semanticInterferenceService.ts`：基于已有 embedding 向量计算知识点间语义相似度，识别复习队列中的语义干扰对
- 修改 `api/services/study/spacedRepetitionBridge.ts`：在 `getUnifiedReviewQueue` 排序中引入语义间距因子，相似卡片间插入间隔
- 修改 `src/pages/Study.tsx`：将 Quiz 模式的纯随机打乱替换为语义感知排序，最大化相邻卡片语义距离
- 新增前端语义干扰提示：当连续两张卡片语义高度相似时，显示"语义相近"提示标签
- 新增 API 端点：获取复习队列的语义分组信息

## Impact

- Affected specs: fsrs-personalization-decay（FSRS 参数优化不涉及此功能）、unify-mastery-with-fsrs（掌握度计算不涉及此功能）
- Affected code:
  - `api/services/study/spacedRepetitionBridge.ts` — 队列排序逻辑
  - `api/services/study/studyService.ts` — 卡片获取接口扩展
  - `src/pages/Study.tsx` — Quiz 模式卡片排序
  - `src/services/api/study.ts` — 新增语义分组 API 调用
  - `src/hooks/queries/useStudyQueries.ts` — 新增语义分组 hook

## ADDED Requirements

### Requirement: 语义干扰检测服务

系统 SHALL 提供基于 embedding 向量的语义干扰检测服务，识别复习队列中语义高度相似的知识点对。

#### Scenario: 计算知识点间语义相似度
- **WHEN** 系统需要评估两个知识点的语义相似度
- **THEN** 使用 `knowledge_points.embedding` 向量计算余弦相似度，返回 0-1 之间的相似度分数

#### Scenario: 识别复习队列中的干扰对
- **WHEN** 给定一组待复习的知识点 ID 列表
- **THEN** 系统查询这些知识点的 embedding 向量，计算两两余弦相似度，返回相似度超过阈值（默认 0.75）的知识点对列表，按相似度降序排列

#### Scenario: 知识点无 embedding 时的降级处理
- **WHEN** 某个知识点没有 embedding 向量
- **THEN** 该知识点不参与语义干扰检测，在排序中按原始 urgency/masteryLevel 顺序处理

#### Scenario: 语义分组
- **WHEN** 给定一组待复习的知识点
- **THEN** 系统基于语义相似度进行聚类，将相似度超过阈值的点归入同一语义组，每组返回组 ID 和成员列表

### Requirement: 语义感知复习队列排序

系统 SHALL 在复习队列排序中引入语义间距因子，确保语义高度相似的知识点在队列中被分散排列。

#### Scenario: 语义感知排序算法
- **WHEN** `spacedRepetitionBridge.getUnifiedReviewQueue()` 构建复习队列
- **THEN** 排序逻辑从"urgency + masteryLevel"扩展为"urgency + masteryLevel + semanticSpacing"：
  1. 先按 urgency 分组（overdue > today > upcoming > future）
  2. 在同一 urgency 组内，使用贪心算法最大化相邻卡片的语义距离：依次选取与上一个已选卡片语义距离最大的卡片
  3. 若无法计算语义距离（无 embedding），按 masteryLevel 升序排列

#### Scenario: 排序性能保障
- **WHEN** 复习队列包含 N 张卡片
- **THEN** 语义排序的时间复杂度不超过 O(N²)，对于 N > 100 的大队列，仅对前 100 张卡片执行语义排序，其余按原始顺序追加

#### Scenario: 语义排序开关
- **WHEN** 用户的 `settings.study.semantic_scheduling` 设置为 `false`
- **THEN** 复习队列排序回退到原始的 urgency + masteryLevel 排序，不执行语义计算

### Requirement: Quiz 模式语义感知排序

系统 SHALL 在 Quiz 模式中使用语义感知排序替代纯随机打乱。

#### Scenario: Quiz 开始时的卡片排序
- **WHEN** 用户点击"开始复习"进入 Quiz 模式
- **THEN** 卡片排序使用语义感知排序算法（与后端队列排序逻辑一致），而非 `Math.random() - 0.5` 随机打乱

#### Scenario: 重新开始时的排序
- **WHEN** 用户在 Quiz 中点击"重新开始"
- **THEN** 重新使用语义感知排序算法排列剩余卡片

### Requirement: 语义干扰视觉提示

系统 SHALL 在 Quiz 界面中，当连续两张卡片语义高度相似时，显示视觉提示。

#### Scenario: 语义相近提示
- **WHEN** 当前卡片与上一张已复习卡片的语义相似度超过 0.75
- **THEN** 在卡片上方显示"语义相近"提示标签，包含相似度百分比（如"与上一张相似度 82%"）

#### Scenario: 无干扰时无提示
- **WHEN** 当前卡片与上一张已复习卡片的语义相似度低于 0.75
- **THEN** 不显示任何语义提示

### Requirement: 语义分组 API

系统 SHALL 提供获取复习队列语义分组信息的 API 端点。

#### Scenario: 获取语义分组
- **WHEN** 前端请求 `GET /api/study/semantic-groups?graph_id=xxx`
- **THEN** 返回当前到期卡片的语义分组信息，包含：
  - `groups`: 语义组列表，每组包含 `group_id`、`member_knowledge_point_ids`、`avg_similarity`
  - `interference_pairs`: 高相似度知识点对列表，包含 `kp_id_1`、`kp_id_2`、`similarity`

#### Scenario: 无 embedding 数据时的响应
- **WHEN** 请求的知识点均无 embedding 数据
- **THEN** 返回空分组 `{ groups: [], interference_pairs: [] }`

## MODIFIED Requirements

### Requirement: 复习队列排序逻辑

**原**：`spacedRepetitionBridge.getUnifiedReviewQueue()` 按 urgency（overdue > today > upcoming > future）排序，同 urgency 内按 masteryLevel 升序排列。

**新**：排序逻辑扩展为三级：urgency → 语义间距 → masteryLevel。在 urgency 分组内，优先使用语义感知贪心排序最大化相邻卡片语义距离；无 embedding 数据时回退到 masteryLevel 排序。

### Requirement: Quiz 模式卡片排序

**原**：`Study.tsx` 中 `handleStartQuiz` 使用 `cards.sort(() => Math.random() - 0.5)` 纯随机打乱卡片顺序。

**新**：使用后端返回的语义感知排序顺序。若后端未提供排序信息，回退到按语义分组分散排列的客户端算法。

## REMOVED Requirements

（无移除项）
