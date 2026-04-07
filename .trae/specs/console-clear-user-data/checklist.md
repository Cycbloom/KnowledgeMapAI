## 后端 API
- [x] `POST /data/reset` 端点正确响应 dry_run=true 请求并返回统计信息
- [x] `POST /data/reset` 端点在 confirm=true 时正确执行数据删除
- [x] 删除顺序符合外键依赖关系，不会因约束冲突报错
- [x] 仅删除当前认证用户的数据，不影响其他用户
- [x] API 返回格式化的删除结果摘要

## 控制台命令
- [x] `reset` 命令不带参数时显示使用说明和安全警告
- [x] `reset --dry-run` 正确显示各表数据统计预览
- [x] `reset --type graphs --dry-run` 仅显示图谱相关表统计
- [x] `reset --confirm` 触发 danger 级别的二次确认流程
- [x] 执行成功后输出清晰的删除结果摘要（包含删除条数）
- [x] 命令帮助（help reset）显示完整的使用说明

## 命令注册
- [x] resetCommand 已在 commands/index.ts 导出
- [x] resetCommand 已加入 allCommands 数组
- [x] 控制台自动补全可以找到 reset 命令
