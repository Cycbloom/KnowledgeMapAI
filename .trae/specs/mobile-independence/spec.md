# 移动端独立运行 - 产品需求文档

## Overview
- **Summary**: 使 KnowledgeMap 移动端应用（基于 Capacitor）能够独立运行，无需依赖连接到电脑上的本地后端服务。移动端将直接连接 Supabase 云数据库进行数据存储和同步，同时保持与桌面端/Web 端的数据同步能力。
- **Purpose**: 解决当前移动端必须与电脑后端在同一局域网内才能使用的限制，让用户可以随时随地使用移动端应用。
- **Target Users**: KnowledgeMap 移动端用户，特别是需要脱离电脑使用的用户。

## Goals
- 移动端应用可以在没有电脑后端的情况下独立运行
- 移动端直接连接 Supabase 云数据库进行所有数据操作
- 保持移动端与桌面端/Web 端的数据同步功能
- 保持现有 AI 功能（使用与桌面端相同的云 API）
- 优化移动端网络状态处理，提供良好的离线体验

## Non-Goals (Out of Scope)
- 不在移动端实现本地后端服务
- 不实现本地 AI 模型运行（继续使用云 AI 服务）
- 不改变桌面端/Web 端的现有架构
- 不实现 P2P 设备间同步（继续通过 Supabase 云同步）

## Background & Context
当前项目架构：
- 桌面端/Web 端：使用 Express 后端 + Supabase 数据库
- 移动端：使用 Capacitor，目前必须连接到电脑上的后端（http://192.168.0.6:3001）
- 已有的基础设施：IndexedDB 离线存储、基础同步服务、Supabase 客户端

本方案将重构移动端架构，使其直接与 Supabase 通信，绕过本地后端。

## Functional Requirements
- **FR-1**: 移动端检测运行环境（Capacitor 或 Web）并自动切换 API 模式
- **FR-2**: 移动端直接使用 Supabase JavaScript SDK 进行数据库操作
- **FR-3**: 移动端支持用户认证（登录/注册），使用 Supabase Auth
- **FR-4**: 移动端保持现有所有功能（知识图谱编辑、学习、任务管理等）
- **FR-5**: 移动端通过 Supabase Realtime 实现与其他设备的实时数据同步
- **FR-6**: 移动端使用与桌面端相同的云 AI API 服务
- **FR-7**: 移动端提供网络状态检测和离线友好的用户体验
- **FR-8**: 移动端在网络恢复时自动同步离线操作

## Non-Functional Requirements
- **NFR-1**: 移动端启动时间不超过 3 秒
- **NFR-2**: 数据库操作响应时间不超过 500ms（网络正常情况下）
- **NFR-3**: 离线状态下仍能查看已缓存的数据
- **NFR-4**: 代码保持与现有架构的一致性，便于维护

## Constraints
- **Technical**: 继续使用 Capacitor 作为移动端框架，使用 Supabase 作为云数据库
- **Business**: 保持与现有桌面端/Web 端的兼容性
- **Dependencies**: Supabase JavaScript SDK、Capacitor Network 插件

## Assumptions
- 用户的移动端设备可以访问互联网（或至少可以访问 Supabase）
- Supabase 服务稳定可用
- 用户已有 Supabase 账户或可以创建新账户
- 现有 AI API 服务可以从移动端直接访问

## Acceptance Criteria

### AC-1: 移动端环境检测与 API 模式切换
- **Given**: 用户在移动端设备上打开应用
- **When**: 应用启动
- **Then**: 应用自动检测是否为 Capacitor 环境，并切换到 Supabase 直接连接模式
- **Verification**: `programmatic`
- **Notes**: 通过检查 `window.Capacitor` 对象是否存在来判断

### AC-2: 用户认证功能
- **Given**: 用户在移动端应用上
- **When**: 用户进行登录或注册操作
- **Then**: 使用 Supabase Auth 完成认证，并保持登录状态
- **Verification**: `programmatic`

### AC-3: 知识图谱数据操作
- **Given**: 用户已登录移动端应用
- **When**: 用户进行创建、编辑、删除知识图谱/节点/边等操作
- **Then**: 数据直接保存到 Supabase 数据库，并实时反映在 UI 上
- **Verification**: `programmatic`

### AC-4: 与桌面端/Web 端数据同步
- **Given**: 用户在桌面端/Web 端修改了数据
- **When**: 用户打开移动端应用（或移动端在前台运行）
- **Then**: 移动端通过 Supabase Realtime 接收更新并同步数据
- **Verification**: `programmatic`

### AC-5: AI 功能正常工作
- **Given**: 用户在移动端使用 AI 相关功能
- **When**: 用户触发 AI 操作（如内容生成、问答等）
- **Then**: 移动端直接调用云 AI API 并正常返回结果
- **Verification**: `programmatic`

### AC-6: 网络状态处理
- **Given**: 用户的移动端设备网络状态发生变化
- **When**: 网络从在线变为离线，或从离线变为在线
- **Then**: 应用显示相应的网络状态提示，离线时使用缓存数据，在线时自动同步
- **Verification**: `human-judgment`

### AC-7: 离线操作同步
- **Given**: 用户在离线状态下进行了数据操作
- **When**: 网络恢复连接
- **Then**: 应用自动将离线操作同步到 Supabase 数据库
- **Verification**: `programmatic`

## Open Questions
- [ ] 是否需要实现移动端专属的 UI 优化？（超出当前范围，但可以作为后续改进）
- [ ] 是否需要支持移动端导出/导入数据功能？
- [ ] Supabase 的 RLS（行级安全）策略是否需要调整以支持移动端？
