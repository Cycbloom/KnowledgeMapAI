# Round 9 Checklist

## Task 1: P2-17 i18n 验证 + UnifiedWorkbench.tsx 迁移示范

- [x] `src/pages/UnifiedWorkbench.tsx` 中 89 处硬编码中文已全部迁移为 `t()` 调用（含常量 label、属性值、JSX 文本节点）
- [x] `src/i18n/locales/zh-CN.json` 新增 unifiedWorkbench 命名空间，包含 76 个中文键值
- [x] `src/i18n/locales/en-US.json` 新增 unifiedWorkbench 命名空间，包含 76 个英文翻译
- [x] `npm run check` 通过（退出码 0）
- [x] `npm run lint` 通过（退出码 0）
- [x] 无新增 `any` 类型、非空断言 `!`、前端 `console.log/info`

## Task 2: P2-01 AgentService.ts 低风险拆分

- [x] `api/services/agent/skills.ts` 已创建（340 行），包含 SKILLS 常量
- [x] `api/services/agent/utils/analysisUtils.ts` 已创建（161 行），包含 4 个纯函数
- [x] `api/services/agent/SSEWriter.ts` 已创建（24 行），封装 sendSSE 方法
- [x] `api/services/agent/AgentService.ts` 已更新：import 新模块，删除已迁移代码，通过 `export { SKILLS }` 保持向后兼容
- [x] `AgentService.ts` 行数从 1479 降至 1007（减少 32%）
- [x] `npm run check` 通过（退出码 0）
- [x] `npm run lint` 通过（退出码 0）
- [x] 无新增 `any` 类型、非空断言 `!`、后端 `console.*`

## Task 3: P2-02 ai/config.ts 路由拆分

- [x] `api/routes/ai/config/shared.ts` 已创建（81 行），包含共享常量与工具函数
- [x] `api/routes/ai/config/providers.ts` 已创建（270 行），包含 /providers 路由（含 /test）
- [x] `api/routes/ai/config/database.ts` 已创建（133 行），包含 /database 路由
- [x] `api/routes/ai/config/main-ai.ts` 已创建（91 行），包含 /main-ai 路由
- [x] `api/routes/ai/config/embedding.ts` 已创建（122 行），包含 /embedding 路由
- [x] `api/routes/ai/config/index.ts` 已创建（14 行），聚合 4 个子路由
- [x] 原 `api/routes/ai/config.ts`（641 行）已删除
- [x] `api/routes/ai/index.ts` 的 `import configRouter from './config'` 自动解析到 `./config/index`，无需修改
- [x] `npm run check` 通过（退出码 0）
- [x] `npm run lint` 通过（退出码 0）
- [x] 无新增 `any` 类型、非空断言 `!`、后端 `console.*`

## Task 4: P2-02 mobile/web graphs 去重验证

- [x] 已验证 `src/services/mobile/graphs.ts`（22335 字符）与 `src/services/api/graphs.ts`（10803 字符）
- [x] 已确认两者都实现 IGraphsApi 接口（47 方法），方法名 100% 相同是接口契约要求
- [x] 已确认方法体逻辑 0% 重复（mobile 直连 Supabase，web 走 HTTP）
- [x] 已记录验证结论为「不必要」，未实施任何代码修改

## 全局验证

- [x] `npm run check` 通过
- [x] `npm run check:electron` 通过（退出码 0）
- [x] `npm run lint` 通过
- [x] 无新增 `any` 类型（生产代码）
- [x] 无新增非空断言（`!`）
- [x] 无新增 `console.log`/`console.info`（前端）
- [x] 无新增 `console.*`（后端，使用 logger）

## 已知遗留问题（非本轮范围）

- **P2-17 剩余 437 处硬编码**：本轮迁移 UnifiedWorkbench.tsx 89 处，剩余 526-89=437 处分布在 131 个文件中，建议后续轮次按高频组件分批迁移
- **P2-01 剩余 5 个 service 文件**：本轮仅拆分 AgentService.ts 的 3 个低风险模块，剩余 literatureApplyService.ts（28722）、achievementService.ts（24580）、learningTools.ts（20252）、aiActionService.ts（20711）、cacheService.ts（14868）未拆分；AgentService.ts 的高风险模块（PendingActionManager / ToolExecutor / SessionOrchestrator）未拆分
- **P2-02 剩余 8 个路由文件**：本轮仅拆分 ai/config.ts，剩余 autoGraph.ts（17588）、learningPaths.ts（15356）、graphs/expansion.ts（14271）、literature.ts（13925）、agent.ts（11714）、ai/document.ts（11154）、ai/content.ts（10436）、knowledgePoints.ts（12735，可能已部分拆分）未拆分
- **AgentService.ts 已有 `finalSession!` 非空断言**：本轮未修复（避免越界），建议后续轮次清理
