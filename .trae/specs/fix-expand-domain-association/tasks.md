# Tasks

- [x] Task 1: 修复 DomainGraphGenerator.tsx 中 handleBatchCreate 的领域参数传递逻辑
  - [x] 定位到 `handleBatchCreate` 函数（约第 254 行）
  - [x] 将 `onBatchCreate` 调用中的第三个参数从固定的 `domain.trim()` 改为根据当前模式动态选择：`mode === 'expand' ? expandDomain.trim() : domain.trim()`
  - [x] 确保当对应变量为空时传递 `undefined` 而非空字符串
- [x] Task 2: 验证修复效果
  - [x] 运行类型检查 `npm run check` 确保无类型错误（已有错误在 graph.ts:144，与本次修改无关）
  - [x] 运行 lint 检查 `npm run lint` 确保代码规范（通过）

# Task Dependencies
- [Task 2] depends on [Task 1]
