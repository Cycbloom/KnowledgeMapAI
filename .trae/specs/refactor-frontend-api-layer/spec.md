# 前端 API 层重构 Spec

## Why

项目存在两个前端 API 层（`src/services/api/` 和 `src/services/mobile/`），共计 12015 行代码，存在大量重复逻辑和巨型文件。两个 Supabase 客户端工厂几乎相同，`mobile/scheduler.ts` 有 1181 行代码，严重影响可维护性和代码质量。

## 现状分析

### 文件规模统计

| 目录 | 文件数 | 总行数 | 巨型文件（>500行） |
|------|--------|--------|-------------------|
| `src/services/api/` | 52 | 5252 | 5 个 |
| `src/services/mobile/` | 19 | 6763 | 5 个 |

### 巨型文件清单

| 文件 | 行数 | 问题 |
|------|------|------|
| `mobile/scheduler.ts` | 1181 | 任务、队列、设置、专注、成就混合 |
| `mobile/aiService.ts` | 818 | AI 配置、客户端创建、服务混合 |
| `mobile/promptService.ts` | 774 | Prompt 模板、Schema、服务混合 |
| `mobile/graphs.ts` | 644 | 包含 ~230 行 stub 方法 |
| `mobile/study.ts` | 629 | 学习、Dashboard、统计混合 |
| `api/graphs.ts` | 440 | 图谱 CRUD 和复杂业务混合 |
| `api/ai.ts` | 402 | 多种 AI 功能混合 |

### 重复的 Supabase 客户端

```typescript
// src/lib/supabase.ts
createClient(url, anonKey, {
  auth: { autoRefreshToken: true, persistSession: true, storage: localStorage }
});

// src/services/mobile/client.ts
createClient(url, anonKey, {
  auth: { autoRefreshToken: true, persistSession: true, storage: localStorage },
  realtime: { params: { eventsPerSecond: 10 } }  // 唯一区别
});
```

### API 层架构差异

| 特性 | `api/` 层 | `mobile/` 层 |
|------|----------|-------------|
| 通信方式 | HTTP 请求（fetch） | 直接 Supabase 调用 |
| 认证 | Cookie + CSRF | Supabase Auth |
| 实时更新 | SSE | Supabase Realtime |
| 离线支持 | 无 | 本地存储 |

## What Changes

### 阶段一：合并 Supabase 客户端工厂

- 统一 `src/lib/supabase.ts` 和 `src/services/mobile/client.ts`
- 通过参数区分是否启用 realtime
- 删除 `mobile/client.ts`

### 阶段二：拆分巨型文件

- 拆分 `mobile/scheduler.ts`（1181 行）为独立模块
- 拆分 `mobile/aiService.ts`（818 行）
- 拆分 `mobile/promptService.ts`（774 行）
- 清理 `mobile/graphs.ts` 中的 stub 方法
- 拆分 `mobile/study.ts`（629 行）

### 阶段三：提取共享类型和工具

- 提取两个 API 层的共享类型到 `shared/types/`
- 提取共享工具函数
- 建立统一的错误处理机制

### 阶段四：优化 API 结构

- 统一 API 命名规范
- 建立清晰的模块边界
- 优化导入导出结构

## Impact

- Affected specs: 前端架构、类型系统
- Affected code:
  - `src/services/mobile/` — 大规模重构
  - `src/services/api/` — 接口统一
  - `src/lib/supabase.ts` — 客户端合并
  - `shared/types/` — 类型提取

## ADDED Requirements

### Requirement: 统一 Supabase 客户端工厂
系统 SHALL 提供唯一的 Supabase 客户端工厂，通过参数区分配置。

#### Scenario: 创建标准客户端
- **WHEN** 调用 `getSupabaseClient()`
- **THEN** 返回不带 realtime 配置的客户端

#### Scenario: 创建实时客户端
- **WHEN** 调用 `getSupabaseClient({ realtime: true })`
- **THEN** 返回带 realtime 配置的客户端

### Requirement: 模块化巨型文件
系统 SHALL 不存在超过 500 行的单个 API 文件。

#### Scenario: scheduler.ts 拆分
- **WHEN** 查看 `mobile/scheduler.ts`
- **THEN** 文件行数不超过 500 行，功能拆分到独立模块

### Requirement: 清理 Stub 方法
系统 SHALL 不包含未实现的 stub 方法。

#### Scenario: graphs.ts 清理
- **WHEN** 查看 `mobile/graphs.ts`
- **THEN** 不存在 `// TODO: implement` 或空方法体

### Requirement: 共享类型定义
系统 SHALL 两个 API 层共享相同的类型定义。

#### Scenario: Graph 类型唯一
- **WHEN** 搜索 Graph 接口定义
- **THEN** 仅在 `shared/types/` 中存在一份定义

## MODIFIED Requirements

### Requirement: API 模块结构
API 模块 SHALL 按功能域组织，每个模块不超过 500 行。

### Requirement: 导入导出规范
API 层 SHALL 使用统一的导入导出规范，避免循环依赖。

## REMOVED Requirements

### Requirement: 独立的移动端 Supabase 客户端
**Reason**: 与标准客户端几乎相同，仅多了 realtime 配置
**Migration**: 通过参数传递 realtime 配置

### Requirement: 移动端巨型文件
**Reason**: 严重影响可维护性
**Migration**: 拆分为独立功能模块
