# 项目优化实施 - The Implementation Plan (Decomposed and Prioritized Task List)

## [x] Task 1: 重构 updateTaskStatus 方法
- **Priority**: P0
- **Depends On**: None
- **Description**: 
  - 重构 `api/services/taskService.ts` 中的 `updateTaskStatus` 方法
  - 使用对象参数模式替代位置偏移的参数
  - 保持向后兼容性
  - 改善代码可读性和可维护性
- **Acceptance Criteria Addressed**: [AC-1]
- **Test Requirements**:
  - `programmatic` TR-1.1: TypeScript 编译无错误
  - `programmatic` TR-1.2: 所有现有测试通过
- **Notes**: 重点是第 100-168 行

## [x] Task 2: 添加数据库索引
- **Priority**: P0
- **Depends On**: None
- **Description**: 
  - 为 `knowledge_graphs` 表添加索引
  - 为 `graph_nodes` 表添加索引
  - 为 `edges` 表添加索引
  - 为 `study_cards` 表添加索引
  - 创建索引添加 SQL 脚本
- **Acceptance Criteria Addressed**: [AC-2]
- **Test Requirements**:
  - `human-judgement` TR-2.1: 索引脚本可正确执行
  - `human-judgement` TR-2.2: 查询分析显示性能提升
- **Notes**: 索引应添加到 Supabase 迁移文件中

## [x] Task 3: 修复 getGraphNodes 缓存
- **Priority**: P0
- **Depends On**: None
- **Description**: 
  - 修改 `getGraphNodes` 方法
  - 使用 cacheService 进行缓存
  - 正确处理缓存失效
- **Acceptance Criteria Addressed**: [AC-3]
- **Test Requirements**:
  - `programmatic` TR-3.1: 重复查询命中缓存
  - `programmatic` TR-3.2: TypeScript 编译无错误
- **Notes**: 参考其他使用缓存的方法

## [ ] Task 4: 优化 useStore 使用
- **Priority**: P0
- **Depends On**: None
- **Description**: 
  - 查找所有使用 `useStore` 的地方
  - 改用 select 函数只获取需要的状态
  - 减少不必要的组件重渲染
- **Acceptance Criteria Addressed**: [AC-4]
- **Test Requirements**:
  - `human-judgement` TR-4.1: 所有 useStore 调用使用 select 函数
  - `programmatic` TR-4.2: 应用运行正常
- **Notes**: 重点关注频繁重渲染的组件

## [ ] Task 5: 补充认证服务测试
- **Priority**: P1
- **Depends On**: None
- **Description**: 
  - 创建 `api/__tests__/services/auth/jwtService.test.ts`
  - 创建 `api/__tests__/services/auth/passwordService.test.ts`
  - 覆盖主要功能和边界情况
- **Acceptance Criteria Addressed**: [AC-5]
- **Test Requirements**:
  - `programmatic` TR-5.1: 测试文件能正常运行
  - `programmatic` TR-5.2: 测试覆盖率达到 80%+
- **Notes**: 参考现有测试文件的结构

## [ ] Task 6: 补充图服务核心测试
- **Priority**: P1
- **Depends On**: None
- **Description**: 
  - 创建 `api/__tests__/services/graph/graphService.test.ts`
  - 创建 `api/__tests__/services/graph/graphNodeService.test.ts`
  - 覆盖主要 CRUD 操作
- **Acceptance Criteria Addressed**: [AC-5]
- **Test Requirements**:
  - `programmatic` TR-6.1: 测试文件能正常运行
  - `programmatic` TR-6.2: 测试覆盖率达到 70%+
- **Notes**: 使用 mock Supabase 客户端

## [ ] Task 7: 清理调试日志
- **Priority**: P2
- **Depends On**: Task 1
- **Description**: 
  - 移除生产环境中的 console.log 调试日志
  - 保留必要的 warn/error/info 日志
  - 确保错误处理完整
- **Acceptance Criteria Addressed**: [AC-1]
- **Test Requirements**:
  - `programmatic` TR-7.1: lint 检查通过
  - `programmatic` TR-7.2: 生产构建无调试代码
- **Notes**: 重点关注 App.tsx 等核心文件

## [ ] Task 8: 替换部分 any 类型
- **Priority**: P2
- **Depends On**: Task 1
- **Description**: 
  - 替换 Task 接口中的 any 为 unknown
  - 为常用 payload 定义具体类型
  - 减少 any 使用数量
- **Acceptance Criteria Addressed**: [AC-1]
- **Test Requirements**:
  - `programmatic` TR-8.1: TypeScript 编译无错误
  - `programmatic` TR-8.2: @typescript-eslint/no-explicit-any 警告减少
- **Notes**: 优先替换高频使用的 any
