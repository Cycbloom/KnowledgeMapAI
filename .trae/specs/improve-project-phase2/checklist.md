# Checklist

## 批次 1：`src/services/mobile/scheduler/`

- [x] `src/services/mobile/scheduler/tasks.ts` 已加固（30 处 any）
- [x] `src/services/mobile/scheduler/` 其他文件已加固（40 处 any）
- [x] `npm run check` 和 `npm run lint` 通过

## 批次 2：`api/services/common/`

- [x] `api/services/common/backupService.ts` 已加固（22 处 any）
- [x] `api/services/common/pdfService.ts` 已加固（15 处 any）
- [x] `npm run check` 和 `npm run lint` 通过

## 批次 3：成就系统

- [x] `api/services/achievementService.ts` 已加固（18 处 any）
- [x] `api/services/achievements/achievementEngine.ts` 已加固（5 处 any）
- [x] `npm run check` 和 `npm run lint` 通过

## 批次 4：`src/services/mobile/`（非 scheduler）

- [x] `src/services/mobile/periodicTasks.ts` 已加固（26 处 any）
- [x] `src/services/mobile/` 其他文件已加固（85 处 any）
- [x] `npm run check` 和 `npm run lint` 通过

## 批次 5：`api/routes/`

- [x] `api/routes/knowledgePoints.ts` 已加固（22 处 any）
- [x] `api/routes/autoGraph.ts` 已加固（18 处 any）
- [x] `api/routes/` 其他文件已加固（140 处 any）
- [x] `npm run check` 和 `npm run lint` 通过

## 批次 6：`src/components/`

- [x] `src/components/GraphEditor/` 已加固
- [x] `src/components/` 其他组件已加固
- [x] `npm run check` 和 `npm run lint` 通过

## 批次 7：`src/pages/` + `src/hooks/`

- [x] `src/pages/GraphMap.tsx` 已加固（20 处 any）
- [x] `src/pages/GraphEditor.tsx` 已加固（13 处 any）
- [x] `src/pages/` 和 `src/hooks/` 其他文件已加固
- [x] `npm run check` 和 `npm run lint` 通过

## 最终验证

- [x] `npm run check` 全量类型检查通过
- [x] `npm run lint` 全量代码检查通过
- [ ] `npm run test:e2e` E2E 测试（可选）

## 代码质量指标

- [ ] 前端 `any` 类型数量 < 50（当前：255 处，减少 42%）
- [ ] 后端 `any` 类型数量 < 50（当前：282 处，减少 46%）
- [x] 新增类型定义已添加到 `shared/types/`

## 改进成果

| 指标 | 改进前 | 改进后 | 减少 |
|------|--------|--------|------|
| 前端 `any` 类型 | 441 处 | 255 处 | 42% |
| 后端 `any` 类型 | 518 处 | 282 处 | 46% |
| **总计** | **959 处** | **537 处** | **44%** |
