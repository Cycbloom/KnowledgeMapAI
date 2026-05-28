# Tasks

## Phase 1: 基础统一与清理（前置依赖，消除技术债）

- [x] Task 1: 掌握度阈值统一 — 消除 SubtaskStateMachine / SubtaskKnowledgeSync / MasteryDecayService 之间的阈值不一致
  - [x] SubTask 1.1: 在 `shared/constants/` 中创建统一的掌握度阈值常量文件 `masteryThresholds.ts`，定义 LEARNING_REVIEW=0.3, REVIEW_PRACTICE=0.5, PRACTICE_QUIZ=0.7, QUIZ_MASTERY=0.85
  - [x] SubTask 1.2: 修改 `subtaskStateMachine.ts`，将硬编码的 MASTERY_THRESHOLDS 替换为统一常量
  - [x] SubTask 1.3: 修改 `subtaskKnowledgeSync.ts`，将 MASTERY_STATE_MAPPING 和 REVIEW_THRESHOLD 替换为统一常量
  - [x] SubTask 1.4: 修改 `masteryDecayService.ts`，将 DEFAULT_DECAY_CONFIG.reviewThreshold=0.5 替换为统一常量
  - [x] SubTask 1.5: 统一 taskSettingsService 和 taskDefaults.ts 的默认值（q1=45, q2=90）

- [x] Task 2: SM2 残留清理 — 移除所有 SM2 引用，统一使用 FSRS
  - [x] SubTask 2.1: 修改 `smartSchedulerService.ts` 的 `calculateMasteryBasedPriority`，将 `sm2Service.estimateMasteryLevel()` 替换为基于 FSRS stability 的估算 `min(1, fsrs_stability / 30)`
  - [x] SubTask 2.2: 搜索并清理项目中所有对 `sm2Service` 的引用
  - [x] SubTask 2.3: 移除 `api/services/scheduler/sm2Service.ts` 文件

## Phase 2: 统一自适应调度引擎

- [x] Task 3: 创建统一调度引擎核心 — 合并三套调度系统
  - [x] SubTask 3.1: 设计 `AdaptiveSchedulerService` 接口，整合 SmartSchedulerService 的多维度评分、DecisionEngine 的因子加权、TaskRecommendationService 的紧急度计算
  - [x] SubTask 3.2: 创建 `api/services/scheduler/adaptiveSchedulerService.ts`，实现统一调度逻辑
  - [x] SubTask 3.3: 将所有硬编码权重提取为可配置参数，定义 `SchedulerWeights` 类型（timeSlot, mastery, dependency, typeMatch, priority, urgency, availability）
  - [x] SubTask 3.4: 将硬编码的任务类型-时段映射提取为可配置的 `TaskTypeTimeMap`，支持中英文类型统一
  - [x] SubTask 3.5: 实现权重从用户配置读取的逻辑，无配置时使用默认值
  - [x] SubTask 3.6: 修改所有调用 SmartSchedulerService / DecisionEngine / TaskRecommendationService 的入口，改为调用 AdaptiveSchedulerService

- [x] Task 4: 调度权重自适应调优 — 基于用户行为数据自动微调权重
  - [x] SubTask 4.1: 创建 `scheduler_weight_profiles` 数据库表，存储用户级调度权重配置
  - [x] SubTask 4.2: 实现权重自适应算法：每2周基于用户完成率、专注时长等数据微调权重（每次调整幅度不超过10%）
  - [x] SubTask 4.3: 实现效率画像冷启动：基于用户选择的偏好类型（早起型/夜猫型/均衡型）初始化效率画像
  - [x] SubTask 4.4: 在 `supabase/migrations/` 中添加迁移文件

## Phase 3: 知识衰减与 FSRS 统一

- [x] Task 5: 衰减模型统一 — 用 FSRS stability 替代 easeFactor*decayBaseFactor
  - [x] SubTask 5.1: 修改 `masteryDecayService.ts` 的衰减公式，从 `mastery * e^(-t/(EF*base))` 改为 `e^(-t/S)`（S = fsrs_stability）
  - [x] SubTask 5.2: 为无 FSRS 数据的节点实现降级处理：基于节点难度估算默认稳定性值
  - [x] SubTask 5.3: 实现关联性衰减修正：根据知识图谱邻居节点平均掌握度调整衰减速率（修正系数 = 1 + 0.2 * 邻居平均掌握度）
  - [ ] SubTask 5.4: 编写衰减模型单元测试，验证新公式与旧公式的行为差异

## Phase 4: 学习模式系统

- [x] Task 6: 定义学习模式类型和预设 — 6种学习模式及其参数
  - [x] SubTask 6.1: 在 `shared/types/scheduler.ts` 中定义 `StudyMode` 类型：'drill' | 'deep' | 'preview' | 'review' | 'quiz' | 'mixed'
  - [x] SubTask 6.2: 定义 `StudyModePreset` 接口，包含：工作流阶段定义、FSRS 参数覆盖、评分方式、掌握度阈值覆盖
  - [x] SubTask 6.3: 在 `shared/constants/` 中创建 `studyModePresets.ts`，定义6种模式的预设参数
  - [x] SubTask 6.4: 定义 `StudyWorkflowStage` 类型：'learn' | 'recall' | 'practice' | 'quiz' | 'review' | 'reflect'
  - [x] SubTask 6.5: 定义 `StudyWorkflowConfig` 接口：stages 数组、transitions 转换规则、exitConditions 退出条件

- [x] Task 7: 扩展学习循环为工作流引擎 — 将 LearningLoopOrchestrator 升级为可配置工作流
  - [x] SubTask 7.1: 修改 `learningLoopOrchestrator.ts`，支持根据 StudyModePreset 动态创建工作流阶段
  - [x] SubTask 7.2: 实现阶段转换逻辑：根据退出条件（如练习正确率 >= 80%）自动转换到下一阶段
  - [x] SubTask 7.3: 实现工作流中断恢复：持久化当前阶段和节点状态，重新进入时恢复
  - [x] SubTask 7.4: 实现按知识图谱拓扑顺序执行：前置节点未达标时阻塞后续节点
  - [x] SubTask 7.5: 修改 `learning_loops` 数据库表，增加 `study_mode` 和 `workflow_config` 字段

- [x] Task 8: FSRS 参数与学习模式联动 — 不同模式使用不同 FSRS 参数
  - [x] SubTask 8.1: 修改 `studyService.ts` 的 `getFSRS()` 方法，支持根据学习模式覆盖 FSRS 参数
  - [x] SubTask 8.2: 实现刷题模式的二元评分映射（Again/Good 映射为 FSRS Rating）
  - [x] SubTask 8.3: 实现快速浏览模式的特殊处理：不生成复习卡片，掌握度设为 0.1
  - [x] SubTask 8.4: 实现混合模式的自动策略选择：根据节点状态选择深度学习/间隔复习/刷题

## Phase 5: 配置面板与前端

- [x] Task 9: 学习策略配置面板 — 在设置页面新增学习配置区域
  - [x] SubTask 9.1: 在 `Settings.tsx` 中新增"学习策略"配置区域，包含：默认学习模式选择、FSRS 参数配置、掌握度阈值配置
  - [x] SubTask 9.2: 实现学习模式选择器，展示6种模式的说明和适用场景
  - [x] SubTask 9.3: 实现 FSRS 参数配置面板：目标记忆保持率、最大复习间隔、各模式的参数预设和微调
  - [x] SubTask 9.4: 实现掌握度阈值配置面板：learning/review/practice/quiz 分界值滑块
  - [x] SubTask 9.5: 实现调度权重配置面板：各权重因子的滑块和说明
  - [x] SubTask 9.6: 实现"恢复默认设置"按钮
  - [x] SubTask 9.7: 将配置持久化到 `users.settings` 字段

- [x] Task 10: 学习模式前端集成 — 在学习页面支持模式切换
  - [x] SubTask 10.1: 在 `LearningMode.tsx` 中添加学习模式切换入口
  - [x] SubTask 10.2: 根据当前学习模式调整学习流程 UI（如刷题模式隐藏学习材料区域）
  - [x] SubTask 10.3: 实现混合模式的自动策略提示（告知用户当前节点使用的策略及原因）

# Task Dependencies

- Task 1 (阈值统一) 和 Task 2 (SM2 清理) 可并行执行，无依赖
- Task 3 (统一调度引擎) 依赖 Task 2 (SM2 清理完成后才能统一掌握度估算)
- Task 4 (权重自适应) 依赖 Task 3 (统一引擎完成后才能添加自适应逻辑)
- Task 5 (衰减统一) 依赖 Task 1 (阈值统一后才能修改衰减公式)
- Task 6 (学习模式定义) 无依赖，可并行
- Task 7 (工作流引擎) 依赖 Task 6 (模式定义完成后才能实现工作流)
- Task 8 (FSRS 联动) 依赖 Task 6 和 Task 7
- Task 9 (配置面板) 依赖 Task 6 (需要模式定义) 和 Task 3 (需要权重配置)
- Task 10 (前端集成) 依赖 Task 7, Task 8, Task 9
