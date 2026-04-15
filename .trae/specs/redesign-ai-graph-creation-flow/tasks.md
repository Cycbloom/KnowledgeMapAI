# Tasks

- [x] Task 1: 扩展 TemplateCategory 和 TemplateType 类型定义
  - [x] SubTask 1.1: 在 `shared/types/graph.ts` 中新增 TemplateType 类型，修改 TemplateCategory
  - [x] SubTask 1.2: 更新相关类型引用（Template 接口、GeneratedTemplate 等）
  - [x] SubTask 1.3: 添加模板类型元数据常量（名称、描述、图标、结构特征）

- [x] Task 2: 更新 i18n 翻译文件
  - [x] SubTask 2.1: 在 `zh-CN.json` 中添加新模板分类和类型的翻译
  - [x] SubTask 2.2: 在 `en-US.json` 中添加新模板分类和类型的翻译

- [x] Task 3: 改造 AutoGraphGenerator 组件，增加模板选择步骤
  - [x] SubTask 3.1: 添加步骤指示器 UI（①选择模板 → ②输入主题 → ③生成方案 → ④选择风格）
  - [x] SubTask 3.2: 实现模板分类选择界面（4 大类卡片 + 展开具体模板）
  - [x] SubTask 3.3: 实现"空白图谱"选项
  - [x] SubTask 3.4: 将模板选择结果传递给后续生成步骤

- [x] Task 4: 更新后端 templateGeneratorService 支持新模板类型
  - [x] SubTask 4.1: 为每种模板类型编写 prompt 指导文本
  - [x] SubTask 4.2: 更新 generateTemplates 方法，根据 TemplateType 调整生成策略
  - [x] SubTask 4.3: 更新 API 路由，支持新的 template_type 参数

- [x] Task 5: 改造 Dashboard 首页，统一为单一 AI 生成入口
  - [x] SubTask 5.1: 移除桌面端"新建图谱"按钮
  - [x] SubTask 5.2: 移除移动端"新建图谱"按钮和 FAB 菜单选项
  - [x] SubTask 5.3: 移除相关状态（isCreating、isTemplateSelectorOpen 等）
  - [x] SubTask 5.4: 移除创建图谱模态框和模板选择器模态框
  - [x] SubTask 5.5: 保留"AI 生成"按钮作为唯一创建入口

- [x] Task 6: 更新 TemplateSelector 和 TemplateCard 适配新分类
  - [x] SubTask 6.1: 更新 TemplateSelector 的分类筛选为新分类体系
  - [x] SubTask 6.2: 更新 TemplateCard 的分类图标和颜色

- [x] Task 7: 更新数据库模板种子数据
  - [x] SubTask 7.1: 更新 `supabase/migrations/00000000000001_initial_seed.sql` 中的系统模板数据
  - [x] SubTask 7.2: 更新 `supabase/migrations/00000000000000_initial_schema.sql` 中的 templates 表 category 约束

- [x] Task 8: 运行 lint 和类型检查
  - [x] SubTask 8.1: 运行 `npm run lint` 修复代码规范问题
  - [x] SubTask 8.2: 运行 `npm run check` 修复类型错误

# Task Dependencies

- [Task 1] 是基础，Task 2/3/4/6/7 都依赖它
- [Task 2] 和 [Task 4] 可并行
- [Task 3] 依赖 [Task 1] 和 [Task 2]
- [Task 5] 可与 [Task 3] 并行
- [Task 6] 依赖 [Task 1]
- [Task 7] 依赖 [Task 1]
- [Task 8] 依赖所有其他 Task 完成
