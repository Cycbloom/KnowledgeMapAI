# Tasks

- [x] Task 1: 数据库层扩展
  - [x] SubTask 1.1: 创建数据库迁移文件，为 edges 表添加新字段（custom_label, custom_color, custom_line_style, show_arrow）
  - [x] SubTask 1.2: 创建 relationship_types 表用于存储自定义关系类型配置
  - [x] SubTask 1.3: 插入预设关系类型数据到 relationship_types 表

- [x] Task 2: 类型定义扩展
  - [x] SubTask 2.1: 扩展 Edge 接口，添加新字段类型定义
  - [x] SubTask 2.2: 创建 RelationshipTypeConfig、RelationshipCategory、LineStyle 类型定义
  - [x] SubTask 2.3: 创建预设关系类型配置常量

- [x] Task 3: 后端服务扩展
  - [x] SubTask 3.1: 扩展 edgeService 支持新字段的 CRUD 操作
  - [x] SubTask 3.2: 创建 relationshipTypeService 处理关系类型配置的 CRUD
  - [x] SubTask 3.3: 创建 API 路由暴露关系类型配置接口

- [x] Task 4: 边渲染组件增强
  - [x] SubTask 4.1: 修改 MindMapLink 组件支持箭头渲染（SVG marker）
  - [x] SubTask 4.2: 修改 MindMapLink 组件支持标签渲染（text 元素）
  - [x] SubTask 4.3: 实现基于关系类型的颜色和线型映射
  - [x] SubTask 4.4: 实现标签位置计算（边中间位置）

- [x] Task 5: 关系类型配置管理
  - [x] SubTask 5.1: 创建 RelationshipTypeSettings 组件用于全局关系类型管理
  - [x] SubTask 5.2: 实现关系类型的增删改查界面
  - [x] SubTask 5.3: 集成到 GraphStyleSettings 组件

- [x] Task 6: 边编辑交互
  - [x] SubTask 6.1: 创建边右键菜单组件 EdgeContextMenu
  - [x] SubTask 6.2: 实现编辑标签弹窗功能
  - [x] SubTask 6.3: 实现关系类型选择功能
  - [x] SubTask 6.4: 集成到 MindMapCanvas 组件

- [x] Task 7: 样式设置增强
  - [x] SubTask 7.1: 在 GraphStyleSettings 添加标签显示开关
  - [x] SubTask 7.2: 添加全局箭头显示开关
  - [x] SubTask 7.3: 添加关系类型快捷选择面板

- [x] Task 8: 测试与验证
  - [x] SubTask 8.1: 测试边的标签显示和编辑功能
  - [x] SubTask 8.2: 测试箭头显示功能
  - [x] SubTask 8.3: 测试关系类型配置管理功能
  - [x] SubTask 8.4: 测试右键菜单交互功能

# Task Dependencies
- [Task 2] depends on [Task 1]
- [Task 3] depends on [Task 1, Task 2]
- [Task 4] depends on [Task 2]
- [Task 5] depends on [Task 2, Task 3]
- [Task 6] depends on [Task 3, Task 4]
- [Task 7] depends on [Task 4, Task 5]
- [Task 8] depends on [Task 4, Task 5, Task 6, Task 7]
