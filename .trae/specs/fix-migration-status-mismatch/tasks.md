# Tasks

- [x] Task 1: 在 MigrationService 中增加 `syncSchemaVersions()` 方法
  - [x] SubTask 1.1: 实现 `isSupabaseMigrationsApplied()` 私有方法，检查 `supabase_migrations.schema_migrations` 表是否存在且有记录
  - [x] SubTask 1.2: 实现 `syncSchemaVersions()` 方法，当 Supabase CLI 已执行迁移但 `_schema_versions` 为空时，自动将当前迁移文件版本和 checksum 插入 `_schema_versions`
  - [x] SubTask 1.3: 确保同步逻辑仅插入缺失记录（INSERT ... ON CONFLICT DO NOTHING），不修改已有记录
- [x] Task 2: 修改 `getDatabaseStatus()` 方法，在返回状态前自动同步
  - [x] SubTask 2.1: 在 `needs_upgrade` 判断之前，调用 `syncSchemaVersions()` 尝试同步
  - [x] SubTask 2.2: 同步后重新计算 missingVersions，如果为空则返回 `ready`
  - [x] SubTask 2.3: 在 `partial` 状态下也尝试同步（`_schema_versions` 不存在但 Supabase CLI 已执行迁移的情况）
- [x] Task 3: 验证修复效果
  - [x] SubTask 3.1: 运行 `npm run check` 确保类型检查通过
  - [x] SubTask 3.2: 运行 `npm run lint` 确保代码规范通过

# Task Dependencies
- Task 2 depends on Task 1
- Task 3 depends on Task 2
