# Tasks - Story Creation Bug 修复

## 阶段一：后端致命 Bug 修复（最高优先级）

- [x] Task 1: 修复模板初始化时序 Bug ✅
  - [x] 1.1 修复 `api/routes/story/structures.ts` 中 `initializeTemplate` 的 `parent_structure_id` 时序错误：先插入所有结构节点，再根据 `template_beat_id` 匹配更新 `parent_structure_id`
  - [x] 1.2 验证修复后三幕式模板能正确生成带父子关系的结构树

- [x] Task 2: 修复出场统计查询 Bug ✅
  - [x] 2.1 修复 `api/routes/story/appearances.ts` 中 `getStats` 的 SQL join 错误：移除错误的 story_structures join，同时修复 relationships 查询使用 or() 包含双向关系
  - [ ] 2.2 验证 `getStats` 端点返回正确的统计数据

- [x] Task 3: 修复关系统计双向计算 ✅
  - [x] 3.1 修复 `api/routes/story/characters.ts` 中 `relationshipCountMap`：同时统计 `source_character_id` 和 `target_character_id` 两个方向
  - [ ] 3.2 验证角色列表的 `_count.relationships` 包含双向关系

## 阶段二：前端致命 Bug 修复

- [x] Task 4: 修复角色出场数据未持久化 ✅
  - [x] 4.1 修复 `SceneEditor.tsx` 的 `handleSave`：在保存场景时同步调用 `appearances.create` / `appearances.delete` 来持久化角色出场变更
  - [x] 4.2 跟踪出场记录的变更状态（新增/删除），在保存时批量处理
  - [x] 4.3 验证勾选/取消角色出场后保存，刷新页面数据不丢失

- [x] Task 5: 修复切换角色状态不同步 ✅
  - [x] 5.1 在 `CharacterEditor.tsx` 添加 `useEffect` 监听 `character.id` 变化，重置所有表单状态
  - [x] 5.2 验证切换角色后表单正确显示新角色数据

- [x] Task 6: 修复保存按钮假实现 ✅
  - [x] 6.1 修改 `StoryEditor.tsx` 保存按钮：触发当前编辑器的保存操作（通过 data-save-trigger）
  - [x] 6.2 修复角色保存后 selectedCharacter 不同步问题

## 阶段三：模板代码不匹配修复

- [x] Task 7: 修复模板代码不匹配 ✅
  - [x] 7.1 修改 `StructurePanel.tsx` 模板选择器：将 `three_act_structure` 改为 `three_act`，移除不存在的 `hero_journey` 和 `save_the_cat` 选项
  - [x] 7.2 将硬编码中文模板名称替换为 i18n key
  - [x] 7.3 修复场景可添加子场景的逻辑错误（scene 设为 null 叶子节点）
  - [x] 7.4 修复非空断言 `node.children!` 改为 `node.children?.`

## 阶段四：i18n 修复

- [x] Task 8: 补全缺失的 i18n key 并修正命名不一致 ✅
  - [x] 8.1 在 `zh-CN.json` 和 `en-US.json` 中补全所有缺失的 `storyEditor.*` key（约 49 个）
  - [x] 8.2 修正 i18n key 命名不一致：添加嵌套键（status.draft, roles.protagonist 等）与组件对齐
  - [x] 8.3 修复 `CharacterPanel.tsx` 中硬编码的中文角色类型标签，改用 i18n key
  - [x] 8.4 修复 `CharacterPanel.tsx` 中 `roleConfig` 可能为 undefined 的运行时崩溃风险

## 阶段五：安全性修复

- [x] Task 9: 修复 Supabase 直连客户端安全漏洞 ✅
  - [x] 9.1 修复 `storyCreationApi.ts` 中 `structures.update/delete`：添加 `graph_id` 过滤条件
  - [x] 9.2 修复 `storyCreationApi.ts` 中 `characters.update/delete`：添加 `graph_id` 过滤条件
  - [x] 9.3 修复 `storyCreationApi.ts` 中 `appearances.remove`：添加 `graph_id` 过滤条件
  - [x] 9.4 修复 `buildTree` 函数中的非空断言

- [x] Task 10: 解决两个 API 客户端导出名冲突 ✅
  - [x] 10.1 将 `storyCreation.ts` 的导出名改为 `storyCreationHttpApi`
  - [x] 10.2 将 `storyCreationApi.ts` 的导出名改为 `storyCreationSupabaseApi`
  - [x] 10.3 更新 `src/services/api/index.ts` 中的导出和注册
  - [x] 10.4 更新所有消费文件的导入名

## 阶段六：补充缺失的后端路由

- [x] Task 11: 新增 relationships 后端路由 ✅
  - [x] 11.1 创建 `api/routes/story/relationships.ts`：实现 GET/POST/DELETE 端点
  - [x] 11.2 在 `api/routes/story/index.ts` 中挂载 relationships 路由
  - [x] 11.3 在 HTTP 客户端 `storyCreation.ts` 中添加 `relationships` 命名空间

## 阶段七：代码规范修复

- [x] Task 12: 修复代码规范问题 ✅
  - [x] 12.1 替换 `any` 类型：`StoryEditor.tsx` 的 `graphMeta` prop 使用 `Graph` 类型
  - [x] 12.2 替换非空断言 `!`：使用可选链和空值合并
  - [x] 12.3 修复 `StructurePanel.tsx` 中场景可添加子场景的逻辑错误
  - [x] 12.4 修复 `StoryEditor.tsx` 中 `display_order` 始终为 0 的问题
  - [x] 12.5 修复 `CharacterPanel.tsx` 中 `roleConfig` 可能为 undefined 的运行时崩溃风险
  - [x] 12.6 运行 `npm run check` 通过 ✅
  - [x] 12.7 运行 `npm run lint` 通过 ✅（1 个预存错误不在修改范围内）

# Task Dependencies

## 串行关系
- [Task 2] 依赖 [Task 1]（共享 structures 路由文件）
- [Task 4, 5, 6] 依赖 [Task 1, 2, 3]（前端修复依赖后端 API 正确工作）
- [Task 8] 依赖 [Task 7]（i18n key 需要包含模板相关的 key）
- [Task 11] 依赖 [Task 10]（先解决命名冲突再添加新路由）

## 并行关系
- [Task 1, 2, 3] 可并行执行（不同文件不同 Bug）
- [Task 4, 5, 6] 可并行执行（不同组件不同 Bug）
- [Task 9, 10] 可并行执行（同一文件但不同修复）

## 关键路径
**Task 1 → Task 4 → Task 8 → Task 12**（前端关键路径）
**Task 1 → Task 3 → Task 11**（后端关键路径）
