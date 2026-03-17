# Checklist

## 数据库更新
- [x] `knowledge_points` 表成功添加 `keywords` 字段
- [x] 字段注释清晰描述数据结构
- [ ] 本地数据库重置后字段存在

## AI 关键词生成
- [x] 学习资料生成时同时返回关键词
- [x] 关键词包含 term、importance、category、explanation 字段
- [x] 关键词数量在 5-15 个范围内
- [x] 关键词与学习资料一起保存到数据库

## API 端点
- [x] `/ai/learning-material` 返回关键词数据
- [x] `/nodes/:id` PUT 端点支持更新 keywords (复用现有 API)
- [ ] `/nodes/:id/regenerate-keywords` POST 端点 (可选)

## 前端类型
- [x] Keyword 类型定义正确
- [x] KnowledgePoint 类型包含 keywords 字段
- [x] 前端 API 方法类型安全

## 高亮阅读器
- [x] 接收预生成关键词 prop
- [x] 使用关键词进行高亮显示
- [x] 不同重要程度有视觉区分
- [x] 悬停显示关键词解释
- [x] 无关键词时回退到本地分析

## 学习模式集成
- [x] 加载知识点时获取关键词
- [x] 关键词正确传递给专注模式
- [x] 生成学习资料后关键词保存成功

## 关键词管理 UI
- [x] 专注模式设置面板显示关键词列表
- [ ] "重新提取关键词"按钮 (可选)
- [ ] 关键词编辑功能（可选）

## 用户体验
- [x] 关键词高亮视觉效果良好
- [x] 关键词解释对学习有帮助
- [x] 性能无明显下降
