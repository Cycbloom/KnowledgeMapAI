# 小说/故事创作功能 Bug 修复规格

## Why
Story Creation MVP 已完成开发但未经测试，存在多个致命级 Bug 导致核心功能不可用（模板初始化失败、角色出场不持久化、切换角色状态不同步、出场统计查询报错），以及大量 i18n 缺失导致 UI 显示异常。需要系统性修复才能达到可用状态。

## What Changes
- 修复后端 API 致命 Bug（模板初始化时序错误、出场统计 SQL 错误、关系统计遗漏）
- 修复前端组件致命 Bug（角色出场不持久化、切换角色状态不同步、保存按钮假实现）
- 修复模板代码不匹配问题（UI 与数据库的 template_code 不一致）
- 补全 40+ 缺失的 i18n key 并修正命名不一致
- 修复 Supabase 直连客户端安全漏洞（缺少 graph_id 过滤）
- 解决两个 API 客户端导出名冲突
- 补充缺失的 relationships 后端路由
- 修复代码规范问题（any 类型、非空断言、硬编码中文）

## Impact
- Affected specs: [story-creation-mvp/spec.md](story-creation-mvp/spec.md)
- Affected code:
  - `api/routes/story/` — 修复后端 Bug + 新增 relationships 路由
  - `src/services/api/storyCreation.ts` — 修复类型安全 + 重命名
  - `src/services/api/storyCreationApi.ts` — 修复安全漏洞 + 重命名
  - `src/components/StoryEditor/` — 修复组件 Bug + i18n 修复
  - `src/i18n/locales/` — 补全翻译 key
  - `supabase/migrations/25_story_creation.sql` — 补充缺失的模板数据
  - `shared/types/graph.ts` — 修复类型不匹配

---

## ADDED Requirements

### Requirement: 模板初始化功能正常工作
系统 SHALL 确保模板初始化功能正确创建带父子关系的结构树。

#### Scenario: 使用三幕式模板初始化故事
- **WHEN** 用户选择"三幕式"模板初始化
- **THEN** 系统 SHALL 创建 3 个 Act 节点和对应的 Sequence 节点
- **AND** 每个 Sequence 的 `parent_structure_id` SHALL 正确指向其所属的 Act
- **AND** 模板代码 SHALL 与数据库中的 `template_code` 一致（`three_act`）

#### Scenario: 选择不存在的模板
- **WHEN** 用户选择数据库中不存在的模板（如 `hero_journey`）
- **THEN** 系统 SHALL 返回友好的错误提示，而非静默失败

### Requirement: 角色出场数据正确持久化
系统 SHALL 确保场景编辑器中的角色出场勾选/取消操作正确保存到后端。

#### Scenario: 勾选角色出场并保存
- **WHEN** 用户在场景编辑器中勾选一个角色出场
- **AND** 点击保存
- **THEN** 系统 SHALL 调用 `appearances.create` API 创建出场记录
- **AND** 刷新页面后出场记录 SHALL 仍然存在

#### Scenario: 取消角色出场并保存
- **WHEN** 用户在场景编辑器中取消一个角色的出场勾选
- **AND** 点击保存
- **THEN** 系统 SHALL 调用 `appearances.delete` API 删除出场记录
- **AND** 刷新页面后该出场记录 SHALL 不再存在

### Requirement: 角色编辑器状态同步
系统 SHALL 确保切换角色时编辑器表单正确更新。

#### Scenario: 切换到不同角色
- **WHEN** 用户在角色面板中选择一个不同的角色
- **THEN** 角色编辑器 SHALL 显示新角色的所有信息
- **AND** 表单字段 SHALL 反映新角色的当前值

### Requirement: 出场统计查询正确工作
系统 SHALL 确保角色出场统计 API 返回正确数据。

#### Scenario: 查询角色出场统计
- **WHEN** 调用 `GET /api/story/:graphId/appearances/stats/:characterId`
- **THEN** 系统 SHALL 通过正确的表关联查询出场数据
- **AND** 返回包含 `totalAppearances`、`roleBreakdown` 的统计数据

### Requirement: 关系统计双向计算
系统 SHALL 同时计算角色作为 source 和 target 的关系数量。

#### Scenario: 查询角色列表含关系统计
- **WHEN** 调用 `GET /api/story/:graphId/characters`
- **THEN** 每个角色的 `_count.relationships` SHALL 包含 source 和 target 两个方向的关系总数

### Requirement: i18n 翻译完整且一致
系统 SHALL 确保所有组件中使用的 i18n key 在翻译文件中存在且命名一致。

#### Scenario: 所有 UI 文本正确显示
- **WHEN** 用户使用中文或英文界面
- **THEN** 所有标签、占位符、提示文本 SHALL 显示翻译后的文本
- **AND** 不应显示原始 i18n key（如 `storyEditor.synopsisPlaceholder`）

### Requirement: API 安全性
系统 SHALL 确保所有数据操作限定在当前图谱范围内。

#### Scenario: 更新或删除操作限定图谱范围
- **WHEN** 通过 Supabase 直连客户端执行 update/delete 操作
- **THEN** 查询条件 SHALL 同时包含记录 ID 和 graph_id
- **AND** 不允许修改或删除其他图谱中的数据

### Requirement: 角色关系后端路由
系统 SHALL 提供角色关系的后端 API 路由。

#### Scenario: 管理角色关系
- **WHEN** 前端需要创建、查询或删除角色关系
- **THEN** 系统 SHALL 通过后端 API 路由处理（而非直接操作数据库）
- **AND** 所有关系操作 SHALL 经过认证和权限验证

### Requirement: 保存按钮实际保存数据
系统 SHALL 确保保存按钮触发实际的数据持久化操作。

#### Scenario: 点击保存按钮
- **WHEN** 用户点击 StoryEditor 工具栏的保存按钮
- **THEN** 系统 SHALL 保存当前所有未保存的修改
- **AND** 显示真实的保存结果（成功或失败）

## MODIFIED Requirements

### Requirement: 模板选择器仅显示可用模板
UI 中的模板选择器 SHALL 仅显示数据库中实际存在的模板。当前 UI 显示了三个模板（三幕式/英雄之旅/救猫咪），但数据库只有三幕式。

#### Scenario: 模板选择器显示
- **WHEN** 用户打开模板选择器
- **THEN** 仅显示数据库中存在的模板
- **AND** 每个模板选项使用 i18n 翻译而非硬编码中文
