# Tasks

- [x] Task 1: 在 GraphOutline 中实现文献视图
  - [x] SubTask 1.1: 扩展 viewMode 类型为 "tree" | "list" | "module" | "literature"
  - [x] SubTask 1.2: 添加 literatureGroups 的 useMemo 计算：从节点 properties.sources 提取文献信息，按文献标题去重分组，无来源节点归入"未分类"组
  - [x] SubTask 1.3: 添加 expandedLiteratures 状态管理（Set<string>）
  - [x] SubTask 1.4: 实现 renderLiteratureView() 函数：遍历 literatureGroups，每组渲染文献头部（标题、作者、年份、节点数量）+ 展开后的概念节点列表
  - [x] SubTask 1.5: 在视图切换栏中，当 templateType === "topic_research" 时添加"文献"按钮（使用 FileText 图标）
  - [x] SubTask 1.6: 在内容区域渲染逻辑中添加 viewMode === "literature" 的分支
  - [x] SubTask 1.7: 导入 ConceptSource 类型（从 @shared/types/graph）

# Task Dependencies

- 无外部依赖，仅修改 GraphOutline.tsx
