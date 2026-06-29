# Round 8 Task 6-9: Validation of Already-Done Items + P3-02 Re-evaluation Spec

## Why

用户请求继续完成第 8 轮 Task 6-9，并要求"验证这些优化是否必要，如果是，则完善这些优化"。经核查现状：
- **Task 6 (P3-01 Kernel 启动顺序解耦)** 已在 Round 6 Task 5 完成：`api/services/kernel/bootstrap.ts` 实现 `bootstrapKernel()` 函数注册 6 个内置插件；`api/app.ts` 改为 `createApp(kernel?: Kernel)` 工厂；模块底部单例调用 `bootstrapKernel()` 构造生产 app。**无需重复实施**。
- **Task 7 (P3-02 Repository 层抽取)** 在 Round 6 评估为"与桌面应用定位不匹配暂缓"。本轮重新评估结论：**不必要**。理由：(1) Round 6 Task 3 已通过 `softDeleteHelper.ts` 解决了 P3-04 的 `.is('deleted_at', null)` 258 处散落问题（统一 `notDeleted()` filter），主要重复模式已消除；(2) `services/graph/` 已有 27 个细拆文件、`services/scheduler/` 已有 40+ 个细拆文件，服务层职责清晰，无"巨型服务"问题；(3) Repository 层对桌面应用是过度设计，引入后增加抽象层次和理解成本，且不会带来数据库切换能力（仍依赖 Supabase client）。
- **Task 8 (P3-03 服务循环依赖)** 已在 Round 6 Task 4 完成核心循环：新建 `api/services/ai/contextBuilder.ts` 包含 `buildGraphContext` 与 `buildTutorContext` 纯函数，打破 `chatService ↔ aiService` 双向 import。当前 `aiService.ts` 仅 `import type { ChatService }`（类型 import，运行时无循环），`chatService.ts` 不再 import aiService。**无需重复实施**。
- **Task 9 (P3-09 IPC 按域拆分)** 已在 Round 6 Task 8 完成：`electron/ipc/` 下有 7 个 handler 文件（appHandlers / configHandlers / dbHandlers / shellHandlers / syncHandlers / updateHandlers / windowHandlers），`electron/main.ts` 在 `app.whenReady()` 中调用全部 7 个 `registerXxxHandlers()` 函数，无内联 `ipcMain.handle`。**无需重复实施**。

## What Changes

- 仅做现状验证，**不修改任何代码**
- 对 P3-02 进行必要性重新评估，结论为不必要（理由如上）
- 运行相关测试确认 Round 6 实施的成果仍正常工作

## Impact

- Affected specs: 无（仅验证 + 评估，不引入新行为或新约束）
- Affected code: 无（不修改任何文件）

## ADDED Requirements

### Requirement: 无新增需求

本次仅做验证与评估，不引入新功能或新约束。

## MODIFIED Requirements

### Requirement: 无修改项

本次不修改任何既有功能或约束。

## REMOVED Requirements

### Requirement: 无移除项

本次不删除任何既有功能或约束。

## 关于 P3-02 的评估备忘

P3-02 Repository 层抽取在本轮评估中**判定为不必要**，原因如下：

1. **核心重复模式已被解决**：Round 6 Task 3 通过 `softDeleteHelper.ts` 的 `notDeleted()` / `deletedOnly()` 高阶 filter 函数，统一了 258 处 `.is('deleted_at', null)` 散落问题。这是 P3-04 的核心目标，已达成。
2. **服务层已细拆**：`services/graph/` 已有 27 个文件（`graphService.ts` / `graphNodeService.ts` / `edgeService.ts` / `graphVersionService.ts` / `knowledgePointService.ts` 等按聚合根拆分）；`services/scheduler/` 已有 40+ 个文件按职责拆分。当前并不存在"超大 service 文件"反模式（参 P2-01 中超大文件清单，最大的是 AgentService.ts，非 graph/scheduler）。
3. **桌面应用定位不匹配**：引入 Repository 层意味着 route → service → repository → supabase 四层架构。桌面应用不会面临 ORM 切换、数据库类型切换（项目已选定 Supabase PostgreSQL + pgvector），无切换需求。
4. **理解成本增加**：每新增一类资源需要新建 repository 文件 + 修改 service 注入；新成员理解"为何有 repository 又有 service"会增加学习曲线。
5. **未来可选路径**：若未来真有 Repository 化需求（如 Web 多实例部署时需要为缓存层提供更精细的失效控制），可按需逐表抽取（先从 `knowledge_graphs` / `graph_nodes` 等高频表开始），无需一次性大重构。

**保留作为已知遗留**：未来如果出现以下信号，可重新评估 P3-02：
- 服务层出现明显的 N+1 查询重复模式（如多个 service 重复实现同一查询逻辑）
- 引入新的数据源（如 MongoDB / 外部 API）需要抽象数据访问层
- Web 多实例部署需要为缓存层提供更精细的失效控制
