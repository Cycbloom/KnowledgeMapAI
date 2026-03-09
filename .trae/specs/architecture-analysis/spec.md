# 代码组织架构分析规格文档

## Why

项目经过多轮迭代开发后，代码组织架构存在以下问题：
1. **模块边界不清晰**：Scheduler、GraphEditor 等大型模块缺乏明确的分层和边界
2. **代码组织不一致**：前端 hooks、API 客户端、后端服务层组织方式不统一
3. **类型定义分散**：`src/types` 和 `shared/types` 两处定义，可能导致类型不一致
4. **文件过大**：部分文件（如 `useQueries.ts`）超过 1000 行，难以维护
5. **测试覆盖不足**：缺乏系统性的测试文件组织

## What Changes

- **前端组件重组**：按功能域和通用性重新组织组件目录结构
- **Hooks 模块化**：将大型 hooks 文件拆分为功能域独立模块
- **API 客户端规范化**：统一 API 客户端组织模式
- **后端服务分层**：明确服务层职责和接口规范
- **类型定义统一**：合并类型定义，消除重复
- **测试目录规范化**：建立测试文件组织标准

## Impact

- Affected specs: 全项目架构
- Affected code:
  - `src/components/` - 组件目录重组
  - `src/hooks/` - Hooks 模块化
  - `src/services/api/` - API 客户端规范化
  - `api/services/` - 后端服务分层
  - `shared/types/` 和 `src/types/` - 类型定义统一
  - `src/tests/` - 测试目录规范化

---

## 架构现状分析

### 1. 项目技术栈

| 层级 | 技术选型 |
|------|----------|
| 前端框架 | React 18 + TypeScript |
| 构建工具 | Vite |
| 后端框架 | Express |
| 数据库 | Supabase (PostgreSQL) |
| 状态管理 | Zustand + React Query |
| UI 框架 | Tailwind CSS |
| 拖拽库 | @dnd-kit + @hello-pangea/dnd (重复) |
| 3D 渲染 | Three.js + React Three Fiber |

### 2. 目录结构现状

```
d:\KnowledgeMap/
├── api/                    # 后端代码
│   ├── routes/            # 路由层 (40+ 路由文件)
│   ├── services/          # 服务层 (30+ 服务文件)
│   ├── middleware/        # 中间件
│   ├── schemas/           # Zod 验证模式
│   └── utils/             # 工具函数
├── src/                   # 前端代码
│   ├── components/        # 组件 (按功能域分目录)
│   ├── hooks/             # 自定义 Hooks
│   ├── pages/             # 页面组件
│   ├── services/api/      # API 客户端
│   ├── store/             # Zustand Store
│   ├── types/             # 类型定义
│   └── utils/             # 工具函数
├── shared/                # 共享代码
│   └── types/             # 共享类型定义
└── supabase/              # 数据库
    └── migrations/        # 迁移文件
```

---

## 问题识别

### 问题 1: 组件目录组织不清晰

**现状**：
- `src/components/` 下混合了功能模块（Scheduler、GraphEditor）和通用组件（common）
- 功能模块规模差异巨大：Scheduler 有 40+ 组件，AutoGraph 只有 1 个组件
- `features/` 目录几乎为空，没有发挥应有作用

**影响**：
- 新开发者难以快速定位组件
- 组件职责边界模糊
- 代码复用困难

### 问题 2: Hooks 文件过大

**现状**：
- `src/hooks/useQueries.ts` 文件 1020 行，包含 70+ 个 hooks
- 所有 React Query 操作集中在单一文件
- 缺乏按功能域的模块化组织

**影响**：
- 代码难以维护和查找
- 增加代码审查难度
- 容易产生合并冲突

### 问题 3: 类型定义分散

**现状**：
- `src/types/index.ts` 仅重新导出 `@shared/types`
- `shared/types/` 下有 5 个类型文件
- 部分类型在 `src/services/api/` 中重复定义

**影响**：
- 类型导入路径不一致
- 可能存在类型不同步
- 增加心智负担

### 问题 4: API 客户端组织不一致

**现状**：
- `src/services/api/modules/scheduler/` 有良好的模块化组织
- 其他 API 模块（如 `ai.ts`、`auth.ts`）是单文件
- `api.ts` 顶层文件只是简单导出聚合

**影响**：
- 代码风格不统一
- 新模块开发缺乏明确规范

### 问题 5: 后端路由分散

**现状**：
- `api/routes/` 下有 30+ 个独立路由文件
- 部分路由有子目录（如 `scheduler/`、`ai/`）
- 缺乏统一的路由注册机制

**影响**：
- 路由管理困难
- 中间件应用不一致

### 问题 6: 状态管理职责不清

**现状**：
- Zustand 管理：用户认证、SSE 状态、快捷键、性能监控
- React Query 管理：服务端状态、缓存
- 两者职责边界不清晰

**影响**：
- 状态来源难以追踪
- 可能存在状态同步问题

### 问题 7: 依赖重复

**现状**：
- 同时安装了 `@dnd-kit` 和 `@hello-pangea/dnd`（react-beautiful-dnd 的 fork）
- 两个库功能重叠

**影响**：
- 打包体积增大
- 维护两套拖拽逻辑

### 问题 8: 测试覆盖不足

**现状**：
- 单元测试：只有 `api/services/cache.test.ts`、`src/hooks/useQueries.test.ts` 等
- E2E 测试：有完整的 Playwright 配置
- 缺乏测试文件组织标准

**影响**：
- 代码质量难以保障
- 重构风险高

---

## 优化建议

### 建议 1: 组件目录重组

**目标结构**：
```
src/components/
├── common/              # 通用组件 (保持)
│   ├── Button/
│   ├── Modal/
│   └── ...
├── layouts/             # 布局组件 (从 Layout/ 重命名)
├── features/            # 功能模块
│   ├── scheduler/       # 任务调度器
│   │   ├── components/  # 子组件
│   │   ├── hooks/       # 模块内 hooks
│   │   ├── types.ts     # 模块类型
│   │   └── index.ts     # 导出
│   ├── graph-editor/    # 图谱编辑器
│   ├── study/           # 学习模块
│   └── ...
└── ui/                  # 基础 UI 组件 (新增)
    ├── primitives/
    └── patterns/
```

**迁移策略**：
1. 创建新的目录结构
2. 逐步迁移功能模块
3. 更新导入路径
4. 删除旧目录

### 建议 2: Hooks 模块化

**目标结构**：
```
src/hooks/
├── queries/             # React Query hooks
│   ├── useGraphQueries.ts
│   ├── useTaskQueries.ts
│   ├── useStudyQueries.ts
│   └── index.ts
├── mutations/           # Mutation hooks
│   ├── useGraphMutations.ts
│   └── index.ts
├── ui/                  # UI 相关 hooks
│   ├── useTheme.ts
│   ├── useIsMobile.ts
│   └── index.ts
├── utils/               # 工具 hooks
│   ├── useNetworkStatus.ts
│   └── index.ts
└── index.ts             # 统一导出
```

### 建议 3: 类型定义统一

**策略**：
1. 将所有类型定义集中在 `shared/types/`
2. 删除 `src/types/` 目录
3. 使用 TypeScript 路径别名 `@shared/types`

**目标结构**：
```
shared/types/
├── index.ts             # 统一导出
├── common.ts            # 通用类型
├── user.ts              # 用户相关
├── graph.ts             # 图谱相关
├── scheduler.ts         # 调度器相关
├── api.ts               # API 响应类型
└── ui.ts                # UI 组件类型
```

### 建议 4: API 客户端规范化

**目标结构**：
```
src/services/api/
├── client.ts            # 基础客户端
├── types.ts             # 公共类型
├── modules/             # 功能模块
│   ├── auth/
│   │   ├── index.ts
│   │   └── types.ts
│   ├── graphs/
│   ├── scheduler/
│   └── ...
└── index.ts             # 统一导出
```

### 建议 5: 后端服务分层

**分层架构**：
```
api/
├── routes/              # 路由层：HTTP 请求处理
│   └── v1/              # API 版本化
├── services/            # 服务层：业务逻辑
├── repositories/        # 数据层：数据库操作 (新增)
├── middleware/          # 中间件
├── schemas/             # 验证模式
└── utils/               # 工具函数
```

### 建议 6: 状态管理职责划分

**Zustand 职责**：
- 用户认证状态
- UI 状态（主题、侧边栏）
- 全局通知状态
- SSE 连接状态

**React Query 职责**：
- 服务端数据缓存
- 数据同步
- 后台更新

### 建议 7: 依赖清理

**操作**：
1. 统一使用 `@hello-pangea/dnd`（更活跃的维护）
2. 移除 `@dnd-kit` 相关依赖
3. 迁移所有拖拽逻辑

### 建议 8: 测试目录规范化

**目标结构**：
```
src/
├── __tests__/           # 单元测试
│   ├── components/
│   ├── hooks/
│   └── utils/
└── ...
e2e/                     # E2E 测试
api/
├── __tests__/           # 后端测试
│   ├── services/
│   └── routes/
└── ...
```

---

## 实施优先级

| 优先级 | 任务 | 复杂度 | 影响范围 |
|--------|------|--------|----------|
| P0 | Hooks 模块化 | 中 | 前端开发效率 |
| P0 | 类型定义统一 | 低 | 全项目 |
| P1 | 组件目录重组 | 高 | 前端架构 |
| P1 | API 客户端规范化 | 中 | 前后端交互 |
| P2 | 后端服务分层 | 高 | 后端架构 |
| P2 | 依赖清理 | 低 | 打包体积 |
| P3 | 状态管理职责划分 | 中 | 状态管理 |
| P3 | 测试目录规范化 | 低 | 代码质量 |

---

## 风险评估

### 高风险
- **组件目录重组**：影响大量导入路径，需要全局搜索替换
- **后端服务分层**：需要重构大量服务代码

### 中风险
- **Hooks 模块化**：需要仔细处理导出和导入
- **API 客户端规范化**：需要保持向后兼容

### 低风险
- **类型定义统一**：主要是文件移动
- **依赖清理**：功能替换，风险可控
- **测试目录规范化**：不影响生产代码

---

## 迁移策略

### 阶段 1: 准备工作
1. 创建新的目录结构
2. 建立迁移脚本
3. 更新 TypeScript 配置

### 阶段 2: 低风险迁移
1. 统一类型定义
2. 规范化测试目录
3. 清理重复依赖

### 阶段 3: 中风险迁移
1. Hooks 模块化拆分
2. API 客户端规范化

### 阶段 4: 高风险迁移
1. 组件目录重组
2. 后端服务分层

### 阶段 5: 验证与清理
1. 运行完整测试套件
2. 删除旧目录和文件
3. 更新文档
