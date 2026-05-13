# Checklist: SM2 → FSRS 迁移

## Phase 1: 类型层验证

- [x] Task 1: `ReviewTask` 接口包含 `algorithm`, `fsrs_stability`, `fsrs_difficulty`, `fsrs_state` 可选字段，`interval_days`/`ease_factor` 改为 optional
- [x] Task 1: `FSRSReviewTask` 接口存在且强制要求 FSRS 字段
- [x] Task 2: 5 个 SM2 相关类型/接口带有 `@deprecated` 注释

## Phase 2: 服务层验证

- [x] Task 3: `createFirstReviewTask()` 默认创建 `study_cards` 记录，SM2 fallback 保留
- [x] Task 4: `processReviewResult()` 默认路由到 FSRS，SM2 路径保留
- [x] Task 5: `sm2Service.ts` 文件级和函数级均有 `@deprecated` 注释

## Phase 3: UI 层验证

- [x] Task 6: FSRS 卡片显示稳定性、难度、状态、可提取性
- [x] Task 6: SM2 卡片仍正常显示间隔、EF、次数
- [x] Task 6: 0-5 质量评分交互不变

## 整体验证

- [x] TypeScript 编译无错误（`npm run check`）
- [x] ESLint 检查通过（`npm run lint`）
- [x] 新复习任务创建到 `study_cards` 表中
- [x] 复习完成后 FSRS 字段正确更新
- [x] 遗留 SM2 卡片仍可正常完成复习