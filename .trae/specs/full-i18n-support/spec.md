# 全面国际化改造 Spec

## Why
当前项目虽然已集成 i18next 框架，但语言文件仅覆盖错误消息和少量通用文本。前端组件中存在大量硬编码的中文文本（标题、按钮、提示等），无法支持多语言切换，影响国际化用户体验。

## What Changes
- 扩展现有语言文件结构，按模块组织翻译键
- 逐个模块/页面替换硬编码文本为 i18n 翻译键
- 确保所有用户可见文本都支持多语言

## Impact
- Affected specs: 无
- Affected code: 
  - `src/i18n/locales/zh-CN.json` - 扩展中文翻译
  - `src/i18n/locales/en-US.json` - 扩展英文翻译
  - 30+ 个前端组件文件 - 替换硬编码文本

## ADDED Requirements

### Requirement: 模块化语言文件结构
系统 SHALL 采用模块化的语言文件结构，按功能模块组织翻译键。

#### Scenario: 语言文件结构
- **WHEN** 查看语言文件
- **THEN** 翻译键按模块组织（如 settings、graphMap、console、auth 等）

### Requirement: 页面标题国际化
所有页面标题 SHALL 支持多语言。

#### Scenario: 设置页面标题
- **WHEN** 用户语言设置为英文
- **AND** 用户访问设置页面
- **THEN** 显示 "System Settings"

### Requirement: 表单标签国际化
所有表单标签（输入框、选择框等）SHALL 支持多语言。

#### Scenario: 登录表单
- **WHEN** 用户语言设置为英文
- **THEN** 邮箱输入框标签显示 "Email"
- **AND** 密码输入框标签显示 "Password"

### Requirement: 按钮文本国际化
所有按钮文本 SHALL 支持多语言。

#### Scenario: 保存按钮
- **WHEN** 用户语言设置为英文
- **THEN** 保存按钮显示 "Save"

### Requirement: 提示消息国际化
所有提示消息（成功、错误、警告等）SHALL 支持多语言。

#### Scenario: 保存成功提示
- **WHEN** 用户语言设置为英文
- **AND** 设置保存成功
- **THEN** 显示 "Settings saved successfully"

## MODIFIED Requirements

### Requirement: 语言文件扩展
扩展现有 `src/i18n/locales/zh-CN.json` 和 `en-US.json`，添加以下模块的翻译：

```json
{
  "errors": { ... },
  "common": { ... },
  "auth": { ... },
  "settings": {
    "title": "系统设置",
    "subtitle": "管理外观、AI 模型与学习算法",
    "saveAll": "保存所有更改",
    "saving": "保存中...",
    "appearance": "外观设置",
    "lightMode": "浅色模式",
    "darkMode": "深色模式",
    "followSystem": "跟随系统",
    "language": "语言",
    "chinese": "中文",
    "english": "English",
    "aiStatus": "AI 状态与配置",
    "modelManagement": "可用模型库管理",
    "modelManagementDesc": "在此添加各服务商支持的模型，以便在下方任务中选择。",
    "provider": "提供方",
    "modelName": "模型名称",
    "addModel": "添加",
    "noModels": "无模型",
    "textTask": "文本生成任务 (对话/卡片/扩充)",
    "embeddingTask": "向量化任务 (搜索/相似度)",
    "reasoningTask": "推理任务 (复杂逻辑/规划)",
    "noProviderModels": "该提供方暂无模型",
    "configMethod": "配置方式",
    "configDesc": "在服务端环境变量中配置 AI_API_KEY 或 DEEPSEEK_API_KEY，然后重启服务端进程。未配置时：文本分析/对话会进入模拟模式，文档解析与智能推荐将不可用。",
    "mobileAIConfig": "移动端 AI 配置",
    "mobileAIConfigDesc": "移动端应用直接调用 AI 服务商 API，需要配置您自己的 API Key。",
    "aiServiceProvider": "AI 服务商",
    "model": "模型",
    "apiKey": "API Key",
    "show": "显示",
    "hide": "隐藏",
    "saveConfig": "保存配置",
    "clear": "清除",
    "configured": "已配置",
    "fsrsConfig": "学习算法配置 (FSRS)",
    "requestRetention": "目标保留率 (Request Retention)",
    "maxReviewInterval": "最大复习间隔 (天)",
    "requestRetentionDesc": "设定您希望在复习时记住的概率。值越高，复习越频繁，记忆越牢固。建议范围：0.80 - 0.95。",
    "maxIntervalDesc": "限制卡片复习的最大间隔天数。默认 36500 天（100年）。",
    "saveSuccess": "系统配置已保存",
    "saveFailed": "保存失败",
    "modelExists": "该模型已存在",
    "modelAdded": "已添加模型",
    "enterApiKey": "请输入 API Key",
    "mobileConfigSaved": "移动端 AI 配置已保存",
    "mobileConfigCleared": "移动端 AI 配置已清除"
  },
  "graphMap": {
    ...
  },
  "console": {
    ...
  },
  "templates": {
    ...
  },
  "learning": {
    ...
  }
}
```

## Technical Design

### 1. 改造优先级
按使用频率和重要性排序：
1. **P0 - 核心页面**：Settings、Login、Layout
2. **P1 - 主要功能**：GraphMap、Console、Templates
3. **P2 - 其他功能**：LearningMode、其他组件

### 2. 改造步骤（每个组件）
1. 在语言文件中添加该组件的翻译键
2. 在组件中引入 `useTranslation`
3. 替换硬编码文本为 `t('module.key')`
4. 验证中英文切换正常

### 3. 翻译键命名规范
- 模块名作为命名空间：`settings.title`
- 动作类：`settings.save`、`settings.delete`
- 状态类：`settings.saving`、`settings.loading`
- 描述类：`settings.description`
- 消息类：`settings.saveSuccess`、`settings.saveFailed`

### 4. 涉及文件清单
**P0 优先级：**
- `src/pages/Settings.tsx`
- `src/pages/Login.tsx`
- `src/components/Layout/Layout.tsx`
- `src/components/Layout/MobileBottomNav.tsx`

**P1 优先级：**
- `src/pages/GraphMap.tsx`
- `src/components/GraphMap/*.tsx` (10+ 文件)
- `src/components/Console/*.tsx` (5+ 文件)
- `src/pages/Templates.tsx`
- `src/components/Templates/*.tsx` (5+ 文件)

**P2 优先级：**
- `src/pages/LearningMode.tsx`
- 其他组件
