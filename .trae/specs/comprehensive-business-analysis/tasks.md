# Tasks - 业务逻辑全面分析

## 阶段一：核心任务识别

- [x] Task 1: 识别知识图谱系统核心任务
  - [x] 分析知识图谱数据模型
  - [x] 识别图谱编辑核心操作
  - [x] 梳理知识点与图谱关系

- [x] Task 2: 识别 AI 智能辅助核心任务
  - [x] 分析 AI 服务架构
  - [x] 识别 AI 功能场景
  - [x] 梳理 AI 任务处理流程

- [x] Task 3: 识别学习系统核心任务
  - [x] 分析 FSRS 算法实现
  - [x] 识别学习卡片类型
  - [x] 梳理学习进度追踪机制

- [x] Task 4: 识别任务调度核心任务
  - [x] 分析三层队列架构
  - [x] 识别任务状态流转
  - [x] 梳理专注会话机制

## 阶段二：功能模块分析

- [x] Task 5: 分析知识图谱系统
  - [x] 梳理核心组件职责
  - [x] 分析数据流向
  - [x] 总结业务规则

- [x] Task 6: 分析 AI 智能辅助系统
  - [x] 梳理多提供商适配架构
  - [x] 分析提示词模板管理
  - [x] 总结异步任务处理机制

- [x] Task 7: 分析学习系统
  - [x] 梳理 FSRS 算法实现
  - [x] 分析卡片类型和难度
  - [x] 总结测验集合管理

- [x] Task 8: 分析任务调度系统
  - [x] 梳理队列架构
  - [x] 分析任务依赖关系
  - [x] 总结番茄钟专注模式

- [x] Task 9: 分析学习路径系统
  - [x] 梳理路径生成机制
  - [x] 分析进度追踪方式
  - [x] 总结与任务调度整合

- [x] Task 10: 分析成就激励系统
  - [x] 梳理成就触发机制
  - [x] 分析周期任务奖励
  - [x] 总结经验值等级系统

## 阶段三：数据流程分析

- [x] Task 11: 分析核心数据实体关系
  - [x] 绘制实体关系图
  - [x] 识别关键外键关联
  - [x] 分析数据隔离策略

- [x] Task 12: 分析关键数据流
  - [x] 梳理知识创建流程
  - [x] 梳理学习复习流程
  - [x] 梳理任务执行流程

## 阶段四：用户交互分析

- [x] Task 13: 分析用户交互路径
  - [x] 梳理新用户引导路径
  - [x] 梳理日常使用路径
  - [x] 识别关键交互节点

## 阶段五：业务规则总结

- [x] Task 14: 总结关键业务规则
  - [x] 数据隔离规则
  - [x] AI 调用规则
  - [x] 学习算法规则
  - [x] 任务调度规则
  - [x] 成就触发规则

## 阶段六：优化建议

- [x] Task 15: 提出架构优化建议
  - [x] 短期优化建议
  - [x] 中期优化建议
  - [x] 长期优化建议

- [x] Task 16: 提出业务逻辑优化建议
  - [x] 学习系统优化
  - [x] 任务调度优化
  - [x] AI 功能优化

- [x] Task 17: 提出性能优化建议
  - [x] 数据库查询优化
  - [x] 前端性能优化
  - [x] 缓存策略优化

- [x] Task 18: 提出用户体验优化建议
  - [x] 新手引导优化
  - [x] 移动端适配优化
  - [x] 无障碍支持

## 阶段七：生成分析报告

- [x] Task 19: 编写 spec.md 文档
  - [x] 核心任务识别
  - [x] 功能模块分析
  - [x] 数据流程分析
  - [x] 优化建议

- [x] Task 20: 编写 tasks.md 文档
  - [x] 任务分解
  - [x] 依赖关系

- [x] Task 21: 编写 checklist.md 文档
  - [x] 检查点列表

## 阶段八：实施优化 - 统一命名规范

- [x] Task 22: 删除冗余的重导出文件
  - [x] 删除 api/services/cache.ts
  - [x] 删除 api/services/queue.ts
  - [x] 删除 api/services/backupSync.ts

- [x] Task 23: 更新导入路径
  - [x] 更新 routes/templates.ts
  - [x] 更新 routes/study.ts
  - [x] 更新 routes/nodes.ts
  - [x] 更新 routes/knowledgePoints.ts
  - [x] 更新 routes/graphs.ts
  - [x] 更新 routes/data.ts
  - [x] 更新 routes/autoGraph.ts
  - [x] 更新 routes/backup.ts
  - [x] 更新 routes/ai/document.ts
  - [x] 更新 services/ai/index.ts
  - [x] 更新 services/graphService.ts
  - [x] 更新 services/promptService.ts
  - [x] 更新 services/studyService.ts
  - [x] 更新 services/taskService.ts
  - [x] 更新 jobs/taskProcessor.ts

- [x] Task 24: 验证修改
  - [x] 运行类型检查 (npm run check)
  - [x] 运行代码检查 (npm run lint)

---

# Task Dependencies

- Task 5-10 依赖 Task 1-4
- Task 11-12 依赖 Task 5-10
- Task 13-14 依赖 Task 11-12
- Task 15-18 依赖 Task 13-14
- Task 19-21 依赖 Task 15-18
- Task 22-24 依赖 Task 19-21

- [x] 统一命名规范实施完成
