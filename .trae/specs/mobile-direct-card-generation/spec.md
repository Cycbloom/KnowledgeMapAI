# 移动端直接生成题目功能 Spec

## Why

移动端（Capacitor 应用）目前无法直接生成题目，需要依赖云端服务器。用户希望在移动端的闯关学习模式中，点击生成题目后，手机能够直接与 Deepseek AI 服务商通信生成题目，然后将生成的题目写回数据库，实现离线可用和更快的响应速度。

**重要**：移动端生成题目时使用的 Prompt 必须和桌面端保持一致，从数据库 `prompt_templates` 表获取，支持用户自定义配置。

## What Changes

- **移动端直接 AI 通信**：移动端直接调用 Deepseek API 生成题目，无需经过云端服务器中转
- **Prompt 数据库同步**：移动端从 Supabase 数据库获取用户配置的 Prompt 模板，与桌面端保持一致
- **增强配置检测和用户引导**：当移动端 AI 未配置时，引导用户前往设置页面配置 API Key
- **实时进度反馈**：显示题目生成进度（"正在生成第 X/Y 题"）
- **直接写入数据库**：生成的题目直接通过 Supabase 客户端写入 `study_cards` 表

## Impact

- Affected code:
  - `src/services/mobile/aiService.ts` - 移动端 AI 服务（需要添加 Prompt 获取逻辑）
  - `src/services/mobile/ai.ts` - 移动端 AI API
  - `src/pages/LearningMode.tsx` - 闯关学习页面
  - `src/components/Learning/GenerateCardsModal.tsx` - 题目生成配置弹窗

- Affected database tables:
  - `prompt_templates` - 存储 Prompt 模板（已存在）
  - `study_cards` - 存储生成的题目

## ADDED Requirements

### Requirement: 移动端直接 AI 通信

系统 SHALL 在移动端环境下，直接与 Deepseek AI 服务商通信生成题目，无需经过云端服务器中转。

#### Scenario: 移动端已配置 AI 服务
- **GIVEN** 用户使用移动端应用
- **AND** 用户已在设置中配置了 Deepseek API Key
- **WHEN** 用户在闯关学习模式点击"生成题目"
- **THEN** 系统直接调用 Deepseek API 生成题目
- **AND** 生成的题目直接写入 Supabase 数据库
- **AND** 用户收到题目生成成功的提示

#### Scenario: 移动端未配置 AI 服务
- **GIVEN** 用户使用移动端应用
- **AND** 用户未配置 Deepseek API Key
- **WHEN** 用户在闯关学习模式点击"生成题目"
- **THEN** 系统显示配置引导弹窗
- **AND** 提示用户前往设置页面配置 API Key
- **AND** 提供"前往设置"按钮

### Requirement: Prompt 数据库同步

系统 SHALL 在移动端生成题目时，从数据库获取与桌面端相同的 Prompt 模板。

#### Scenario: 获取用户自定义 Prompt
- **GIVEN** 用户在桌面端或移动端配置了自定义 Prompt
- **WHEN** 移动端生成题目
- **THEN** 系统从 `prompt_templates` 表获取用户配置的 Prompt
- **AND** 使用获取的 Prompt 模板生成题目
- **AND** Prompt 优先级遵循：图谱级 > 用户级 > 系统默认

#### Scenario: 使用默认 Prompt
- **GIVEN** 用户未配置自定义 Prompt
- **WHEN** 移动端生成题目
- **THEN** 系统使用内置的默认 Prompt
- **AND** 默认 Prompt 与后端 `promptService` 中的 `DEFAULT_PROMPTS` 保持一致

#### Scenario: Prompt 模板变量渲染
- **GIVEN** Prompt 模板包含变量（如 `{{topic}}`、`{{context}}`）
- **WHEN** 移动端生成题目
- **THEN** 系统正确渲染模板变量
- **AND** 支持条件渲染（如 `{{#if level}}...{{/if}}`）

### Requirement: 题目生成进度反馈

系统 SHALL 在移动端题目生成过程中提供实时进度反馈。

#### Scenario: 题目生成中
- **WHEN** 移动端正在生成题目
- **THEN** 显示生成进度指示器
- **AND** 显示当前正在生成的题目序号（如 "正在生成第 3/10 题"）
- **AND** 用户可以取消生成操作

#### Scenario: 题目生成完成
- **WHEN** 所有题目生成完成并写入数据库
- **THEN** 显示成功提示，包含生成的题目数量
- **AND** 自动关闭生成配置弹窗
- **AND** 刷新题库状态

### Requirement: 题目生成错误处理

系统 SHALL 在题目生成失败时提供清晰的错误信息和恢复建议。

#### Scenario: AI 服务调用失败
- **WHEN** 调用 Deepseek API 失败（网络错误、API Key 无效等）
- **THEN** 显示具体的错误信息
- **AND** 提供"重试"按钮
- **AND** 如果是 API Key 问题，提供"前往设置"按钮

#### Scenario: 数据库写入失败
- **WHEN** 题目生成成功但写入数据库失败
- **THEN** 显示警告信息
- **AND** 提供重试写入选项
- **AND** 保留生成的题目数据供用户复制保存

## MODIFIED Requirements

### Requirement: mobileAIService.generateCards

方法 SHALL 支持从数据库获取 Prompt 模板。

- 新增 `userId` 和 `graphId` 参数
- 调用 Supabase 查询 `prompt_templates` 表
- 实现 Prompt 优先级逻辑（graph > user > system）
- 支持模板变量渲染

### Requirement: GenerateCardsModal 组件

组件 SHALL 根据运行环境显示不同的提示信息。

- 移动端显示"题目将在本地生成并同步到云端"
- 桌面端/Web 端显示"任务将转入后台处理"

### Requirement: LearningMode 页面

页面 SHALL 在移动端使用移动端专用的题目生成流程。

- 检测是否为移动端环境
- 移动端调用 `mobileAiApi.batchGenerateCards`
- 处理配置缺失的情况
- 显示实时生成进度

## Technical Details

### Prompt 获取逻辑

```typescript
// 移动端需要实现类似后端 promptService 的逻辑
async function getPromptTemplate(
  supabase: SupabaseClient,
  code: string,
  userId?: string,
  graphId?: string
): Promise<string> {
  // 1. 尝试获取图谱级 Prompt
  if (graphId) {
    const { data } = await supabase
      .from('prompt_templates')
      .select('template_content')
      .eq('code', code)
      .eq('scope', 'graph')
      .eq('graph_id', graphId)
      .single();
    if (data) return data.template_content;
  }
  
  // 2. 尝试获取用户级 Prompt
  if (userId) {
    const { data } = await supabase
      .from('prompt_templates')
      .select('template_content')
      .eq('code', code)
      .eq('scope', 'user')
      .eq('user_id', userId)
      .single();
    if (data) return data.template_content;
  }
  
  // 3. 返回默认 Prompt
  return DEFAULT_PROMPTS[code];
}
```

### Prompt 模板 Code 映射

| 题目类型 | Prompt Code |
|---------|-------------|
| 通用题目生成 | `generate_cards` |
| 问答题 | `generate_cards_qa` |
| 单选题 | `generate_cards_choice` |
| 判断题 | `generate_cards_true_false` |
| 多选题 | `generate_cards_multi_choice` |
| 填空题 | `generate_cards_fill_blank` |
| 解答题 | `generate_cards_essay` |
