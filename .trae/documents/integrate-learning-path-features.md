# 学习路径功能整合计划

## 问题描述

用户反馈两个问题：
1. **无法从知识图谱生成学习路径** - 图谱和学习路径功能没有连接
2. **闯关学习模式中的"学习路径"按钮不可用** - 该功能没有与持久化的学习路径系统集成

## 问题分析

### 当前架构问题

**两套独立的学习路径系统：**

1. **临时学习路径** (`api.learningPath.generate`)
   - 用于 `LearningPathPanel.tsx`（闯关学习模式）
   - 生成临时的学习路径数据，不保存到数据库
   - 每次刷新都会重新生成

2. **持久化学习路径** (`learningPathsApi`)
   - 用于 `LearningPaths.tsx` 和 `LearningPathDetail.tsx`
   - 保存到数据库 `learning_paths` 表
   - 支持状态跟踪、进度更新等功能

### 需要整合的功能

1. **从图谱生成学习路径** - 将临时生成转为保存到数据库
2. **闯关学习模式中的学习路径面板** - 显示已保存的学习路径，支持创建新路径

## 解决方案

### 方案概述

将两套系统合并，统一使用 `learningPathsApi`，同时保留 AI 规划功能。

### 修改文件

#### 1. `LearningPathPanel.tsx` - 主要修改

**当前问题：**
- 使用 `api.learningPath.generate` 生成临时路径
- 没有与持久化存储集成

**修改内容：**
- 添加"查看已保存的学习路径"功能
- 添加"创建新学习路径"功能
- 使用 `learningPathsApi` 获取/创建学习路径
- 保留 AI 规划向导 (`LearningPathWizard`)

**新功能流程：**
```
用户点击"学习路径"
    ↓
检查是否已有保存的学习路径
    ↓
├── 有 → 显示学习路径详情
└── 无 → 显示创建选项
         ├── AI 规划（使用向导）
         └── 快速创建
```

#### 2. 知识图谱页面 - 添加入口

**位置：** 图谱操作栏或设置面板

**功能：** "生成学习路径"按钮
- 点击后打开创建学习路径对话框
- 或跳转到 `/learning-paths/new?graph_id=xxx`

### 实施步骤

#### 步骤 1: 修改 `LearningPathPanel.tsx`

1. 添加状态管理：
   - `savedPath`: 已保存的学习路径
   - `isLoadingPath`: 加载状态
   - `showCreate`: 是否显示创建界面

2. 添加获取已保存路径的逻辑：
   ```tsx
   const { data: savedPaths, isLoading: isLoadingPaths } = useLearningPaths(graphId);
   ```

3. 修改渲染逻辑：
   - 如果有保存的路径，显示路径列表
   - 如果没有，显示创建选项（AI 规划 / 快速创建）

#### 步骤 2: 添加创建学习路径功能

1. 使用 `learningPathsApi.generateFromGraph` 创建并保存路径
2. 创建成功后刷新列表

#### 步骤 3: 在图谱页面添加入口

**选项 A - 在 GraphSettingsModal 添加按钮**
- 在设置面板添加"学习路径"选项卡
- 显示该图谱关联的学习路径
- 提供"创建学习路径"按钮

**选项 B - 在图谱工具栏添加按钮**
- 在图谱编辑器工具栏添加"学习路径"图标
- 点击后跳转到创建页面

### 需要修改的文件

1. `src/components/LearningPath/LearningPathPanel.tsx` - 主要修改
2. `src/components/GraphEditor/GraphSettingsModal.tsx` - 添加入口（可选）
3. `src/hooks/queries/useLearningPathQueries.ts` - 可能需要添加新的查询
4. `src/hooks/mutations/useLearningPathMutations.ts` - 可能需要添加新的 mutation

### 验证方法

1. 在闯关学习模式中点击"学习路径"按钮
   - 应显示已保存的学习路径列表（如果有）
   - 或显示创建选项（如果没有）

2. 从知识图谱页面创建学习路径
   - 应能成功创建并保存到数据库
   - 在学习路径列表页能看到新创建的路径

3. 检查类型和代码检查
