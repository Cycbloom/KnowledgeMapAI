# Tasks

- [x] Task 1: 修复模板应用中的属性保存逻辑
  - [x] SubTask 1.1: 修改 `api/routes/templates.ts` 的 `/from-template` 路由，确保 `backboneModule` 等属性被正确保存
  - [ ] SubTask 1.2: 添加单元测试验证属性保存完整性

- [x] Task 2: 增强文献提取的日志和诊断信息
  - [x] SubTask 2.1: 在 `api/routes/literature.ts` 中增强骨干节点查询的日志输出
  - [x] SubTask 2.2: 添加挂载失败时的详细原因说明

- [x] Task 3: 添加数据修复功能（可选）
  - [x] SubTask 3.1: 创建 API 端点用于修复已存在图谱的缺失 `backboneModule` 属性
  - [x] SubTask 3.2: 实现自动检测和修复逻辑

- [x] Task 4: 验证修复效果
  - [x] SubTask 4.1: 运行现有 E2E 测试 `literature-extract-mounting.spec.ts`
  - [x] SubTask 4.2: 手动测试完整流程：创建专题研究图谱 → 文献提取 → 验证挂载
  - [x] SubTask 4.3: 运行 lint 和类型检查

# Task Dependencies
- Task 2 可以与 Task 1 并行
- Task 4 依赖 Task 1 完成
