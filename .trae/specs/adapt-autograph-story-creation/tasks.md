# Tasks - AI 图谱生成器适配故事创作模板

## Task 1: 添加故事创作专属类型定义
- [x] 1.1 在 `shared/types/graph.ts` 中添加 `StoryCreationConfig` 接口（genre、coreConflict、characterHints）
- [x] 1.2 在 `TEMPLATE_TYPE_MAP` 的 `story_creation` 条目中添加 `storyConfig` 字段标记
- [x] 1.3 运行 `npm run check:incremental` 验证类型

## Task 2: AutoGraphGenerator 添加故事创作专属 UI
- [x] 2.1 添加故事专属状态变量（genre、coreConflict、characterHints）
- [x] 2.2 修改 `handleSelectTemplateType`：选择 `story_creation` 时初始化故事专属状态，切换走其他模板时清除
- [x] 2.3 实现 `renderStoryCreationConfig()` 方法：渲染故事题材/类型下拉、核心冲突 textarea、角色提示 textarea
- [x] 2.4 修改主渲染逻辑：当 `selectedTemplateType === "story_creation"` 时，隐藏通用风格选择和参考来源区域，显示故事专属配置
- [x] 2.5 修改 `handleInitialize()`：当 `story_creation` 时传递故事专属参数（genre、coreConflict、characterHints）

## Task 3: 添加 i18n 翻译
- [x] 3.1 在 `zh-CN.json` 的 autoGraph 部分添加故事创作相关 key（storyGenre、coreConflict、characterHints、各题材选项等）
- [x] 3.2 在 `en-US.json` 中添加对应英文翻译

## Task 4: 后端添加故事创作专属生成逻辑
- [x] 4.1 在 `api/routes/autoGraph.ts` 的 `/init` 路由中，为 `story_creation` 添加专属分支，提取 storyConfig 参数
- [x] 4.2 在 `api/services/ai/templateGeneratorService.ts` 中添加 `generateStoryCreationStructure()` 方法：
  - 构建故事创作专属 system prompt（指导 AI 生成 Story→Act→Sequence 层级结构 + 角色节点）
  - 解析 AI 返回的 JSON 结构
  - 生成包含层级关系的节点树和边
- [x] 4.3 在 `autoGraph.ts` 的 `/init` 路由中调用 `generateStoryCreationStructure()` 替代通用生成路径
- [x] 4.4 确保 `getMockTemplates()` 中为 `story_creation` 提供合理的 mock 数据

## Task 5: 保存流程适配
- [x] 5.1 修改 `handleSaveToGraph()`：当 `story_creation` 时，保存后确保跳转到 StoryEditor
- [x] 5.2 验证保存后的图谱在 StoryEditor 中能正确显示 AI 生成的初始结构

## Task 6: 集成测试与验证
- [x] 6.1 运行 `npm run check` 验证类型检查通过
- [x] 6.2 运行 `npm run lint` 验证代码规范
- [x] 6.3 手动测试完整流程：选择故事创作 → 填写专属配置 → 生成 → 保存 → StoryEditor 查看

# Task Dependencies
- [Task 2] 依赖 [Task 1]（需要类型定义）
- [Task 3] 可与 [Task 2] 并行
- [Task 4] 依赖 [Task 1]（需要类型定义）
- [Task 5] 依赖 [Task 2, 4]
- [Task 6] 依赖 [Task 2, 3, 4, 5]
