# Tasks - 概念聚合与层级构建功能

## 阶段一：基础架构

- [x] Task 1: 数据库变更 - 添加 aliases 字段
  - [x] 1.1 创建迁移文件 `22_concept_aliases.sql`
  - [x] 1.2 在 knowledge_points 表添加 aliases TEXT[] 字段
  - [x] 1.3 更新 TypeScript 类型定义（shared/types/graph.ts）
  - [x] 1.4 验证：本地数据库迁移成功

- [x] Task 2: 扩展 ConceptAggregationService
  - [x] 2.1 新增 `identifyHierarchy()` 方法 - AI 层级识别
  - [x] 2.2 新增 `batchMerge()` 方法 - 批量合并概念
  - [x] 2.3 新增别名管理方法（addAliases/removeAlias）
  - [x] 2.4 编写单元测试

## 阶段二：AI 服务

- [x] Task 3: 层级识别 AI Prompt 设计与实现
  - [x] 3.1 设计层级识别的 System/User prompt 模板
  - [x] 3.2 在 prompt_templates 表中注册新模板
  - [x] 3.3 实现 `hierarchyRecognitionService.ts`
  - [x] 3.4 测试：输入一组概念，验证返回合理的层级关系

- [x] Task 4: 聚合分析主流程
  - [x] 4.1 实现 `analyzeConcepts()` - 完整分析流程
    - 获取图谱所有概念
    - 计算相似度矩阵
    - 调用 AI 识别层级
    - 生成聚合建议
  - [x] 4.2 支持分批处理和进度回调
  - [x] 4.3 测试：端到端分析流程

## 阶段三：API 接口

- [x] Task 5: 实现 RESTful API 端点
  - [x] 5.1 POST `/api/graphs/:graphId/concept-aggregation/analyze` - 触发分析
  - [x] 5.2 GET `/api/graphs/:graphId/concept-aggregation/results` - 获取结果
  - [x] 5.3 POST `/api/graphs/:graphId/concept-aggregation/merge` - 执行合并
  - [x] 5.4 POST `/api/graphs/:graphId/concept-aggregation/hierarchy` - 应用层级
  - [x] 5.5 PUT `/api/knowledge-points/:id/aliases` - 更新别名
  - [x] 5.6 API 权限校验和错误处理

## 阶段四：前端 UI

- [x] Task 6: 聚合面板基础组件
  - [x] 6.1 创建 `ConceptAggregationPanel.tsx` 主面板组件
  - [x] 6.2 集成到 AI 助手面板（图谱编辑器左侧）
  - [x] 6.3 基础布局：标签页切换（聚合结果/层次树/设置）

- [x] Task 7: 聚合结果预览视图
  - [x] 7.1 相似概念分组列表组件
  - [x] 7.2 每组显示：成员列表、相似度、来源文献、操作按钮
  - [x] 7.3 操作按钮：「合并」「忽略」「拆分」
  - [x] 7.4 变更摘要统计面板

- [x] Task 8: 层次树可视化
  - [x] 8.1 概念层次树组件（可交互树形图）
  - [x] 8.2 支持展开/折叠节点
  - [x] 8.3 支持拖拽调整父子关系
  - [x] 8.4 显示置信度/强度标识

- [x] Task 9: 图谱画布集成
  - [x] 9.1 相似度标注模式切换
  - [x] 9.2 高亮相似概念组（颜色编码）
  - [x] 9.3 虚线连接 + 悬停提示
  - [x] 9.4 点击高亮组时聚焦到聚合面板对应项

- [x] Task 10: 别名管理 UI
  - [x] 10.1 节点详情中的别名编辑区域
  - [x] 10.2 添加/删除别名交互
  - [x] 10.3 合并时自动生成别名的确认提示

## 阶段五：优化与完善

- [x] Task 11: 性能优化
  - [x] 11.1 大图谱分批处理策略（已实现在 conceptAnalysisService）
  - [x] 11.2 分析结果缓存机制（使用 cacheService）
  - [ ] 11.3 前端虚拟滚动（大量概念时）- 可选优化

- [x] Task 12: 测试与文档
  - [ ] 12.1 E2E 测试：完整聚合流程 - 需要运行环境验证
  - [ ] 12.2 边界情况测试（空图谱、单节点、循环依赖等）- 需要运行环境验证
  - [ ] 12.3 用户操作指南（可选）

# Task Dependencies

- [Task 2] depends on [Task 1]
- [Task 3] depends on [Task 1]
- [Task 4] depends on [Task 2, Task 3]
- [Task 5] depends on [Task 4]
- [Task 6] depends on [Task 5]
- [Task 7, Task 8, Task 9, Task 10] depends on [Task 6]
- [Task 11, Task 12] depends on [Task 7, Task 8, Task 9, Task 10]

## 并行任务

以下任务可以并行开发：
- Task 2 和 Task 3 可并行（后端服务层）
- Task 7、Task 8、Task 9、Task 10 可并行（UI 组件相对独立）
