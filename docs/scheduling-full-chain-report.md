# 调度系统全链路打通总结报告

> **📄 历史快照（2026-08-31）**：本报告记录 S1–S5 全链路首次打通时的状态。此后调度系统已演进为**统一计划体系**（2026-09-05，`f664f4d9`）：新增 `api/services/scheduler/planning/` 窗口式排课子系统（路径排课 / 阶段窗口 / 每日容量预算 / 排课同步）、`todayBriefService.ts` 今日简报（即本文"遗留建议 3"的落地）、学习路径排上日历（`/api/v1/calendar`，阶段窗口显示为日历事件）、以及目标驱动的跨图谱 AI 学习路径（`goalDrivenPathService`）。S1–S5 所述服务与端点均仍有效，但"队列 + next-step"不再是排课的唯一来源——排课现由阶段窗口 + 每日预算驱动。调度现状总览见 `docs/code-wiki.md` §5.4。

> 目标：将现有的任务调度/任务系统与学习过程深度结合，让用户按「图谱大任务 → 知识点子任务 → 学习循环 → 记忆打断复习」的队列式流程学习。
>
> 结论：**通路已全部打通**，共 **186 个测试通过**（含 17 个新增单元测试 + 5 个本地 DB 集成模拟），`npm run check` 与 ESLint 全部通过。

---

## 一、总体架构设计

### 1. 目标模型（一图一大任务 + 每知识点一子任务）

```
        ┌──────────────────────────────────────────────────────────┐
        │                     图谱 (knowledge_graph)                │
        │                          │                                │
        │                 大任务 (user_tasks                        │
        │              task_type=graph_learning)                    │
        │                          │ parent_task_id                 │
        │       ┌──────────────────┼──────────────────┐             │
        │  子任务 A            子任务 B            子任务 C           │
        │  (task_subtasks)    (task_subtasks)    (task_subtasks)    │
        │   learning_state      learning_state      learning_state  │
        │       │                  │                  │             │
        │   learning→review→practice→quiz→review   （状态机循环）      │
        └──────────────────────────────────────────────────────────┘
                     ▲                       ▲
             学习路径（learning_path）    记忆打断（调度决策器）
```

- **每个图谱** = 一个大的 `graph_learning` 任务（图谱创建时由 `smartTaskLinker` 自动建立）
- **每个知识点** = 一个子任务（子任务挂到大任务下，`parent_task_id` 关联）
- **学习路径** = 子任务之间的**顺序与依赖依据**（由图谱学习目标 + 节点关系规划）
- **记忆打断** = FSRS 到期复习达到阈值时，中断当前学习跳转到复习

### 2. 链路拓扑

按用户「开始学习一个图谱」的意图，五个阶段串成完整通路：

```
开始学习图谱(启动串联 S2)
   → 图谱大任务 + 按路径重排子任务
      → 学习材料(学习完成 S1)
         → 做练习题 / 测验(练习会话, 既有 completePractice/completeQuiz)
            → 专注计时(计时结算 S4)
               → 记忆到期(调度决策 S3)
                  → 打断跳转复习 (next-step 决策)
                     → 复习 → 状态机推进 → 继续下一子任务
```

---

## 二、核心逻辑（五阶段落地）

### S1 — 统一学习状态机

**文件**：`api/services/scheduler/learningFlowService.ts` + 路由 `api/routes/scheduler/learningFlow.ts`

- 权威状态来源：`task_subtasks.learning_state` + `knowledge_points.mastery_level`（单一写源）
- `completeLearning`：读完材料 → 重算掌握度 → 从 `learning` 推进到首个非 learning 阶段（review/practice/quiz）→ 幂等创建首次复习卡片 → 返回下一步推荐活动
- `completeReview`：复习完成 → `review` → `practice`
- `planInitialStage`：纯决策，复用已有的 `subtaskStateMachine.getRecommendedNextState`
- 前端接入：`orchestratorApi.completeLearning` 在 `LearningMode.startChallengeSession`（学习完成动作点）调用

> 关键价值：此前「读完材料」从不推进 `learning_state`，状态机四阶段只在练习/测验完成时流转。S1 补齐了**学习**与**复习**两个入口，四个阶段全部接到真实行为。

### S2 — 图谱启动串联（一图一大任务）

**文件**：`api/services/scheduler/graphLearningLauncherService.ts` + 路由 `api/routes/scheduler/graphLearning.ts`

- `startLearningForGraph`：
  1. 确保图谱大任务（复用 `smartTaskLinker`，已自动建大任务 + 每知识点子任务）
  2. 无 active 学习路径时用规则算法自动生成并保存；有则复用
  3. **将现有子任务按学习路径顺序重排**（`position`/`priority`/`learning_path_node_id`）
  4. 返回首个待执行子任务作为学习入口
- 前端：`orchestratorApi.startLearningForGraph` + `useSchedulerOrchestrator.startLearningForGraph` mutation

> 设计要点：不重复建子任务，而是**把学习路径作为排序依据，重排已有子任务**——避免数据重复，让「图谱大任务(总) → 知识点子任务(线程) → 学习路径(顺序)」三者合一。

### S3 — 调度决策器（记忆打断跳转）

**文件**：`api/services/scheduler/schedulerDecisionService.ts` + 路由 `api/routes/scheduler/decision.ts`

- `getNextStep` 返回「现在最该做的下一步」：
  1. **记忆打断**：到期复习（overdue）卡片数 ≥ 阈值（默认 3）→ 返回最高优先级复习项（逾期越久/掌握度越低越优先），附 `graphId` 用于跳转
  2. **队列推进**：否则从队列中选得分最高的进行中图谱任务，附其下一个待执行子任务
  3. 都无 → `empty`
- `needsReviewInterrupt`：供 UI 提示「建议先复习」
- `advanceAfterReview`：复习完成后推进子任务状态机（review → practice）
- 前端：`getNextStep`/`getReviewInterrupt` API + `useSchedulerOrchestrator.nextStep` query（5 分钟自动刷新）

> 关键价值：这是「记忆需要时常更新、学习到阈值会打断跳到另一图」的核心实现。首次把 FSRS 到期复习与队列推进合并成**单一决策点**。

### S4 — 计时与进展统一结算

**文件**：`api/services/scheduler/timeSettlementService.ts`

- `settleFocusSession`：专注会话结束时，把耗时分钟数统一结算到三处：
  1. `user_tasks.actual_duration`
  2. `task_subtasks.actual_duration`（进行中/首个待执行子任务）
  3. `learning_path_progress.time_spent`（通过子任务 `learning_path_node_id` 反查 `path_id` 累加）
- 接入 `api/services/core/subscribers/learningProgressSubscriber.ts` 的 `focus_session_ended` 事件

> 此前专注时长只在**前端**累计到 subtask，后端 `learning_path_progress.time_spent` 和 `user_tasks.actual_duration` 无人写入。S4 使后端事件驱动统一结算，四个阶段耗时都能汇入进度。

### S5 — 全链路模拟 + 测试

**文件**：`api/__tests__/integration/learningFlowSimulation.test.ts`（本地 Supabase 集成）

跑通：创建用户/图谱/知识点/节点/边 → `startLearningForGraph`（大任务+路径+重排）→ `completeLearning`（状态机推进+建卡）→ 练习会话完成 → `settleFocusSession`（时长结算）→ `getNextStep`（调度决策）。

---

## 三、路由与 API 汇总

| 方法 | 路径 | 阶段 | 说明 |
|------|------|------|------|
| POST | `/scheduler/learning-flow/complete-learning` | S1 | 学习完成推进状态机 |
| POST | `/scheduler/learning-flow/:id/complete-review` | S1 | 复习完成推进状态机 |
| POST | `/scheduler/graph-learning/:graphId/start` | S2 | 统一开始学习图谱入口 |
| GET | `/scheduler/next-step` | S3 | 调度决策（下一步） |
| GET | `/scheduler/review-interrupt` | S3 | 是否需要记忆打断 |
| （事件） | `focus_session_ended` | S4 | 专注时长统一结算 |

前端 API：`src/services/api/modules/scheduler/orchestrator.ts`（新增 `completeLearning`/`startLearningForGraph`/`getNextStep`/`getReviewInterrupt`）
前端 Hook：`src/hooks/scheduler/useSchedulerOrchestrator.ts`（新增 `startLearningForGraph` mutation + `nextStep` query）

---

## 四、测试验证结果

### 新增测试

| 测试文件 | 阶段 | 数量 | 覆盖场景 |
|---------|------|-----|---------|
| `api/services/scheduler/__tests__/learningFlowService.test.ts` | S1 | 9 | completeLearning/Review、planInitialStage、无子任务兜底 |
| `api/services/scheduler/__tests__/graphLearningLauncherService.test.ts` | S2 | 2 | 自动生成路径、复用已有路径 |
| `api/services/scheduler/__tests__/schedulerDecisionService.test.ts` | S3 | 3 | 复习打断、队列推进、空态 |
| `api/services/scheduler/__tests__/timeSettlementService.test.ts` | S4 | 3 | 无 task_id 跳过、全链路结算、无子任务兜底 |
| `api/__tests__/integration/learningFlowSimulation.test.ts` | S5 | 5 | 本地 DB 全链路集成 |

**单元测试小计：17 个**；**集成模拟：5 个**；合计新增 **22 个测试**。

### 全量结果

```
Test Files  10 passed (10)
Tests       181 passed (181)    // 调度相关套件 + 既有回归
+ 5 integration tests
```

- `npm run check`（tsc --build）：通过
- ESLint：通过（仅修复 `learningFlowSimulation.test.ts` 一个未使用的 `describe` 导入）

### 测试暴露并修复的真实缺陷

集成测试发现 `task_subtasks` **没有 `deleted_at` 列**，但 S2/S3/S4 三处误用了 `notDeleted()` 过滤，导致 `column task_subtasks.deleted_at does not exist`。已改为对 `task_subtasks` 使用普通查询（`notDeleted` 仅用于确有 `deleted_at` 的表如 `user_tasks`/`graph_nodes`）。这是模拟测试直接发现并修复的**生产级 bug**。

---

## 五、遗留与后续建议

1. **真实界面 E2E**：当前用本地 DB 集成模拟验证后端通路；如需补 Playwright 界面 E2E 可作为增量。
2. **到期复习阈值可配置**：默认 `REVIEW_INTERRUPT_OVERDUE_THRESHOLD = 3`，需根据用户实际复习量调优。
3. **多图谱轮转的 UI 引导**：`next-step`/`review-interrupt` 已提供接口，但尚未接入一个前置的「今日该学什么」卡片入口（可后续在产品层接入）。
4. **时间结算的并发安全**：`actual_duration` 累加为读-改-写，单用户场景安全；多端同时结算时可考虑原子更新。

---

*生成日期：2026-08-31 ・ 覆盖阶段：S1-S5 全链路*