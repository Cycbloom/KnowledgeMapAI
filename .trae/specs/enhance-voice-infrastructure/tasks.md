# Tasks

## 后端 STT 基础设施
- [x] Task 1: 扩展 AIProvider 接口与类型定义
  - [x] SubTask 1.1: 在 `shared/types/ai.ts` 的 `AIProvider` 接口新增可选 `transcribeSpeech` 方法
  - [x] SubTask 1.2: 在 `shared/types/common.ts` 新增 `STTEngine`、`STTResult`、`STTConfig` 类型
  - [x] SubTask 1.3: 在 `shared/types/errorCodes.ts` 新增 `STT_PROVIDER_NOT_CONFIGURED` 错误码（含 message、httpStatus 映射）
  - [x] SubTask 1.4: 在 `api/services/ai/factory.ts` 的 `getAIProviderForTask` task 类型新增 `'stt'`
  - [x] SubTask 1.5: 在 `api/services/ai/config.ts` 的 `getProviderForTask` 支持 `'stt'` task 路由
- [x] Task 2: 实现 Aliyun provider STT
  - [x] SubTask 2.1: 在 `api/services/ai/providers/aliyun.ts` 实现 `transcribeSpeech` 方法（基于 DashScope paraformer-v2）
  - [x] SubTask 2.2: 处理音频格式转换与错误恢复
- [x] Task 3: 新增 STT 路由与 schema
  - [x] SubTask 3.1: 在 `api/schemas/index.ts` 新增 `sttSchema`（校验 language）
  - [x] SubTask 3.2: 创建 `api/routes/ai/stt.ts`，实现 `POST /ai/stt`（multer 接收音频文件，调用 provider.transcribeSpeech）
  - [x] SubTask 3.3: 实现 `GET /ai/stt/health` 健康检查
  - [x] SubTask 3.4: 在 `api/routes/ai/index.ts` 注册 stt 路由
  - [x] SubTask 3.5: 接入 `performanceMonitor.recordLog` 记录 STT 调用

## 前端 API 层
- [x] Task 4: 新增 STT API 服务与契约
  - [x] SubTask 4.1: 创建 `src/services/api/contracts/ISttApi.ts`（transcribe、health 方法签名）
  - [x] SubTask 4.2: 创建 `src/services/api/stt.ts` 实现 `sttApi`（transcribe 上传 FormData）
  - [x] SubTask 4.3: 在 `src/services/api/contracts/IApi.ts` 新增 `stt: ISttApi`
  - [x] SubTask 4.4: 在 `src/services/api/index.ts` 注册 `sttApi`/`stt`
  - [x] SubTask 4.5: 修复 `ttsApi.voices()` 返回类型为 `TTSVoice[]`，对齐后端
- [x] Task 5: 移动端 stub
  - [x] SubTask 5.1: 在 `src/services/mobile/index.ts` 新增 `stt: createNotSupportedModule<ISttApi>("stt")`

## 前端 Hook 增强
- [x] Task 6: 增强 `useSpeechRecognition` hook
  - [x] SubTask 6.1: 新增 `engine: 'browser' | 'cloud'` 参数（默认 `'browser'`）
  - [x] SubTask 6.2: 新增 `lang` 参数（默认 `'zh-CN'`），替换硬编码
  - [x] SubTask 6.3: 新增 `transcribeFile(file: File)` 方法，调用 `api.stt.transcribe`
  - [x] SubTask 6.4: 优化 TypeScript 类型声明，使用标准 DOM `SpeechRecognition` 类型
  - [x] SubTask 6.5: 完善 error 处理与状态返回
- [x] Task 7: 增强 `useTextToSpeech` hook
  - [x] SubTask 7.1: 提取文本清洗逻辑为 `src/utils/textCleaning.ts` 共享工具
  - [x] SubTask 7.2: qwen3 引擎实现暂停/恢复（基于 Audio 元素 currentTime 暂存）
  - [x] SubTask 7.3: 新增内存缓存（Map<hash, audioUrl>），命中缓存直接播放
  - [x] SubTask 7.4: 修复默认 voice（使用后端返回的第一个 voice，移除硬编码 `Vivian`）
  - [x] SubTask 7.5: 移除 `console.error`，改用 `console.warn`
  - [x] SubTask 7.6: 暴露 `progress`（当前播放进度 0-1，仅 qwen3 引擎）
  - [x] SubTask 7.7: 确保 `cancel` 与组件卸载时 revoke object URL，清理缓存

## UI 与 i18n
- [x] Task 8: 完善 VoiceSettings 组件
  - [x] SubTask 8.1: 移除硬编码 "Browser"/"Qwen3-TTS" 标签，接入 i18n
  - [x] SubTask 8.2: qwen3 引擎时展示后端返回的 voice 列表（而非空）
  - [x] SubTask 8.3: 新增 voice 试听按钮（点击用当前 voice 朗读示例文本）
- [x] Task 9: 完善 PodcastModal 组件
  - [x] SubTask 9.1: 移除硬编码中文字符串，接入 i18n
  - [x] SubTask 9.2: 接入 `progress` 显示播放进度条
- [x] Task 10: 补全 i18n key
  - [x] SubTask 10.1: 在 `zh-CN.json` / `en-US.json` 新增 STT、voice、podcast 相关 key

## 后端 TTS 增强
- [x] Task 11: TTS 路由接入性能监控
  - [x] SubTask 11.1: 在 `api/routes/ai/tts.ts` 的 synthesize 调用前后记录 `performanceMonitor.recordLog`（provider/model/duration/success）

## 验证
- [x] Task 12: 类型检查与 lint
  - [x] SubTask 12.1: 运行 `npm run check` 确保无类型错误
  - [x] SubTask 12.2: 运行 `npm run lint` 确保无 lint 错误（修改文件 0 errors）

# Task Dependencies
- [Task 2] depends on [Task 1]
- [Task 3] depends on [Task 1, Task 2]
- [Task 4] depends on [Task 1]（需要 ISttApi 类型）
- [Task 5] depends on [Task 4]
- [Task 6] depends on [Task 4]（需要 sttApi）
- [Task 7] 无强依赖，可与 Task 6 并行
- [Task 8] depends on [Task 7]（需要 progress、voice 列表）
- [Task 9] depends on [Task 7]
- [Task 10] depends on [Task 8, Task 9]
- [Task 11] 无依赖，可并行
- [Task 12] depends on [所有任务]
