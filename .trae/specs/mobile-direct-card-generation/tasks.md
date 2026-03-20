# Tasks

- [x] Task 1: 实现移动端 Prompt 获取服务
  - [x] SubTask 1.1: 创建移动端 Prompt 服务模块（参考后端 promptService）
  - [x] SubTask 1.2: 实现 Prompt 模板优先级获取逻辑（graph > user > system）
  - [x] SubTask 1.3: 实现模板变量渲染引擎（支持 `{{variable}}` 和 `{{#if}}` 语法）
  - [x] SubTask 1.4: 添加默认 Prompt 常量（与后端 DEFAULT_PROMPTS 保持一致）

- [x] Task 2: 优化移动端 AI 配置检测和用户引导
  - [x] SubTask 2.1: 在 GenerateCardsModal 中添加移动端 AI 配置状态检测
  - [x] SubTask 2.2: 创建 AI 配置缺失时的引导 UI（显示提示和"前往设置"按钮）
  - [x] SubTask 2.3: 添加配置检测 hook 或工具函数复用

- [x] Task 3: 增强移动端题目生成流程
  - [x] SubTask 3.1: 修改 mobileAIService.generateCards 支持从数据库获取 Prompt
  - [x] SubTask 3.2: 在 LearningMode.tsx 中添加移动端环境检测
  - [x] SubTask 3.3: 为移动端添加实时进度反馈（显示"正在生成第 X/Y 题"）
  - [x] SubTask 3.4: 添加取消生成操作的功能

- [x] Task 4: 改进错误处理和用户反馈
  - [x] SubTask 4.1: 添加 AI 服务调用失败的错误处理
  - [x] SubTask 4.2: 添加数据库写入失败的错误处理
  - [x] SubTask 4.3: 提供重试机制和恢复建议

- [x] Task 5: 更新 GenerateCardsModal 组件
  - [x] SubTask 5.1: 根据运行环境显示不同的提示信息
  - [x] SubTask 5.2: 添加移动端专用的加载状态 UI

- [x] Task 6: 验证和测试
  - [x] SubTask 6.1: 验证移动端配置检测功能
  - [x] SubTask 6.2: 验证 Prompt 数据库同步功能
  - [x] SubTask 6.3: 验证题目生成流程
  - [x] SubTask 6.4: 验证错误处理流程

# Task Dependencies

- [Task 3] depends on [Task 1]
- [Task 4] depends on [Task 3]
- [Task 5] depends on [Task 2]
- [Task 6] depends on [Task 1, Task 2, Task 3, Task 4, Task 5]
