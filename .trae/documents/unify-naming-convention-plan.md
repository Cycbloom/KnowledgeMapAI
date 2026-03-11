# 统一命名规范实施计划

## 目标

统一服务文件和路由文件的命名规范：
- **服务文件**：统一使用 `xxxService.ts` 格式
- **路由文件**：统一使用 `xxx.ts` 或 `xxxRoutes.ts` 格式（保持现有风格，统一为 `xxx.ts`）

## 当前命名问题分析

### 服务文件问题

| 当前文件名 | 问题 | 目标文件名 |
|-----------|------|-----------|
| `cache.ts` | 缺少 Service 后缀 | `cacheService.ts` |
| `queue.ts` | 缺少 Service 后缀 | `queueService.ts` |
| `backupSync.ts` | 缺少 Service 后缀 | `backupSyncService.ts` |

**注意**：`cache.ts` 和 `queue.ts` 只是重导出文件，实际服务在 `cacheService.ts` 和 `queueService.ts`

### 路由文件分析

路由文件目前使用 `xxx.ts` 格式（如 `auth.ts`, `graphs.ts`），风格统一，无需修改。

## 实施步骤

### 步骤 1：处理 cache.ts 重导出文件

**当前状态**：
- `cache.ts` 只是重导出 `cacheService.ts` 的内容
- `cacheService.ts` 已存在且命名正确

**操作**：
1. 删除 `api/services/cache.ts`（重导出文件）
2. 更新所有导入路径：`from '../services/cache.js'` → `from '../services/cacheService.js'`

**受影响文件**（9 个）：
- `api/routes/templates.ts`
- `api/routes/study.ts`
- `api/routes/nodes.ts`
- `api/routes/knowledgePoints.ts`
- `api/routes/graphs.ts`
- `api/routes/data.ts`
- `api/routes/autoGraph.ts`
- `api/jobs/taskProcessor.ts`
- `api/routes/backup.ts`

### 步骤 2：处理 queue.ts 重导出文件

**当前状态**：
- `queue.ts` 只是重导出 `queueService.ts` 的内容
- `queueService.ts` 已存在且命名正确

**操作**：
1. 删除 `api/services/queue.ts`（重导出文件）
2. 更新 `api/services/index.ts` 中的导出（已正确导出 `queueService`）

**受影响文件**：
- 无外部文件直接导入 `queue.ts`

### 步骤 3：处理 backupSync.ts 重导出文件

**当前状态**：
- `backupSync.ts` 只是重导出 `backupSyncService.ts` 的内容
- `backupSyncService.ts` 已存在且命名正确

**操作**：
1. 删除 `api/services/backupSync.ts`（重导出文件）
2. 更新 `api/services/index.ts` 中的导出（已正确导出）

**受影响文件**：
- 无外部文件直接导入 `backupSync.ts`

### 步骤 4：更新 services/index.ts

确保所有导出都指向正确的 `xxxService.ts` 文件。

### 步骤 5：验证

1. 运行 `npm run check` 确保类型检查通过
2. 运行 `npm run lint` 确保代码规范通过
3. 运行 `npm run dev` 确保服务正常启动

## 文件变更清单

### 需要删除的文件
- `api/services/cache.ts`（重导出文件，冗余）
- `api/services/queue.ts`（重导出文件，冗余）
- `api/services/backupSync.ts`（重导出文件，冗余）

### 需要修改的文件

| 文件 | 修改内容 |
|------|----------|
| `api/routes/templates.ts` | 导入路径 `cache.js` → `cacheService.js` |
| `api/routes/study.ts` | 导入路径 `cache.js` → `cacheService.js` |
| `api/routes/nodes.ts` | 导入路径 `cache.js` → `cacheService.js` |
| `api/routes/knowledgePoints.ts` | 导入路径 `cache.js` → `cacheService.js` |
| `api/routes/graphs.ts` | 导入路径 `cache.js` → `cacheService.js` |
| `api/routes/data.ts` | 导入路径 `cache.js` → `cacheService.js` |
| `api/routes/autoGraph.ts` | 导入路径 `cache.js` → `cacheService.js` |
| `api/jobs/taskProcessor.ts` | 导入路径 `cache.js` → `cacheService.js` |
| `api/routes/backup.ts` | 导入路径 `cache.js` → `cacheService.js` |

## 风险评估

- **风险等级**：低
- **影响范围**：仅涉及导入路径修改，不改变业务逻辑
- **回滚方案**：恢复删除的文件和导入路径

## 预期结果

1. 所有服务文件统一使用 `xxxService.ts` 命名
2. 消除冗余的重导出文件
3. 导入路径更加清晰明确
4. 代码更易维护和理解
