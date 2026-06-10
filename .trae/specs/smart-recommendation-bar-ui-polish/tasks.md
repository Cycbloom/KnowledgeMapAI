# Tasks

- [x] Task 1: 移除"最佳执行时段建议"区域
  - [x] 删除 `getBestTimeSlots` 方法（第 266-301 行）
  - [x] 删除 `bestTimeSlots` 变量声明和渲染区块（第 339 行、第 549-592 行）
  - [x] 清理不再需要的 Clock import（Clock 在预计时长处仍使用，保留）

- [x] Task 2: 修复 i18n key 泄露
  - [x] 修复 fallback 逻辑：`t(key) || "fallback"` → `t(key, "fallback")`
  - [x] 检查所有 t() 调用，确认无其他类似风险

- [x] Task 3: UI 美化优化
  - [x] 卡片头部：背景加深、图标容器加大、效率 badge 加阴影
  - [x] 子任务区域：渐变背景包裹、标题加粗、状态 badge 加阴影、i18n 化
  - [x] 推荐理由标签：圆角改 pill、文字淡化、边框淡化
  - [x] 按钮组：查看详情改为带边框次要按钮，主按钮圆角/内边距微调
  - [x] 整体细节：紧急度色条变细、间距微调

# Task Dependencies
- 无依赖，所有任务可并行或顺序执行
