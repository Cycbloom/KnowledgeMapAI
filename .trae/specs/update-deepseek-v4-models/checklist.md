# Checklist

- [x] config.ts 中 DEEPSEEK_MODEL 默认值已更新为 deepseek-v4-flash
- [x] pricingService.ts 中已移除 deepseek-chat 定价配置
- [x] pricingService.ts 中已移除 deepseek-reasoner 定价配置
- [x] pricingService.ts 中已添加 deepseek-v4-flash 定价（缓存 0.02, 非缓存 1.0, 输出 2.0）
- [x] pricingService.ts 中已添加 deepseek-v4-pro 定价（缓存 0.025, 非缓存 3.0, 输出 6.0）
- [x] 50_seed_app_settings.sql 中 deepseek model 已更新为 deepseek-v4-flash
- [x] 代码通过 TypeScript 类型检查（npm run check）✅ 通过
- [x] 代码通过 ESLint 检查（npm run lint）⚠️ 存在 1 个预存错误（useCanvasInteraction.ts），与本次更改无关
