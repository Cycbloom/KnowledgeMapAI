# 禁用测试环境速率限制规范

## Why
当前测试执行失败，原因是系统实施了登录速率限制。API 层面的 `auth` rate limiter 设置为 15 分钟内最多 10 次请求，这对于自动化测试来说过于严格。需要禁用测试环境中的速率限制以确保测试能够顺利完成。

## What Changes
- 禁用 API 层面的速率限制中间件（测试环境）
- 提高 Supabase 层面的速率限制阈值
- 添加环境变量控制速率限制开关

## Impact
- Affected code: `api/middleware/rateLimiter.ts`, `api/app.ts`, `supabase/config.toml`
- 测试环境不再受速率限制影响
- 生产环境保持原有安全限制

## ADDED Requirements

### Requirement: 测试环境速率限制禁用

#### Scenario: API 层面速率限制禁用
- **WHEN** 环境变量 `DISABLE_RATE_LIMIT=true` 或 `NODE_ENV=test`
- **THEN** 所有速率限制中间件被跳过

#### Scenario: Supabase 层面速率限制提高
- **WHEN** 本地开发或测试环境
- **THEN** 登录速率限制提高到极高值（100000+）

### Requirement: 环境变量控制

#### Scenario: 速率限制开关
- **WHEN** 设置 `DISABLE_RATE_LIMIT=true`
- **THEN** 速率限制中间件直接放行所有请求

## MODIFIED Requirements
无

## REMOVED Requirements
无
