# 代码组织架构分析 Spec

## Why

当前项目代码组织架构存在以下问题，影响代码的可维护性、可扩展性和团队协作效率：

- 类型定义重复，前后端各自定义相同类型，导致维护困难
- 路由文件过于庞大（如 scheduler.ts 超过 3900 行），违反单一职责原则
- 组件目录结构扁平，缺乏按功能域的清晰划分
- Hooks 分散在多个文件中，存在重复逻辑
- 服务层职责不清晰，部分服务文件过于庞大
- 缺乏统一的错误处理和响应格式

## What Changes

- **BREAKING**: 重构类型定义，统一到共享模块
- **BREAKING**: 拆分超大路由文件为多个子路由
- **BREAKING**: 重组组件目录结构，按功能域划分
- **BREAKING**: 合并重复的 Hooks 逻辑
- **BREAKING**: 拆分超大服务文件
- 统一错误处理和 API 响应格式

## Impact

- Affected specs: 所有依赖类型定义的模块
- Affected code:
  - `src/types/index.ts`
  - `api/routes/scheduler.ts`
  - `src/services/api/scheduler.ts`
  - `api/services/schedulerService.ts`
  - `src/hooks/useQueries.ts`
  - `src/hooks/useScheduler.ts`

## ADDED Requirements

### Requirement: 共享类型定义

系统 SHALL 提供统一的类型定义模块。

#### Scenario: 类型定义共享

- **WHEN** 开发者需要使用类型定义时
- **THEN** 应从 `shared/types` 目录导入，而非在多处重复定义

#### Scenario: 类型定义结构

- **WHEN** 查看类型定义目录时
- **THEN** 应包含以下结构：
  ```
  shared/
    types/
      index.ts         # 统一导出
      scheduler.ts     # 调度器相关类型
      graph.ts         # 图谱相关类型
      user.ts           # 用户相关类型
      common.ts         # 通用类型
  ```

### Requirement: 路由层拆分

系统 SHALL 将超大路由文件拆分为多个职责单一的子路由。

#### Scenario: Scheduler 路由拆分

- **WHEN** 查看 scheduler 路由时
- **THEN** 应拆分为以下结构：
  ```
  api/routes/scheduler/
    index.ts           # 路由入口
    tasks.ts           # 任务 CRUD
    executions.ts      # 执行记录
    focus.ts           # 专注会话
    achievements.ts    # 成就系统
    templates.ts       # 任务模板
    schedules.ts       # 周期调度
    timeSlots.ts       # 时间段设置
    analytics.ts       # 统计分析
  ```

#### Scenario: 路由文件大小限制

- **WHEN** 创建新路由文件时
- **THEN** 单个路由文件不应超过 500 行

### Requirement: 组件目录重组

系统 SHALL 按功能域重组组件目录结构。

#### Scenario: 组件目录结构

- **WHEN** 查看组件目录时
- **THEN** 应包含以下结构：
  ```
  src/components/
    common/           # 通用组件
      Button/
      Modal/
      Form/
      Loading/
      Error/
    features/        # 功能组件（按业务域分组）
      Scheduler/
        TaskCard/
        QueueView/
        FocusMode/
        Statistics/
      GraphEditor/
        Canvas/
        Sidebar/
        Toolbar/
        NodeEditor/
      Study/
        Card/
        Quiz/
        Progress/
    layout/          # 布局组件
      Header/
      Sidebar/
      Footer/
      Layout/
  ```

### Requirement: Hooks 优化

系统 SHALL 合并重复的 Hooks 并建立清晰的层次结构。

#### Scenario: Hooks 目录结构

- **WHEN** 查看 hooks 目录时
- **THEN** 应包含以下结构：
  ```
  src/hooks/
    index.ts              # 统一导出
    queries/              # 数据查询 Hooks
      useGraphQueries.ts
      useSchedulerQueries.ts
      useStudyQueries.ts
    mutations/            # 数据变更 Hooks
      useGraphMutations.ts
      useSchedulerMutations.ts
    state/                # 状态管理 Hooks
      useAuth.ts
      useTheme.ts
    utils/                # 工具 Hooks
      useDebounce.ts
      useThrottle.ts
      useLocalStorage.ts
  ```

#### Scenario: 重复 Hooks 合并

- **WHEN** 发现重复的 Hooks 逻辑时
- **THEN** 应合并到共享模块，避免代码重复

### Requirement: 服务层优化

系统 SHALL 优化服务层结构，拆分超大服务文件。

#### Scenario: 服务层目录结构

- **WHEN** 查看服务层目录时
- **THEN** 应包含以下结构：
  ```
  api/services/
    index.ts              # 统一导出
    scheduler/             # 调度器服务
      index.ts
      taskService.ts
      executionService.ts
      focusService.ts
      achievementService.ts
      templateService.ts
      analyticsService.ts
    graph/                # 图谱服务
      index.ts
      graphService.ts
      nodeService.ts
      edgeService.ts
    ai/                  # AI 服务
      index.ts
      providers/
      config.ts
    auth/                # 认证服务
      index.ts
      authService.ts
  ```

#### Scenario: 服务文件大小限制

- **WHEN** 创建新服务文件时
- **THEN** 单个服务文件不应超过 500 行

### Requirement: API 客户端优化

系统 SHALL 优化前端 API 客户端结构。

#### Scenario: API 客户端结构

- **WHEN** 查看前端 API 服务时
- **THEN** 应包含以下结构：
  ```
  src/services/api/
    index.ts              # 统一导出
    client.ts             # HTTP 客户端配置
    types.ts              # API 相关类型
    modules/              # 按功能域分组的 API 模块
      auth.ts
      graphs.ts
      nodes.ts
      scheduler/
        index.ts
        tasks.ts
        focus.ts
        achievements.ts
      study.ts
      ai.ts
  ```

### Requirement: 错误处理统一

系统 SHALL 提供统一的错误处理机制。

#### Scenario: 错误处理中间件

- **WHEN** 发生 API 错误时
- **THEN** 应统一返回标准格式：
  ```json
  {
    "success": false,
    "error": {
      "code": "ERROR_CODE",
      "message": "错误描述",
      "details": {}
    }
  }
  ```

#### Scenario: 前端错误处理

- **WHEN** 前端调用 API 失败时
- **THEN** 应统一处理错误，显示用户友好的错误信息

## MODIFIED Requirements

### Requirement: 命名规范统一

系统 SHALL 统一命名规范。

#### Scenario: 文件命名

- **WHEN** 创建新文件时
- **THEN** 应遵循以下规范：
  - React 组件：PascalCase（如 `TaskCard.tsx`）
  - 工具函数：camelCase（如 `dateUtils.ts`）
  - 类型文件：camelCase（如 `scheduler.ts`）
  - 常量文件：camelCase（如 `errorCodes.ts`）

#### Scenario: 导出规范

- **WHEN** 导出模块时
- **THEN** 应遵循以下规范：
  - React 组件：使用命名导出 `export function ComponentName() {}`
  - 工具函数：使用命名导出 `export function utilName() {}`
  - 类型：使用命名导出 `export interface TypeName {}`
  - 常量：使用命名导出 `export const CONSTANT_NAME = ''`

### Requirement: 目录结构优化

系统 SHALL 优化目录结构。

#### Scenario: 前端目录结构

- **WHEN** 重构完成后
- **THEN** 前端目录应遵循：
  ```
  src/
    components/        # UI 组件
      common/          # 通用组件
      features/        # 功能组件（按功能域分组）
      layout/          # 布局组件
    hooks/             # 自定义 Hooks
      queries/         # 数据查询
      mutations/       # 数据变更
      state/           # 状态管理
      utils/           # 工具 Hooks
    pages/             # 页面组件
    services/          # API 服务层
      api/
    store/             # 状态管理
    types/             # 类型定义
    utils/             # 工具函数
    config/            # 配置文件
    constants/         # 常量定义
  ```

#### Scenario: 后端目录结构

- **WHEN** 重构完成后
- **THEN** 后端目录应遵循：
  ```
  api/
    routes/            # 路由层（按功能域拆分）
    services/          # 业务逻辑层
    middleware/        # 中间件
    utils/             # 工具函数
    types/             # 类型定义
    constants/         # 常量定义
    schemas/           # 验证模式
  ```

## REMOVED Requirements

### Requirement: 重复类型定义

**Reason**: 类型定义应在前后端共享，**Migration**: 将重复的类型定义迁移到 `shared/types` 目录

### Requirement: 超大文件

**Reason**: 单一文件职责过多，难以维护
**Migration**: 拆分为多个职责单一的文件

### Requirement: 重复 Hooks

**Reason**: 相同逻辑的 Hooks 应合并
**Migration**: 合并到共享模块

### Requirement: 扁平组件结构

**Reason**: 组件应按功能域分组，便于查找和维护
**Migration**: 重组组件目录结构
