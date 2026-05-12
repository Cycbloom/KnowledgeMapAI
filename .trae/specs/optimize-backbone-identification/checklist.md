# Checklist

## 数据库
- [x] `graph_backbone_modules` 表创建成功
- [x] 表结构正确（id, graph_id, module_type, title, icon, color, description, display_order）
- [x] 外键约束正确设置

## 类型定义
- [x] `GraphBackboneModule` 接口定义完整
- [x] `Graph` 接口扩展包含 `backbone_modules` 属性
- [x] 类型导出正确

## 图谱初始化
- [x] 创建专题研究图谱时自动创建6个骨干模块配置
- [x] 不再创建骨干节点作为知识点
- [x] AI 生成的知识点正确分配 `backboneModule` 属性

## 象限视图
- [x] 从图谱属性获取骨干模块配置
- [x] 区域正确渲染
- [x] 节点正确分配到区域
- [x] 移除调试日志

## 数据迁移
- [x] 现有专题研究图谱的骨干节点信息正确迁移
- [x] 骨干节点作为知识点的记录已删除（可选）
- [x] 迁移后图谱功能正常

## 测试
- [x] 类型检查通过
- [x] 新创建的专题研究图谱正常工作
- [x] 迁移后的现有图谱正常工作
- [x] 象限视图功能正常
