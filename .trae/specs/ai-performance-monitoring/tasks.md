# Tasks

- [x] Task 1: 定义性能监控相关类型
  - [x] SubTask 1.1: 在 `shared/types/performance.ts` 中定义 `AIPerformanceLog` 接口
  - [x] SubTask 1.2: 定义 `AIModelPricing` 接口和定价配置
  - [x] SubTask 1.3: 定义性能统计相关的请求/响应类型

- [x] Task 2: 实现成本估算服务
  - [x] SubTask 2.1: 创建 `api/services/ai/pricingService.ts`
  - [x] SubTask 2.2: 实现各模型定价配置
  - [x] SubTask 2.3: 实现 `calculateCost` 方法根据 token 数量计算成本

- [x] Task 3: 实现性能监控中间件
  - [x] SubTask 3.1: 创建 `api/services/ai/performanceMonitor.ts`
  - [x] SubTask 3.2: 实现 `recordLog` 方法记录性能日志
  - [x] SubTask 3.3: 实现内存存储（可选：后续可扩展到数据库）
  - [x] SubTask 3.4: 实现 `getLogs`、`getStats`、`clearLogs` 方法

- [x] Task 4: 集成监控到 AI 服务
  - [x] SubTask 4.1: 修改 `aiService.ts`，在关键方法中添加性能追踪
  - [x] SubTask 4.2: 提取 OpenAI 响应中的 usage 信息
  - [x] SubTask 4.3: 确保错误情况也能正确记录

- [x] Task 5: 创建性能统计 API
  - [x] SubTask 5.1: 创建 `api/routes/ai/performance.ts`
  - [x] SubTask 5.2: 实现 `GET /api/ai/performance/logs` 端点
  - [x] SubTask 5.3: 实现 `GET /api/ai/performance/stats` 端点
  - [x] SubTask 5.4: 实现 `DELETE /api/ai/performance/logs` 端点
  - [x] SubTask 5.5: 在 `api/routes/ai/index.ts` 中注册路由

- [x] Task 6: 创建前端性能数据 Store
  - [x] SubTask 6.1: 创建 `src/store/usePerformanceStore.ts`
  - [x] SubTask 6.2: 定义 store 状态和操作方法
  - [x] SubTask 6.3: 实现与后端 API 的数据同步

- [x] Task 7: 创建前端 API 服务
  - [x] SubTask 7.1: 在 `src/services/api/` 中添加性能 API 调用方法

- [x] Task 8: 实现控制台性能分页组件
  - [x] SubTask 8.1: 创建 `src/components/Console/PerformanceTab.tsx`
  - [x] SubTask 8.2: 实现性能统计概览展示（总 token、总成本、请求数）
  - [x] SubTask 8.3: 实现性能日志列表展示
  - [x] SubTask 8.4: 实现筛选功能（时间范围、操作类型）
  - [x] SubTask 8.5: 实现请求详情查看

- [x] Task 9: 集成性能分页到控制台
  - [x] SubTask 9.1: 修改 `Console.tsx` 添加分页切换 UI
  - [x] SubTask 9.2: 实现控制台分页状态管理
  - [x] SubTask 9.3: 添加性能分页的快捷键支持

- [x] Task 10: 测试和验证
  - [x] SubTask 10.1: 验证 AI 请求正确记录性能数据
  - [x] SubTask 10.2: 验证成本计算准确性
  - [x] SubTask 10.3: 验证前端性能分页正常显示

# Task Dependencies

- [Task 2] depends on [Task 1]
- [Task 3] depends on [Task 1], [Task 2]
- [Task 4] depends on [Task 3]
- [Task 5] depends on [Task 3]
- [Task 6] depends on [Task 1]
- [Task 7] depends on [Task 5]
- [Task 8] depends on [Task 6], [Task 7]
- [Task 9] depends on [Task 8]
- [Task 10] depends on [Task 4], [Task 5], [Task 9]
