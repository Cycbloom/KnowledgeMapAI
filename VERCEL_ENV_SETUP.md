# Vercel 环境变量配置指南

## 必需的环境变量

在 Vercel 项目设置中，进入 **Settings > Environment Variables**，添加以下变量：

### Supabase 配置（必需）

| 变量名 | 说明 | 获取位置 |
|--------|------|----------|
| `VITE_SUPABASE_URL` | Supabase 项目 URL | Supabase Dashboard > Project Settings > API |
| `VITE_SUPABASE_ANON_KEY` | Supabase 匿名密钥（anon key） | Supabase Dashboard > Project Settings > API > Project API keys |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase 服务角色密钥 | Supabase Dashboard > Project Settings > API > Project API keys |

⚠️ **重要提示**：
- `VITE_SUPABASE_ANON_KEY` 必须使用 **anon** key，不是 service_role key
- `SUPABASE_SERVICE_ROLE_KEY` 应该保密，不要在前端代码中使用

### AI 服务配置（至少配置一个）

| 变量名 | 说明 |
|--------|------|
| `DEEPSEEK_API_KEY` | DeepSeek API 密钥 |
| `VOLCENGINE_API_KEY` | 火山引擎 API 密钥 |
| `ALIYUN_API_KEY` | 阿里云 API 密钥 |

## 可选的环境变量

| 变量名 | 说明 | 默认值 |
|--------|------|--------|
| `FRONTEND_URL` | 前端 URL（用于 CORS） | 自动检测 Vercel 域名 |
| `NODE_ENV` | 运行环境 | `production` |

## 常见问题排查

### 1. 注册时出现 500 错误

**检查步骤**：
1. 访问 `/api/health/env` 端点检查环境变量配置
2. 确认 `VITE_SUPABASE_ANON_KEY` 使用的是 anon key（不是 service_role key）
3. 确认 `SUPABASE_SERVICE_ROLE_KEY` 已正确配置

### 2. CORS 错误

**解决方案**：
- 确保 `FRONTEND_URL` 设置为你的 Vercel 域名
- 或者让系统自动检测 `.vercel.app` 域名

### 3. Supabase 连接失败

**检查步骤**：
1. 确认 `VITE_SUPABASE_URL` 格式正确（以 `https://` 开头）
2. 确认 Supabase 项目未暂停
3. 确认 Supabase 项目已启用邮箱/密码认证

## 部署后验证

部署完成后，访问以下端点验证配置：

1. **健康检查**: `https://your-app.vercel.app/api/health/system`
2. **环境变量检查**: `https://your-app.vercel.app/api/health/env`

环境变量检查应该返回：
```json
{
  "status": "ok",
  "message": "所有必需环境变量已配置",
  "supabase": {
    "anonKeyType": "anon"  // 确保是 "anon"，不是 "service_role"
  }
}
```
