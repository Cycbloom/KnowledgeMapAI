# 自适应学习工作流引擎 Checklist

## Phase 1: 基础统一与清理

### 掌握度阈值统一
- [x] `shared/constants/masteryThresholds.ts` 已创建，定义统一的掌握度阈值常量
- [x] `subtaskStateMachine.ts` 的 MASTERY_THRESHOLDS 已替换为统一常量
- [x] `subtaskKnowledgeSync.ts` 的 MASTERY_STATE_MAPPING 和 REVIEW_THRESHOLD 已替换为统一常量
- [x] `masteryDecayService.ts` 的 DEFAULT_DECAY_CONFIG.reviewThreshold 已替换为统一常量
- [x] taskSettingsService 和 taskDefaults.ts 的默认值已统一（q1=45, q2=90）

### SM2 残留清理
- [x] `smartSchedulerService.ts` 的 `calculateMasteryBasedPriority` 已改用 FSRS stability 估算
- [x] 项目中所有对 `sm2Service` 的引用已清理
- [x] `api/services/scheduler/sm2Service.ts` 已移除

## Phase 2: 统一自适应调度引擎

### 统一调度引擎核心
- [x] `AdaptiveSchedulerService` 接口已设计，整合三套调度系统的核心能力
- [x] `adaptiveSchedulerService.ts` 已创建，实现统一调度逻辑
- [x] 所有硬编码权重已提取为 `SchedulerWeights` 可配置参数
- [x] 任务类型-时段映射已提取为可配置的 `TaskTypeTimeMap`
- [x] 权重从用户配置读取的逻辑已实现
- [x] 所有调度入口已改为调用 AdaptiveSchedulerService

### 调度权重自适应
- [x] `scheduler_weight_profiles` 数据库表已创建
- [x] 权重自适应算法已实现（2周+50条记录后自动微调，幅度≤10%）
- [x] 效率画像冷启动已实现（早起型/夜猫型/均衡型预设）
- [x] 迁移文件已添加

## Phase 3: 知识衰减与 FSRS 统一

- [x] `masteryDecayService.ts` 衰减公式已改为 `e^(-t/S)`（基于 FSRS stability）
- [x] 无 FSRS 数据的节点降级处理已实现
- [x] 关联性衰减修正已实现（邻居掌握度修正系数）
- [ ] 衰减模型单元测试已通过

## Phase 4: 学习模式系统

### 学习模式定义
- [x] `StudyMode` 类型已定义（drill/deep/preview/review/quiz/mixed）
- [x] `StudyModePreset` 接口已定义
- [x] `studyModePresets.ts` 已创建，6种模式预设参数已定义
- [x] `StudyWorkflowStage` 和 `StudyWorkflowConfig` 类型已定义

### 工作流引擎
- [x] `learningLoopOrchestrator.ts` 已支持根据 StudyModePreset 动态创建工作流阶段
- [x] 阶段转换逻辑已实现（基于退出条件自动转换）
- [x] 工作流中断恢复已实现
- [x] 按知识图谱拓扑顺序执行已实现（前置节点阻塞）
- [x] `learning_loops` 表已增加 `study_mode` 和 `current_workflow_stage` 字段

### FSRS 与学习模式联动
- [x] `getFSRS()` 已支持学习模式参数覆盖
- [x] 刷题模式二元评分映射已实现
- [x] 快速浏览模式特殊处理已实现（不生成复习卡片，掌握度=0.1）
- [x] 混合模式自动策略选择已实现

## Phase 5: 配置面板与前端

### 学习策略配置面板
- [x] Settings.tsx 中"学习策略"配置区域已添加
- [x] 学习模式选择器已实现（6种模式+说明）
- [x] FSRS 参数配置面板已实现
- [x] 掌握度阈值配置面板已实现
- [x] 调度权重配置面板已实现
- [x] "恢复默认设置"按钮已实现
- [x] 配置持久化到 `users.settings` 已实现

### 学习模式前端集成
- [x] LearningMode.tsx 中学习模式切换入口已添加
- [x] 不同模式的 UI 调整已实现（如刷题模式隐藏学习材料）
- [x] 混合模式自动策略提示已实现
