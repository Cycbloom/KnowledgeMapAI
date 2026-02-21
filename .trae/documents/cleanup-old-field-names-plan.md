# 清理旧字段名计划

## 背景

用户确认不需要向后兼容，需要彻底移除所有旧字段名。

## 需要清理的文件

### 1. 备份相关（移除旧字段名支持）

| 文件 | 操作 |
|------|------|
| `api/routes/backup.ts` | 移除对 `source_node_id`/`target_node_id` 的兼容处理 |
| `api/services/backupService.ts` | 移除导出时的旧字段名 |

### 2. 类型定义

| 文件 | 操作 |
|------|------|
| `src/types/index.ts` | 移除 `target_node_id` 可选字段 |

### 3. API 参数名

| 文件 | 操作 |
|------|------|
| `api/routes/learningPath.ts` | `target_node_id` → `target_knowledge_point_id` |
| `src/services/api/learningPaths.ts` | `target_node_id` → `target_knowledge_point_id` |

### 4. 测试文件

| 文件 | 操作 |
|------|------|
| `src/utils/exportUtils.test.ts` | 更新测试数据 |
| `src/lib/graphUtils.test.ts` | 更新测试数据 |

## 执行步骤

### Step 1: 清理备份相关代码
- 移除 `backup.ts` 中的旧字段名兼容逻辑
- 更新 `backupService.ts` 导出格式

### Step 2: 更新类型定义
- 移除 `src/types/index.ts` 中的旧字段名

### Step 3: 更新 API 参数名
- 更新 `learningPath.ts` 路由
- 更新 `learningPaths.ts` 前端 API

### Step 4: 更新测试文件
- 更新测试数据使用新字段名
