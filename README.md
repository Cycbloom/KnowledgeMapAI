# Knowledge Map AI v1.0

Knowledge Map AI 是一个现代化的 3D 知识图谱编辑器与 AI 辅助学习平台。它结合了 Three.js 的可视化能力和生成式 AI 的智能辅助，帮助用户以全新的视角构建知识体系、深入学习复杂概念。

![License](https://img.shields.io/badge/license-MIT-blue.svg)
![Version](https://img.shields.io/badge/version-1.0.0-green.svg)

## 🌟 核心特性 (Features)

### 1. 3D 知识图谱可视化
- **沉浸式视图**: 使用 Three.js 和力导向布局 (`d3-force-3d`) 展示复杂的知识网络。
- **动态交互**: 支持节点的拖拽、缩放、旋转、点击展开和双击编辑。
- **层级渲染**: 自动区分根节点、核心概念、子知识点，通过颜色和大小直观呈现知识结构。

### 2. AI 智能辅助 (AI-Powered)
- **多模态输入生成**:
  - **文本转图谱**: 输入一段文本，AI 自动提取概念并构建关系网。
  - **图片转图谱**: 上传板书、思维导图图片，智能识别并转换。
  - **URL 解析**: 输入文章链接，自动总结并生成图谱。
  - **文档解析**: 支持 PDF、Markdown、OPML 文件的直接导入。
- **AI 助教**: 在学习模式中，内置 AI 导师随时解答疑问，提供深度解释。

### 3. 闯关式学习模式 (Learning Mode)
- **智能学习路径**: 自动将网状知识转化为线性的、循序渐进的学习路径。
- **深度教材生成**: 针对每个知识节点，AI 自动生成结构化的学习教材。
- **自动化测试**: 系统根据学习内容自动生成单选题、多选题、填空题等，检验学习成果。
- **游戏化进度**: 完成节点学习和测试后解锁下一关，获得成就感。

### 4. 离线与移动端支持 (PWA)
- **响应式设计**: 完美适配桌面端、平板和手机。
- **离线可用**: 支持安装为桌面/手机应用 (PWA)，离线状态下可查看已缓存图谱和本地文件。
- **网络自适应**: 智能检测网络状态，在离线时自动降级 AI 功能并给出友好提示。

## 🛠 技术栈 (Tech Stack)

### 前端 (Frontend)
- **核心框架**: React 18, Vite 5, TypeScript
- **3D 引擎**: Three.js, @react-three/fiber, @react-three/drei
- **状态管理**: Zustand, TanStack Query (React Query)
- **UI 组件**: Tailwind CSS, Radix UI, Lucide React, Framer Motion
- **工具库**: d3-force-3d, html2canvas, jspdf
- **PWA**: vite-plugin-pwa, Workbox

### 后端 (Backend)
- **运行时**: Node.js, Express
- **数据库**: PostgreSQL (Prisma ORM)
- **AI 服务**: 集成 OpenAI / Aliyun / Volcengine 接口
- **实时通信**: Server-Sent Events (SSE)

## 🚀 快速开始 (Quick Start)

### 前置要求
- Node.js >= 18
- PostgreSQL 数据库

### 安装步骤

1. **克隆项目**
   ```bash
   git clone https://github.com/your-username/knowledge-map-ai.git
   cd knowledge-map-ai
   ```

2. **安装依赖**
   ```bash
   npm install
   ```

3. **配置环境变量**
   复制 `.env.example` 为 `.env` 并填入必要的配置（数据库连接、API Key 等）。

4. **数据库迁移**
   ```bash
   npx prisma migrate dev
   ```

5. **启动开发服务器**
   ```bash
   # 同时启动前端和后端
   npm run dev
   ```

6. **访问应用**
   打开浏览器访问 `http://localhost:5173`。

## 🧪 测试 (Testing)

项目包含单元测试，确保核心逻辑的稳定性。

```bash
npm test
```

## 📦 构建与部署

```bash
npm run build
```
构建产物将输出到 `dist` 目录，可直接部署到任何静态文件服务器。

## 📄 许可证

本项目采用 MIT 许可证。
