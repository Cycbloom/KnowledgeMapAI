# DeepSeek V4 模型更新 Spec

## Why
DeepSeek 官方发布公告，将弃用旧模型名称（deepseek-chat、deepseek-reasoner），并推出新的 V4 系列模型（deepseek-v4-flash、deepseek-v4-pro），同时调整了定价策略。需要更新代码和数据库配置以适配新模型。

## What Changes
- 更新默认模型名称从 `deepseek-chat` 到 `deepseek-v4-flash`
- 更新 pricingService.ts 中的模型定价配置
- 更新数据库 seed 文件中的模型配置
- 添加对新模型 `deepseek-v4-pro` 的支持
- 直接移除已弃用的旧模型名称配置

## Impact
- Affected specs: 无
- Affected code:
  - `api/services/ai/config.ts` - 默认模型配置
  - `api/services/ai/pricingService.ts` - 定价配置
  - `supabase/migrations/50_seed_app_settings.sql` - 数据库种子数据

## ADDED Requirements

### Requirement: 支持 deepseek-v4-flash 模型
系统 SHALL 使用 `deepseek-v4-flash` 作为 DeepSeek 提供商的默认模型。

#### Scenario: 替换旧模型名
- **WHEN** 系统初始化或读取环境变量时
- **THEN** 默认模型应为 `deepseek-v4-flash`

### Requirement: 支持 deepseek-v4-pro 模型
系统 SHALL 支持新的 `deepseek-v4-pro` 高级模型选项。

#### Scenario: 用户选择高级模型
- **WHEN** 用户在配置中选择使用 Pro 版本
- **THEN** 系统能够正确调用 `deepseek-v4-pro` 并应用相应定价

### Requirement: 更新定价配置
系统 SHALL 根据官方公告更新所有 DeepSeek V4 模型的定价。

#### Scenario: 计算成本时使用新价格
- **WHEN** 系统计算 AI 服务成本
- **THEN** 使用以下定价：

**deepseek-v4-flash 定价（2026/4/26 起生效）：**
- 缓存命中输入: 0.02 元/百万 tokens
- 缓存未命中输入: 1 元/百万 tokens
- 输出: 2 元/百万 tokens

**deepseek-v4-pro 定价（2.5 折优惠价格，长期有效）：**
- 缓存命中输入: 0.025 元/百万 tokens
- 缓存未命中输入: 3 元/百万 tokens
- 输出: 6 元/百万 tokens

## MODIFIED Requirements

### Requirement: DeepSeek 配置管理
修改后的配置 SHALL：
1. 将默认模型从 `deepseek-chat` 更新为 `deepseek-v4-flash`
2. 在定价服务中移除旧的 `deepseek-chat` 和 `deepseek-reasoner` 配置
3. 添加 `deepseek-v4-flash` 和 `deepseek-v4-pro` 的完整定价信息
4. 更新数据库种子数据中的模型名称

## REMOVED Requirements

### Requirement: 旧版模型支持 (deepseek-chat, deepseek-reasoner)
**Reason**: DeepSeek 官方已宣布弃用这两个模型名称
**Migration**: 直接在代码和数据库中替换为新模型名称
