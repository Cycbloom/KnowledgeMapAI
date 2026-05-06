# Tasks

## Phase 1: 类型定义扩展

- [x] Task 1: 扩展 LiteratureInfo 类型
  - [x] SubTask 1.1: 在 `shared/types/graph.ts` 添加新字段（journal, doi, keywords, abstract, volume, issue, pages, publisher, notes）
  - [x] SubTask 1.2: 扩展 LiteratureType 类型，添加 "report" 和 "webpage"
  - [x] SubTask 1.3: 扩展 ReferenceBook 类型，添加新字段

## Phase 2: 后端服务开发

- [x] Task 2: 创建文献元数据提取服务
  - [x] SubTask 2.1: 创建 `api/services/ai/literatureMetadataService.ts`
  - [x] SubTask 2.2: 实现从文本内容提取元数据的 prompt 模板
  - [x] SubTask 2.3: 实现文献类型自动识别逻辑
  - [x] SubTask 2.4: 实现从 URL 提取元数据（结合 scraper 和 AI）
  - [x] SubTask 2.5: 实现从 PDF 提取元数据
  - [x] SubTask 2.6: 添加到 promptService 的 OUTPUT_SCHEMAS

- [x] Task 3: 增强 API 路由
  - [x] SubTask 3.1: 在 `api/routes/literature.ts` 添加 POST /api/literature/metadata 接口
  - [x] SubTask 3.2: 增强 POST /api/literature/extract 接口，支持传入来源信息
  - [x] SubTask 3.3: 增强 POST /api/literature/apply 接口，保存来源到图谱参考资料
  - [x] SubTask 3.4: 添加请求验证 schema

## Phase 3: 前端组件开发

- [x] Task 4: 创建来源信息表单组件
  - [x] SubTask 4.1: 创建 `src/components/LiteratureExtract/LiteratureMetadataForm.tsx`
  - [x] SubTask 4.2: 实现可折叠的来源信息区域
  - [x] SubTask 4.3: 实现各字段输入控件
  - [x] SubTask 4.4: 实现"自动识别"按钮和加载状态
  - [x] SubTask 4.5: 实现识别结果预览和编辑功能

- [x] Task 5: 创建来源信息卡片组件
  - [x] SubTask 5.1: 创建 `src/components/LiteratureExtract/LiteratureMetadataCard.tsx`
  - [x] SubTask 5.2: 显示文献类型图标
  - [x] SubTask 5.3: 显示完整元数据信息
  - [x] SubTask 5.4: 实现编辑/删除操作

- [x] Task 6: 增强 LiteratureExtractPanel 组件
  - [x] SubTask 6.1: 集成 LiteratureMetadataForm 组件
  - [x] SubTask 6.2: 添加来源信息状态管理
  - [x] SubTask 6.3: 实现"自动识别元数据"功能调用
  - [x] SubTask 6.4: 在提取结果中显示来源信息卡片
  - [x] SubTask 6.5: 将来源信息传递给后端 API

## Phase 4: 前端服务与集成

- [x] Task 7: 增强前端 API 服务
  - [x] SubTask 7.1: 在 `src/services/api/literature.ts` 添加 extractMetadata 方法
  - [x] SubTask 7.2: 增强 extractConcepts 方法，支持传入来源信息

- [x] Task 8: 国际化支持
  - [x] SubTask 8.1: 在 `zh-CN.json` 添加来源信息相关翻译
  - [x] SubTask 8.2: 在 `en-US.json` 添加来源信息相关翻译

## Phase 5: 测试与验证

- [ ] Task 9: 编写测试
  - [ ] SubTask 9.1: 测试元数据自动识别功能
  - [ ] SubTask 9.2: 测试来源信息保存到图谱
  - [ ] SubTask 9.3: 测试各文献类型的识别准确性

# Task Dependencies

- Task 1 需要先完成（类型定义）
- Task 2 和 Task 4 可以并行（后端服务和前端组件）
- Task 3 依赖 Task 2（API 路由依赖服务）
- Task 6 依赖 Task 4 和 Task 5（面板集成依赖子组件）
- Task 7 依赖 Task 3（前端服务依赖 API）
- Task 8 可以与 Task 4-7 并行
- Task 9 依赖所有功能完成
