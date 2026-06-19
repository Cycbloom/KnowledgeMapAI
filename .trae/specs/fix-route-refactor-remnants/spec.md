# 修复路由层重构遗留问题 Spec

## Why
7 阶段路由层业务逻辑提取已完成核心目标（0 DB 调用），但审计发现服务 index.ts 缺失导出和 auth.ts Auth API 未封装两个遗留问题，需要修复以保证架构完整性。

## What Changes
- 补全 5 个服务 index.ts 的缺失导出
- 将 auth.ts 中 5 处 Auth API 直接调用封装到 authRouteService
- 更新路由文件导入路径，从直接引用具体文件改为通过 index.ts 导入

## Impact
- Affected specs: extract-route-logic-phase1~7
- Affected code: 5 个 index.ts 文件、authRouteService.ts、auth.ts、以及约 20 个路由文件的导入路径

## ADDED Requirements

### Requirement: 服务 index.ts 完整导出
所有服务子目录的 index.ts SHALL 导出该目录下被路由文件引用的所有公共符号。

#### Scenario: 路由通过 index.ts 导入服务
- **WHEN** 路由文件需要引用某个服务
- **THEN** 该服务 SHALL 可通过目录级 index.ts 导入，无需直接引用具体文件

### Requirement: Auth API 封装到服务层
auth.ts 中的 Supabase Auth API 调用 SHALL 通过 authRouteService 封装，路由层不直接调用 `.auth.*` 方法。

#### Scenario: 注册/登录/刷新/登出
- **WHEN** 用户执行认证操作
- **THEN** 路由层仅提取参数并调用 authRouteService，由服务层执行 Auth API 调用
