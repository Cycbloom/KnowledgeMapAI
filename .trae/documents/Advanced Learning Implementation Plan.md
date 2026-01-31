# 学习系统闭环 (Advanced Learning) 实现计划

本计划旨在升级现有的学习系统，引入 FSRS 算法以优化记忆效率，并在 Dashboard 中增加可视化反馈，同时增加学习的趣味性。

## 1. FSRS 算法集成 (Backend & Database)

**目标**: 使用 `ts-fsrs` 替换现有的简易 SM-2 算法，实现更精准的间隔重复调度。

### 1.1 依赖安装

* 安装 `ts-fsrs` (用于算法实现)。

### 1.2 数据库迁移

* 创建新的迁移文件 `supabase/migrations/20260201000000_add_fsrs_fields.sql`。

* 修改 `study_cards` 表，增加 FSRS 所需字段：

  //先删除整个表，接着直接给出完整的表的实现

  * `fsrs_state` (int, default 0): 0=New, 1=Learning, 2=Review, 3=Relearning

  * `fsrs_stability` (float, default 0): 记忆稳定性 (S)

  * `fsrs_difficulty` (float, default 0): 记忆难度 (D)

  * `fsrs_elapsed_days` (float, default 0): 距离上次复习天数

  * `fsrs_scheduled_days` (float, default 0): 计划间隔天数

  * `fsrs_retrievability` (float, default 0): 可提取性 (R)

### 1.3 后端逻辑更新 (`api/routes/study.ts`)

* **初始化 FSRS**: 配置 FSRS 参数。

* **重构复习接口 (`PUT /cards/:id/progress`)**:

  * 接收前端传入的评分 `rating` (1=Again, 2=Hard, 3=Good, 4=Easy)。

  * 读取当前卡片的 FSRS 状态。

  * 使用 `fsrs.next(card, now, rating)` 计算下一次复习时间 (`next_review`) 和新的 FSRS 参数。

  * 更新数据库。

## 2. 知识盲区热力图 (Dashboard)

**目标**: 可视化用户的学习情况，直观展示薄弱环节。

### 2.1 依赖安装

* 安装 `recharts` (用于图表绘制)。

### 2.2 新增统计 API (`api/routes/dashboard.ts`)

* 创建 `GET /api/dashboard/stats` 接口。

* 返回数据：

  * **学习热力图数据**: 过去一年的每日复习次数 (`{ date: string, count: number }`)。

  * **知识掌握分布**: 按 `fsrs_stability` 分组的卡片数量。

  * **盲区列表**: `stability` 最低的前 10 个节点/卡片。

### 2.3 前端实现 (`src/pages/Dashboard.tsx`)

* **Activity Heatmap**: 实现一个类似 GitHub 的贡献度日历组件 (使用 CSS Grid 或 Recharts)。

* **Blind Spot Radar/List**: 展示急需复习或长期记不住的知识点（红色高亮）。

## 3. 闯关式测验 (Gamification)

**目标**: 将图谱路径转化为关卡，增加学习趣味性。

### 3.1 锁定逻辑 (`api/services/graphService.ts`)

* 定义“解锁”规则：子节点仅在父节点的所有关联卡片达到一定熟练度（如 `state != New` 或 `stability > X`）后解锁。

* 在获取图谱节点数据时 (`GET /graphs/:id`)，动态计算每个节点的 `locked` 状态。

### 3.2 前端交互 (`src/components/Graph3D.tsx` & `GraphEditor.tsx`)

* **视觉反馈**: 锁定的节点显示为灰色或带有“锁”图标。

* **交互限制**: 点击锁定节点时，提示“请先掌握前置知识点”。

* **进度条**: 在编辑器顶部显示当前图谱的“通关进度”。

## 执行步骤

1. **后端基础**: 安装依赖，执行 DB 迁移，更新 Study API。
2. **前端适配**: 更新 Study 界面以支持 4 级评分，对接新 API。
3. **Dashboard**: 实现统计接口与前端图表。
4. **闯关模式**: 实现节点锁定逻辑与前端 3D 图谱的视觉更新。

