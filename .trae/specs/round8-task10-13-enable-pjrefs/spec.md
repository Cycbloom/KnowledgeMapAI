# Round 8 Task 10-13: Validate Already-Done Items + Enable TS Project References Build Mode Spec

## Why

用户请求继续完成第 8 轮 Task 10-13，并要求"验证这些优化是否必要，如果是，则完善这些优化"。经核查现状：
- **Task 10 (P3-10 windowManager/trayManager 接入)** 已在 Round 6 Task 9 完成：`electron/main.ts` 第 19-20 行 import `windowManager` 与 `trayManager`；第 319 行使用 `windowManager.createWindow({...})` 委托 BrowserWindow 构造；第 495 行调用 `trayManager.initialize(mainWindow)` 初始化系统托盘；`electron/utils/windowManager.ts` 与 `electron/utils/trayManager.ts` 均已存在。**无需重复实施**。
- **Task 11 (P3-11 autoUpdater UX 优化)** 已在 Round 6 Task 11 完成：`electron/main.ts` 第 502-503 行注释明确 "Task 7: auto-updater UX (autoDownload disabled; renderer confirms download and install via update:confirm-download / update:install-confirmed)"；第 49 行 IPC channel 列表包含 `update:confirm-download` 与 `update:install-confirmed`，是用户确认式更新流程。**无需重复实施**。
- **Task 12 (P3-12 SQLite/PostgreSQL schema 同步 CI)** 在 Round 6 评估为"与桌面应用定位不匹配暂缓"。本轮重新评估结论：**不必要**。理由：(1) SQLite schema 服务 Electron 桌面本地缓存（无网络时使用），PostgreSQL schema 服务 Supabase 云端主库，是"两种存储后端的不同 schema"，不是"同一份 schema 的两个表达"；(2) SQLite schema 已通过 `electron/db/migrations/001_initial.ts` 的 `generateCreateTableSQL` 函数做了类型适配（JSONB→TEXT、vector(N)→TEXT、TEXT[]→TEXT(JSON)、TIMESTAMPTZ→TEXT(ISO 8601)、BOOLEAN→INTEGER），强行同步会丢失这些本地适配；(3) 桌面应用不会切换到其他数据库后端，无切换需求；(4) 若未来真要同步，可加 CI 脚本对比两套 schema 的字段一致性，但这属于"长尾可维护性"问题，非必要修复。
- **Task 13 (P3-14 TypeScript Project References)** 当前状态：三个子项目（`tsconfig.{shared,api,src}.json`）已配置 `composite: true` + `declaration: true` + `outDir` + `references: [shared]`；上一轮 `fix-retry-tests-circular-imports` 已修复最后 4 处 `api → src` 类型 import 违规（`@/types` → `@shared/types`）；当前 `src ↔ api` 双向均无 import（仅通过 `shared` 间接通信）。**必要性成立**：可启用 `tsc --build` 模式让 TypeScript 自动按依赖图增量编译，跳过未变更子项目，并隔离子项目类型边界。

## What Changes

- **Task 10 / 11 / 12**：仅做现状验证，不修改代码
- **Task 13**：启用 TypeScript Project References build mode
  - 修改根 `tsconfig.json`：移除 `include`，改为 solution 模式（仅含 `files: []` + `references` 数组）
  - 修改 `package.json` 的 `check` 脚本：从 `tsc --noEmit` 改为 `tsc --build --noEmit`（保留 `--noEmit` 避免输出 .d.ts 干扰）
  - 修改 `package.json` 的 `check:incremental` 脚本：使用 `tsc --build --noEmit`（增量由 .tsbuildinfo 文件自动维护）
  - 保留 `check:electron` 脚本不变（独立编译 Electron 进程）
  - 验证 IDE 体验：VS Code 应正确识别 references，跳过子项目以外的文件
  - 新增 `.gitignore` 条目排除 `dist/` 目录（如未有）

## Impact

- Affected specs: 无（仅启用既有子项目配置 + 工具链优化）
- Affected code:
  - `d:\KnowledgeMap\tsconfig.json`（改为 solution 模式）
  - `d:\KnowledgeMap\package.json`（修改 check / check:incremental 脚本）
  - `d:\KnowledgeMap\.gitignore`（新增 dist/ 排除，如未有）

## ADDED Requirements

### Requirement: TypeScript Project References Build Mode

系统 SHALL 启用 TypeScript Project References build mode，让 `tsc --build` 自动按子项目依赖图增量编译。

#### Scenario: tsc --build 增量编译
- **WHEN** 运行 `npm run check`
- **AND** 自上次编译以来只有 `api/` 文件变更
- **THEN** tsc 仅重新编译 `tsconfig.api.json` 子项目
- **AND** 跳过 `tsconfig.shared.json` 与 `tsconfig.src.json`（无变更）
- **AND** 通过 `.tsbuildinfo` 文件记录编译状态

#### Scenario: 子项目隔离
- **WHEN** `api/` 文件尝试 `import { foo } from '@/types'`（指向 src/）
- **THEN** `tsc --build` 报错：`api` 子项目仅 `references` `shared`，不识别 `src` 别名
- **AND** 错误信息明确指向违反依赖边界

### Requirement: 根 tsconfig.json Solution 模式

根 `tsconfig.json` SHALL 仅作为 solution 文件，包含 `references` 数组指向三个子项目，自身不直接编译任何文件。

#### Scenario: 根 tsconfig 内容
- **WHEN** 读取 `tsconfig.json`
- **THEN** 包含 `"files": []` 与 `"references": [{path: "./tsconfig.shared.json"}, {path: "./tsconfig.api.json"}, {path: "./tsconfig.src.json"}]`
- **AND** 不包含 `include` / `compilerOptions` 字段

## MODIFIED Requirements

### Requirement: npm run check 脚本

`npm run check` SHALL 调用 `tsc --build --noEmit` 而非 `tsc --noEmit`，以启用 Project References 增量编译。

#### Scenario: npm run check 行为
- **WHEN** 运行 `npm run check`
- **THEN** 等价于 `tsc --build --noEmit`
- **AND** 退出码为 0 表示所有子项目通过类型检查

## REMOVED Requirements

### Requirement: 无移除项

本次修改不删除任何公开 API 或既有行为。
