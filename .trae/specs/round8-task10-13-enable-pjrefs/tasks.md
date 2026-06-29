# Tasks

- [x] Task 1: 验证 P3-10 windowManager/trayManager 接入已在 Round 6 完成
  - [x] SubTask 1.1: 核对 `d:\KnowledgeMap\electron\main.ts` 第 19 行 `import { windowManager } from "./utils/windowManager";` 与第 20 行 `import { trayManager } from "./utils/trayManager";`
  - [x] SubTask 1.2: 核对 `d:\KnowledgeMap\electron\main.ts` 第 319 行 `windowManager.createWindow({...})` 委托 BrowserWindow 构造
  - [x] SubTask 1.3: 核对 `d:\KnowledgeMap\electron\main.ts` 第 495 行 `trayManager.initialize(mainWindow)` 调用
  - [x] SubTask 1.4: 核对 `d:\KnowledgeMap\electron\utils\windowManager.ts` 与 `d:\KnowledgeMap\electron\utils\trayManager.ts` 文件存在

- [x] Task 2: 验证 P3-11 autoUpdater UX 优化已在 Round 6 完成
  - [x] SubTask 2.1: 核对 `d:\KnowledgeMap\electron\main.ts` 第 502-503 行注释 "Task 7: auto-updater UX (autoDownload disabled; renderer confirms download and install via update:confirm-download / update:install-confirmed)"
  - [x] SubTask 2.2: 核对 `d:\KnowledgeMap\electron\main.ts` 第 49 行 IPC channel 列表包含 `update:confirm-download` 与 `update:install-confirmed`
  - [x] SubTask 2.3: 核对 `d:\KnowledgeMap\electron\ipc\updateHandlers.ts` 实现 `update:confirm-download` 与 `update:install-confirmed` IPC 处理器（L35-44 + L46-55）+ configureAutoUpdater 设置 autoUpdater.autoDownload = false（L81）

- [x] Task 3: 重新评估 P3-12 SQLite/PostgreSQL schema 同步 CI 的必要性
  - [x] SubTask 3.1: 核对 `d:\KnowledgeMap\electron\db\migrations\001_initial.ts` 的 `generateCreateTableSQL` 函数已做类型适配（JSONB→TEXT、vector(N)→TEXT、TEXT[]→TEXT(JSON)、TIMESTAMPTZ→TEXT(ISO 8601)、BOOLEAN→INTEGER）
  - [x] SubTask 3.2: 核对 `d:\KnowledgeMap\electron\db\schema.ts` 是 SQLite 本地表定义（ColumnDef 含 type+pgType 双字段），与 `d:\KnowledgeMap\supabase\migrations\` 下的 PostgreSQL schema 是两套独立 schema
  - [x] SubTask 3.3: 评估结论：P3-12 判定为不必要（理由详见 spec.md）。不实施任何代码修改。

- [x] Task 4: 启用 TypeScript Project References build mode
  - [x] SubTask 4.1: 修改 `d:\KnowledgeMap\tsconfig.json`：移除 `include` 与 `compilerOptions` 字段，改为 `{ "files": [], "references": [{ "path": "./tsconfig.shared.json" }, { "path": "./tsconfig.api.json" }, { "path": "./tsconfig.src.json" }] }`
  - [x] SubTask 4.2: 修改 `d:\KnowledgeMap\package.json` 的 `check` 脚本：从 `tsc --noEmit` 改为 `tsc --build`（**偏离说明**：spec 原计划使用 `tsc --build --noEmit`，但实测触发 TS6310「Referenced project may not disable emit」，因 `--noEmit` CLI 标志会传播到所有被引用项目并覆盖其 `noEmit: false` 配置。改用 `tsc --build`，依赖子项目 `emitDeclarationOnly: true` 仅输出 .d.ts 到 gitignored 的 `dist/`，不产生 .js 文件）
  - [x] SubTask 4.3: 修改 `d:\KnowledgeMap\package.json` 的 `check:incremental` 脚本：使用 `tsc --build`（增量由 .tsbuildinfo 文件自动维护；同 SubTask 4.2 偏离说明）
  - [x] SubTask 4.4: 保留 `check:electron`、`check:full` 脚本不变（独立验证 Electron 进程 / 强制全量检查）
  - [x] SubTask 4.5: 核对 `.gitignore` 已排除 `dist/` 目录与所有 `*.tsbuildinfo` 文件（已新增 `*.tsbuildinfo` 条目）
  - [x] SubTask 4.6: 运行 `npm run check` 确认 tsc --build 通过（退出码 0）
  - [x] SubTask 4.7: 运行 `npm run check:electron` 确认 Electron 类型检查通过（退出码 0）
  - [x] SubTask 4.8: 运行 `npm run lint` 确认 ESLint 通过（退出码 0）
  - [x] SubTask 4.9: 运行 `npm run check:incremental` 确认增量编译工作（第一次 228.75s，第二次 1.75s，提速 131x）

### Task 4 实施偏离说明（TS6310 兼容性）

**问题**：spec 原计划使用 `tsc --build --noEmit` 同时启用 build mode 和 noEmit，但 TypeScript 5.8 的 `--noEmit` CLI 标志在 build mode 下会传播到所有被引用项目，覆盖 `tsconfig.shared.json` 中显式设置的 `noEmit: false`，触发 TS6310 错误「Referenced project may not disable emit」。被引用项目必须能够输出声明文件供下游项目消费。

**修复**：
1. `check` 和 `check:incremental` 脚本改用 `tsc --build`（不带 `--noEmit`）
2. 子项目 `tsconfig.shared.json` / `tsconfig.api.json` / `tsconfig.src.json` 已配置 `noEmit: false` + `emitDeclarationOnly: true` + `declaration: true`，因此只输出 .d.ts 文件到 `dist/` 目录（已被 .gitignore 排除），不产生 .js 文件
3. 修复 `tsconfig.src.json` 的 TS6307 错误：`include` 数组新增 `"src/**/*.json"`，使 `src/i18n/locales/*.json` 文件被纳入 composite 项目的文件列表（composite 模式要求所有被引用文件显式列出）

**验证结果**：
- `npm run check`：通过（退出码 0）
- `npm run check:electron`：通过（退出码 0）
- `npm run lint`：通过（退出码 0）
- `npm run check:incremental` 第一次（全量）：228.75s
- `npm run check:incremental` 第二次（增量）：1.75s（提速 131x，证明增量编译生效）

# Task Dependencies

- Task 1 / 2 / 3 互相独立，可并行（仅验证 + 评估）
- Task 4 是真正的实施任务，独立于 Task 1-3
- 全部 Task 完成后统一运行全局验证（check + check:electron + lint）
