# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- 目标驱动跨图谱 AI 学习路径：输入学习目标由 AI 生成候选路径与变体，后台生成 + SSE 恢复选择，按目标相关性排序候选图谱
- 统一计划体系：学习路径按阶段窗口排上日历（`/api/v1/calendar`），每日学习容量预算控制，阶段窗口显示为日历事件，新增今日学习简报（today brief）
- RAG 稀疏检索：查询改写 + SPLADE 式稀疏向量 + Contextual Retrieval（分块上下文前缀），稀疏/稠密混合检索
- 图谱星图（Graph Map）：AI 后台智能扩展（深度/宽度）与完成通知，域光环空间分区与间距优化
- 移动端构建模式（`npm run mobile:*`）与移动端今日首页仪表盘
- 首页（Dashboard）学习路径排序与逐项启动

### Changed

- 数据库迁移重排为"域文件在前、横切归拢"布局（29–33 为索引/RLS/函数/触发器/授权，34 为调度容量），编号连续
- 学习路径列表/编辑 UI 增强；列表卡片操作改为下拉菜单；删除学习路径改为永久删除
- 调度器默认每日学习容量提升，子任务绑定 `knowledge_point_id`

### Fixed

- E2E 稳定性与 CI 修复：Node 22、better-sqlite3 Node-ABI 预编译、超时调整、若干断言去 flake

## [1.1.0] - 2026-08-06

### Added

- Docker 开发环境：`docker-compose.yml` 编排前端（Vite）和后端（Express）服务，支持热重载开发
- Docker 开发镜像：`docker/dev/backend.Dockerfile`（nodemon 热重载）和 `docker/dev/frontend.Dockerfile`（Vite HMR）
- `.dockerignore` 文件，排除 node_modules、dist 等不必要文件

### Changed

- 开发环境架构：支持 Docker 容器化开发模式（前端 + 后端在容器中运行，宿主机提供 Supabase 服务）
- 更新 `.env.example` 和 `README.md`，添加 Docker 开发环境配置说明

### Removed

- 移除独立的 `supabase-db` 容器（PostgreSQL），由宿主机 Supabase CLI 管理数据库
- 移除 `docker/dev/init.sh` 数据库初始化脚本（不再需要）
- 移除 `docker/dev/.env.example` 过时配置

## [1.0.1] - 2026-07-09

### Changed

- 移除 Vercel 部署相关配置（vercel.json / .vercelignore / VERCEL_ENV_SETUP.md），项目改为纯 Electron 桌面应用分发
- 从 `package.json` 的 `build.extraResources` 移除 `.env.production` 条目，避免构建时因文件缺失而失败
- 移除 `api/app.ts` 中 CORS 允许列表的 Vercel 预览域名正则
- 更新 `.env.example` 注释，移除 Vercel 相关示例

## [1.0.0] - 2025-03-15

### Added

#### 核心功能
- 知识图谱编辑器：支持节点创建、编辑、删除、拖拽布局
- 思维导图视图：多种布局算法（思维导图、树形、时间线）
- 图谱协作功能：支持多用户协作编辑图谱
- 协作者角色权限：Owner、Editor、Viewer 三种角色
- 分享邀请功能：支持通过链接邀请协作者

#### 学习功能
- 学习卡片系统：支持卡片生成、复习、FSRS 算法
- 学习路径管理：创建和管理学习路径
- 测验系统：支持多种题型的测验生成
- 学习统计：学习进度和效果统计

#### 任务调度
- 任务管理：创建、编辑、删除任务
- 任务依赖：支持任务依赖关系
- 番茄钟计时器：专注模式计时
- 任务模板：预设任务模板
- 成就系统：任务完成成就

#### AI 功能
- AI 对话：与 AI 助手对话
- 内容生成：AI 生成学习内容
- RAG 聊天：基于知识库的智能问答
- 文本转图谱：自动从文本生成知识图谱

#### 其他功能
- 用户认证：登录、注册、密码重置
- 数据备份：自动备份和手动备份
- 通知系统：任务提醒和系统通知
- 响应式设计：支持移动端访问

### Technical
- 前端：React 18 + TypeScript + Vite + Tailwind CSS
- 后端：Express + TypeScript
- 数据库：Supabase (PostgreSQL)
- 部署：Vercel
- 测试：Vitest + Playwright
