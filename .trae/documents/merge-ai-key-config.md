# 合并 AI 密钥配置入口计划

## 问题背景

当前 Settings 页面存在两个配置 AI API Key 的地方：

1. **AI 服务密钥配置区域**（第一张图）
   - 位置：`src/pages/Settings.tsx:960-1125`
   - 存储：`ai_provider_config`
   - API：`GET/PUT /ai/config/providers`
   - 功能：按提供商分别配置密钥（Deepseek、火山引擎等）

2. **主 AI 配置 + 向量化配置区域**（第二张图）
   - 位置：`src/pages/Settings.tsx:1214-1460`
   - 存储：`system_config.main_ai` / `system_config.embedding_ai`
   - API：`GET/PUT /ai/config/main-ai`、`GET/PUT /ai/config/embedding-ai`
   - 功能：选择主服务/向量化服务的提供商，也可输入 API Key

**问题**：用户需要在两个地方配置 API Key，体验混乱且冗余。

## 解决方案

采用**统一配置入口**方案：保留"AI 服务密钥配置"作为唯一密钥管理入口，将"主 AI 配置"和"向量化配置"简化为仅做**提供商选择**（不再重复输入 API Key）。

### 数据流设计

```
┌─────────────────────────────────┐
│   AI 服务密钥配置（唯一入口）      │
│   → 存储到 ai_provider_config    │
└──────────────┬──────────────────┘
               │ 密钥已就绪
               ▼
┌─────────────────────────────────┐
│   主 AI 配置 / 向量化配置         │
│   → 仅选择提供商（下拉框）          │
│   → 存储到 system_config          │
│   → 不再显示 API Key 输入框       │
└─────────────────────────────────┘
```

## 实施步骤

### 步骤 1：简化前端 - 移除主 AI 配置和向量化配置中的 API Key 输入

**文件**：`src/pages/Settings.tsx`

**修改内容**：
1. **主 AI 配置区域**（约 1240-1325 行）：
   - 移除 API Key 输入框及其相关 state (`showMainAiApiKey`)
   - 移除 Base URL 输入框（使用提供商默认值或 ai_provider_config 中的值）
   - 保留：提供商选择、模型名称输入、测试连接按钮、保存按钮
   - 添加提示文字："API Key 请在上方「AI 服务密钥配置」中设置"

2. **向量化配置区域**（约 1369-1450 行）：
   - 移除 API Key 输入框及其相关 state (`showEmbeddingApiKey`)
   - 移除 Base URL 输入框
   - 保留：启用开关、提供商选择、模型名称输入、测试连接按钮、保存按钮
   - 添加提示文字："API Key 请在上方「AI 服务密钥配置」中设置"

3. **清理相关 state 和函数**：
   - 移除 `showMainAiApiKey`、`showEmbeddingApiKey` 状态
   - 修改 `handleSaveMainAi` 和 `handleSaveEmbeddingAi` 函数，不再发送 apiKey/baseURL
   - 修改 `handleTestMainAi` 和 `handleTestEmbeddingAi` 函数，从 ai_provider_config 读取密钥

### 步骤 2：更新后端 API - 简化 main-ai 和 embedding-ai 接口

**文件**：`api/routes/ai/config.ts`

**修改内容**：

1. **PUT /config/main-ai**（约 459-527 行）：
   - 移除 `apiKey` 和 `baseURL` 参数处理
   - 只接受 `provider` 和 `model` 参数
   - 移除向 `ai_provider_config` 同步 apiKey 的逻辑（步骤 1 中已在 providers 接口处理）

2. **PUT /config/embedding-ai**（约 575-660 行）：
   - 同上，移除 `apiKey` 和 `baseURL` 参数处理

3. **GET /config/main-ai** 和 **GET /config/embedding-ai**：
   - 返回值中移除 `baseURL` 字段（或标记为只读/来自提供商配置）
   - 保持 `configured` 和 `source` 状态显示（用于判断是否已在上方的密钥配置中设置）

### 步骤 3：优化 UI 提示和联动

**文件**：`src/pages/Settings.tsx`

**修改内容**：

1. 在"主 AI 配置"区域添加提示：
   ```
   💡 提示：请先在上方「AI 服务密钥配置」中为此提供商设置 API Key
   ```

2. 当选择的提供商在 `ai_provider_config` 中没有配置时：
   - 显示警告样式："该提供商尚未配置 API Key"
   - 禁用"测试连接"和"保存配置"按钮
   - 或自动跳转到上方的对应提供商配置区域

3. 在"AI 服务密钥配置"区域的每个提供商卡片上添加标签：
   - "主服务" - 当前被选为主 AI 服务
   - "向量化" - 当前被选为向量化服务
   - 方便用户了解哪些提供商正在被使用

### 步骤 4：清理无用代码

**涉及文件**：
- `src/pages/Settings.tsx`：移除不再使用的 state 和 handler
- `api/routes/ai/config.ts`：移除重复的 apiKey 同步逻辑
- 类型定义文件（如有）：更新相关接口类型

### 步骤 5：测试验证

1. **功能测试**：
   - 在"AI 服务密钥配置"中配置 Deepseek 的 API Key
   - 在"主 AI 配置"中选择 Deepseek，确认能正常测试连接
   - 切换到其他未配置的提供商，确认显示警告
   - 向量化配置同样测试

2. **兼容性测试**：
   - 已有配置的用户升级后，配置不丢失
   - 环境变量配置仍然正常工作

3. **运行检查命令**：
   ```bash
   npm run check:incremental
   npm run lint
   ```

## 预期效果

| 项目 | 修改前 | 修改后 |
|------|--------|--------|
| API Key 配置入口 | 2 个 | 1 个 |
| 用户困惑度 | 高（不知道在哪配） | 低（只有一处） |
| 代码复杂度 | 有重复逻辑 | 职责清晰 |
| 功能完整性 | 不变 | 不变 |

## 风险评估

- **低风险**：主要是 UI 简化，不影响核心 AI 调用逻辑
- **注意点**：需确保 `getProviderConfig()` 函数仍然能正确从 `ai_provider_config` 读取密钥（该函数不受影响）
