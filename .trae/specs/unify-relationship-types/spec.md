# 边关系类型统一化 Spec

## Why

项目中存在**至少 4 套**互相矛盾的关系类型定义，导致：
1. AI prompt 中使用的关系类型（如 `related_to`、`contrasts_with`）与数据库中的标准类型（`related`）名称不匹配
2. 前端配置文件（`relationshipTypes.ts`）定义了一套完全不同的类型集合（如 `synonym_of` vs DB 的 `synonym`）
3. UI 渲染层（`QuadrantEdge.tsx`）的颜色映射包含了所有来源的并集，但部分类型无对应数据源定义
4. 不同代码路径的默认值不一致（有的默认 `"contains"`，有的默认 `"related"`）
5. 文献提取的 AI 返回的关系类型**全部不在层级白名单中**，导致大纲视图结构混乱

## What Changes

### 发现的问题清单

#### 问题1：4套定义互相矛盾

| 来源 | 文件 | 类型数量 | 示例差异 |
|------|------|----------|---------|
| 数据库种子数据 | `54_seed_relationship_types.sql` | 36 | `related`, `synonym`, `opposite` |
| UI 颜色映射 | `QuadrantEdge.tsx` RELATION_COLORS | 37 | 含 `related_to`, `derived_from`（DB无） |
| 前端配置 | `src/config/relationshipTypes.ts` | 27 | `related_to`, `synonym_of`, `antonym_of`（与DB不同名） |
| AI Prompt Schema | 多个 service 文件 | 各不相同 | 使用 `contrasts_with`（DB无此类型） |

#### 问题2：命名冲突

| 标准名称(DB) | 非标准别名(代码中使用) | 出现位置 |
|-------------|---------------------|---------|
| `related` | `related_to` | conceptExtractorService, promptService, relationshipTypes.ts |
| `synonym` | `synonym_of` | relationshipTypes.ts |
| 无 | `contrasts_with` | conceptExtractorService, promptService |
| 无 | `references` | autoGraphService.test.ts |
| — | `derived_from` | QuadrantEdge.tsx, treeLayout.ts |

#### 问题3：前端配置独有的类型（不在DB中）

`has_subcategory`, `instance_of`, `requires`, `blocks`, `precedes`, `concurrent_with`, `interacts_with`, `communicates_with`, `collaborates_with`, `caused_by`, `enables`, `prevents`, `antonym_of` — 共 14 个

#### 问题4：DB独有但前端配置缺失的类型

`parent_child`, `constrains`, `supports`, `mutex`, `exclusive`, `equivalent`, `generalization`, `specialization`, `parallel`, `merge`, `trigger`, `loop`, `points_to`, `acts_on`, `influences`, `feedback`, `calls`, `derives`, `proportional`, `inverse`, `derived_from` — 共 21 个

#### 问题5：默认值不一致

| 位置 | 默认值 | 文件 |
|------|--------|------|
| autoGraphService | `"contains"` | processAINodes, createEdgesBatch |
| nodes 路由 | `"related"` | 创建边时 |
| templates 路由 | `"related"` | 模板应用时 |
| backup 路由 | `"related"` | 备份恢复时 |
| data 路由 | `'related'` | 导入数据时 |
| analysis.ts | `'related'` | 边强度计算 |
| document 路由 | `"related"` | AI文档处理 |

### 修改方案

以**数据库种子数据（`54_seed_relationship_types.sql`）为唯一权威来源**（Single Source of Truth），执行以下统一操作：

1. **统一 `src/config/relationshipTypes.ts`**：使其与 DB 种子数据完全一致（36种类型），删除不存在的类型，补充缺失的类型
2. **统一 AI Prompt 中的关系类型**：将所有 prompt schema 中使用的关系类型替换为 DB 标准名称（`related_to` → `related`，移除 `contrasts_with` 用 `opposite` 替代等）
3. **统一默认值**：所有代码路径的无类型默认值统一为 `"contains"`
4. **同步 `QuadrantEdge.tsx` RELATION_COLORS**：确保只包含 DB 中存在的类型
5. **更新 `HIERARCHICAL_EDGE_TYPES` 白名单**：基于 DB 的 `category = 'hierarchical'` 来确定

## Impact

- Affected specs: fix-outline-tree-hierarchy（需同步更新白名单）
- Affected code:
  - `src/config/relationshipTypes.ts` — 前端关系类型配置（重写）
  - `src/components/GraphEditor/canvas/QuadrantEdge.tsx` — UI颜色映射（修正）
  - `src/components/GraphEditor/panels/GraphOutline.tsx` — 层级白名单（基于DB category）
  - `src/utils/layouts/treeLayout.ts` — 层级白名单（同步）
  - `api/services/ai/conceptExtractorService.ts` — AI Prompt schema（修正类型名）
  - `api/services/ai/backboneNetworkService.ts` — AI Prompt schema（修正类型名）
  - `api/services/ai/promptService.ts` — Prompt模板（修正类型名）
  - `api/services/ai/templateGeneratorService.ts` — 模板生成（修正类型名+默认值）
  - `api/services/graph/autoGraphService.ts` — 确认默认值一致性
  - `api/routes/nodes.ts` — 默认值修正
  - `api/routes/templates.ts` — 默认值修正
  - `api/routes/backup.ts` — 默认值修正
  - `api/routes/data.ts` — 默认值修正
  - `src/lib/graph/analysis.ts` — 默认值修正
  - `api/routes/ai/document.ts` — 默认值修正

## ADDED Requirements

### Requirement: 统一关系类型常量

系统 SHALL 以数据库 `relationship_types` 表为唯一权威来源，在项目中导出一个共享的关系类型常量。

#### 权威类型清单（来自 DB 种子数据，共 36 种）

**hierarchical（6种）— 用于树形构建**
| name | display_name |
|------|-------------|
| contains | 包含 |
| part_of | 属于 |
| parent_child | 父子 |

> 注：`derived_from` 在 treeLayout 白名单中也作为层级类型，但它实际在 DB 中**未被定义**。需要决定是加入 DB 还是从白名单移除。

**dependency（7种）**
| name | display_name |
|------|-------------|
| depends_on | 依赖 |
| prerequisite | 前提 |
| constrains | 制约 |
| supports | 支撑 |
| mutex | 互斥 |
| exclusive | 排他 |

**semantic（8种）**
| name | display_name |
|------|-------------|
| related | 相关 |
| similar_to | 相似 |
| opposite | 相反 |
| synonym | 同义 |
| equivalent | 等价 |
| generalization | 泛化 |
| specialization | 特化 |

**temporal（6种）**
| name | display_name |
|------|-------------|
| follows | 后续 |
| parallel | 并行 |
| branch | 分支 |
| merge | 汇合 |
| trigger | 触发 |
| loop | 循环 |

**interaction（5种）**
| name | display_name |
|------|-------------|
| points_to | 指向 |
| acts_on | 作用 |
| influences | 影响 |
| feedback | 反馈 |
| calls | 调用 |

**causal（5种）**
| name | display_name |
|------|-------------|
| causes | 因果 |
| derives | 推导 |
| proportional | 正比 |
| inverse | 反比 |

### Requirement: 层级白名单基于 DB category

`HIERARCHICAL_EDGE_TYPES` 白名单 SHALL 基于 `category = 'hierarchical'` 动态确定，而非硬编码。

初始白名单：`contains`, `part_of`, `parent_child`

关于 `derived_from`：当前存在于 `treeLayout.ts` 白名单和 `QuadrantEdge.tsx` 颜色映射中，但**不存在于 DB 种子数据**。需要决策：
- 方案A：将 `derived_from` 加入 DB 种子数据的 hierarchical 分类
- 方案B：从白名单和颜色映射中移除 `derived_from`

推荐**方案A**，因为"派生自"具有明确的层级语义。

### Requirement: AI Prompt 关系类型标准化

所有 AI Prompt 中使用的关系类型名称 SHALL 与 DB 标准名称一致：

| 当前Prompt中的非标准名 | 替换为DB标准名 | 说明 |
|---------------------|---------------|------|
| `related_to` | `related` | 语义相同，名称统一 |
| `contrasts_with` | `opposite` | DB已有opposite类型 |
| （无） | 移除 `contrasts_with` | 不再使用 |

### Requirement: 默认值统一

所有代码路径中 `relationship_type` 的默认值 SHALL 统一为 `"contains"`：

- `autoGraphService.ts` — 已是 `"contains"` ✅
- `nodes.ts` 路由 — `"related"` → `"contains"`
- `templates.ts` 路由 — `"related"` → `"contains"`
- `backup.ts` 路由 — `"related"` → `"contains"`
- `data.ts` 路由 — `'related'` → `'contains'`
- `analysis.ts` — `'related'` → `'contains'`
- `document.ts` 路由 — `"related"` → `"contains"`

## MODIFIED Requirements

### Requirement: relationshipTypes.ts 重写

`src/config/relationshipTypes.ts` SHALL 完全重写，使其与 DB 种子数据（`54_seed_relationship_types.sql`）的 36 种类型完全一致，包括：
- 相同的 `name`（如 `related` 而非 `related_to`）
- 相同的 `category` 分类
- 匹配的颜色值
- 删除所有 DB 中不存在的类型（`has_subcategory`, `instance_of`, `requires`, `blocks`, `precedes`, `concurrent_with`, `interacts_with`, `communicates_with`, `collaborates_with`, `caused_by`, `enables`, `prevents`, `synonym_of`, `antonym_of`）
- 补充 DB 中有但该文件缺失的类型（`parent_child`, `constrains`, `supports`, `mutex`, `exclusive`, `equivalent`, `generalization`, `specialization`, `parallel`, `merge`, `trigger`, `loop`, `points_to`, `acts_on`, `influences`, `feedback`, `calls`, `derives`, `proportional`, `inverse`）

### Requirement: QuadrantEdge.tsx RELATION_COLORS 同步

`RELATION_COLORS` 和 `LINE_STYLES` 映射 SHALL 仅包含 DB 中存在的 36 种类型 + `default` fallback。
移除 `related_to`（用 `related` 替代），确认 `derived_from` 是否保留（取决于上述决策）。

## REMOVED Requirements

### Requirement: 前端配置中的非标准类型

**原因**：这些类型不存在于数据库 `relationship_types` 表中，会导致前端展示与后端数据不一致。

**待移除的类型列表**（14个）：
`has_subcategory`, `instance_of`, `requires`, `blocks`, `precedes`, `concurrent_with`, `interacts_with`, `communicates_with`, `collaborates_with`, `caused_by`, `enables`, `prevents`, `synonym_of`, `antonym_of`

**迁移**：如果数据库中已存在使用这些类型的边数据，需要编写一次性迁移脚本将其映射到最接近的标准类型。
