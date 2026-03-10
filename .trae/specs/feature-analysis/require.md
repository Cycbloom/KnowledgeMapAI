# 后续功能需求记录

本文档记录已确认但本次不实施的功能需求，将在后续迭代中开发。

---

## 一、知识发现与推荐

### 1.1 相关知识点推荐
**功能描述**：基于向量嵌入，推荐与当前知识点相关的内容

**场景**：
- **GIVEN** 用户正在查看某个知识点
- **WHEN** 系统加载相关推荐
- **THEN** 显示语义相似的知识点列表
- **AND** 显示相似度分数
- **AND** 支持一键跳转到推荐知识点

**技术要点**：
- 利用现有的 vector(1024) 嵌入字段
- 使用 pgvector 的相似度搜索
- 相似度阈值可配置

### 1.2 知识盲区检测
**功能描述**：发现图谱中的孤立节点和知识缺口

**场景**：
- **GIVEN** 用户有一个知识图谱
- **WHEN** 用户点击"分析知识盲区"
- **THEN** 系统识别孤立节点（无连接的节点）
- **AND** 生成知识盲区报告
- **AND** AI 提供修复建议（推荐相关知识点并创建连接）

**呈现方式**：
1. **可视化显示**：在图谱编辑器中高亮显示孤立节点
2. **报告生成**：生成知识盲区报告，列出需要补充的内容
3. **自动修复建议**：AI 自动为孤立节点推荐相关知识点并创建连接

### 1.3 跨图谱知识关联
**功能描述**：发现不同图谱中相似或相关的知识点

**场景**：
- **GIVEN** 用户有多个知识图谱
- **WHEN** 系统进行跨图谱分析
- **THEN** AI 推荐可能相关的知识点对
- **AND** 用户确认后创建跨图谱关联
- **AND** 在图谱地图中显示关联关系

**建立方式**：AI 推荐 + 用户确认

---

## 二、AI 功能增强

### 2.1 AI 测验生成
**功能描述**：根据知识点自动生成测验题目

**支持的题型**：
- 问答题（已有）
- 选择题（已有）
- 判断题（已有）
- 填空题（已有）
- 多选题（新增）
- 论述题（新增）

**场景**：
- **GIVEN** 用户选择一个或多个知识点
- **WHEN** 用户点击"生成测验"
- **THEN** AI 根据知识点内容生成测验题目
- **AND** 支持选择题型和难度
- **AND** 支持预览和编辑生成的题目

### 2.2 AI 导师系统增强
**功能描述**：增强现有导师系统，添加角色和讨论氛围

**增强内容**：
1. **角色系统**：
   - 添加多种导师角色（如：严厉教授、温和导师、幽默助教等）
   - 每个角色有不同的对话风格和教学方式
   - 用户可选择喜欢的导师角色

2. **讨论氛围**：
   - 营造更自然的对话体验
   - 支持追问和深入探讨
   - 记录对话历史，支持回顾

3. **个性化学习建议**：
   - 根据学习数据提供针对性建议
   - 识别薄弱知识点
   - 推荐学习资源

**场景**：
- **GIVEN** 用户在学习过程中遇到问题
- **WHEN** 用户向 AI 导师提问
- **THEN** 导师以选定角色的风格回答
- **AND** 提供深入的解释和示例
- **AND** 可以继续追问

### 2.3 学习分析仪表板增强
**功能描述**：增强现有的学习分析仪表板

**增强内容**：
1. **基础统计**：
   - 学习时长统计
   - 复习次数统计
   - 知识点掌握度

2. **可视化图表**：
   - 知识掌握度雷达图
   - 学习效率趋势图
   - 学习时间分布热力图

3. **AI 分析建议**：
   - 分析学习数据
   - 识别学习模式
   - 提供个性化改进建议

---

## 三、实施优先级建议

### 第一批（学习路径完成后）
1. 知识盲区检测
2. 相关知识点推荐
3. AI 测验生成

### 第二批
1. 跨图谱知识关联
2. AI 导师系统增强
3. 学习分析仪表板增强

---

## 四、数据模型预留

### 知识盲区相关
```sql
-- 知识盲区报告
CREATE TABLE IF NOT EXISTS knowledge_gap_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  graph_id UUID NOT NULL REFERENCES knowledge_graphs(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  isolated_nodes UUID[] DEFAULT '{}',
  recommendations JSONB DEFAULT '{}',
  status VARCHAR(20) DEFAULT 'pending',
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### AI 导师角色
```sql
-- AI 导师角色
CREATE TABLE IF NOT EXISTS ai_tutor_personas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) NOT NULL,
  description TEXT,
  personality TEXT,
  speaking_style TEXT,
  icon VARCHAR(50),
  is_default BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 用户导师偏好
CREATE TABLE IF NOT EXISTS user_tutor_preferences (
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  persona_id UUID REFERENCES ai_tutor_personas(id) ON DELETE SET NULL,
  custom_settings JSONB DEFAULT '{}',
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (user_id)
);
```

### 跨图谱关联
```sql
-- 跨图谱知识点关联
CREATE TABLE IF NOT EXISTS cross_graph_relations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_kp_id UUID NOT NULL REFERENCES knowledge_points(id) ON DELETE CASCADE,
  target_kp_id UUID NOT NULL REFERENCES knowledge_points(id) ON DELETE CASCADE,
  relation_type VARCHAR(50) DEFAULT 'related',
  similarity_score FLOAT,
  user_confirmed BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(source_kp_id, target_kp_id)
);
```
