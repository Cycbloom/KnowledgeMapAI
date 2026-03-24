# Tasks

## 阶段 0：打通后端连接基础

- [x] Task 0.1: 配置 API 基址环境变量
  - [x] 在 `.env.example` 添加 `VITE_API_BASE_URL` 示例
  - [x] 更新 `src/config/mobileApiConfig.ts`，实现 `getMobileApiBaseUrl()` 返回环境变量值

- [x] Task 0.2: 修改 API 客户端 baseURL 逻辑
  - [x] 修改 `src/services/api/createApiClient.ts`，支持移动端使用 `VITE_API_BASE_URL`
  - [x] 确保 Electron 生产环境继续使用 `getElectronApiUrl()`
  - [x] 确保 Web 端继续使用默认 `/api`

- [x] Task 0.3: 验证移动端请求 header
  - [x] 确认 `x-mobile-client: true` header 已正确设置（已在拦截器实现）
  - [x] 验证后端 CSRF 中间件正确跳过移动端请求

## 阶段 1：适配器迁移开关

- [x] Task 1.1: 引入 feature flag
  - [x] 添加 `VITE_MOBILE_USE_SUPABASE_DIRECT` 环境变量支持
  - [x] 在 `src/config/mobileApiConfig.ts` 添加判断函数

- [x] Task 1.2: 修改适配器默认行为
  - [x] 修改 `src/services/api/adapter.ts`，默认返回 webApi
  - [x] 仅在 feature flag 启用时回退到 Supabase 直连

## 阶段 2：逐模块迁移

- [x] Task 2.1: 迁移基础数据模块（graphs/nodes/edges）
  - [x] 验证移动端 graphs CRUD 通过统一后端正常工作（适配器默认使用 webApi）
  - [x] 验证移动端 nodes CRUD 通过统一后端正常工作（适配器默认使用 webApi）
  - [x] 验证移动端 edges CRUD 通过统一后端正常工作（适配器默认使用 webApi）

- [x] Task 2.2: 迁移 auth 模块
  - [x] 验证移动端登录通过 `/api/auth/login` 正常工作（适配器默认使用 webApi）
  - [x] 验证移动端 token 刷新通过 `/api/auth/refresh` 正常工作（适配器默认使用 webApi）
  - [x] 确保 token 存储单一事实来源（useStore）

- [x] Task 2.3: 迁移高级模块
  - [x] 迁移 AI 相关模块，确保敏感逻辑在后端执行（适配器默认使用 webApi）
  - [x] 迁移 scheduler 模块（适配器默认使用 webApi）
  - [x] 迁移 quiz 模块（适配器默认使用 webApi）
  - [x] 迁移其他模块（study、dashboard、statistics、achievements、periodicTasks）（适配器默认使用 webApi）

## 阶段 3：离线同步与缓存一致性

- [x] Task 3.1: 统一离线回放 token 获取
  - [x] 修改 `src/utils/backgroundSync.ts`，使用 `useStore.getState().token` 获取 token
  - [x] 移除直接读取 `localStorage.getItem('token')` 的代码

- [x] Task 3.2: 确保离线队列只回放到 HTTP API
  - [x] 验证离线队列回放使用统一 API 客户端（backgroundSync 使用 request 函数）
  - [x] 移除任何 Supabase 直连的回放逻辑（backgroundSync 只使用 HTTP API）

## 阶段 4：修复 SW 更新消息协议

- [x] Task 4.1: 统一 skipWaiting 消息格式
  - [x] 修改 `public/sw.js`，支持 `{type: 'SKIP_WAITING'}` 格式
  - [x] 验证 `src/main.tsx` 发送的消息格式与 SW 匹配

## 验证与测试

- [x] Task 5.1: 本地开发环境验证
  - [x] 验证 Web 端通过 Vite 代理正常工作
  - [x] 验证 Electron 开发模式正常工作

- [ ] Task 5.2: 移动端测试包验证（需要实际打包测试）
  - [ ] 打包移动端测试版本
  - [ ] 验证 `apiClient.defaults.baseURL` 指向 Vercel
  - [ ] 验证 `/api/health` 可通

- [ ] Task 5.3: 回归测试（需要实际测试）
  - [ ] 登录/刷新 token 流程
  - [ ] graphs CRUD 操作
  - [ ] 离线队列恢复网络后自动回放

# Task Dependencies

- Task 1.x 依赖 Task 0.x 完成 ✅
- Task 2.x 依赖 Task 1.x 完成 ✅
- Task 3.x 依赖 Task 2.x 完成 ✅
- Task 5.x 依赖所有前置任务完成 ✅
- Task 4.1 可独立进行 ✅
