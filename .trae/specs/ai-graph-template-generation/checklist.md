# Checklist

## 数据库迁移

### 云端数据库（Supabase Dashboard）

- [ ] 在 Supabase Dashboard 的 SQL Editor 中成功执行删除 templates 表的 SQL
- [ ] templates 表成功重建，包含所有新字段
- [ ] generation_config 字段正确创建
- [ ] preview_data 字段正确创建
- [ ] tags 字段正确创建
- [ ] difficulty 字段正确创建
- [ ] estimated_nodes 字段正确创建
- [ ] RLS 策略正确设置
- [ ] 索引正确创建
- [ ] 系统预设模板成功插入（3个）

### 本地迁移文件

- [ ] `supabase/migrations/00000000000000_initial_schema.sql` 已更新 templates 表定义
- [ ] `supabase/migrations/00000000000001_initial_seed.sql` 已更新 templates 种子数据
- [ ] 本地 `npx supabase db reset` 成功执行
- [ ] 本地数据库 templates 表结构正确

### TypeScript 类型定义

- [ ] `shared/types/` 中的模板类型已更新
- [ ] `api/services/graph/graphTemplateService.ts` 中的类型已更新
- [ ] `npm run check` 无类型错误

## 后端功能

- [ ] POST /auto-graph/generate-templates 端点正常工作
- [ ] POST /auto-graph/apply-template 端点正常工作
- [ ] AI 模板生成服务正确调用 AI API
- [ ] AI 模板生成返回有效的模板结构
- [ ] 模板应用正确生成图谱节点
- [ ] 模板应用支持不同风格设置
- [ ] 错误处理和重试机制正常工作
- [ ] 性能监控和日志记录正常工作

## 前端功能

- [ ] TemplateGenerator 组件正确渲染
- [ ] 模板生成流程正常工作（输入主题 → 生成 3 个模板 → 选择模板 → 选择风格）
- [ ] TemplatePreview 组件正确显示简化节点树
- [ ] TemplatePreview 显示每个节点的建议内容描述
- [ ] TemplatePreview 显示模板元信息（标签、难度、节点数、布局建议）
- [ ] TemplateEditor 组件正确渲染
- [ ] TemplateEditor 支持节点编辑（添加、删除、修改标题和内容）
- [ ] TemplateEditor 支持边关系编辑
- [ ] TemplateEditor 支持模板基本信息编辑
- [ ] AutoGraphGenerator 支持模式切换
- [ ] 模板选择后正确应用风格生成内容
- [ ] QuickCreateGraphPanel 支持模板选择入口
- [ ] 模板管理页面显示新字段信息
- [ ] 模板管理页面支持模板预览和编辑
- [ ] 加载状态和错误处理正常显示

## 模板管理

- [ ] AI 生成的模板可以保存到模板库
- [ ] 保存模板时可以设置名称、描述、分类
- [ ] 保存模板时可以设置标签
- [ ] 模板列表支持按分类过滤
- [ ] 模板列表支持按标签搜索

## 集成测试

- [ ] 完整流程：输入主题 → 生成 3 个模板 → 预览模板 → 选择模板 → 选择风格 → 生成图谱
- [ ] 完整流程：生成模板 → 编辑模板 → 保存模板 → 从模板库选择 → 应用模板生成图谱
- [ ] 模板生成支持不同分类（学习型、项目型、故事型、分析型）
- [ ] 模板应用支持不同风格（学术、实用、入门、自定义）
- [ ] 自定义风格支持自定义 prompt
- [ ] 模板编辑功能正常工作（添加、删除、修改节点和边）
- [ ] 编辑后的模板可以正确保存和应用

## 兼容性

- [ ] 原有图谱生成流程不受影响
- [ ] 原有模板功能正常工作
- [ ] Electron 桌面应用正常工作
- [ ] Web 应用正常工作
- [ ] 移动端响应式布局正常

## 代码质量

- [ ] npm run lint 无错误
- [ ] npm run check 无类型错误
- [ ] npm run check:electron 无类型错误
- [ ] 单元测试通过
- [ ] E2E 测试通过

## 用户体验

- [ ] 模板生成速度可接受（< 10秒）
- [ ] 模板预览清晰易懂
- [ ] 操作流程直观流畅
- [ ] 错误提示友好明确
- [ ] 加载状态反馈及时
