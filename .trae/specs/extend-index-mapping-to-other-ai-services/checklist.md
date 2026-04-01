# Checklist - 扩展索引映射到其他AI服务

## Phase 1: 增强共享工具模块

- [ ] `shared/utils/indexMapping.ts` 已增强
- [ ] `buildEntityIndexMap` 泛型函数已添加
- [ ] `resolveMultipleIds` 批量转换函数已添加
- [ ] 现有函数保持向后兼容
- [ ] TypeScript 类型检查通过
- [ ] 代码风格与现有代码一致

## Phase 2: 扩展后端索引映射服务

- [ ] `IndexMappingService` 已扩展
- [ ] `buildTaskIndexMap` 方法已添加
- [ ] `buildLearningPathIndexMap` 方法已添加
- [ ] 对应的 resolve 方法已添加
- [ ] `IndexContext` 接口已扩展
- [ ] 缓存机制正常工作
- [ ] TypeScript 类型检查通过

## Phase 3: 扩展中间件

- [ ] `indexMappingMiddleware` 已扩展（或新增专门的中间件）
- [ ] Express Request 类型已更新
- [ ] 中间件在请求中正常注入 context
- [ ] 不影响现有路由功能
- [ ] 向后兼容性保持

## Phase 4: 扩展前端索引映射服务

- [ ] `src/services/indexMapping.ts` 已扩展
- [ ] `buildTaskIndexMap` 方法已添加
- [ ] `buildLearningPathIndexMap` 方法已添加
- [ ] 对应的 resolve 方法已添加
- [ ] API 风格与现有方法保持一致
- [ ] 现有 API 保持不变

## Phase 5: 重构 AIActionService

- [ ] `aiActionService.ts` 已添加索引映射支持
- [ ] 支持索引输入自动转换
- [ ] 输出结果包含索引映射（如需要）
- [ ] 可选添加 `summarize` 参数支持
- [ ] 现有功能不受影响
- [ ] TypeScript 类型检查通过
- [ ] 向后兼容性保持

## Phase 6: 重构 RAGService

- [ ] `ragService.ts` 已添加索引映射支持
- [ ] 输出结果添加索引版本
- [ ] 搜索结果使用索引引用图谱
- [ ] 可选添加 `summarize` 参数
- [ ] 保持现有输出格式，新增索引字段
- [ ] TypeScript 类型检查通过
- [ ] 现有功能正常工作

## Phase 7: 重构 AutoGraphService

- [ ] `autoGraphService.ts` 已添加索引映射支持
- [ ] 返回结果包含节点索引映射
- [ ] 支持 `summarize` 参数
- [ ] 处理临时ID与最终ID的映射
- [ ] 索引映射是可选的
- [ ] TypeScript 类型检查通过
- [ ] 现有功能正常工作

## Phase 8: 重构 RelationDiscoveryService

- [ ] `relationDiscoveryService.ts` 已添加索引映射支持
- [ ] 输出结果使用索引引用图谱
- [ ] 添加 `summarize` 参数支持
- [ ] 返回图谱索引映射表（用于标题显示）
- [ ] 保持向后兼容
- [ ] TypeScript 类型检查通过
- [ ] 现有功能正常工作

## Phase 9: 类型检查与验证

- [ ] `npm run check` 无错误
- [ ] `npm run lint` 无错误
- [ ] 所有类型错误已修复
- [ ] 所有 lint 警告已修复
- [ ] 新增代码符合项目代码规范

## Phase 10: 功能验证

### 单元测试
- [ ] AIActionService 测试通过
- [ ] RAGService 测试通过
- [ ] AutoGraphService 测试通过
- [ ] RelationDiscoveryService 测试通过
- [ ] 新增功能有对应的测试覆盖

### 集成测试
- [ ] 索引输入能正确转换
- [ ] 输出结果包含正确的索引映射
- [ ] 现有功能不受影响
- [ ] 前后端转换一致

### 手动测试
- [ ] AIActionService 主要功能正常
- [ ] RAGService 主要功能正常
- [ ] AutoGraphService 主要功能正常
- [ ] RelationDiscoveryService 主要功能正常
- [ ] UI 交互正常

## 架构验证

### 代码复用
- [ ] 无重复的索引转换代码
- [ ] 所有转换逻辑集中在共享模块
- [ ] 各服务使用统一的转换机制

### 一致性
- [ ] 前后端使用相同的转换逻辑
- [ ] 所有服务使用相同的转换函数
- [ ] 索引映射行为一致

### 可维护性
- [ ] 修改转换逻辑只需修改一处
- [ ] 代码结构清晰易懂
- [ ] 新增实体类型易于扩展

### 性能
- [ ] 缓存机制正常工作
- [ ] 无不必要的重复计算
- [ ] 响应时间可接受
