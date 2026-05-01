# Tasks

- [x] Task 1: 扩展 AI 服务商类型和后端 Provider
  - [x] SubTask 1.1: 修改 `shared/types/ai.ts`，扩展 `AIProviderType` 为 `"deepseek" | "volcengine" | "aliyun" | "openai" | "zhipu" | "moonshot"`
  - [x] SubTask 1.2: 创建 `api/services/ai/providers/openai.ts`，实现 OpenAI Provider（标准 OpenAI 兼容接口）
  - [x] SubTask 1.3: 创建 `api/services/ai/providers/zhipu.ts`，实现智谱 AI Provider
  - [x] SubTask 1.4: 创建 `api/services/ai/providers/moonshot.ts`，实现月之暗面 Provider
  - [x] SubTask 1.5: 修改 `api/services/ai/factory.ts`，在 switch 中添加新 Provider 分支
  - [x] SubTask 1.6: 修改 `api/services/ai/config.ts`，在 `getEnvConfig` 中添加新服务商的环境变量配置
  - [x] SubTask 1.7: 修改 `api/routes/ai/config.ts`，更新 `PROVIDER_DEFAULTS` 和 `PROVIDER_ENV_KEY_MAP` 添加新服务商

- [x] Task 2: 简化后端 AI 任务配置逻辑
  - [x] SubTask 2.1: 修改 `api/services/ai/config.ts` 的 `getProviderForTask`，text/reasoning/tts 使用主 AI 配置，embedding 使用向量化配置
  - [x] SubTask 2.2: 修改 `api/routes/ai/config.ts`，新增 GET/PUT `/api/ai/config/main-ai` 端点（主 AI 配置）和 GET/PUT `/api/ai/config/embedding` 端点（向量化配置）
  - [x] SubTask 2.3: 修改 embedding 相关服务（`api/services/ai/aiService.ts`、`api/services/ai/embeddingService.ts`），向量化未配置时优雅降级

- [x] Task 3: 更新前端移动端 AI 配置
  - [x] SubTask 3.1: 修改 `src/services/mobile/aiClient.ts`，扩展 `PROVIDER_CONFIGS` 和 `VALID_PROVIDERS` 添加新服务商
  - [x] SubTask 3.2: 修改 `src/services/mobile/aiService.ts`，扩展 `ENV_API_KEYS` 添加新服务商

- [x] Task 4: 简化前端设置页面 AI 配置 UI
  - [x] SubTask 4.1: 修改 `src/pages/Settings.tsx`，移除原来的三任务独立配置区域（textConfig/embeddingConfig/reasoningConfig），替换为主 AI 配置 + 向量化配置（可选）
  - [x] SubTask 4.2: 更新 `PROVIDER_DEFAULTS` 添加新服务商（OpenAI、智谱、月之暗面）
  - [x] SubTask 4.3: 主 AI 配置区域：服务商下拉（6家）、API Key 输入、模型选择，选择服务商后自动填充默认值
  - [x] SubTask 4.4: 向量化配置区域：标注为可选，服务商下拉（仅支持 embedding 的服务商），未配置时显示功能停用提示
  - [x] SubTask 4.5: 保留模型管理功能（添加/删除模型）

- [x] Task 5: 国际化与收尾
  - [x] SubTask 5.1: 在 `src/i18n/locales/zh-CN.json` 中新增翻译（新服务商名称、主 AI 配置、向量化配置等）
  - [x] SubTask 5.2: 在 `src/i18n/locales/en-US.json` 中新增翻译
  - [x] SubTask 5.3: 运行 `npm run check` 和 `npm run lint` 确保无类型错误和代码规范问题

# Task Dependencies

- [Task 2] depends on [Task 1] (新 Provider 需要先就绪)
- [Task 3] depends on [Task 1] (类型扩展需要先完成)
- [Task 4] depends on [Task 2] (前端 UI 需要新的后端 API)
- [Task 5] depends on [Task 4] (翻译在功能完成后添加)
