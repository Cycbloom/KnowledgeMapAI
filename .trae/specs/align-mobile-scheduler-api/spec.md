# 对齐 mobileSchedulerApi 方法名与 ISchedulerApi 契约 Spec

## Why

mobile scheduler 模块的函数名和签名与 ISchedulerApi 契约不一致（如 `createTask` vs `create`、`createSubtask(data)` vs `createSubtask(taskId, data)`），当前通过 index.ts 中的适配层和 `as never` 类型转换桥接。这导致：1) 适配层增加了不必要的间接性和 `as never` 类型不安全；2) 模块文件中的函数名违反项目 API 命名规范；3) 新增方法时容易遗漏适配。

## What Changes

- 重命名 `tasks.ts` 中 14 个导出函数以匹配 ISchedulerTasksApi 契约名
- 重命名 `dependencies.ts` 中 3 个导出函数并调整参数签名以匹配 ISchedulerDependenciesApi
- 调整 `subtasks.ts` 中 3 个函数的参数签名以匹配 ISchedulerSubtasksApi
- 调整 `analytics.ts` 中 3 个函数的参数签名以匹配 ISchedulerSchedulesApi 和 ISchedulerSettingsApi
- 简化 `index.ts`：移除适配函数和 `as never` 转换，改为直接引用

## Impact

- Affected specs: fix-scheduler-api-type-safety
- Affected code:
  - `src/services/mobile/scheduler/tasks.ts` — 14 个函数重命名
  - `src/services/mobile/scheduler/dependencies.ts` — 3 个函数重命名 + 签名调整
  - `src/services/mobile/scheduler/subtasks.ts` — 3 个函数签名调整
  - `src/services/mobile/scheduler/analytics.ts` — 3 个函数签名调整
  - `src/services/mobile/scheduler/index.ts` — 简化为直接引用，移除适配层

## ADDED Requirements

### Requirement: mobile tasks 模块函数名对齐 ISchedulerTasksApi

mobile scheduler tasks 模块 SHALL 使用与 ISchedulerTasksApi 一致的方法名。

#### Scenario: 函数名匹配契约
- **WHEN** 查看 `tasks.ts` 导出的函数名
- **THEN** 函数名 SHALL 为 `create`, `list`, `get`, `getDetail`, `update`, `delete`, `start`, `pause`, `complete`, `demote`, `move`, `reorder`, `generateDetails`, `checkDependencies`（而非 `createTask`, `getTasks` 等）

### Requirement: mobile dependencies 模块函数名和签名对齐 ISchedulerDependenciesApi

mobile scheduler dependencies 模块 SHALL 使用与 ISchedulerDependenciesApi 一致的函数名和参数签名。

#### Scenario: addTaskDependency 签名匹配
- **WHEN** 调用 `addTaskDependency(taskId, data)`
- **THEN** 函数 SHALL 接受 `(taskId: string, data: { depends_on_task_id: string; dependency_type?: "strict" | "soft" })` 参数

#### Scenario: removeTaskDependency 签名匹配
- **WHEN** 调用 `removeTaskDependency(taskId, dependencyId)`
- **THEN** 函数 SHALL 接受 `(taskId: string, dependencyId: string)` 参数

### Requirement: mobile subtasks 模块函数签名对齐 ISchedulerSubtasksApi

mobile scheduler subtasks 模块 SHALL 使用与 ISchedulerSubtasksApi 一致的参数签名。

#### Scenario: createSubtask 签名匹配
- **WHEN** 调用 `createSubtask(taskId, data)`
- **THEN** 函数 SHALL 接受 `(taskId: string, data: CreateSubtaskData)` 参数（而非单个合并对象）

#### Scenario: updateSubtask/deleteSubtask 签名匹配
- **WHEN** 调用 `updateSubtask(taskId, subtaskId, data)` 或 `deleteSubtask(taskId, subtaskId)`
- **THEN** 函数 SHALL 接受 taskId 作为第一个参数

### Requirement: index.ts 无适配层和类型转换

mobile scheduler index.ts SHALL 直接引用模块函数，不使用适配函数或 `as never` 类型转换。

#### Scenario: 无 as never
- **WHEN** 查看 `index.ts` 源码
- **THEN** 不存在 `as never` 或 `as unknown as` 类型转换

## MODIFIED Requirements

### Requirement: mobileSchedulerApi 组装方式

`mobileSchedulerApi` SHALL 通过直接引用各模块的契约命名导出组装，而非通过适配函数映射。

## REMOVED Requirements

### Requirement: index.ts 中的适配函数
**Reason**: 函数名和签名已在模块文件中直接对齐，适配层不再需要
**Migration**: 移除所有适配函数（如 `(taskId, data) => dependencies.createDependency({ task_id: taskId, ...data })`），改为直接引用
