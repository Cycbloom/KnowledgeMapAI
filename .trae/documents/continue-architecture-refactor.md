# 代码组织架构重构 - 继续实施计划

## 当前状态

### 已完成
- ✅ 阶段一：类型定义统一（核心文件已创建）
- ✅ 阶段二：路由层拆分（14个子模块已创建）
- ✅ 阶段三：服务层优化（6个服务文件已创建）

### 待完成
- ⏳ 阶段一：更新前后端导入路径
- ⏳ 阶段三：更新路由层服务导入路径
- ⏳ 阶段四：前端 API 客户端优化
- ⏳ 阶段五：Hooks 目录结构优化
- ⏳ 阶段六：组件目录重组
- ⏳ 阶段七：错误处理统一
- ⏳ 阶段八：文档和测试更新

---

## 实施计划

### 任务 1：更新路由层服务导入路径
**优先级：高**

当前 `api/routes/scheduler/focus.ts` 仍从旧的 `schedulerService` 导入，需要更新为新的模块化服务。

**步骤：**
1. 更新 `focus.ts` 从 `api/services/scheduler/` 导入 `focusService`
2. 验证所有路由文件使用正确的服务导入

### 任务 2：前端 API 客户端优化
**优先级：中**

**步骤：**
1. 创建 `src/services/api/modules/` 目录
2. 创建 `src/services/api/modules/scheduler/` 子目录
3. 拆分 `src/services/api/scheduler.ts` 为多个模块：
   - `tasks.ts` - 任务 API
   - `focus.ts` - 专注会话 API
   - `templates.ts` - 模板 API
   - `analytics.ts` - 统计 API
4. 创建 `src/services/api/types.ts` 统一 API 类型
5. 更新 `src/services/api/index.ts` 导出

### 任务 3：Hooks 目录结构优化
**优先级：中**

**步骤：**
1. 创建目录结构：
   - `src/hooks/queries/` - 数据查询 Hooks
   - `src/hooks/mutations/` - 数据变更 Hooks
   - `src/hooks/state/` - 状态管理 Hooks
   - `src/hooks/utils/` - 工具 Hooks
2. 迁移现有 Hooks 到对应目录
3. 合并 `useQueries.ts` 和 `useScheduler.ts` 中的重复逻辑
4. 创建 `src/hooks/index.ts` 统一导出
5. 更新组件中的导入路径

### 任务 4：组件目录重组
**优先级：中**

**步骤：**
1. 创建目录结构：
   - `src/components/common/` - 通用组件
   - `src/components/features/` - 功能组件
   - `src/components/layout/` - 布局组件
2. 迁移组件：
   - Scheduler 相关 → `features/Scheduler/`
   - GraphEditor 相关 → `features/GraphEditor/`
   - Study 相关 → `features/Study/`
   - 通用组件 → `common/`
3. 更新导入路径

### 任务 5：错误处理统一
**优先级：低**

**步骤：**
1. 创建 `shared/types/errors.ts` 统一错误类型
2. 优化 `api/middleware/errorHandler.ts`
3. 创建 `src/utils/errorHandler.ts` 前端错误处理
4. 统一 API 响应格式

### 任务 6：验证和测试
**优先级：高**

**步骤：**
1. 运行 `npm run check` 类型检查
2. 运行 `npm run lint` 代码检查
3. 运行 `npx playwright test` 功能测试
4. 修复发现的问题

### 任务 7：文档更新
**优先级：低**

**步骤：**
1. 更新测试文件中的导入路径
2. 更新项目文档说明新目录结构

---

## 风险和注意事项

1. **向后兼容**：保留旧的 `schedulerService.ts` 文件作为兼容层，逐步迁移
2. **测试覆盖**：每次重构后运行测试确保功能正常
3. **渐进式迁移**：优先完成高优先级任务，中低优先级可后续迭代

## 预期收益

- 文件大小合理，每个文件职责单一
- 代码位置可预测，易于查找
- 修改影响范围可控
- 减少合并冲突
- 提高代码复用性
