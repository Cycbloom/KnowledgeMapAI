# 架构优化 Spec

## Why

项目存在大量重复代码和可抽象的模式，导致维护成本高、代码一致性差。通过提取工具函数、消除重复逻辑，可以显著提高代码质量和可维护性。

## What Changes

- 提取 Mobile 服务层的客户端获取工具函数，消除 100+ 处重复代码
- 合并 3 个功能相似的 TemplateSelector 组件
- 创建消息通知工具函数，封装 EventBus 调用
- 创建主题类名工具函数，统一暗色模式处理
- 合并功能重叠的错误处理 Hook（useError + useErrorHandler）
- 合并功能重叠的网络状态 Hook（useNetworkStatus + useNetworkStatusEnhanced）
- 提取流式处理函数，消除 AI 服务重复
- 合并空状态组件（Empty + EmptyState）
- 合并确认对话框组件（ConfirmationModal + ConfirmDialog）

## Impact

- Affected specs: 无直接影响
- Affected code:
  - `src/services/mobile/` - 所有 Mobile 服务文件
  - `src/components/Scheduler/TemplateSelector.tsx`
  - `src/components/Templates/TemplateSelector.tsx`
  - `src/components/Scheduler/TaskTemplateSelector.tsx`
  - `src/hooks/common/useError.ts`
  - `src/hooks/common/useErrorHandler.ts`
  - `src/hooks/common/useNetworkStatus.ts`
  - `src/hooks/common/useNetworkStatusEnhanced.ts`
  - `src/components/common/Empty.tsx`
  - `src/components/common/EmptyState.tsx`
  - `src/components/common/ConfirmationModal.tsx`
  - `src/components/Console/ConfirmDialog.tsx`
  - `src/services/api/ai.ts`
  - `src/services/mobile/ai.ts`

## ADDED Requirements

### Requirement: Mobile 服务层客户端工具函数

系统 SHALL 提供 `withClient` 工具函数，用于封装 Mobile 服务层的 Supabase 客户端获取和检查逻辑。

#### Scenario: 成功获取客户端
- **WHEN** 调用 `withClient` 执行数据库操作
- **THEN** 自动获取并验证客户端，执行传入的操作函数

#### Scenario: 客户端未初始化
- **WHEN** Supabase 客户端未初始化
- **THEN** 抛出 "Supabase client not initialized" 错误

### Requirement: 消息通知工具函数

系统 SHALL 提供 `message` 工具对象，封装 EventBus 的消息通知调用。

#### Scenario: 显示成功消息
- **WHEN** 调用 `message.success('操作成功')`
- **THEN** 通过 EventBus 发送成功类型消息

#### Scenario: 显示错误消息
- **WHEN** 调用 `message.error('操作失败')`
- **THEN** 通过 EventBus 发送错误类型消息，默认持续 5 秒

### Requirement: 主题类名工具函数

系统 SHALL 提供 `tc` 工具对象，提供预设的暗色模式兼容类名。

#### Scenario: 使用预设文本类名
- **WHEN** 使用 `tc.text.secondary`
- **THEN** 返回 `'text-gray-500 dark:text-slate-400'` 类名字符串

### Requirement: 统一模板选择器组件

系统 SHALL 提供统一的 `UnifiedTemplateSelector` 组件，支持任务、图谱、调度器三种模式。

#### Scenario: 任务模式
- **WHEN** 设置 `mode="task"`
- **THEN** 显示任务模板选择界面

#### Scenario: 图谱模式
- **WHEN** 设置 `mode="graph"`
- **THEN** 显示图谱模板选择界面

### Requirement: 统一错误处理 Hook

系统 SHALL 提供合并后的 `useError` Hook，包含原有 `useError` 和 `useErrorHandler` 的所有功能。

#### Scenario: 错误处理
- **WHEN** 调用 `handleError(error)`
- **THEN** 显示错误消息并记录日志

#### Scenario: 异步操作包装
- **WHEN** 使用 `withErrorHandling` 包装异步函数
- **THEN** 自动捕获并处理错误

### Requirement: 统一网络状态 Hook

系统 SHALL 提供合并后的 `useNetworkStatus` Hook，支持可选的增强功能。

#### Scenario: 基础网络状态
- **WHEN** 调用 `useNetworkStatus()`
- **THEN** 返回 `isOnline` 和 `connectionType`

#### Scenario: 增强网络检测
- **WHEN** 调用 `useNetworkStatus({ enableSlowDetection: true })`
- **THEN** 额外返回 `isSlowConnection` 和 `checkConnection`

### Requirement: 流式处理工具函数

系统 SHALL 提取 `createStreamHandler` 函数到共享模块，供 Web 和 Mobile AI 服务使用。

#### Scenario: 流式请求处理
- **WHEN** 调用 `createStreamHandler`
- **THEN** 发起流式请求并逐块回调处理

## MODIFIED Requirements

### Requirement: Mobile 服务层重构

所有 Mobile 服务文件 SHALL 使用 `withClient` 工具函数替代重复的客户端获取代码。

**变更前**：
```typescript
const client = getMobileSupabaseClient();
if (!client) {
  throw new Error("Supabase client not initialized");
}
const { data, error } = await client.from("table").select("*");
```

**变更后**：
```typescript
return withClient(async (client) => {
  const { data, error } = await client.from("table").select("*");
  // ...
});
```

### Requirement: 消息通知调用重构

所有 `frontendEventBus.publish("message_show", ...)` 调用 SHALL 替换为 `message.success/error/info` 方法。

### Requirement: 组件导入路径更新

使用新组件的文件 SHALL 更新导入路径：
- `TemplateSelector` → `UnifiedTemplateSelector`
- `Empty` → `EmptyState`
- `ConfirmDialog` → `ConfirmationModal`（统一使用增强版）

## REMOVED Requirements

### Requirement: 旧版 useError Hook

**Reason**: 功能已合并到增强版 `useError` Hook
**Migration**: 更新导入路径，API 保持兼容

### Requirement: 旧版 useNetworkStatusEnhanced Hook

**Reason**: 功能已合并到增强版 `useNetworkStatus` Hook
**Migration**: 使用 `useNetworkStatus({ enableSlowDetection: true })`

### Requirement: Empty 组件

**Reason**: 功能已被 `EmptyState` 完全覆盖
**Migration**: 替换为 `EmptyState` 组件

### Requirement: Console/ConfirmDialog 组件

**Reason**: 功能已合并到 `ConfirmationModal`
**Migration**: 使用增强版 `ConfirmationModal`
