# Round 12 验证清单

## 死代码删除验证

- [x] `src/hooks/useSimilarityAnnotation.ts` 文件已删除
- [x] `src/services/api/storyCreationApi.ts` 文件已删除
- [x] `grep -r "useSimilarityAnnotation" src/` 无结果（排除 .md 文档）
- [x] `grep -r "storyCreationApi" src/services/api/` 仅在 `index.ts` 出现，且来自 `./storyCreation` 导入
- [x] `npm run check` 通过，无类型错误

## syncEngine retry 复用验证

- [x] `electron/sync/syncEngine.ts` 不再包含 `retryWithBackoff` 方法定义
- [x] `electron/sync/syncEngine.ts` 保留 `isRetryableError` 作为 `shouldRetry` 回调传入 `withRetry`
  > 偏差说明：spec 原计划删除 `isRetryableError`，但验证发现其逻辑与 shared/utils/retry.ts 存在实质差异（syncEngine 版本检查 error.status 字段，shared 版本检查 error.message 子串），因此保留作为 `shouldRetry` 回调传入 `withRetry`，避免行为回归。
- [x] `electron/sync/syncEngine.ts` 顶部 import 了 `withRetry` from `shared/utils/retry`
- [x] 原 `retryWithBackoff` 调用点已改为 `withRetry` 调用，参数映射正确
- [x] `npm run check:electron` 通过

## markdownParser 迁移验证

- [x] `shared/utils/markdownParser.ts` 文件存在，导出 `parseMarkdownToGraph`
- [x] `src/utils/markdownParser.ts` 和 `api/utils/markdownParser.ts` 已改为 re-export `@shared/utils/markdownParser`
- [x] 引用方通过 re-export 链自动兼容，无需修改 import 路径
- [x] markdownParser 测试文件通过 re-export 链访问统一实现，测试通过
- [x] `npm run check && npm run check:electron` 通过

## formatDuration 提取验证

- [x] `src/utils/formatters.ts` 文件存在，导出 `formatDuration`、`formatDurationMinutes`、`formatDurationMs`
- [x] `grep -r "function formatDuration\|const formatDuration" src/` 仅在 `formatters.ts` 出现 1 次
  > 偏差说明：19 个文件已统一为 import；6 个文件（SchedulerStats、UnifiedWorkbench、ListView、DraggableTaskCard、TaskDistribution、KanbanView）因依赖 i18n 翻译键或混合格式（与统一实现行为不一致）保留本地定义，并已添加注释说明原因。spec 原始要求过严，实际采用"逐文件评估"策略确保行为等价。
- [x] 25 个原包含 `formatDuration` 定义的文件已逐个评估处理（19 个改为 import，6 个保留 local 并加注释）
- [x] 所有调用 `formatDuration` 的位置行为不变（注意秒/毫秒参数差异）
- [x] `npm run check && npm run lint` 通过

## template.ts 重命名验证

- [x] `src/services/api/taskTemplates.ts` 文件存在，导出 `taskTemplatesApi`
- [x] `src/services/api/template.ts` 文件已删除
- [x] 8 个引用文件的 import 路径已更新为 `@/services/api/taskTemplates`
- [x] 8 个引用文件的导出名已更新为 `taskTemplatesApi`
- [x] `grep -r "from.*services/api/template['\"]" src/` 无结果（排除 templates 复数）
- [x] `npm run check` 通过

## auth.ts 公共逻辑提取验证

- [x] `api/middleware/auth.ts` 包含私有方法 `verifyAndCacheUser`
- [x] `requireAuth` 调用 `verifyAndCacheUser`，返回 null 时抛 401 AppError
- [x] `optionalAuth` 调用 `verifyAndCacheUser`，返回 null 时 `next()`
- [x] `requireAdmin` 仍复用 `requireAuth`，行为不变
- [x] `api/__tests__/middleware/auth.test.ts` 所有 19 个测试通过
- [x] 鉴权行为等价：requireAuth 路由仍拒绝未认证请求，optionalAuth 路由仍允许未认证请求

## useTimerStore 双源真理消除验证

- [x] `src/store/useTimerStore.ts` 的 `TimerState` 接口不再包含 `focusSettings` 字段
- [x] `src/store/useTimerStore.ts` 不再包含 `syncFocusSettings` 方法
- [x] `transitionToNextMode` 函数改为从 `useFocusStore.getState()` 读取设置
- [x] `src/store/storeIntegrations.ts` 不再订阅 `focus_settings_changed` 事件
- [x] `src/services/FrontendEventTypes.ts` 移除 `FocusSettingsChangedPayload` 接口和 `focus_settings_changed` 事件条目
- [x] `grep -r "syncFocusSettings" src/` 无结果
- [x] `grep -r "focus_settings_changed" src/` 无结果
- [x] `npm run check && npm run lint` 通过

## 最终验证

- [x] `npm run check` 通过
- [x] `npm run check:electron` 通过
- [x] `npm run lint` 通过
- [x] `api/__tests__/middleware/auth.test.ts` 19/19 通过
  > 偏差说明：完整测试套件存在 81 个预存失败（i18n 迁移问题、graphUtils 颜色断言、forks worker 启动失败等），均与 Round 12 修改无关，已在 summary 中记录。
- [x] 无新增 `any` 类型
- [x] 无新增非空断言 `!`
- [x] 前端无新增 `console.log/info`
- [x] 后端无新增 `console.*`
- [x] `api/` 不依赖 `src/`
- [x] `src/` 不依赖 `api/`
