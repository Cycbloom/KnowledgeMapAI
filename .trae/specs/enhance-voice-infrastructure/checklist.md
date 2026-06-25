# Checklist

## 后端 STT 基础设施
- [x] `AIProvider` 接口新增 `transcribeSpeech` 可选方法
- [x] `shared/types/common.ts` 新增 `STTEngine`、`STTResult`、`STTConfig` 类型
- [x] `shared/types/errorCodes.ts` 新增 `STT_PROVIDER_NOT_CONFIGURED` 错误码及 message/httpStatus 映射
- [x] `getAIProviderForTask` 的 task 类型包含 `'stt'`
- [x] `getProviderForTask` 支持 `'stt'` task 路由
- [x] Aliyun provider 实现 `transcribeSpeech` 方法
- [x] `api/schemas/index.ts` 新增 `sttSchema` 校验
- [x] `api/routes/ai/stt.ts` 实现 `POST /ai/stt` 接收音频文件并返回转写文本
- [x] `api/routes/ai/stt.ts` 实现 `GET /ai/stt/health`
- [x] stt 路由在 `api/routes/ai/index.ts` 注册
- [x] STT 路由接入 `performanceMonitor.recordLog`

## 前端 API 层
- [x] `src/services/api/contracts/ISttApi.ts` 定义 transcribe、health 方法签名
- [x] `src/services/api/stt.ts` 实现 `sttApi`（transcribe 使用 FormData 上传）
- [x] `IApi` 接口新增 `stt: ISttApi`
- [x] `api` 对象注册 `stt`
- [x] `ttsApi.voices()` 返回类型为 `TTSVoice[]`
- [x] `mobileApi.stt` 使用 `createNotSupportedModule<ISttApi>("stt")`

## 前端 STT Hook
- [x] `useSpeechRecognition` 支持 `engine: 'browser' | 'cloud'` 参数
- [x] `useSpeechRecognition` 支持 `lang` 参数（默认 `zh-CN`）
- [x] 新增 `transcribeFile(file: File)` 方法
- [x] TypeScript 类型声明使用标准 DOM 类型
- [x] 错误处理完善

## 前端 TTS Hook
- [x] 文本清洗逻辑提取为 `src/utils/textCleaning.ts`
- [x] qwen3 引擎支持暂停/恢复
- [x] 内存缓存实现（相同文本+voice+speed 命中缓存）
- [x] 默认 voice 使用后端返回的第一个 voice（移除硬编码 `Vivian`）
- [x] 移除 `console.error`，改用 `console.warn`
- [x] 暴露 `progress`（0-1，仅 qwen3 引擎）
- [x] `cancel` 与卸载时 revoke object URL 并清理缓存

## UI 与 i18n
- [x] VoiceSettings 移除硬编码标签，接入 i18n
- [x] VoiceSettings qwen3 引擎展示后端 voice 列表
- [x] VoiceSettings 新增 voice 试听按钮
- [x] PodcastModal 移除硬编码中文字符串
- [x] PodcastModal 接入 progress 显示播放进度条
- [x] `zh-CN.json` / `en-US.json` 新增 STT、voice、podcast 相关 key

## 后端 TTS 增强
- [x] `api/routes/ai/tts.ts` synthesize 调用接入 `performanceMonitor.recordLog`

## 验证
- [x] `npm run check` 无类型错误
- [x] `npm run lint` 无 lint 错误（修改文件 0 errors，仅 config.ts 预存 warnings）
