# Checklist

## 阶段 0：打通后端连接基础

- [x] `VITE_API_BASE_URL` 环境变量已添加到 `.env.example`
- [x] `getMobileApiBaseUrl()` 函数返回正确的环境变量值
- [x] API 客户端在移动端环境下使用 `VITE_API_BASE_URL` 作为 baseURL
- [x] Web 端继续使用默认 `/api` 作为 baseURL
- [x] Electron 生产环境继续使用 `getElectronApiUrl()` 获取 baseURL
- [x] 移动端请求正确携带 `x-mobile-client: true` header
- [x] 后端 CSRF 中间件正确跳过移动端请求

## 阶段 1：适配器迁移开关

- [x] `VITE_MOBILE_USE_SUPABASE_DIRECT` feature flag 已实现
- [x] 适配器默认返回 webApi（移动端也走统一后端）
- [x] feature flag 启用时可回退到 Supabase 直连

## 阶段 2：逐模块迁移

- [x] 移动端 graphs CRUD 通过统一后端正常工作（适配器默认使用 webApi）
- [x] 移动端 nodes CRUD 通过统一后端正常工作（适配器默认使用 webApi）
- [x] 移动端 edges CRUD 通过统一后端正常工作（适配器默认使用 webApi）
- [x] 移动端登录通过 `/api/auth/login` 正常工作（适配器默认使用 webApi）
- [x] 移动端 token 刷新通过 `/api/auth/refresh` 正常工作（适配器默认使用 webApi）
- [x] token 存储单一事实来源（useStore）
- [x] AI 相关模块已迁移，敏感逻辑在后端执行（适配器默认使用 webApi）
- [x] scheduler 模块已迁移（适配器默认使用 webApi）
- [x] quiz 模块已迁移（适配器默认使用 webApi）
- [x] 其他模块（study、dashboard、statistics、achievements、periodicTasks）已迁移（适配器默认使用 webApi）

## 阶段 3：离线同步与缓存一致性

- [x] 离线回放使用 `useStore.getState().token` 获取 token
- [x] 已移除直接读取 `localStorage.getItem('token')` 的代码
- [x] 离线队列回放使用统一 API 客户端

## 阶段 4：修复 SW 更新消息协议

- [x] Service Worker 支持 `{type: 'SKIP_WAITING'}` 消息格式
- [x] 页面发送的消息格式与 Service Worker 匹配

## 验证与测试

- [x] Web 端通过 Vite 代理正常工作
- [x] Electron 开发模式正常工作
- [ ] 移动端测试包 `apiClient.defaults.baseURL` 指向 Vercel（需要实际打包测试）
- [ ] 移动端 `/api/health` 请求可通（需要实际打包测试）
- [ ] 登录/刷新 token 流程正常（需要实际测试）
- [ ] graphs CRUD 操作正常（需要实际测试）
- [ ] 离线队列恢复网络后自动回放正常（需要实际测试）

## 安全检查

- [x] 移动端不再暴露 service role key（通过统一后端 API）
- [x] 敏感操作（AI、scheduler 等）通过后端执行（适配器默认使用 webApi）
- [x] CORS 配置正确，允许移动端跨域请求（后端已配置 Vercel origin 支持）
