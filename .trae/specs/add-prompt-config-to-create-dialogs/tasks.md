# Tasks - 为创建Dialog添加Prompt配置功能

## 阶段一：创建统一的Prompt配置组件

- [x] Task 1: 创建PromptConfigPanel组件
  - [x] 创建 `src/components/PromptConfig/PromptConfigPanel.tsx`
  - [x] 实现场景列表展示（图谱创建、测验生成等）
  - [x] 实现编辑区域（使用现有的PromptEditor组件）
  - [x] 参照 `AIActionSettingsPanel` 的布局和样式

- [x] Task 2: 定义Prompt配置场景
  - [x] 创建 `src/components/PromptConfig/promptScenarios.tsx`
  - [x] 定义图谱创建场景（graph_creation）
  - [x] 定义测验生成场景（quiz_generation）
  - [x] 定义每个场景的可用变量和默认模板

## 阶段二：集成到创建Dialog

- [x] Task 3: 修改QuizGenerationModal
  - [x] 在标题栏添加prompt配置按钮（Settings图标）
  - [x] 点击按钮打开PromptConfigPanel
  - [x] 将用户保存的prompt配置应用到测验生成

- [x] Task 4: 修改QuickCreateGraphPanel
  - [x] 在标题栏添加prompt配置按钮（Settings图标）
  - [x] 点击按钮打开PromptConfigPanel
  - [x] 将用户保存的prompt配置应用到图谱创建

## 阶段三：持久化存储

- [x] Task 5: 扩展用户设置API
  - [x] 在用户设置中添加prompt_configs字段
  - [x] 实现保存prompt配置的API（使用现有的updateProfile）
  - [x] 实现读取prompt配置的API（使用现有的useUser）

- [x] Task 6: 实现配置加载和保存逻辑
  - [x] PromptConfigPanel加载用户已保存的配置
  - [x] 保存用户编辑的配置到用户设置
  - [x] 在创建Dialog中自动加载用户配置

## 阶段四：测试验证

- [x] Task 7: 代码质量检查
  - [x] 运行 `npm run check` 确保类型正确
  - [x] 运行 `npm run lint` 确保代码规范

- [ ] Task 8: 功能验证
  - [ ] 验证QuizGenerationModal中prompt配置按钮可点击
  - [ ] 验证QuickCreateGraphPanel中prompt配置按钮可点击
  - [ ] 验证PromptConfigPanel正确显示场景列表
  - [ ] 验证prompt配置可以保存和加载

---

# Task Dependencies

- Task 2 依赖 Task 1
- Task 3-4 依赖 Task 1-2（可并行开发）
- Task 5-6 依赖 Task 1（可并行开发）
- Task 7-8 依赖 Task 1-6
