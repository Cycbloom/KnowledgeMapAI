# 自适应学习工作流引擎 Spec

## Why

KnowledgeMap 已具备知识图谱、FSRS 间隔重复、学习循环（learn→test→review→iterate）、任务调度等核心能力，但存在三个关键问题：① 三套调度系统并存且硬编码权重不一致（SmartSchedulerService / DecisionEngine / TaskRecommendationService），② 学习流程不可配置（LearningLoop 仅支持固定4阶段循环），③ FSRS 参数暴露不足且与衰减模型脱节。用户需要一个全流程自动化的学习工作流：按知识图谱节点顺序学习、支持多种学习策略（刷题/深度学习/快速浏览）、FSRS 与遗忘曲线参数可配置、测试驱动评估掌握度。

## What Changes

1. **统一自适应调度引擎** — 合并三套调度系统为一个可配置的自适应引擎，所有权重因子提取为可配置参数，消除硬编码
2. **可配置学习工作流引擎** — 将固定4阶段 LearningLoop 扩展为可配置的工作流引擎，支持自定义阶段、转换规则和学习模式
3. **学习模式系统** — 新增6种学习模式（刷题/深度学习/快速浏览/间隔复习/测验/混合），每种模式对应不同的 FSRS 参数配置和调度策略
4. **FSRS 参数配置面板** — 在设置页面增加完整的 FSRS 参数配置面板，暴露 request_retention、maximum_interval、学习模式默认参数等
5. **知识衰减与 FSRS 统一** — 用 FSRS stability 替代 masteryDecayService 中的 `easeFactor * decayBaseFactor`，统一衰减模型
6. **关联性衰减修正** — 基于知识图谱邻居节点掌握度调整衰减速率（知识网络效应）
7. **掌握度阈值统一** — 解决 SubtaskStateMachine / SubtaskKnowledgeSync / MasteryDecayService 之间的阈值不一致问题
8. **SM2 残留清理** — 清除 SmartSchedulerService 中对 SM2 的残留引用，统一使用 FSRS
9. **默认值统一** — 解决 taskSettingsService / taskDefaults.ts 之间的默认值不一致

## Impact

- Affected specs: 调度系统、学习系统、FSRS 间隔重复、知识衰减、设置页面
- Affected code:
  - `api/services/scheduler/smartSchedulerService.ts` — 合并到统一引擎
  - `api/services/scheduler/core/decisionEngine.ts` — 合并到统一引擎
  - `api/services/scheduler/taskRecommendationService.ts` — 合并到统一引擎
  - `api/services/scheduler/masteryDecayService.ts` — 衰减模型统一
  - `api/services/scheduler/core/learningLoopOrchestrator.ts` — 扩展为工作流引擎
  - `api/services/scheduler/subtaskStateMachine.ts` — 阈值统一
  - `api/services/scheduler/subtaskKnowledgeSync.ts` — 阈值统一
  - `api/services/scheduler/subtaskQuizIntegration.ts` — 权重可配置
  - `api/services/study/studyService.ts` — FSRS 参数扩展
  - `api/services/scheduler/sm2Service.ts` — 移除
  - `src/pages/Settings.tsx` — 新增学习配置面板
  - `shared/types/scheduler.ts` — 新增学习模式和工作流类型
  - `shared/types/common.ts` — 扩展 StudyCard 和 TutorMode 类型
  - `supabase/migrations/` — 新增调度配置表

## ADDED Requirements

### Requirement: 统一自适应调度引擎

系统 SHALL 将 SmartSchedulerService、DecisionEngine、TaskRecommendationService 三套调度系统合并为一个统一的自适应调度引擎，所有权重因子可配置。

#### Scenario: 统一调度入口
- **WHEN** 任何模块需要获取任务推荐
- **THEN** 系统通过统一的 `AdaptiveSchedulerService` 提供推荐，不再有三套独立的推荐逻辑

#### Scenario: 权重因子可配置
- **WHEN** 用户在设置中调整调度权重（如提高掌握度权重、降低时段匹配权重）
- **THEN** 系统使用用户配置的权重计算推荐分数，而非硬编码值

#### Scenario: 权重自适应调优
- **WHEN** 用户持续使用调度系统 2 周以上且积累了 50+ 条任务完成记录
- **THEN** 系统根据用户实际完成率、专注时长等数据自动微调调度权重因子（每次调整幅度不超过 10%）

#### Scenario: 效率画像冷启动
- **WHEN** 新用户首次使用调度系统
- **THEN** 系统基于用户选择的偏好（如"早起型"/"夜猫型"/"均衡型"）初始化效率画像，而非使用空白画像

---

### Requirement: 可配置学习工作流引擎

系统 SHALL 将固定4阶段的 LearningLoop 扩展为可配置的学习工作流引擎，支持自定义阶段、转换规则和学习模式。

#### Scenario: 学习工作流按知识图谱节点顺序执行
- **WHEN** 用户启动一个图谱的学习工作流
- **THEN** 系统按知识图谱的拓扑顺序（依赖关系）依次为每个节点执行学习工作流，前置节点未达标时阻塞后续节点

#### Scenario: 工作流阶段可配置
- **WHEN** 用户选择一种学习模式（如"深度学习模式"）
- **THEN** 系统按照该模式定义的工作流阶段执行（如：学习材料→主动回忆→练习→测验→复习），而非固定的 learn→test→review→iterate

#### Scenario: 阶段转换条件可配置
- **WHEN** 用户在某个工作流阶段达到退出条件（如练习正确率 >= 80%）
- **THEN** 系统自动转换到下一个阶段；若未达到退出条件，则继续当前阶段或回退到前一阶段

#### Scenario: 工作流中断恢复
- **WHEN** 用户中断学习后重新进入
- **THEN** 系统恢复到上次中断的工作流阶段和节点，继续执行

---

### Requirement: 学习模式系统

系统 SHALL 支持6种学习模式，每种模式对应不同的工作流阶段、FSRS 参数和调度策略。

#### Scenario: 刷题模式（Drill）
- **WHEN** 用户选择刷题模式
- **THEN** 系统跳过学习材料阶段，直接进入测验阶段，FSRS 使用短间隔高频率策略（request_retention=0.85, maximum_interval=30），评分简化为 Again/Good 二元

#### Scenario: 深度学习模式（Deep Study）
- **WHEN** 用户选择深度学习模式
- **THEN** 系统执行完整工作流（学习材料→主动回忆→练习→测验→反思），FSRS 使用标准参数（request_retention=0.9, maximum_interval=36500），4级评分

#### Scenario: 快速浏览模式（Preview）
- **WHEN** 用户选择快速浏览模式
- **THEN** 系统仅执行学习材料阅读阶段，单次曝光后标记为"已浏览"，FSRS 不生成复习卡片，节点掌握度设为 0.1

#### Scenario: 间隔复习模式（Spaced Review）
- **WHEN** 用户选择间隔复习模式
- **THEN** 系统仅展示到期复习的节点，按 FSRS 标准调度执行复习，4级评分

#### Scenario: 测验模式（Quiz Only）
- **WHEN** 用户选择测验模式
- **THEN** 系统直接对所有已学节点进行测验，根据测验结果更新掌握度和 FSRS 状态，跳过学习材料阶段

#### Scenario: 混合模式（Mixed）
- **WHEN** 用户选择混合模式
- **THEN** 系统根据节点当前状态自动选择策略：新节点→深度学习，已学节点→间隔复习，衰减节点→刷题强化

---

### Requirement: FSRS 参数配置面板

系统 SHALL 在设置页面提供完整的 FSRS 参数配置面板，支持用户自定义间隔重复策略。

#### Scenario: FSRS 基础参数配置
- **WHEN** 用户打开设置页面的"学习策略"部分
- **THEN** 系统展示 FSRS 参数配置面板，包含：目标记忆保持率（0.70-0.99）、最大复习间隔天数（1-36500）、默认学习模式选择

#### Scenario: 学习模式参数配置
- **WHEN** 用户在配置面板中选择一种学习模式
- **THEN** 系统展示该模式对应的 FSRS 参数预设值，用户可在此基础上微调

#### Scenario: 掌握度阈值配置
- **WHEN** 用户在配置面板中调整掌握度阈值
- **THEN** 系统展示统一的阈值配置：学习/复习分界、复习/练习分界、练习/测验分界，修改后全局生效

#### Scenario: 参数重置
- **WHEN** 用户点击"恢复默认设置"
- **THEN** 系统将所有 FSRS 参数和阈值恢复为推荐默认值

---

### Requirement: 知识衰减与 FSRS 统一

系统 SHALL 用 FSRS 的 stability 参数替代 masteryDecayService 中的 `easeFactor * decayBaseFactor`，统一衰减模型。

#### Scenario: 基于 FSRS stability 的衰减计算
- **WHEN** 系统计算知识点的掌握度衰减
- **THEN** 使用 FSRS 的 `fsrs_stability` 作为衰减参数（`R = e^(-t/S)`），而非 `easeFactor * decayBaseFactor`

#### Scenario: 无 FSRS 数据的节点降级处理
- **WHEN** 知识点没有 FSRS 数据（新节点或未复习过的节点）
- **THEN** 系统使用默认稳定性值（基于节点难度估算）进行衰减计算

#### Scenario: 关联性衰减修正
- **WHEN** 系统计算某节点的衰减后掌握度
- **THEN** 根据该节点在知识图谱中的邻居节点平均掌握度进行修正：邻居掌握度越高，衰减越慢（修正系数 = 1 + 0.2 * 邻居平均掌握度）

---

### Requirement: 掌握度阈值统一

系统 SHALL 统一 SubtaskStateMachine、SubtaskKnowledgeSync、MasteryDecayService 之间的掌握度阈值，消除不一致。

#### Scenario: 统一阈值生效
- **WHEN** 系统判断节点的学习状态转换
- **THEN** 使用统一的阈值配置：learning→review 分界 0.3、review→practice 分界 0.5、practice→quiz 分界 0.7、quiz 深化阈值 0.85

#### Scenario: 阈值可配置
- **WHEN** 用户在设置中调整掌握度阈值
- **THEN** 所有使用该阈值的模块（状态机、知识同步、衰减服务）统一使用新值

---

### Requirement: SM2 残留清理

系统 SHALL 清除所有 SM2 算法的残留引用，确保全部使用 FSRS。

#### Scenario: SmartSchedulerService 掌握度估算迁移
- **WHEN** SmartSchedulerService 需要估算知识点掌握度
- **THEN** 使用 FSRS 的 `min(1, fsrs_stability / 30)` 估算，而非调用已废弃的 `sm2Service.estimateMasteryLevel()`

#### Scenario: SM2 服务移除
- **WHEN** 系统启动
- **THEN** `sm2Service.ts` 不再被任何模块引用，可安全移除

---

### Requirement: 默认值统一

系统 SHALL 统一 taskSettingsService 和 taskDefaults.ts 之间的默认值不一致。

#### Scenario: 任务时间片默认值统一
- **WHEN** 新用户首次使用任务系统
- **THEN** 系统使用统一的默认值：q0=25min, q1=45min, q2=90min, break=5min

## MODIFIED Requirements

### Requirement: 智能调度服务（现有）

现有 SmartSchedulerService 的5个硬编码权重（timeSlot=0.2, mastery=0.25, dependency=0.25, typeMatch=0.15, priority=0.15）修改为从用户配置读取，支持自适应调优；时段映射从硬编码中文标签修改为基于用户效率数据的动态映射。

### Requirement: 学习循环编排器（现有）

现有 LearningLoopOrchestrator 的固定4阶段循环（learn→test→review→iterate）修改为可配置的多阶段工作流，支持学习模式驱动的阶段定义和转换规则。

### Requirement: 掌握度衰减服务（现有）

现有 MasteryDecayService 的衰减公式从 `mastery * e^(-t/(EF*base))` 修改为 `R = e^(-t/S)`（基于 FSRS stability），增加关联性修正因子。

### Requirement: FSRS 学习服务（现有）

现有 studyService 的 `getFSRS()` 方法从仅读取 request_retention 和 maximum_interval 修改为支持学习模式预设参数，新增学习模式参数覆盖逻辑。

## REMOVED Requirements

### Requirement: SM2 算法服务
**Reason**: 已被 FSRS 完全替代，`sm2Service.ts` 仍被 SmartSchedulerService 引用造成混淆
**Migration**: 将 SmartSchedulerService 中的 `sm2Service.estimateMasteryLevel()` 调用替换为基于 FSRS stability 的估算，然后移除 `sm2Service.ts`

### Requirement: 三套独立调度系统
**Reason**: SmartSchedulerService、DecisionEngine、TaskRecommendationService 功能重叠严重，权重和逻辑不一致
**Migration**: 合并为统一的 AdaptiveSchedulerService，保留各系统的核心能力（多维度评分、依赖感知、时段匹配），消除冗余
