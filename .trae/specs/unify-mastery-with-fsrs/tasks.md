# Tasks

- [x] Task 1: 创建 FSRS-driven mastery_level 计算服务
  - [x] SubTask 1.1: 在 `api/services/study/` 下创建 `masteryCalculationService.ts`，实现基于 FSRS retrievability 的 mastery_level 聚合计算逻辑
  - [x] SubTask 1.2: 实现加权平均聚合：`mastery = sum(retrievability * stability) / sum(stability)`，对有 study_cards 的知识点
  - [x] SubTask 1.3: 实现基于学习状态的初始估算：new=0.1, learning=0.2, review=0.35, practice=0.55, quiz=0.75, mastery=0.9
  - [x] SubTask 1.4: 实现无学习记录时返回 0
  - [ ] SubTask 1.5: 编写单元测试验证各场景

- [x] Task 2: 重构 studyService 中的 mastery_level 更新逻辑
  - [x] SubTask 2.1: 修改 `studyService.updateProgress()`，在 FSRS 参数更新后调用 masteryCalculationService 重新计算知识点 mastery_level
  - [x] SubTask 2.2: 修改 `studyService` 中所有写入 knowledge_points.mastery_level 的位置，改为调用 masteryCalculationService
  - [x] SubTask 2.3: 确保复习后自动触发关联知识点的 mastery_level 更新

- [x] Task 3: 重构 progressSyncService 移除启发式增量计算
  - [x] SubTask 3.1: 将 `calculateMasteryIncrement()` 改为调用 masteryCalculationService（不再使用时长线性累加）
  - [x] SubTask 3.2: 将 `calculateCompletionMasteryIncrement()` 改为调用 masteryCalculationService
  - [x] SubTask 3.3: 保留函数签名以避免破坏调用方，但内部实现委托给新服务

- [x] Task 4: 重构 subtaskKnowledgeSyncService 的掌握度同步逻辑
  - [x] SubTask 4.1: 将 `calculateKnowledgePointMastery()` 的启发式加权逻辑替换为 masteryCalculationService 调用
  - [x] SubTask 4.2: 确保 subtask 的 mastery_level 与知识点 mastery_level 同步

- [x] Task 5: 重构 masteryDecayService 使用 FSRS retrievability
  - [x] SubTask 5.1: 修改 `calculateDecay()` 内部实现，改为查询 study_cards 的最新 retrievability 聚合值
  - [x] SubTask 5.2: 保留 `calculateDecay()` 函数签名作为兼容接口
  - [x] SubTask 5.3: 移除自行计算指数衰减的逻辑（`mastery * e^(-days/stability)`）

- [x] Task 6: 统一图谱节点状态计算
  - [x] SubTask 6.1: 修改 `graphService.getGraphNodeStatus()`，确保使用 masteryCalculationService 计算的 mastery_level（与 FSRS retrievability 聚合值一致）
  - [x] SubTask 6.2: 验证图谱节点着色逻辑（前端）与 mastery_level 使用同一数据源

- [x] Task 7: 更新前端 mastery_level 展示
  - [x] SubTask 7.1: 检查所有前端使用 mastery_level 的组件，确认无需修改（因为值域仍为 0~1）
  - [x] SubTask 7.2: 更新 masteryThresholds 的注释，赋予概率语义说明

- [x] Task 8: 集成测试与验证
  - [ ] SubTask 8.1: 编写集成测试：复习后 mastery_level 正确更新
  - [ ] SubTask 8.2: 编写集成测试：时间衰减后 mastery_level 正确反映
  - [ ] SubTask 8.3: 编写集成测试：图谱节点状态与 mastery_level 一致
  - [x] SubTask 8.4: 运行 `npm run check` 和 `npm run lint` 确保无类型错误和代码规范问题

# Task Dependencies
- [Task 2] depends on [Task 1]
- [Task 3] depends on [Task 1]
- [Task 4] depends on [Task 1]
- [Task 5] depends on [Task 1]
- [Task 6] depends on [Task 1, Task 2]
- [Task 7] depends on [Task 6]
- [Task 8] depends on [Task 2, Task 3, Task 4, Task 5, Task 6, Task 7]
- [Task 1] 可独立开始
- [Task 3, Task 4, Task 5] 可并行进行
