# 项目 README 编写计划

## 任务概述
对 Knowledge Map 项目进行全面分析，编写一份结构完整、内容详实的 README 文件。

## 项目分析结果

### 项目背景
- **项目名称**: Knowledge Map (知识图谱)
- **版本**: 1.0.0
- **类型**: 全栈 Web 应用
- **定位**: AI 驱动的知识管理与学习平台

### 核心功能特性

#### 1. 知识图谱编辑器
- 可视化思维导图/知识图谱编辑
- 支持多种布局（树形、时间线、力导向）
- 节点层级管理（root/core/sub/normal/leaf）
- 自定义关系类型和样式
- 图谱导入导出（Markdown, OPML）
- 图谱合并与对比视图

#### 2. AI 智能辅助
- 多 AI 提供商支持（Deepseek、火山引擎、阿里云）
- 知识点自动扩展
- 学习材料生成
- 闪卡自动生成
- 图片识别生成图谱
- AI 助教对话
- RAG 知识库问答

#### 3. 学习系统
- FSRS 间隔重复算法
- 多种卡片类型（问答、选择、判断、填空、论述）
- 学习进度追踪
- 知识点掌握度分析

#### 4. 任务调度器
- 三层反馈队列（Q0/Q1/Q2）
- 番茄钟专注模式
- 任务模板系统
- 每日/每周/每月回顾

#### 5. 成就系统
- 游戏化激励机制
- 经验值与等级
- 周期性任务奖励
- 成就徽章

#### 6. 其他功能
- 数据自动备份
- 主题切换（亮色/暗色）
- PWA 离线支持
- 响应式设计

### 技术架构

#### 前端技术栈
- **框架**: React 18 + TypeScript
- **构建工具**: Vite 6
- **样式**: Tailwind CSS
- **路由**: React Router DOM 7
- **状态管理**: Zustand 5
- **数据请求**: TanStack Query 5
- **3D 可视化**: Three.js + React Three Fiber
- **图布局**: D3.js (d3-force, d3-hierarchy)
- **图表渲染**: Mermaid
- **内容渲染**: React Markdown + KaTeX
- **拖拽**: @dnd-kit
- **动画**: Framer Motion

#### 后端技术栈
- **运行时**: Node.js
- **框架**: Express.js
- **数据库**: PostgreSQL (Supabase)
- **缓存**: Redis
- **任务队列**: BullMQ
- **认证**: Supabase Auth
- **API 文档**: Swagger

#### AI 集成
- **SDK**: OpenAI SDK
- **提供商**: Deepseek、火山引擎、阿里云
- **功能**: 文本生成、向量嵌入、图片理解

#### 数据库特性
- PostgreSQL + Supabase
- pgvector 扩展（向量搜索）
- pg_trgm 扩展（文本搜索）
- 行级安全策略（RLS）

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

### 开发环境要求
- Node.js >= 20
- npm 或 pnpm
- Docker (可选，用于 Redis)
- Supabase CLI (本地开发)

### 安装部署流程

#### 本地开发
1. 克隆项目
2. 安装依赖: `npm install`
3. 配置环境变量
4. 启动 Redis: `docker-compose up -d`
5. 启动开发服务器: `npm run dev`

#### 生产部署
- 前端 + API: Vercel
- 数据库: Supabase Cloud
- 缓存: Redis Cloud 或 Docker

### 测试
- 单元测试: Vitest
- E2E 测试: Playwright
- CI/CD: GitHub Actions

## README 文件结构

### 1. 项目标题与徽章
- 项目名称
- 版本、许可证、构建状态等徽章

### 2. 项目简介
- 一句话描述
- 核心价值主张
- 主要功能亮点

### 3. 功能特性
- 详细功能列表
- 功能截图（如有）

### 4. 技术架构
- 技术栈概览
- 系统架构图（文字描述）

### 5. 快速开始
- 环境要求
- 安装步骤
- 配置说明

### 6. 使用指南
- 基本操作
- 核心功能使用

### 7. API 文档
- API 概览
- 主要端点

### 8. 开发指南
- 项目结构
- 开发命令
- 代码规范

### 9. 部署说明
- Vercel 部署
- 环境变量配置

### 10. 常见问题
- 安装问题
- 配置问题
- 使用问题

### 11. 贡献指南
- 如何贡献
- 代码规范

### 12. 许可证
- MIT 或其他

## 实施步骤

1. 创建 README.md 文件
2. 按照上述结构编写各章节
3. 确保内容准确反映项目现状
4. 添加必要的代码示例和命令
5. 检查格式和链接
