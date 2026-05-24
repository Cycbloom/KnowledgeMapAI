# Tasks

- [x] Task 1: 更新 AI 配置文件中的默认模型名称
  - [x] 修改 `api/services/ai/config.ts` 第 23 行，将默认模型从 `deepseek-chat` 改为 `deepseek-v4-flash`

- [x] Task 2: 更新定价服务配置
  - [x] 修改 `api/services/ai/pricingService.ts`
  - [x] 移除 `deepseek-chat` 的定价配置（第 4-10 行）
  - [x] 移除 `deepseek-reasoner` 的定价配置（第 11-17 行）
  - [x] 添加 `deepseek-v4-flash` 定价：cached=0.02, uncached=1.0, output=2.0
  - [x] 添加 `deepseek-v4-pro` 定价（当前优惠价）：cached=0.025, uncached=3.0, output=6.0

- [x] Task 3: 更新数据库种子数据
  - [x] 修改 `supabase/migrations/50_seed_app_settings.sql` 第 7 行
  - [x] 将 deepseek 配置中的 model 从 `deepseek-chat` 改为 `deepseek-v4-flash`

# Task Dependencies
- 所有任务相互独立，可并行执行
