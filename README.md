# Knowledge Map

一个 AI 驱动的知识管理与学习平台，帮助用户构建、管理和深化知识体系。

## 项目简介

Knowledge Map 是一个功能丰富的知识管理工具，将知识图谱、AI 辅助学习、间隔重复记忆和任务管理融为一体。用户可以通过可视化图谱组织知识，利用 AI 自动扩展知识点、生成学习材料，并通过科学的间隔重复算法进行高效学习。

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
- **PWA 支持** - 离线可用
- **响应式设计** - 完美适配桌面和移动端

## 技术架构

### 前端技术栈

| 技术 | 用途 |
|------|------|
| React 18 + TypeScript | 核心框架 |
| Vite 6 | 构建工具 |
| Tailwind CSS | 样式框架 |
| React Router DOM 7 | 路由管理 |
| Zustand 5 | 状态管理 |
| TanStack Query 5 | 数据请求 |
| Three.js + React Three Fiber | 3D 可视化 |
| D3.js | 图布局算法 |
| Mermaid | 图表渲染 |
| React Markdown + KaTeX | 内容渲染 |
| @dnd-kit | 拖拽交互 |
| Framer Motion | 动画效果 |

### 后端技术栈

| 技术 | 用途 |
|------|------|
| Node.js + Express | API 服务 |
| Supabase (PostgreSQL) | 数据库 |
| Redis | 缓存 |
| BullMQ | 任务队列 |
| Supabase Auth | 用户认证 |
| Swagger | API 文档 |

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

### 环境要求

- Node.js >= 20
- npm 或 pnpm
- Docker（可选，用于 Redis）
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

# Redis 配置
REDIS_URL=redis://localhost:6379

# TTS 服务（可选）
TTS_SERVICE_URL=http://localhost:8001

# 测试账号
TEST_USER_EMAIL=test@example.com
TEST_USER_PASSWORD=test123456
```

4. **启动 Redis（使用 Docker）**

```bash
docker-compose up -d
```

5. **初始化数据库**

```bash
# 重置数据库（应用 schema 和 seed）
npx supabase db reset

# 插入测试数据
npm run db:seed
```

6. **启动开发服务器**

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

| 端点 | 描述 |
|------|------|
| `/api/auth` | 用户认证 |
| `/api/graphs` | 图谱管理 |
| `/api/nodes` | 节点操作 |
| `/api/ai` | AI 功能 |
| `/api/study` | 学习系统 |
| `/api/scheduler` | 任务调度 |
| `/api/search` | 搜索功能 |
| `/api/backup` | 数据备份 |

## 开发指南

### 项目结构

```
KnowledgeMap/
├── api/                    # 后端 API
│   ├── routes/            # API 路由
│   ├── services/          # 业务逻辑
│   ├── middleware/        # 中间件
│   └── utils/             # 工具函数
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
npm run dev              # 同时启动前端和后端
npm run client:dev       # 仅启动前端
npm run server:dev       # 仅启动后端

# 构建
npm run build            # 生产构建
npm run preview          # 预览构建结果

# 代码质量
npm run lint             # ESLint 检查
npm run check            # TypeScript 类型检查

# 测试
npm test                 # 运行单元测试
npm run test:e2e         # 运行 E2E 测试
npm run test:e2e:ui      # E2E 测试 UI 模式
npm run test:e2e:debug   # E2E 测试调试模式
npm run test:e2e:report  # 查看 E2E 测试报告

# 数据库
npm run db:seed          # 插入测试数据
npm run db:backfill      # 回填向量嵌入
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

### Vercel 部署

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
REDIS_URL=
TTS_SERVICE_URL=
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

**Q: Redis 连接失败？**

A: 检查 Redis 是否启动：
```bash
docker-compose ps
docker-compose up -d
```

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

**Made with ❤️ by Knowledge Map Team**
