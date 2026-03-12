# Tasks - 统一类型定义位置

## 阶段一：创建后端类型目录结构

- [x] Task 1: 创建 api/types 目录和基础文件
  - [x] 创建 api/types/ai.ts（从 api/services/ai/types.ts 迁移）
  - [x] 创建 api/types/index.ts（重导出所有后端类型）

- [x] Task 2: 更新后端 AI 服务导入路径
  - [x] 更新 api/services/ai/aiService.ts
  - [x] 更新 api/services/ai/factory.ts
  - [x] 更新 api/services/ai/embeddingService.ts
  - [x] 更新 api/services/ai/index.ts
  - [x] 删除 api/services/ai/types.ts

## 阶段二：迁移前端类型

- [x] Task 3: 迁移前端专用类型到 src/types
  - [x] 创建 src/types/calendar.ts（从 src/components/Calendar/types.ts 迁移）
  - [x] 创建 src/types/api.ts（从 src/services/api/types.ts 迁移）
  - [x] 更新 src/types/index.ts 添加重导出

- [x] Task 4: 更新前端组件导入路径
  - [x] 更新 src/components/Calendar 相关组件
  - [x] 更新 src/services/api 相关文件
  - [x] 删除 src/components/Calendar/types.ts
  - [x] 删除 src/services/api/types.ts

## 阶段三：验证修改

- [x] Task 5: 验证类型系统完整性
  - [x] 运行类型检查 (npm run check)
  - [x] 运行代码检查 (npm run lint)
  - [x] 确保所有导入正确

---

# Task Dependencies

- Task 2 依赖 Task 1
- Task 4 依赖 Task 3
- Task 5 依赖 Task 1-4

## 完成状态

- [x] 所有任务已完成
