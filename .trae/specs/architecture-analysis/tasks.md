# Tasks

## 阶段 1: 准备工作

- [x] Task 1: 创建架构分析报告文档
  - [x] SubTask 1.1: 分析现有目录结构
  - [x] SubTask 1.2: 识别模块边界问题
  - [x] SubTask 1.3: 生成架构图和依赖关系
  - [x] SubTask 1.4: 编写优化建议文档

- [ ] Task 2: 建立迁移基础设施
  - [ ] SubTask 2.1: 创建 TypeScript 路径别名配置
  - [ ] SubTask 2.2: 编写文件迁移脚本
  - [ ] SubTask 2.3: 创建导入路径更新工具

## 阶段 2: 低风险迁移

- [x] Task 3: 统一类型定义
  - [x] SubTask 3.1: 审计 `src/types` 和 `shared/types` 的类型定义
  - [x] SubTask 3.2: 合并重复类型定义到 `shared/types`
  - [x] SubTask 3.3: 更新所有导入路径使用 `@shared/types`
  - [x] SubTask 3.4: 删除 `src/types` 目录
  - [x] SubTask 3.5: 验证类型检查通过

- [ ] Task 4: 规范化测试目录
  - [ ] SubTask 4.1: 创建 `src/__tests__` 目录结构
  - [ ] SubTask 4.2: 创建 `api/__tests__` 目录结构
  - [ ] SubTask 4.3: 迁移现有测试文件到新目录
  - [ ] SubTask 4.4: 更新测试配置文件

- [ ] Task 5: 清理重复依赖
  - [ ] SubTask 5.1: 分析 `@dnd-kit` 和 `@hello-pangea/dnd` 使用情况
  - [ ] SubTask 5.2: 选择保留的拖拽库
  - [ ] SubTask 5.3: 迁移使用被移除库的组件
  - [ ] SubTask 5.4: 从 package.json 移除废弃依赖
  - [ ] SubTask 5.5: 验证拖拽功能正常

## 阶段 3: 中风险迁移

- [x] Task 6: Hooks 模块化拆分
  - [x] SubTask 6.1: 创建 `src/hooks/queries` 目录
  - [x] SubTask 6.2: 拆分 `useQueries.ts` 为多个功能域文件
    - [x] useGraphQueries.ts
    - [x] useTaskQueries.ts
    - [x] useStudyQueries.ts
    - [x] useAuthQueries.ts
    - [x] useAIQueries.ts
  - [x] SubTask 6.3: 创建 `src/hooks/mutations` 目录
  - [x] SubTask 6.4: 拆分 mutation hooks
  - [x] SubTask 6.5: 更新 `src/hooks/index.ts` 导出
  - [x] SubTask 6.6: 全局更新导入路径
  - [x] SubTask 6.7: 验证所有 hooks 功能正常

- [ ] Task 7: API 客户端规范化
  - [ ] SubTask 7.1: 审计现有 API 模块组织
  - [ ] SubTask 7.2: 为每个 API 模块创建独立目录
  - [ ] SubTask 7.3: 统一 API 模块导出格式
  - [ ] SubTask 7.4: 更新 `src/services/api/index.ts`
  - [ ] SubTask 7.5: 验证 API 调用正常

## 阶段 4: 高风险迁移

- [ ] Task 8: 组件目录重组
  - [ ] SubTask 8.1: 创建新的目录结构
    - [ ] `src/components/features/`
    - [ ] `src/components/ui/`
  - [ ] SubTask 8.2: 迁移 Scheduler 模块到 `features/scheduler/`
  - [ ] SubTask 8.3: 迁移 GraphEditor 模块到 `features/graph-editor/`
  - [ ] SubTask 8.4: 迁移其他功能模块
  - [ ] SubTask 8.5: 重组 common 组件
  - [ ] SubTask 8.6: 全局更新导入路径
  - [ ] SubTask 8.7: 验证所有组件渲染正常

- [ ] Task 9: 后端服务分层
  - [ ] SubTask 9.1: 设计 Repository 层接口
  - [ ] SubTask 9.2: 创建 `api/repositories` 目录
  - [ ] SubTask 9.3: 提取数据库操作到 Repository
  - [ ] SubTask 9.4: 重构 Service 层使用 Repository
  - [ ] SubTask 9.5: 验证 API 功能正常

## 阶段 5: 验证与清理

- [ ] Task 10: 全面验证
  - [ ] SubTask 10.1: 运行 TypeScript 类型检查
  - [ ] SubTask 10.2: 运行 ESLint 检查
  - [ ] SubTask 10.3: 运行单元测试
  - [ ] SubTask 10.4: 运行 E2E 测试
  - [ ] SubTask 10.5: 手动验证核心功能

- [ ] Task 11: 文档更新
  - [ ] SubTask 11.1: 更新 README.md
  - [ ] SubTask 11.2: 更新 DEVELOPMENT.md
  - [ ] SubTask 11.3: 创建 ARCHITECTURE.md
  - [ ] SubTask 11.4: 更新项目规则文件

- [ ] Task 12: 清理工作
  - [ ] SubTask 12.1: 删除旧目录和文件
  - [ ] SubTask 12.2: 清理未使用的导入
  - [ ] SubTask 12.3: 格式化代码

---

# Task Dependencies

- [Task 3] depends on [Task 1]
- [Task 4] depends on [Task 1]
- [Task 5] depends on [Task 1]
- [Task 6] depends on [Task 3]
- [Task 7] depends on [Task 3]
- [Task 8] depends on [Task 6]
- [Task 9] depends on [Task 7]
- [Task 10] depends on [Task 8, Task 9]
- [Task 11] depends on [Task 10]
- [Task 12] depends on [Task 11]
