# P3 复习流程验证报告

> 对应 spec：`.trae/specs/verify-app-running-p3-review-flow/`
> 验证日期：2026-08-10
> 目标：验证复习流程核心闭环——卡片生成 → 待复习卡片拉取 → 提交作答（FSRS 进度更新）→ 复习统计 → FSRS 参数读写，确保 FSRS 学习闭环不回归。

---

## 1. 覆盖清单盘点结果

审阅 `e2e/` 下全部既有用例，确认复习流程相关覆盖情况：

| 能力 | 既有覆盖 | 状态 |
|------|----------|------|
| 复习卡片生成（POST /study/cards） | ❌ 无 | **缺口** |
| 待复习卡片拉取（GET /study/cards） | ❌ 无 | **缺口** |
| 复习作答与进度更新（PUT /study/cards/:id/progress） | ❌ 无 | **缺口** |
| 复习统计（GET /study/stats） | ❌ 无 | **缺口** |
| FSRS 参数读写（GET/PUT /study/fsrs-parameters） | ❌ 无 | **缺口** |

> 结论：复习流程在既有 E2E 中**完全未覆盖**，本 spec 新建 `e2e/review-flow.spec.ts` 补齐全部 5 个场景。
> 注：`e2e/` 中 `backbone-node.spec.ts`、`calendar-subtask-display.spec.ts` 等文件对 "card/study" 的匹配均为无关文本，非复习流程覆盖。

## 2. 端点与字段确认（基于实际实现）

规范中简写为 `/api/learning/study/*`，但实际后端将 study 路由挂载在 **`/api/v1/study`**（见 `api/services/plugins/StudyPlugin.ts` L15 `kernel.registerRoutes("/api/v1/study", studyRoutes)`）。旧 `/api/*` 前缀通过 308 重定向到 `/api/v1/*`（见 `api/app.ts` L178-183）。测试按实际实现使用 `/api/v1/study/*`。

| 操作 | 实际端点 | 方法 | 请求字段 | 响应 |
|------|----------|------|----------|------|
| 生成卡片 | `/api/v1/study/cards` | POST | `knowledge_point_id`(必填)、`graph_id`(必填，见 `createCardSchema`)、`question`、`answer`、`card_type`、`options` | 201，`StudyCard`（含 `id`） |
| 拉取卡片 | `/api/v1/study/cards` | GET | `graph_id`、`knowledge_point_id`、`due`、`refresh` | `StudyCard[]` |
| 提交作答/进度 | `/api/v1/study/cards/:id/progress` | PUT | `quality`(0–5，见 `updateCardProgressSchema`) | `StudyCard`（`fsrs_state`/`fsrs_scheduled_days`/`review_count`/`next_review` 按 FSRS 更新，`studyService.updateProgress`） |
| 复习统计 | `/api/v1/study/stats` | GET | `graph_id` | `{ totalCards, dueCards, newCards, learningCards, reviewCards, relearningCards, averageRetrievability, averageStability, averageDifficulty }` |
| FSRS 参数读取 | `/api/v1/study/fsrs-parameters` | GET | — | `{ source, w, request_retention, maximum_interval, last_optimized_at }` |
| FSRS 参数写入 | `/api/v1/study/fsrs-parameters` | PUT | `w`(number[]，非空) | `{ source: "custom", w, ... }` |
| FSRS 参数重置 | `/api/v1/study/fsrs-parameters` | DELETE | — | `{ success, message }` |

> **生成卡片依赖说明**：`POST /study/cards`（`createCardWithGraphNode`）要求 `knowledge_point_id` 已挂载到图谱节点（`graph_nodes` 表），否则返回 404 `RESOURCE_NODE_NOT_FOUND`。因此测试通过 API 以「知识点 → 图谱节点 → 学习卡片」链条准备数据，**不依赖真实 AI**，无需使用 `e2e/helpers/aiMock.ts`。规范中的 AI 生成接口（`/api/ai/cards/generate-cards`）为可选路径，本测试采用更稳定、无 AI 依赖的直建方式。

## 3. 新增 E2E 用例（`e2e/review-flow.spec.ts`）

| 用例 | 验证点 | 结果 |
|------|--------|------|
| 应该能够通过 API 生成复习卡片 | POST 返回卡片含 `id` | ✅ 通过 |
| 应该能够拉取待复习卡片 | GET `?graph_id=` 可检索到生成的卡片 | ✅ 通过 |
| 应该能够提交复习作答并更新进度 | PUT `quality=3`，断言 `fsrs_state`→Learning、`review_count`、`fsrs_scheduled_days`、`next_review` 按 FSRS 更新 | ✅ 通过 |
| 应该能够查询复习统计 | GET `?graph_id=`，断言统计 9 字段完整且数值非负 | ✅ 通过 |
| 应该能够读写 FSRS 参数 | GET 读取 → PUT 写回（`source`→custom）→ DELETE 重置清理 | ✅ 通过 |

> 清理策略：卡片/图谱节点/学习卡片通过对「知识点」的**硬删除**级联清理（`study_cards.knowledge_point_id`、`graph_nodes.knowledge_point_id` 均为 `ON DELETE CASCADE`，见 `06_study_and_cards.sql`、`04_graph_structure.sql`）；图谱本身由 `testGraph` fixture teardown 永久删除。FSRS 参数写回后以 DELETE 重置，避免污染测试用户设置。

## 4. 类型/规范复核

- ✅ `e2e/review-flow.spec.ts` 通过严格 TypeScript 编译（`strict`、`noUnusedLocals`、`noNonNullAssertion` 等），无 `any`、无 `!` 非空断言。
- ✅ 遵循既有约定：使用 `e2e/fixtures.ts` 的 `test`/`expect` 与 `testGraph`/`authenticatedPage` fixture；App Action 模式（API 准备 + 显式断言）；测试描述为中文且以「应该」开头；无 `console.log`、无软跳过、无 `container.querySelector`。

## 5. E2E 执行结果

- 本地 Supabase 就绪后，`e2e/review-flow.spec.ts` 已实际执行：**5/5 用例通过**（chromium 项目）。
- 与 P2/P4/P5 的 spec 一并运行，共 **20/20** 通过，执行时长约 8.2 分钟。
- 复习流程（卡片生成 → 拉取 → 作答/FSRS 进度 → 统计 → FSRS 参数读写）闭环验证通过，未发现 P3 相关缺陷。

## 6. 结论

- ✅ 已补齐复习流程闭环 E2E 用例（`e2e/review-flow.spec.ts`，5 用例），覆盖生成 → 拉取 → 作答/进度 → 统计 → FSRS 参数。
- ✅ 用例已实际执行并全部通过（5/5）。
- 🔧 未修改任何业务逻辑。