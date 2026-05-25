# 小说/故事创作图谱 (story_creation) - MVP 实施规格

## Why
基于已完成的需求规格说明书 ([survey-graph-types/spec.md](survey-graph-types/spec.md))，现在进入 **Phase 1: MVP（最小可行产品）** 阶段。MVP 的目标是构建一个**可用的最小故事组织工具**，验证核心概念并收集用户反馈。

## What Changes
本 spec 聚焦于 MVP 范围内的代码变更：
- 新增数据库表和 Schema
- 扩展类型定义系统
- 实现基础 CRUD API
- 构建简化的故事编辑器 UI
- 集成经典结构模板（三幕式）
- 复用现有画布引擎展示基础图谱视图

**MVP 范围边界**：
- ✅ **包含**: 基础结构管理、角色/场景节点、三幕式模板、基础视图
- ⏸️ **延后**: 多轨道视图、AI功能、高级编辑器、导出功能
- ❌ **排除**: Phase 2-4 的所有增强功能

## Impact
- Affected specs: [survey-graph-types/spec.md](survey-graph-types/spec.md)（作为需求基础）
- Affected code:
  - `supabase/migrations/` - 新增迁移文件
  - `shared/types/graph.ts` - 扩展枚举和接口
  - `api/` - 新增路由和服务
  - `src/components/` - 新增故事编辑器组件
  - `src/services/api/` - 新增 API 客户端

---

## 一、MVP 目标与成功标准

### 1.1 核心目标
用户能够：
1. ✅ 创建一个新的 `story_creation` 类型图谱
2. ✅ 选择三幕式结构模板自动初始化骨架
3. ✅ 添加和管理角色节点（基本信息+心理画像）
4. ✅ 添加和管理场景节点（摘要+内容）
5. ✅ 在画布上查看故事的层级结构
6. ✅ 建立角色与场景的关联关系

### 1.2 成功指标
- [ ] 能够在 5 分钟内创建一个包含 3 幕、9 章、27 场的故事骨架
- [ ] 能够添加至少 5 个角色并建立关系
- [ ] 能够在场景中写入内容并关联出场角色
- [ ] 图谱视图能正确显示层级结构和连接关系
- [ ] 无关键性 bug，基本流程可跑通

---

## 二、MVP 数据模型设计（简化版）

### 2.1 数据库表（MVP 最小集合）

#### 表 1: story_structures（故事结构骨架）⭐ 核心
```sql
-- 文件: supabase/migrations/25_story_creation.sql

CREATE TABLE IF NOT EXISTS story_structures (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  graph_id UUID NOT NULL REFERENCES knowledge_graphs(id) ON DELETE CASCADE,
  structure_level VARCHAR(20) NOT NULL CHECK (
    structure_level IN ('story', 'act', 'sequence', 'chapter', 'scene')
  ),
  parent_structure_id UUID REFERENCES story_structures(id) ON DELETE CASCADE,
  title VARCHAR(512) NOT NULL,
  synopsis TEXT,                    -- 简短描述（MVP阶段可选）
  display_order INTEGER NOT NULL DEFAULT 0,
  template_beat_id VARCHAR(100),   -- 关联模板节拍ID
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 索引
CREATE INDEX idx_story_structures_graph_id ON story_structures(graph_id);
CREATE INDEX idx_story_structures_parent_id ON story_structures(parent_structure_id);
CREATE INDEX idx_story_structures_level ON story_structures(structure_level);

COMMENT ON TABLE story_structures IS '故事结构骨架表，存储幕/序列/章节/场景的层级结构';
```

#### 表 2: story_characters（角色档案）⭐ 核心
```sql
CREATE TABLE IF NOT EXISTS story_characters (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  graph_id UUID NOT NULL REFERENCES knowledge_graphs(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  role_type VARCHAR(50) NOT NULL CHECK (
    role_type IN ('protagonist', 'antagonist', 'supporting', 'minor')
  ),
  archetype VARCHAR(100),          -- 角色原型（可选）

  -- 基本信息（MVP简化版）
  appearance TEXT,                 -- 外貌描述
  age VARCHAR(50),                 -- 年龄
  gender VARCHAR(20),              -- 性别

  -- 心理画像（MVP核心）
  motivation TEXT,                 -- 核心动机
  fear TEXT,                       -- 核心恐惧
  desire TEXT,                     -- 核心欲望
  flaw TEXT,                       -- 致命弱点

  -- 背景与弧线（MVP可选）
  backstory TEXT,                  -- 背景故事
  arc_start TEXT,                  -- 弧线起点
  arc_end TEXT,                    -- 弧线终点

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_story_characters_graph_id ON story_characters(graph_id);

COMMENT ON TABLE story_characters IS '角色档案表，存储故事中的角色信息';
```

#### 表 3: story_character_relationships（角色关系）
```sql
CREATE TABLE IF NOT EXISTS story_character_relationships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  graph_id UUID NOT NULL REFERENCES knowledge_graphs(id) ON DELETE CASCADE,
  source_character_id UUID NOT NULL REFERENCES story_characters(id) ON DELETE CASCADE,
  target_character_id UUID NOT NULL REFERENCES story_characters(id) ON DELETE CASCADE,
  relationship_type VARCHAR(50) NOT NULL, -- 18种关系类型之一
  strength INTEGER NOT NULL DEFAULT 5 CHECK (strength BETWEEN 1 AND 10),
  status VARCHAR(50) DEFAULT 'active',
  notes TEXT,                       -- 关系说明（MVP简化）
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(graph_id, source_character_id, target_character_id, relationship_type)
);

CREATE INDEX idx_story_char_rel_graph ON story_character_relationships(graph_id);

COMMENT ON TABLE story_character_relationships IS '角色关系表，记录角色间的复杂关系';
```

#### 表 4: story_scene_details（场景详情）⭐ 核心
```sql
CREATE TABLE IF NOT EXISTS story_scene_details (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  graph_id UUID NOT NULL REFERENCES knowledge_graphs(id) ON DELETE CASCADE,
  structure_id UUID NOT NULL REFERENCES story_structures(id) ON DELETE CASCADE,

  -- 叙事要素（MVP核心）
  pov_character_id UUID REFERENCES story_characters(id), -- POV角色
  synopsis TEXT,                   -- 场景摘要
  content TEXT,                    -- 场景正文（富文本，MVP用纯文本）

  -- 元数据（MVP简化）
  location_name VARCHAR(255),     -- 地点名称（文本，不关联setting表）
  time_setting VARCHAR(100),       -- 时间设定

  -- 写作状态
  writing_status VARCHAR(20) DEFAULT 'draft' CHECK (
    writing_status IN ('draft', 'revising', 'complete')
  ),
  word_count INTEGER DEFAULT 0,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_story_scene_details_graph ON story_scene_details(graph_id);
CREATE INDEX idx_story_scene_details_structure ON story_scene_details(structure_id);

COMMENT ON TABLE story_scene_details IS '场景详情表，存储场景的具体内容和元数据';
```

#### 表 5: story_appearances（出场记录）
```sql
CREATE TABLE IF NOT EXISTS story_appearances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  graph_id UUID NOT NULL REFERENCES knowledge_graphs(id) ON DELETE CASCADE,
  character_id UUID NOT NULL REFERENCES story_characters(id) ON DELETE CASCADE,
  scene_detail_id UUID NOT NULL REFERENCES story_scene_details(id) ON DELETE CASCADE,
  role_in_scene VARCHAR(20) DEFAULT 'supporting' CHECK (
    role_in_scene IN ('protagonist', 'antagonist', 'supporting', 'minor', 'mentioned')
  ),
  notes TEXT,                       -- 出场说明
  created_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(graph_id, character_id, scene_detail_id)
);

CREATE INDEX idx_story_appearances_graph ON story_appearances(graph_id);

COMMENT ON TABLE story_appearances IS '出场记录表，记录角色在哪些场景中出现';
```

#### 表 6: story_templates_seed（模板种子数据）
```sql
-- 注意：这个表只在 seed 文件中使用，或者直接用 SQL 插入

-- 三幕式模板节拍定义（作为参考数据存储）
-- MVP阶段可以硬编码在前端或API中，不需要单独建表
-- 如果需要灵活性，可以使用以下简单的配置表：

CREATE TABLE IF NOT EXISTS story_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_code VARCHAR(100) UNIQUE NOT NULL,
  name VARCHAR(255) NOT NULL,
  name_zh VARCHAR(255) NOT NULL,
  description TEXT,
  category VARCHAR(50) DEFAULT 'classical',
  beats JSONB NOT NULL DEFAULT '[]', -- TemplateBeat[]
  is_system BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 插入三幕式模板数据
INSERT INTO story_templates (template_code, name, name_zh, description, beats) VALUES
(
  'three_act',
  'Three-Act Structure',
  '三幕式结构',
  '经典的叙事结构，将故事分为开端、对抗、解决三个部分',
  '[
    {
      "id": "act1_setup",
      "name": "Act I: Setup",
      "name_zh": "第一幕：铺垫",
      "order": 1,
      "level": "act",
      "percentage_start": 0,
      "percentage_end": 25,
      "description": "介绍平凡世界、角色现状和核心问题"
    },
    {
      "id": "act1_call",
      "name": "Call to Adventure",
      "name_zh": "冒险召唤",
      "order": 2,
      "level": "sequence",
      "parent_act": "act1_setup",
      "description": "打破日常的事件发生"
    },
    {
      "id": "act1_threshold",
      "name": "Crossing the Threshold",
      "name_zh": "跨越门槛",
      "order": 3,
      "level": "sequence",
      "parent_act": "act1_setup",
      "description": "主角决定踏上旅程"
    },
    {
      "id": "act2_confrontation",
      "name": "Act II: Confrontation",
      "name_zh": "第二幕：对抗",
      "order": 4,
      "level": "act",
      "percentage_start": 25,
      "percentage_end": 75,
      "description": "试炼、盟友、敌人，逐渐接近目标"
    },
    {
      "id": "act2_rising",
      "name": "Rising Action",
      "name_zh": "上升动作",
      "order": 5,
      "level": "sequence",
      "parent_act": "act2_confrontation",
      "description": "一系列挑战和考验"
    },
    {
      "id": "act2_midpoint",
      "name": "Midpoint",
      "name_zh": "中点",
      "order": 6,
      "level": "sequence",
      "parent_act": "act2_confrontation",
      "description": "重大转折点，信息揭露或方向改变"
    },
    {
      "id": "act2_crisis",
      "name": "Crisis / All Is Lost",
      "name_zh": "危机/一无所有",
      "order": 7,
      "level": "sequence",
      "parent_act": "act2_confrontation",
      "description": "看似失败的低谷时刻"
    },
    {
      "id": "act3_resolution",
      "name": "Act III: Resolution",
      "name_zh": "第三幕：解决",
      "order": 8,
      "level": "act",
      "percentage_start": 75,
      "percentage_end": 100,
      "description": "最终对决、变革和新的平衡"
    },
    {
      "id": "act3_climax",
      "name": "Climax",
      "name_zh": "高潮",
      "order": 9,
      "level": "sequence",
      "parent_act": "act3_resolution",
      "description": "最大的冲突和转折"
    },
    {
      "id": "act3_denouement",
      "name": "Denouement",
      "name_zh": "尾声",
      "order": 10,
      "level": "sequence",
      "parent_act": "act3_resolution",
      "description": "收尾和新常态"
    }
  ]'::jsonb
);
```

### 2.2 MVP 不包含的表（Phase 2+）
- ❌ `story_settings`（设定/世界观）→ Phase 2
- ❌ `story_storylines`（故事线）→ Phase 2
- ❌ 复杂的 JSON 字段扩展 → Phase 2

---

## 三、TypeScript 类型扩展

### 3.1 扩展 shared/types/graph.ts

在现有文件中新增以下类型定义：

```typescript
// ============================================
// Story Creation Types (MVP)
// ============================================

// ---- 枚举定义 ----

export enum StoryStructureLevel {
  STORY = "story",
  ACT = "act",
  SEQUENCE = "sequence",  // MVP 可选：先只支持 act/chapter/scene
  CHAPTER = "chapter",
  SCENE = "scene",
}

export enum CharacterRoleType {
  PROTAGONIST = "protagonist",
  ANTAGONIST = "antagonist",
  SUPPORTING = "supporting",
  MINOR = "minor",
}

export enum CharacterRelationshipType {
  // 家族
  FAMILY_PARENT = "family_parent",
  FAMILY_SIBLING = "family_sibling",
  // 社会
  FRIEND = "friend",
  ENEMY = "enemy",
  RIVAL = "rival",
  MENTOR = "mentor",
  ALLY = "ally",
  // 情感
  ROMANTIC_INTEREST = "romantic_interest",
  // 复杂
  LOVE_HATE = "love_hate",
  BETRAYER = "betrayer",
  // 自定义
  CUSTOM = "custom",
}

export enum SceneRoleInScene {
  PROTAGONIST = "protagonist",
  ANTAGONIST = "antagonist",
  SUPPORTING = "supporting",
  MINOR = "minor",
  MENTIONED = "mentioned",
}

export enum WritingStatus {
  DRAFT = "draft",
  REVISING = "revising",
  COMPLETE = "complete",
}

// ---- 接口定义 ----

export interface StoryStructure {
  id: string;
  graph_id: string;
  structure_level: StoryStructureLevel;
  parent_structure_id?: string;
  title: string;
  synopsis?: string;
  display_order: number;
  template_beat_id?: string;
  metadata?: Record<string, unknown>;
  children?: StoryStructure[];
  created_at: string;
  updated_at: string;
}

export interface StoryCharacter {
  id: string;
  graph_id: string;
  name: string;
  role_type: CharacterRoleType;
  archetype?: string;
  appearance?: string;
  age?: string;
  gender?: string;
  motivation?: string;
  fear?: string;
  desire?: string;
  flaw?: string;
  backstory?: string;
  arc_start?: string;
  arc_end?: string;
  relationships?: StoryCharacterRelationship[];
  appearances?: StoryAppearance[];
  created_at: string;
  updated_at: string;
}

export interface StoryCharacterRelationship {
  id: string;
  graph_id: string;
  source_character_id: string;
  target_character_id: string;
  relationship_type: CharacterRelationshipType;
  strength: number;
  status: string;
  notes?: string;
  source_character?: StoryCharacter;
  target_character?: StoryCharacter;
  created_at: string;
  updated_at: string;
}

export interface StorySceneDetail {
  id: string;
  graph_id: string;
  structure_id: string;
  pov_character_id?: string;
  synopsis?: string;
  content?: string;
  location_name?: string;
  time_setting?: string;
  writing_status: WritingStatus;
  word_count: number;
  structure?: StoryStructure;
  pov_character?: StoryCharacter;
  appearances?: StoryAppearance[];
  created_at: string;
  updated_at: string;
}

export interface StoryAppearance {
  id: string;
  graph_id: string;
  character_id: string;
  scene_detail_id: string;
  role_in_scene: SceneRoleInScene;
  notes?: string;
  character?: StoryCharacter;
  scene_detail?: StorySceneDetail;
  created_at: string;
}

// ---- 创建/更新数据类型 ----

export interface CreateStoryStructureData {
  graph_id: string;
  structure_level: StoryStructureLevel;
  parent_structure_id?: string;
  title: string;
  synopsis?: string;
  display_order: number;
  template_beat_id?: string;
}

export interface CreateCharacterData {
  graph_id: string;
  name: string;
  role_type: CharacterRoleType;
  archetype?: string;
  appearance?: string;
  age?: string;
  gender?: string;
  motivation?: string;
  fear?: string;
  desire?: string;
  flaw?: string;
  backstory?: string;
  arc_start?: string;
  arc_end?: string;
}

export interface CreateSceneDetailData {
  graph_id: string;
  structure_id: string;
  pov_character_id?: string;
  synopsis?: string;
  content?: string;
  location_name?: string;
  time_setting?: string;
  writing_status?: WritingStatus;
}

export interface CreateAppearanceData {
  graph_id: string;
  character_id: string;
  scene_detail_id: string;
  role_in_scene: SceneRoleInScene;
  notes?: string;
}

export interface CreateRelationshipData {
  graph_id: string;
  source_character_id: string;
  target_character_id: string;
  relationship_type: CharacterRelationshipType;
  strength?: number;
  status?: string;
  notes?: string;
}

// ---- 模板相关 ----

export interface StoryTemplateBeat {
  id: string;
  name: string;
  name_zh: string;
  order: number;
  level: StoryStructureLevel;
  parent_act?: string;
  percentage_start?: number;
  percentage_end?: number;
  description: string;
}

export interface StoryTemplate {
  id: string;
  template_code: string;
  name: string;
  name_zh: string;
  description?: string;
  category: string;
  beats: StoryTemplateBeat[];
  is_system: boolean;
}
```

### 3.2 扩展 TemplateType 枚举

在现有的 `TemplateType` 中添加新值：

```typescript
export type TemplateType =
  | ... // 现有的 18 种类型
  | "story_creation"; // 新增
```

### 3.3 扩展 TemplateCategory 枚举

```typescript
export type TemplateCategory =
  | "knowledge"
  | "project"
  | "analysis"
  | "architecture"
  | "creative"; // 新增：创意类
```

### 3.4 更新 TEMPLATE_TYPE_MAP

```typescript
// 在 shared/types/graph.ts 的 TEMPLATE_TYPE_MAP 中添加：
story_creation: {
  type: "story_creation",
  category: "creative",
  layoutSuggestion: "hierarchical", // 层级化布局
  primaryRelationType: "causal",     // 主要用因果关系
  structureHint: "narrative_hierarchy", // 叙事层级结构
},
```

---

## 四、后端 API 设计（MVP）

### 4.1 新增 API 路由文件

```
api/routes/story/
├── structures.ts      # 结构 CRUD + 模板初始化
├── characters.ts      # 角色 CRUD
├── relationships.ts   # 角色关系 CRUD
├── scenes.ts          # 场景详情 CRUD
└── appearances.ts     # 出场记录 CRUD
```

### 4.2 核心端点设计

#### 4.2.1 结构管理 API (`api/routes/story/structures.ts`)

```typescript
// GET /api/story/:graphId/structures
// 获取完整的故事结构树（递归）
export async function getStoryStructures(req: Request, res: Response) {
  const { graphId } = req.params;
  // 1. 验证图谱存在且 type === 'story_creation'
  // 2. 查询所有 structure 记录
  // 3. 构建树形结构
  // 4. 返回 JSON
}

// POST /api/story/:graphId/structures
// 创建新的结构节点
export async function createStoryStructure(req: Request, res: Response) {
  // 验证输入 → 插入数据库 → 返回新节点
}

// PUT /api/story/structures/:id
// 更新结构节点
export async function updateStoryStructure(req: Request, res: Response) { ... }

// DELETE /api/story/structures/:id
// 删除结构节点（级联删除子节点）
export async function deleteStoryStructure(req: Request, res: Response) { ... }

// POST /api/story/:graphId/initialize-template
// 🌟 根据模板初始化故事骨架（MVP核心功能）
export async function initializeFromTemplate(req: Request, res: Response) {
  const { graphId } = req.params;
  const { templateCode } = req.body; // e.g., 'three_act'

  // 1. 获取模板定义
  // 2. 根据 beats 创建 story_structures 记录
  // 3. 建立父子关系
  // 4. 返回创建的结构树
}
```

#### 4.2.2 角色 API (`api/story/characters.ts`)

```typescript
// GET /api/story/:graphId/characters
// 获取所有角色（可包含关系和出场统计）
export async function getCharacters(req: Request, res: Response) { ... }

// POST /api/story/:graphId/characters
// 创建角色
export async function createCharacter(req: Request, res: Response) { ... }

// PUT /api/story/characters/:id
// 更新角色
export async function updateCharacter(req: Request, res: Response) { ... }

// DELETE /api/story/characters/:id
// 删除角色（级联删除关系和出场记录）
export async function deleteCharacter(req: Request, res: Response) { ... }
```

#### 4.2.3 场景详情 API (`api/story/scenes.ts`)

```typescript
// GET /api/story/scenes/:structureId
// 获取某个结构节点对应的场景详情
export async function getSceneDetail(req: Request, res: Response) { ... }

// POST /api/story/scenes
// 创建场景详情（绑定到 structure）
export async function createSceneDetail(req: Request, res: Response) { ... }

// PUT /api/story/scenes/:id
// 更新场景详情（包括内容）
export async function updateSceneDetail(req: Request, res: Response) { ... }
```

#### 4.2.4 出场记录 API (`api/story/appearances.ts`)

```typescript
// POST /api/story/appearances
// 添加出场记录（角色出现在某场景）
export async function addAppearance(req: Request, res: Response) { ... }

// DELETE /api/story/appearances/:id
// 移除出场记录
export async function removeAppearance(req: Request, res: Response) { ... }

// GET /api/story/:graphId/appearances/stats/:characterId
// 获取角色的出场统计
export async function getAppearanceStats(req: Request, res: Response) { ... }
```

### 4.3 请求验证 Schema (Zod)

```typescript
// 在 api/schemas/index.ts 或新建 api/schemas/story.ts 中添加

import { z } from 'zod';

export const createStoryStructureSchema = z.object({
  structure_level: z.enum(['story', 'act', 'chapter', 'scene']),
  parent_structure_id: z.string().uuid().optional(),
  title: z.string().min(1).max(512),
  synopsis: z.string().max(2000).optional(),
  display_order: z.number().int().min(0),
  template_beat_id: z.string().max(100).optional(),
});

export const createCharacterSchema = z.object({
  name: z.string().min(1).max(255),
  role_type: z.enum(['protagonist', 'antagonist', 'supporting', 'minor']),
  archetype: z.string().max(100).optional(),
  appearance: z.string().max(1000).optional(),
  age: z.string().max(50).optional(),
  gender: z.string().max(20).optional(),
  motivation: z.string().max(500).optional(),
  fear: z.string().max(500).optional(),
  desire: z.string().max(500).optional(),
  flaw: z.string().max(500).optional(),
  backstory: z.string().max(5000).optional(),
  arc_start: z.string().max(500).optional(),
  arc_end: z.string().max(500).optional(),
});

export const createSceneDetailSchema = z.object({
  structure_id: z.string().uuid(),
  pov_character_id: z.string().uuid().optional(),
  synopsis: z.string().max(2000).optional(),
  content: z.string().max(100000).optional(), // 支持长文本
  location_name: z.string().max(255).optional(),
  time_setting: z.string().max(100).optional(),
  writing_status: z.enum(['draft', 'revising', 'complete']).optional(),
});

export const initializeTemplateSchema = z.object({
  templateCode: z.string().min(1), // 'three_act'
});
```

---

## 五、前端组件设计（MVP）

### 5.1 组件架构（精简版）

```
src/
├── components/
│   └── StoryEditor/              # 故事编辑器模块（MVP）
│       ├── StoryEditor.tsx       # 主容器组件
│       ├── panels/
│       │   ├── StructurePanel.tsx    # 左侧：结构树（幕/章/场景）
│       │   └── CharacterPanel.tsx    # 右侧：角色列表
│       ├── editors/
│       │   ├── SceneEditor.tsx       # 场景内容编辑器
│       │   └── CharacterEditor.tsx   # 角色档案编辑器
│       └── widgets/
│           └── RelationshipGraph.tsx # 简化的关系图
│
├── pages/
│   └── GraphEditor.tsx            # 修改：检测 story_creation 类型
│
└── services/api/
    └── storyCreationApi.ts       # API 客户端
```

### 5.2 核心组件详细设计

#### 5.2.1 StoryEditor.tsx（主容器）

**布局**:
```
┌─────────────────────────────────────────────────────┐
│  工具栏：[保存] [模板] [视图切换] [设置]              │
├──────────────┬──────────────────────────────────────┤
│              │                                      │
│  结构面板     │         主工作区                      │
│  (250px)     │                                      │
│              │  ┌──────────────────────────────┐   │
│  📖 故事      │  │                              │   │
│   ├ 第一幕    │  │     画布区域（复用 React Flow）  │   │
│   │  ├ 序列A  │  │     显示当前选中层级的节点       │   │
│   │  ├ 第一章 │  │                              │   │
│   │  │  ├ 场景1│  │   [场景1] ──→ [场景2]          │   │
│   │  │  └ 场景2│  │                              │   │
│   │  └ 第二章 │  └──────────────────────────────┘   │
│   └ 第二幕    │                                      │
│              │  ┌──────────────────────────────┐   │
│  👥 角色 (3)  │  │  详情面板（条件渲染）           │   │
│   · 哈利       │  │  选中场景时：场景编辑器          │   │
│   · 罗恩       │  │  选中角色时：角色档案            │   │
│   · 赫敏       │  └──────────────────────────────┘   │
│              │                                      │
└──────────────┴──────────────────────────────────────┘
```

**核心状态**:
```tsx
interface StoryEditorProps {
  graphId: string;
  graphMeta: Graph;
}

const StoryEditor: React.FC<StoryEditorProps> = ({ graphId, graphMeta }) => {
  // 核心状态
  const [structures, setStructures] = useState<StoryStructure[]>([]);
  const [characters, setCharacters] = useState<StoryCharacter[]>([]);
  const [selectedStructure, setSelectedStructure] = useState<StoryStructure | null>(null);
  const [selectedCharacter, setSelectedCharacter] = useState<StoryCharacter | null>(null);
  const [sceneDetails, setSceneDetails] = useState<Map<string, StorySceneDetail>>(new Map());

  // 初始化
  useEffect(() => {
    loadStoryData();
  }, [graphId]);

  return (
    <div className="flex h-screen">
      <StructurePanel ... />
      <MainWorkspace ... />
      <DetailPanel ... />
    </div>
  );
};
```

#### 5.2.2 StructurePanel.tsx（结构树）

**功能**:
- 树形展示 Story → Act → Chapter → Scene
- 可展开/折叠
- 可拖拽重排（MVP可用简单按钮调整顺序）
- 点击选中节点
- 右键菜单：添加子节点、删除、编辑标题

**实现要点**:
```tsx
const StructurePanel: React.FC<StructurePanelProps> = ({
  structures,
  selectedId,
  onSelect,
  onAddChild,
  onDelete,
  onReorder,
}) => {
  const renderTree = (nodes: StoryStructure[], level = 0): ReactNode => {
    return nodes.map((node) => (
      <div key={node.id} style={{ paddingLeft: level * 16 }}>
        <div
          className={`flex items-center p-2 cursor-pointer hover:bg-gray-100 ${
            selectedId === node.id ? 'bg-blue-100' : ''
          }`}
          onClick={() => onSelect(node)}
        >
          {/* 层级图标 */}
          <span className="mr-2">
            {getLevelIcon(node.structure_level)}
          </span>

          {/* 标题 */}
          <span className="flex-1 truncate">{node.title}</span>

          {/* 操作按钮 */}
          <button onClick={(e) => { e.stopPropagation(); onAddChild(node); }}>
            +
          </button>
        </div>

        {/* 递归渲染子节点 */}
        {node.children?.length > 0 && renderTree(node.children, level + 1)}
      </div>
    ));
  };

  return (
    <div className="w-64 border-r overflow-y-auto p-2">
      <h3 className="font-bold mb-2">📖 故事结构</h3>
      {renderTree(buildTree(structures))}
    </div>
  );
};
```

#### 5.2.3 SceneEditor.tsx（场景编辑器）

**布局**:
```
┌────────────────────────────────────────┐
│ 场景：哈利发现信件                       │
├────────────────────────────────────────┤
│                                        │
│ 【摘要】                                │
│ ┌──────────────────────────────────┐   │
│ │ 哈利在橱柜下发现了一堆信件...      │   │
│ └──────────────────────────────────┘   │
│                                        │
│ 【正文】（可编辑）                       │
│ ┌──────────────────────────────────┐   │
│ │                                  │   │
│ │ 这是一个富文本编辑区域...         │   │
│ │ （MVP使用 textarea，               │   │
│ │   后续升级为 Tiptap）             │   │
│ │                                  │   │
│ └──────────────────────────────────┘   │
│                                        │
│ 【元数据】                              │
│ POV角色: [哈利·波特 ▼]                  │
│ 地点: [女贞路4号 ________________]      │
│ 时间: [午夜前 ____________________]      │
│ 状态: ○草稿 ●修改中 ○完成               │
│ 字数: 1,234 / 目标: 2,000              │
│                                        │
│ 【出场角色】                             │
│ ☑ 哈利·波特（主角）                     │
│ ☑ 德思礼（配角）                       │
│ ☐ 罗恩（未在本场）                      │
│ [+ 添加角色]                            │
│                                        │
└────────────────────────────────────────┘
```

#### 5.2.4 CharacterEditor.tsx（角色编辑器）

**布局**:
```
┌────────────────────────────────────────┐
│ 角色：哈利·波特                          │
├────────────────────────────────────────┤
│                                        │
│ 【基本信息】                             │
│ 姓名: [哈利·波特 ________________]      │
│ 角色: [●主角 ○反派 ○配角 ○路人]         │
│ 原型: [英雄 ____________________]        │
│ 外貌: [__________________________]      │
│ 年龄: [11 ____] 性别: [男 ▼]           │
│                                        │
│ 【心理画像】                             │
│ 动机: [寻找归属感和家庭 ______________] │
│ 恐惧: [被孤立和误解 ________________]   │
│ 欲望: [被爱和接受 ________________]     │
│ 弱点: [冲动和固执 ________________]     │
│                                        │
│ 【背景故事】（可选）                      │
│ ┌──────────────────────────────────┐   │
│ │ 孤儿，住在姨妈家...               │   │
│ └──────────────────────────────────┘   │
│                                        │
│ 【角色弧线】（可选）                      │
│ 起点: [孤独的孤儿 ________________]     │
│ 终点: [找到属于自己的家园 ___________]  │
│                                        │
│ 【关系网络】                             │
│ ┌──────────────────────────────────┐   │
│ │  [罗恩] ──好友── [哈利] ──好友──   │   │
│ │                         [赫敏]    │   │
│ └──────────────────────────────────┘   │
│ [+ 添加关系]                            │
│                                        │
│ 【出场统计】                             │
│ 总出场: 23 场                          │
│ POV 章节: 15 章                        │
│ 戏份占比: 45%                           │
│                                        │
└────────────────────────────────────────┘
```

### 5.3 API 客户端 (`src/services/api/storyCreationApi.ts`)

```typescript
import { supabase } from '@/lib/supabase';

// 遵循项目 API 命名规范
export const storyCreationApi = {
  // 结构管理
  structures: {
    list: async (graphId: string): Promise<StoryStructure[]> => {
      const { data, error } = await supabase
        .from('story_structures')
        .select('*')
        .eq('graph_id', graphId)
        .order('display_order');

      if (error) throw error;
      return buildTree(data); // 辅助函数：扁平转树
    },

    create: async (data: CreateStoryStructureData): Promise<StoryStructure> => {
      const { data: result, error } = await supabase
        .from('story_structures')
        .insert(data)
        .select()
        .single();

      if (error) throw error;
      return result;
    },

    update: async (id: string, data: Partial<CreateStoryStructureData>): Promise<StoryStructure> => {
      const { data: result, error } = await supabase
        .from('story_structures')
        .update({ ...data, updated_at: new Date().toISOString() })
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return result;
    },

    delete: async (id: string): Promise<void> => {
      const { error } = await supabase
        .from('story_structures')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },

    // 🌟 模板初始化
    initializeTemplate: async (graphId: string, templateCode: string): Promise<StoryStructure[]> => {
      const { data, error } = await supabase.rpc(
        'initialize_story_template',
        { p_graph_id: graphId, p_template_code: templateCode }
      );

      if (error) throw error;
      return data;
    },
  },

  // 角色管理
  characters: {
    list: async (graphId: string): Promise<StoryCharacter[]> => { ... },
    create: async (data: CreateCharacterData): Promise<StoryCharacter> => { ... },
    update: async (id: string, data: Partial<CreateCharacterData>): Promise<StoryCharacter> => { ... },
    delete: async (id: string): Promise<void> => { ... },
  },

  // 场景详情
  scenes: {
    getByStructureId: async (structureId: string): Promise<StorySceneDetail | null> => { ... },
    create: async (data: CreateSceneDetailData): Promise<StorySceneDetail> => { ... },
    update: async (id: string, data: Partial<CreateSceneDetailData>): Promise<StorySceneDetail> => { ... },
  },

  // 出场记录
  appearances: {
    add: async (data: CreateAppearanceData): Promise<StoryAppearance> => { ... },
    remove: async (id: string): Promise<void> => { ... },
    getStats: async (characterId: string): Promise<{ total: number; asProtagonist: number }> => { ... },
  },
};
```

---

## 六、集成点与修改清单

### 6.1 需要修改的现有文件

| 文件路径 | 修改内容 |
|---------|---------|
| `shared/types/graph.ts` | 添加 story 相关枚举和接口 |
| `supabase/migrations/02_knowledge_graph.sql` | 无需修改（template_type 已是 VARCHAR）|
| `src/pages/GraphEditor.tsx` | 检测 `template_type === 'story_creation'` 并渲染 StoryEditor |
| `src/pages/Dashboard.tsx` | 在模板选择器中显示 story_creation 选项 |
| `src/components/AutoGraph/AutoGraphGenerator.tsx` | 支持 story_creation 类型的创建流程 |
| `src/i18n/locales/zh-CN.json` | 添加中文翻译 |
| `src/i18n/locales/en-US.json` | 添加英文翻译 |

### 6.2 需要新建的文件

| 文件路径 | 说明 |
|---------|------|
| `supabase/migrations/25_story_creation.sql` | 数据库迁移文件 |
| `api/routes/story/index.ts` | 路由入口 |
| `api/routes/story/structures.ts` | 结构 API |
| `api/routes/story/characters.ts` | 角色 API |
| `api/routes/story/scenes.ts` | 场景 API |
| `api/routes/story/appearances.ts` | 出场 API |
| `api/schemas/story.ts` | Zod 验证 schema |
| `src/services/api/storyCreationApi.ts` | 前端 API 客户端 |
| `src/components/StoryEditor/StoryEditor.tsx` | 主编辑器 |
| `src/components/StoryEditor/panels/StructurePanel.tsx` | 结构面板 |
| `src/components/StoryEditor/panels/CharacterPanel.tsx` | 角色面板 |
| `src/components/StoryEditor/editors/SceneEditor.tsx` | 场景编辑器 |
| `src/components/StoryEditor/editors/CharacterEditor.tsx` | 角色编辑器 |

---

## 七、MVP 任务分解

### Task 1: 数据库基础设施
- [ ] 创建 `supabase/migrations/25_story_creation.sql`
- [ ] 定义 6 张表的结构（story_structures, story_characters, story_character_relationships, story_scene_details, story_appearances, story_templates）
- [ ] 插入三幕式模板的种子数据
- [ ] 编写必要的索引和注释
- [ ] 测试本地数据库迁移：`npx supabase db reset`

### Task 2: TypeScript 类型系统
- [ ] 在 `shared/types/graph.ts` 中添加所有 story 相关的枚举和接口
- [ ] 扩展 `TemplateType` 和 `TemplateCategory`
- [ ] 更新 `TEMPLATE_TYPE_MAP`
- [ ] 运行类型检查：`npm run check:incremental`

### Task 3: 后端 API 开发
- [ ] 创建 `api/routes/story/` 目录结构
- [ ] 实现 Zod 验证 schemas
- [ ] 实现结构 CRUD API（含模板初始化逻辑）
- [ ] 实现角色 CRUD API
- [ ] 实现场景详情 CRUD API
- [ ] 实现出场记录 CRUD API
- [ ] 注册路由到主应用
- [ ] 测试 API 端点（可用 Postman 或 curl）

### Task 4: 前端 API 客户端
- [ ] 创建 `src/services/api/storyCreationApi.ts`
- [ ] 封装所有 API 调用方法
- [ ] 实现辅助函数（如 buildTree 扁平转树）
- [ ] 添加错误处理

### Task 5: UI 组件开发
- [ ] 创建 `StoryEditor` 主容器组件
- [ ] 实现 `StructurePanel` 结构树组件
- [ ] 实现 `CharacterPanel` 角色列表面板
- [ ] 实现 `SceneEditor` 场景编辑器（MVP 用 textarea）
- [ ] 实现 `CharacterEditor` 角色档案编辑器
- [ ] 基础样式和响应式布局

### Task 6: 集成与适配
- [ ] 修改 `GraphEditor.tsx` 检测 story_creation 类型
- [ ] 修改 `AutoGraphGenerator.tsx` 支持创建流程
- [ ] 添加 i18n 翻译（中英文）
- [ ] 在 Dashboard 中显示 story_creation 选项

### Task 7: 测试与优化
- [ ] 手动测试完整流程（创建→填充→查看）
- [ ] 修复发现的 bug
- [ ] 性能优化（如需要）
- [ ] 代码审查和 lint 检查

---

## 八、技术约束与决策

### 8.1 MVP 技术选型

| 组件 | 技术选择 | 原因 |
|------|---------|------|
| 富文本编辑器 | `<textarea>` + 基础格式 | MVP简化，后续升级 Tiptap |
| 画布引擎 | 复用现有 React Flow | 减少开发成本 |
| 树形展示 | 递归组件 + CSS | 轻量级，无需额外依赖 |
| 状态管理 | React useState + Context | MVP足够，后续可引入 Zustand |
| API 调用 | Supabase Client | 与项目一致 |

### 8.2 需要避免的过度设计

❌ **MVP 不做**:
- 多轨道视图系统（太复杂）
- AI 功能集成（独立的大块工作）
- 复杂的拖拽排序（用按钮代替）
- 版本控制系统（Phase 2）
- 协作功能（Phase 4）
- 导出功能（Phase 3）
- 设定/世界观管理（Phase 2）
- 故事线管理（Phase 2）

---

## 九、验收标准（Definition of Done）

### 9.1 功能验收
- [ ] 用户可以通过 Dashboard 创建 `story_creation` 类型的图谱
- [ ] 创建时可选择"三幕式"模板，系统自动生成 3 幕 + 10 序列的骨架
- [ ] 用户可以在结构树中添加/编辑/删除 幕、章、场景
- [ ] 用户可以创建角色档案（至少包含姓名、角色类型、动机）
- [ ] 用户可以为场景填写摘要和正文内容
- [ ] 用户可以将角色关联到场景（标记出场）
- [ ] 用户可以在角色间建立关系
- [ ] 所有数据正确持久化到数据库

### 9.2 技术验收
- [ ] `npm run check` 通过（无类型错误）
- [ ] `npm run lint` 通过（无 lint 错误）
- [ ] 数据库迁移成功执行
- [ ] API 端点返回正确的数据格式
- [ ] 前端无控制台报错

### 9.3 体验验收
- [ ] 页面加载时间 < 3秒
- [ ] 基本操作响应时间 < 500ms
- [ ] UI 布局在不同窗口大小下正常显示
- [ ] 中文输入正常工作

---

## ADDED Requirements

### Requirement: MVP 故事结构管理
系统 SHALL 在 MVP 阶段提供基础的故事结构管理能力。

#### Scenario: 使用三幕式模板初始化故事
- **WHEN** 用户创建新的 story_creation 图谱并选择"三幕式"模板
- **THEN** 系统 SHALL 自动创建包含 3 个 Act 和 10 个 Sequence 的骨架结构
- **AND** 每个 Sequence 应有默认标题和描述
- **AND** 结构应按正确的父子关系和顺序组织

#### Scenario: 手动管理结构节点
- **WHEN** 用户在结构面板中操作
- **THEN** 用户可以添加任意层级的子节点（Act 下加 Chapter，Chapter 下加 Scene）
- **AND** 用户可以编辑节点的标题和摘要
- **AND** 用户可以删除节点及其所有子节点
- **AND** 用户可以调整同级别节点的顺序

### Requirement: MVP 角色管理
系统 SHALL 在 MVP 阶段提供基础的角色管理能力。

#### Scenario: 创建角色档案
- **WHEN** 用户点击"添加角色"
- **THEN** 系统 SHALL 显示角色编辑表单（必填：姓名、角色类型；可选：外貌、年龄、心理画像等）
- **AND** 用户保存后角色出现在角色面板中

#### Scenario: 建立角色关系
- **WHEN** 用户在角色详情中点击"添加关系"
- **THEN** 用户可以选择目标角色和关系类型（从预定义的 15 种中选择）
- **AND** 可以设置关系强度（1-10）
- **AND** 关系显示在角色的关系网络中

### Requirement: MVP 场景内容编辑
系统 SHALL 在 MVP 阶段提供基础的场景内容编辑能力。

#### Scenario: 编辑场景内容
- **WHEN** 用户在结构树中选中一个 Scene 节点
- **THEN** 系统 SHALL 显示场景编辑器
- **AND** 用户可以输入场景摘要（短文本）
- **AND** 用户可以输入场景正文（长文本，MVP 使用 textarea）
- **AND** 用户可以选择 POV 角色（下拉选择已创建的角色）
- **AND** 用户可以填写地点和时间等元数据

#### Scenario: 管理场景中的角色出场
- **WHEN** 用户在场景编辑器的"出场角色"区域操作
- **THEN** 用户可以从角色列表勾选在该场景出场的角色
- **AND** 用户可以指定每个角色在该场景的角色类型（主角/配角/提及等）
- **AND** 出场记录自动保存并在角色详情中显示统计

---

## REMOVED Requirements

（MVP 阶段无移除的需求，所有需求都是新增的）

---

## 附录

### A. MVP 文件清单汇总

**新建文件（16个）**:
1. `supabase/migrations/25_story_creation.sql`
2. `api/routes/story/index.ts`
3. `api/routes/story/structures.ts`
4. `api/routes/story/characters.ts`
5. `api/routes/story/scenes.ts`
6. `api/routes/story/appearances.ts`
7. `api/schemas/story.ts`
8. `src/services/api/storyCreationApi.ts`
9. `src/components/StoryEditor/StoryEditor.tsx`
10. `src/components/StoryEditor/panels/StructurePanel.tsx`
11. `src/components/StoryEditor/panels/CharacterPanel.tsx`
12. `src/components/StoryEditor/editors/SceneEditor.tsx`
13. `src/components/StoryEditor/editors/CharacterEditor.tsx`

**修改文件（6个）**:
1. `shared/types/graph.ts`
2. `src/pages/GraphEditor.tsx`
3. `src/pages/Dashboard.tsx`
4. `src/components/AutoGraph/AutoGraphGenerator.tsx`
5. `src/i18n/locales/zh-CN.json`
6. `src/i18n/locales/en-US.json`

**总计: 22 个文件**

### B. 预估工作量

| 任务 | 预估时间 | 复杂度 |
|------|---------|--------|
| Task 1: 数据库 | 2 小时 | 低 |
| Task 2: 类型系统 | 1 小时 | 低 |
| Task 3: 后端 API | 4-6 小时 | 中 |
| Task 4: 前端 API 客户端 | 1 小时 | 低 |
| Task 5: UI 组件 | 6-8 小时 | 中高 |
| Task 6: 集成适配 | 2 小时 | 低 |
| Task 7: 测试优化 | 2-3 小时 | 中 |
| **总计** | **18-23 小时** | |

### C. 风险与缓解

| 风险 | 影响 | 概率 | 缓解措施 |
|------|------|------|---------|
| 数据库迁移失败 | 高 | 低 | 先在测试环境验证 SQL |
| 类型定义冲突 | 中 | 低 | 使用 namespace 或独立文件隔离 |
| API 性能问题 | 低 | 低 | MVP 数据量小，暂不优化 |
| UI 复杂度超预期 | 中 | 中 | 严格遵循 MVP 范围，砍掉非必要功能 |
| 与现有代码冲突 | 中 | 中 | 充分阅读现有代码，遵循既有模式 |
