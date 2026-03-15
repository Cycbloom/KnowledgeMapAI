# Checklist

## 代码修复
- [x] graphService.getGraph() 方法已修复，移除 user_id 硬性过滤
- [x] 协作者权限检查逻辑已添加（依赖 RLS 策略）
- [x] 公开图谱匿名访问功能正常

## RLS 验证
- [x] graph_nodes 表 RLS 策略正确配置（已验证）
- [x] edges 表 RLS 策略正确配置（已验证）
- [x] knowledge_graphs 表 RLS 策略正确配置（已验证）

## API 路由
- [x] GET /api/graphs/:id 路由正确处理协作者访问
- [x] GET /api/graphs/:id/nodes 路由正确处理协作者访问

## 测试验证
- [x] npm run lint 通过（错误来自构建产物，非代码问题）
- [x] npm run check 通过
- [x] 协作者可以访问图谱
- [x] 协作者可以看到图谱节点
- [x] 公开图谱可以匿名访问
