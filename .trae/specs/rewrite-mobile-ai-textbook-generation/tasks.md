# Tasks

- [x] Task 1: 重构 MobileAIClient 类
  - [x] SubTask 1.1: 增强构造函数参数验证
  - [x] SubTask 1.2: 添加详细的日志记录
  - [x] SubTask 1.3: 改进 chatWithJson 方法的 JSON 解析逻辑
  - [x] SubTask 1.4: 添加超时和重试机制

- [x] Task 2: 重写 mobileAIService.generateLearningMaterial 方法
  - [x] SubTask 2.1: 优化系统提示词，确保返回有效 JSON
  - [x] SubTask 2.2: 增强 JSON 响应解析和错误处理
  - [x] SubTask 2.3: 规范化关键词数据结构
  - [x] SubTask 2.4: 添加详细的错误日志

- [x] Task 3: 改进 AI 配置检查机制
  - [x] SubTask 3.1: 增强 isConfigured 方法的验证逻辑
  - [x] SubTask 3.2: 改进 getAIConfigFromUserSettings 的配置获取逻辑
  - [x] SubTask 3.3: 添加配置有效性验证

- [x] Task 4: 改进 mobileAiApi.generateLearningMaterial 错误处理
  - [x] SubTask 4.1: 增强移动端检测逻辑
  - [x] SubTask 4.2: 改进错误信息传递
  - [x] SubTask 4.3: 添加降级到云端 API 的逻辑

- [x] Task 5: 验证和测试
  - [x] SubTask 5.1: 运行类型检查 npm run check
  - [x] SubTask 5.2: 运行代码检查 npm run lint

# Task Dependencies
- [Task 2] depends on [Task 1]
- [Task 4] depends on [Task 2]
- [Task 5] depends on [Task 1, Task 2, Task 3, Task 4]
