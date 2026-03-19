# 修复题目类型筛选问题 - 实现计划

## [x] 任务 1: 在 aiService.ts 的 generateCards 函数中添加类型过滤逻辑
- **Priority**: P0
- **Depends On**: 无
- **Description**: 
  - 在 parseAIResponse 解析完 AI 返回结果后，添加类型过滤逻辑
  - 只保留 types 数组中指定类型的卡片
  - 记录过滤前后的卡片数量对比
- **Acceptance Criteria Addressed**: AC-1, AC-4
- **Test Requirements**:
  - `programmatic` TR-1.1: 验证过滤后的卡片类型都在请求类型列表中
  - `programmatic` TR-1.2: 验证过滤前后的数量日志被正确记录
- **Notes**: 在 aiService.ts:452 附近添加过滤代码

## [x] 任务 2: 增强系统提示词，明确类型约束
- **Priority**: P0
- **Depends On**: 无
- **Description**: 
  - 在系统提示词中明确要求 AI 只生成指定类型的卡片
  - 如果是单次请求单个类型，在提示词中强调该类型
  - 确保 allowedTypes 参数在使用默认提示词时也正确传递
- **Acceptance Criteria Addressed**: AC-2
- **Test Requirements**:
  - `programmatic` TR-2.1: 验证系统提示词包含明确的类型约束
  - `programmatic` TR-2.2: 验证 allowedTypes 参数正确传递
- **Notes**: 在 aiService.ts:390-418 区域修改

## [x] 任务 3: 在 mock.ts 中也添加类型过滤
- **Priority**: P1
- **Depends On**: 无
- **Description**: 
  - 确保 getMockCards 函数也只返回请求类型的卡片
  - 保持与真实 AI 逻辑一致的行为
- **Acceptance Criteria Addressed**: AC-1
- **Test Requirements**:
  - `programmatic` TR-3.1: 验证 mock 数据也被正确过滤
- **Notes**: 在 api/services/ai/mock.ts 中 (该文件已经有正确的过滤逻辑)

## [x] 任务 4: 运行类型检查和代码检查
- **Priority**: P1
- **Depends On**: 任务 1, 任务 2, 任务 3
- **Description**: 
  - 运行 npm run check 确保没有类型错误
  - 运行 npm run lint 确保代码风格正确
- **Acceptance Criteria Addressed**: AC-1, AC-2, AC-3
- **Test Requirements**:
  - `programmatic` TR-4.1: 类型检查通过 (已完成)
  - `programmatic` TR-4.2: 代码检查通过 (存在预先存在的错误，与本次修改无关)
