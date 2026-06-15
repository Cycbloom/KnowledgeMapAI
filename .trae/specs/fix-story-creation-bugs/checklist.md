# Checklist - Story Creation Bug 修复

## 致命 Bug 修复验证

- [ ] 三幕式模板初始化后，所有 Sequence 节点的 `parent_structure_id` 正确指向其所属 Act
- [ ] `GET /api/story/:graphId/appearances/stats/:characterId` 返回正确数据，不报 SQL 错误
- [ ] 角色列表中 `_count.relationships` 包含 source 和 target 两个方向的关系总数
- [ ] 场景编辑器勾选角色出场后保存，刷新页面出场记录仍存在
- [ ] 场景编辑器取消角色出场后保存，刷新页面出场记录已删除
- [ ] 切换角色后，角色编辑器表单正确显示新角色的所有信息

## 模板功能验证

- [ ] 模板选择器中的模板代码与数据库 `story_templates.template_code` 一致
- [ ] 不存在的模板不会出现在选择器中，或选择后给出友好错误提示
- [ ] 模板名称使用 i18n 翻译，无硬编码中文

## i18n 验证

- [ ] 所有组件中使用的 i18n key 在 `zh-CN.json` 和 `en-US.json` 中均存在
- [ ] i18n key 命名在组件和翻译文件中一致（无 `status.draft` vs `statusDraft` 等不一致）
- [ ] 中文界面下所有 UI 文本正确显示中文翻译
- [ ] 英文界面下所有 UI 文本正确显示英文翻译
- [ ] 角色类型标签使用 i18n 而非硬编码中文

## 安全性验证

- [ ] Supabase 直连客户端的 `structures.update/delete` 包含 `graph_id` 过滤
- [ ] Supabase 直连客户端的 `characters.update/delete` 包含 `graph_id` 过滤
- [ ] Supabase 直连客户端的 `appearances.remove` 包含 `graph_id` 过滤
- [ ] 两个 API 客户端导出名不冲突

## 后端路由验证

- [ ] `GET /api/story/:graphId/relationships` 返回关系列表
- [ ] `POST /api/story/:graphId/relationships` 创建新关系
- [ ] `DELETE /api/story/relationships/:id` 删除关系
- [ ] HTTP 客户端包含 `relationships` 命名空间

## 代码规范验证

- [ ] 无 `any` 类型（`StoryEditor.tsx` 的 `graphMeta` 使用具体类型）
- [ ] 无非空断言 `!`（使用可选链和空值合并替代）
- [ ] 场景节点不可添加子节点
- [ ] 新建节点的 `display_order` 正确递增
- [ ] `CharacterPanel.tsx` 的 `roleConfig` 有默认值回退，不会运行时崩溃
- [ ] `npm run check` 通过
- [ ] `npm run lint` 通过

## 保存功能验证

- [ ] StoryEditor 保存按钮触发实际的数据持久化
- [ ] 保存成功显示成功提示
- [ ] 保存失败显示错误提示
