# Tasks

- [x] Task 1: 实现后端 Reset API 端点
  - [x] 在 `api/routes/data.ts` 中新增 `POST /data/reset` 路由
  - [x] 实现 dry-run 模式，统计用户各表数据量
  - [x] 按外键依赖顺序实现数据删除逻辑
  - [x] 支持按类型（graphs/tasks/study/all）选择性删除
  - [x] 添加确认参数校验和操作日志记录

- [x] Task 2: 实现控制台 reset 命令
  - [x] 在 `src/services/console/commands/data.ts` 中新增 reset 命令定义
  - [x] 实现 handleReset 处理函数
  - [x] 支持 --dry-run 预览模式
  - [x] 支持 --type 选择数据类型
  - [x] 支持 --confirm 确认执行（danger 级别）
  - [x] 格式化输出删除结果摘要

- [x] Task 3: 注册命令并导出
  - [x] 在 `src/services/console/commands/index.ts` 中导出 resetCommand
  - [x] 在 allCommands 数组中注册新命令

# Task Dependencies
- [Task 2] depends on [Task 1]
- [Task 3] depends on [Task 2]
