# 移动端 API 完善 - The Implementation Plan (Decomposed and Prioritized Task List)

## [x] Task 1: 修复 graphs.ts 表名不一致问题
- **Priority**: P0
- **Depends On**: None
- **Description**:
  - 检查 graphs.ts 中所有使用表名的地方
  - 将错误的表名 `graphs` 统一修正为 `knowledge_graphs`
  - 确保 create、update、delete、restore 等方法使用正确的表名
- **Acceptance Criteria Addressed**: [AC-1]
- **Test Requirements**:
  - `programmatic` TR-1.1: 所有 CRUD 操作使用 `knowledge_graphs` 表名
  - `human-judgement` TR-1.2: 代码审查表名一致性
- **Notes**: 重点检查第 77、95、113、132、166、181、198、215 行

## [ ] Task 2: 实现 getNodeStatus 方法
- **Priority**: P0
- **Depends On**: None
- **Description**:
  - 从 Supabase 的 `study_cards` 表查询图谱的学习卡片
  - 统计总节点数和已完成节点数
  - 参考 graphService.ts 中的实现
- **Acceptance Criteria Addressed**: [AC-2]
- **Test Requirements**:
  - `programmatic` TR-2.1: 返回 { total_nodes, completed_nodes } 结构
  - `programmatic` TR-2.2: 正确统计学习进度
- **Notes**: 使用 study_cards 表和 knowledge_point_id 关联

## [ ] Task 3: 实现 getLearningPath 方法
- **Priority**: P0
- **Depends On**: None
- **Description**:
  - 从 Supabase 的 `learning_paths` 表查询学习路径
  - 返回 milestones 和 progress 数据
- **Acceptance Criteria Addressed**: [AC-3]
- **Test Requirements**:
  - `programmatic` TR-3.1: 返回 { milestones, progress } 结构
  - `programmatic` TR-3.2: 按 order_index 排序
- **Notes**: 参考 graphService.ts 第 551 行

## [ ] Task 4: 实现 study.ts 的 getCards 方法
- **Priority**: P0
- **Depends On**: None
- **Description**:
  - 从 Supabase 的 `study_cards` 表查询学习卡片
  - 支持按 user_id、graph_id、knowledge_point_id 筛选
  - 支持 dueOnly 参数
- **Acceptance Criteria Addressed**: [AC-4]
- **Test Requirements**:
  - `programmatic` TR-4.1: 返回 { cards: StudyCard[] } 结构
  - `programmatic` TR-4.2: 正确应用筛选参数
- **Notes**: 参考 studyService.ts 的实现

## [ ] Task 5: 实现 study.ts 的 getCardsByKnowledgePoint 方法
- **Priority**: P0
- **Depends On**: Task 4
- **Description**:
  - 实现根据知识点 ID 获取学习卡片
  - 复用 getCards 的逻辑
- **Acceptance Criteria Addressed**: [AC-4]
- **Test Requirements**:
  - `programmatic` TR-5.1: 按 knowledge_point_id 正确筛选
- **Notes**: 调用 getCards 并传入 knowledgePointId 参数

## [ ] Task 6: 实现 study.ts 的 createCardsBatch 方法
- **Priority**: P0
- **Depends On**: None
- **Description**:
  - 批量创建学习卡片
  - 插入到 study_cards 表
  - 初始化 FSRS 字段
- **Acceptance Criteria Addressed**: [AC-4, AC-5]
- **Test Requirements**:
  - `programmatic` TR-6.1: 成功批量插入卡片
  - `programmatic` TR-6.2: 正确设置 FSRS 初始值
- **Notes**: 参考 studyService.ts 第 198 行

## [ ] Task 7: 实现 study.ts 的 update、delete、deleteBatch 方法
- **Priority**: P0
- **Depends On**: None
- **Description**:
  - 实现 update 方法更新卡片
  - 实现 delete 方法删除单个卡片
  - 实现 deleteBatch 方法批量删除
- **Acceptance Criteria Addressed**: [AC-5]
- **Test Requirements**:
  - `programmatic` TR-7.1: update 正确更新字段
  - `programmatic` TR-7.2: delete 正确删除记录
  - `programmatic` TR-7.3: deleteBatch 支持批量操作
- **Notes**: 参考 studyService.ts 的实现

## [ ] Task 8: 实现 study.ts 的 updateProgress 方法
- **Priority**: P0
- **Depends On**: None
- **Description**:
  - 使用 FSRS 算法更新学习进度
  - 更新卡片的 review_count、next_review、FSRS 状态字段
  - 参考 studyService.ts 的完整实现
- **Acceptance Criteria Addressed**: [AC-6]
- **Test Requirements**:
  - `programmatic` TR-8.1: 正确更新 next_review 时间
  - `programmatic` TR-8.2: 正确更新 FSRS 状态字段
- **Notes**: 需要导入 ts-fsrs 库

## [ ] Task 9: 实现 study.ts 的 getCardGroups 方法
- **Priority**: P1
- **Depends On**: Task 4
- **Description**:
  - 根据知识点分组卡片
  - 返回分组后的卡片列表
- **Acceptance Criteria Addressed**: [AC-4]
- **Test Requirements**:
  - `programmatic` TR-9.1: 按 knowledge_point_id 正确分组
- **Notes**: 可简化实现或返回空数组（根据需求）

## [ ] Task 10: 实现 dashboard API 的 getStats 方法
- **Priority**: P0
- **Depends On**: None
- **Description**:
  - 从 Supabase 查询用户的图谱、节点、边、学习卡片数量
  - 计算学习连续天数和今日复习数
- **Acceptance Criteria Addressed**: [AC-7]
- **Test Requirements**:
  - `programmatic` TR-10.1: 返回完整的统计数据结构
  - `programmatic` TR-10.2: 统计数据准确
- **Notes**: 查询 knowledge_graphs、graph_nodes、edges、study_cards 表

## [ ] Task 11: 实现 statistics API 的 getStats 方法
- **Priority**: P1
- **Depends On**: None
- **Description**:
  - 从 study_cards 表查询学习进度分布
  - 返回 metrics、distribution 数据
  - heatmapData、weeklyData、forecastData 可简化
- **Acceptance Criteria Addressed**: [AC-8]
- **Test Requirements**:
  - `programmatic` TR-11.1: 返回正确的数据结构
  - `programmatic` TR-11.2: 进度分布统计准确
- **Notes**: 重点实现 metrics 和 distribution，其他可返回空数据
