# 统一 className 拼接风格 Spec

## Why
通用组件库内部存在三种 className 拼接风格：`.replace(/\s+/g, ' ').trim()` 旧风格、裸模板字符串插值、`cn()` 新风格。旧风格和裸模板字符串无法正确处理 Tailwind 类名冲突（如 `bg-primary-600` 与传入的 `bg-red-500` 同时生效），`cn()` 通过 tailwind-merge 可自动去重和冲突合并。

## What Changes
- 将 3 个使用 `.replace(/\s+/g, ' ').trim()` 的组件迁移为 `cn()` 风格
- 将 16 个使用裸模板字符串插值的 common 组件迁移为 `cn()` 风格
- 统一 common 组件目录的 className 拼接方式为 `cn()`

## Impact
- Affected code: `src/components/common/` 目录下 19 个组件文件
- 无破坏性变更，`cn()` 输出与现有行为在无类名冲突时完全一致

## ADDED Requirements

### Requirement: className 拼接统一使用 cn()
所有 `src/components/common/` 目录下的组件 SHALL 使用 `cn()` 工具函数拼接 className，禁止使用 `.replace(/\s+/g, ' ').trim()` 或裸模板字符串插值。

#### Scenario: 类名冲突时正确合并
- **WHEN** 用户传入 `className="bg-red-500"` 给 `<Button variant="primary">`
- **THEN** 最终 className 中 `bg-red-500` 覆盖 `bg-primary-600`，而非两者同时生效

#### Scenario: 无冲突时行为不变
- **WHEN** 用户传入 `className="mt-4"` 给 `<Button>`
- **THEN** `mt-4` 与内置类名正常拼接，行为与迁移前一致

#### Scenario: 条件类名正确处理
- **WHEN** 组件根据状态动态拼接类名（如 `isDark ? 'text-slate-400' : 'text-gray-400'`）
- **THEN** `cn()` 正确处理条件表达式，行为与迁移前一致

## MODIFIED Requirements

### Requirement: Button 组件 className 处理
Button 组件 SHALL 使用 `cn()` 替代 `.replace(/\s+/g, ' ').trim()` 拼接 className，支持 variant/size/fullWidth/className 的正确合并。

### Requirement: FormField 组件 className 处理
FormField 组件 SHALL 使用 `cn()` 替代 `.replace(/\s+/g, ' ').trim()` 拼接 className。

### Requirement: FormError 组件 className 处理
FormError 组件 SHALL 使用 `cn()` 替代 `.replace(/\s+/g, ' ').trim()` 拼接 className。
