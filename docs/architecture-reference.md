# 架构参考文档

> 本文档记录 KnowledgeMap 项目的架构设计原则和最佳实践参考，供开发人员了解项目组织方式和代码约定。

---

## 1. 目录组织原则

### 1.1 整体模式：Layer-based + Domain 子目录混合

```
src/
├── pages/          # 页面层 — 路由对应的页面组件
├── components/     # 组件层 — 可复用的 UI 组件
├── hooks/          # Hooks 层 — 状态逻辑与副作用
├── services/       # 服务层 — API 调用与业务逻辑封装
├── store/          # 状态层 — 全局状态管理 (Zustand)
├── utils/          # 工具层 — 纯工具函数
└── ...
```

### 1.2 各层职责

| 层级 | 目录 | 职责 | 可引用层 |
|------|------|------|---------|
| 页面层 | `pages/` | 路由入口组件，负责布局编排和数据聚合 | 组件层、Hooks 层、服务层、状态层 |
| 组件层 | `components/` | 可复用 UI 组件，纯展示或带交互逻辑 | Hooks 层、工具层 |
| Hooks 层 | `hooks/` | 状态逻辑复用、副作用管理、API 调用封装 | 服务层、状态层、工具层 |
| 服务层 | `services/` | API 调用封装、业务逻辑编排 | 工具层 |
| 状态层 | `store/` | 全局状态 (Zustand store) | 工具层 |
| 工具层 | `utils/` | 纯函数、无副作用的工具函数 | 无（不引用其他层） |

### 1.3 子目录使用规则

当某个功能域有 **3 个或以上** 相关文件时，应创建子目录归类：

```
# ✅ 正确：3+ 个相关文件 → 使用子目录
components/
├── GraphMap/
│   ├── types.ts
│   └── index.ts
├── Scheduler/
│   ├── index.ts
│   └── ...

# ✅ 正确：功能域下的子目录
hooks/
├── graphEditor/
│   └── index.ts
├── graphAI/
│   └── index.ts
├── scheduler/
│   ├── index.ts
│   └── useScheduler.ts
└── ...

# ❌ 避免：单个文件仍使用子目录
components/GraphMap/    # 如果只有 index.ts → 应放在 components/ 根目录
```

### 1.4 后端目录组织

```
api/
├── routes/          # 路由层 — 按功能域分文件/子目录
├── services/        # 服务层 — 按功能域分子目录
├── middleware/      # 中间件
├── schemas/         # 请求/响应校验
├── utils/           # 工具函数
├── jobs/            # 定时任务
└── config/          # 配置
```

路由和服务层按功能域分子目录（如 `routes/graphs/`、`services/scheduler/`），每个子目录内按模块拆分文件（如 `crud.ts`、`versions.ts`）。

---

## 2. API 版本控制策略

### 2.1 当前版本前缀

- 前端 API 客户端使用 `/api` 前缀
- 路由路径示例：`/api/graphs`、`/api/auth/login`
- 后端路由通过 Kernel 插件系统注册，运行时动态挂载

### 2.2 版本升级策略

| 原则 | 说明 |
|------|------|
| **向后兼容** | 同一大版本内不破坏已有 API 签名和响应格式 |
| **旧路径重定向** | 旧版本路径通过 308 重定向到新版本，确保客户端缓存和书签可用 |
| **版本号更新时机** | 仅当存在破坏性变更（删除/重命名接口、修改响应结构）时升级版本号 |

### 2.3 何时升级版本号

- 删除已有接口
- 修改已有接口的请求/响应结构（非新增字段）
- 修改接口语义（如列表分页方式改变）
- 以下情况**不需要**升级版本号：
  - 新增接口
  - 为已有接口的响应体增加可选字段
  - Bug 修复（不改变语义）
  - 性能优化

---

## 3. 前端架构分层职责

### 3.1 Pages（页面层）

**路径**：`src/pages/`

- 路由对应的页面组件，每个页面通常对应一个路由
- 负责页面级别的布局和组合，将多个组件/区块组合成完整页面
- 通过 Hooks 获取数据，传递给子组件
- 页面组件应保持简洁，不包含复杂的业务逻辑

```
src/pages/
├── GraphEditor.tsx          # 图谱编辑器页面
├── Dashboard.tsx            # 仪表盘页面
├── Scheduler.tsx            # 学习计划页面
├── Notes/
│   ├── NoteEditorPage.tsx   # 笔记编辑页面
│   ├── NotesListPage.tsx    # 笔记列表页面
│   └── TemplatesPage.tsx    # 笔记模板页面
└── ...
```

### 3.2 Components（组件层）

**路径**：`src/components/`

- 可复用的 UI 组件，按功能域分组
- 组件可以是纯展示组件，也可以包含交互逻辑
- 功能域有 3+ 个相关文件时创建子目录

```
src/components/
├── common/            # 通用组件
│   ├── Button.tsx
│   ├── Loading.tsx
│   ├── Skeleton.tsx
│   └── ...
├── GraphMap/          # 功能域子目录
│   └── types.ts
├── Scheduler/         # 功能域子目录
│   └── index.ts
└── ...
```

### 3.3 Hooks（Hooks 层）

**路径**：`src/hooks/`

- 封装组件的状态逻辑和副作用
- 按功能域分组，功能域有 3+ 个相关 Hook 时创建子目录
- 每个 Hook 职责单一，可组合使用

```
src/hooks/
├── common/            # 通用 Hooks
│   ├── useAutoSave.ts
│   ├── useTheme.ts
│   ├── useSearch.ts
│   └── ...
├── graphEditor/       # 功能域子目录
│   └── index.ts
├── scheduler/         # 功能域子目录
│   ├── index.ts
│   └── useScheduler.ts
├── queries/           # 查询 Hooks (React Query)
│   ├── config.ts
│   ├── useNoteQueries.ts
│   ├── useTaskQueries.ts
│   └── ...
└── ...
```

### 3.4 Services（服务层）

**路径**：`src/services/api/`

- API 调用封装，每个资源对应一个模块
- 遵循命名导出对象模式：`export const graphsApi = { list, get, create }`
- 统一通过 `api/index.ts` 的 `api` 对象导出

```typescript
// ✅ 推荐：命名导出对象
export const graphsApi = {
  list: () => request<Graph[]>("/graphs"),
  get: (id: string) => request<Graph>(`/graphs/${id}`),
  create: (data: CreateGraphData) =>
    request<Graph>("/graphs", { method: "POST", body: JSON.stringify(data) }),
};
```

**contracts 目录**：定义 API 接口契约（TypeScript interface），便于类型检查和 Mock。

### 3.5 Store（状态层）

**路径**：`src/store/`

- 使用 Zustand 管理全局状态
- 按功能域拆分 Store，每个 Store 独立文件
- 命名格式：`use{Name}Store.ts`

```
src/store/
├── useStore.ts              # 认证状态（用户、Token）
├── useThemeStore.ts         # 主题状态
├── useConsoleStore.ts       # 控制台状态
├── useNotificationsStore.ts # 通知状态
├── usePreferencesStore.ts   # 用户偏好
└── ...
```

### 3.6 Utils（工具层）

**路径**：`src/utils/`

- 纯工具函数，无副作用
- 不引用其他层（Page、Component、Hook、Service、Store）
- 命名格式：`camelCase.ts`

---

## 4. 参考项目

| 项目 | 架构特点 | 可借鉴之处 |
|------|---------|-----------|
| **VS Code** | 大型 Electron 应用，分层+功能域混合架构；核心进程 + 插件进程分离 | 插件化架构设计、功能域子目录组织、事件总线通信模式 |
| **Obsidian** | 插件化架构，核心功能 + 社区插件生态；插件通过 API 扩展核心能力 | 插件注册机制、核心与扩展的清晰边界 |
| **Joplin** | 开源笔记应用，Electron + React 技术栈；数据层与 UI 层分离 | 离线优先的数据同步策略、跨平台目录组织 |

---

## 5. 命名规范

### 5.1 文件命名

| 文件类型 | 格式 | 示例 |
|---------|------|------|
| 组件文件 | `PascalCase.tsx` | `Button.tsx`、`GraphEditor.tsx` |
| Hook 文件 | `useXxx.ts` | `useTheme.ts`、`useAutoSave.ts` |
| API 模块 | `xxxApi` 对象 | `graphsApi`、`nodesApi` |
| Store 文件 | `useXxxStore.ts` | `useThemeStore.ts`、`useConsoleStore.ts` |
| 工具文件 | `camelCase.ts` | `formatters.ts`、`clipboard.ts` |
| 类型定义 | `camelCase.ts` | `graph-core.ts`、`scheduler-task.ts` |
| 配置文件 | `camelCase.ts` | `authConfig.ts`、`graphConfig.ts` |
| 测试文件 | `{name}.test.ts` | `studyService.test.ts` |
| E2E 测试 | `{name}.spec.ts` | `console.spec.ts` |

### 5.2 API 命名

| 层级 | 格式 | 示例 |
|------|------|------|
| API 模块变量 | `{资源名}Api` | `graphsApi`、`nodesApi` |
| 方法命名 | 见下方 | `list`、`get`、`create`、`update`、`delete` |

方法命名规则：

| 操作 | 方法名 | 示例 |
|------|--------|------|
| 获取列表 | `list` | `graphsApi.list()` |
| 获取单个 | `get` | `graphsApi.get(id)` |
| 创建 | `create` | `graphsApi.create(data)` |
| 更新 | `update` | `graphsApi.update(id, data)` |
| 删除 | `delete` | `graphsApi.delete(id)` |
| 批量操作 | `batch{Action}` | `graphsApi.batchDelete(ids)` |
| 特定操作 | `get{RelatedResource}` / `toggle{Property}` | `graphsApi.getTags()`、`graphsApi.toggleFavorite(id, val)` |

### 5.3 路由文件命名

**前端**：`src/pages/` 下的页面文件使用 `PascalCase.tsx`。

**后端**：`api/routes/` 下的路由文件使用 `camelCase.ts`，按功能域组织：

- 单一功能：`{domain}.ts`（如 `auth.ts`、`search.ts`）
- 复杂功能域：`{domain}/` 子目录，内含 `index.ts` + 模块文件（如 `crud.ts`、`versions.ts`）

---

## 6. 数据流

```
用户操作 → Page 组件
            ↓
       Hook (useXxx)  ←→ Store (Zustand)
            ↓
       Service (api.xxx) 
            ↓
       HTTP Request → 后端 API → Supabase DB
            ↓
       响应 → Service → Hook → 组件更新
```

- **单向数据流**：数据从 Service 流向 Hook，再流向组件
- **全局状态**：通过 Zustand Store 管理跨组件共享的状态（用户认证、主题等）
- **服务端状态**：通过 React Query（`hooks/queries/`）管理缓存和同步
---

## 7. 开发者体验改进建议

以下优化建议供后续参考，不纳入当前实施范围：

### 7.1 死代码检测

- **`ts-prune` 集成**：接入 `ts-prune` 作为 CI 步骤，自动检测未导出类型和函数，防止死代码回归
- **`depcheck` 定期审计**：每季度运行 `npx depcheck` 审计依赖健康状况

### 7.2 代码复用

- **移动端 API 层共享**：`src/services/mobile/` 和 `src/services/api/modules/scheduler/` 存在大量重复的模式代码，未来可考虑提取共享基类

### 7.3 根目录卫生

- 保持根目录文件数 < 20，避免配置文件和临时产物堆积
- 定期检查 `npm ls --extraneous` 清理残留依赖

---

## 8. Docker 开发架构

### 8.1 架构总览

```
┌─────────────────────────────────────────────────────────────────┐
│ Docker 容器                                                     │
│  ┌─────────────────────┐    ┌───────────────────────────────┐  │
│  │  frontend (Vite)    │    │  backend (Express + nodemon)  │  │
│  │  :5173              │◄──►│  :3001                        │  │
│  │  HMR 热重载          │    │  API 服务 + 热重载             │  │
│  └─────────────────────┘    └──────────┬────────────────────┘  │
│                                        │ host.docker.internal  │
└────────────────────────────────────────┼────────────────────────┘
                                         │ :54321
                              ┌──────────▼───────────────────────┐
                              │ 宿主机: supabase start            │
                              │  - PostgreSQL + Kong API Gateway │
                              │  - GoTrue Auth + Studio UI       │
                              │  http://localhost:54321          │
                              └──────────────────────────────────┘
```

### 8.2 关键设计决策

| 决策 | 方案 | 理由 |
|------|------|------|
| 后端连接方式 | 通过 `@supabase/supabase-js` 连接 Supabase REST API | 后端不直连 PostgreSQL，统一通过 Supabase 客户端访问，与前端保持一致 |
| 数据库位置 | 宿主机 `supabase start` 管理 | 宿主机 Supabase CLI 提供完整的服务栈（PostgreSQL + Kong + GoTrue + Studio），无需在 Docker 中重复部署 |
| 容器间通信 | `host.docker.internal` 访问宿主机 | 通过 `extra_hosts: host.docker.internal:host-gateway` 配置，后端容器内可访问宿主机端口 |
| 热重载方案 | 前端 Vite HMR + 后端 nodemon | 源码目录通过 volume 挂载到容器内，文件变更实时生效 |
| 依赖管理 | 命名 volume 持久化 node_modules | 避免每次重启容器重新安装依赖，使用国内镜像源加速首次构建 |

### 8.3 两种开发模式对比

| 维度 | 本地开发（方式一） | Docker 开发（方式二） |
|------|-------------------|---------------------|
| 依赖安装 | 本地 `npm install` | 容器内自动安装 |
| 数据库 | 宿主机 `supabase start` | 宿主机 `supabase start`（相同） |
| Node.js 版本 | 本地安装（`.nvmrc` 指定） | 容器内固定（Node 22 Alpine） |
| 启动命令 | `npm run dev` | `docker-compose up -d` |
| 热重载 | Vite HMR + nodemon | Vite HMR + nodemon（相同） |
| 环境隔离 | 依赖本地环境 | 容器隔离，减少环境差异 |
| 适用场景 | Electron 桌面应用开发 | Web 模式快速开发 / 新开发者上手 |
| 调试方式 | VSCode 调试配置 | 同上，但容器内需额外配置 |
| 构建产物 | 本地输出 | 容器内构建（需额外配置） |

### 8.4 Docker Compose 配置参考

Docker Compose 配置位于项目根目录 `docker-compose.yml`，定义了两个服务：

- **backend**：基于 `docker/dev/backend.Dockerfile`，使用 Node 22 Alpine 镜像，通过 nodemon 实现热重载
- **frontend**：基于 `docker/dev/frontend.Dockerfile`，使用 Node 22 Alpine 镜像，通过 Vite HMR 实现热重载

关键配置项：

- `extra_hosts`：`host.docker.internal:host-gateway`（容器访问宿主机）
- `env_file`：从 `.env` 加载环境变量
- `volumes`：源码目录挂载实现热重载，node_modules 使用命名卷持久化
- `networks`：`km-dev-network` 桥接网络，服务间通过 service name 通信