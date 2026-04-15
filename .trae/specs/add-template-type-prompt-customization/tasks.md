# Tasks

- [x] Task 1: 在种子数据中添加 18 个模板类型的系统级提示词记录
  - [x] SubTask 1.1: 在 `00000000000001_initial_seed.sql` 中添加 INSERT INTO prompt_templates 语句，code 格式为 `template_type_{type}`
  - [x] SubTask 1.2: 更新远程迁移脚本 `remote_migration_template_refactor.sql` 添加对应的 INSERT 语句

- [x] Task 2: 修改 templateGeneratorService.ts 从 promptService 获取模板类型指导
  - [x] SubTask 2.1: 修改 `buildSystemPrompt` 方法，将硬编码的 `templateTypeGuides` 替换为 `promptService.getRenderedPrompt` 调用
  - [x] SubTask 2.2: 修改 `generateTemplates` 方法签名，添加 `userId` 和 `graphId` 参数传递
  - [x] SubTask 2.3: 修改 API 路由 `autoGraph.ts`，在调用 generateTemplates 时传递 `userId` 和 `graphId`

- [x] Task 3: 在 PromptSettingsPanel 中添加"模板生成"分类
  - [x] SubTask 3.1: 在 PromptSettingsPanel 的分类定义中添加"模板生成"分类
  - [x] SubTask 3.2: 为 18 个模板类型添加提示词配置项
  - [x] SubTask 3.3: 确保编辑/自定义/重置功能正常工作

- [x] Task 4: 在 promptScenarios.tsx 中添加模板生成场景
  - [x] SubTask 4.1: 添加"模板生成"场景定义
  - [x] SubTask 4.2: 为 18 个模板类型添加子场景

- [x] Task 5: 添加 i18n 翻译
  - [x] SubTask 5.1: 在 zh-CN.json 中添加模板生成分类和场景的翻译
  - [x] SubTask 5.2: 在 en-US.json 中添加模板生成分类和场景的翻译

- [x] Task 6: 运行 lint 和类型检查
  - [x] SubTask 6.1: 运行 `npm run lint`
  - [x] SubTask 6.2: 运行 `npm run check`

# Task Dependencies

- [Task 1] 是基础，Task 2 依赖它（需要数据库有种子数据才能从 promptService 获取）
- [Task 2] 和 [Task 3] 可并行
- [Task 3] 依赖 [Task 5]（需要 i18n 翻译）
- [Task 4] 依赖 [Task 5]
- [Task 6] 依赖所有其他 Task
