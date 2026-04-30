# Knowledge Map

<div align="center">

[![Version](https://img.shields.io/badge/version-1.0.0-blue.svg)](https://github.com/knowledgemap/knowledgemap-app)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js](https://img.shields.io/badge/Node.js->=20-green.svg)](https://nodejs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.8-blue.svg)](https://www.typescriptlang.org/)

**AI 驱动的知识管理与学习平台**

[功能特性](#功能特性) • [快速开始](#快速开始) • [安装](#安装步骤) • [使用指南](#使用指南) • [开发](#开发指南)

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

- **可视化编辑** - 直观的拖拽式图谱编辑界面
- **多种布局** - 支持树形、时间线、力导向等多种布局方式
- **层级管理** - 节点层级系统（root/core/sub/normal/leaf）
- **关系定制** - 自定义关系类型、颜色、线型
- **导入导出** - 支持 Markdown、OPML 格式
- **图谱合并** - 多图谱对比与合并视图
- **3D 视图** - 基于 Three.js 的 3D 知识星球视图

### 🤖 AI 智能辅助

- **多提供商支持** - Deepseek、火山引擎、阿里云
- **知识扩展** - AI 自动推荐相关知识点
- **材料生成** - 自动生成详细的学习材料
- **闪卡生成** - 支持问答、选择、判断、填空等多种卡片类型
- **图片识别** - 从图片中提取知识生成图谱
- **AI 助教** - 智能对话式学习辅导
- **RAG 问答** - 基于知识库的语义搜索问答

### 📚 学习系统

- **FSRS 算法** - 先进的间隔重复记忆算法
- **多种卡片** - 问答、选择、判断、填空、论述题
- **进度追踪** - 可视化学习进度和掌握度
- **学习统计** - 详细的学习数据分析

### ⏱️ 任务调度器

- **三层队列** - Q0（专注）、Q1（标准）、Q2（后台）反馈队列
- **番茄钟** - 内置专注计时器
- **任务模板** - 快速创建常用任务
- **周期回顾** - 每日、每周、每月学习回顾

### 🏆 成就系统

- **经验值等级** - 游戏化成长体系
- **成就徽章** - 多维度成就解锁
- **周期奖励** - 周期性任务完成奖励

### 🛠️ 其他功能

- **自动备份** - 定时数据备份与恢复
- **主题切换** - 亮色/暗色主题
- **跨平台桌面应用** - 基于 Electron 的原生桌面体验
- **自动更新** - 应用静默自动更新
- **离线支持** - 本地数据缓存，支持离线使用
- **响应式设计** - 完美适配桌面和移动端

## 技术架构

### 应用架构

本项目采用 **Electron + Web** 双端架构，以 Electron 桌面应用为主要发布形式：

| 平台                  | 描述                                                           |
| --------------------- | -------------------------------------------------------------- |
| **Electron 桌面应用** | 主要目标平台，支持 Windows、macOS、Linux                       |
| **Web 应用**          | 支持浏览器访问，便于快速预览和开发调试                         |
| **移动端 (Android)**  | 基于 Capacitor 构建，直接连接 Supabase，支持离线存储和实时同步 |

### 桌面应用特性

- **跨平台支持** - 一套代码，支持 Windows、macOS、Linux 三大平台
- **自动更新** - 基于 electron-updater 的静默自动更新
- **原生体验** - 系统托盘、原生窗口控制、桌面通知
- **离线支持** - 本地数据缓存，支持离线使用
- **崩溃报告** - 自动收集和上报崩溃信息

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

## 快速开始

### 一键启动（推荐新手）

```bash
# 1. 克隆项目
git clone https://github.com/knowledgemap/knowledgemap-app.git
cd knowledgemap-app

# 2. 安装依赖
npm install

# 3. 复制环境配置
cp .env.example .env.development

# 4. 启动本地数据库（需要 Docker）
npm run db:local:start

# 5. 初始化数据库
npm run db:local:reset

# 6. 启动开发服务器
npm run dev
```

访问 http://localhost:5173 即可使用。

### 环境要求

- Node.js >= 20
- npm 或 pnpm
- Supabase CLI（本地开发）

### 安装步骤

1. **克隆项目**

```bash
git clone <repository-url>
cd KnowledgeMap
```

2. **安装依赖**

```bash
npm install
```

3. **配置环境变量**

复制 `.env.example` 为 `.env` 并填写必要配置：

```bash
cp .env.example .env
```

必需的环境变量：

```env
# Supabase 配置
VITE_SUPABASE_URL=your_supabase_project_url
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key

# AI 配置（至少配置一个）
DEEPSEEK_API_KEY=your_deepseek_key
VOLCENGINE_API_KEY=your_volcengine_key
ALIYUN_API_KEY=your_aliyun_key

# 测试账号
TEST_USER_EMAIL=test@example.com
TEST_USER_PASSWORD=test123456
```

4. **初始化数据库**

```bash
# 重置数据库（应用 schema 和 seed）
npx supabase db reset

# 插入测试数据
npm run db:seed
```

5. **启动开发服务器**

```bash
npm run dev
```

访问 http://localhost:5173 开始使用。

### 安装 Playwright 浏览器（用于 E2E 测试）

```bash
npx playwright install
```

## 使用指南

### 基本操作

1. **注册/登录** - 创建账号或使用测试账号登录
2. **创建图谱** - 在 Dashboard 点击"新建图谱"
3. **编辑节点** - 双击节点编辑内容，拖拽调整位置
4. **AI 扩展** - 选中节点后使用 AI 功能扩展知识点
5. **生成卡片** - 为知识点生成学习卡片
6. **开始学习** - 进入学习模式复习卡片

### 核心功能

#### 知识图谱编辑

- **添加节点**: 双击空白区域或使用快捷键
- **连接节点**: 从节点边缘拖拽到目标节点
- **AI 扩展**: 右键菜单选择"AI 扩展"
- **导出**: 支持导出为 Markdown 或图片

#### 学习模式

- 进入"学习"页面开始复习
- 根据记忆程度评分（1-4）
- 系统自动安排下次复习时间

#### 任务调度

- 在"调度器"中管理任务
- 拖拽任务到不同优先级队列
- 使用番茄钟专注完成

## API 文档

启动服务后访问 Swagger 文档：http://localhost:3001/api-docs

### 主要 API 端点

| 端点             | 描述     |
| ---------------- | -------- |
| `/api/auth`      | 用户认证 |
| `/api/graphs`    | 图谱管理 |
| `/api/nodes`     | 节点操作 |
| `/api/ai`        | AI 功能  |
| `/api/study`     | 学习系统 |
| `/api/scheduler` | 任务调度 |
| `/api/search`    | 搜索功能 |
| `/api/backup`    | 数据备份 |

## 开发指南

### 项目结构

```
KnowledgeMap/
├── api/                    # 后端 API
│   ├── routes/            # API 路由
│   ├── services/          # 业务逻辑
│   ├── middleware/        # 中间件
│   └── utils/             # 工具函数
├── electron/              # Electron 桌面端
│   ├── main.ts            # 主进程入口
│   ├── preload.ts         # 预加载脚本
│   └── utils/             # Electron 工具函数
├── src/                   # 前端源码
│   ├── components/        # React 组件
│   ├── pages/             # 页面组件
│   ├── hooks/             # 自定义 Hooks
│   ├── services/          # API 服务
│   ├── store/             # Zustand 状态
│   └── utils/             # 工具函数
├── supabase/              # 数据库配置
│   └── migrations/        # 数据库迁移
├── tests/                 # 测试文件
└── public/                # 静态资源
```

### 开发命令

```bash
# 开发
npm run dev              # 同时启动前端和后端（Web 模式）
npm run client:dev       # 仅启动前端
npm run server:dev       # 仅启动后端
npm run electron:dev     # 启动 Electron 桌面应用开发模式

# 构建
npm run build            # Web 生产构建
npm run build:electron   # Electron 构建准备
npm run electron:build   # 构建所有平台 Electron 应用
npm run electron:build:win   # 构建 Windows 应用
npm run electron:build:mac   # 构建 macOS 应用
npm run electron:build:linux # 构建 Linux 应用
npm run preview          # 预览构建结果

# 代码质量
npm run lint             # ESLint 检查
npm run check            # TypeScript 类型检查
npm run check:electron   # Electron TypeScript 类型检查

# 测试
npm test                 # 运行单元测试
npm run test:e2e         # 运行 E2E 测试
npm run test:e2e:ui      # E2E 测试 UI 模式
npm run test:e2e:debug   # E2E 测试调试模式
npm run test:e2e:report  # 查看 E2E 测试报告

# 数据库
npm run db:seed          # 插入测试数据
npm run db:backfill      # 回填向量嵌入

# 移动端
npm run mobile:build     # 构建移动端应用
npm run mobile:sync      # 构建并同步到 Capacitor
npm run mobile:run       # 运行 Android 应用
npm run mobile:build:release # 构建 Android 发布版 APK
npm run mobile:test      # 运行移动端测试
```

### 代码规范

- 使用 TypeScript 严格模式
- 遵循 ESLint 配置
- 组件使用函数式组件 + Hooks
- 状态管理使用 Zustand
- 数据请求使用 TanStack Query

### 数据库修改流程

项目采用直接修改 schema 文件的方式：

1. 修改 `supabase/migrations/00000000000000_initial_schema.sql`
2. 运行 `npx supabase db reset`
3. 运行 `npm run db:seed`

## 部署说明

### Electron 桌面应用发布

**构建流程：**

1. 确保代码通过所有检查

   ```bash
   npm run check
   npm run check:electron
   npm run lint
   ```

2. 构建应用

   ```bash
   npm run electron:build:win    # Windows
   npm run electron:build:mac    # macOS
   npm run electron:build:linux  # Linux
   ```

3. 构建产物位于 `release/` 目录

**发布流程：**

1. 在 GitHub 创建新 Release
2. 上传构建产物到 Release
3. electron-updater 会自动检测并推送更新

### Web 端部署（Vercel）

1. 连接 GitHub 仓库到 Vercel
2. 配置环境变量
3. 部署

### 环境变量配置

生产环境需要配置以下变量：

```env
VITE_SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
DEEPSEEK_API_KEY=
VOLCENGINE_API_KEY=
ALIYUN_API_KEY=
```

### 数据库

推荐使用 Supabase Cloud 托管 PostgreSQL 数据库。

## 常见问题

### 安装问题

**Q: npm install 失败？**

A: 尝试清除缓存后重新安装：

```bash
rm -rf node_modules package-lock.json
npm cache clean --force
npm install
```

**Q: Playwright 浏览器安装失败？**

A: 使用系统包管理器安装依赖：

```bash
npx playwright install-deps
npx playwright install
```

### 配置问题

**Q: AI 功能不工作？**

A: 确保至少配置了一个 AI 提供商的 API Key。

### 使用问题

**Q: 如何导入已有知识？**

A: 支持 Markdown 和 OPML 格式导入，在 Dashboard 点击"导入"按钮。

**Q: 数据会丢失吗？**

A: 系统支持自动备份，可在设置中配置备份频率。

## 贡献指南

欢迎贡献代码！请遵循以下步骤：

1. Fork 本仓库
2. 创建功能分支 (`git checkout -b feature/amazing-feature`)
3. 提交更改 (`git commit -m 'feat: add amazing feature'`)
4. 推送到分支 (`git push origin feature/amazing-feature`)
5. 创建 Pull Request

### 提交前检查

```bash
npm run check    # 类型检查
npm run lint     # 代码检查
npm run test:ci  # 运行所有测试
```

## 许可证

本项目采用 MIT 许可证 - 详见 [LICENSE](LICENSE) 文件。

---

<div align="center">

**Made with ❤️ by [KnowledgeMap Team](https://github.com/knowledgemap)**

[⬆ 返回顶部](#knowledge-map)

</div>
