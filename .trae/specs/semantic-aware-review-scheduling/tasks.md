# Tasks

- [x] Task 1: 新增语义干扰检测服务 `semanticInterferenceService.ts`
  - [x] SubTask 1.1: 实现 `calculateCosineSimilarity(embedding1, embedding2)` 余弦相似度计算
  - [x] SubTask 1.2: 实现 `detectInterferencePairs(supabase, knowledgePointIds, threshold?)` 干扰对检测，批量查询 embedding 并计算两两相似度
  - [x] SubTask 1.3: 实现 `getSemanticGroups(supabase, knowledgePointIds, threshold?)` 语义分组，基于相似度阈值进行聚类
  - [x] SubTask 1.4: 实现 `getSemanticSpacedOrder(supabase, reviewItems)` 语义感知排序，贪心算法最大化相邻卡片语义距离
  - [ ] SubTask 1.5: 编写单元测试，覆盖余弦相似度计算、干扰对检测、分组逻辑、排序算法

- [x] Task 2: 修改 `spacedRepetitionBridge.ts` 集成语义感知排序
  - [x] SubTask 2.1: 在 `getUnifiedReviewQueue` 中引入语义间距排序，调用 `semanticInterferenceService.getSemanticSpacedOrder`
  - [x] SubTask 2.2: 添加排序性能保护：N > 100 时仅对前 100 张卡片执行语义排序
  - [x] SubTask 2.3: 添加降级逻辑：无 embedding 数据时回退到原始 urgency + masteryLevel 排序

- [x] Task 3: 新增语义分组 API 端点
  - [x] SubTask 3.1: 在 `api/routes/study.ts` 新增 `GET /api/study/semantic-groups` 端点
  - [x] SubTask 3.2: 在 `src/services/api/study.ts` 新增 `getSemanticGroups` 客户端方法
  - [x] SubTask 3.3: 在 `src/hooks/queries/useStudyQueries.ts` 新增 `useSemanticGroups` hook
  - [x] SubTask 3.4: 在 `src/services/api/contracts/IStudyApi.ts` 契约接口中新增方法签名

- [x] Task 4: 修改前端 Quiz 模式排序逻辑
  - [x] SubTask 4.1: 替换 `Study.tsx` 中 `handleStartQuiz` 的 `Math.random() - 0.5` 随机打乱为语义感知排序
  - [x] SubTask 4.2: 替换 `handleRestart` 中的随机打乱逻辑
  - [x] SubTask 4.3: 利用后端返回的语义分组信息进行客户端排序（按组分散排列）

- [x] Task 5: 新增语义干扰视觉提示 UI
  - [x] SubTask 5.1: 在 Quiz 卡片组件中添加"语义相近"提示标签，显示相似度百分比
  - [x] SubTask 5.2: 在复习过程中追踪上一张卡片的 knowledge_point_id，用于实时计算与当前卡片的相似度
  - [x] SubTask 5.3: 添加相似度阈值判断逻辑（> 0.75 时显示提示）

- [x] Task 6: 添加语义调度开关
  - [x] SubTask 6.1: 在用户设置中新增 `study.semantic_scheduling` 布尔选项，默认为 `true`
  - [x] SubTask 6.2: `spacedRepetitionBridge` 读取用户设置，关闭时跳过语义排序
  - [x] SubTask 6.3: 在 `Settings.tsx` 学习设置区域添加"语义感知复习"开关

# Task Dependencies

- [Task 2] depends on [Task 1] — 桥接层依赖语义干扰服务
- [Task 3] depends on [Task 1] — API 端点依赖语义干扰服务
- [Task 4] depends on [Task 3] — 前端排序依赖语义分组 API
- [Task 5] depends on [Task 3] — 视觉提示依赖语义分组数据
- [Task 6] depends on [Task 2] — 开关需要控制桥接层行为
