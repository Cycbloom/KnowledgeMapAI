# Checklist

## 核心功能

- [x] recursiveGraphProcessor.ts 在创建节点前检查图谱中是否已存在同名节点
- [x] recursiveGraphProcessor.ts 跳过重复节点并记录日志
- [x] utils.ts 的 `generateNodesForGraph` 函数在创建节点前检查重复
- [x] utils.ts 的 `expandNodeForGraph` 函数在创建节点前检查重复
- [x] 已存在节点信息正确传递给 AI prompt

## Prompt 优化

- [x] `auto_graph_expand` 模板包含已存在节点列表变量
- [x] prompt 中明确要求 AI 不要生成已存在的节点名称

## 日志记录

- [x] 跳过重复节点时记录日志（包含节点标题、父节点、跳过原因）
- [x] 日志级别正确（info 或 debug）

## 测试验证

- [x] 新建图谱不会生成重复节点
- [x] 扩展现有图谱不会生成重复节点
- [x] 递归生成时跨层级不会生成重复节点
- [x] 类型检查通过（`npm run check`）
- [x] 代码检查通过（`npm run lint`）
