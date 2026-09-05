# Knowledge Map

<div align="center">

[![Version](https://img.shields.io/badge/version-1.0.1-blue.svg)](https://github.com/Cycbloom/KnowledgeMapAI)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js](https://img.shields.io/badge/Node.js->=20-green.svg)](https://nodejs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.8-blue.svg)](https://www.typescriptlang.org/)

**AI 驱动的知识管理与学习平台**

[功能特性](#功能特性) • [快速开始](#快速开始) • [文档导航](#文档导航) • [技术栈](#技术栈)

</div>

---

## 项目简介

Knowledge Map 是一个功能丰富的知识管理工具，将知识图谱、AI 辅助学习、间隔重复记忆和任务管理融为一体。用户可以通过可视化图谱组织知识，利用 AI 自动扩展知识点、生成学习材料，并通过科学的间隔重复算法进行高效学习。

**目标平台：** 本项目以 **Electron 桌面应用** 为主要开发和发布目标，同时支持 Web 端和移动端（Android）访问。

**核心价值：**

- 🧠 **知识图谱化** - 以可视化方式组织和关联知识
- 🤖 **AI 智能辅助** - 自动扩展知识点、生成学习材料
- 📚 **科学学习** - 基于 FSRS 算法的间隔重复学习
- ⏱️ **高效管理** - 三层反馈队列任务调度系统
- 🎮 **游戏激励** - 成就系统与经验值机制

## 功能特性

### 📊 知识图谱编辑器
可视化拖拽式编辑界面，支持树形、时间线、力导向等多种布局，节点层级管理（root/core/sub/normal/leaf），自定义关系类型与样式，Markdown/OPML 导入导出，图谱合并对比，以及基于 Three.js 的 3D 知识星球视图。

### 🤖 AI 智能辅助
支持 Deepseek、火山引擎、阿里云多提供商，AI 自动扩展知识点、生成学习材料与闪卡（问答、选择、判断、填空等），图片识别生成图谱，对话式 AI 助教，以及基于知识库的 RAG 语义问答。

### 📚 学习系统
基于先进的 FSRS 间隔重复算法，支持问答、选择、判断、填空、论述题等多种卡片类型，可视化学习进度追踪和详细的学习数据分析。

### 🗺️ 学习路径与统一计划
目标驱动的跨图谱 AI 学习路径：输入学习目标后由 AI 生成候选路径，按阶段窗口排上日历（每日学习容量预算控制），与任务调度器、FSRS 复习打断形成统一计划体系。

### ⏱️ 任务调度器
三层反馈队列（Q0 专注 / Q1 标准 / Q2 后台），内置番茄钟专注计时器，任务模板快速创建，以及每日、每周、每月周期回顾。

### 🏆 成就系统
游戏化经验值等级成长体系，多维度成就徽章解锁，以及周期性任务完成奖励。

### 🛠️ 其他功能
自动备份与恢复，亮色/暗色主题切换，跨平台 Electron 原生体验，应用静默自动更新，本地数据缓存支持离线使用，响应式设计适配桌面和移动端。

## 快速开始

### 方式一：本地开发（推荐 Electron）

```bash
# 1. 克隆项目
git clone https://github.com/Cycbloom/KnowledgeMapAI.git
cd KnowledgeMapAI

# 2. 安装依赖
npm install

# 3. 配置环境
cp .env.example .env.development
# 编辑 .env.development 填写必要配置，然后运行：
npm run check:env  # 校验环境变量

# 4. 启动开发
npm run db:local:start    # 启动本地数据库
npm run db:local:reset    # 初始化数据库（首次）
npm run electron:dev      # 启动 Electron 桌面应用开发模式
```

访问 http://localhost:5173 即可使用（Web 模式可用 `npm run dev`）。

### 方式二：Docker 开发（Web 模式）

前端和后端运行在 Docker 容器中（支持热重载），宿主机运行 `supabase start` 提供本地 Supabase 服务。

```bash
# 1. 前置条件：宿主机安装 Supabase CLI 并启动
supabase start

# 2. 配置环境
cp .env.example .env
# 编辑 .env 填写 Supabase 和其他必要配置
# 开发模式：VITE_SUPABASE_URL=http://host.docker.internal:54321

# 3. 首次构建（后续无需 --no-cache）
docker-compose build --no-cache

# 4. 启动服务
docker-compose up -d

# 5. 查看日志
docker-compose logs -f
```

- 前端：http://localhost:5173
- 后端 API：http://localhost:3001
- Supabase API 网关：http://localhost:54321
- Supabase Studio：http://localhost:54323（宿主机直接访问）
- 前端 API 代理：通过 Vite proxy 自动转发 `/api` 请求到后端

**生产环境部署：**
Docker 容器连接远程 Supabase 实例：

```bash
# 修改 .env 中的 VITE_SUPABASE_URL 为远程地址
VITE_SUPABASE_URL=https://你的项目.supabase.co
```

### 环境要求

- **本地开发**：Node.js >= 20、npm、Supabase CLI
- **Docker 开发**：Docker Desktop

## 文档导航

| 文档                                          | 说明                                           |
| --------------------------------------------- | ---------------------------------------------- |
| [DEVELOPMENT.md](DEVELOPMENT.md)              | 完整开发指南（环境配置、架构、调试、规范）     |
| [CONTRIBUTING.md](CONTRIBUTING.md)            | 贡献流程与代码规范                             |
| [docs/code-wiki.md](docs/code-wiki.md)        | 代码维基（全项目架构、路由表、Schema 总览）    |
| [docs/testing-guidelines.md](docs/testing-guidelines.md) | 测试规范与最佳实践                   |
| [.trae/rules/](.trae/rules/)                  | 项目规则（API 命名、数据库规范等）             |

## 技术栈

### 应用架构

本项目采用 **Electron + Web** 双端架构，以 Electron 桌面应用为主要发布形式：

| 平台                  | 描述                                                           |
| --------------------- | -------------------------------------------------------------- |
| **Electron 桌面应用** | 主要目标平台，支持 Windows、macOS、Linux                       |
| **Web 应用**          | 支持浏览器访问，便于快速预览和开发调试                         |
| **移动端 (Android)**  | 基于 Capacitor 构建，直接连接 Supabase，支持离线存储和实时同步 |

### 前端技术栈

| 技术                         | 用途       |
| ---------------------------- | ---------- |
| React 18 + TypeScript        | 核心框架   |
| Vite 6                       | 构建工具   |
| Tailwind CSS                 | 样式框架   |
| React Router DOM 7           | 路由管理   |
| Zustand 5                    | 状态管理   |
| TanStack Query 5             | 数据请求   |
| Three.js + React Three Fiber | 3D 可视化  |
| D3.js                        | 图布局算法 |
| Mermaid                      | 图表渲染   |
| React Markdown + KaTeX       | 内容渲染   |
| @dnd-kit                     | 拖拽交互   |
| Framer Motion                | 动画效果   |

### 后端技术栈

| 技术                  | 用途     |
| --------------------- | -------- |
| Node.js + Express     | API 服务 |
| Supabase (PostgreSQL) | 数据库   |
| Supabase Auth         | 用户认证 |
| Swagger               | API 文档 |

### Electron 桌面端

| 技术             | 用途               |
| ---------------- | ------------------ |
| Electron         | 跨平台桌面应用框架 |
| electron-builder | 应用打包与分发     |
| electron-updater | 自动更新机制       |

### AI 集成

- **SDK**: OpenAI SDK
- **提供商**: Deepseek、火山引擎、阿里云
- **功能**: 文本生成、向量嵌入、图片理解

### 数据库特性

- PostgreSQL + Supabase
- pgvector 扩展（向量相似度搜索）
- pg_trgm 扩展（全文搜索）
- 行级安全策略（RLS）

## 许可证

本项目采用 MIT 许可证 - 详见 [LICENSE](LICENSE) 文件。

---

<div align="center">

**Made with ❤️ by [KnowledgeMap Team](https://github.com/Cycbloom)**

[⬆ 返回顶部](#knowledge-map)

</div>
