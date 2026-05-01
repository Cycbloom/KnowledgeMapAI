# Tasks

- [x] Task 1: 清理 `.env.production` 敏感凭证
  - [x] SubTask 1.1: 将 `.env.production` 中的 AI API Key 移除（DEEPSEEK_API_KEY、VOLCENGINE_API_KEY、ALIYUN_API_KEY 及对应的 VITE_ 前缀变量）
  - [x] SubTask 1.2: 将 Supabase URL、Anon Key、Service Role Key 改为空值占位符
  - [x] SubTask 1.3: 从 `.gitignore` 中移除 `.env.production`，确保被 git 跟踪

- [x] Task 2: 修复 Electron 构建配置
  - [x] SubTask 2.1: 修复 `electron/main.ts` 中 `process.mainModule` 弃用问题，改用 `app.isPackaged`
  - [x] SubTask 2.2: 修复迁移服务在打包后的导入路径（使用 `process.resourcesPath`）
  - [x] SubTask 2.3: 优化 `package.json` 中 `files` 配置，移除重复打包（`dist-electron/api` 和 `dist-electron/shared` 只在 `extraResources` 中）
  - [x] SubTask 2.4: 修复 `taskService.ts` 和 `activities.ts` 中的预存类型错误

- [x] Task 3: 新增 GitHub Actions Release 工作流
  - [x] SubTask 3.1: 创建 `.github/workflows/release.yml`，在推送 `v*.*.*` tag 时触发
  - [x] SubTask 3.2: 配置 Windows 构建 job（windows-latest, npm run electron:build:win）
  - [x] SubTask 3.3: 配置 macOS 构建 job（macos-latest, npm run electron:build:mac）
  - [x] SubTask 3.4: 配置 Linux 构建 job（ubuntu-latest, npm run electron:build:linux）
  - [x] SubTask 3.5: 配置 Release 发布步骤，上传所有构建产物到 GitHub Releases
  - [x] SubTask 3.6: 配置构建前的类型检查和 lint 验证步骤

- [x] Task 4: 本地构建测试
  - [x] SubTask 4.1: 运行 `npm run check` 和 `npm run check:electron` 确保无类型错误
  - [x] SubTask 4.2: 运行 `npm run lint` 确保无代码规范问题
  - [x] SubTask 4.3: 运行 `npm run electron:build:win` 执行本地构建
  - [x] SubTask 4.4: 验证 `release/` 目录生成了安装包文件

# Task Dependencies

- [Task 2] depends on [Task 1]
- [Task 3] depends on [Task 1]
- [Task 4] depends on [Task 1, Task 2]
