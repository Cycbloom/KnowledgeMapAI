# Tasks

## Phase 1: 创建共享工具模块

- [x] Task 1: 创建共享索引转换工具
  - [x] SubTask 1.1: 创建 `shared/utils/indexMapping.ts` 文件
  - [x] SubTask 1.2: 实现 `isIndexValue` 函数
  - [x] SubTask 1.3: 实现 `resolveId` 函数
  - [x] SubTask 1.4: 实现 `buildIndexMap` 函数
  - [x] SubTask 1.5: 实现 `buildIndexMapFromTitles` 函数

## Phase 2: 创建后端索引映射服务

- [x] Task 2: 创建索引映射服务
  - [x] SubTask 2.1: 创建 `api/services/indexMapping/` 目录
  - [x] SubTask 2.2: 创建 `IndexMappingService.ts` 单例服务
  - [x] SubTask 2.3: 实现图谱索引映射构建
  - [x] SubTask 2.4: 实现节点索引映射构建
  - [x] SubTask 2.5: 实现缓存机制
  - [x] SubTask 2.6: 实现 `resolveGraphId` 方法
  - [x] SubTask 2.7: 实现 `resolveNodeId` 方法

## Phase 3: 创建索引转换中间件

- [x] Task 3: 创建索引转换中间件
  - [x] SubTask 3.1: 创建 `api/middleware/indexMapping.ts`
  - [x] SubTask 3.2: 实现中间件逻辑
  - [x] SubTask 3.3: 扩展 Express Request 类型
  - [x] SubTask 3.4: 提供带节点映射的中间件变体

## Phase 4: 重构Agent工具

- [x] Task 4: 重构 graphTools.ts
  - [x] SubTask 4.1: 移除重复的 `isIndexValue` 函数
  - [x] SubTask 4.2: 移除重复的 `resolveGraphId` 函数
  - [x] SubTask 4.3: 导入共享工具函数
  - [x] SubTask 4.4: 更新工具使用共享函数

- [x] Task 5: 重构 analysisTools.ts
  - [x] SubTask 5.1: 移除重复函数
  - [x] SubTask 5.2: 导入共享工具函数
  - [x] SubTask 5.3: 更新工具使用共享函数

- [x] Task 6: 重构 learningTools.ts
  - [x] SubTask 6.1: 移除重复函数
  - [x] SubTask 6.2: 导入共享工具函数
  - [x] SubTask 6.3: 更新工具使用共享函数

- [x] Task 7: 重构 nodeTools.ts
  - [x] SubTask 7.1: 检查是否需要重构（无需修改，不涉及图谱ID转换）
  - [x] SubTask 7.2: 确认无需导入共享工具函数

## Phase 5: 创建前端索引映射服务

- [x] Task 8: 创建前端索引映射服务
  - [x] SubTask 8.1: 创建 `src/services/indexMapping.ts`
  - [x] SubTask 8.2: 实现 `getGraphIndexMap` 方法
  - [x] SubTask 8.3: 实现 `resolveGraphId` 方法
  - [x] SubTask 8.4: 实现 `buildIndexMapFromData` 方法

## Phase 6: 更新API路由

- [x] Task 9: 更新Agent路由使用中间件
  - [x] SubTask 9.1: 更新 AgentService 构建 graphIndexMap
  - [x] SubTask 9.2: 更新 `/recommendations/apply` 使用共享工具
  - [x] SubTask 9.3: 移除手动转换代码

## Phase 7: 验证与测试

- [x] Task 10: 类型检查与代码质量
  - [x] SubTask 10.1: 运行 `npm run check` 验证TypeScript类型
  - [x] SubTask 10.2: 运行 `npm run lint` 验证代码风格
  - [x] SubTask 10.3: 修复所有类型错误和lint警告

- [x] Task 11: 功能验证
  - [x] SubTask 11.1: 验证Agent工具正常工作
  - [x] SubTask 11.2: 验证索引转换正确
  - [x] SubTask 11.3: 验证缓存机制有效

---

# Task Dependencies

- Task 2 依赖 Task 1（服务需要使用共享工具）
- Task 3 依赖 Task 2（中间件需要使用服务）
- Task 4, 5, 6, 7 依赖 Task 1（重构需要共享工具）
- Task 8 依赖 Task 1（前端服务需要共享工具）
- Task 9 依赖 Task 3（路由需要中间件）
- Task 10, 11 依赖所有实现任务完成

# Parallelizable Work

以下任务可以并行执行：
- Task 4, Task 5, Task 6, Task 7（不同工具文件的重构）
- Task 8（前端服务与后端重构独立）

# 实施建议

建议按阶段实施：
1. **Phase 1**: 先创建共享工具，为后续重构提供基础
2. **Phase 2-3**: 创建后端服务和中间件
3. **Phase 4-7**: 重构现有代码使用新架构
4. **Phase 8-9**: 更新前端和路由
5. **Phase 10-11**: 全面测试验证
