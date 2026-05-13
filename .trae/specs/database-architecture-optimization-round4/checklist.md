# Checklist: 数据库架构优化（第四轮）

## R6 - 废弃标记与收尾验证

- [x] Task 1: SM2 字段的 COMMENT 包含 `[DEPRECATED]`，表注释说明 FSRS 迁移方向
- [x] Task 2: 4 条 DROP COLUMN 语句上方有清晰注释说明历史用途
- [x] Task 3: 整个 migrations/ 目录（含 seed 文件）中 `TIMESTAMP WITH TIME ZONE` 搜索结果为 0

## 整体验证

- [x] 所有迁移文件语法无冲突
- [x] 无运行时行为变更