# Tasks

## Task 1: P2-17 i18n 迁移 GraphStyleSettings.tsx + TextToGraphModal.tsx

- [x] SubTask 1.1: 读取 `src/components/GraphEditor/shared/GraphStyleSettings.tsx` 识别硬编码中文
- [x] SubTask 1.2: 读取 `src/components/GraphEditor/modals/TextToGraphModal.tsx` 识别硬编码中文
- [x] SubTask 1.3: 设计 i18n key 命名空间（graphStyleSettings.* / textToGraph.*）
- [x] SubTask 1.4: 在 `src/i18n/locales/zh-CN.json` 添加中文键值
- [x] SubTask 1.5: 在 `src/i18n/locales/en-US.json` 添加英文翻译
- [x] SubTask 1.6: 修改两个组件，替换硬编码为 `t()` 调用
- [x] SubTask 1.7: 运行 `npm run check` 与 `npm run lint` 验证

## Task 2: P2-02 learningPaths.ts 路由拆分

- [x] SubTask 2.1: 读取 `api/routes/learningPaths.ts`（15356 字符）完整内容，分析路由分组
- [x] SubTask 2.2: 参照 `api/routes/graphs/` 与 `api/routes/ai/config/` 拆分模式
- [x] SubTask 2.3: 新建 `api/routes/learningPaths/` 目录及子文件（含 index.ts 聚合）
- [x] SubTask 2.4: 迁移路由处理器到对应子文件，保持路由路径与行为不变
- [x] SubTask 2.5: 删除原 `api/routes/learningPaths.ts`，更新引用（若有）
- [x] SubTask 2.6: 运行 `npm run check` 与 `npm run lint` 验证

## Task 3: P2-02 ai/content.ts 路由拆分

- [x] SubTask 3.1: 读取 `api/routes/ai/content.ts`（10436 字符）完整内容，分析路由分组
- [x] SubTask 3.2: 新建 `api/routes/ai/content/` 目录及子文件（含 index.ts 聚合）
- [x] SubTask 3.3: 迁移路由处理器到对应子文件，保持路由路径与行为不变
- [x] SubTask 3.4: 删除原 `api/routes/ai/content.ts`，更新引用（若有）
- [x] SubTask 3.5: 运行 `npm run check` 与 `npm run lint` 验证

# Task Dependencies

- Task 1, 2, 3 相互独立，可并行
- SubTask 1.4, 1.5 依赖 1.3
- SubTask 1.6 依赖 1.4, 1.5
- SubTask 1.7 依赖 1.6
- SubTask 2.3 依赖 2.1, 2.2
- SubTask 2.4 依赖 2.3
- SubTask 2.5 依赖 2.4
- SubTask 2.6 依赖 2.5
- SubTask 3.2 依赖 3.1
- SubTask 3.3 依赖 3.2
- SubTask 3.4 依赖 3.3
- SubTask 3.5 依赖 3.4
