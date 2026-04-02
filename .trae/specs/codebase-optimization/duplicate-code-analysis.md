# 重复代码架构分析报告

## 概述

项目存在两套并行的 API 服务架构，导致大量代码重复：

1. **`src/services/api/`** - Web/桌面端 API 服务（使用 HTTP 请求）
2. **`src/services/mobile/`** - 移动端 API 服务（直接使用 Supabase 客户端）

## 发现的重复模块

### 1. Graphs 服务

| 文件 | 实现方式 | 特点 |
|------|----------|------|
| `api/graphs.ts` | HTTP 请求 | 轻量级，通过后端 API |
| `mobile/graphs.ts` | Supabase 直连 | 直接操作数据库，代码量大 |

**重复功能**：
- list()
- get()
- create()
- update()
- delete()
- 等等...

### 2. 其他重复服务

以下服务在两个目录都有实现：
- `achievements.ts`
- `auth.ts`
- `nodes.ts`
- `quiz.ts`
- `study.ts`
- `tasks.ts`
- `ai.ts`

## 架构对比

### 当前架构问题

```
┌─────────────────┐    ┌─────────────────┐
│   Web/Electron  │    │     Mobile      │
│                 │    │                 │
│  api/ 服务      │    │  mobile/ 服务   │
│  (HTTP)         │    │  (Supabase)     │
└────────┬────────┘    └────────┬────────┘
         │                      │
         ▼                      ▼
┌─────────────────┐    ┌─────────────────┐
│  Backend API    │    │  Supabase DB    │
│   (Express)     │    │                 │
└────────┬────────┘    └─────────────────┘
         │
         ▼
┌─────────────────┐
│  Supabase DB    │
└─────────────────┘
```

### 推荐统一架构

```
┌─────────────────┐    ┌─────────────────┐
│   Web/Electron  │    │     Mobile      │
│                 │    │                 │
└────────┬────────┘    └────────┬────────┘
         │                      │
         └──────────┬───────────┘
                    │
                    ▼
         ┌─────────────────┐
         │  统一 API 层    │
         │  (Adapter 模式) │
         └────────┬────────┘
                  │
        ┌─────────┴─────────┐
        │                   │
        ▼                   ▼
┌─────────────────┐  ┌─────────────────┐
│  HTTP Adapter   │  │  Supabase Adapter│
│  (Web/Electron) │  │  (Mobile)       │
└────────┬────────┘  └────────┬────────┘
         │                   │
         ▼                   ▼
┌─────────────────┐  ┌─────────────────┐
│  Backend API    │  │  Supabase DB    │
└─────────────────┘  └─────────────────┘
```

## 统一架构方案

### 方案概述

采用 **适配器模式** 统一服务层：

1. **核心接口定义** - `@shared/types/` 中定义统一的 API 接口
2. **抽象服务层** - 定义服务接口和通用逻辑
3. **具体适配器**：
   - `HttpAdapter` - 用于 Web/Electron
   - `SupabaseAdapter` - 用于 Mobile

### 优势

- ✅ 消除代码重复
- ✅ 统一类型定义
- ✅ 更容易维护和测试
- ✅ 可以轻松添加新平台
- ✅ 业务逻辑只写一次

### 实施步骤

1. **Phase 1**: 定义统一接口类型
2. **Phase 2**: 创建抽象服务基类
3. **Phase 3**: 实现 HttpAdapter
4. **Phase 4**: 实现 SupabaseAdapter
5. **Phase 5**: 迁移使用方代码
6. **Phase 6**: 删除旧的重复代码

## 优先级建议

### P0 - 立即开始
- 定义统一接口类型
- 创建核心抽象

### P1 - 短期
- 迁移高使用率的服务（graphs, nodes, auth）
- 编写适配器

### P2 - 中期
- 迁移其余服务
- 完善测试覆盖

## 文件清单

### 需要统一的服务文件

**API 目录** (`src/services/api/`):
- ✅ graphs.ts
- ✅ nodes.ts
- ✅ auth.ts
- ✅ study.ts
- ✅ quiz.ts
- ✅ tasks.ts
- ✅ ai.ts
- ✅ achievements.ts
- ✅ knowledgePoints.ts
- ✅ learningPaths.ts
- ✅ backup.ts
- ✅ search.ts
- ✅ templates.ts
- ✅ 更多...

**Mobile 目录** (`src/services/mobile/`):
- ✅ graphs.ts
- ✅ nodes.ts
- ✅ edges.ts
- ✅ auth.ts
- ✅ study.ts
- ✅ quiz.ts
- ✅ scheduler.ts
- ✅ ai.ts
- ✅ aiService.ts
- ✅ achievements.ts
- ✅ periodicTasks.ts
- ✅ prompt.ts
- ✅ 更多...
