# Checklist

- [x] `src/config/relationshipTypes.ts` 与 DB 种子数据的 37 种类型完全一致，无多余无缺失
- [x] 所有非标准类型名（`related_to`, `contrasts_with`, `synonym_of`, `antonym_of` 等）已从代码中清除
- [x] `QuadrantEdge.tsx` RELATION_COLORS 仅包含 DB 标准类型 + default（移除了 related_to）
- [x] 所有 AI Prompt **schema** 使用 DB 标准关系类型名称
- [x] 所有 AI Prompt **文本内容** 已重写为 37 种标准类型（promptService.ts ×2 + mobile/promptService.ts ×2，移除14个非标准类型）
- [x] 所有代码路径的 relationship_type 默认值统一为 `"contains"`（6个文件7处已修正）
- [x] HIERARCHICAL_EDGE_TYPES 白名单基于 DB `category='hierarchical'` + derived_from 确定（2个文件已同步）
- [x] `derived_from` 已加入 DB 种子数据 hierarchical 分类（54_seed_relationship_types.sql）
- [x] conceptExtractorService.ts 确认无非标准类型残留
- [x] npm run check 通过 ✅
- [x] npm run lint 通过 ✅
