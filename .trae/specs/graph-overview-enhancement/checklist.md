# Checklist

## 数据库变更

- [x] `knowledge_graphs` 表包含 `reference_books` 字段 (JSONB 类型)
- [x] `knowledge_graphs` 表包含 `external_links` 字段 (JSONB 类型)
- [x] `knowledge_graphs` 表包含 `learning_guide` 字段 (TEXT 类型)
- [x] 字段注释已添加，说明字段用途

## 类型定义

- [x] `ReferenceBook` 接口已定义，包含 title, author, isbn?, description?, url? 字段
- [x] `ExternalLink` 接口已定义，包含 title, url, type, description? 字段
- [x] `Graph` 接口已更新，包含 reference_books?, external_links?, learning_guide? 字段

## 后端 API

- [x] 图谱服务支持读取新字段
- [x] 图谱服务支持更新新字段
- [x] API 响应正确返回新字段数据

## 图谱总览组件

- [x] `GraphOverviewPanel` 组件已创建
- [x] 图谱标题和描述正确展示
- [x] 参考书籍列表正确展示（支持空状态）
- [x] 外部链接列表正确展示（支持空状态）
- [x] 学习指南正确展示（支持 Markdown 渲染）
- [x] 编辑按钮功能正常

## 编辑功能

- [x] 编辑模态框已创建
- [x] 参考书籍添加/编辑/删除功能正常
- [x] 外部链接添加/编辑/删除功能正常
- [x] 学习指南 Markdown 编辑器功能正常
- [x] 保存功能正常，数据持久化成功

## 学习模式页面集成

- [x] 未选择知识点时展示图谱总览面板
- [x] 图谱数据正确加载新字段
- [x] 从总览页面可以跳转到知识点学习
- [x] 移动端适配正常

## 代码质量

- [x] 类型检查通过 (`npm run check`) - 本次修改无新增类型错误
- [x] 代码检查通过 (`npm run lint`) - 本次修改无新增代码错误
- [x] 无 TypeScript 错误（本次修改）
- [x] 无 ESLint 警告（本次修改）
