# Tasks

## Phase 1: 骨干网络生成（初始化阶段）

- [x] Task 1: 创建骨干网络生成服务
  - [x] SubTask 1.1: 创建 `api/services/ai/backboneNetworkService.ts`
  - [x] SubTask 1.2: 设计骨干网络结构模板（研究背景、文献综述、研究方法等）
  - [x] SubTask 1.3: 实现 AI 生成骨干网络的 prompt 模板
  - [x] SubTask 1.4: 实现节点粒度控制（只生成 root/core 级别）
  - [x] SubTask 1.5: 编写单元测试

- [x] Task 2: 增强专题调研模板初始化
  - [x] SubTask 2.1: 修改 `template_type_topic_research` prompt
  - [x] SubTask 2.2: 集成骨干网络生成逻辑
  - [x] SubTask 2.3: 添加"待完善"状态显示
  - [x] SubTask 2.4: 测试初始化流程

## Phase 2: 后端服务开发（文献概念提取）

- [x] Task 3: 创建概念提取服务
  - [x] SubTask 3.1: 创建 `api/services/ai/conceptExtractorService.ts`
  - [x] SubTask 3.2: 实现文本内容解析逻辑
  - [x] SubTask 3.3: 实现 AI 概念提取 prompt 模板
  - [x] SubTask 3.4: 实现概念分类逻辑（方法、机制、操作等）
  - [x] SubTask 3.5: 实现智能定位到骨干模块的逻辑
  - [x] SubTask 3.6: 编写单元测试

- [x] Task 4: 创建相似度检测与聚合服务
  - [x] SubTask 4.1: 创建 `api/services/graph/conceptAggregationService.ts`
  - [x] SubTask 4.2: 实现基于 embedding 的相似度检测
  - [x] SubTask 4.3: 实现概念聚合逻辑（提升节点等级）
  - [x] SubTask 4.4: 实现来源文献合并逻辑
  - [x] SubTask 4.5: 编写单元测试

- [x] Task 5: 创建文献处理 API 路由
  - [x] SubTask 5.1: 创建 `api/routes/literature.ts`
  - [x] SubTask 5.2: 实现 POST /api/literature/extract 接口
  - [x] SubTask 5.3: 实现 POST /api/literature/apply 接口
  - [x] SubTask 5.4: 添加请求验证 schema
  - [x] SubTask 5.5: 集成性能监控

## Phase 3: 类型定义扩展

- [x] Task 6: 扩展类型定义
  - [x] SubTask 6.1: 在 `shared/types/graph.ts` 添加 ConceptType 类型
  - [x] SubTask 6.2: 添加 BackboneModule 类型（研究背景、文献综述等）
  - [x] SubTask 6.3: 添加 SourceInfo 接口定义
  - [x] SubTask 6.4: 扩展 NodeProperties 接口
  - [x] SubTask 6.5: 添加 LiteratureInfo 接口
  - [x] SubTask 6.6: 添加 API 请求/响应类型定义

## Phase 4: 前端组件开发

- [x] Task 7: 创建文献输入面板组件
  - [x] SubTask 7.1: 创建 `src/components/LiteratureExtract/LiteratureExtractPanel.tsx`
  - [x] SubTask 7.2: 实现输入方式选择器（文本/文件/URL）
  - [x] SubTask 7.3: 实现文本输入区域
  - [x] SubTask 7.4: 实现文件上传组件
  - [x] SubTask 7.5: 实现 URL 输入与抓取
  - [x] SubTask 7.6: 添加处理进度指示器

- [x] Task 8: 创建概念预览组件
  - [x] SubTask 8.1: 创建 `src/components/LiteratureExtract/ConceptPreviewList.tsx`
  - [x] SubTask 8.2: 实现概念卡片组件
  - [x] SubTask 8.3: 实现相似度提示显示
  - [x] SubTask 8.4: 显示概念将添加到的骨干模块
  - [x] SubTask 8.5: 实现概念选择/编辑功能
  - [x] SubTask 8.6: 实现确认/取消操作

- [x] Task 9: 创建概念类型徽章组件
  - [x] SubTask 9.1: 创建 `src/components/LiteratureExtract/ConceptTypeBadge.tsx`
  - [x] SubTask 9.2: 定义各类型的颜色和图标
  - [x] SubTask 9.3: 添加国际化支持

- [x] Task 10: 创建骨干模块状态组件
  - [x] SubTask 10.1: 创建 `src/components/LiteratureExtract/BackboneModuleStatus.tsx`
  - [x] SubTask 10.2: 显示模块"待完善"/"已完善"状态
  - [x] SubTask 10.3: 显示模块下的概念数量

## Phase 5: 前端服务与集成

- [x] Task 11: 创建前端 API 服务
  - [x] SubTask 11.1: 创建 `src/services/api/literature.ts`
  - [x] SubTask 11.2: 实现 extractConcepts 方法
  - [x] SubTask 11.3: 实现 applyConcepts 方法
  - [x] SubTask 11.4: 添加到 API index 导出

- [x] Task 12: 集成到图谱编辑器
  - [x] SubTask 12.1: 在 GraphEditor 工具栏添加入口按钮
  - [x] SubTask 12.2: 实现面板显示/隐藏逻辑
  - [x] SubTask 12.3: 实现提取结果添加到图谱逻辑
  - [x] SubTask 12.4: 实现节点来源信息显示
  - [x] SubTask 12.5: 实现来源数量徽章显示
  - [x] SubTask 12.6: 实现骨干模块状态显示

## Phase 6: 数据库与 Prompt

- [x] Task 13: 添加 Prompt 模板
  - [x] SubTask 13.1: 在数据库添加 `backbone_network_generation` prompt
  - [x] SubTask 13.2: 在数据库添加 `literature_concept_extraction` prompt
  - [x] SubTask 13.3: 在数据库添加 `literature_relation_inference` prompt
  - [x] SubTask 13.4: 更新 PromptSettingsPanel 支持新 prompt

- [x] Task 14: 国际化支持
  - [x] SubTask 14.1: 添加中文翻译 `zh-CN.json`
  - [x] SubTask 14.2: 添加英文翻译 `en-US.json`

## Phase 7: 测试与文档

- [x] Task 15: 编写 E2E 测试
  - [x] SubTask 15.1: 测试骨干网络生成流程
  - [x] SubTask 15.2: 测试文本输入提取流程
  - [x] SubTask 15.3: 测试文件上传提取流程
  - [x] SubTask 15.4: 测试 URL 抓取提取流程
  - [x] SubTask 15.5: 测试概念聚合逻辑
  - [x] SubTask 15.6: 测试预览确认流程
  - [x] SubTask 15.7: 测试概念定位到骨干模块

# Task Dependencies

- Task 1-2 可以并行（骨干网络生成）
- Task 6 依赖 Task 3-5（类型定义需要先完成）
- Task 7-10 依赖 Task 6（前端组件需要类型定义）
- Task 11 依赖 Task 5（前端服务需要 API 接口）
- Task 12 依赖 Task 7-11（集成需要所有组件就绪）
- Task 13 可以与 Task 1-5 并行
- Task 14 可以与 Task 7-10 并行
- Task 15 依赖所有功能完成
