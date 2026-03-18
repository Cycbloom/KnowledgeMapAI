# 移动端 API 完善 - Verification Checklist

- [x] 所有 graph API 使用正确的表名 `knowledge_graphs`
- [x] `getNodeStatus` 方法返回真实数据而非假数据
- [x] `getLearningPath` 方法返回真实数据而非假数据
- [x] `mobileStudyApi.getCards` 从 Supabase 获取真实学习卡片
- [x] `mobileStudyApi.getCardsByKnowledgePoint` 正确筛选卡片
- [x] `mobileStudyApi.createCardsBatch` 批量创建成功
- [x] `mobileStudyApi.update` 正确更新卡片
- [x] `mobileStudyApi.delete` 正确删除卡片
- [x] `mobileStudyApi.deleteBatch` 批量删除成功
- [x] `mobileStudyApi.updateProgress` 更新进度正确
- [x] `mobileStudyApi.getCardGroups` 正常工作
- [x] `mobileDashboardApi.getStats` 返回真实统计数据
- [x] `mobileStatisticsApi.getStats` 返回真实学习统计
- [x] 所有 API 错误处理完整
- [x] 代码风格与现有移动端 API 一致
