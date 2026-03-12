# Checklist - 统一类型定义位置

## 目录结构创建

- [x] api/types/ 目录创建完成
- [x] api/types/ai.ts 文件创建完成
- [x] api/types/index.ts 文件创建完成

## 后端类型迁移

- [x] api/services/ai/types.ts 内容迁移到 api/types/ai.ts
- [x] api/services/ai/aiService.ts 导入路径更新
- [x] api/services/ai/factory.ts 导入路径更新
- [x] api/services/ai/embeddingService.ts 导入路径更新
- [x] api/services/ai/index.ts 导入路径更新
- [x] api/services/ai/types.ts 文件删除

## 前端类型迁移

- [x] src/types/calendar.ts 文件创建完成
- [x] src/types/api.ts 文件创建完成
- [x] src/types/index.ts 重导出更新完成
- [x] src/components/Calendar 组件导入路径更新
- [x] src/services/api 相关文件导入路径更新
- [x] src/components/Calendar/types.ts 文件删除
- [x] src/services/api/types.ts 文件删除

## 验证

- [x] 类型检查通过 (npm run check)
- [x] 代码检查通过 (npm run lint)
- [x] 所有类型导入正确
