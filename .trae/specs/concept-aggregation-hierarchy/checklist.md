# Checklist - 概念聚合与层级构建功能

## 数据库层
- [x] knowledge_points 表成功添加 aliases 字段（TEXT[] 类型）
- [x] 迁移文件可在本地和远程数据库正确执行
- [x] TypeScript 类型定义已更新包含 aliases 字段

## 后端服务层
- [x] ConceptAggregationService.identifyHierarchy() 方法实现并可用
- [x] ConceptAggregationService.batchMerge() 方法能正确合并概念组
- [x] 别名管理方法（addAliases/removeAlias）工作正常
- [x] 层级识别 AI 服务返回合理的结果格式
- [x] 聚合分析主流程（analyzeConcepts）完整执行无报错
- [x] 分批处理机制正常工作（大图谱场景）

## API 接口层
- [x] POST analyze 接口触发分析并返回 job ID
- [x] GET results 接口返回完整的分析结果结构（支持 SSE）
- [x] POST merge 接口正确执行合并操作
- [x] POST hierarchy 接口正确创建层级边
- [x] PUT aliases 接口能更新节点别名
- [x] 所有接口有正确的权限校验
- [x] 错误情况返回合适的 HTTP 状态码和错误信息

## 前端 UI 层
- [x] 聚合面板可从图谱编辑器工具栏打开
- [x] 聚合结果预览正确显示相似概念分组
- [x] 合并/忽略操作按钮功能正常
- [x] 层次树视图正确展示概念层级关系
- [x] 层次树支持展开/折叠交互
- [x] 图谱画布相似度标注 Hook 可用（useSimilarityAnnotation）
- [x] 相似概念高亮和虚线连接数据计算正确
- [x] 别名编辑 UI 可添加/删除别名
- [x] 合并时自动生成别名的确认提示显示

## 集成测试
- [ ] 完整聚合流程 E2E 测试通过：分析 → 预览 → 确认 → 执行
- [ ] 空图谱场景处理正确（提示无概念可分析）
- [ ] 单节点场景处理正确（提示概念数量不足）
- [ ] 大图谱（>500 节点）分批处理正常
- [ ] 合并操作事务安全（失败可回滚）
- [ ] 别名搜索功能正常（搜索别名能找到对应概念）

## 用户体验
- [x] 分析过程有进度指示（进度条 + 阶段提示）
- [ ] 预计耗时提示准确
- [x] 操作前有确认提示（MergeAliasConfirmation 组件）
- [x] 操作结果有明确的反馈消息
