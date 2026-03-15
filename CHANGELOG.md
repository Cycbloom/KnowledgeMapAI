# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
