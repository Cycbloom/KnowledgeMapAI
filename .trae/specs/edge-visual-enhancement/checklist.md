# 边可视化增强 Checklist

## 数据库层
- [ ] edges 表成功添加 custom_label 字段
- [ ] edges 表成功添加 custom_color 字段
- [ ] edges 表成功添加 custom_line_style 字段
- [ ] edges 表成功添加 show_arrow 字段
- [ ] relationship_types 表创建成功
- [ ] 预设关系类型数据插入成功

## 类型定义
- [ ] Edge 接口包含 custom_label 字段
- [ ] Edge 接口包含 custom_color 字段
- [ ] Edge 接口包含 custom_line_style 字段
- [ ] Edge 接口包含 show_arrow 字段
- [ ] RelationshipTypeConfig 类型定义完整
- [ ] RelationshipCategory 类型定义完整
- [ ] LineStyle 类型定义完整
- [ ] 预设关系类型配置常量完整

## 后端服务
- [ ] edgeService 支持新字段的创建操作
- [ ] edgeService 支持新字段的更新操作
- [ ] edgeService 支持新字段的查询操作
- [ ] relationshipTypeService CRUD 功能完整
- [ ] API 路由正确暴露关系类型配置接口

## 边渲染
- [ ] 有向关系边显示箭头
- [ ] 无向关系边不显示箭头
- [ ] 边标签显示在边的中间位置
- [ ] 自定义标签覆盖关系类型标签
- [ ] 不同关系类型显示不同颜色
- [ ] 不同关系类型显示不同线型（实线、虚线、点线）
- [ ] 标签显示开关功能正常

## 关系类型管理
- [ ] 全局设置面板可查看所有关系类型
- [ ] 可新增自定义关系类型
- [ ] 可编辑关系类型配置（颜色、线型、箭头）
- [ ] 可删除自定义关系类型
- [ ] 内置关系类型不可删除

## 边编辑交互
- [ ] 右键点击边显示上下文菜单
- [ ] 右键菜单包含编辑标签选项
- [ ] 右键菜单包含选择关系类型选项
- [ ] 右键菜单包含删除边选项
- [ ] 编辑标签弹窗功能正常
- [ ] 关系类型选择功能正常

## 样式设置
- [ ] 标签显示开关正常工作
- [ ] 全局箭头显示开关正常工作
- [ ] 关系类型快捷选择面板可用
