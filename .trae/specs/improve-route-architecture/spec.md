# 路由层架构完善 Spec

## Why
路由层 DB 调用提取已完成（367→0），但审计发现三类遗留问题：约 1402 行非 DB 业务逻辑仍残留在 12 个路由文件中、40 个文件错误处理模式不一致（混用 `res.status()` 和 `AppError`）、11 处 `as any` 类型断言。这些问题影响代码可维护性和类型安全。

## What Changes
- 提取 12 个路由文件中的非 DB 业务逻辑到对应服务层
- 统一 40 个路由文件的错误处理为 `throw new AppError()` 模式
- 修复 11 处 `as any` 类型断言

## Impact
- Affected specs: extract-route-logic-phase1~7, fix-route-refactor-remnants
- Affected code: 12 个路由文件（业务逻辑提取）、40 个路由文件（错误处理统一）、6 个服务文件（as any 修复）、shared/types（接口扩展）

## ADDED Requirements

### Requirement: 路由层不含业务逻辑
路由处理器 SHALL 仅包含参数提取、服务调用、响应格式化三步操作。数据转换、计算、条件分支等业务逻辑 SHALL 在服务层完成。

#### Scenario: AI 调用编排
- **WHEN** 路由需要调用 AI 服务并处理响应
- **THEN** prompt 组装、AI 调用、JSON 解析、结果映射 SHALL 在服务层完成，路由仅传递参数

#### Scenario: 批量操作编排
- **WHEN** 路由需要对多个项目执行操作
- **THEN** 循环、汇总、缓存失效 SHALL 在服务层的批量方法中完成

### Requirement: 统一错误处理模式
路由层 SHALL 统一使用 `throw new AppError(...)` 处理错误，禁止使用 `res.status(4xx/5xx).json()` 手动返回错误。

#### Scenario: 服务调用失败
- **WHEN** 服务层抛出错误
- **THEN** 路由层 SHALL 让错误冒泡到全局错误处理器，或 catch 后重新 throw AppError

#### Scenario: 参数验证失败
- **WHEN** 请求参数不合法
- **THEN** 路由层 SHALL `throw new AppError(ErrorCode)` 而非 `res.status(400).json()`

### Requirement: 服务层无 as any 类型断言
服务文件 SHALL NOT 使用 `as any` 类型断言。类型不匹配 SHALL 通过扩展接口定义或使用具体类型断言解决。

#### Scenario: 动态属性赋值
- **WHEN** 需要给对象添加接口中未定义的属性
- **THEN** SHALL 先在接口中添加该可选属性，再赋值

#### Scenario: Supabase 查询结果类型不精确
- **WHEN** Supabase 联表查询返回类型不精确
- **THEN** SHALL 定义查询结果接口或使用具体类型断言（如 `as StudyCard`）
