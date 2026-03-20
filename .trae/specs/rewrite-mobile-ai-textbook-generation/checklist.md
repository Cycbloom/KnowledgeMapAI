# Checklist

- [x] MobileAIClient 构造函数正确验证参数并抛出明确错误
- [x] MobileAIClient.chatWithJson 方法能正确解析 JSON 响应
- [x] MobileAIClient 包含超时和重试机制
- [x] mobileAIService.isConfigured 方法正确检测配置状态
- [x] mobileAIService.generateLearningMaterial 方法能成功生成教材
- [x] mobileAIService.generateLearningMaterial 返回正确的内容和关键词结构
- [x] AI 服务未配置时显示明确的中文错误信息
- [x] AI 请求失败时显示包含原始错误信息的中文提示
- [x] mobileAiApi.generateLearningMaterial 正确处理移动端和云端 API 切换
- [x] 类型检查通过 (npm run check)
- [x] 代码检查通过 (npm run lint)
