# Tasks: SM2 → FSRS 迁移

## Phase 1: 类型层

- [x] Task 1: 扩展 `ReviewTask` 类型支持 FSRS 字段
  - 文件：`shared/types/scheduler.ts`
  - 在 `ReviewTask` 接口中添加可选字段：`algorithm?: "sm2" | "fsrs"`, `fsrs_stability?: number`, `fsrs_difficulty?: number`, `fsrs_state?: string`, `fsrs_retrievability?: number`
  - 将 `interval_days`, `ease_factor`, `repetitions` 保留但标记为 optional（`?`）
  - 新增 `FSRSReviewTask extends ReviewTask` 接口，强制要求 FSRS 字段
  - 验证：TypeScript 编译通过

- [x] Task 2: 废弃 SM2 类型和接口
  - 文件：`shared/types/scheduler.ts`
  - 为 `ReviewTask`、`PendingReviewTask`、`CreateReviewTaskData`、`UpdateReviewTaskData`、`ReviewTaskStats` 添加 `@deprecated` 注释
  - 验证：IDE 中引用这些类型时显示废弃警告

## Phase 2: 服务层

- [x] Task 3: 切换 `reviewTaskService` 默认创建路径
  - 文件：`api/services/scheduler/reviewTaskService.ts`
  - `createFirstReviewTask()` 改为调用 `studyService.createCard()` 创建 `card_type='review'` 的 `study_cards` 记录
  - 保留旧的 `knowledge_review_tasks` 写路径作为 fallback（当 `study_cards` 写入失败时）
  - 添加文件级注释说明默认算法已切换为 FSRS
  - 验证：新复习任务创建后出现在 `study_cards` 表中

- [x] Task 4: 切换 `spacedRepetitionBridge` 默认路由
  - 文件：`api/services/study/spacedRepetitionBridge.ts`
  - `processReviewResult()` 默认路由到 FSRS（`studyService.updateProgress()`）
  - SM2 路径保留用于处理 `algorithm='sm2'` 的遗留任务
  - 添加注释说明默认行为
  - 验证：复习完成后 `study_cards` 的 FSRS 字段正确更新

- [x] Task 5: 标记 `sm2Service` 为废弃
  - 文件：`api/services/scheduler/sm2Service.ts`
  - 在文件顶部添加 `@deprecated 推荐使用 api/services/study/studyService.ts (FSRS)`
  - 在每个导出函数上添加 `@deprecated` 注释
  - 不修改任何逻辑
  - 验证：注释存在

## Phase 3: UI 层

- [x] Task 6: 升级 `ReviewTaskCard` 支持 FSRS 显示
  - 文件：`src/components/Scheduler/ReviewTaskCard.tsx`
  - 判断 `task.algorithm`：若为 `fsrs` 则显示 FSRS 字段（稳定性 stability、难度 difficulty、FSRS 状态 state、可提取性 retrievability）
  - 若为 `sm2` 或未定义，保持原有 SM2 显示（间隔 interval_days、EF ease_factor、次数 repetitions）
  - UI 元素：
    - 稳定性：用进度条/数值展示
    - 难度：用星标或颜色条展示
    - 状态：New(蓝) / Learning(橙) / Review(绿) / Relearning(红) 标签
    - 可提取性：百分比展示（如 "记忆保持率: 87%"）
  - 保留 `estimateNextInterval` 的 SM2 计算和 `selectedQuality` 的 0-5 评分（评分机制不变）
  - 验证：FSRS 卡片显示新字段，SM2 卡片仍正常显示旧字段

# Task Dependencies

- Task 1 → Task 2（Task 2 引用了 Task 1 的类型）
- Task 3 → Task 4（Task 4 的路由依赖 Task 3 的创建路径）
- Task 5 独立
- Task 6 依赖 Task 1（需要新类型）和 Task 4（需要新数据）
- Phase 1 完成后方可开始 Phase 2 和 Phase 3