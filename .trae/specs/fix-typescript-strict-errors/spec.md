# TypeScript 严格模式类型错误修复 Spec

## Why
TypeScript 严格模式已启用（strict: true, noImplicitAny: true, strictNullChecks: true），但项目中仍存在约 40 个类型错误需要修复，以确保代码质量和类型安全。

## What Changes
- 修复未使用变量/导入的 TS6133 错误
- 修复隐式 any 类型的 TS7006 错误
- 修复类型不匹配的 TS2322/TS2345 错误
- 修复导出成员不存在的 TS2724 错误

## Impact
- Affected specs: 无
- Affected code:
  - src/components/Scheduler/ 目录下的多个组件
  - src/hooks/ 目录下的多个 hooks
  - src/pages/ 目录下的页面组件
  - src/utils/ 和 src/three/ 目录下的工具文件

## ADDED Requirements

### Requirement: 修复未使用变量和导入
系统代码 SHALL 不包含未使用的变量和导入声明。

#### Scenario: 移除未使用导入
- **WHEN** 组件导入了一个图标或变量但未使用
- **THEN** 该导入应被移除或变量应添加下划线前缀

### Requirement: 修复隐式 any 类型
系统代码 SHALL 为所有函数参数提供显式类型注解。

#### Scenario: 添加类型注解
- **WHEN** 回调函数参数隐式具有 any 类型
- **THEN** 应为该参数添加显式类型注解

### Requirement: 修复类型不匹配
系统代码 SHALL 确保类型赋值和函数参数类型兼容。

#### Scenario: 修复类型转换
- **WHEN** 类型不兼容导致赋值失败
- **THEN** 应使用正确的类型转换或类型守卫

### Requirement: 修复导出成员不存在
系统代码 SHALL 使用正确的导出成员名称。

#### Scenario: 修正导入名称
- **WHEN** 导入的成员名称不存在
- **THEN** 应使用正确的成员名称或创建该导出
