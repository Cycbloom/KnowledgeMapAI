# 类型安全加固 Spec

## Why

项目中有 959 处 `any` 类型使用，`tsconfig.electron.json` 的 strict 模式被跳过，导致类型安全隐患。用户要求分批修改，每次加固一部分，避免一次性修改太多导致的问题。

## 现状分析

### `any` 类型分布

| 模块 | any 数量 | 文件数 | 优先级 |
|------|----------|--------|--------|
| `api/services` | 222 | 37 | 高 |
| `src/services/mobile` | 186 | 27 | 高 |
| `api/routes` | 195 | 33 | 中 |
| `src/components` | 164 | 66 | 中 |
| `src/pages` | 96 | 17 | 低 |
| `src/hooks` | 84 | 22 | 低 |
| **总计** | **947** | **202** | - |

### 重难点文件

| 文件 | any 数量 | 问题 |
|------|----------|------|
| `api/services/common/backupService.ts` | 22 | 备份数据结构复杂 |
| `api/services/achievementService.ts` | 18 | 成就系统类型复杂 |
| `api/routes/knowledgePoints.ts` | 22 | 知识点关联类型 |
| `api/routes/autoGraph.ts` | 18 | AI 自动生成 |
| `src/services/mobile/scheduler/tasks.ts` | 30 | 任务系统核心 |
| `src/services/mobile/periodicTasks.ts` | 26 | 周期任务 |
| `src/pages/GraphMap.tsx` | 20 | 图谱地图复杂交互 |
| `src/pages/GraphEditor.tsx` | 13 | 图谱编辑器核心 |

## What Changes

### 分批计划

**批次 1**：`src/services/mobile/scheduler/`（70 处，13 文件）
- 已重构，结构清晰，优先处理
- 验证分批加固的可行性

**批次 2**：`api/services/common/`（44 处，3 文件）
- 备份服务、PDF 服务
- 独立模块，影响范围小

**批次 3**：`api/services/achievementService.ts` + `api/services/achievements/`（23 处，2 文件）
- 成就系统，业务逻辑独立

**批次 4**：`src/services/mobile/`（非 scheduler，116 处，14 文件）
- 已重构，结构清晰

**批次 5**：`api/routes/`（195 处，33 文件）
- 路由层，类型相对简单

**批次 6**：`src/components/`（164 处，66 文件）
- 组件层，数量多但分散

**批次 7**：`src/pages/` + `src/hooks/`（180 处，39 文件）
- 页面和 Hooks，最后处理

### 每批次流程

1. 分析该批次的 `any` 类型使用情况
2. 确定需要创建/修改的类型定义
3. 逐文件修复 `any` 类型
4. 运行 `npm run check` 验证
5. 运行 `npm run lint` 验证

## Impact

- Affected specs: 类型系统
- Affected code:
  - `api/services/` — 后端服务
  - `src/services/mobile/` — 移动端 API
  - `api/routes/` — 后端路由
  - `src/components/` — 前端组件
  - `src/pages/` — 前端页面
  - `src/hooks/` — React Hooks
  - `shared/types/` — 共享类型

## ADDED Requirements

### Requirement: 分批类型安全加固
系统 SHALL 分批次消除 `any` 类型，每批次完成后验证通过再进行下一批次。

#### Scenario: 批次完成验证
- **WHEN** 一个批次完成
- **THEN** `npm run check` 和 `npm run lint` 通过

### Requirement: 类型定义规范
新增类型定义 SHALL 放在 `shared/types/` 目录下，按功能域组织。

## MODIFIED Requirements

### Requirement: 代码质量
代码 SHALL 不包含 `any` 类型（除非有明确注释说明原因）。
