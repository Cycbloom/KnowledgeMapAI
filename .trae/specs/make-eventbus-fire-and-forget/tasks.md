# Tasks

- [x] Task 1: 修改 eventBus.ts 的 publish 方法为 fire-and-forget
  - [x] SubTask 1.1: 返回类型从 `Promise<void>` 改为 `void`
  - [x] SubTask 1.2: 处理器通过 `Promise.resolve().then()` 异步执行，不 await
  - [x] SubTask 1.3: 处理器错误仍被捕获并记录日志

- [x] Task 2: 移除所有调用点的 await 和 .catch()
  - [x] SubTask 2.1: graphService.ts 中 22 处 `await appEventBus.publish` → `appEventBus.publish`
  - [x] SubTask 2.2: graphVersionService.ts 中 1 处
  - [x] SubTask 2.3: cronService.ts 中 2 处
  - [x] SubTask 2.4: stateMachine.ts 中 1 处
  - [x] SubTask 2.5: subtaskKnowledgeSync.ts 中 2 处
  - [x] SubTask 2.6: spacedRepetitionBridge.ts 中 1 处
  - [x] SubTask 2.7: taskProcessor.ts 中 2 处
  - [x] SubTask 2.8: autoGraph.ts 中 1 处（含 .catch() 移除）
  - [x] SubTask 2.9: nodesService.ts 中 2 处（含 .catch() 移除）
  - [x] SubTask 2.10: studyService.ts 中 1 处（含 .catch() 移除）

- [x] Task 3: 类型检查验证
  - [x] SubTask 3.1: `npx tsc --noEmit` 零错误通过

# Task Dependencies
- [Task 2] depends on [Task 1]
- [Task 3] depends on [Task 2]
