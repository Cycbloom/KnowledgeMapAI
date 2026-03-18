# Checklist

## 环境检测
- [x] `isElectron()` 函数正确检测 Electron 环境
- [x] `isElectronProduction()` 函数正确区分开发和生产模式
- [x] `getElectronApiUrl()` 返回正确的 API URL

## API 服务器启动
- [x] Electron 主进程成功启动 Express API 服务器
- [x] 服务器在端口 3001 上监听
- [x] 端口冲突时自动尝试备用端口
- [x] 应用关闭时服务器正确停止

## API 客户端配置
- [x] Electron 生产环境使用正确的绝对 URL
- [x] 开发模式保持原有行为（使用 Vite 代理）
- [x] Web 端保持原有行为
- [x] 移动端保持原有行为（使用 Supabase）

## CSRF 功能
- [x] Electron 生产环境能正确获取 CSRF token
- [x] CSRF token 正确存储在 cookie 中
- [x] 后续请求正确携带 CSRF token

## IPC 通信
- [x] preload 脚本正确暴露 API 端口获取方法
- [x] 渲染进程可以获取实际 API 服务器端口

## 构建配置
- [x] API 服务器代码正确打包
- [x] 所有依赖模块正确包含
- [x] 运行时无模块加载错误

## 功能验证
- [x] 开发模式 (`npm run electron:dev`) 正常工作
- [x] 生产构建 (`npm run electron:build`) 成功
- [ ] 打包后的应用启动无错误（需要用户手动测试）
- [ ] 登录功能正常（需要用户手动测试）
- [ ] 图谱加载功能正常（需要用户手动测试）
- [ ] 无 `ERR_FILE_NOT_FOUND` 错误（需要用户手动测试）
