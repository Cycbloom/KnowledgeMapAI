# Round 9: i18n 与超大文件清理 Spec

## Why

优化路线图第 9 轮包含 4 个任务（i18n 硬编码迁移、超大 service 拆分、超大路由拆分、mobile/web graphs 去重），工作量均为「大」或「中」。本 spec 验证各任务的现状与必要性，并对必要任务给出实施计划。

## What Changes

### 验证结论

| 任务 | 现状 | 必要性 | 本轮处理 |
|------|------|--------|----------|
| P2-17 i18n 硬编码 | 实际 526 处（roadmap 标注 386），分布在 132 个 .tsx 文件 | 必要 | 选 UnifiedWorkbench.tsx（31 处，最多）做迁移示范 |
| P2-01 AgentService.ts 拆分 | 43030 字符（roadmap 标注 40282，+2748），1479 行 | 必要 | 拆分 3 个零风险模块（skills.ts + analysisUtils.ts + SSEWriter） |
| P2-02 ai/config.ts 拆分 | 19114 字符（roadmap 标注 18091，+1023），641 行 | 必要 | 拆分为 config/ 目录下 6 个文件 |
| P2-02 mobile/web graphs 去重 | mobile 22335 字符、web 10803 字符，均实现 IGraphsApi 接口 | **不必要** | 仅记录验证结论 |

### 实施变更

- **P2-17**: 迁移 [UnifiedWorkWork.tsx](file:///d:/KnowledgeMap/src/pages/UnifiedWorkbench.tsx) 31 处硬编码中文到 i18n 资源文件
- **P2-01**: 从 [AgentService.ts](file:///d:/KnowledgeMap/api/services/agent/AgentService.ts) 抽取 3 个低风险模块：
  - `skills.ts` — SKILLS 常量（337 行纯数据）
  - `utils/analysisUtils.ts` — 4 个纯函数（parseStructuredResult / generateAnalysisSummary / needsSecondaryAnalysis / identifyDepthTargets）
  - `SSEWriter.ts` — SSE 写入封装（sendSSE 方法）
- **P2-02**: 将 [ai/config.ts](file:///d:/KnowledgeMap/api/routes/ai/config.ts) 拆分为 `ai/config/` 目录：
  - `index.ts` — router 聚合
  - `shared.ts` — 共享常量 + 工具函数
  - `providers.ts` — /providers 路由（含 /test）
  - `database.ts` — /database 路由
  - `main-ai.ts` — /main-ai 路由
  - `embedding.ts` — /embedding 路由

## Impact

- **Affected specs**: 无（新 spec）
- **Affected code**:
  - `src/pages/UnifiedWorkbench.tsx` + `src/i18n/locales/zh-CN.json` + `src/i18n/locales/en-US.json`
  - `api/services/agent/AgentService.ts` + 新建 `api/services/agent/skills.ts` + `api/services/agent/utils/analysisUtils.ts` + `api/services/agent/SSEWriter.ts`
  - `api/routes/ai/config.ts`（删除）+ 新建 `api/routes/ai/config/` 目录下 6 个文件
  - `api/routes/ai/index.ts`（若引用 config.ts 需更新为 config/index）

## ADDED Requirements

### Requirement: i18n 迁移示范

系统 SHALL 将 UnifiedWorkbench.tsx 中的硬编码中文字符串迁移到 i18n 资源文件，使用 `t()` 函数引用。

#### Scenario: 迁移后行为一致
- **WHEN** 用户在 UnifiedWorkbench 页面查看界面文本
- **THEN** 显示的文本与迁移前完全一致（中文环境下）
- **AND** 切换到英文环境时显示对应英文翻译

### Requirement: AgentService 低风险模块抽取

系统 SHALL 从 AgentService.ts 抽取 skills.ts、analysisUtils.ts、SSEWriter.ts 三个模块，保持对外 API 不变。

#### Scenario: 抽取后行为等价
- **WHEN** AgentService 执行会话、工具调用、SSE 写入
- **THEN** 行为与抽取前完全等价
- **AND** AgentService.ts 行数从 1479 降至约 1100

### Requirement: ai/config 路由拆分

系统 SHALL 将 ai/config.ts 拆分为 config/ 目录下 6 个文件，保持路由路径与行为不变。

#### Scenario: 拆分后路由等价
- **WHEN** 客户端请求 /api/ai/config/providers、/database、/main-ai、/embedding 任一路由
- **THEN** 响应与拆分前完全等价

## REMOVED Requirements

### Requirement: mobile/web graphs 去重

**Reason**: 验证结论为两者不存在真正重复代码。两者都实现 IGraphsApi 接口（47 方法），方法名 100% 相同是接口契约的必然结果（多态设计要求），但方法体逻辑 0% 重复：mobile 层直连 Supabase 数据库（`withClient` + `.from().select()`），web 层通过 HTTP `request()` 调用后端 API。此外 mobile 层有 25 个方法是 `throw NotSupportedError` 占位实现。表面的方法名/签名重叠是接口实现的固有特征，不构成需要消除的重复代码。

**Migration**: 无需任何代码修改。若未来要减少 mobile 的 25 个 NotSupportedError 样板代码，可在 IGraphsApi 抽象基类中提供默认实现，但这属于可选优化。
