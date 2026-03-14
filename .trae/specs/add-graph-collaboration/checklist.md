# Checklist

## 数据库层
- [x] graph_collaborators 表已创建，包含所有必需字段
- [x] collaborator_role 枚举类型已创建
- [x] 协作者表索引已创建
- [x] 协作者表 RLS 策略已配置
- [x] knowledge_graphs 表 RLS 策略已更新支持协作者访问
- [x] graph_nodes 表 RLS 策略已更新支持协作者访问
- [x] edges 表 RLS 策略已更新支持协作者访问

## 类型定义
- [x] CollaboratorRole 类型已添加到 shared/types/graph.ts
- [x] GraphCollaborator 接口已添加
- [x] 协作者相关 API 类型已添加

## 后端 API
- [x] collaboratorService.ts 服务已创建
- [x] 获取协作者列表 API 已实现
- [x] 邀请协作者 API 已实现
- [x] 更新协作者角色 API 已实现
- [x] 移除协作者 API 已实现
- [x] 接受邀请 API 已实现
- [x] 分享链接生成功能已实现
- [x] 通过分享链接加入功能已实现
- [x] graphService.ts 已更新支持协作图谱查询
- [x] 权限检查辅助函数已实现

## 前端
- [x] 协作者列表组件已创建
- [x] 邀请协作者对话框已创建
- [x] 分享链接组件已创建
- [x] ShareModal 已更新集成协作功能
- [x] 图谱页面已添加分享按钮
- [x] 图谱标题栏已显示协作者头像
- [x] 图谱列表已显示协作图谱

## 测试验证
- [x] 数据库重置成功，表结构正确
- [x] 测试用户已创建 (test@example.com / test123456)
- [x] npm run lint 通过
- [x] npm run check 通过
- [x] Playwright 测试通过 (4/4)

## Playwright 测试用例
- [x] 应该能够显示首页
- [x] 应该能够创建新图谱
- [x] 应该能够在图谱页面显示分享按钮
- [x] 应该能够打开分享对话框
