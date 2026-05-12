# Tasks

- [x] Task 1: 创建骨干模块数据表
  - [x] SubTask 1.1: 创建 `graph_backbone_modules` 表的 migration 文件
  - [x] SubTask 1.2: 添加类型定义到 `shared/types/graph.ts`
  - [x] SubTask 1.3: 运行 migration 创建表

- [x] Task 2: 修改图谱初始化逻辑
  - [x] SubTask 2.1: 修改 `graphService.ts` 创建骨干模块配置
  - [x] SubTask 2.2: 类型检查通过

- [x] Task 3: 修改象限视图渲染逻辑
  - [x] SubTask 3.1: 修改 `GraphEditor.tsx` 从图谱属性获取骨干模块配置
  - [x] SubTask 3.2: 移除调试日志
  - [x] SubTask 3.3: 简化节点分配逻辑

- [x] Task 4: 数据迁移
  - [x] SubTask 4.1: 创建迁移脚本，从现有骨干节点提取信息创建骨干模块配置
  - [x] SubTask 4.2: 运行 migration 创建表并迁移数据
  - [x] SubTask 4.3: 测试迁移脚本

- [x] Task 5: 验证和测试
  - [x] SubTask 5.1: 运行类型检查
  - [x] SubTask 5.2: 测试新创建的专题研究图谱
  - [x] SubTask 5.3: 测试迁移后的现有图谱
  - [x] SubTask 5.4: 测试象限视图功能

# Task Dependencies

- [Task 2] 依赖 [Task 1] 完成数据表创建
- [Task 3] 依赖 [Task 1] 完成类型定义
- [Task 4] 依赖 [Task 1], [Task 2], [Task 3] 完成
- [Task 5] 依赖所有其他任务完成
