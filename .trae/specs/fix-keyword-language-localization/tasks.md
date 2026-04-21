# Tasks

- [x] Task 1: 修复服务端 aiService 中关键词 category 的硬编码中文回退值
  - [x] SubTask 1.1: 修改 `api/services/ai/aiService.ts` 第 1229 行，将 `category: k.category || "概念"` 改为根据 language 参数动态选择回退值
  - [x] SubTask 1.2: 修改 Mock 响应（第 1132-1151 行）中的硬编码中文关键词，改为根据语言参数动态生成

- [x] Task 2: 修复移动端 aiService 的语言参数支持
  - [x] SubTask 2.1: 将 `src/services/mobile/aiService.ts` 中的 `LEARNING_MATERIAL_SYSTEM_PROMPT` 改为函数，根据 language 参数动态生成 prompt（英文/中文模板 + 对应的 category 选项 + 语言指令）
  - [x] SubTask 2.2: 修改 `generateLearningMaterial` 方法签名，options 增加 `language?: string`
  - [x] SubTask 2.3: 修改 `generateLearningMaterial` 方法内部，使用动态 prompt 函数替代硬编码常量
  - [x] SubTask 2.4: 修改用户 prompt 生成逻辑，根据语言参数切换中英文
  - [x] SubTask 2.5: 修改关键词归一化中的 category 回退值，根据语言参数动态选择

- [x] Task 3: 修复移动端 API 层的 language 传递
  - [x] SubTask 3.1: 修改 `src/services/mobile/ai.ts` 中 `generateLearningMaterial` 的 data 类型，增加 `language?: string`
  - [x] SubTask 3.2: 调用本地服务时传递 language 参数
  - [x] SubTask 3.3: 调用 API 时通过 injectAIConfig 注入 language

# Task Dependencies
- [Task 2] depends on [Task 3]（移动端 API 层需要先支持 language 参数，aiService 才能接收到）
