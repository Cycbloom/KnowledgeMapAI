# Round 8 Task 10-13 Checklist

## Task 1: P3-10 windowManager/trayManager 接入（验证已在 Round 6 完成）

- [x] `electron/main.ts` 第 19 行 `import { windowManager } from "./utils/windowManager";`
- [x] `electron/main.ts` 第 20 行 `import { trayManager } from "./utils/trayManager";`
- [x] `electron/main.ts` 第 319 行 `windowManager.createWindow({...})` 委托 BrowserWindow 构造
- [x] `electron/main.ts` 第 495 行 `trayManager.initialize(mainWindow)` 调用
- [x] `electron/utils/windowManager.ts` 文件存在
- [x] `electron/utils/trayManager.ts` 文件存在

## Task 2: P3-11 autoUpdater UX 优化（验证已在 Round 6 完成）

- [x] `electron/main.ts` 第 502-503 行注释包含 "autoDownload disabled; renderer confirms download and install"
- [x] `electron/main.ts` 第 49 行 IPC channel 列表包含 `update:confirm-download`
- [x] `electron/main.ts` 第 49 行 IPC channel 列表包含 `update:install-confirmed`
- [x] `electron/ipc/updateHandlers.ts` 实现两个 IPC 处理器（L35-44 confirm-download + L46-55 install-confirmed）+ configureAutoUpdater（L65-127）设置 autoUpdater.autoDownload = false（L81）+ update-downloaded 不强制 quitAndInstall（L120-123）

## Task 3: P3-12 SQLite/PostgreSQL schema 同步 CI（重新评估为不必要）

- [x] `electron/db/migrations/001_initial.ts` 的 `generateCreateTableSQL` 函数已做类型适配（JSONB→TEXT 等，11 种类型映射）
- [x] `electron/db/schema.ts` 是 SQLite 本地表定义（ColumnDef 含 `type` + `pgType` 双字段；TableDef 含 `syncEnabled` / `userColumn` / `hasDeletedAt` / `hasUpdatedAt` 同步标识）
- [x] `supabase/migrations/` 下 39 个 SQL 文件是 PostgreSQL schema（独立于 SQLite）
- [x] 评估结论：P3-12 不必要（理由见 spec.md）
- [x] 未实施任何代码修改

## Task 4: P3-14 TypeScript Project References Build Mode 启用

- [x] `tsconfig.json` 已改为 solution 模式（`files: []` + `references` 数组）
- [x] `tsconfig.json` 不再包含 `include` 与 `compilerOptions` 字段
- [x] `package.json` 的 `check` 脚本改为 `tsc --build`（spec 原计划 `tsc --build --noEmit`，因 TS6310 不兼容改用 `tsc --build`，详见 tasks.md 偏离说明）
- [x] `package.json` 的 `check:incremental` 脚本改为 `tsc --build`（同上偏离说明）
- [x] `package.json` 的 `check:electron` 脚本保持不变；`check:full` 脚本从 `tsc --noEmit --force` 改为 `tsc --build --force`（solution-mode tsconfig.json 下旧脚本不会检查任何文件，必须改为 --build 模式才能强制全量编译）
- [x] `.gitignore` 已排除 `dist/` 目录与 `*.tsbuildinfo` 文件
- [x] `npm run check` 通过（退出码 0）
- [x] `npm run check:electron` 通过（退出码 0）
- [x] `npm run lint` 通过（退出码 0）
- [x] `npm run check:incremental` 第二次运行比第一次明显更快（第一次 228.75s，第二次 1.75s，提速 131x）
- [x] `tsconfig.src.json` 的 `include` 数组新增 `"src/**/*.json"` 修复 TS6307（composite 模式要求 JSON 文件显式列出）

## 全局验证

- [x] `npm run check` 通过
- [x] `npm run check:electron` 通过
- [x] `npm run lint` 通过
- [x] 无新增 `any` 类型（生产代码）
- [x] 无新增非空断言（`!`）
- [x] 无新增 `console.log`/`console.info`（前端）
- [x] 无新增 `console.*`（后端，使用 logger）

## 已知遗留问题（非本轮范围）

- **P3-12 SQLite/PostgreSQL schema 同步**：本轮评估为不必要。未来若需要可加 CI 脚本对比两套 schema 的字段一致性。
- **Redis 后端实现**：Round 8 Task 1-3 抽象了 cacheService / rateLimiter / eventBus 接口，但 Redis 后端实现未做。未来 Web 多实例部署时需新建 RedisCacheStore / RedisRateLimitStore / RedisEventBusBackend。
- **SSE 跨实例广播**：sseService 仍是进程内 Map，未来 Web 多实例部署时需让 sseService 订阅 eventBus。
