# Tasks

- [x] Task 1: 重写 `src/config/relationshipTypes.ts`，与 DB 种子数据完全一致
  - [x] 以 `supabase/migrations/54_seed_relationship_types.sql` 的 36 种类型为权威来源
  - [x] 统一命名：`related_to` → `related`，移除 `contrasts_with`/`synonym_of`/`antonym_of` 等非标准名
  - [x] 删除 14 个 DB 中不存在的类型
  - [x] 补充 21 个 DB 有但文件缺失的类型
  - [x] 补充 `derived_from` 到 hierarchical 分类（决定保留）

- [x] Task 2: 同步 `QuadrantEdge.tsx` 的 RELATION_COLORS 和 LINE_STYLES
  - [x] 移除 `related_to`（已由 `related` 覆盖）
  - [x] 确保所有 37 种 DB 类型都有颜色映射
  - [x] 移除任何不在 DB 中的类型
  - [x] 保留 `default` fallback 和 `derived_from`

- [x] Task 3: 统一所有 AI Prompt 中的关系类型名称
  - [x] 修改 `conceptExtractorService.ts` buildExtractionSchema：`related_to` → `related`，移除 `contrasts_with`
  - [x] 修改 `backboneNetworkService.ts` prompt schema：确认使用标准名称
  - [x] 修改 `promptService.ts` 中所有 prompt 模板的关系类型列表
  - [x] 修改 `templateGeneratorService.ts` 中的关系类型引用和默认值
  - [x] 修改 `mobile/promptService.ts` 中的关系类型名称

- [x] Task 4: 统一所有代码路径的默认值为 `"contains"`
  - [x] `api/routes/nodes.ts`: `"related"` → `"contains"`
  - [x] `api/routes/templates.ts`: `"related"` → `"contains"`
  - [x] `api/routes/backup.ts`: `"related"` → `"contains"`
  - [x] `api/routes/data.ts`: `'related'` → `'contains'`
  - [x] `src/lib/graph/analysis.ts`: `'related'` → `'contains'`
  - [x] `api/routes/ai/document.ts`: `"related"` → `"contains"`

- [x] Task 5: 更新层级白名单（GraphOutline.tsx + treeLayout.ts）基于 DB category
  - [x] 白名单基于 `category = 'hierarchical'` 确定：`contains`, `part_of`, `parent_child`, `derived_from`
  - [x] 将 `derived_from` 加入白名单（有明确层级语义）
  - [x] 同步两个文件的 HIERARCHICAL_EDGE_TYPES 定义

- [x] Task 6: 运行 lint 和类型检查验证
  - [x] 执行 `npm run check` ✅ (exit code 0)
  - [x] 执行 `npm run lint` ✅ (exit code 0)

# Task Dependencies
- [Task 2] depends on [Task 1]
- [Task 3] 可与 [Task 1] 并行
- [Task 4] 可独立并行
- [Task 5] 依赖于 Task 1 中关于 `derived_from` 的决策
- [Task 6] 在所有任务完成后执行
