# 桌面应用打包与数据同步 Spec

## Why
用户希望将 KnowledgeMap 应用打包成桌面应用软件，实现本地独立运行，不再依赖云端部署，同时支持电脑和手机端之间的数据同步。

## What Changes
- 使用 Electron 框架将 Web 应用打包为桌面应用
- 实现本地数据库存储（SQLite）替代云端 Supabase
- 添加本地服务器集成（Node.js 后端嵌入）
- 实现跨设备数据同步功能（局域网同步或云同步可选）
- 添加应用安装包构建配置

## Impact
- Affected specs: 数据存储架构、认证系统、API 服务层
- Affected code: 整体架构调整，新增 Electron 主进程、本地数据库层、同步服务

## 架构方案

### 技术选型

#### 桌面应用框架：Electron
- **优势**：成熟稳定、生态丰富、跨平台（Windows/macOS/Linux）
- **与现有技术栈兼容**：项目已使用 Node.js 后端 + React 前端

#### 本地数据库：SQLite
- **优势**：轻量级、无服务器、单文件存储、易于备份
- **替代方案**：保留 Supabase 本地开发模式

#### 数据同步方案
提供两种同步方案供用户选择：

**方案 A：局域网同步**
- 电脑和手机在同一局域网内直接同步
- 无需互联网连接
- 适合隐私敏感场景

**方案 B：云同步（可选）**
- 使用第三方云存储服务（如 Dropbox、坚果云）
- 或自建同步服务器
- 需要互联网连接

### 应用架构

```
┌─────────────────────────────────────────────────────────────┐
│                    Electron 应用                             │
├─────────────────────────────────────────────────────────────┤
│  主进程 (Main Process)                                       │
│  ├── 窗口管理                                                │
│  ├── 本地服务器 (Express)                                    │
│  ├── 数据库服务 (SQLite)                                     │
│  └── 同步服务                                                │
├─────────────────────────────────────────────────────────────┤
│  渲染进程 (Renderer Process)                                 │
│  └── React 应用 (现有前端代码)                               │
└─────────────────────────────────────────────────────────────┘
```

## ADDED Requirements

### Requirement: Electron 应用打包
系统 SHALL 将现有 Web 应用打包为可独立运行的桌面应用程序。

#### Scenario: 应用启动
- **WHEN** 用户启动桌面应用
- **THEN** 系统应自动启动本地服务器并加载前端界面

#### Scenario: 应用关闭
- **WHEN** 用户关闭应用窗口
- **THEN** 系统应优雅关闭本地服务器和数据库连接

### Requirement: 本地数据存储
系统 SHALL 使用 SQLite 作为本地数据库存储用户数据。

#### Scenario: 数据持久化
- **WHEN** 用户创建或修改数据
- **THEN** 系统应将数据保存到本地 SQLite 数据库

#### Scenario: 数据迁移
- **WHEN** 用户首次使用桌面应用
- **THEN** 系统应提供从云端 Supabase 导入数据的选项

### Requirement: 跨设备数据同步
系统 SHALL 支持电脑和手机之间的数据同步。

#### Scenario: 局域网同步
- **WHEN** 手机应用与电脑在同一局域网
- **THEN** 用户可手动触发数据同步

#### Scenario: 同步冲突处理
- **WHEN** 同一数据在多设备被修改
- **THEN** 系统应提示用户选择保留哪个版本或自动合并

### Requirement: 应用安装包
系统 SHALL 提供各平台的安装包。

#### Scenario: Windows 安装
- **WHEN** 用户下载 Windows 安装包
- **THEN** 应提供 NSIS 安装程序或便携版

#### Scenario: macOS 安装
- **WHEN** 用户下载 macOS 安装包
- **THEN** 应提供 DMG 镜像或 App Bundle

### Requirement: 离线使用
系统 SHALL 支持完全离线使用。

#### Scenario: 无网络环境
- **WHEN** 用户在无网络环境下使用应用
- **THEN** 所有核心功能应正常工作（AI 功能除外）

## MODIFIED Requirements

### Requirement: 数据库层抽象
修改现有数据库访问层，支持 SQLite 和 Supabase 双模式。

**原架构**:
```
前端 → API → Supabase (云端)
```

**新架构**:
```
前端 → API → 数据库适配层 → SQLite (本地) 或 Supabase (云端)
```

### Requirement: 认证系统
修改认证系统，支持本地用户账户。

**原认证**:
- Supabase Auth（云端）

**新认证**:
- 本地模式：本地用户账户（密码存储在 SQLite）
- 云端模式：保留 Supabase Auth（可选）

### Requirement: AI 功能
修改 AI 功能调用方式。

**原方式**:
- 直接调用云端 AI API

**新方式**:
- 本地模式：调用云端 AI API（需要网络）
- 提供 API Key 配置界面

## REMOVED Requirements

### Requirement: Vercel 部署支持
**Reason**: 桌面应用不需要 Vercel 部署
**Migration**: 移除 Vercel 相关配置，保留作为可选的 Web 版本部署方式

## 文件结构规划

```
electron/
├── main.ts                 # Electron 主进程入口
├── preload.ts              # 预加载脚本
├── database/
│   ├── connection.ts       # SQLite 连接管理
│   ├── migrations/         # 数据库迁移文件
│   └── seeds/              # 初始数据
├── services/
│   ├── syncService.ts      # 数据同步服务
│   ├── backupService.ts    # 备份服务
│   └── serverService.ts    # 本地服务器管理
└── utils/
    ├── windowManager.ts    # 窗口管理
    └── trayManager.ts      # 系统托盘
```

## 手机端方案

### 方案 A：React Native 应用
- 共享业务逻辑代码
- 需要额外开发工作

### 方案 B：PWA + 移动端优化
- 利用现有 PWA 配置
- 较低成本实现

### 方案 C：响应式 Web + 同步服务
- 手机通过浏览器访问电脑上的同步服务
- 最简单的实现方式

## 构建配置

### electron-builder 配置
```json
{
  "build": {
    "appId": "com.knowledgemap.app",
    "productName": "KnowledgeMap",
    "directories": {
      "output": "release"
    },
    "files": [
      "dist/**/*",
      "electron/**/*"
    ],
    "win": {
      "target": ["nsis", "portable"]
    },
    "mac": {
      "target": ["dmg", "zip"]
    },
    "linux": {
      "target": ["AppImage", "deb"]
    }
  }
}
```

## 风险评估

| 风险 | 影响 | 缓解措施 |
|------|------|----------|
| SQLite 性能限制 | 中 | 优化查询、添加索引 |
| 同步冲突 | 高 | 实现冲突检测和解决机制 |
| 应用体积过大 | 低 | 代码分割、资源压缩 |
| 跨平台兼容性 | 中 | 充分测试各平台 |
