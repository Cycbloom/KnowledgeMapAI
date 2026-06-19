# Tasks

- [x] Task 1: 创建 taskExecutionService（从 scheduler/executions.ts 提取）
- [x] Task 2: 创建 appearanceService（从 story/appearances.ts 提取）
- [x] Task 3: 创建 sceneService（从 story/scenes.ts 提取）
- [x] Task 4: 创建 taskSettingService（从 scheduler/settings.ts 提取）
- [x] Task 5: 创建 authRouteService（从 auth.ts 提取用户表操作）
- [x] Task 6: 创建 relationshipService（从 story/relationships.ts 提取）
- [x] Task 7: 创建 taskStatService（从 scheduler/analytics.ts 提取）
- [x] Task 8: 创建 studyRouteService（从 study.ts 提取剩余 DB 操作）
- [x] Task 9: 创建 templateRouteService（从 templates.ts 提取模板应用逻辑）
- [x] Task 10: 创建 analysisRouteService（从 graphs/analysis.ts 提取领域分析）
- [x] Task 11: 创建 agentRouteService（从 agent.ts 提取推荐应用）
- [x] Task 12: 创建 aiConfigRouteService（从 ai/config.ts 提取数据库测试）
- [x] Task 13: 创建 systemMonitorService（从 systemMonitor.ts 提取数据库检测）
- [x] Task 14: 提取 autoGraph.ts 剩余 DB 调用（embedding-status 查询 + getTemplate）
- [x] Task 15: 处理 8 个单次调用文件（conceptAggregation, learningPaths, health, ai/cards, aiActions, scheduler/recommendations, statistics, graphNodes）
- [x] Task 16: 精简所有对应路由文件
- [x] Task 17: 更新服务导出
- [x] Task 18: 验证构建和类型检查

# Task Dependencies
- [Task 16] depends on [Task 1-15]
- [Task 17] depends on [Task 1-15]
- [Task 18] depends on [Task 16-17]
- [Task 1-15] 可并行
