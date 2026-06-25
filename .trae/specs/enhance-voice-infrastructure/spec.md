# 语音基础设施完善（TTS & STT）Spec

## Why

当前项目的文字转语音（TTS）和语音转文字（STT）基础设施存在多处缺陷：
- **STT 后端完全缺失**：仅依赖浏览器 Web Speech API，`AIProvider` 接口无 `transcribeSpeech` 方法，无法支持音频文件转写、移动端、多语言等场景。
- **TTS 体验不完整**：qwen3 引擎不支持暂停/恢复、无音频缓存、无流式播放、文本清洗逻辑重复、voice 列表前后端不一致（前端默认 `Vivian`，后端返回 `Cherry/Harry/...`）。
- **移动端空白**：TTS/STT 在 mobile 层均为 `createNotSupportedModule`。
- **规范违规**：前端使用 `console.error`（项目规则禁止）、多处硬编码中文字符串未走 i18n。
- **无性能监控**：TTS/STT 调用未接入 `performanceMonitor`，无法追踪 token/成本/时长。

完善后可显著提升朗读、播客、语音输入的稳定性与可用性，并为移动端、音频文件转写、多语言场景打下基础。

## What Changes

### 后端 STT 基础设施（新增）
- 在 `AIProvider` 接口新增可选 `transcribeSpeech` 方法
- 在 Aliyun provider 实现 STT（基于 DashScope paraformer / sensevoice）
- 新增 `api/routes/ai/stt.ts` 路由：`POST /ai/stt`（音频转文字）、`GET /ai/stt/health`
- 新增 `sttSchema` 校验 schema
- 新增 `STT_PROVIDER_NOT_CONFIGURED` 等错误码
- 在 `getAIProviderForTask` 的 task 类型新增 `'stt'`

### 前端 STT Hook 增强
- `useSpeechRecognition` 新增 `engine` 参数（`'browser' | 'cloud'`），与 TTS 对齐
- 新增 `lang` 可配置参数（不再硬编码 `zh-CN`）
- 新增 `transcribeFile(file: File)` 方法，调用后端 STT
- 优化错误处理与类型声明（使用标准 DOM 类型）

### TTS Hook 增强
- 提取文本清洗逻辑为共享工具函数（消除 browser/qwen3 重复）
- qwen3 引擎支持暂停/恢复（基于 Audio 元素 currentTime）
- 新增音频缓存（基于文本 hash 的内存缓存，避免重复合成）
- 修复 voice 默认值不一致（统一使用后端返回的 voice 列表）
- 移除 `console.error`，改用 `console.warn`（符合前端日志规范）

### API 层完善
- 新增 `src/services/api/stt.ts` 实现 `sttApi`
- 新增 `src/services/api/contracts/ISttApi.ts` 契约
- `ttsApi` 的 voice 列表返回类型对齐 `TTSVoice[]`
- 在 `api/index.ts` 与 `mobileApi` 注册 `stt`

### 性能监控接入
- TTS/STT 路由调用 `performanceMonitor.recordLog` 记录 provider/model/tokens/duration

### i18n 补全
- 移除 VoiceSettings、PodcastModal 中的硬编码字符串，接入 i18n
- 新增 STT 相关 i18n key

### 移动端 stub
- `mobileApi.stt` 使用 `createNotSupportedModule<ISttApi>("stt")`（保持架构一致性，后续可接入原生模块）

## Impact

- **Affected specs**: 无直接冲突；与 `api-contract-layer`、`api-contract-type-completion` 方向一致（扩展契约层）
- **Affected code**:
  - `shared/types/ai.ts`（AIProvider 接口）
  - `shared/types/common.ts`（新增 STT 相关类型）
  - `shared/types/errorCodes.ts`（新增错误码）
  - `api/routes/ai/tts.ts`、`api/routes/ai/stt.ts`（新增）
  - `api/services/ai/providers/aliyun.ts`、`api/services/ai/providers/base.ts`
  - `api/services/ai/factory.ts`、`api/services/ai/config.ts`
  - `api/schemas/index.ts`
  - `src/hooks/common/useTextToSpeech.ts`、`src/hooks/common/useSpeechRecognition.ts`
  - `src/services/api/tts.ts`、`src/services/api/stt.ts`（新增）
  - `src/services/api/contracts/ITtsApi.ts`、`src/services/api/contracts/ISttApi.ts`（新增）
  - `src/services/api/contracts/IApi.ts`、`src/services/api/index.ts`
  - `src/services/mobile/index.ts`
  - `src/components/RAGChat/VoiceSettings.tsx`、`src/components/GraphEditor/modals/PodcastModal.tsx`
  - `src/i18n/locales/zh-CN.json`、`src/i18n/locales/en-US.json`

## ADDED Requirements

### Requirement: 后端 STT 服务
系统 SHALL 提供后端语音转文字能力，通过 `POST /ai/stt` 接收音频文件并返回转写文本。

#### Scenario: 成功转写音频文件
- **WHEN** 用户上传音频文件（mp3/wav/webm/m4a，≤25MB）调用 `POST /ai/stt`
- **THEN** 返回 `{ text: string, language?: string, duration?: number }`

#### Scenario: Provider 未配置
- **WHEN** STT provider 未配置 API Key
- **THEN** 返回 503 `STT_PROVIDER_NOT_CONFIGURED`

#### Scenario: 音频格式不支持
- **WHEN** 上传非音频文件或格式不在白名单
- **THEN** 返回 400 校验错误

### Requirement: STT 健康检查
系统 SHALL 提供 `GET /ai/stt/health` 端点，返回 provider 配置状态。

### Requirement: 前端 STT 云端引擎
`useSpeechRecognition` hook SHALL 支持 `engine: 'browser' | 'cloud'` 参数，云端引擎调用后端 STT。

#### Scenario: 浏览器引擎实时识别
- **WHEN** `engine='browser'` 调用 `startListening`
- **THEN** 使用 Web Speech API 实时识别（保持现有行为）

#### Scenario: 云端引擎文件转写
- **WHEN** `engine='cloud'` 调用 `transcribeFile(file)`
- **THEN** 上传文件至后端 `/ai/stt` 返回文本

### Requirement: STT 语言可配置
`useSpeechRecognition` SHALL 支持 `lang` 参数，默认 `zh-CN`，不再硬编码。

### Requirement: TTS 音频缓存
`useTextToSpeech` hook SHALL 对 qwen3 引擎合成结果进行内存缓存，相同文本+voice+speed 命中缓存时直接播放。

#### Scenario: 缓存命中
- **WHEN** 对相同文本再次调用 `speak`
- **THEN** 直接使用缓存的 audioUrl 播放，不发起网络请求

#### Scenario: 缓存失效
- **WHEN** 调用 `cancel` 或组件卸载
- **THEN** 释放对应 object URL

### Requirement: TTS qwen3 引擎暂停/恢复
qwen3 引擎 SHALL 支持暂停与恢复（基于 HTMLAudioElement）。

#### Scenario: 暂停后恢复
- **WHEN** 播放中调用 `pause` 后调用 `resume`
- **THEN** 从暂停位置继续播放

### Requirement: TTS 文本清洗工具共享
系统 SHALL 提取文本清洗逻辑为独立工具函数，供 browser 与 qwen3 引擎共用。

### Requirement: TTS voice 列表一致性
前端 `ttsApi.voices()` 返回类型 SHALL 为 `TTSVoice[]`，默认 voice 与后端一致。

### Requirement: TTS/STT 性能监控
TTS 与 STT 后端路由 SHALL 调用 `performanceMonitor.recordLog` 记录 provider/model/duration/success。

### Requirement: i18n 完整覆盖
VoiceSettings、PodcastModal、STT 相关 UI 文案 SHALL 走 i18n，无硬编码中文字符串。

### Requirement: 移动端 STT 契约占位
`mobileApi.stt` SHALL 使用 `createNotSupportedModule<ISttApi>("stt")` 保持架构一致。

## MODIFIED Requirements

### Requirement: AIProvider 接口
`AIProvider` 接口新增可选 `transcribeSpeech` 方法：

```typescript
transcribeSpeech?: (
  audioBuffer: Buffer,
  options?: { language?: string; format?: string },
) => Promise<{ text: string; language?: string; duration?: number }>;
```

### Requirement: getAIProviderForTask
`task` 参数类型新增 `'stt'`：`'text' | 'embedding' | 'reasoning' | 'tts' | 'stt'`。

### Requirement: useTextToSpeech
- 移除 `console.error`，改用 `console.warn`
- qwen3 默认 voice 改为后端返回的第一个 voice（而非硬编码 `Vivian`）
- 暴露 `progress`（当前播放进度，仅 qwen3 引擎）

### Requirement: useSpeechRecognition
- 新增 `engine`、`lang` 参数
- 新增 `transcribeFile` 方法
- 优化 TypeScript 类型声明

## REMOVED Requirements

无移除项。
