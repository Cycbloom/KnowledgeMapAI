# Tasks

- [x] Task 1: 在 preload.ts 中新增 `shell.openExternal` 专用方法，移除 `ipc` 命名空间
  - [x] 1.1: 新增 `shell: { openExternal: (url: string) => ipcRenderer.invoke("shell:openExternal", url) }` 命名空间
  - [x] 1.2: 删除 `ipc` 命名空间（`on`/`send`/`invoke` 三个方法）
  - [x] 1.3: 确认 `electronAPI` 类型导出同步更新

- [x] Task 2: 修改主进程 `shell:openExternal` 处理器，从 `ipcMain.on` 改为 `ipcMain.handle`
  - [x] 2.1: 将 `main.ts` 中的 `ipcMain.on("shell:openExternal", ...)` 改为 `ipcMain.handle("shell:openExternal", ...)`
  - [x] 2.2: 增强协议校验，拒绝非 `http://`/`https://` 协议的 URL 并返回错误

- [x] Task 3: 在主进程添加 IPC 通道白名单验证（纵深防御）
  - [x] 3.1: 定义允许的 IPC 通道白名单常量
  - [x] 3.2: 在 `ipcMain.handle` 和 `ipcMain.on` 上添加全局验证中间件，拒绝白名单外的通道
  - [x] 3.3: 非法通道调用时记录警告日志

- [x] Task 4: 迁移渲染进程中的 `electronAPI.ipc` 调用
  - [x] 4.1: `src/pages/Login.tsx` — 将 `electronAPI.ipc.send("shell:openExternal", url)` 改为 `electronAPI.shell.openExternal(url)`
  - [x] 4.2: `src/pages/SetupWizard.tsx` — 将 `electronAPI.ipc.send("shell:openExternal", url)` 改为 `electronAPI.shell.openExternal(url)`
  - [x] 4.3: `src/config/electronConfig.ts` — 将 `electronAPI.ipc.invoke("api:getPort")` 改为 `electronAPI.api.getPort()`

- [x] Task 5: 更新类型声明
  - [x] 5.1: 确认 `src/types/electron.d.ts` 通过 `import { ElectronAPI } from '../electron/preload'` 自动同步类型
  - [x] 5.2: 检查并修复所有因移除 `ipc` 命名空间导致的 TypeScript 编译错误

# Task Dependencies
- [Task 2] depends on [Task 1] — 主进程处理器需与 preload 接口同步变更
- [Task 4] depends on [Task 1] — 渲染进程迁移依赖新 API 可用
- [Task 5] depends on [Task 1, Task 4] — 类型检查需所有代码变更完成后验证
- [Task 3] 独立于其他 Task，可并行执行
