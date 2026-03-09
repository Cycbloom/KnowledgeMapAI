# 代码组织架构分析 Spec

## Why
项目经过长期迭代，代码组织架构存在一些问题，包括类型定义分散、服务层职责不清晰、组件分类混乱等。通过全面分析识别问题点，为后续重构提供依据。

## What Changes
- 识别并记录当前架构中存在的问题
- 提出优化建议和改进方向
- 不涉及代码修改，仅做分析和记录

## Impact
- Affected specs: 整体项目架构
- Affected code: 全部代码目录

## 发现的问题

### 1. 类型定义分散问题

**问题描述**：
- `shared/types/` 定义了共享类型（graph.ts, scheduler.ts, user.ts, common.ts, styles.ts）
- `src/types/index.ts` 也有类型定义
- 类型导入路径不一致，部分从 `@shared/*` 导入，部分从本地导入

**影响**：
- 类型维护困难，容易出现不同步
- 新开发者难以确定类型定义位置
- 可能存在重复定义

**优化建议**：
- 统一类型定义位置
- 明确 shared 类型与本地类型的边界
- 建立类型导入规范

### 2. 服务层架构问题

**问题描述**：
后端 `api/services/` 目录下存在约 40 个服务文件，组织方式：
- 根目录：约 30 个服务文件
- `ai/` 子目录：AI 相关服务
- `scheduler/` 子目录：调度相关服务
- `taskProcessors/` 子目录：任务处理器

**问题点**：
- 根目录服务文件过多，缺乏分类
- 服务命名不一致（如 `graphService.ts` vs `focusService.ts`）
- 部分服务职责重叠（如 `focusService.ts` 在根目录和 `scheduler/` 都有）

**优化建议**：
- 按业务领域划分子目录
- 统一服务命名规范
- 合并职责重叠的服务

### 3. 前端 API 层组织问题

**问题描述**：
`src/services/api/` 目录结构：
- 根目录有多个 API 模块文件
- `modules/scheduler/` 子目录有调度相关 API
- 文件命名不一致（`graphs.ts` vs `auth.ts` vs `ai.ts`）

**问题点**：
- API 模块组织方式与后端路由不完全对应
- `api.ts` 和 `index.ts` 职责重叠
- 类型定义 `types.ts` 与 `shared/types` 可能重复

**优化建议**：
- 统一 API 模块命名规范
- 与后端路由结构对齐
- 类型定义统一使用 shared 类型

### 4. 组件组织问题

**问题描述**：
`src/components/` 目录下有约 20 个组件目录：
- 按功能域划分（GraphEditor, Scheduler, Study 等）
- `common/` 存放通用组件
- `features/` 目录几乎为空（只导出 Scheduler）

**问题点**：
- `features/` 目录定位不清晰
- 部分组件目录过大（GraphEditor 有 40+ 文件）
- 组件层级过深，查找困难

**优化建议**：
- 明确 `features/` 目录用途或移除
- 对大组件目录进行拆分
- 考虑按功能域进一步细分

### 5. 状态管理问题

**问题描述**：
当前使用 Zustand 进行状态管理：
- `src/store/useStore.ts` - 主要认证状态
- `src/store/useFocusStore.ts` - 专注模式状态
- `src/store/useMessageStore.ts` - 消息状态
- `src/store/usePerformanceStore.ts` - 性能状态
- `src/store/useShortcutStore.ts` - 快捷键状态

**问题点**：
- Store 划分不够系统化
- 部分状态分散在组件 hooks 中
- 缺乏统一的状态管理规范

**优化建议**：
- 建立状态管理规范文档
- 按业务域划分 Store
- 考虑将分散状态统一管理

### 6. Repository 模式不完整

**问题描述**：
`api/repositories/` 目录：
- `baseRepository.ts` - 基础 Repository 类
- `index.ts` - 仅导出 BaseRepository

**问题点**：
- 定义了 Repository 模式但未实际使用
- 服务层直接使用 Supabase client
- 数据访问逻辑分散在服务中

**优化建议**：
- 完善 Repository 层实现
- 或移除未使用的 Repository 代码
- 统一数据访问方式

### 7. Hooks 组织问题

**问题描述**：
`src/hooks/` 目录结构：
- 根目录约 35 个 hook 文件
- `queries/` - React Query 查询 hooks
- `mutations/` - React Query 变更 hooks
- `graphAI/` - 图谱 AI 相关 hooks
- `graphEditor/` - 图谱编辑器状态 hooks
- `utils/` - 工具类 hooks

**问题点**：
- 根目录 hooks 过多，缺乏分类
- 部分 hooks 职责不清晰
- 命名不够一致

**优化建议**：
- 按业务域划分子目录
- 统一 hook 命名规范
- 考虑合并相关 hooks

### 8. 路由定义问题

**问题描述**：
后端 `api/routes/` 目录：
- 根目录约 30 个路由文件
- `ai/` 子目录 - AI 相关路由
- `scheduler/` 子目录 - 调度相关路由

**问题点**：
- 根目录路由文件过多
- 与服务层组织不完全对应
- 部分路由文件职责重叠

**优化建议**：
- 按业务域划分子目录
- 与服务层结构对齐
- 统一路由命名规范

### 9. 配置文件分散问题

**问题描述**：
配置文件位置：
- `src/config/` - 前端配置
- `api/constants/` - 后端常量
- `api/docs/` - API 文档配置
- 根目录各种配置文件

**问题点**：
- 配置文件分散
- 缺乏统一的配置管理
- 环境变量管理不够集中

**优化建议**：
- 集中管理配置文件
- 建立配置管理规范
- 统一环境变量命名

### 10. 测试组织问题

**问题描述**：
测试文件位置：
- `api/__tests__/` - 后端单元测试
- `src/__tests__/` - 前端单元测试
- `e2e/` - 端到端测试

**问题点**：
- 测试文件与源文件分离
- 测试覆盖不完整
- 缺乏统一的测试规范

**优化建议**：
- 考虑测试文件与源文件同目录
- 补充测试覆盖
- 建立测试规范文档

## 架构优化建议总结

### 短期优化（低风险）
1. 统一命名规范
2. 整理配置文件
3. 补充文档说明

### 中期优化（中等风险）
1. 重组服务层目录结构
2. 完善 Repository 模式或移除
3. 统一类型定义位置

### 长期优化（高风险）
1. 重构组件组织结构
2. 统一状态管理方案
3. 完善测试覆盖

## 当前架构优点

1. **前后端分离清晰**：`api/` 和 `src/` 目录职责明确
2. **共享类型机制**：`shared/types/` 提供类型共享
3. **React Query 使用规范**：queries/mutations 分离良好
4. **按功能域划分组件**：主要组件目录按业务域组织
5. **完善的中间件**：认证、CSRF、限流等中间件齐全
