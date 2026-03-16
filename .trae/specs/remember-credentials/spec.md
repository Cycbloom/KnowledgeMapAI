# 记住账号密码功能 Spec

## Why
用户每次登录都需要手动输入邮箱和密码，体验不够便捷。添加"记住账号密码"功能可以让用户勾选后，下次访问登录页面时自动填充账号密码，提升用户体验。

## What Changes
- 在登录表单中添加"记住账号密码"复选框
- 勾选后保存用户邮箱和密码到本地存储
- 页面加载时自动填充已保存的账号密码
- 取消勾选时清除已保存的账号密码

## Impact
- Affected specs: 登录功能
- Affected code: `src/pages/Login.tsx`

## ADDED Requirements

### Requirement: 记住账号密码功能
系统应提供"记住账号密码"功能，允许用户选择保存登录凭据以便下次自动填充。

#### Scenario: 用户勾选记住账号密码并登录成功
- **WHEN** 用户勾选"记住账号密码"复选框并成功登录
- **THEN** 系统应将用户的邮箱和密码安全地保存到本地存储

#### Scenario: 用户取消勾选记住账号密码
- **WHEN** 用户取消勾选"记住账号密码"复选框
- **THEN** 系统应清除本地存储中保存的账号密码

#### Scenario: 用户再次访问登录页面
- **WHEN** 用户访问登录页面且本地存储中有保存的账号密码
- **THEN** 系统应自动填充邮箱和密码字段
- **AND** "记住账号密码"复选框应显示为已勾选状态

#### Scenario: 用户登录失败
- **WHEN** 用户登录失败
- **THEN** 系统不应保存账号密码到本地存储

### Requirement: 安全存储
系统应安全地存储用户的登录凭据。

#### Scenario: Web 端存储
- **WHEN** 应用运行在 Web 环境
- **THEN** 系统应使用 localStorage 存储账号密码
- **AND** 密码应进行 Base64 编码（基础混淆，非加密）

#### Scenario: Electron 桌面端存储
- **WHEN** 应用运行在 Electron 环境
- **THEN** 系统应优先使用 Electron 的安全存储机制（如 electron-store）
- **AND** 密码应进行加密存储

## MODIFIED Requirements
无

## REMOVED Requirements
无
