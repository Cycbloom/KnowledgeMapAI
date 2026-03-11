# 测验创建功能优化计划

## 问题分析

### 1. 功能流程问题
- **当前流程**：标题输入 → 描述输入 → 选择图谱 → 选择知识点 → 配置题型 → 选择难度
- **问题**：图谱选择应在第一步，标题/描述应由 AI 自动生成

### 2. UI 设计问题
- **当前难度图标**：简单(笑脸😊)、中等(平静😐)、困难(翘嘴☹️)
- **问题**：表情符号不够专业，需要更直观的难度标识

### 3. AI 配置问题
- **当前实现**：硬编码的 AI 提供者列表，自定义提示词只是简单文本框
- **问题**：应调用项目已有的 AI 服务和 promptService

---

## 优化方案

### 一、功能流程重构

#### 1.1 新流程设计
```
步骤1: 选择图谱（第一步，置于最上方）
  ↓
步骤2: 选择测验方向（关联学习路径）
  - 显示该图谱的学习路径列表
  - 支持选择整条学习路径（一键选择所有知识点）
  - 或手动选择部分知识点
  ↓
步骤3: AI 自动生成标题和描述
  - 根据选择的图谱和学习路径自动生成
  - 用户可编辑修改
  ↓
步骤4: 配置题型和数量
  ↓
步骤5: 选择难度
  ↓
步骤6: 高级配置（可选）
```

#### 1.2 实现要点

**修改 `QuizGenerationModal.tsx`**：
- 调整界面布局顺序
- 添加学习路径选择功能
- 集成 AI 自动生成标题/描述功能

**新增组件**：
- `LearningPathSelector.tsx` - 学习路径选择器（复用现有逻辑）

---

### 二、UI 设计改进

#### 2.1 难度图标重新设计

| 难度 | 新图标 | 颜色 | 描述 |
|------|--------|------|------|
| 简单 | `GraduationCap` (学士帽) | 绿色 | 基础入门 |
| 中等 | `BookOpen` (打开的书) | 橙色 | 深入学习 |
| 困难 | `Mountain` (山峰) | 红色 | 挑战高峰 |
| 混合 | `Layers` (层级) | 紫色 | 综合训练 |

#### 2.2 实现要点

**修改 `DifficultySelector.tsx`**：
- 替换图标为更专业的 lucide-react 图标
- 优化视觉层次和交互反馈

---

### 三、AI 配置集成

#### 3.1 调用项目 AI 服务

**获取 AI 配置**：
```typescript
// 使用现有的 AI 配置获取方式
import { getAIProviderForTask } from '../../services/ai/factory';

// 获取可用的 AI 提供者
const provider = await getAIProviderForTask('text');
```

**获取 AI 状态**：
```typescript
// 复用现有的 useAIStatus hook
const { data: aiStatus } = useAIStatus(open);
```

#### 3.2 集成 promptService

**右上角添加 Prompt 配置按钮**：
- 点击打开 Prompt 编辑面板
- 使用项目已有的 `PromptSettingsPanel` 组件
- 或创建简化版的 Prompt 配置对话框

**调用 promptService**：
```typescript
import promptService from '../../services/promptService';

// 获取测验生成的 Prompt 模板
const prompt = await promptService.getRenderedPrompt(
  supabase,
  'generate_quiz_title',  // 新增模板代码
  {
    graphTitle: selectedGraph.title,
    pathTitle: selectedPath?.title,
    knowledgePoints: selectedPoints.map(p => p.title),
  },
  userId,
  graphId
);
```

#### 3.3 新增 Prompt 模板

需要在数据库中添加以下模板：
- `generate_quiz_title` - 生成测验标题
- `generate_quiz_description` - 生成测验描述
- `generate_quiz_questions` - 生成测验题目（增强版）

---

## 实施步骤

### 阶段一：界面布局重构

1. **修改 `QuizGenerationModal.tsx`**
   - [x] 将图谱选择移至最上方
   - [x] 移除标题和描述的手动输入（改为 AI 生成后可编辑）
   - [x] 调整组件渲染顺序

2. **创建 `LearningPathSelector.tsx`**
   - [x] 显示图谱的学习路径列表
   - [x] 支持选择整条路径
   - [x] 支持展开路径查看知识点
   - [x] 一键选择路径内所有知识点

### 阶段二：学习路径集成

3. **修改 `KnowledgePointSelector.tsx`**
   - [x] 添加学习路径选择入口
   - [x] 支持从学习路径导入知识点
   - [x] 优化知识点树形展示

4. **创建 API 接口**
   - [x] `GET /graphs/:id/learning-paths` - 获取图谱的学习路径
   - [x] `GET /learning-paths/:id/nodes` - 获取学习路径的节点

### 阶段三：AI 自动生成

5. **实现标题/描述自动生成**
   - [x] 创建 `useGenerateQuizTitle` hook
   - [x] 选择图谱/路径后自动触发
   - [x] 显示生成状态
   - [x] 支持用户编辑

6. **添加 Prompt 模板**
   - [x] 在 seed 文件中添加模板
   - [x] 创建 Prompt 配置入口

### 阶段四：UI 优化

7. **修改 `DifficultySelector.tsx`**
   - [x] 替换图标
   - [x] 优化视觉设计
   - [x] 添加动画效果

8. **添加 Prompt 配置入口**
   - [x] 在模态框右上角添加配置按钮
   - [x] 集成 Prompt 编辑功能

---

## 涉及文件

### 需要修改的文件
- `src/components/Quiz/QuizGenerationModal.tsx` - 主模态框
- `src/components/Quiz/KnowledgePointSelector.tsx` - 知识点选择器
- `src/components/Quiz/DifficultySelector.tsx` - 难度选择器

### 需要创建的文件
- `src/components/Quiz/LearningPathSelector.tsx` - 学习路径选择器
- `src/hooks/queries/useQuizGenerationQueries.ts` - 测验生成相关查询
- `api/routes/quizSets.ts` - 添加学习路径相关接口

### 需要添加的 Prompt 模板
- `generate_quiz_title` - 测验标题生成
- `generate_quiz_description` - 测验描述生成

---

## 技术要点

### 1. 学习路径与知识点关联
```typescript
// 学习路径节点包含 knowledge_point_id
interface LearningPathNode {
  id: string;
  knowledge_point_id: string;  // 关联知识点
  title: string;
  order_index: number;
  status: 'pending' | 'in_progress' | 'completed';
}
```

### 2. AI 服务调用
```typescript
// 使用项目已有的 AI 服务
import { aiService } from '../../services/ai';

const result = await aiService.generateContent({
  prompt: renderedPrompt,
  provider: selectedProvider,
  userId: user.id,
});
```

### 3. Prompt 模板渲染
```typescript
import promptService from '../../services/promptService';

const prompt = await promptService.getRenderedPrompt(
  supabase,
  'generate_quiz_title',
  context,
  userId,
  graphId
);
```

---

## 预期效果

1. **流程更顺畅**：先选图谱 → 选路径 → 自动生成标题 → 配置题型
2. **操作更便捷**：一键选择学习路径中的所有知识点
3. **界面更专业**：难度图标直观，AI 配置集成
4. **扩展性更好**：Prompt 可自定义，支持多级模板覆盖
