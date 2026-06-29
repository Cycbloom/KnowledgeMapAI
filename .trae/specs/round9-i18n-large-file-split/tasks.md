# Tasks

## Task 1: P2-17 i18n 验证 + UnifiedWorkbench.tsx 迁移示范

- [x] SubTask 1.1: 验证 P2-17 现状（grep `>[\u4e00-\u9fff]` 在 src/ 目录 .tsx 文件），确认实际 526 处硬编码（roadmap 标注 386），132 个文件
- [x] SubTask 1.2: 读取 `src/pages/UnifiedWorkbench.tsx` 识别硬编码中文（实际 89 处，含常量 label、属性值、JSX 文本节点）
- [x] SubTask 1.3: 为 UnifiedWorkbench 设计 i18n key 命名空间（unifiedWorkbench.title/subtitle/actions/labels/status/messages/tips/durations）
- [x] SubTask 1.4: 在 `src/i18n/locales/zh-CN.json` 添加 unifiedWorkbench 命名空间的中文键值（76 个 key）
- [x] SubTask 1.5: 在 `src/i18n/locales/en-US.json` 添加 unifiedWorkbench 命名空间的英文翻译（76 个 key）
- [x] SubTask 1.6: 修改 `src/pages/UnifiedWorkbench.tsx`，将 89 处硬编码中文替换为 `t()` 调用（含插值变量 {{count}}/{{hours}}/{{minutes}}/{{message}} 等）
- [x] SubTask 1.7: 运行 `npm run check` 与 `npm run lint` 验证（均退出码 0）

## Task 2: P2-01 AgentService.ts 低风险拆分

- [x] SubTask 2.1: 验证 P2-01 现状（6 个 service 文件字符数），确认 AgentService.ts 实际 43030 字符（roadmap 标注 40282，+2748）
- [x] SubTask 2.2: 新建 `api/services/agent/skills.ts`（340 行），将 SKILLS 常量迁移过去
- [x] SubTask 2.3: 新建 `api/services/agent/utils/analysisUtils.ts`（161 行），迁移 4 个纯函数（parseStructuredResult / generateAnalysisSummary / needsSecondaryAnalysis / identifyDepthTargets）
- [x] SubTask 2.4: 新建 `api/services/agent/SSEWriter.ts`（24 行），封装 sendSSE 方法（构造器接收 res，send(event) 写入 SSE 数据）
- [x] SubTask 2.5: 修改 `AgentService.ts`，import 上述 3 个新模块，删除已迁移代码（1479→1007 行，减少 32%）；通过 `export { SKILLS }` 保持向后兼容
- [x] SubTask 2.6: 运行 `npm run check` 与 `npm run lint` 验证（均退出码 0）
- [x] SubTask 2.7: 运行 agent 相关测试（`api/__tests__/services/agent/` 目录不存在，无 agent 测试）

## Task 3: P2-02 ai/config.ts 路由拆分

- [x] SubTask 3.1: 验证 P2-02 现状（9 个路由文件字符数），确认 ai/config.ts 实际 19114 字符（roadmap 标注 18091，+1023）
- [x] SubTask 3.2: 读取 `api/routes/ai/config.ts` 完整内容，确认 9 个路由分属 4 个功能域（providers/database/main-ai/embedding）
- [x] SubTask 3.3: 新建 `api/routes/ai/config/shared.ts`（81 行），迁移共享常量（PROVIDER_ENV_KEY_MAP / PROVIDER_DEFAULTS）与工具函数（maskApiKey / maskUrl / hasEnvFallback）
- [x] SubTask 3.4: 新建 `api/routes/ai/config/providers.ts`（270 行），迁移 GET/PUT /providers + POST /providers/test
- [x] SubTask 3.5: 新建 `api/routes/ai/config/database.ts`（133 行），迁移 GET/PUT /database
- [x] SubTask 3.6: 新建 `api/routes/ai/config/main-ai.ts`（91 行），迁移 GET/PUT /main-ai
- [x] SubTask 3.7: 新建 `api/routes/ai/config/embedding.ts`（122 行），迁移 GET/PUT /embedding
- [x] SubTask 3.8: 新建 `api/routes/ai/config/index.ts`（14 行），聚合 4 个子路由（router.use('/', subRouter)）
- [x] SubTask 3.9: 删除原 `api/routes/ai/config.ts`（641 行）；`api/routes/ai/index.ts` 的 `import configRouter from './config'` 自动解析到 `./config/index`，无需修改
- [x] SubTask 3.10: 运行 `npm run check` 与 `npm run lint` 验证（均退出码 0）

## Task 4: P2-02 mobile/web graphs 去重验证

- [x] SubTask 4.1: 验证 mobile/graphs.ts（src/services/mobile/graphs.ts，22335 字符）与 web/graphs.ts（src/services/api/graphs.ts，10803 字符）
- [x] SubTask 4.2: 确认两者都实现 IGraphsApi 接口（47 方法），方法名 100% 相同是接口契约要求
- [x] SubTask 4.3: 确认方法体逻辑 0% 重复（mobile 直连 Supabase，web 走 HTTP），不构成重复代码
- [x] SubTask 4.4: 记录验证结论为「不必要」，不实施任何代码修改

# Task Dependencies

- Task 1, 2, 3, 4 相互独立，可并行
- SubTask 1.4, 1.5 依赖 1.3（命名空间设计）
- SubTask 1.6 依赖 1.4, 1.5（i18n 资源就绪）
- SubTask 2.5 依赖 2.2, 2.3, 2.4（3 个新模块就绪）
- SubTask 2.6, 2.7 依赖 2.5
- SubTask 3.4-3.7 依赖 3.3（shared.ts 就绪）
- SubTask 3.8 依赖 3.4-3.7
- SubTask 3.9 依赖 3.8
- SubTask 3.10 依赖 3.9
