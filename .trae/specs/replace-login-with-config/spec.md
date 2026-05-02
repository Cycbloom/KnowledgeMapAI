# 替换登录页为配置页 Spec

## Why

桌面应用发布后，用户连接的是自己的 Supabase 数据库，没有中心化的登录服务器。传统的邮箱/密码登录流程不适用，需要将登录页替换为"连接配置"页面，让用户首次使用时配置 Supabase 连接和 AI 服务。

## What Changes

- **BREAKING** 将 `/login` 路由从登录页面改为配置页面，包含"连接 Supabase"和"配置 AI 服务"两个卡片
- 移除 `/register` 路由（注册功能不再需要）
- 修改 `ProtectedRoute` 逻辑：未配置时跳转 `/login`（配置页），已配置时直接进入主界面
- 修改 `authConfig.ts`：移除硬编码的云端 Supabase 凭证，生产环境默认为空
- 修改认证流程：配置 Supabase 连接后，自动使用 Supabase Auth 注册/登录（首次自动创建账号）

## Impact

- Affected specs: 用户配置中心、数据库初始化与用户引导
- Affected code:
  - `src/pages/Login.tsx` — 完全重写为配置页
  - `src/pages/Register.tsx` — 不再使用（可保留文件但移除路由）
  - `src/App.tsx` — 修改路由和 ProtectedRoute 逻辑
  - `src/config/authConfig.ts` — 移除硬编码凭证
  - `src/store/useStore.ts` — 可能需要调整认证逻辑

## ADDED Requirements

### Requirement: 配置页面（替代登录页）

系统 SHALL 提供一个配置页面替代原有的登录页面，包含"连接 Supabase"和"配置 AI 服务"两个配置区域。

#### Scenario: 显示配置页面
- **WHEN** 用户访问 `/login` 路由
- **THEN** 系统应显示配置页面，包含两个卡片区域：
  1. **连接 Supabase** — 输入 Supabase URL、Anon Key、Service Role Key、Database URL
  2. **配置 AI 服务** — 选择 AI 服务商并输入 API Key

#### Scenario: 连接 Supabase
- **WHEN** 用户填写 Supabase 凭证并点击"连接"
- **THEN** 系统应保存配置到本地（localStorage + Electron config.json）
- **AND** 更新 Supabase 客户端配置
- **AND** 调用后端 API 保存配置并检测 Schema 状态
- **AND** 如果 Schema 为空，提示用户初始化数据库
- **AND** 连接成功后自动使用 Supabase Auth 匿名登录或自动注册

#### Scenario: 配置 AI 服务
- **WHEN** 用户选择 AI 服务商并输入 API Key
- **THEN** 系统应保存配置到后端
- **AND** 显示配置成功状态

#### Scenario: 已有配置的用户
- **WHEN** 用户已有保存的 Supabase 配置
- **THEN** 配置页面应自动填充已保存的配置
- **AND** 显示当前连接状态

#### Scenario: 连接失败
- **WHEN** 用户填入的 Supabase 凭证无法连接
- **THEN** 系统应显示明确的错误信息
- **AND** 保留用户输入的内容，允许修改后重试

### Requirement: 自动认证（替代手动登录）

系统 SHALL 在用户配置 Supabase 连接后自动完成认证，无需手动登录。

#### Scenario: 首次连接自动注册
- **WHEN** 用户首次成功连接 Supabase 且数据库已初始化
- **THEN** 系统应自动使用 Supabase Auth 的 `signUp` 创建账号
- **AND** 使用用户输入的邮箱和自定义密码（或自动生成）注册
- **AND** 注册成功后自动登录并跳转主界面

#### Scenario: 再次连接自动登录
- **WHEN** 用户已有 Supabase 账号并成功连接
- **THEN** 系统应自动恢复之前的登录会话
- **AND** 如果会话过期，提示用户重新输入密码登录

#### Scenario: 匿名访问模式
- **WHEN** Supabase 项目未启用邮箱登录
- **THEN** 系统应使用 Supabase 匿名登录（`signInAnonymously`）
- **AND** 用户后续可在设置中绑定邮箱

## MODIFIED Requirements

### Requirement: ProtectedRoute 路由保护

原有行为：未登录时跳转 `/login` 登录页

修改后行为：
1. 检查是否有有效的 Supabase 配置（URL + Anon Key）
2. 如果未配置，跳转 `/login`（配置页）
3. 如果已配置但未认证，尝试恢复会话或自动登录
4. 如果已认证，正常显示页面

### Requirement: authConfig 默认配置

原有行为：生产环境硬编码了特定的 Supabase URL 和 Anon Key

修改后行为：
- 生产环境默认 URL 和 Anon Key 为空字符串
- 用户必须通过配置页面输入
- 开发环境仍使用本地 Supabase 默认值

## REMOVED Requirements

### Requirement: 注册页面
**Reason**: 桌面应用用户使用自己的 Supabase 数据库，不需要中心化注册
**Migration**: 注册功能集成到配置页面的自动认证流程中
