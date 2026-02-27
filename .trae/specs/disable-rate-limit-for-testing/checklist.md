# Checklist

## API 速率限制验证
- [x] rateLimiter.ts 添加环境变量检查
- [x] DISABLE_RATE_LIMIT=true 时跳过速率限制
- [x] NODE_ENV=test 时跳过速率限制
- [x] 速率限制状态日志记录

## Supabase 速率限制验证
- [x] sign_in_sign_ups 提高到 100000
- [x] token_verifications 提高到 100000
- [x] token_refresh 提高到 100000

## 环境变量验证
- [x] .env.example 包含 DISABLE_RATE_LIMIT 说明
- [x] Playwright 测试配置正确

## 功能验证
- [x] Supabase 服务重启成功
- [x] API 服务重启成功
- [x] Playwright 测试通过（登录测试 15 passed，注册+Dashboard 45 passed）
