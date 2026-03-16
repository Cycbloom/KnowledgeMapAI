# Vercel 部署问题诊断与修复 Spec

## Why
项目在 Vercel 上部署后，登录功能出现 500 服务器错误。需要系统性地诊断和解决问题，确保用户能够正常登录使用应用。

## What Changes
- 诊断 Vercel 环境变量配置问题
- 检查 Supabase 连接配置
- 修复 CSRF cookie 在 Vercel 上的配置问题
- 优化错误日志输出便于调试

## Impact
- Affected specs: 用户认证、环境变量管理、CSRF 保护
- Affected code: `api/middleware/csrf.ts`, `api/supabase.ts`, `api/routes/auth.ts`

## 问题分析

### 根本原因分析

登录时出现 500 错误，可能的原因包括：

1. **环境变量未正确配置**
   - `VITE_SUPABASE_URL` 未配置或格式错误
   - `SUPABASE_SERVICE_ROLE_KEY` 未配置
   - `VITE_SUPABASE_ANON_KEY` 未配置或使用了错误的 key

2. **Supabase 连接失败**
   - `api/supabase.ts` 中使用了 placeholder URL/key，导致请求失败
   - Supabase 项目可能已暂停或不可用

3. **CSRF Cookie 配置问题**
   - 在 Vercel 上，`secure: true` 和 `sameSite: 'strict'` 可能导致 cookie 设置失败
   - 跨域请求时 cookie 可能无法正确传递

4. **CORS 配置问题**
   - Vercel 预览域名可能未被正确允许

## ADDED Requirements

### Requirement: 环境变量验证
系统 SHALL 在启动时验证所有必需的环境变量，并在缺失时返回明确的错误信息。

#### Scenario: 环境变量缺失
- **WHEN** 必需的环境变量未配置
- **THEN** 系统应在 `/api/health/env` 端点返回明确的错误信息

#### Scenario: Supabase 连接失败
- **WHEN** Supabase 连接失败
- **THEN** 系统应返回包含具体错误原因的响应

### Requirement: CSRF Cookie 配置优化
系统 SHALL 确保 CSRF cookie 在 Vercel 生产环境中正确设置。

#### Scenario: 生产环境 Cookie 设置
- **WHEN** 应用部署在 Vercel 生产环境
- **THEN** CSRF cookie 应正确设置 `secure` 和 `sameSite` 属性

#### Scenario: 预览环境 Cookie 设置
- **WHEN** 应用部署在 Vercel 预览环境
- **THEN** CSRF cookie 应使用 `sameSite: 'none'` 以支持跨域请求

### Requirement: 登录错误处理增强
系统 SHALL 在登录失败时提供详细的错误信息以便调试。

#### Scenario: 登录失败
- **WHEN** 登录请求失败
- **THEN** 系统应记录详细的错误信息并返回用户友好的错误消息

## MODIFIED Requirements

### Requirement: CSRF 保护中间件
修改 CSRF 中间件以支持 Vercel 部署环境。

**原配置**:
```typescript
const getCookieOptions = () => ({
  httpOnly: false,
  secure: process.env.NODE_ENV === 'production',
  sameSite: process.env.NODE_ENV === 'production' ? 'strict' as const : 'lax' as const,
  maxAge: 24 * 60 * 60 * 1000,
  path: '/',
});
```

**新配置**:
```typescript
const getCookieOptions = () => {
  const isVercel = process.env.VERCEL === '1';
  const isProduction = process.env.NODE_ENV === 'production';
  
  return {
    httpOnly: false,
    secure: isProduction || isVercel,
    sameSite: isVercel ? 'lax' as const : (isProduction ? 'strict' as const : 'lax' as const),
    maxAge: 24 * 60 * 60 * 1000,
    path: '/',
    domain: undefined,
  };
};
```

## REMOVED Requirements
无

## 诊断步骤

### 1. 检查 Vercel 环境变量
在 Vercel 项目设置中确认以下环境变量已正确配置：

| 变量名 | 必需 | 说明 |
|--------|------|------|
| `VITE_SUPABASE_URL` | ✅ | Supabase 项目 URL |
| `VITE_SUPABASE_ANON_KEY` | ✅ | Supabase anon key（不是 service_role） |
| `SUPABASE_SERVICE_ROLE_KEY` | ✅ | Supabase service_role key |
| `DEEPSEEK_API_KEY` | ⚠️ | AI 功能需要 |
| `NODE_ENV` | ❌ | 默认为 production |

### 2. 访问健康检查端点
部署后访问以下端点验证配置：
- `/api/health/system` - 系统健康状态
- `/api/health/env` - 环境变量检查

### 3. 检查 Vercel 函数日志
在 Vercel 控制台查看函数日志，查找错误信息。
