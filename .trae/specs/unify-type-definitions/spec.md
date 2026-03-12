# 统一类型定义位置 Spec

## Why

项目中的类型定义分散在多个位置，缺乏统一的组织结构。目前存在以下问题：
1. `api/types/` 目录不存在，后端专用类型分散在各服务文件中
2. 前端 `src/types/` 仅重导出共享类型，前端专用类型分散在组件中
3. 类型定义位置不明确，难以维护和查找

## What Changes

- 创建 `api/types/` 目录，存放后端专用类型
- 整理 `src/types/` 目录，集中前端专用类型
- 保持 `shared/types/` 作为前后端共享类型的位置
- 迁移分散的类型定义到统一位置

## Impact

- Affected specs: 整体项目类型系统
- Affected code: 
  - `api/types/` (新建)
  - `src/types/` (扩展)
  - `shared/types/` (保持)
  - 各服务文件中的类型定义

---

## ADDED Requirements

### Requirement: 类型定义目录结构

系统 SHALL 按照以下规则组织类型定义：

1. **`shared/types/`** - 前后端共享类型
   - 数据库实体类型（如 KnowledgePoint, Graph, ScheduledTask 等）
   - API 请求/响应类型
   - 业务领域类型

2. **`src/types/`** - 前端专用类型
   - 组件 Props 类型
   - 前端状态类型
   - UI 相关类型（如 CalendarEvent）

3. **`api/types/`** - 后端专用类型
   - AI 提供商配置类型
   - 服务内部类型
   - 中间件类型

### Requirement: 类型迁移规则

系统 SHALL 按照以下规则迁移现有类型：

1. **后端专用类型迁移到 `api/types/`**
   - `api/services/ai/types.ts` → `api/types/ai.ts`
   - 各服务文件中的内部类型 → `api/types/services.ts`
   - 中间件类型 → `api/types/middleware.ts`

2. **前端专用类型迁移到 `src/types/`**
   - `src/components/Calendar/types.ts` → `src/types/calendar.ts`
   - `src/services/api/types.ts` → `src/types/api.ts`

3. **共享类型保持在 `shared/types/`**
   - 现有共享类型位置不变

### Requirement: 类型导入路径更新

系统 SHALL 更新所有导入路径以反映新的类型位置：

1. 后端文件从 `api/types/` 导入后端专用类型
2. 前端文件从 `src/types/` 导入前端专用类型
3. 前后端都从 `@shared/types` 导入共享类型

---

## MODIFIED Requirements

### Requirement: 类型重导出

`api/types/index.ts` SHALL 重导出所有后端类型，同时重导出共享类型：

```typescript
// 后端专用类型
export * from './ai.js';
export * from './services.js';
export * from './middleware.js';

// 重导出共享类型
export * from '@shared/types';
```

`src/types/index.ts` SHALL 重导出所有前端类型，同时重导出共享类型：

```typescript
// 前端专用类型
export * from './calendar.js';
export * from './api.js';

// 重导出共享类型
export * from '@shared/types';
```

---

## REMOVED Requirements

无移除的需求。

---

## 实施计划

### 阶段一：创建目录结构和类型文件

1. 创建 `api/types/` 目录
2. 创建 `api/types/ai.ts` - 从 `api/services/ai/types.ts` 迁移
3. 创建 `api/types/services.ts` - 收集服务内部类型
4. 创建 `api/types/middleware.ts` - 收集中间件类型
5. 创建 `api/types/index.ts` - 重导出

### 阶段二：迁移前端类型

1. 创建 `src/types/calendar.ts` - 从 `src/components/Calendar/types.ts` 迁移
2. 创建 `src/types/api.ts` - 从 `src/services/api/types.ts` 迁移
3. 更新 `src/types/index.ts` - 添加重导出

### 阶段三：更新导入路径

1. 更新后端文件中的类型导入路径
2. 更新前端文件中的类型导入路径
3. 删除旧的类型文件

### 阶段四：验证

1. 运行类型检查 `npm run check`
2. 运行代码检查 `npm run lint`
3. 确保所有导入正确
