# Tasks

## [ ] Task 1: 创建 Electron 环境检测工具函数
- **Priority**: P0
- **Depends On**: None
- **Description**: 
  - 在 `src/config/` 目录下创建 `electronConfig.ts`
  - 实现 `isElectron()` 函数检测是否在 Electron 环境中运行
  - 实现 `isElectronProduction()` 函数区分开发和生产环境
  - 实现 `getElectronApiUrl()` 函数返回正确的 API 基础 URL
- **Acceptance Criteria**: 
  - 正确检测 Electron 环境
  - 区分开发和生产模式
  - 返回正确的 API URL

## [x] Task 2: 修改 Electron 主进程启动 API 服务器
- **Priority**: P0
- **Depends On**: None
- **Description**: 
  - 在 `electron/main.ts` 中导入并启动 Express API 服务器
  - 创建 API 服务器启动函数，监听端口 3001（或备用端口）
  - 在 `app.whenReady()` 时启动服务器
  - 在 `app.on('will-quit')` 时优雅关闭服务器
  - 通过 IPC 将实际端口号传递给渲染进程
- **Acceptance Criteria**: 
  - 打包后的应用启动时 API 服务器自动运行
  - 应用关闭时服务器正确停止
  - 端口冲突时自动尝试备用端口

## [x] Task 3: 修改前端 API 客户端配置
- **Priority**: P0
- **Depends On**: [Task 1]
- **Description**: 
  - 修改 `src/services/api/createApiClient.ts`
  - 在创建 axios 实例时根据环境设置正确的 `baseURL`
  - Electron 生产环境使用 `http://localhost:{port}/api`
  - 其他环境保持原有行为
- **Acceptance Criteria**: 
  - Electron 生产环境 API 请求正确发送到本地服务器
  - 开发模式、Web、移动端不受影响

## [x] Task 4: 修改 CSRF 初始化逻辑
- **Priority**: P0
- **Depends On**: [Task 1, Task 3]
- **Description**: 
  - 修改 `src/services/api/client.ts` 中的 `initCsrf` 函数
  - 使用正确的 API URL 获取 CSRF token
  - 添加 Electron 环境下的错误处理
- **Acceptance Criteria**: 
  - Electron 生产环境能正确获取 CSRF token
  - 网络错误时有适当的错误处理

## [x] Task 5: 更新 preload 脚本暴露 API 端口
- **Priority**: P0
- **Depends On**: [Task 2]
- **Description**: 
  - 修改 `electron/preload.ts`
  - 添加 `getApiPort()` IPC 方法
  - 暴露给渲染进程获取实际 API 服务器端口
- **Acceptance Criteria**: 
  - 渲染进程可以获取 API 服务器端口
  - IPC 通信安全可靠

## [x] Task 6: 更新构建配置
- **Priority**: P1
- **Depends On**: [Task 2]
- **Description**: 
  - 检查 `tsconfig.electron.json` 确保正确编译
  - 确保 `package.json` 中的构建配置包含所有必要文件
  - 验证 API 服务器代码正确打包到 ASAR 中
- **Acceptance Criteria**: 
  - 构建产物包含完整的 API 服务器代码
  - 运行时无模块加载错误

## [x] Task 7: 测试验证
- **Priority**: P0
- **Depends On**: [Task 1-6]
- **Description**: 
  - 运行 `npm run electron:dev` 验证开发模式正常
  - 运行 `npm run electron:build` 构建生产版本
  - 安装并运行打包后的应用，验证 API 请求正常
  - 测试登录、图谱加载等核心功能
- **Acceptance Criteria**: 
  - 开发模式无回归
  - 生产构建应用功能正常
  - 无 `ERR_FILE_NOT_FOUND` 错误

# Task Dependencies

- [Task 3] depends on [Task 1]
- [Task 4] depends on [Task 1, Task 3]
- [Task 5] depends on [Task 2]
- [Task 6] depends on [Task 2]
- [Task 7] depends on [Task 1, Task 2, Task 3, Task 4, Task 5, Task 6]
