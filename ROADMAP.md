# KnowledgeMap 迭代路线图 (Roadmap)

> 详细的技术分析与功能清单请参阅: [docs/PROJECT_ANALYSIS_AND_ROADMAP.md](docs/PROJECT_ANALYSIS_AND_ROADMAP.md)

## 🎯 近期目标 (Current Focus)

### Phase 1: 地基加固与架构重构 (Foundation)
**目标**: 消除高风险技术债务，建立配置管理机制，确保系统稳定性。
- [x] **配置中心化**: 迁移硬编码的 AI 模型/图谱参数到数据库/环境变量。
- [x] **类型安全**: 全局替换 `any` 类型，引入 Zod 进行 API 参数校验。
- [x] **错误处理**: 统一后端异常流，完善前端 Error Boundary。

### Phase 2: 用户体验升级 (Experience)
**目标**: 完善用户控制权，优化移动端体验。
- [x] **用户设置中心**: 新增 Settings 页面 (AI 模型切换、FSRS 参数)。
- [x] **移动端优化**: 改进 3D 触控手势，增加 2D 降级模式。
- [ ] **数据安全**: 实现回收站与本地快照功能。

### Phase 3: 智慧增强 (Intelligence)
**目标**: 拓展 AI 输入源与交互深度。
- [ ] **多模态图谱**: 支持图片/PDF 图表转图谱。
- [ ] **智能路径**: 基于图算法的学习路径规划。

---

## ✅ 已完成 (Completed)
- 基础 3D 图谱编辑器 (增删改查)
- 多模型 AI 接入 (Deepseek/Aliyun/Volcengine)
- 异步任务队列系统 (BullMQ)
- 基础 FSRS 学习模式
- Markdown 导入/导出
