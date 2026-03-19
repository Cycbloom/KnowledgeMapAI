# 修复 API 请求路径问题 - 实施计划

## 问题描述
在 Electron 打包安装后，某些 API 请求（特别是流式请求）会使用错误的路径（如 `/D:/api/ai/chat`），这是因为这些请求直接使用 fetch API 且没有正确处理 Electron 生产环境的 API URL。

## 受影响的文件
1. `src/services/api/ai.ts` - `createStreamHandler` 和 `documentToGraph` 函数
2. `src/services/api/rag.ts` - `chatStream` 函数

## 根本原因
这些函数直接使用 `getApiUrl()` 函数，但该函数在 Electron 生产环境中没有正确返回完整的 API URL（应该是 `http://localhost:${port}/api`）。

---

## [x] 任务 1: 修复 client.ts 中的 getApiUrl 函数
- **Priority**: P0
- **Depends On**: None
- **Description**: 更新 `getApiUrl()` 函数，使其在 Electron 生产环境中正确返回完整的 API URL
- **Success Criteria**:
  - `getApiUrl()` 在 Electron 生产环境返回 `http://localhost:${port}/api`
  - 其他环境保持不变
- **Test Requirements**:
  - `programmatic` TR-1.1: 验证函数在不同环境下返回正确的 URL - ✅ 已完成
- **Notes**: 使用现有的 `getElectronApiUrl()` 函数

## [x] 任务 2: 验证修复后的代码
- **Priority**: P0
- **Depends On**: 任务 1
- **Description**: 检查所有受影响的文件，确保修复生效
- **Success Criteria**:
  - 所有流式请求在 Electron 打包后能正常工作
- **Test Requirements**:
  - `programmatic` TR-2.1: TypeScript 类型检查通过 - ✅ 已完成
  - `human-judgement` TR-2.2: 检查 LearningMode 中的聊天功能正常
  - `human-judgement` TR-2.3: 检查 RAGChat 中的聊天功能正常
  - `human-judgement` TR-2.4: 检查文档转图谱功能正常

---

## 总结
这个问题只需要修复 `getApiUrl()` 函数，因为所有受影响的函数都通过这个函数获取 API 基础路径。
