# Checklist

## 服务层架构

- [ ] knowledgePointService.ts 创建成功，包含所有知识点操作方法
- [ ] graphNodeService.ts 创建成功，包含所有图谱节点操作方法
- [ ] edgeService.ts 创建成功，包含所有边操作方法
- [ ] studyService.ts 创建成功，包含所有学习卡片操作方法
- [ ] 所有服务层方法返回类型化的结果

## 知识点服务层

- [ ] create() 方法正确创建知识点并生成 embedding
- [ ] get() 方法正确获取知识点
- [ ] update() 方法正确更新知识点内容
- [ ] delete() 方法正确硬删除知识点
- [ ] searchSimilar() 方法正确执行语义相似度搜索
- [ ] listAccessible() 方法正确过滤可见性

## 图谱节点服务层

- [ ] addToGraph() 方法正确创建 graph_nodes 关联
- [ ] removeFromGraph() 方法正确软删除关联和相关边
- [ ] updatePosition() 方法正确更新位置
- [ ] batchUpdatePositions() 方法正确批量更新位置
- [ ] getGraphNodes() 方法正确获取图谱节点（包含知识点详情）

## 边服务层

- [ ] create() 方法使用 source_knowledge_point_id 和 target_knowledge_point_id
- [ ] create() 方法验证两个知识点在同一图谱中
- [ ] delete() 方法正确软删除边

## 学习服务层

- [ ] getCards() 方法使用 knowledge_point_id 查询
- [ ] createCard() 方法正确关联 knowledge_point_id 和 source_graph_id
- [ ] updateProgress() 方法正确更新 FSRS 状态

## 路由层重构

- [ ] nodes.ts 路由调用服务层方法，无直接数据库操作
- [ ] study.ts 路由调用服务层方法，无直接数据库操作
- [ ] 路由层仅处理请求解析和响应格式化

## 前端 API 适配

- [ ] nodes.ts API 客户端使用新字段名
- [ ] study.ts API 客户端使用新字段名
- [ ] useGraphNodeOperations hook 适配新 API
- [ ] useQueries.ts 使用新字段名过滤边

## Schema 验证

- [ ] createEdgeSchema 使用 source_knowledge_point_id 和 target_knowledge_point_id
- [ ] createCardSchema 使用 knowledge_point_id

## 功能验证

- [ ] 创建节点流程正常（创建知识点 + 添加到图谱）
- [ ] 创建边流程正常（使用新字段名）
- [ ] 学习卡片正确关联知识点
- [ ] 知识点复用功能正常
- [ ] 软删除和硬删除功能正常
