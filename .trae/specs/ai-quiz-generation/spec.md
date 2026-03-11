# AI 测验生成功能 Spec

## Why

现有系统已有基础的 AI 卡片生成功能，但用户需要更完整的测验生成体验：能够基于知识点批量生成测验、灵活选择题型和难度、预览编辑生成的题目，并支持测验模式练习。

## What Changes

- **新增测验生成配置界面**：支持选择知识点范围、题型组合、难度级别
- **增强 AI 生成逻辑**：支持批量生成、难度控制、题目质量优化
- **新增测验预览编辑**：生成后可预览和编辑题目
- **新增测验模式**：支持按测验集合进行练习
- **新增测验管理**：保存、删除、分享测验集合

## Impact

- Affected specs: 学习模块、AI 服务
- Affected code:
  - `api/services/ai/index.ts` - 增强卡片生成逻辑
  - `api/routes/ai/cards.ts` - 新增测验生成 API
  - `src/pages/Study.tsx` - 新增测验生成入口
  - `src/components/Study/` - 新增测验相关组件
  - `supabase/migrations/` - 新增测验集合表

---

## ADDED Requirements

### Requirement: 测验集合管理

系统应提供测验集合的创建、保存、删除和查看功能。

#### Scenario: 创建测验集合
- **GIVEN** 用户在测验管理页面
- **WHEN** 用户点击"创建测验"按钮
- **THEN** 显示测验配置界面
- **AND** 用户可选择知识点范围（单个/多个/整个图谱）
- **AND** 用户可选择题型组合（问答题、单选题、多选题、判断题、填空题、论述题）
- **AND** 用户可设置题目数量和难度级别

#### Scenario: 保存测验集合
- **GIVEN** 用户完成测验生成配置
- **WHEN** 用户点击"生成并保存"按钮
- **THEN** AI 根据配置生成测验题目
- **AND** 显示生成进度
- **AND** 生成完成后保存测验集合到数据库
- **AND** 显示测验预览界面

#### Scenario: 删除测验集合
- **GIVEN** 用户在测验列表中
- **WHEN** 用户点击删除按钮并确认
- **THEN** 测验集合及其关联的学习卡片被删除
- **AND** 列表自动更新

### Requirement: AI 测验生成配置

系统应提供灵活的测验生成配置选项。

#### Scenario: 选择知识点范围
- **GIVEN** 用户在测验配置界面
- **WHEN** 用户选择知识点范围
- **THEN** 显示可选的知识点列表（支持多选）
- **AND** 支持按图谱筛选
- **AND** 支持全选/取消全选
- **AND** 显示已选知识点数量

#### Scenario: 配置题型和难度
- **GIVEN** 用户在测验配置界面
- **WHEN** 用户配置题型和难度
- **THEN** 用户可勾选需要的题型（至少选一种）
- **AND** 用户可设置每种题型的数量
- **AND** 用户可选择难度级别（简单/中等/困难/混合）
- **AND** 系统显示预计生成题目总数

#### Scenario: 高级配置
- **GIVEN** 用户展开高级配置
- **WHEN** 用户进行高级设置
- **THEN** 用户可选择 AI 提供者
- **AND** 用户可设置生成温度（创造性程度）
- **AND** 用户可添加自定义提示词

### Requirement: AI 测验生成执行

系统应执行 AI 测验生成并显示进度。

#### Scenario: 执行生成
- **GIVEN** 用户完成测验配置
- **WHEN** 用户点击"开始生成"按钮
- **THEN** 系统调用 AI 服务生成题目
- **AND** 显示生成进度（已完成/总数）
- **AND** 支持取消生成操作
- **AND** 生成失败时显示错误信息并支持重试

#### Scenario: 批量生成优化
- **GIVEN** 用户选择大量知识点生成测验
- **WHEN** 系统执行生成
- **THEN** 系统使用批量生成任务队列
- **AND** 支持后台执行
- **AND** 生成完成后通知用户

### Requirement: 测验预览与编辑

系统应提供测验预览和编辑功能。

#### Scenario: 预览生成的测验
- **GIVEN** 测验生成完成
- **WHEN** 系统显示测验预览
- **THEN** 按题型分组显示所有题目
- **AND** 显示每道题的问题、答案、解析
- **AND** 支持快速浏览和定位

#### Scenario: 编辑题目
- **GIVEN** 用户在测验预览界面
- **WHEN** 用户点击某道题目进行编辑
- **THEN** 显示题目编辑表单
- **AND** 可修改问题、答案、选项、解析
- **AND** 可删除单道题目
- **AND** 可手动添加新题目

#### Scenario: 重新生成单题
- **GIVEN** 用户对某道题目不满意
- **WHEN** 用户点击"重新生成"按钮
- **THEN** AI 基于原知识点重新生成该题
- **AND** 用户可选择接受或继续重新生成

### Requirement: 测验模式练习

系统应支持按测验集合进行练习。

#### Scenario: 开始测验练习
- **GIVEN** 用户在测验详情页
- **WHEN** 用户点击"开始练习"按钮
- **THEN** 进入测验练习模式
- **AND** 按顺序显示测验题目
- **AND** 显示测验进度

#### Scenario: 测验结果统计
- **GIVEN** 用户完成测验练习
- **WHEN** 系统显示测验结果
- **THEN** 显示正确率统计
- **AND** 显示各题型得分
- **AND** 显示薄弱知识点分析
- **AND** 提供错题重练选项

---

## MODIFIED Requirements

### Requirement: AI 卡片生成服务增强

现有的 AI 卡片生成服务需要增强以支持测验生成。

#### Scenario: 支持难度控制
- **GIVEN** AI 服务收到生成请求
- **WHEN** 请求包含难度参数
- **THEN** 生成的题目符合指定难度
- **AND** 简单难度：基础概念题
- **AND** 中等难度：应用理解题
- **AND** 困难难度：综合分析题

#### Scenario: 支持批量生成优化
- **GIVEN** AI 服务收到批量生成请求
- **WHEN** 处理大量知识点
- **THEN** 使用任务队列异步处理
- **AND** 支持进度回调
- **AND** 支持取消操作

---

## Data Model

### 新增表: quiz_sets（测验集合）

```sql
CREATE TABLE IF NOT EXISTS quiz_sets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  graph_id UUID REFERENCES knowledge_graphs(id) ON DELETE CASCADE,
  title VARCHAR(200) NOT NULL,
  description TEXT,
  config JSONB DEFAULT '{}',  -- 生成配置（题型、难度等）
  status VARCHAR(20) DEFAULT 'draft',  -- draft, generating, ready
  card_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

### 新增表: quiz_set_cards（测验集合与卡片关联）

```sql
CREATE TABLE IF NOT EXISTS quiz_set_cards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quiz_set_id UUID NOT NULL REFERENCES quiz_sets(id) ON DELETE CASCADE,
  card_id UUID NOT NULL REFERENCES study_cards(id) ON DELETE CASCADE,
  display_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(quiz_set_id, card_id)
);
```

### 修改表: study_cards（添加测验关联）

```sql
ALTER TABLE study_cards ADD COLUMN IF NOT EXISTS quiz_set_id UUID REFERENCES quiz_sets(id) ON DELETE SET NULL;
```

---

## API Endpoints

| 端点 | 方法 | 描述 |
|------|------|------|
| `/quiz-sets` | GET | 获取用户的测验集合列表 |
| `/quiz-sets` | POST | 创建测验集合 |
| `/quiz-sets/:id` | GET | 获取测验集合详情（含所有题目） |
| `/quiz-sets/:id` | PUT | 更新测验集合信息 |
| `/quiz-sets/:id` | DELETE | 删除测验集合 |
| `/quiz-sets/:id/cards` | GET | 获取测验集合的所有卡片 |
| `/quiz-sets/generate` | POST | 生成测验（异步任务） |
| `/quiz-sets/:id/regenerate/:cardId` | POST | 重新生成单题 |
