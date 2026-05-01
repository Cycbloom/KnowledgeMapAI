# Electron 应用构建与 GitHub Release 发布 Spec

## Why

项目已具备完整的 Electron 桌面应用功能，但尚未成功构建出可安装的安装包并发布到 GitHub。需要解决构建流程中的问题、创建 GitHub Release 工作流，并确保用户可以下载安装使用。

## What Changes

- 新增 GitHub Actions 工作流 `release.yml`，在推送 tag 时自动构建并发布到 GitHub Releases
- 修改 `.env.production`，移除硬编码的敏感凭证（API Key 等），改为占位符或空值（用户通过引导向导自行配置）
- 新增构建前检查脚本，确保构建环境正确
- 修改 `electron/main.ts`，确保打包后的 API 路径和迁移文件路径正确
- 新增 CHANGELOG.md 模板（仅在发布时使用）

## Impact

- Affected specs: 数据库初始化与用户引导（`.env.production` 中的凭证处理）
- Affected code:
  - `.github/workflows/release.yml` — 新增
  - `.env.production` — 修改（移除敏感凭证）
  - `electron/main.ts` — 可能需要调整打包路径
  - `package.json` — 可能需要调整构建脚本

## ADDED Requirements

### Requirement: GitHub Actions Release 工作流

系统 SHALL 提供 GitHub Actions 工作流，在推送版本 tag 时自动构建并发布到 GitHub Releases。

#### Scenario: 推送版本 tag 触发构建
- **WHEN** 推送 `v*.*.*` 格式的 tag（如 `v1.0.0`）
- **THEN** GitHub Actions 应自动触发构建工作流

#### Scenario: 构建 Windows 安装包
- **WHEN** Release 工作流在 Windows runner 上运行
- **THEN** 应执行 `npm run electron:build:win`
- **AND** 生成 NSIS 安装包（`.exe`）和便携版（`.exe`）
- **AND** 安装包文件名格式为 `KnowledgeMap-{version}-{arch}-setup.exe`

#### Scenario: 构建 macOS 安装包
- **WHEN** Release 工作流在 macOS runner 上运行
- **THEN** 应执行 `npm run electron:build:mac`
- **AND** 生成 DMG 和 ZIP 安装包

#### Scenario: 构建 Linux 安装包
- **WHEN** Release 工作流在 Linux runner 上运行
- **THEN** 应执行 `npm run electron:build:linux`
- **AND** 生成 AppImage 和 DEB 安装包

#### Scenario: 发布到 GitHub Releases
- **WHEN** 所有平台构建成功
- **THEN** 应将所有安装包上传到 GitHub Releases
- **AND** Release 标题为版本号（如 `v1.0.0`）
- **AND** Release body 包含更新日志

### Requirement: 生产环境配置安全

系统 SHALL 确保生产构建不包含硬编码的敏感凭证。

#### Scenario: 构建时不包含 API Key
- **WHEN** 执行 Electron 构建
- **THEN** `.env.production` 不应包含任何 AI 服务商的 API Key
- **AND** 仅包含 Supabase 连接所需的占位配置（用户通过引导向导自行配置）

#### Scenario: 用户首次启动配置
- **WHEN** 用户安装后首次启动应用
- **THEN** 应用应检测到未配置状态
- **AND** 引导用户通过 SetupWizard 完成配置

### Requirement: 构建前验证

系统 SHALL 在构建前执行验证确保代码质量。

#### Scenario: 构建前类型检查
- **WHEN** 执行构建命令
- **THEN** 应先运行 `npm run check` 和 `npm run check:electron` 确保无类型错误

#### Scenario: 构建前代码检查
- **WHEN** 执行构建命令
- **THEN** 应先运行 `npm run lint` 确保无代码规范问题

### Requirement: 本地构建与测试流程

系统 SHALL 提供清晰的本地构建和测试流程。

#### Scenario: 本地构建 Windows 安装包
- **WHEN** 开发者在 Windows 上运行 `npm run electron:build:win`
- **THEN** 应在 `release/` 目录生成可安装的 `.exe` 文件
- **AND** 开发者可以运行安装包进行本地测试

#### Scenario: 验证打包后的应用功能
- **WHEN** 开发者安装并启动打包后的应用
- **THEN** 应用应正常启动并显示引导向导（首次启动时）
- **AND** 引导向导应能正确连接 Supabase 并初始化数据库

## MODIFIED Requirements

### Requirement: .env.production 配置

原有行为：`.env.production` 包含硬编码的 Supabase URL、Anon Key、Service Role Key 和多个 AI API Key

修改后行为：
- `.env.production` 仅包含 Supabase 的占位配置（空值或示例值）
- 不包含任何 AI API Key
- 用户通过 SetupWizard 自行配置所有凭证
- 应用首次启动时检测到配置为空，自动跳转引导向导

## REMOVED Requirements

无移除的需求。
