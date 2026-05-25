# 小说/故事创作图谱 (story_creation) 需求规格说明书

## Why
用户计划在现有 KnowledgeMap 项目中添加一种全新的图谱类型——**小说/故事创作 (story_creation)**，用于支持创意写作过程中的结构化组织、AI 辅助创作和多维度可视化。该类型与现有的 17 种普通知识图谱以及 `topic_research`（专题研究）有本质区别，需要独立的数据模型、UI 组件和 AI 交互逻辑。

## What Changes
本规格为**纯需求分析文档**，不涉及代码变更。
- 系统性地定义 story_creation 类型的完整功能需求
- 设计新的数据模型和结构层级
- 规划特殊的 UI 交互和多维视图
- 定义 AI 辅助创作的交互模式
- 为未来 MVP 实施提供清晰的规格基础

## Impact
- Affected specs: [survey-graph-types/spec.md](survey-graph-types/spec.md)（作为前置调研）
- Affected code: 未来将影响以下系统：
  - 数据库 Schema（新增表和字段）
  - 类型定义系统（TemplateType 枚举扩展）
  - 前端 UI 组件（新增编辑器、视图组件）
  - 后端服务层（新增业务逻辑）
  - AI 服务集成（新的 prompt 模板和生成流程）

---

## 一、项目定位与命名

### 1.1 类型标识
- **技术名称**: `story_creation`
- **中文名称**: 小说/故事创作
- **所属大类**: 新增第五个 TemplateCategory → `creative`（创意类）

### 1.2 复杂度对标
- **等同 `topic_research`**：需要独立的 Backbone 系统（StoryStructure）、Preset 系统（经典模板）、专用 UI 组件
- **独特性**：引入"多轨道/图层"创新概念，超越传统的单一图谱视图

### 1.3 目标用户
- 小说作者（网络文学、传统出版）
- 剧本编剧（影视、游戏）
- 创意写作者（需要结构化工具辅助创作）

---

## 二、故事结构层级体系

### 2.1 经典叙事结构（五级层次）

```
Story（故事）
└── Act（幕）- 通常 3 幕（开端/发展/高潮/结局）
    └── Sequence（序列）- 幕内的情节单元
        └── Chapter（章节）- 叙事的基本容器
            └── Scene（场景）- 最小的戏剧单元
```

#### 层级详解

| 层级 | 英文 | 数量范围 | 说明 | 示例 |
|------|------|---------|------|------|
| L1 | Story | 1 | 整个作品 | 《哈利·波特与魔法石》 |
| L2 | Act | 3-5 | 大的结构划分 | 第一幕：平凡世界→冒险召唤 |
| L3 | Sequence | 6-12/幕 | 情节段落 | "海格到来"序列 |
| L4 | Chapter | 20-80 | 阅读单元 | "生日信件"章节 |
| L5 | Scene | 100-500 | 戏剧场景 | "哈利发现信件"场景 |

### 2.2 与现有 NodeLevel 的对比

**现有系统**（用于知识图谱）:
```typescript
type NodeLevel = "root" | "core" | "sub" | "normal" | "leaf";
```

**新系统**（用于故事图谱）:
```typescript
enum StoryStructureLevel {
  STORY = "story",        // 故事根节点
  ACT = "act",            // 幕
  SEQUENCE = "sequence",  // 序列
  CHAPTER = "chapter",    // 章节
  SCENE = "scene",        // 场景
}
```

**关键差异**:
- ❌ 不使用 root/core/sub/normal/leaf 的层级体系
- ✅ 使用语义化的叙事层级（Act/Sequence/Chapter/Scene）
- ✅ 支持多个同级节点（多幕、多章、多场景）
- ✅ 层级数量固定且含义明确

---

## 三、节点类型系统

### 3.1 四大核心节点类型

#### 3.1.1 角色节点 (Character)

**用途**: 故事中的角色实体

**必需属性**:
```typescript
interface CharacterNode {
  // 基本信息
  name: string;              // 角色名称
  role_type: RoleType;       // 主角/反派/配角/路人
  archetype?: string;        // 原型（英雄/导师/阴影等）

  // 外貌特征
  appearance?: string;       // 外貌描述
  age?: number | string;     // 年龄
  gender?: string;           // 性别

  // 心理画像
  personality: string[];     // 性格特征标签
  motivation: string;        // 核心动机
  fear: string;              // 核心恐惧
  desire: string;            // 核心欲望
  flaw: string;              // 致命弱点

  // 背景故事
  backstory?: string;        // 背景故事文本
  history?: string;          // 个人历史

  // 角色弧线
  arc_start: string;         // 起始状态
  arc_midpoint?: string;     // 中间转变
  arc_end: string;           // 最终状态

  // 关系
  relationships: CharacterRelationship[];

  // 出场统计（自动计算）
  appearances: SceneAppearance[];
}
```

**特殊功能**:
- ✅ 详细角色档案（心理画像+背景故事）
- ✅ 角色弧线追踪（起始→转变→最终状态）
- ✅ 关系网络图谱（与其他角色的复杂关系）
- ✅ 出场频率分析（在哪些场景出现、戏份占比）

#### 3.1.2 场景/情节节点 (Scene)

**用途**: 具体的叙事事件或戏剧场景

**必需属性**:
```typescript
interface SceneNode {
  // 基本信息
  title: string;             // 场景标题
  synopsis: string;          // 场景摘要（短）
  content?: string;          // 完整内容（长文本，富文本）

  // 结构位置
  structure_level: StoryStructureLevel;
  parent_id?: string;        // 所属章节/序列/幕

  // 叙事要素（POV）
  pov_character_id?: string; // POV 角色
  character_goal: string;    // 该场景的角色目标
  conflict: string;          // 冲突描述
  turning_point?: string;    // 转折点
  outcome: string;           // 结果

  // 时空属性
  time_setting: TimeSetting; // 时间段（早晨/夜晚等）
  location_id?: string;      // 地点（关联到设定节点）
  duration?: string;         // 持续时间

  // 情绪/氛围
  mood: MoodTag[];           // 情绪基调（紧张/温馨/悲伤）
  intensity: number;         // 强度等级（1-10）
  pace: PaceType;            // 节奏（快/慢/停顿）

  // 写作状态
  writing_status: WritingStatus; // 草稿/修改/定稿
  word_count_target?: number;    // 字数目标
  word_count_actual?: number;   // 实际字数
  version_history?: Version[];   // 版本历史

  // 关联
  participating_characters: string[]; // 出场角色ID列表
  storyline_ids: string[];           // 所属故事线ID列表
  tags: string[];                    // 自定义标签
}
```

**特殊功能**:
- ✅ 节点内嵌写作（富文本编辑器，类似 Scrivener）
- ✅ 叙事要素记录（POV、目标、冲突、转折）
- ✅ 时空属性（时间、地点、持续时间）
- ✅ 情绪/氛围标记（强度、节奏、情绪标签）
- ✅ 写作状态跟踪（字数、版本历史）

#### 3.1.3 设定/世界观节点 (Setting/Worldbuilding)

**用途**: 故事世界的背景设定元素

**子类型**:
```typescript
enum SettingType {
  LOCATION = "location",       // 地点（霍格沃茨、 Gotham City）
  ORGANIZATION = "organization", // 组织（凤凰社、正义联盟）
  ITEM = "item",               // 重要物品（魔戒、光剑）
  MAGIC_SYSTEM = "magic_system", // 魔法/力量体系
  CULTURE = "culture",         // 文化/社会规则
  HISTORY_EVENT = "history_event", // 历史事件
  RULE = "rule",               // 世界规则（物理法则等）
}
```

**通用属性**:
```typescript
interface SettingNode {
  name: string;
  setting_type: SettingType;
  description: string;         // 详细描述
  rules?: string[];            // 相关规则
  associated_characters: string[]; // 关联角色
  associated_scenes: string[];    // 关联场景
  lore_documents?: string[];      // 补充设定文档
}
```

#### 3.1.4 故事线/线索节点 (Storyline/Thread)

**用途**: 组织和追踪多条并行的叙事线索

**类型**:
```typescript
enum StorylineType {
  MAIN_PLOT = "main_plot",           // 主线
  SUBPLOT = "subplot",               // 支线
  CHARACTER_ARC = "character_arc",    // 角色弧线
  ROMANTIC_LINE = "romantic_line",   // 感情线
  MYSTERY_LINE = "mystery_line",     // 悬疑/谜团线
  THEMATIC_LINE = "thematic_line",   // 主题线
  CUSTOM = "custom",                 // 自定义
}
```

**属性**:
```typescript
interface StorylineNode {
  name: string;
  storyline_type: StorylineType;
  color: string;                     // 显示颜色
  description: string;               // 线索简介
  status: StorylineStatus;           // 进行中/已完结/暂停
  scene_ids: string[];               // 包含的场景列表
  related_characters: string[];      // 涉及的角色
  importance: number;                // 重要性权重（1-5）
}
```

---

## 四、关系类型系统

### 4.1 复用现有关系类型

从现有系统中继承的关系类别 ([shared/types/graph.ts#L7-L14](shared/types/graph.ts#L7-L14)):
- ✅ `hierarchical`（层级关系）：Story → Act → Sequence → Chapter → Scene
- ✅ `temporal`（时间关系）：场景的时间顺序
- ✅ `causal`（因果关系）：事件 A 导致事件 B
- ✅ `semantic`（语义关系）：相关联的概念

### 4.2 新增故事特有关系类型

#### 4.2.1 角色关系 (Character Relationships)
```typescript
enum CharacterRelationshipType {
  // 家族关系
  FAMILY_PARENT = "family_parent",       // 父母
  FAMILY_SIBLING = "family_sibling",     // 兄弟姐妹
  FAMILY_RELATIVE = "family_relative",   // 其他亲属

  // 社会关系
  FRIEND = "friend",                     // 朋友
  ENEMY = "enemy",                       // 敌人
  RIVAL = "rival",                       // 竞争对手
  MENTOR = "mentor",                     // 导师
  ALLY = "ally",                         // 盟友
  BOSS = "boss",                         // 上司
  SUBORDINATE = "subordinate",           // 下属

  // 情感关系
  ROMANTIC_INTEREST = "romantic_interest", // 恋爱对象
  ROMANTIC_EX = "romantic_ex",           // 前任
  SECRET_ADMIRER = "secret_admirer",     // 暗恋者

  // 复杂关系
  LOVE_HATE = "love_hate",              // 爱恨交织
  BETRAYER = "betrayer",                // 背叛者
  MANIPULATOR = "manipulator",          // 操纵者
  PROTECTOR = "protector",              // 保护者
  OBSESSED = "obsessed",                // 执迷者

  // 自定义
  CUSTOM = "custom",
}

interface CharacterRelationship {
  source_character_id: string;
  target_character_id: string;
  relationship_type: CharacterRelationshipType;
  strength: number;                    // 强度（1-10）
  status: RelationshipStatus;          // 当前状态
  evolution_notes?: string;            // 关系演变记录
  start_scene_id?: string;             // 关系开始的场景
  end_scene_id?: string;               // 关系结束/转变的场景
}
```

#### 4.2.2 出场关系 (Appearance Relationship)
```typescript
interface AppearanceRelationship {
  character_id: string;
  scene_id: string;
  role_in_scene: SceneRole;            // 主角/配角/旁观者/提及
  importance: number;                  // 在该场景的重要性（1-5）
  emotional_state?: string;             // 该场景的情绪状态
  actions?: string[];                  // 主要行动
}

enum SceneRole {
  PROTAGONIST = "protagonist",         // 主角
  ANTAGONIST = "antagonist",           // 反派
  SUPPORTING = "supporting",           // 配角
  MINOR = "minor",                     // 小角色
  MENTIONED = "mentioned",             // 仅被提及
  OFF_SCREEN = "off_screen",           // 幕后/画外音
}
```

#### 4.2.3 故事线包含关系 (Storyline Membership)
```typescript
interface StorylineMembership {
  storyline_id: string;
  scene_id: string;
  sequence_order: number;              // 在线索中的顺序
  significance: string;                // 该场景对线索的意义
}
```

---

## 五、多轨道/图层视图系统（创新概念）

### 5.1 核心灵感来源

类比视频编辑软件的多轨道系统和图像编辑的图层面板：
- **视频轨**: 主视频层 + 叠加层 + 特效层 + 字幕层
- **音频轨**: 对白音轨 + 音乐音轨 + 音效轨
- **故事轨道**: 主线层 + 支线层 + 角色弧线层 + 世界观层 + 情感线层

### 5.2 轨道定义

```typescript
interface StoryTrack {
  id: string;
  track_type: TrackType;
  label: string;
  color: string;
  visibility: boolean;                 // 是否可见
  locked: boolean;                    // 是否锁定
  opacity: number;                    // 不透明度（0-1）
  nodes: TrackNode[];                 // 该轨道上的节点
}

enum TrackType {
  STRUCTURE_TRACK = "structure_track",     // 结构轨道（幕/序列/章/ scene）
  MAIN_PLOT_TRACK = "main_plot_track",     // 主线轨道
  SUBPLOT_TRACK_N = "subplot_track_n",     // 支线轨道 N（可多个）
  CHARACTER_ARC_TRACK = "character_arc_track", // 角色弧线轨道
  SETTING_TRACK = "setting_track",         // 设定/世界观轨道
  EMOTIONAL_TRACK = "emotional_track",     // 情绪/氛围轨道
  TIME_TRACK = "time_track",               // 时间线轨道
  CUSTOM_TRACK = "custom_track",           // 自定义轨道
}
```

### 5.3 视觉呈现

**布局模式**:
```
┌─────────────────────────────────────────────────┐
│  轨道控制面板                                    │
│  ☑ 主线（红色）  ☑ 支线A（蓝色）  ☑ 角色B弧线（绿色）│
│  ☑ 情绪线（紫色）  ☑ 时间轴（灰色）               │
├─────────────────────────────────────────────────┤
│                                                 │
│  ═══ 主线轨道 ═══                               │
│  [场景1] ──→ [场景3] ──→ [场景5] ──→ [高潮]     │
│                                                 │
│  ─── 支线A轨道 ──                               │
│  [场景2] ──→ [场景4] ──→ [场景6]                │
│                                                 │
│  ─·· 角色B弧线轨道 ··                            │
│  [登场] ──→ [转折] ──→ [成长] ──→ [结局]        │
│                                                 │
│  ─ ─ 情绪线轨道 ─ ─                             │
│  😐平静 → 😰紧张 → 😢悲伤 → 😄释然              │
│                                                 │
│  ═══ 时间轴（底层参考）═══                       │
│  第1天 │ 第3天 │ 第1周 │ 第1月 │ 第1年           │
└─────────────────────────────────────────────────┘
```

**交互特性**:
- ✅ 轨道显示/隐藏切换
- ✅ 轨道锁定（防止误操作）
- ✅ 轨道透明度调节（聚焦某条线索时淡化其他）
- ✅ 节点拖拽重排（调整顺序）
- ✅ 跨轨道连线（显示因果关系或交叉点）
- ✅ 缩放控制（查看全局或聚焦细节）

---

## 六、四种特殊视图模式

### 6.1 角色视角视图 (Character-Centric View)

**定义**: 以某个角色为中心，展示其相关的所有元素

**展示内容**:
```
┌─────────────────────────────────────┐
│  🧑 角色选择器：[哈利·波特 ▼]       │
├─────────────────────────────────────┤
│                                     │
│  👤 角色档案卡片                      │
│  ┌─────────────────────────┐        │
│  │ 姓名：哈利·波特          │        │
│  │ 角色：主角              │        │
│  │ 动机：寻找归属感         │        │
│  │ 弧线：孤儿→英雄→领袖    │        │
│  └─────────────────────────┘        │
│                                     │
│  🔗 关系网络                         │
│  [罗恩]──好友──[哈利]──好友──[赫敏]  │
│    │                   │            │
│  [敌对]               [导师]         │
│    ↓                   ↓            │
│  [马尔福]            [邓布利多]      │
│                                     │
│  📖 出场场景时间线                    │
│  第1章 ●━━━●第5章 ●━━●第10章...     │
│        登场   转折   高潮            │
│                                     │
│  📊 出场统计                         │
│  • 总出场次数：156 场                │
│  • 戏份占比：45%                     │
│  • POV 场景：23 章                   │
│  • 重要性趋势：上升 ↑                │
└─────────────────────────────────────┘
```

**功能**:
- 切换不同角色查看其视角
- 高亮该角色涉及的所有场景和关系
- 显示角色弧线的进展
- 统计出场数据和重要性变化

### 6.2 时间线视图 (Timeline View)

**定义**: 按故事内的时间顺序展示所有事件

**布局选项**:
- **线性时间线**: 从左到右（或从上到下）按时间排列
- **并行时间线**: 多条线索并列显示，标注同时发生的事件
- **日历视图**: 按日期/时段网格化展示

**展示内容**:
```
时间轴（故事内时间）
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━→

[第1天]  [第3天]    [第1周]     [第1月]    [第1年]
  │        │          │           │          │
  ▼        ▼          ▼           ▼          ▼
┌────┐  ┌────┐    ┌────┐     ┌────┐     ┌────┐
│场景1│  │场景2│    │场景5│     │场景12│    │场景30│
│早晨 │  │夜晚 │    │日常 │     │战斗 │     │结局 │
└────┘  └────┘    └────┘     └────┘     └────┘
  │        │          │           │          │
  ├─主线───┤          ├─主线─────┤ ├─最终决战─┤
  │        ├─支线A───┤           │          │
  │        │          ├─支线B────┤          │
```

**功能**:
- 缩放控制（查看整体时间跨度或聚焦某个时段）
- 并行事件检测（提示同一时间段发生的多个事件）
- 时间矛盾检查（如：角色不可能同时在两地）
- 时间跳跃标注（如："三年后..."）

### 6.3 因果关系图谱视图 (Causal Graph View)

**定义**: 类似 Scyn 的画布模式，自由布局场景卡片并用连线表示因果关系

**视觉风格**:
- 节点 = 圆角矩形卡片（场景/事件）
- 边 = 有向箭头（因果关系）
- 颜色编码 = 情绪基调或故事线归属
- 大小 = 重要性或强度

**交互**:
- 自由拖拽节点位置
- 手动绘制连接边
- 自动布局算法（力导向/层级/径向）
- 缩放和平移
- 点击节点展开详情面板

**示例**:
```
        ┌──────────┐
        │ 发现信件 │
        └────┬─────┘
             │ 导致
             ▼
    ┌────────────────┐
    │ 海格到来揭示身世 │
    └────┬───────────┘
         │
    ┌────┴────┬──────────┐
    │ 导致    │ 导致      │ 导致
    ▼         ▼          ▼
┌──────┐  ┌──────┐   ┌──────────┐
│决定入学│  │购买物资│   │遇见罗恩  │
└──────┘  └──────┘   └────┬─────┘
                        │ 导致
                        ▼
                 ┌──────────┐
                 │ 成为朋友  │
                 └──────────┘
```

### 6.4 多线索对比视图 (Multi-Thread Comparison View)

**定义**: 并排显示多条故事线，方便检查节奏和平衡

**布局**:
```
┌──────────────────────────────────────────────────┐
│  📊 多线索对比视图                                │
├──────────────────────────────────────────────────┤
│                                                  │
│  主线：  [起]━━●━━●━━●━━[转]━━●━━●━━[高潮]━━[结] │
│          第1章  5  10  15  20   25  30  35   40  │
│                                                  │
│  支线A：      [起]━━●━━●━━[结]                   │
│               第8章 15  22  28                   │
│                                                  │
│  角色B弧线：[起]━━●━━●━━●━━●━━[转]━━●━━[结]     │
│            第1章  5  10 15 20  25   30  35  40   │
│                                                  │
│  感情线：        [起]━━●━━●━━[转]━━●━━[结]       │
│                第12章 18  24  30   36  40        │
│                                                  │
├──────────────────────────────────────────────────┤
│  ⚠️ 警告：第20-30章主线过于密集，建议分散支线A    │
│  💡 建议：第35章可增加感情线冲突以提升张力        │
└──────────────────────────────────────────────────┘
```

**分析功能**:
- 线索密度热力图（哪些章节过于拥挤或空旷）
- 节奏平衡检查（高潮/低谷分布是否合理）
- 交叉点标注（多条线索交汇的关键场景）
- 空窗期检测（某条线索长时间未出现）

---

## 七、预设模板系统 (Story Structure Templates)

### 7.1 经典结构模板

#### 7.1.1 三幕式结构 (Three-Act Structure)
```
第一幕（Setup）- 25%
├── 开场现状（Ordinary World）
├── 冒险召唤（Call to Adventure）
├── 拒绝召唤（Refusal of Call）
└── 第一转折点（Crossing the Threshold）

第二幕（Confrontation）- 50%
├── 试炼盟友（Tests, Allies, Enemies）
├── 接近最深的洞穴（Approach to the Inmost Cave）
├── 重大危机（Ordeal）
├── 奖赏（Reward）
└── 第二转折点（Resurrection）

第三幕（Resolution）- 25%
├── 回归之路（The Road Back）
├── 复活/变革（Master of Two Worlds）
└── 带着万灵药回归（Return with Elixir）
```

#### 7.1.2 英雄之旅 (Hero's Journey) - 12 阶段
```
1. 平凡世界（Ordinary World）
2. 冒险召唤（Call to Adventure）
3. 拒绝召唤（Refusal of Call）
4. 遇见导师（Meeting the Mentor）
5. 跨越门槛（Crossing the Threshold）
6. 考验盟友敌人（Tests, Allies, Enemies）
7. 接近洞穴深处（Approach to the Inmost Cave）
8. 磨难（Ordeal）
9. 奖赏（Reward）
10. 返回之路（The Road Back）
11. 复活（Resurrection）
12. 带着万灵药回归（Return with Elixir）
```

#### 7.1.3 救猫咪节拍（Save the Cat! Beats）- 15 节拍
```
1. 开场影像（Opening Image）
2. 主题陈述（Theme Stated）
3. 铺垫（Set-Up）
4. 机会（Catalyst）
5. 争论（Debate）
6. 进入第二幕（Break into Two）
7. B故事（B Story）
8. 游戏与娱乐（Fun and Games）
9. 中点（Midpoint）
10. 坏家伙逼近（Bad Guys Close In）
11. 一无所有（All Is Lost）
12. 黑暗灵魂之夜（Dark Night of the Soul）
13. 进入第三幕（Break into Three）
14. 终局（Finale）
15. 最终画面（Final Image）
```

#### 7.1.4 其他可选模板
- **七点法结构**（Seven Point Plot）
- **弗雷塔格金字塔**（Freytag's Pyramid）
- **故事圆环**（Dan Harmon's Story Circle）
- **起承转合**（Kishōtenketsu，东亚叙事结构）
- **自定义模板**（用户创建并保存）

### 7.2 模板数据结构

```typescript
interface StoryStructureTemplate {
  id: string;
  name: string;
  name_zh: string;
  description: string;
  source: string;                    // 来源（如："Blake Snyder"）
  structure_definition: TemplateBeat[];
  category: TemplateCategory;        // "classical" | "genre-specific" | "custom"
}

interface TemplateBeat {
  id: string;
  name: string;
  name_zh: string;
  order: number;
  act_number?: number;              // 属于第几幕
  percentage_range: [number, number]; // 在故事中的位置百分比
  description: string;              // 该节拍的说明
  key_questions?: string[];         // 引导性问题
  example?: string;                 // 示例
  required_elements?: string[];     // 必需要素
}
```

---

## 八、AI 辅助创作系统

### 8.1 交互模式：按需生成 + 手动编辑

**核心理念**: 用户保持完全控制权，AI 作为智能助手按需提供建议

**工作流程**:
```
用户操作 → 触发 AI → 生成建议 → 用户审核 → 接受/修改/拒绝
```

### 8.2 AI 功能模块（备忘清单）

> ⚠️ **注意**: 以下功能留作未来实施备忘，本次需求分析仅定义接口规范

#### 8.2.1 场景内容生成 (Scene Content Generation)

**触发条件**:
- 用户选中一个空白场景节点
- 或选中已有场景点击"AI 扩写"

**输入上下文**:
```typescript
interface SceneGenerationContext {
  story_premise: string;            // 故事前提
  previous_scenes_summary: string;  // 前文摘要
  current_scene_info: {
    synopsis: string;               // 场景摘要
    pov_character: CharacterNode;   // POV 角色
    characters_present: CharacterNode[]; // 出场角色
    location: SettingNode;          // 地点
    time_setting: TimeSetting;      // 时间
    goal: string;                   // 场景目标
    conflict: string;               // 冲突
    mood: MoodTag[];                // 期望情绪
    pace: PaceType;                 // 期望节奏
  };
  style_guide: string;              // 写作风格指南
  previous_content_sample: string;  // 前文样本（保持风格一致）
}
```

**输出格式**:
```typescript
interface SceneGenerationResult {
  content: string;                  // 生成的场景正文
  dialogue_blocks: DialogueBlock[]; // 对话块（可单独编辑）
  action_lines: ActionLine[];       // 描写行
  narrative_bridges: string[];      // 叙述过渡
  suggestions: AISuggestion[];      // 改进建议
}
```

**用户交互**:
- ✅ 整体接受 / 分块接受
- ✅ 手动编辑任意部分
- ✅ 重新生成（调整参数后）
- ✅ 版本对比（保留历史版本）

#### 8.2.2 一致性检查 (Consistency Checking)

**检查维度**:

| 维度 | 检查项 | 示例 |
|------|--------|------|
| **角色一致性** | 性格、行为、能力是否前后一致 | "哈利在第5章说自己不会飞行，但在第10章直接骑扫帚了？" |
| **时间一致性** | 时间线是否有矛盾 | "罗恩在第3章已经知道秘密，但第8章表现得像第一次听说？" |
| **空间一致性** | 地点距离、移动时间是否合理 | "角色在早上于伦敦，下午出现在爱丁堡（无交通工具说明）？" |
| **情节连贯性** | 伏笔是否回收、因果链是否完整 | "第2章提到的神秘钥匙在第15章从未再次出现？" |
| **设定合规性** | 是否违反已建立的世界观规则 | "魔法部规定不能 apparate 到霍格沃茨，但角色直接出现了？" |

**输出格式**:
```typescript
interface ConsistencyReport {
  overall_score: number;            // 一致性评分（0-100）
  issues: ConsistencyIssue[];
  summary: string;
}

interface ConsistencyIssue {
  severity: "error" | "warning" | "info";
  category: ConsistencyCategory;
  location: {                     // 问题位置
    chapter_id: string;
    scene_id: string;
    text_excerpt?: string;
  };
  description: string;            // 问题描述
  suggestion: string;             // 修复建议
  conflicting_references: string[]; // 冲突的引用位置
}
```

#### 8.2.3 对话生成 (Dialogue Generation)

**输入上下文**:
```typescript
interface DialogueGenerationContext {
  speakers: {
    character: CharacterNode;
    emotional_state: string;       // 当前情绪
    goal_in_conversation: string;  // 对话目标
    subtext?: string;             // 潜台词
  }[];
  conversation_context: string;    // 对话背景
  relationship_between_speakers: CharacterRelationship;
  scene_mood: MoodTag[];
  plot_requirements: string[];     // 必须传达的信息点
  voice_samples: {                 // 角色过往对话样本
    character_id: string;
    samples: string[];
  }[];
}
```

**输出**:
```typescript
interface DialogueGenerationResult {
  dialogue_lines: DialogueLine[];
  stage_directions: StageDirection[];
  emotional_arcs: EmotionalArc[];  // 每句话的情绪变化
}
```

#### 8.2.4 结构分析建议 (Structural Analysis)

**分析维度**:

| 分析项 | 输出 | 用途 |
|--------|------|------|
| **节奏曲线** | 图表（强度 vs 章节） | 检查高潮低谷分布 |
| **情感地图** | 热力图（情绪 vs 场景） | 检查情感多样性 |
| **角色平衡** | 统计（出场率 vs 重要性） | 检查戏份分配 |
| **线索密度** | 图表（活跃度 vs 进度） | 检查线索节奏 |
| **伏笔追踪** | 列表（设置 vs 回收） | 检查完整性 |
| **三幕平衡** | 百分比（每幕占比） | 检查结构合理性 |

---

## 九、数据库 Schema 设计草案

### 9.1 新增表

#### 9.1.1 story_structures 表（故事结构骨架）
```sql
CREATE TABLE IF NOT EXISTS story_structures (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  graph_id UUID NOT NULL REFERENCES knowledge_graphs(id) ON DELETE CASCADE,
  structure_level VARCHAR(20) NOT NULL, -- 'story'|'act'|'sequence'|'chapter'|'scene'
  parent_structure_id UUID REFERENCES story_structures(id) ON DELETE CASCADE,
  title VARCHAR(512) NOT NULL,
  display_order INTEGER NOT NULL DEFAULT 0,
  template_beat_id VARCHAR(100), -- 关联到模板节拍（可选）
  metadata JSONB DEFAULT '{}',   -- 级别特定属性
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_story_structures_graph_id ON story_structures(graph_id);
CREATE INDEX idx_story_structures_parent ON story_structures(parent_structure_id);
CREATE INDEX idx_story_structures_level ON story_structures(structure_level);
```

#### 9.1.2 story_characters 表（角色档案）
```sql
CREATE TABLE IF NOT EXISTS story_characters (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  graph_id UUID NOT NULL REFERENCES knowledge_graphs(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  role_type VARCHAR(50) NOT NULL, -- 'protagonist'|'antagonist'|'supporting'|'minor'
  archetype VARCHAR(100),
  profile JSONB NOT NULL DEFAULT '{}', -- 外貌、年龄、性别等基本信息
  psychology JSONB NOT NULL DEFAULT '{}', -- 性格、动机、恐惧、欲望等
  backstory TEXT,
  arc_data JSONB NOT NULL DEFAULT '{"start": "", "midpoint": "", "end": ""}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

#### 9.1.3 story_character_relationships 表（角色关系）
```sql
CREATE TABLE IF NOT EXISTS story_character_relationships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  graph_id UUID NOT NULL REFERENCES knowledge_graphs(id) ON DELETE CASCADE,
  source_character_id UUID NOT NULL REFERENCES story_characters(id) ON DELETE CASCADE,
  target_character_id UUID NOT NULL REFERENCES story_characters(id) ON DELETE CASCADE,
  relationship_type VARCHAR(50) NOT NULL,
  strength INTEGER NOT NULL DEFAULT 5 CHECK (strength BETWEEN 1 AND 10),
  status VARCHAR(50) DEFAULT 'active',
  evolution_notes TEXT,
  start_scene_id UUID,
  end_scene_id UUID,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(graph_id, source_character_id, target_character_id, relationship_type)
);
```

#### 9.1.4 story_settings 表（设定/世界观）
```sql
CREATE TABLE IF NOT EXISTS story_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  graph_id UUID NOT NULL REFERENCES knowledge_graphs(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  setting_type VARCHAR(50) NOT NULL, -- 'location'|'organization'|'item'|...
  description TEXT NOT NULL,
  details JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

#### 9.1.5 story_storylines 表（故事线）
```sql
CREATE TABLE IF NOT EXISTS story_storylines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  graph_id UUID NOT NULL REFERENCES knowledge_graphs(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  storyline_type VARCHAR(50) NOT NULL, -- 'main_plot'|'subplot'|'character_arc'|...
  color VARCHAR(7) DEFAULT '#3B82F6',
  description TEXT,
  status VARCHAR(50) DEFAULT 'active',
  importance INTEGER DEFAULT 3 CHECK (importance BETWEEN 1 AND 5),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

#### 9.1.6 story_scene_details 表（场景详情）
```sql
CREATE TABLE IF NOT EXISTS story_scene_details (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  graph_id UUID NOT NULL REFERENCES knowledge_graphs(id) ON DELETE CASCADE,
  node_id UUID NOT NULL, -- 关联到 knowledge_points.id
  structure_id UUID REFERENCES story_structures(id) ON DELETE SET NULL,

  -- 叙事要素
  pov_character_id UUID REFERENCES story_characters(id),
  character_goal TEXT,
  conflict TEXT,
  turning_point TEXT,
  outcome TEXT,

  -- 时空属性
  time_setting JSONB DEFAULT '{}',
  location_id UUID REFERENCES story_settings(id),
  duration VARCHAR(100),

  -- 情绪氛围
  mood JSONB DEFAULT '[]', -- MoodTag[]
  intensity INTEGER CHECK (intensity BETWEEN 1 AND 10),
  pace VARCHAR(20), -- 'fast'|'slow'|'pause'

  -- 写作状态
  writing_status VARCHAR(20) DEFAULT 'draft',
  word_count_target INTEGER,
  word_count_actual INTEGER DEFAULT 0,
  content TEXT, -- 富文本内容

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

#### 9.1.7 story_appearances 表（出场记录）
```sql
CREATE TABLE IF NOT EXISTS story_appearances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  graph_id UUID NOT NULL REFERENCES knowledge_graphs(id) ON DELETE CASCADE,
  character_id UUID NOT NULL REFERENCES story_characters(id) ON DELETE CASCADE,
  scene_id UUID NOT NULL,
  role_in_scene VARCHAR(20) DEFAULT 'supporting',
  importance INTEGER DEFAULT 3 CHECK (importance BETWEEN 1 AND 5),
  emotional_state VARCHAR(100),
  actions JSONB DEFAULT '[]',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(graph_id, character_id, scene_id)
);
```

#### 9.1.8 story_templates 表（结构模板定义）
```sql
CREATE TABLE IF NOT EXISTS story_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_code VARCHAR(100) UNIQUE NOT NULL, -- 'three_act'|'heros_journey'|...
  name VARCHAR(255) NOT NULL,
  name_zh VARCHAR(255) NOT NULL,
  description TEXT,
  source VARCHAR(255),
  category VARCHAR(50) DEFAULT 'classical',
  beats JSONB NOT NULL DEFAULT '[]', -- TemplateBeat[]
  is_system BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### 9.2 修改现有表

#### 9.2.1 knowledge_graphs 表
```sql
-- 已有 template_type 字段，添加新枚举值 'story_creation'
-- 无需改表结构，只需应用层支持新值
ALTER TYPE ... ADD VALUE IF NOT EXISTS 'story_creation'; -- 如果用 ENUM
-- 或者 VARCHAR(64) 已经足够灵活
```

---

## 十、前端组件架构草案

### 10.1 新增主要组件

```
src/
├── components/
│   ├── StoryEditor/                    # 故事编辑器主模块
│   │   ├── StoryEditor.tsx             # 主编辑器容器
│   │   ├── panels/
│   │   │   ├── StructurePanel.tsx      # 结构面板（幕/序列/章/场景树）
│   │   │   ├── CharacterPanel.tsx      # 角色管理面板
│   │   │   ├── SettingPanel.tsx        # 设定/世界观面板
│   │   │   ├── StorylinePanel.tsx      # 故事线管理面板
│   │   │   └── TemplatePanel.tsx       # 模板选择面板
│   │   ├── views/
│   │   │   ├── MultiTrackView.tsx      # 多轨道视图（创新）
│   │   │   ├── CharacterView.tsx       # 角色视角视图
│   │   │   ├── TimelineView.tsx        # 时间线视图
│   │   │   ├── CausalGraphView.tsx     # 因果关系图谱视图
│   │   │   └── ComparisonView.tsx      # 多线索对比视图
│   │   ├── editors/
│   │   │   ├── SceneEditor.tsx         # 场景内容编辑器（富文本）
│   │   │   ├── CharacterEditor.tsx     # 角色档案编辑器
│   │   │   └── RelationEditor.tsx      # 关系编辑器
│   │   └── widgets/
│   │       ├── RelationshipGraph.tsx   # 角色关系网络图
│   │       ├── ArcTracker.tsx          # 角色弧线追踪器
│   │       ├── ConsistencyChecker.tsx  # 一致性检查器
│   │       └── AIAssistantPanel.tsx    # AI 助手面板
│   └── AutoGraph/
│       └── StoryCreationWizard.tsx     # 故事创建向导（替代 AutoGraphGenerator）
```

### 10.2 UI 交互流程

#### 创建新故事的流程
```
1. 用户点击"新建故事"
   ↓
2. 选择结构模板（三幕式/英雄之旅/救猫咪/空白）
   ↓
3. 填写基本信息（标题、类型、前提、目标字数等）
   ↓
4. 系统初始化骨架结构（根据模板创建 Acts/Sequences/Chapters）
   ↓
5. 进入故事编辑器主界面
   ↓
6. 用户开始填充内容（手动或 AI 辅助）
```

---

## 十一、API 接口草案

### 11.1 新增 API 端点

```typescript
// story_creationApi (遵循项目 API 命名规范)
export const storyCreationApi = {
  // 结构管理
  structure: {
    list: (graphId: string) => Promise<StoryStructure[]>,
    get: (id: string) => Promise<StoryStructure>,
    create: (data: CreateStructureData) => Promise<StoryStructure>,
    update: (id: string, data: UpdateStructureData) => Promise<Structure>,
    delete: (id: string) => Promise<void>,
    reorder: (graphId: string, orders: ReorderItem[]) => Promise<void>,
  },

  // 角色管理
  characters: {
    list: (graphId: string) => Promise<CharacterNode[]>,
    get: (id: string) => Promise<CharacterNode>,
    create: (data: CreateCharacterData) => Promise<CharacterNode>,
    update: (id: string, data: UpdateCharacterData) => Promise<CharacterNode>,
    delete: (id: string) => Promise<void>,
  },

  // 角色关系
  relationships: {
    list: (graphId: string) => Promise<CharacterRelationship[]>,
    create: (data: CreateRelationshipData) => Promise<CharacterRelationship>,
    update: (id: string, data: UpdateRelationshipData) => Promise<CharacterRelationship>,
    delete: (id: string) => Promise<void>,
  },

  // 场景详情
  scenes: {
    getDetails: (nodeId: string) => Promise<SceneDetail>,
    updateContent: (nodeId: string, content: string) => Promise<SceneDetail>,
    updateMetadata: (nodeId: string, data: SceneMetadata) => Promise<SceneDetail>,
  },

  // 出场记录
  appearances: {
    list: (graphId: string) => Promise<Appearance[]>,
    upsert: (data: UpsertAppearanceData) => Promise<Appearance>,
    delete: (id: string) => Promise<void>,
    getStats: (characterId: string) => Promise<AppearanceStats>, // 出场统计
  },

  // 故事线
  storylines: {
    list: (graphId: string) => Promise<Storyline[]>,
    create: (data: CreateStorylineData) => Promise<Storyline>,
    update: (id: string, data: UpdateStorylineData) => Promise<Storyline>,
    delete: (id: string) => Promise<void>,
    addScene: (storylineId: string, sceneId: string, data: MembershipData) => Promise<void>,
    removeScene: (storylineId: string, sceneId: string) => Promise<void>,
  },

  // 设定/世界观
  settings: {
    list: (graphId: string) => Promise<SettingNode[]>,
    create: (data: CreateSettingData) => Promise<SettingNode>,
    update: (id: string, data: UpdateSettingData) => Promise<SettingNode>,
    delete: (id: string) => Promise<void>,
  },

  // 模板
  templates: {
    list: () => Promise<StoryTemplate[]>,
    get: (templateCode: string) => Promise<StoryTemplate>,
    applyToGraph: (graphId: string, templateCode: string) => Promise<StoryStructure[]>,
  },

  // AI 功能（备忘）
  ai: {
    generateScene: (context: SceneGenerationContext) => Promise<SceneGenerationResult>,
    checkConsistency: (graphId: string) => Promise<ConsistencyReport>,
    generateDialogue: (context: DialogueGenerationContext) => Promise<DialogueGenerationResult>,
    analyzeStructure: (graphId: string) => Promise<StructuralAnalysis>,
  },
};
```

---

## 十二、导出与集成能力

### 12.1 导出格式

| 格式 | 内容 | 用途 |
|------|------|------|
| **Word (.docx)** | 完整文稿（含格式） | 投稿/分享 |
| **PDF** | 打印友好的文稿 | 存档/打印 |
| **Markdown (.md)** | 纯文本+轻格式 | 版本控制/Obsidian |
| **JSON** | 完整数据结构 | 开发者/备份 |
| **Scrivener (.scrivx)** | 项目文件 | 专业写作软件兼容 |
| **Final Draft (.fdx)** | 剧本格式 | 影视行业 |
| **PNG/SVG** | 结构图/关系图 | 展示/演示 |

### 12.2 可视化图表导出

- **角色关系网络图**
- **时间线图**
- **多轨道视图快照**
- **情感曲线图**
- **节奏热力图**

---

## 十三、与现有系统的集成点

### 13.1 复用的现有基础设施

✅ **可以复用**:
- 认证授权系统 (`auth.users`)
- 基础 CRUD API 框架
- 图谱编辑器的画布渲染引擎（React Flow / vis-network）
- AI 服务调用框架（OpenAI/DeepSeek 等）
- 缓存机制（NodeCache）
- 国际化（i18n）框架
- 主题系统（Tailwind CSS）

⚠️ **需要适配**:
- `knowledge_points` 表（增加 story 特有的字段或使用 `story_scene_details`）
- `edges` 表（增加故事特有的关系类型）
- 图谱编辑器（替换/增强部分组件）

❌ **需要新建**:
- 所有 story_* 专属表
- 故事编辑器 UI 组件
- 多轨道视图引擎
- AI prompt 模板（故事专用）
- 导出/导入处理器

### 13.2 与 topic_research 的异同对比

| 维度 | topic_research | story_creation |
|------|---------------|----------------|
| **用途** | 学术研究 | 创意写作 |
| **骨架系统** | BackboneModule (6个学术模块) | StoryStructure (5级叙事层级) |
| **预设系统** | 4种研究范式预设 | 5+种经典结构模板 |
| **节点类型** | 统一的知识点 | 4种专门类型（角色/场景/设定/线索）|
| **关系类型** | 学术引用关系 | 叙事关系（因果/角色/出场/时间）|
| **内容模式** | 只读生成+手动关联 | 富文本写作+版本控制 |
| **AI 用途** | 文献提取+概念生成 | 场景扩写+对话生成+一致性检查 |
| **特殊视图** | 模块化大纲 | 多轨道视图+4种专业视图 |
| **学习模式** | ✅ 有（SM2算法复习） | ❌ 无（改为写作进度追踪）|

---

## 十四、MVP 实施路线图（未来参考）

### Phase 1: 基础架构（MVP）
**目标**: 可用的最小故事组织工具

- [ ] 数据库表创建（story_structures, story_characters, story_settings）
- [ ] 基础 CRUD API
- [ ] 简单的故事结构树（幕/章/场景三级即可）
- [ ] 基础的角色和场景节点
- [ ] 一个经典模板（三幕式）
- [ ] 基础的图谱视图（复用现有画布）

### Phase 2: 增强功能
- [ ] 完整的五级结构（加入序列层）
- [ ] 角色档案和关系网络
- [ ] 故事线管理
- [ ] 更多模板（英雄之旅、救猫咪）
- [ ] 场景详情编辑器（简化版富文本）
- [ ] 时间线视图（基础版）

### Phase 3: 专业功能
- [ ] 多轨道/图层视图系统
- [ ] 角色视角视图
- [ ] 因果关系图谱视图
- [ ] 多线索对比视图
- [ ] AI 场景生成（集成）
- [ ] 一致性检查（基础版）
- [ ] 导出功能（Word/PDF/JSON）

### Phase 4: AI 增强与生态
- [ ] AI 对话生成
- [ ] AI 结构分析
- [ ] 高级一致性检查
- [ ] Scrivener/Final Draft 兼容
- [ ] 协作功能（多人共同创作）
- [ ] 移动端适配

---

## ADDED Requirements

### Requirement: 故事创作图谱类型 (story_creation)
系统 SHALL 提供一种新的图谱类型 `story_creation`，专门用于小说/故事创作的结构化组织和 AI 辅助创作。

#### Scenario: 创建新的故事项目
- **WHEN** 用户选择创建新的 `story_creation` 类型图谱
- **THEN** 系统 SHALL 提供经典结构模板选择界面（至少包括三幕式、英雄之旅）
- **AND** 用户选择模板后，系统 SHALL 自动初始化对应的故事骨架结构（Acts/Sequences/Chapters）
- **AND** 系统 SHALL 进入专用的故事编辑器界面（非标准图谱编辑器）

#### Scenario: 管理故事结构层级
- **WHEN** 用户在故事编辑器中操作
- **THEN** 系统 SHALL 支持五级叙事层级的管理：Story → Act → Sequence → Chapter → Scene
- **AND** 用户可以添加/删除/重排序任意层级的节点
- **AND** 系统 SHALL 维护层级间的父子关系和显示顺序

#### Scenario: 创建和管理角色
- **WHEN** 用户添加角色节点
- **THEN** 系统 SHALL 提供完整的角色档案表单（基本信息、心理画像、背景故事、角色弧线）
- **AND** 用户可以定义角色间的多种关系类型（家族/友情/敌对/爱情等 18 种）
- **AND** 系统 SHALL 自动追踪每个角色的出场统计（出场次数、戏份占比、POV 章节数）

#### Scenario: 编辑场景内容
- **WHEN** 用户选中一个场景节点
- **THEN** 系统 SHALL 显示内嵌的富文本编辑器（支持长文本写作）
- **AND** 用户可以记录场景的叙事要素（POV、目标、冲突、转折、结果）
- **AND** 用户可以标注时空属性（时间、地点、持续时间和情绪氛围（强度、节奏、情绪标签））
- **AND** 系统 SHALL 跟踪写作状态（草稿/修改/定稿）和字数统计

#### Scenario: 使用多轨道视图
- **WHEN** 用户切换到多轨道视图模式
- **THEN** 系统 SHALL 显示可自定义的轨道面板（主线、支线、角色弧线、情感线等）
- **AND** 用户可以显示/隐藏、锁定/解锁、调节透明度各个轨道
- **AND** 每个轨道显示对应的节点序列，支持拖拽重排
- **AND** 系统 SHALL 支持跨轨道绘制连线（显示因果关系或交叉点）

#### Scenario: 使用特殊视图分析故事
- **WHEN** 用户切换到角色视角视图
- **THEN** 系统 SHALL 以选定角色为中心展示其关系网络、出场时间线和角色弧线进展

- **WHEN** 用户切换到时间线视图
- **THEN** 系统 SHALL 按故事内时间顺序展示所有事件，标注并行发生的事件和时间矛盾警告

- **WHEN** 用户切换到因果关系图谱视图
- **THEN** 系统 SHALL 提供画布模式让用户自由布局场景卡片并绘制因果关系连线

- **WHEN** 用户切换到多线索对比视图
- **THEN** 系统 SHALL 并排显示多条故事线的节奏曲线，提供密度分析和平衡建议

### Requirement: AI 辅助创作接口（备忘）
系统 SHALL 预留 AI 辅助创作的接口规范，但实现延后至 Phase 3-4。

#### Scenario: AI 场景内容生成（Phase 3）
- **WHEN** 用户选中空白场景并请求 AI 生成
- **THEN** AI SHALL 基于前文摘要、角色设定、场景目标等上下文生成场景内容
- **AND** 用户可以整体接受、分块接受或手动编辑生成的内容
- **AND** 系统 SHALL 保留版本历史供对比

#### Scenario: 一致性检查（Phase 3）
- **WHEN** 用户请求一致性检查
- **THEN** 系统 SHALL 分析角色行为、时间线、空间逻辑、情节连贯性和设定合规性
- **AND** 输出结构化的问题报告（严重程度、位置、描述、建议）

### Requirement: 导出与集成能力（备忘）
系统 SHALL 支持将故事项目导出为多种格式，便于分享和专业工具兼容。

#### Scenario: 导出文档格式（Phase 3）
- **WHEN** 用户请求导出
- **THEN** 系统 SHALL 支持 Word、PDF、Markdown、JSON 格式的导出
- **AND** 导出的文档应包含完整的文稿内容和基本的格式信息

#### Scenario: 导出可视化图表（Phase 3）
- **WHEN** 用户请求导出当前视图
- **THEN** 系统 SHALL 将当前的可视化视图（关系图、时间线、多轨道视图等）导出为 PNG 或 SVG 格式

---

## REMOVED Requirements

### Requirement: 学习模式集成
**Reason**: `story_creation` 类型不需要 SM2 算法的复习系统，应替换为写作进度追踪。
**Migration**: 在 GraphEditor 和 LearningMode 中添加 `template_type === "story_creation"` 的判断分支，跳过学习相关逻辑，改为显示写作统计（总字数、完成度、预计完成时间等）。

---

## 附录

### A. 术语表

| 术语 | 英文 | 定义 |
|------|------|------|
| 幕 | Act | 故事的主要结构划分，通常 3 幕（开端/对抗/解决）|
| 序列 | Sequence | 幕内的一系列场景组成的情节点 |
| 章节 | Chapter | 叙事的基本阅读单元 |
| 场景 | Scene | 最小的戏剧单元，连续的时间和地点 |
| POV | Point of View | 视角，指该场景通过哪个角色的视角叙述 |
| 节拍 | Beat | 故事中的最小叙事单位或转折点 |
| 角色弧线 | Character Arc | 角色在故事中的内心变化轨迹 |
| 故事线 | Storyline/Thread | 并行的叙事线索（主线/支线等）|
| 伏笔 | Foreshadowing | 提前暗示后续事件的叙事技巧 |
| 轨道 | Track | 多轨道视图中的一个叙事维度层 |

### B. 参考资源

#### B.1 市场调研工具
- **Novel Goggles** (https://app.novelgoggles.com/) - 场景规划+角色发展
- **Plottr** (https://plottr.com/) - 可视化情节规划+40+模板
- **Plot Bunni** (https://plotbunni.com/) - 开源分层故事规划+AI辅助
- **PlotForge** (https://plotforge.app/) - 角色关系映射+Story Compass
- **Scyn** (https://scyn.app/) - 可视化情节映射（画布模式）
- **Save the Cat!** (https://savethecat.com/) - 15节拍故事结构
- **Scrivener** - 专业长篇写作软件（结构化编辑标杆）
- **Campfire Writing** - 世界观构建+角色管理
- **World Anvil** - 世界观百科+时间线
- **Milanote** - 可视化创意组织工具

#### B.2 理论资源
- **Joseph Campbell - The Hero with a Thousand Faces** (英雄之旅)
- **Blake Snyder - Save the Cat! Writes a Novel** (救猫咪小说版)
- **Robert McKee - Story** (故事原理)
- **K.M. Weiland - Creating Character Arcs** (角色弧线创作)
- **Lisa Cron - Wired for Story** (脑科学叙事理论)

#### B.3 技术参考
- **React Flow** (https://reactflow.dev/) - 可视化节点编辑器（可用于图谱视图）
- **Tiptap** (https://tiptap.dev/) - 富文本编辑器（可用于场景编辑）
- **D3.js** (https://d3js.org/) - 数据可视化（可用于时间线、关系图）
- **Fabric.js** (http://fabricjs.com/) - Canvas 库（可用于多轨道视图）
