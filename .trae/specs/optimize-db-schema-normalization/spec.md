# 数据库 Schema 范式优化 Spec

## Why

用户提到"数据库表构建有一些方法，如 BCNF / 4NF / 5NF / 3NF 等"，希望基于数据库范式理论审查现有 schema 的优化空间。

当前数据库包含 36 个 schema 文件（00-35）、约 60+ 张表，整体设计在功能上完备，但累积了若干历史遗留冗余：
- 多处已标注 `[DEPRECATED]` 的列/表未清理
- 两套同义表并存（`practice_sessions`/`quiz_sessions`、`practice_results`/`quiz_results`）
- 旧字段与新关联表并存（`knowledge_graphs.domain` vs `graph_domains`、`learning_path_nodes.prerequisites` vs `learning_path_prerequisites`）
- 算法迁移残留（SM-2 `knowledge_review_tasks` 与 FSRS `study_cards`）
- 部分表过度宽表化，违反 3NF 传递依赖原则（`knowledge_graphs` 28 列、`study_cards` 30+ 列）
- 索引冗余与低基数索引（`idx_users_role` 等）
- 触发器函数重复定义（`update_story_updated_at_column` / `update_literature_sources_updated_at` 与 `update_updated_at_column` 等价）

本 spec 不追求"教科书式严格 3NF"——聚合表（如 `user_focus_stats`）、JSONB 配置列（如 `users.settings`）等反规范化设计在 OLTP 场景下是合理的。本 spec 聚焦**有明确收益、低风险**的清理与重构。

## 范式理论速查（与本项目对照）

| 范式 | 核心要求 | 本项目违反点 |
|------|---------|-------------|
| **1NF** | 列原子性，无重复组 | `learning_path_nodes.prerequisites UUID[]`（已废弃未清理）；`user_tasks.tags TEXT[]` 可接受 |
| **2NF** | 消除非主属性对复合键的部分依赖 | `graph_collaborators.id` 用作主键而非 `(graph_id,user_id)`，但已加 UNIQUE，可接受；无明显违反 |
| **3NF** | 消除传递依赖 | `knowledge_graphs` 表承担过多职责；`study_cards` FSRS 字段传递依赖；`ai_performance_logs.timestamp` 与 `created_at` 冗余 |
| **BCNF** | 每个决定因素都是候选键 | `knowledge_graphs.domain` 与 `graph_domains` 双路径决定领域关系，违反 BCNF |
| **4NF** | 消除多值依赖 | `practice_sessions`/`quiz_sessions` 双表同构，本质是 session_type 多值依赖被错误拆表 |
| **5NF** | 消除连接依赖 | 无明显违反 |

## What Changes

### 一、P0 — 已标注 DEPRECATED 的残留清理（低风险，直接执行）

#### 1.1 删除 `knowledge_review_tasks` 表（SM-2 算法废弃）
- **位置**：[07_scheduler_tasks.sql](file:///d:/KnowledgeMap/supabase/migrations/07_scheduler_tasks.sql) L300-322
- **现状**：表与列注释均已标 `[DEPRECATED] 推荐使用 study_cards (FSRS) 替代`，但表仍存在
- **动作**：
  - 删除 `knowledge_review_tasks` 表
  - 删除 [12_indexes.sql](file:///d:/KnowledgeMap/supabase/migrations/12_indexes.sql) 中 `idx_knowledge_review_tasks_*` 5 个索引
  - 删除 [13_rls_policies.sql](file:///d:/KnowledgeMap/supabase/migrations/13_rls_policies.sql) L509-514 的 RLS 策略
  - 删除 [15_triggers.sql](file:///d:/KnowledgeMap/supabase/migrations/15_triggers.sql) L67-69 的 `knowledge_review_tasks_updated_at` 触发器
  - 同步删除 shared/types 与 api/src 中相关类型/服务引用（需先 grep 确认无活跃调用）

#### 1.2 删除 `knowledge_graphs.domain` 字段（已被 `graph_domains` 取代）
- **位置**：[02_knowledge_graph.sql](file:///d:/KnowledgeMap/supabase/migrations/02_knowledge_graph.sql) L10
- **现状**：注释 `The domain/field this graph belongs to, used for star map visualization`，但已有 `domains` 表 + `graph_domains` 关联表，注释明示 `is_primary 用于向后兼容旧的 domain 字段`
- **动作**：
  - 先确认所有 `knowledge_graphs.domain` 读取处已迁移到 `graph_domains` JOIN
  - 删除 `knowledge_graphs.domain` 列
  - 删除 [12_indexes.sql](file:///d:/KnowledgeMap/supabase/migrations/12_indexes.sql) L18 的 `idx_knowledge_graphs_domain` 索引
  - 删除 [14_functions.sql](file:///d:/KnowledgeMap/supabase/migrations/14_functions.sql) `get_graph_map_data` 中对 `g.domain` 的引用（L1542）

#### 1.3 删除 `learning_path_nodes.prerequisites UUID[]` 列
- **位置**：[08_learning_paths.sql](file:///d:/KnowledgeMap/supabase/migrations/08_learning_paths.sql) L43
- **现状**：注释 `[DEPRECATED] 使用 learning_path_prerequisites 关联表替代此 UUID[] 列`
- **动作**：
  - 确认无活跃读写后删除该列
  - 数据迁移：若存量数据存在，先 `INSERT INTO learning_path_prerequisites SELECT unnest(prerequisites) FROM learning_path_nodes` 转换

#### 1.4 删除 `ai_performance_logs.timestamp` 列
- **位置**：[10_ai_and_prompts.sql](file:///d:/KnowledgeMap/supabase/migrations/10_ai_and_prompts.sql) L56
- **现状**：注释 `[DEPRECATED] 使用 created_at (TIMESTAMPTZ) 替代此字段`
- **动作**：
  - 删除 `timestamp` 列
  - 删除 [12_indexes.sql](file:///d:/KnowledgeMap/supabase/migrations/12_indexes.sql) L293 `idx_ai_perf_logs_timestamp` 与 L303 `idx_ai_perf_logs_session_ts`（改用 `created_at` 版本）
  - 修改 [14_functions.sql](file:///d:/KnowledgeMap/supabase/migrations/14_functions.sql) 中引用（如有）

### 二、P0 — 同构表合并（4NF 修正，中风险，需数据迁移）

#### 2.1 合并 `practice_sessions` + `quiz_sessions` → `learning_sessions`
- **位置**：[18_practice_quiz_sessions.sql](file:///d:/KnowledgeMap/supabase/migrations/18_practice_quiz_sessions.sql)
- **现状**：两表字段几乎一致，仅 `practice_sessions.accuracy` vs `quiz_sessions.score`（语义同：得分率）+ `quiz_sessions.quiz_set_id`（practice 无）差异
- **设计**：
  ```sql
  CREATE TABLE learning_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_type TEXT NOT NULL CHECK (session_type IN ('practice', 'quiz')),
    subtask_id UUID NOT NULL REFERENCES task_subtasks(id) ON DELETE CASCADE,
    knowledge_point_id UUID NOT NULL REFERENCES knowledge_points(id) ON DELETE CASCADE,
    quiz_set_id UUID REFERENCES quiz_sets(id) ON DELETE CASCADE,  -- 仅 quiz 类型使用
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    card_ids UUID[] DEFAULT '{}',
    started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    completed_at TIMESTAMPTZ,
    status TEXT DEFAULT 'in_progress' CHECK (status IN ('in_progress', 'completed', 'abandoned')),
    score DECIMAL(5,4),  -- 统一为 score（accuracy 重命名）
    correct_count INTEGER DEFAULT 0,
    total_count INTEGER DEFAULT 0,
    total_time_spent INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
  );
  ```
- **迁移**：
  - `INSERT INTO learning_sessions (session_type, ...) SELECT 'practice', ... FROM practice_sessions`
  - `INSERT INTO learning_sessions (session_type, quiz_set_id, ...) SELECT 'quiz', quiz_set_id, ... FROM quiz_sessions`
- **影响代码**：需 grep `practice_sessions` / `quiz_sessions` 的 service / repository / 类型定义，统一改读 `learning_sessions`

#### 2.2 合并 `practice_results` + `quiz_results` → `learning_session_results`
- **位置**：同上文件 L34-90
- **现状**：`practice_results.user_answer` vs `quiz_results.answer`（同义）；其余字段完全一致
- **设计**：
  ```sql
  CREATE TABLE learning_session_results (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID NOT NULL REFERENCES learning_sessions(id) ON DELETE CASCADE,
    card_id UUID NOT NULL REFERENCES study_cards(id) ON DELETE CASCADE,
    correct BOOLEAN NOT NULL,
    user_answer TEXT,
    time_spent INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
  );
  ```

### 三、P1 — 表拆分与传递依赖消除（3NF 修正，中风险）

#### 3.1 `study_cards` FSRS 状态字段抽离到 `study_card_fsrs_states`
- **位置**：[06_study_and_cards.sql](file:///d:/KnowledgeMap/supabase/migrations/06_study_and_cards.sql) L24-50
- **现状**：`study_cards` 表 30+ 列，其中 7 个 `fsrs_*` 字段是算法运行时状态，与卡片内容（question/answer/explanation/options）是两个关注点
- **设计**：拆分为 1:1 表
  ```sql
  -- study_cards 保留内容相关字段
  -- 新建 study_card_fsrs_states
  CREATE TABLE study_card_fsrs_states (
    card_id UUID PRIMARY KEY REFERENCES study_cards(id) ON DELETE CASCADE,
    state TEXT NOT NULL DEFAULT 'New' CHECK (state IN ('New', 'Learning', 'Review', 'Relearning')),
    stability DOUBLE PRECISION DEFAULT 0,
    difficulty DOUBLE PRECISION DEFAULT 0,
    elapsed_days DOUBLE PRECISION DEFAULT 0,
    scheduled_days DOUBLE PRECISION DEFAULT 0,
    retrievability DOUBLE PRECISION DEFAULT 0,
    last_review TIMESTAMPTZ,
    last_rating INTEGER CHECK (last_rating BETWEEN 1 AND 4),
    review_count INTEGER DEFAULT 0,
    next_review TIMESTAMPTZ DEFAULT NOW(),
    last_reviewed TIMESTAMPTZ,
    updated_at TIMESTAMPTZ DEFAULT NOW()
  );
  ```
- **理由**：
  - 内容变更（编辑题目/答案）不应触及 FSRS 状态行，减少锁竞争
  - FSRS 状态批量更新（如算法重算）可独立进行
  - 卡片列表查询（不含 FSRS）数据量减半
- **影响**：所有 `study_cards.fsrs_*` 读取处需 JOIN，但 service 层封装后影响可控

#### 3.2 `knowledge_graphs` 内容字段抽离
- **位置**：[02_knowledge_graph.sql](file:///d:/KnowledgeMap/supabase/migrations/02_knowledge_graph.sql)
- **现状**：28 列，其中 `podcast_script TEXT`、`reference_books JSONB`、`external_links JSONB`、`learning_guide TEXT` 是内容性字段，与图谱元数据混杂
- **设计**：抽离为 1:1 子表 `knowledge_graph_contents`
  ```sql
  CREATE TABLE knowledge_graph_contents (
    graph_id UUID PRIMARY KEY REFERENCES knowledge_graphs(id) ON DELETE CASCADE,
    podcast_script TEXT,
    reference_books JSONB DEFAULT '[]',
    external_links JSONB DEFAULT '[]',
    learning_guide TEXT,
    updated_at TIMESTAMPTZ DEFAULT NOW()
  );
  ```
- **理由**：
  - 列表查询（图图谱列表）只需元数据，不必拉取 `podcast_script` 等大字段
  - `reference_books JSONB` 与 `literature_sources` 表概念部分重叠，未来可统一
- **注意**：`reference_books` 与 `literature_sources` 关系需单独决策——前者是用户手填、后者是文献提取。本 spec 仅做物理拆分，不合并语义

### 四、P1 — 数据冗余与一致性（3NF/BCNF 修正）

#### 4.1 `mastery_level` 单一来源
- **位置**：`knowledge_points.mastery_level` 与 `task_subtasks.mastery_level`
- **现状**：[07_scheduler_tasks.sql](file:///d:/KnowledgeMap/supabase/migrations/07_scheduler_tasks.sql) L218 注释 `Mastery level (0.00-1.00), synced with knowledge_points.mastery_level`
- **问题**：两处存储同一数据，需应用层同步，易不一致
- **动作**：
  - **方案 A（推荐）**：`task_subtasks.mastery_level` 改为读取 `knowledge_points.mastery_level`（通过 JOIN 或 GENERATED COLUMN）
  - **方案 B**：保留双写，新增触发器自动同步
- **本 spec 采纳方案 A**：删除 `task_subtasks.mastery_level`，service 层 JOIN 读取

#### 4.2 `user_tasks.context->>'graph_id'` 改为正式列 + 外键
- **位置**：[07_scheduler_tasks.sql](file:///d:/KnowledgeMap/supabase/migrations/07_scheduler_tasks.sql) L75-78
- **现状**：`context JSONB` 存储结构化数据，并对 `(context->>'graph_id')` 建部分索引，违反 1NF（结构化数据埋在 JSONB 内）
- **动作**：
  - 新增 `user_tasks.graph_id UUID REFERENCES knowledge_graphs(id) ON DELETE SET NULL` 列
  - 数据迁移：`UPDATE user_tasks SET graph_id = (context->>'graph_id')::uuid WHERE task_type = 'graph_learning' AND context->>'graph_id' IS NOT NULL`
  - 从 `context` JSONB 中移除 `graph_id` 键
  - 删除 `idx_user_tasks_context_graph_id` 索引，新建 `idx_user_tasks_graph_id`

#### 4.3 `relationship_types.show_arrow` 改为 ENUM
- **位置**：[04_graph_structure.sql](file:///d:/KnowledgeMap/supabase/migrations/04_graph_structure.sql) L70, L77
- **现状**：`show_arrow TEXT NOT NULL DEFAULT 'auto' CHECK (show_arrow IN ('true', 'false', 'auto'))`，用 TEXT 存三值
- **动作**：
  - 新增 ENUM：`CREATE TYPE arrow_display AS ENUM ('true', 'false', 'auto');`
  - 改列类型为 `arrow_display`
  - `edges.show_arrow BOOLEAN` 保持不变（它是"运行时决定值"而非"配置项"）

### 五、P1 — 触发器函数统一

#### 5.1 统一 `update_*_updated_at_column` 函数
- **位置**：
  - [14_functions.sql](file:///d:/KnowledgeMap/supabase/migrations/14_functions.sql) L6-12 `update_updated_at_column`（通用版）
  - [25_story_creation.sql](file:///d:/KnowledgeMap/supabase/migrations/25_story_creation.sql) L319-325 `update_story_updated_at_column`（等价重复定义）
  - [58_literature_sources.sql](file:///d:/KnowledgeMap/supabase/migrations/58_literature_sources.sql) L105-111 `update_literature_sources_updated_at`（等价重复定义）
- **动作**：
  - 删除 `update_story_updated_at_column` 与 `update_literature_sources_updated_at` 函数定义
  - 修改对应触发器改用 `update_updated_at_column`
  - 同步检查 `update_agent_session_updated_at`（[28_agent_sessions.sql](file:///d:/KnowledgeMap/supabase/migrations/28_agent_sessions.sql) L157-163），同样统一

### 六、P2 — 索引清理（性能优化，低风险）

#### 6.1 删除低基数索引
- **位置**：[12_indexes.sql](file:///d:/KnowledgeMap/supabase/migrations/12_indexes.sql)
- **问题**：
  - L6 `idx_users_role`：`users.role` 仅 `user`/`admin` 两值，索引无效
  - L10 `idx_knowledge_graphs_is_public`：布尔列，低基数
  - L43 `idx_graph_nodes_level`：5 个枚举值，索引意义有限（除非分布极度不均）
- **动作**：删除上述索引，保留更精确的部分索引（如 `idx_knowledge_graphs_public` 已用 `WHERE is_public = true AND deleted_at IS NULL`）

#### 6.2 删除冗余复合索引的子集索引
- **位置**：[12_indexes.sql](file:///d:/KnowledgeMap/supabase/migrations/12_indexes.sql)
- **问题**：
  - L77 `idx_study_progress_user` 是 L79 `idx_study_progress_user_graph` 的前缀子集，可删
  - L66 `idx_quiz_sets_user_id` 是 L69 `idx_quiz_sets_user_status` 的前缀子集（仅当 user_id 等值查询时，后者可用），但 status 过滤不总是发生，保留前缀索引更安全——**保留 `idx_quiz_sets_user_id`，删 `idx_study_progress_user`**
  - L49 `idx_edges_source` 是 L53 `idx_edges_source_graph` 的前缀子集，可删（同理 `idx_edges_target`）
  - L102 `idx_focus_sessions_user_id` 是 L99 `idx_focus_sessions_user_date` 的前缀子集，可删
- **动作**：删除 4 个冗余子集索引

### 七、P2 — 外键补全

#### 7.1 补充缺失外键
- `user_tasks.knowledge_point_id`（[07_scheduler_tasks.sql](file:///d:/KnowledgeMap/supabase/migrations/07_scheduler_tasks.sql) L38）— 应加 `REFERENCES knowledge_points(id) ON DELETE SET NULL`
- `focus_sessions.task_id`（[11_focus_and_notifications.sql](file:///d:/KnowledgeMap/supabase/migrations/11_focus_and_notifications.sql) L9）— 应加 `REFERENCES user_tasks(id) ON DELETE SET NULL`
- `learning_paths.domain_id`（[08_learning_paths.sql](file:///d:/KnowledgeMap/supabase/migrations/08_learning_paths.sql) L14）— 应加 `REFERENCES domains(id) ON DELETE SET NULL`

#### 7.2 `graph_collaborators.invitation_token` 加 UNIQUE
- **位置**：[05_domains_and_collaboration.sql](file:///d:/KnowledgeMap/supabase/migrations/05_domains_and_collaboration.sql) L46
- **现状**：邀请令牌默认 `gen_random_uuid()` 但无 UNIQUE 约束，理论上可重复
- **动作**：`ALTER TABLE graph_collaborators ADD CONSTRAINT uq_invitation_token UNIQUE (invitation_token);`

### 八、P2 — agent 模块信息冗余

#### 8.1 `agent_messages` 与 `agent_tool_calls` 关系明确化
- **位置**：[28_agent_sessions.sql](file:///d:/KnowledgeMap/supabase/migrations/28_agent_sessions.sql)
- **现状**：`agent_messages` 在 `role='tool'` 时已有 `tool_name/tool_args/tool_result`；`agent_tool_calls` 单独存储工具调用。两套存储语义重叠
- **动作（保守方案）**：
  - 不删除任一表（`agent_tool_calls` 记录工具调用生命周期，`agent_messages` 记录对话流，语义不同）
  - 在 `agent_messages` 上新增 `tool_call_id UUID REFERENCES agent_tool_calls(id) ON DELETE SET NULL`，建立 1:1 关联
  - 移除 `agent_messages.tool_name/tool_args/tool_result` 三列（改通过 `tool_call_id` JOIN 读取）
- **本 spec 不强制执行**：列为可选项，待 agent 模块重构时一并处理

## 不做改动（明确排除）

以下设计虽看似违反范式，但在 OLTP + 桌面应用场景下是合理的反规范化，**不在本 spec 范围**：

1. **聚合表**：`user_focus_stats`、`study_progress`、`user_efficiency_profile`、`user_pass_progress`
   - 理由：物化聚合可避免实时聚合的高开销，触发器/服务层维护一致性即可
2. **JSONB 配置列**：`users.settings`、`notification_settings`（扁平列）、`scheduler_weight_profiles.weights`
   - 理由：配置类数据 schema 频繁变动，JSONB 灵活性收益大于范式收益
3. **`knowledge_points.keywords` JSONB 数组**
   - 理由：关键词结构（term/importance/category/explanation）查询模式以整对象读为主，独立表 JOIN 开销不划算
4. **`knowledge_graphs.settings` JSONB**
   - 理由：图谱配置项多变，JSONB 合适
5. **软删除不统一**
   - 理由：软删除策略因表而异（如 `study_cards` 不需软删，`knowledge_graphs` 需要回收站），统一反而过度设计
6. **`templates` / `task_templates` / `story_templates` / `note_templates` 多套模板表**
   - 理由：四类模板字段差异大（story_templates 有 beats、note_templates 有 content），强行统一基表会引入 NULL 列污染
7. **RLS 子查询反规范化**
   - 理由：在子表冗余 `user_id` 列可加速 RLS，但会增加一致性维护成本；当前查询性能未报告瓶颈，不动

## Impact

- **Affected specs**：
  - 若执行 2.1/2.2（session 合并），需同步更新所有引用 `practice_sessions`/`quiz_sessions` 的代码与测试
  - 若执行 3.1（FSRS 抽离），FSRS service 需重构
- **Affected code**：
  - `api/services/study/` 下 cardService、fsrsService、quizService、practiceService
  - `shared/types/database.generated.ts`（每次 schema 变更后需 `npm run db:gen-types`）
  - `src/` 下相关 hook 与 store
- **Migration 风险**：
  - 所有变更直接修改 `supabase/migrations/` 模块化文件（项目规范：不创建增量迁移）
  - 需 `npm run db:local:reset` 重置本地数据库验证
  - 生产环境需手动提取变更 SQL 在 Dashboard 执行
- **测试要求**：
  - 每个阶段完成后运行 `npm run test:db`（pgTAP）
  - 全量回归 `npm run test:run` + `npm run test:e2e`
  - 类型检查 `npm run check` + lint `npm run lint`

## 优先级执行顺序

| 阶段 | 内容 | 风险 | 可并行 |
|------|------|------|--------|
| Phase 1 | P0 残留清理（1.1-1.4） | 低 | 是 |
| Phase 2 | P0 session 合并（2.1-2.2） | 中 | 否（需先迁移数据） |
| Phase 3 | P1 表拆分（3.1-3.2） | 中 | 是 |
| Phase 4 | P1 冗余消除（4.1-4.3） | 中 | 是 |
| Phase 5 | P1 触发器统一（5.1） | 低 | 是 |
| Phase 6 | P2 索引清理（6.1-6.2） | 低 | 是 |
| Phase 7 | P2 外键补全（7.1-7.2） | 低 | 是 |
| Phase 8 | P2 agent 冗余（8.1，可选） | 中 | 独立 |

## 验证命令

```bash
# 类型检查
npm run check

# Lint
npm run lint

# 单元 + 集成测试
npm run test:run

# 数据库测试（需启动本地 Supabase）
npm run test:db

# E2E 关键路径
npm run test:e2e

# Schema 变更后必做
npm run db:gen-types
npm run db:local:reset
```
