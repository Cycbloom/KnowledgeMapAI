# Tasks

- [x] Task 1: 创建共享 AI 类型文件
  - [x] SubTask 1.1: 创建 `shared/types/ai.ts`，合并 AI 相关类型
  - [x] SubTask 1.2: 在 `shared/types/index.ts` 中添加导出

- [x] Task 2: 修复 API 层类型导入
  - [x] SubTask 2.1: 修改 `api/utils/nodeHelpers.ts` 从 `@shared/types` 导入
  - [x] SubTask 2.2: 更新所有从 `api/types/ai.ts` 导入的文件

- [x] Task 3: 更新前端类型导出
  - [x] SubTask 3.1: 更新 `src/types/index.ts`，从 shared 重新导出 AI 类型
  - [x] SubTask 3.2: 删除 `src/types/api.ts`（内容已迁移）

- [x] Task 4: 清理 API 类型目录
  - [x] SubTask 4.1: 删除 `api/types/ai.ts`
  - [x] SubTask 4.2: 删除 `api/types/index.ts`
  - [x] SubTask 4.3: 保留 `api/types/express.d.ts`（Express 类型扩展）

- [x] Task 5: 验证重构结果
  - [x] SubTask 5.1: 运行类型检查 `npm run check`
  - [x] SubTask 5.2: 运行代码检查 `npm run lint`
  - [x] SubTask 5.3: 运行测试确保功能正常

# Task Dependencies
- [Task 2] depends on [Task 1]
- [Task 3] depends on [Task 1]
- [Task 4] depends on [Task 2, Task 3]
- [Task 5] depends on [Task 4]
