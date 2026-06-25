# STT/TTS 服务测试界面实现计划

## 概述

在设置页面添加"语音服务测试"区块，让用户在配置 STT/TTS 服务时能快速测试服务是否正常工作。

## 当前状态分析

### 已有基础设施

**后端端点**（均已实现）：
- `GET /ai/tts/health` - TTS 健康检查（检查 provider.hasKey）
- `GET /ai/tts/voices` - 返回 5 个语音列表
- `POST /ai/tts` - 语音合成（返回音频 Blob）
- `GET /ai/stt/health` - STT 健康检查
- `POST /ai/stt` - 语音转文字（multer 上传）

**前端 API 客户端**（均已实现）：
- `src/services/api/tts.ts` - `ttsApi.health()`, `ttsApi.voices()`, `ttsApi.synthesize()`
- `src/services/api/stt.ts` - `sttApi.health()`, `sttApi.transcribe()`

**前端 Hooks**（均已实现）：
- `src/hooks/common/useTextToSpeech.ts` - 双引擎 TTS hook
- `src/hooks/common/useSpeechRecognition.ts` - 双引擎 STT hook

**设置页面**：`src/pages/Settings.tsx`（2812 行）
- 采用纵向堆叠的卡片式 sections
- 已有"测试连接"按钮模式（如 `handleTestProviderConnection`、`handleTestMainAi`）
- **缺少 TTS/STT 配置和测试区块**

**i18n**：`src/i18n/locales/zh-CN.json` 和 `en-US.json`
- **缺少 TTS/STT 相关翻译键**

### 需要添加的内容

1. **设置页面**：新增"语音服务测试"卡片
2. **i18n**：添加 TTS/STT 相关翻译键

## 实施方案

### 1. 在 `src/pages/Settings.tsx` 添加"语音服务测试"区块

**位置**：在"AI 状态与配置"区块（第 1667-2022 行）之后、"数据库配置"区块（第 2024 行）之前插入。

**区块功能**：

#### TTS 测试区
- 健康状态指示器（调用 `api.tts.health()`）
- 语音选择下拉框（调用 `api.tts.voices()` 获取列表）
- 测试文本输入框（默认："你好，这是一个语音合成测试。"）
- "合成并播放"按钮（调用 `api.tts.synthesize()` → 创建 Audio 播放）
- 测试结果显示

#### STT 测试区
- 健康状态指示器（调用 `api.stt.health()`）
- 音频文件上传（支持拖拽和点击选择）
- "开始转写"按钮（调用 `api.stt.transcribe()`）
- 转写结果显示（显示识别文本）

#### 新增 State 变量
```typescript
// TTS 测试
const [ttsHealth, setTtsHealth] = useState<'idle' | 'checking' | 'healthy' | 'unhealthy'>('idle');
const [ttsVoices, setTtsVoices] = useState<TTSVoice[]>([]);
const [ttsTestText, setTtsTestText] = useState("你好，这是一个语音合成测试。");
const [ttsTestVoice, setTtsTestVoice] = useState("Cherry");
const [ttsTesting, setTtsTesting] = useState(false);
const [ttsTestResult, setTtsTestResult] = useState<{success: boolean; message: string} | null>(null);

// STT 测试
const [sttHealth, setSttHealth] = useState<'idle' | 'checking' | 'healthy' | 'unhealthy'>('idle');
const [sttTestFile, setSttTestFile] = useState<File | null>(null);
const [sttTesting, setSttTesting] = useState(false);
const [sttTestResult, setSttTestResult] = useState<{success: boolean; text?: string; message: string} | null>(null);
```

#### 新增处理函数
```typescript
// 检查 TTS 健康状态
const checkTtsHealth = async () => {
  setTtsHealth('checking');
  try {
    const result = await api.tts.health() as { status: string; model_loaded: boolean };
    setTtsHealth(result.status === 'healthy' ? 'healthy' : 'unhealthy');
    if (result.status === 'healthy') {
      // 加载语音列表
      const voices = await api.tts.voices();
      setTtsVoices(voices);
    }
  } catch {
    setTtsHealth('unhealthy');
  }
};

// 测试 TTS 合成
const handleTestTts = async () => {
  setTtsTesting(true);
  setTtsTestResult(null);
  try {
    const blob = await api.tts.synthesize({
      text: ttsTestText,
      voice: ttsTestVoice,
      speed: 1.0,
      output_format: 'mp3',
    });
    const audio = new Audio(URL.createObjectURL(blob));
    await audio.play();
    setTtsTestResult({ success: true, message: t("settings.ttsTestSuccess") });
  } catch (error: unknown) {
    const err = error as Error;
    setTtsTestResult({ success: false, message: err.message || t("settings.ttsTestFailed") });
  } finally {
    setTtsTesting(false);
  }
};

// 检查 STT 健康状态
const checkSttHealth = async () => {
  setSttHealth('checking');
  try {
    const result = await api.stt.health() as { status: string; model_loaded: boolean };
    setSttHealth(result.status === 'healthy' ? 'healthy' : 'unhealthy');
  } catch {
    setSttHealth('unhealthy');
  }
};

// 测试 STT 转写
const handleTestStt = async () => {
  if (!sttTestFile) return;
  setSttTesting(true);
  setSttTestResult(null);
  try {
    const result = await api.stt.transcribe(sttTestFile, { language: 'zh' });
    setSttTestResult({ success: true, text: result.text, message: t("settings.sttTestSuccess") });
  } catch (error: unknown) {
    const err = error as Error;
    setSttTestResult({ success: false, message: err.message || t("settings.sttTestFailed") });
  } finally {
    setSttTesting(false);
  }
};
```

#### UI 组件结构
```tsx
{/* 语音服务测试 */}
<div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-gray-100 dark:border-slate-700 p-4 md:p-6 transition-colors">
  <div className="flex items-center gap-2 mb-4">
    <Volume2 className="w-5 h-5 text-purple-600 dark:text-purple-400" />
    <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100">
      {t("settings.voiceServiceTest")}
    </h2>
  </div>

  <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">
    {t("settings.voiceServiceTestDesc")}
  </p>

  {/* TTS 测试区 */}
  <div className="mb-6 p-4 rounded-lg bg-gray-50 dark:bg-slate-900/50 border border-gray-100 dark:border-slate-700">
    {/* 健康状态 + 刷新按钮 */}
    {/* 语音选择 + 测试文本 + 合成按钮 */}
    {/* 测试结果显示 */}
  </div>

  {/* STT 测试区 */}
  <div className="p-4 rounded-lg bg-gray-50 dark:bg-slate-900/50 border border-gray-100 dark:border-slate-700">
    {/* 健康状态 + 刷新按钮 */}
    {/* 文件上传 + 转写按钮 */}
    {/* 转写结果显示 */}
  </div>
</div>
```

### 2. 添加 i18n 翻译键

**文件**：`src/i18n/locales/zh-CN.json` 和 `src/i18n/locales/en-US.json`

在 `settings` 对象中添加以下键：

```json
{
  "settings": {
    "voiceServiceTest": "语音服务测试",
    "voiceServiceTestDesc": "测试 TTS（文字转语音）和 STT（语音转文字）服务是否正常工作。服务使用阿里云 DashScope 配置。",
    "ttsTest": "TTS 语音合成测试",
    "sttTest": "STT 语音识别测试",
    "checkHealth": "检查状态",
    "ttsHealthy": "服务正常",
    "ttsUnhealthy": "服务未就绪",
    "sttHealthy": "服务正常",
    "sttUnhealthy": "服务未就绪",
    "selectVoice": "选择语音",
    "ttsTestText": "测试文本",
    "ttsTestTextPlaceholder": "输入要合成的文本",
    "synthesize": "合成并播放",
    "synthesizing": "合成中...",
    "ttsTestSuccess": "语音合成成功，正在播放",
    "ttsTestFailed": "语音合成失败",
    "selectAudioFile": "选择音频文件",
    "supportedFormats": "支持 MP3, WAV, WebM, M4A, OGG 格式",
    "transcribe": "开始转写",
    "transcribing": "转写中...",
    "sttTestSuccess": "语音识别成功",
    "sttTestFailed": "语音识别失败",
    "transcriptionResult": "识别结果",
    "noFileSelected": "请选择音频文件",
    "voiceServiceHint": "语音服务通过阿里云 DashScope API 提供，请在 AI 服务密钥配置中确保阿里云已配置。"
  }
}
```

### 3. 添加必要的 import

在 `Settings.tsx` 顶部添加：
- `api` 对象导入（用于调用 `api.tts` 和 `api.stt`）
- `Mic` 图标从 lucide-react 导入（用于 STT 区块标识）
- `TTSVoice` 类型导入（用于类型注解）

## 关键设计决策

1. **不创建新文件**：所有逻辑添加到现有 `Settings.tsx` 中，遵循项目现有的"单文件大型组件"模式
2. **复用现有 API**：直接调用 `api.tts` 和 `api.stt`，不新增后端端点
3. **不使用现有 hooks**：`useTextToSpeech` 和 `useSpeechRecognition` 有复杂的状态管理（缓存、引擎切换等），测试场景只需简单的直接调用
4. **位置选择**：放在"AI 状态"和"数据库配置"之间，因为语音服务依赖 AI 配置（阿里云 API Key）
5. **UI 风格一致**：使用与其他区块相同的卡片样式、按钮风格、状态徽章样式

## 验证步骤

1. `npm run check` - 类型检查
2. `npm run lint` - 代码检查
3. 手动测试：
   - 启动开发服务器
   - 打开设置页面
   - 检查"语音服务测试"区块是否显示
   - 点击"检查状态"按钮，验证健康检查
   - TTS：输入文本 → 选择语音 → 点击"合成并播放" → 听到音频
   - STT：上传音频文件 → 点击"开始转写" → 看到识别文本
