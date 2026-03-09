# 代码组织架构分析 Spec

## Why
项目经过长期迭代开发，代码组织架构存在多处可优化点，包括类型定义重复、服务层架构不清晰、组件组织缺乏统一规范等问题。通过全面的架构分析，识别当前存在的问题和可优化点，为后续重构提供指导。

## What Changes
- 识别类型定义重复和不一致问题
- 分析服务层架构存在的问题
- 评估组件组织结构的合理性
- 检查路由组织方式的可优化点
- 分析状态管理策略的一致性
- 评估测试覆盖和测试组织
- 检查配置管理方式
- 识别代码重复问题
- 分析依赖管理问题
- 评估架构层次清晰度

## Impact
- Affected specs: 整体代码架构
- Affected code: 全项目范围

---

## 分析结果摘要

### 1. 类型定义问题 (严重程度: 高)

| 问题 | 位置 | 影响 |
|------|------|------|
| AppError 重复定义 | `src/utils/errors.ts` vs `api/middleware/errorHandler.ts` vs `src/services/errorService.ts` | 类型不一致，错误处理混乱 |
| 错误码定义不一致 | 前端 `ErrorCode` (联合类型) vs 后端 `ErrorCodes` (对象常量) | 两端错误码不匹配 |
| 类型分散 | `src/services/api/scheduler.ts` 内联定义 53 个类型 | 未利用 shared/types 目录 |
| 前后端类型不同步 | 多处 | API 契约风险 |

**详细发现**：
- 存在 3 个不同的 AppError 定义（2 个 class，1 个 interface）
- Achievement 类型在 `shared/types/user.ts` 和 `src/services/api/scheduler.ts` 中定义不同
- `shared/types/scheduler.ts` 缺少 12+ 个类型定义

### 2. 服务层架构问题 (严重程度: 高)

| 问题 | 位置 | 影响 |
|------|------|------|
| API 服务重复 | `src/services/api/scheduler.ts` (794行) vs `modules/scheduler/` (12文件) | 维护成本高 |
| 服务命名冲突 | `api/services/taskService.ts` vs `api/services/scheduler/taskService.ts` | 可读性差 |
| 服务职责过重 | `graphService.ts` (762行), `ai/index.ts` (1200+行) | 难以维护和测试 |
| 服务导出不一致 | `api/services/index.ts` | 导入路径混乱 |

**详细发现**：
- `scheduler.ts` 单体文件定义所有类型和 API，而 `modules/scheduler/` 已模块化
- 两个 TaskService 功能完全不同（异步任务 vs 日程任务）
- AI 服务包含 13+ 个独立功能

### 3. 架构层次问题 (严重程度: 高)

| 问题 | 位置 | 影响 |
|------|------|------|
| 缺乏独立的数据访问层 | 服务直接使用 Supabase 客户端 | 难以测试和维护 |
| 路由层包含业务逻辑 | `api/routes/scheduler/tasks.ts` | 代码组织混乱 |
| 缺乏领域模型 | 只有接口定义 | 业务逻辑分散 |
| 错误处理不一致 | 4 种不同的错误处理方式 | 调试困难 |

**详细发现**：
- SQL 查询逻辑散布在服务中
- 路由层直接包含业务逻辑（如任务启动、完成逻辑）
- 缺乏封装行为的实体类

### 4. 状态管理问题 (严重程度: 中)

| 问题 | 位置 | 影响 |
|------|------|------|
| 用户状态双重存储 | Zustand 和 React Query 同时存储 | 状态同步复杂 |
| 状态同步问题 | 12 处直接调用 `setUser` | 数据一致性风险 |
| 配置文件重复 | `config.ts` vs `queryConfig.ts` | 维护困难 |
| Store 命名不清晰 | `useStore.ts` 仅管理认证状态 | 开发者困惑 |

**详细发现**：
- 登录时需要同时更新 Zustand 和 React Query
- Token 刷新逻辑未同步 React Query 缓存
- 退出登录流程分散在多处

### 5. 组件组织问题 (严重程度: 中)

| 问题 | 位置 | 影响 |
|------|------|------|
| 组件分类不清晰 | `features` 目录仅重新导出 Scheduler | 无实际价值 |
| 导出方式不一致 | 仅 35% 目录有 index.ts | 使用不便 |
| 代码重复 | `formatTime` 在 12 个文件中重复 | 维护成本 |
| 组件粒度不统一 | `GlobalSearch.tsx` (489行), `RAGChat/index.tsx` (685行) | 复用性差 |

**详细发现**：
- 4 个功能重叠的计时器组件
- `common/FocusTimer.tsx` 依赖特定 Store，不够通用
- `common/GlobalSearch.tsx` 包含业务逻辑

### 6. 路由组织问题 (严重程度: 中)

| 问题 | 位置 | 影响 |
|------|------|------|
| 路由文件过多 | 30+ 个路由文件在根目录 | 维护困难 |
| 命名冲突 | `focus.ts`, `templates.ts`, `analytics.ts`, `tasks.ts` 存在于不同层级 | 容易混淆 |
| 重复定义 | `/api/health` 路由被定义两次 | 功能覆盖 |
| 重复挂载 | `knowledgePointRoutes` 挂载到 3 个不同路径 | 文档混乱 |

**详细发现**：
- `scheduler/` 子目录组织良好，可作为参考
- `knowledgePoints.ts` 包含 405 行，混合多套 API

### 7. 测试覆盖问题 (严重程度: 中)

| 问题 | 位置 | 影响 |
|------|------|------|
| 覆盖率极低 | 整体覆盖率 < 5% | 质量风险 |
| E2E 配置缺失 | 多个 playwright.config.*.ts 文件不存在 | 无法运行专项测试 |
| 关键模块无测试 | 认证、路由、中间件、核心组件 | 回归风险 |
| 测试文件分散 | `api/__tests__/` 和 `src/__tests__/` | 管理困难 |

**详细发现**：
- `api/services/` 40+ 服务文件，仅 2 个有测试
- `api/routes/` 50+ 路由文件，无任何测试
- `src/hooks/` 40+ Hook，无任何测试
- `tests/` 目录（POM 模式）不存在

### 8. 代码重复问题 (严重程度: 中)

| 问题 | 位置 | 重复行数 |
|------|------|----------|
| Logger 工具重复 | `api/utils/logger.ts` vs `src/utils/logger.ts` | ~80 行 |
| Markdown 解析器重复 | `api/utils/markdownParser.ts` vs `src/utils/markdownParser.ts` | ~120 行 |
| Level 工具函数重复 | `api/utils/levelUtils.ts` vs `src/lib/graph/levelUtils.ts` | ~30 行 |
| 重试逻辑重复 | `api/utils/retry.ts` vs `src/utils/retryFetch.ts` | ~60 行 |
| 错误处理类重复 | 4 个文件定义不同错误类 | ~100 行 |
| 颜色常量重复 | 4 个文件定义 Level 颜色 | ~40 行 |

**总计**：约 430 行重复代码

### 9. 配置管理问题 (严重程度: 低)

| 问题 | 位置 | 影响 |
|------|------|------|
| 双重环境验证器 | `env.ts` vs `envValidator.ts` | 功能重复 |
| 环境变量命名不一致 | `VITE_` 前缀混乱 | 配置混乱 |
| `.env.example` 缺少必需变量 | 缺少 `DATABASE_URL` 等 | 新开发者配置困难 |
| ESLint 缺少路径解析 | `eslint.config.js` | 开发体验差 |

**详细发现**：
- `envValidator.ts` 提供完整验证但未被使用
- `taskService.ts` 尝试兼容两种命名方式

### 10. 依赖管理问题 (严重程度: 低)

| 问题 | 位置 | 影响 |
|------|------|------|
| 错误分类 | `@playwright/test` 等在 dependencies | 包体积增大 |
| 未使用依赖 | `rate-limit-redis` | 冗余 |
| 重复功能 | `@dnd-kit` 和 `@hello-pangea/dnd` | 包体积增大 |
| 类型版本不匹配 | `@types/three` vs `three` | 类型不兼容 |

**详细发现**：
- 6 个依赖分类错误
- 1 个完全未使用的依赖
- 2 个功能重叠的拖拽库

---

## 优化建议优先级

### P0 - 立即处理

1. **统一 AppError 类型定义**
   - 创建 `shared/utils/errors.ts`
   - 合并前后端错误码到 `shared/constants/errorCodes.ts`
   - 前后端分别导入并实现具体类

2. **合并重复的 API 服务定义**
   - 删除 `src/services/api/scheduler.ts` 单体文件
   - 统一使用 `modules/scheduler/` 模块化结构
   - 类型定义迁移到 `shared/types/scheduler.ts`

3. **明确架构分层**
   - 创建 `api/repositories/` 数据访问层
   - 将路由层业务逻辑移至服务层
   - 重命名冲突的服务文件

### P1 - 短期处理

1. **整理 shared/types 目录**
   - 补全缺失的类型定义（Queue, FocusSession, Achievement 等）
   - 消除重复的类型定义
   - 统一 Achievement 类型定义

2. **统一组件导出方式**
   - 为所有组件目录添加 index.ts
   - 统一导出风格（建议使用命名导出 + .js 后缀）
   - 提取 `formatTime` 为通用工具函数

3. **规范路由组织**
   - 按功能域创建子目录（graph/, analytics/, system/）
   - 删除重复的 `/api/health` 定义
   - 拆分过大的路由文件

4. **修复状态管理问题**
   - 统一用户状态管理策略（建议 Zustand 为主）
   - 合并 `config.ts` 和 `queryConfig.ts`
   - 创建统一的认证状态同步 Hook

### P2 - 中期处理

1. **完善测试覆盖**
   - 创建缺失的 Playwright 配置文件
   - 补充核心服务单元测试（authService, graphService）
   - 实现 Page Object Model

2. **消除代码重复**
   - 创建 `shared/utils/` 共享工具函数
   - 统一颜色常量到 `shared/constants/colors.ts`
   - 使用平台适配器模式处理 Logger

3. **优化依赖管理**
   - 修正依赖分类（移测试依赖到 devDependencies）
   - 移除未使用依赖
   - 统一拖拽库（建议使用 @dnd-kit）

### P3 - 长期优化

1. **完善配置管理**
   - 统一环境变量验证器
   - 更新 `.env.example`
   - 为 ESLint 添加路径解析

2. **建立领域模型**
   - 创建 `api/domain/` 目录
   - 为核心实体创建领域类
   - 封装业务规则和验证逻辑

---

## 分析统计

| 指标 | 数值 |
|------|------|
| 分析文件总数 | 100+ |
| 发现问题总数 | 47 |
| 高严重程度问题 | 12 |
| 中严重程度问题 | 25 |
| 低严重程度问题 | 10 |
| 重复代码行数 | ~430行 |
| 测试覆盖率估算 | <5% |
