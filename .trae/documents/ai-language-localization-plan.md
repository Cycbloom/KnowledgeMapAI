# AI 生成内容语言本地化改造计划

## 需求分析

用户希望 AI 生成的内容（教材、对话、文本等）能够根据用户选择的语言（中文/英文）返回对应语言的内容。

## 当前问题

1. **硬编码语言**：`OUTPUT_SCHEMAS` 和 `DEFAULT_PROMPTS` 中硬编码了 `"Please respond in Chinese"` 或 `"Respond in Chinese"`
2. **缺少语言参数传递**：前端到后端没有传递用户选择的语言参数
3. **缺少 UI 控件**：用户无法选择 AI 返回内容的语言

## 实施方案

### 第一阶段：后端改造

#### 1. 修改 `api/services/ai/promptService.ts`

**修改 OUTPUT_SCHEMAS**：
- 将所有硬编码的 `"Please respond in Chinese"` 改为使用模板变量 `{{languageInstruction}}`
- 创建语言指令映射表

```typescript
const LANGUAGE_INSTRUCTIONS: Record<string, string> = {
  'zh-CN': 'Please respond in Chinese.',
  'en-US': 'Please respond in English.',
  'zh': 'Please respond in Chinese.',
  'en': 'Please respond in English.',
};

function getLanguageInstruction(language?: string): string {
  if (!language) return LANGUAGE_INSTRUCTIONS['zh-CN'];
  return LANGUAGE_INSTRUCTIONS[language] || LANGUAGE_INSTRUCTIONS['zh-CN'];
}
```

**修改 `getRenderedPrompt` 方法**：
- 添加 `language` 参数
- 在渲染 prompt 后自动追加语言指令

#### 2. 修改 `api/services/ai/aiService.ts`

为各个 AI 方法添加 `language` 参数：
- `generateLearningMaterial`
- `generateCards`
- `expandKnowledge`
- `getBranchSuggestions`
- `generatePodcastScript`
- `tutorChat`
- `extractConcepts`
- `analyzeCrossGraphConnections`
- `generateTaskDetails`

### 第二阶段：API 路由改造

#### 3. 修改相关 API 路由

需要修改的文件：
- `api/routes/ai/content.ts`
- `api/routes/ai/chat.ts`
- `api/routes/ai/document.ts`
- `api/routes/autoGraph.ts`
- `api/routes/learningPaths.ts`
- `api/routes/learningPath.ts`

修改内容：
- 接收前端传递的 `language` 参数
- 将语言参数传递给 aiService

### 第三阶段：前端改造

#### 4. 修改前端 API 调用

需要修改的文件：
- `src/services/api/ai.ts`
- `src/services/mobile/ai.ts`
- `src/services/mobile/aiService.ts`

修改内容：
- 添加 `language` 参数
- 从 i18n 获取当前语言设置

#### 5. 添加语言选择 UI（可选）

在 `LearningSettingsPanel.tsx` 或设置页面添加：
- AI 输出语言选择器（中文/英文/跟随界面语言）

### 第四阶段：数据库 Prompt 模板更新

#### 6. 更新数据库中的 Prompt 模板

修改 `supabase/migrations/53_seed_prompt_templates.sql`：
- 将硬编码的语言指令改为动态变量

## 详细实施步骤

### 步骤 1: 修改 promptService.ts

文件：`api/services/ai/promptService.ts`

1. 添加语言指令映射
2. 修改 OUTPUT_SCHEMAS 中的语言指令
3. 修改 `getRenderedPrompt` 方法签名和实现

### 步骤 2: 修改 aiService.ts

文件：`api/services/ai/aiService.ts`

1. 为每个 AI 方法添加 `language` 可选参数
2. 将语言参数传递给 `promptService.getRenderedPrompt`

### 步骤 3: 修改 API 路由

文件：多个 API 路由文件

1. 从请求体中提取 `language` 参数
2. 传递给 aiService 方法

### 步骤 4: 修改前端 API 服务

文件：`src/services/api/ai.ts`

1. 为 API 调用添加 `language` 参数
2. 默认从 i18n 获取当前语言

### 步骤 5: 添加 UI 控件（可选）

文件：`src/components/Learning/LearningSettingsPanel.tsx`

1. 在设置面板中添加 AI 语言选择器
2. 保存用户偏好设置

## 文件修改清单

| 文件路径 | 修改类型 | 说明 |
|---------|---------|------|
| `api/services/ai/promptService.ts` | 修改 | 添加语言参数支持 |
| `api/services/ai/aiService.ts` | 修改 | 各方法添加语言参数 |
| `api/routes/ai/content.ts` | 修改 | 接收并传递语言参数 |
| `api/routes/ai/chat.ts` | 修改 | 接收并传递语言参数 |
| `api/routes/ai/document.ts` | 修改 | 接收并传递语言参数 |
| `api/routes/autoGraph.ts` | 修改 | 接收并传递语言参数 |
| `src/services/api/ai.ts` | 修改 | 前端 API 添加语言参数 |
| `src/services/mobile/aiService.ts` | 修改 | 移动端 AI 服务添加语言参数 |
| `src/components/Learning/LearningSettingsPanel.tsx` | 修改 | 添加语言选择 UI |

## 测试计划

1. **单元测试**：测试 `getLanguageInstruction` 函数
2. **集成测试**：测试 API 路由正确传递语言参数
3. **E2E 测试**：测试用户切换语言后 AI 返回正确语言的内容

## 风险评估

1. **向后兼容**：`language` 参数设为可选，默认中文，不影响现有功能
2. **性能影响**：无显著性能影响
3. **数据库迁移**：可能需要更新已有的 prompt 模板

## 预估工作量

- 后端改造：约 2-3 小时
- 前端改造：约 1-2 小时
- 测试验证：约 1 小时
- 总计：约 4-6 小时
