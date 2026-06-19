# Tasks

- [x] Task 1: 补全 ai/index.ts 缺失导出（performanceMonitor, enrichMetadata, pricingService, getAIProviderForTask, getAIProvider, getEnvConfig, literatureMetadataService）
- [x] Task 2: 补全 graph/index.ts 缺失导出（collaboratorService）
- [x] Task 3: 补全 scheduler/index.ts 缺失导出（activityService, autoTaskGenerator, smartTaskLinker, systemTaskService）
- [x] Task 4: 补全 scheduler/core/index.ts 缺失导出（learningLoopOrchestrator）
- [x] Task 5: 创建 achievements/index.ts 导出文件
- [x] Task 6: 将 auth.ts 中 5 处 Auth API 调用封装到 authRouteService（signUp, signInWithPassword, refreshSession, signOut, admin.signOut）
- [x] Task 7: 精简 auth.ts 路由文件使用 authRouteService
- [x] Task 8: 更新路由文件导入路径（从直接引用具体文件改为通过 index.ts）
- [x] Task 9: 验证构建和类型检查

# Task Dependencies
- [Task 1-5] 可并行
- [Task 6] 和 [Task 7] 顺序执行
- [Task 8] depends on [Task 1-5]
- [Task 9] depends on [Task 1-8]
