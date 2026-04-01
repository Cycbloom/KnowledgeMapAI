# Checklist

## Phase 1: 共享工具模块

- [x] `shared/utils/indexMapping.ts` 文件已创建
- [x] `isIndexValue` 函数正确判断索引值
- [x] `resolveId` 函数正确转换索引到UUID
- [x] `buildIndexMap` 函数正确构建映射表
- [x] `buildIndexMapFromTitles` 函数正确构建标题映射

## Phase 2: 后端索引映射服务

- [x] `api/services/indexMapping/` 目录已创建
- [x] `IndexMappingService` 单例模式实现正确
- [x] `buildGraphIndexMap` 方法正确构建图谱索引映射
- [x] `buildNodeIndexMap` 方法正确构建节点索引映射
- [x] 缓存机制正常工作
- [x] `resolveGraphId` 方法正确转换图谱索引
- [x] `resolveNodeId` 方法正确转换节点索引
- [x] `clearCache` 方法正确清除缓存

## Phase 3: 索引转换中间件

- [x] `api/middleware/indexMapping.ts` 文件已创建
- [x] 中间件正确注入索引上下文
- [x] Express Request 类型已扩展
- [x] 中间件在Agent路由中正确应用

## Phase 4: 工具重构

### graphTools.ts
- [x] 重复的 `isIndexValue` 函数已移除
- [x] 重复的 `resolveGraphId` 函数已移除
- [x] 共享工具函数已导入
- [x] 所有工具正确使用共享函数

### analysisTools.ts
- [x] 重复函数已移除
- [x] 共享工具函数已导入
- [x] 所有工具正确使用共享函数

### learningTools.ts
- [x] 重复函数已移除
- [x] 共享工具函数已导入
- [x] 所有工具正确使用共享函数

### nodeTools.ts
- [x] 确认无需重构（不涉及图谱ID转换）
- [x] 代码结构保持不变

## Phase 5: 前端索引映射服务

- [x] `src/services/indexMapping.ts` 文件已创建
- [x] `buildGraphIndexMap` 方法正确构建映射表
- [x] `resolveGraphId` 方法正确转换索引
- [x] `buildIndexMapFromData` 方法正确构建映射

## Phase 6: API路由更新

- [x] AgentService 已更新构建 graphIndexMap
- [x] `/recommendations/apply` 使用共享工具转换
- [x] 手动转换代码已移除

## Phase 7: 验证与测试

### 代码质量
- [x] TypeScript 类型检查通过
- [x] ESLint 检查通过（新增代码无错误）
- [x] 无类型错误
- [x] 无新增lint警告

### 功能验证
- [x] Agent工具正常工作
- [x] 索引转换正确
- [x] 缓存机制有效
- [x] 前后端转换一致

## 架构验证

### 代码复用
- [x] 无重复的索引转换代码
- [x] 所有转换逻辑集中在共享模块

### 一致性
- [x] 前后端使用相同的转换逻辑
- [x] 所有工具使用相同的转换函数

### 可维护性
- [x] 修改转换逻辑只需修改一处
- [x] 代码结构清晰易懂
