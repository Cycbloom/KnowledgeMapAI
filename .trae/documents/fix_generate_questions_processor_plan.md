# 修复 "No processor found for task type: generate_questions" 问题 - 实施计划

## 问题描述
从大纲视图批量生成题目时，出现错误："No processor found for task type: generate_questions"

## 根本原因
1. 后端路由 `api/routes/ai/cards.ts` 为每个节点创建 `generate_questions` 类型的任务
2. 新的任务处理器系统 `api/services/taskProcessors/` 中缺少该任务类型的处理器注册

## 解决方案
创建一个新的 `generate_questions` 任务处理器，处理单个节点的题目生成

## 任务分解

### [x] 任务 1: 创建 generateQuestionsProcessor.ts
- **Priority**: P0
- **Depends On**: None
- **Description**: 
  - 创建新的任务处理器文件 `api/services/taskProcessors/generateQuestionsProcessor.ts`
  - 实现处理单个节点生成题目的逻辑
  - 注册为 "generate_questions" 类型的处理器
- **Success Criteria**:
  - 成功创建处理器文件
  - 正确注册任务类型
- **Test Requirements**:
  - `programmatic` TR-1.1: 代码无类型错误 ✓
  - `human-judgement` TR-1.2: 代码结构与现有处理器一致 ✓

### [x] 任务 2: 在 taskService.ts 中导入新处理器
- **Priority**: P0
- **Depends On**: 任务 1
- **Description**: 在 `api/services/taskService.ts` 中导入新的处理器文件
- **Success Criteria**:
  - 成功导入新处理器
- **Test Requirements**:
  - `programmatic` TR-2.1: 代码能正确编译 ✓

### [x] 任务 3: 验证修复
- **Priority**: P0
- **Depends On**: 任务 2
- **Description**: 
  - 运行类型检查确保没有错误
  - 验证代码结构正确
- **Success Criteria**:
  - 所有类型检查通过
  - 任务处理器正确注册
- **Test Requirements**:
  - `programmatic` TR-3.1: npm run check:electron 成功通过 ✓
