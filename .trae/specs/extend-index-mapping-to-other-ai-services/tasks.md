# Tasks - 扩展索引映射到其他AI服务

## [ ] Task 1: 增强共享工具模块
- **Priority**: P0
- **Depends On**: None
- **Description**: 
  - 扩展 `shared/utils/indexMapping.ts` 支持更多实体类型
  - 添加通用的 `buildEntityIndexMap` 泛型函数
  - 添加 `resolveMultipleIds` 批量转换函数
  - 确保与现有函数保持向后兼容
- **Acceptance Criteria Addressed**: 共享工具扩展
- **Test Requirements**:
  - `programmatic` TR-1.1: 新增函数类型检查通过
  - `programmatic` TR-1.2: 现有代码调用新函数正常工作
  - `human-judgement` TR-1.3: 代码风格与现有代码保持一致
- **Notes**: 保持现有函数不变，仅新增功能

## [ ] Task 2: 扩展后端索引映射服务
- **Priority**: P0
- **Depends On**: Task 1
- **Description**: 
  - 扩展 `IndexMappingService` 支持更多实体类型
  - 添加 `buildTaskIndexMap` 方法
  - 添加 `buildLearningPathIndexMap` 方法
  - 添加对应的 resolve 方法
  - 扩展 `IndexContext` 接口
- **Acceptance Criteria Addressed**: 后端服务扩展
- **Test Requirements**:
  - `programmatic` TR-2.1: TypeScript 类型检查通过
  - `programmatic` TR-2.2: 新增方法正常工作
  - `programmatic` TR-2.3: 缓存机制正常工作
- **Notes**: 使用现有的缓存机制

## [ ] Task 3: 扩展中间件
- **Priority**: P0
- **Depends On**: Task 2
- **Description**: 
  - 扩展 `indexMappingMiddleware` 支持更多实体
  - 可选添加 `taskIndexMappingMiddleware` 中间件
  - 更新 Express Request 类型定义
  - 确保与现有中间件兼容
- **Acceptance Criteria Addressed**: 中间件扩展
- **Test Requirements**:
  - `programmatic` TR-3.1: 类型检查通过
  - `programmatic` TR-3.2: 中间件在请求中正常注入 context
  - `human-judgement` TR-3.3: 不影响现有路由功能
- **Notes**: 保持向后兼容性

## [ ] Task 4: 扩展前端索引映射服务
- **Priority**: P0
- **Depends On**: Task 1
- **Description**: 
  - 扩展 `src/services/indexMapping.ts` 支持更多实体
  - 添加 `buildTaskIndexMap` 方法
  - 添加 `buildLearningPathIndexMap` 方法
  - 添加对应的 resolve 方法
- **Acceptance Criteria Addressed**: 前端服务扩展
- **Test Requirements**:
  - `programmatic` TR-4.1: 类型检查通过
  - `programmatic` TR-4.2: 新增方法能正常调用
  - `human-judgement` TR-4.3: API 风格与现有方法保持一致
- **Notes**: 保持现有 API 不变

## [ ] Task 5: 重构 AIActionService
- **Priority**: P1
- **Depends On**: Task 2
- **Description**: 
  - 在 `aiActionService.ts` 中添加索引映射支持
  - 支持索引输入自动转换
  - 输出结果包含索引映射
  - 可选添加 `summarize` 参数支持
- **Acceptance Criteria Addressed**: AIActionService 重构
- **Test Requirements**:
  - `programmatic` TR-5.1: 类型检查通过
  - `programmatic` TR-5.2: 接受索引输入并正确转换
  - `programmatic` TR-5.3: 输出结果包含索引映射（如果需要）
  - `programmatic` TR-5.4: 现有功能不受影响
- **Notes**: 保持向后兼容，索引支持是可选的

## [ ] Task 6: 重构 RAGService
- **Priority**: P1
- **Depends On**: Task 2
- **Description**: 
  - 在 `ragService.ts` 中添加索引映射支持
  - 输出结果添加索引版本
  - 搜索结果使用索引引用图谱
  - 可选添加 `summarize` 参数
- **Acceptance Criteria Addressed**: RAGService 重构
- **Test Requirements**:
  - `programmatic` TR-6.1: 类型检查通过
  - `programmatic` TR-6.2: 输出结果包含索引映射
  - `programmatic` TR-6.3: 现有功能正常工作
- **Notes**: 保持现有输出格式，新增索引字段

## [ ] Task 7: 重构 AutoGraphService
- **Priority**: P1
- **Depends On**: Task 2
- **Description**: 
  - 在 `autoGraphService.ts` 中添加索引映射支持
  - 返回结果包含节点索引映射
  - 支持 `summarize` 参数
  - 处理临时ID与最终ID的映射
- **Acceptance Criteria Addressed**: AutoGraphService 重构
- **Test Requirements**:
  - `programmatic` TR-7.1: 类型检查通过
  - `programmatic` TR-7.2: 返回结果包含索引映射
  - `programmatic` TR-7.3: 现有功能正常工作
- **Notes**: 索引映射是可选的

## [ ] Task 8: 重构 RelationDiscoveryService
- **Priority**: P1
- **Depends On**: Task 2
- **Description**: 
  - 在 `relationDiscoveryService.ts` 中添加索引映射支持
  - 输出结果使用索引引用图谱
  - 添加 `summarize` 参数支持
  - 返回图谱索引映射表（用于标题显示）
- **Acceptance Criteria Addressed**: RelationDiscoveryService 重构
- **Test Requirements**:
  - `programmatic` TR-8.1: 类型检查通过
  - `programmatic` TR-8.2: 输出结果使用索引
  - `programmatic` TR-8.3: 现有功能正常工作
- **Notes**: 保持向后兼容

## [ ] Task 9: 类型检查与验证
- **Priority**: P0
- **Depends On**: Tasks 1-8
- **Description**: 
  - 运行 `npm run check` 确保类型正确
  - 运行 `npm run lint` 确保代码风格
  - 修复所有类型错误和 lint 警告
- **Acceptance Criteria Addressed**: 代码质量
- **Test Requirements**:
  - `programmatic` TR-9.1: TypeScript 类型检查无错误
  - `programmatic` TR-9.2: ESLint 检查无错误
  - `programmatic` TR-9.3: 无类型错误和 lint 警告
- **Notes**: 必须通过所有检查才能完成

## [ ] Task 10: 功能验证
- **Priority**: P0
- **Depends On**: Task 9
- **Description**: 
  - 验证 AIActionService 索引转换正确
  - 验证 RAGService 输出正确
  - 验证 AutoGraphService 返回正确
  - 验证 RelationDiscoveryService 输出正确
  - 确保所有功能正常工作
- **Acceptance Criteria Addressed**: 功能验证
- **Test Requirements**:
  - `programmatic` TR-10.1: AIActionService 测试通过
  - `programmatic` TR-10.2: RAGService 测试通过
  - `programmatic` TR-10.3: AutoGraphService 测试通过
  - `programmatic` TR-10.4: RelationDiscoveryService 测试通过
  - `human-judgement` TR-10.5: 手动测试主要功能
- **Notes**: 优先运行现有测试

---

# Task Dependencies

- Task 1 是基础，其他任务依赖它
- Task 2 依赖 Task 1
- Task 3 依赖 Task 2
- Task 4 依赖 Task 1
- Tasks 5, 6, 7, 8 都依赖 Task 2
- Task 9 依赖 Tasks 1-8
- Task 10 依赖 Task 9

# Parallelizable Work

以下任务可以并行执行：
- Task 3 和 Task 4 可以并行（分别处理后端中间件和前端服务）
- Tasks 5, 6, 7, 8 可以并行（重构不同的服务）

# 实施建议

建议按以下顺序实施：
1. **Phase 1-4**: 首先完成基础设施（Tasks 1-4）
2. **Phase 5-8**: 然后重构各个 AI 服务（Tasks 5-8）
3. **Phase 9-10**: 最后验证和测试（Tasks 9-10）
