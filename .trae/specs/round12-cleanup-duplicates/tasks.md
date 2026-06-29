# Tasks

## Task 1: 删除死代码

- [x] SubTask 1.1: 删除 `src/hooks/useSimilarityAnnotation.ts`，验证全代码库无引用
- [x] SubTask 1.2: 删除 `src/services/api/storyCreationApi.ts`，验证 `src/services/api/index.ts` 第 52 行的 `storyCreationApi` 导出来自 `./storyCreation` 而非 `./storyCreationApi`
- [x] SubTask 1.3: 运行 `npm run check` 验证无类型错误

## Task 2: syncEngine 复用 shared/utils/retry

- [x] SubTask 2.1: 读取 `electron/sync/syncEngine.ts` 第 393-433 行的 `retryWithBackoff` 和 `isRetryableError` 实现，记录调用点
- [x] SubTask 2.2: 将 `retryWithBackoff` 调用改为 `withRetry`（来自 `shared/utils/retry.ts`），调整参数映射（maxRetries/initialDelay/maxDelay/shouldRetry）
- [x] SubTask 2.3: 删除 `retryWithBackoff` 私有方法（保留 `isRetryableError` 因逻辑与 shared 版本不同，作为 shouldRetry 回调传入）
- [x] SubTask 2.4: 运行 `npm run check:electron` 验证

## Task 3: 迁移 markdownParser 到 shared/utils

- [x] SubTask 3.1: 对比 `src/utils/markdownParser.ts` 和 `api/utils/markdownParser.ts` 的实现差异，确认 `parseMarkdownToGraph` 签名一致
- [x] SubTask 3.2: 在 `shared/utils/markdownParser.ts` 创建统一实现（以 src 版本为基准，合并 api 版本的 properties 可选字段）
- [x] SubTask 3.3: `shared/utils/index.ts` 不存在，未创建
- [x] SubTask 3.4: `src/utils/markdownParser.ts` 改为 re-export `@shared/utils/markdownParser`
- [x] SubTask 3.5: `api/utils/markdownParser.ts` 改为 re-export `@shared/utils/markdownParser`
- [x] SubTask 3.6: 测试文件保留在原位置，通过 re-export 链访问统一实现
- [x] SubTask 3.7: 引用方通过 re-export 自动兼容，无需修改
- [x] SubTask 3.8: 运行 `npm run check && npm run check:electron` 验证

## Task 4: 提取 formatDuration 到统一 formatters.ts

- [x] SubTask 4.1: 在 `src/utils/formatters.ts` 创建文件，提供 formatDuration（秒）、formatDurationMinutes（分钟）、formatDurationMs（毫秒）三个函数
- [x] SubTask 4.2: 提供 FormatDurationOptions 支持 format（zh/zh-spaced/compact）、emptyText、round 参数
- [x] SubTask 4.3: 在 `src/utils/index.ts` 导出 formatters
- [x] SubTask 4.4: 19 个文件改为 import；6 个文件因 i18n 依赖或混合格式保留本地定义（已添加注释说明原因）
- [x] SubTask 4.5: 运行 `npm run check && npm run lint` 验证

## Task 5: 重命名 template.ts 为 taskTemplates.ts

- [x] SubTask 5.1: 读取 `src/services/api/template.ts` 全部内容，确认导出
- [x] SubTask 5.2: 创建 `src/services/api/taskTemplates.ts`，导出名改为 `taskTemplatesApi`
- [x] SubTask 5.3: 删除 `src/services/api/template.ts`
- [x] SubTask 5.4: 更新 8 个引用文件的 import 路径和导出名
- [x] SubTask 5.5: 运行 `npm run check` 验证

## Task 6: 提取 auth.ts 公共 JWT 验证逻辑

- [x] SubTask 6.1: 读取 `api/middleware/auth.ts` 完整实现
- [x] SubTask 6.2: 识别公共逻辑：本地 JWT 验证、user 缓存、远程 Supabase 验证
- [x] SubTask 6.3: 提取私有方法 `verifyAndCacheUser(token): Promise<{ user, supabaseClient } | null>`
- [x] SubTask 6.4: 重构 `requireAuth`：调用 `verifyAndCacheUser`，null 时抛 401 AppError
- [x] SubTask 6.5: 重构 `optionalAuth`：调用 `verifyAndCacheUser`，null 时 next()
- [x] SubTask 6.6: `requireAdmin` 未修改，仍复用 `requireAuth`
- [x] SubTask 6.7: 19 个 auth 测试全部通过

## Task 7: 消除 useTimerStore.focusSettings 双源真理

- [x] SubTask 7.1: 读取 `useTimerStore.ts`，标记所有 focusSettings 读取位置
- [x] SubTask 7.2: 读取 `storeIntegrations.ts`，理解事件同步机制
- [x] SubTask 7.3: 移除 `TimerState.focusSettings` 字段
- [x] SubTask 7.4: 移除 `syncFocusSettings` 方法及事件订阅
- [x] SubTask 7.5: `transitionToNextMode` 改为内部调用 `useFocusStore.getState()`
- [x] SubTask 7.6: `start`、`switchTask`、`reset`、`setMode` 改用 `useFocusStore.getState()`
- [x] SubTask 7.7: 保留 `DEFAULT_SETTINGS` import（仍用于初始 timeLeft/totalTime）
- [x] SubTask 7.8: 全局搜索确认无 syncFocusSettings、focus_settings_changed 残留
- [x] SubTask 7.9: 运行 `npm run check && npm run lint` 验证

## Task 8: 最终验证

- [x] SubTask 8.1: 运行 `npm run check`（增量类型检查，exit 0）
- [x] SubTask 8.2: 运行 `npm run check:electron`（Electron 类型检查，exit 0）
- [x] SubTask 8.3: 运行 `npm run lint`（ESLint 检查，exit 0）
- [x] SubTask 8.4: 运行 `npx vitest run api/__tests__/middleware/auth.test.ts`（19/19 通过）
  > 完整测试套件存在 81 个预存失败（i18n 迁移、graphUtils 颜色断言、forks worker 启动失败），均与 Round 12 修改无关
- [x] SubTask 8.5: 全局搜索验证（retryWithBackoff、syncFocusSettings、focus_settings_changed、services/api/template 均无残留）
- [x] SubTask 8.6: 规则合规验证（无新增 any、无非空断言、前端无 console.log/info、后端无 console.*、api 与 src 双向不依赖）

# Task Dependencies

- Task 1-7 相互独立，已并行执行完成
- Task 8（最终验证）依赖 Task 1-7 全部完成
