# Checklist - 为创建Dialog添加Prompt配置功能

## 组件开发

- [x] PromptConfigPanel组件创建完成
- [x] PromptConfigPanel布局与AIActionSettingsPanel保持一致
- [x] 场景列表正确显示（图谱创建、测验生成）
- [x] PromptEditor正确集成到配置面板

## Dialog集成

- [x] QuizGenerationModal标题栏添加prompt配置按钮
- [x] QuickCreateGraphPanel标题栏添加prompt配置按钮
- [x] 按钮样式与现有UI一致
- [x] 点击按钮正确打开PromptConfigPanel

## 配置持久化

- [x] 用户设置API扩展完成
- [x] prompt配置可以保存到用户设置
- [x] prompt配置可以从用户设置加载
- [x] 创建Dialog使用用户保存的prompt配置

## 变量支持

- [x] 图谱创建场景支持正确的变量列表
- [x] 测验生成场景支持正确的变量列表
- [x] 变量可以正确插入到模板中

## 代码质量

- [x] 类型检查通过 (npm run check)
- [x] ESLint检查通过 (npm run lint)
- [x] 无TypeScript错误

## 功能验收

- [ ] 可以打开QuizGenerationModal并点击prompt配置按钮
- [ ] 可以打开QuickCreateGraphPanel并点击prompt配置按钮
- [ ] PromptConfigPanel正确显示场景列表
- [ ] 可以编辑并保存prompt配置
- [ ] 保存的配置在下次打开时正确加载
