# 修复路由 404 问题：applyKernelRoutes 时序错误

## Summary

迁移路由到插件系统后，所有 API 返回 404。根因是 `applyKernelRoutes(app, kernel)` 在 `app.ts` 模块加载时调用，此时插件尚未注册，kernel 中无路由。需要将调用移到 `server.ts` 中插件注册之后。

## Current State Analysis

**执行时序（当前，有 bug）：**
1. `app.ts` 模块加载 → `applyKernelRoutes(app, kernel)` → kernel.routeRegistry 为空 → 无路由挂载
2. `server.ts` Phase 2 → `kernel.registerPlugin()` × 6 → 路由写入 kernel
3. `server.ts` Phase 3 → `app.listen()` → 服务器启动，但路由未挂载 → 所有请求 404

**执行时序（修复后）：**
1. `app.ts` 模块加载 → 不调用 `applyKernelRoutes`
2. `server.ts` Phase 2 → `kernel.registerPlugin()` × 6 → 路由写入 kernel
3. `server.ts` Phase 2.5（新增）→ `applyKernelRoutes(app, kernel)` → 路由挂载到 Express
4. `server.ts` Phase 3 → `app.listen()` → 服务器启动，路由已就绪

## Proposed Changes

### 文件 1: `api/app.ts`

**变更**：移除 `applyKernelRoutes(app, kernel)` 调用，将函数导出供 server.ts 使用。

- 删除第 134 行 `applyKernelRoutes(app, kernel);`
- 导出 `applyKernelRoutes` 函数（目前是模块内部函数，需改为 export）

### 文件 2: `api/server.ts`

**变更**：在 Phase 2 插件注册完成后、Phase 3 服务器监听前，调用 `applyKernelRoutes`。

- 导入 `applyKernelRoutes`
- 在 Phase 2 和 Phase 3 之间插入调用：`applyKernelRoutes(app, kernel);`

## Verification

1. `npm run check` 类型检查通过
2. `npm run lint` 代码规范通过
3. 启动开发服务器，确认 API 路由不再返回 404
