# Checklist - Story Creation Bug 修复

## 致命 Bug 修复验证

- [x] 三幕式模板初始化后，所有 Sequence 节点的 `parent_structure_id` 正确指向其所属 Act
- [x] `GET /api/story/:graphId/appearances/stats/:characterId` 返回正确数据，不报 SQL 错误
- [x] 角色列表中 `_count.relationships` 包含 source 和 target 两个方向的关系总数
- [x] 场景编辑器勾选角色出场后保存，刷新页面出场记录仍存在
- [x] 场景编辑器取消角色出场后保存，刷新页面出场记录已删除
- [x] 切换角色后，角色编辑器表单正确显示新角色的所有信息

## 模板功能验证

- [x] 模板选择器中的模板代码与数据库 `story_templates.template_code` 一致
- [x] 不存在的模板不会出现在选择器中，或选择后给出友好错误提示
- [x] 模板名称使用 i18n 翻译，无硬编码中文

## i18n 验证

- [x] 所有组件中使用的 i18n key 在 `zh-CN.json` 和 `en-US.json` 中均存在
- [x] i18n key 命名在组件和翻译文件中一致（添加了嵌套键 status.draft, roles.protagonist 等）
- [x] 中文界面下所有 UI 文本正确显示中文翻译
- [x] 英文界面下所有 UI 文本正确显示英文翻译
- [x] 角色类型标签使用 i18n 而非硬编码中文

## 安全性验证

- [x] Supabase 直连客户端的 `structures.update/delete` 包含 `graph_id` 过滤
- [x] Supabase 直连客户端的 `characters.update/delete` 包含 `graph_id` 过滤
- [x] Supabase 直连客户端的 `appearances.remove` 包含 `graph_id` 过滤
- [x] 两个 API 客户端导出名不冲突（storyCreationHttpApi / storyCreationSupabaseApi）

## 后端路由验证

- [x] `GET /api/story/:graphId/relationships` 返回关系列表
- [x] `POST /api/story/:graphId/relationships` 创建新关系
- [x] `DELETE /api/story/:graphId/relationships/:id` 删除关系
- [x] HTTP 客户端包含 `relationships` 命名空间

## 代码规范验证

- [x] 无 `any` 类型（`StoryEditor.tsx` 的 `graphMeta` 使用 `Graph` 类型）
- [x] 无非空断言 `!`（使用可选链和空值合并替代）
- [x] 场景节点不可添加子节点
- [x] 新建节点的 `display_order` 正确递增
- [x] `CharacterPanel.tsx` 的 `roleConfig` 有默认值回退，不会运行时崩溃
- [x] `npm run check` 通过 ✅
- [x] `npm run lint` 通过 ✅（1 个预存错误不在修改范围内）

## 保存功能验证

- [x] StoryEditor 保存按钮触发实际的数据持久化
- [x] 保存成功显示成功提示
- [x] 保存失败显示错误提示
