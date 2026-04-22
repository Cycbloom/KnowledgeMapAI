# 验收检查清单

## 数据库结构

- [x] `system_tasks` 表已创建，包含所有必要字段
- [x] `system_tasks` 表有正确的索引
- [x] `system_tasks` 表有正确的 RLS 策略
- [x] `scheduled_tasks` 表添加了 `source` 字段

## 类型定义

- [x] `SystemTask` 类型已定义
- [x] `SystemTaskType` 枚举已定义
- [x] `SystemTaskStatus` 类型已定义
- [x] `ScheduledTask` 类型包含 `source` 字段

## 后端服务

- [x] `SystemTaskService` 已创建并实现所有方法
- [x] `autoTaskGenerator` 正确使用新表结构
- [x] `smartTaskLinker` 正确使用新表结构

## API

- [x] 系统任务 API 端点已创建
- [x] 前端 API 服务已更新

## 前端组件

- [x] 队列视图仅显示用户任务
- [x] 看板视图仅显示用户任务
- [x] 时间轴视图仅显示用户任务
- [x] 列表视图仅显示用户任务

## 功能验证

- [x] 用户创建的任务存储在 `scheduled_tasks` 表
- [x] 系统后台任务存储在 `system_tasks` 表
- [x] 学习/复习推荐任务正确标记 `source`
- [x] 任务列表不显示系统后台任务
