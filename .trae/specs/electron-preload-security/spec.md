# Electron Preload IPC 安全加固 Spec

## Why
preload.ts 暴露了通用 `ipc` 命名空间（`on/send/invoke`），渲染进程可通过任意 channel 字符串访问所有 IPC 通道，包括数据库操作、配置读写、同步控制等敏感操作。这实质上使 `contextIsolation: true` 的安全保护形同虚设——任何在渲染进程中执行的代码（包括 XSS 攻击代码）都可以调用 `db:query` 读取/修改本地数据库、调用 `config:write` 覆盖用户配置、监听 `sync:statusChanged` 窃取同步状态等。

## What Changes
- 移除 `electronAPI.ipc` 通用命名空间
- 新增 `electronAPI.shell.openExternal(url)` 专用方法替代 `ipc.send("shell:openExternal", url)`
- 修复 `electronConfig.ts` 中冗余的 `ipc.invoke("api:getPort")` 调用，改用已有的 `electronAPI.api.getPort()`
- 在主进程添加 IPC 通道白名单验证（纵深防御）
- 更新 `electron.d.ts` 类型声明

## Impact
- Affected code:
  - `electron/preload.ts` — 移除 ipc 命名空间，新增 shell 命名空间
  - `electron/main.ts` — 添加 IPC 通道白名单验证
  - `src/pages/Login.tsx` — 替换 `electronAPI.ipc.send` 为 `electronAPI.shell.openExternal`
  - `src/pages/SetupWizard.tsx` — 替换 `electronAPI.ipc.send` 为 `electronAPI.shell.openExternal`
  - `src/config/electronConfig.ts` — 替换 `electronAPI.ipc.invoke` 为 `electronAPI.api.getPort`
  - `src/types/electron.d.ts` — 类型同步更新

## ADDED Requirements

### Requirement: Shell 专用 API
系统 SHALL 提供 `electronAPI.shell.openExternal(url)` 方法，仅允许打开 `http://` 或 `https://` 协议的外部链接。

#### Scenario: 打开合法 URL
- **WHEN** 渲染进程调用 `electronAPI.shell.openExternal("https://example.com")`
- **THEN** 系统在默认浏览器中打开该链接

#### Scenario: 拒绝非法协议
- **WHEN** 渲染进程调用 `electronAPI.shell.openExternal("file:///etc/passwd")`
- **THEN** 系统拒绝打开并返回错误

### Requirement: IPC 通道白名单验证
主进程 SHALL 对所有 IPC 通信进行通道白名单验证，拒绝未注册的通道调用。

#### Scenario: 合法通道调用
- **WHEN** 渲染进程通过 preload 暴露的命名空间 API 调用已注册的 IPC 通道
- **THEN** 请求正常处理

#### Scenario: 非法通道调用
- **WHEN** 渲染进程尝试通过任何方式调用未在白名单中的 IPC 通道
- **THEN** 主进程拒绝该请求并记录警告日志

### Requirement: 移除通用 IPC 接口
系统 SHALL NOT 在 preload 中暴露接受任意 channel 字符串的 `ipc.on/send/invoke` 方法。

#### Scenario: 渲染进程无法访问通用 IPC
- **WHEN** 渲染进程尝试访问 `window.electronAPI.ipc`
- **THEN** 该属性为 `undefined`

## MODIFIED Requirements

### Requirement: 外部链接打开
原有通过 `electronAPI.ipc.send("shell:openExternal", url)` 打开外部链接的方式，变更为 `electronAPI.shell.openExternal(url)`。

### Requirement: API 端口获取
原有通过 `electronAPI.ipc.invoke("api:getPort")` 获取端口的方式，变更为使用已有的 `electronAPI.api.getPort()`。

## REMOVED Requirements

### Requirement: 通用 IPC 接口
**Reason**: 安全隐患——允许渲染进程访问任意 IPC 通道，绕过上下文隔离保护
**Migration**: 所有使用 `electronAPI.ipc.*` 的代码迁移到专用命名空间 API
