# Vercel 部署问题诊断 Checklist

## 第一阶段：环境变量检查

### Vercel 控制台检查
- [ ] 登录 Vercel 控制台，进入项目设置
- [ ] 导航到 Settings > Environment Variables
- [ ] 确认 `VITE_SUPABASE_URL` 已配置且格式正确（以 `https://` 开头）
- [ ] 确认 `VITE_SUPABASE_ANON_KEY` 已配置（检查是否为 anon key，不是 service_role）
- [ ] 确认 `SUPABASE_SERVICE_ROLE_KEY` 已配置
- [ ] 确认至少配置了一个 AI API 密钥

### 健康检查端点验证
- [ ] 访问 `https://your-app.vercel.app/api/health/env`
- [ ] 确认返回 `status: "ok"`
- [ ] 确认 `supabase.anonKeyType` 为 `"anon"`（不是 `"service_role"`）
- [ ] 访问 `https://your-app.vercel.app/api/health/system`
- [ ] 确认 `checks.database.status` 为 `"ok"`

## 第二阶段：代码修复验证

### CSRF 配置修复
- [x] `api/middleware/csrf.ts` 已更新支持 Vercel 环境
- [x] Cookie `secure` 属性在 Vercel 上为 `true`
- [x] Cookie `sameSite` 属性在 Vercel 上为 `'lax'`

### 登录错误处理增强
- [x] `api/routes/auth.ts` 登录路由有详细的错误日志
- [x] Supabase 连接错误能正确传递给前端

## 第三阶段：功能验证

### 登录功能测试
- [ ] 访问登录页面 `https://your-app.vercel.app/login`
- [ ] 输入测试账号 `test@example.com` 和密码 `test123456`
- [ ] 点击登录按钮
- [ ] 确认能成功登录并跳转到首页

### 注册功能测试
- [ ] 访问注册页面 `https://your-app.vercel.app/register`
- [ ] 输入新邮箱、密码和用户名
- [ ] 点击注册按钮
- [ ] 确认能成功注册

## 常见问题排查

### 如果 `/api/health/env` 返回错误
1. 检查 Vercel 环境变量是否正确设置
2. 确认环境变量应用于 Production 环境
3. 重新部署项目

### 如果 `/api/health/system` 数据库检查失败
1. 确认 Supabase 项目未暂停
2. 确认 `SUPABASE_SERVICE_ROLE_KEY` 正确
3. 检查 Supabase 项目设置中的 API 设置

### 如果登录仍然失败
1. 检查浏览器开发者工具中的网络请求
2. 查看 Vercel 函数日志获取详细错误信息
3. 确认 CORS 配置正确
