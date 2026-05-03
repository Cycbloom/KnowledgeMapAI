# 修复本地数据库迁移状态不一致 Spec

## Why

当用户在本地开发时运行 `npx supabase db reset` 后，Supabase CLI 会执行所有迁移文件并记录在 `supabase_migrations.schema_migrations` 表中，但应用自建的 `public._schema_versions` 表虽然被创建（因为 `00a_schema_versions.sql` 是迁移文件之一），却没有插入任何记录。这导致应用的 `MigrationService.getDatabaseStatus()` 检测到有未执行的迁移版本，错误地报告 `needs_upgrade` 状态，在 UI 上显示"数据库需要升级，有新的迁移待执行"的警告。

## What Changes

- **在 `MigrationService` 中增加迁移状态同步机制**：当检测到 `_schema_versions` 为空但 `supabase_migrations.schema_migrations` 有记录时，自动将当前迁移文件版本同步到 `_schema_versions` 表
- **修改 `getDatabaseStatus()` 方法**：在返回 `needs_upgrade` 之前，先尝试与 Supabase CLI 的迁移记录进行对账，如果对账成功则返回 `ready`
- **增加 `syncSchemaVersions()` 方法**：根据 Supabase CLI 的迁移记录和当前迁移文件，自动填充 `_schema_versions` 表

## Impact

- Affected code:
  - `api/services/migration/migrationService.ts` — 核心修改
  - `api/routes/database.ts` — 可能需要暴露同步 API（可选）
- Affected UI:
  - `src/components/Layout/Layout.tsx` — 全局警告横幅（无需修改，状态修复后自动不显示）
  - `src/pages/Settings.tsx` — 数据库状态显示（无需修改，状态修复后自动正确显示）

## ADDED Requirements

### Requirement: 迁移状态自动同步

系统 SHALL 在检测到 `_schema_versions` 表为空但 Supabase CLI 已执行过迁移时，自动将迁移文件版本同步到 `_schema_versions` 表。

#### Scenario: Supabase CLI 执行 db reset 后应用检测状态
- **WHEN** 用户运行 `npx supabase db reset` 后启动应用
- **AND** `_schema_versions` 表存在但为空
- **AND** `supabase_migrations.schema_migrations` 表有记录
- **THEN** 系统应自动将当前所有迁移文件的版本和 checksum 插入 `_schema_versions`
- **AND** `getDatabaseStatus()` 返回 `ready` 状态

#### Scenario: _schema_versions 不存在且 Supabase CLI 已执行迁移
- **WHEN** `_schema_versions` 表不存在
- **AND** `supabase_migrations.schema_migrations` 表有记录
- **THEN** 系统应创建 `_schema_versions` 表并插入所有迁移版本
- **AND** `getDatabaseStatus()` 返回 `ready` 状态

#### Scenario: 全新数据库（无任何迁移记录）
- **WHEN** `_schema_versions` 表不存在或为空
- **AND** `supabase_migrations.schema_migrations` 表也不存在或为空
- **THEN** 系统应保持原有行为，返回 `empty` 或 `partial` 状态

#### Scenario: 正常运行状态
- **WHEN** `_schema_versions` 表有完整记录
- **THEN** 系统应保持原有行为，直接根据 `_schema_versions` 判断状态

### Requirement: 同步逻辑仅补充缺失记录

系统 SHALL 在同步时仅插入 `_schema_versions` 中不存在的记录，不修改或删除已有记录。

#### Scenario: 部分同步（部分迁移已记录）
- **WHEN** `_schema_versions` 中已有部分迁移记录
- **AND** Supabase CLI 的迁移记录表明更多迁移已执行
- **THEN** 系统仅插入缺失的迁移版本记录
- **AND** 不修改已有记录的 checksum 或 executed_at

## MODIFIED Requirements

### Requirement: 数据库状态检测

原有行为：`getDatabaseStatus()` 仅查询 `_schema_versions` 表判断迁移状态，不感知 Supabase CLI 的迁移记录。

修改后行为：`getDatabaseStatus()` 在判断状态前，先检查是否需要与 Supabase CLI 迁移记录同步，如果需要则自动同步后再返回状态。
