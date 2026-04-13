# Tasks

- [x] Task 1: 修复无限扩展处理器中的领域关联
  - [x] SubTask 1.1: 在 `infiniteExpansionProcessor.ts` 中获取源图谱的领域信息
  - [x] SubTask 1.2: 利用 `domainContextService` 获取领域上下文并传递给AI Prompt
  - [x] SubTask 1.3: 创建新图谱时设置 `domain` 字段
  - [x] SubTask 1.4: 创建新图谱后在 `graph_domains` 表中创建关联记录

- [x] Task 2: 修复批量创建领域图谱API
  - [x] SubTask 2.1: 在 `batchCreateDomainGraphs` 中支持领域ID参数
  - [x] SubTask 2.2: 创建图谱后在 `graph_domains` 表中创建关联
  - [x] SubTask 2.3: 处理领域不存在时自动创建的逻辑

- [x] Task 3: 增强AI Prompt以包含领域上下文
  - [x] SubTask 3.1: 修改 `infinite_graph_expansion` prompt，增加领域上下文变量
  - [x] SubTask 3.2: 修改输出Schema，让AI建议包含领域归属
  - [x] SubTask 3.3: 更新 `promptService.ts` 中的默认prompt模板

- [x] Task 4: 编写数据迁移脚本
  - [x] SubTask 4.1: 创建迁移脚本，处理已有图谱的领域关联
  - [x] SubTask 4.2: 添加迁移API端点或命令行工具

- [x] Task 5: 测试验证
  - [x] SubTask 5.1: 测试无限扩展功能，验证新图谱正确关联领域
  - [x] SubTask 5.2: 测试批量创建功能，验证领域关联正确
  - [x] SubTask 5.3: 运行 `npm run check` 和 `npm run lint` 确保代码质量

# Task Dependencies

- [Task 3] 应在 [Task 1] 之前完成，因为需要先更新prompt模板
- [Task 4] 可以与 [Task 1-3] 并行执行
- [Task 5] 依赖于 [Task 1-4] 全部完成
