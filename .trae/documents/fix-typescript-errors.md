# TypeScript 错误修复计划

## 概述
项目中共有 41 个 TypeScript 错误，分布在 18 个文件中。主要错误类型包括：
1. 未使用的变量/导入 (TS6133)
2. 隐式 any 类型 (TS7006)
3. 类型不匹配 (TS2322, TS2345, TS2724)
4. 类型不存在 (TS2339)
5. 未使用的接口 (TS6196)

## 错误分类与修复方案

### 1. 未使用的变量/导入 (TS6133) - 共 20 个

| 文件 | 行号 | 变量/导入 | 修复方案 |
|------|------|-----------|----------|
| `src/components/Scheduler/DependencyGraph.tsx` | 29 | `selectedTask` | 删除未使用的状态 |
| `src/components/Scheduler/DependencyGraph.tsx` | 222 | `task` | 删除未使用的参数 |
| `src/components/Scheduler/PomodoroSettings.tsx` | 20 | `settings` | 删除未使用的状态 |
| `src/components/Scheduler/TemplateForm.tsx` | 45 | `setDescription` | 删除未使用的 setter |
| `src/components/Scheduler/WeeklyReflection.tsx` | 4 | `TrendingUp`, `Award`, `Clock`, `CheckCircle` | 删除未使用的导入 |
| `src/components/Scheduler/WeeklyReflection.tsx` | 37 | `weekTasks` | 删除未使用的状态 |
| `src/hooks/useGlobalShortcuts.tsx` | 70 | `getShortcut` | 删除未使用的解构 |
| `src/hooks/useGraphHistoryHandlers.ts` | 50 | `_handleBatchHistory` | 删除未使用的函数 |
| `src/hooks/useQueries.ts` | 552 | `err` | 使用 `_err` 或删除 |
| `src/hooks/useQueries.ts` | 557 | `data`, `error` | 使用下划线前缀 |
| `src/hooks/useQueries.ts` | 639 | `data` | 使用下划线前缀 |
| `src/hooks/useQueries.ts` | 772 | `data` | 使用下划线前缀 |
| `src/hooks/useTextToSpeech.ts` | 168 | `_utteranceRef` | 删除未使用的 ref |
| `src/hooks/useTutorOperations.ts` | 45 | `_existingNodes` | 删除未使用的变量 |
| `src/hooks/useTutorOperations.ts` | 272 | `_newMode` | 删除未使用的变量 |
| `src/pages/GraphMap.tsx` | 85 | `_handleGraphDoubleClick` | 删除未使用的函数 |
| `src/pages/Tasks.tsx` | 8 | `Task` | 删除未使用的导入 |
| `src/three/layout/forceLayout3D.ts` | 40 | `nodes` | 使用下划线前缀 |
| `src/utils/queryOptimizer.ts` | 10 | `_BatchQueryOptions` | 删除未使用的接口 |

### 2. 隐式 any 类型 (TS7006) - 共 9 个

| 文件 | 行号 | 参数 | 修复方案 |
|------|------|------|----------|
| `src/components/Scheduler/WeeklyReflection.tsx` | 81 | `t` | 添加类型注解 |
| `src/components/Scheduler/WeeklyReflection.tsx` | 249 | `day`, `i` | 添加类型注解 |
| `src/components/Scheduler/WeeklyReflection.tsx` | 250 | `d` | 添加类型注解 |
| `src/hooks/useGraphNodeOperations.ts` | 210 | `data` | 添加类型注解 |
| `src/pages/GraphMap.tsx` | 607, 633, 634, 641 | `g` | 添加类型注解 |
| `src/pages/SchedulerStats.tsx` | 475 | `execution` | 添加类型注解 |

### 3. 类型不匹配/不存在 (TS2322, TS2345, TS2724, TS2339) - 共 8 个

| 文件 | 行号 | 问题 | 修复方案 |
|------|------|------|----------|
| `src/components/GlobalErrorBoundary.tsx` | 234 | `err.message` 不存在于 `never` | 修改类型守卫逻辑 |
| `src/components/Scheduler/WeeklyReflection.tsx` | 9 | `SchedulerStats` 不存在 | 检查并修复导入 |
| `src/hooks/useCombinedGraphAIOperations.ts` | 196 | `node_content` 类型不匹配 | 添加空值处理 |
| `src/hooks/useQueries.ts` | 407 | `unknown` 类型参数 | 添加正确的类型定义 |
| `src/pages/SchedulerStats.tsx` | 221, 544 | `formatter` 类型不兼容 | 修复参数类型 |
| `src/pages/Tasks.tsx` | 413 | `unknown` 不能赋值给 `ReactNode` | 添加类型断言或条件渲染 |
| `src/utils/graphMapAdapter.ts` | 22 | `updated_at` 类型不匹配 | 添加空值处理 |

## 执行步骤

### 第一步：修复未使用的导入和变量 (低风险)
- 删除所有未使用的导入
- 删除或重命名（加下划线前缀）未使用的变量

### 第二步：修复隐式 any 类型 (中等风险)
- 为所有隐式 any 参数添加正确的类型注解

### 第三步：修复类型不匹配问题 (需要仔细分析)
- 分析每个类型错误的具体原因
- 添加适当的类型守卫或类型断言

## 预期结果
修复完成后，运行 `npx tsc --noEmit` 应该不再有任何错误输出。
