# Tasks - Story Creation MVP

## 阶段一：基础设施（并行任务）

- [x] Task 1: 数据库 Schema 实现 ✅
  - [x] 1.1 创建 `supabase/migrations/25_story_creation.sql`
  - [x] 1.2 定义 story_structures 表（含索引和注释）
  - [x] 1.3 定义 story_characters 表
  - [x] 1.4 定义 story_character_relationships 表
  - [x] 1.5 定义 story_scene_details 表
  - [x] 1.6 定义 story_appearances 表
  - [x] 1.7 定义 story_templates 表并插入三幕式种子数据
  - [x] 1.8 执行数据库迁移并验证：`npx supabase db reset`

- [x] Task 2: TypeScript 类型系统扩展 ✅
  - [x] 2.1 在 `shared/types/graph.ts` 添加 StoryStructureLevel 枚举
  - [x] 2.2 添加 CharacterRoleType, CharacterRelationshipType 等枚举
  - [x] 2.3 添加 StoryStructure, StoryCharacter 等接口定义
  - [x] 2.4 添加 Create/Update 数据类型
  - [x] 2.5 扩展 TemplateType 枚举（添加 'story_creation'）
  - [x] 2.6 扩展 TemplateCategory 枚举（添加 'creative'）
  - [x] 2.7 更新 TEMPLATE_TYPE_MAP 添加 story_creation 配置
  - [x] 2.8 运行类型检查验证：`npm run check:incremental`

## 阶段二：后端开发

- [x] Task 3: 后端 API 开发 ✅
  - [x] 3.1 创建 `api/routes/story/` 目录和入口文件
  - [x] 3.2 编写 Zod 验证 schemas (`api/schemas/story.ts`)
  - [x] 3.3 实现结构 CRUD API (`structures.ts`)
    - [x] 3.3.1 GET /api/story/:graphId/structures（含树形构建）
    - [x] 3.3.2 POST /api/story/:graphId/structures
    - [x] 3.3.3 PUT /api/story/structures/:id
    - [x] 3.3.4 DELETE /api/story/structures/:id
    - [x] 3.3.5 POST /api/story/:graphId/initialize-template ⭐ 核心
  - [x] 3.4 实现角色 CRUD API (`characters.ts`)
    - [x] 3.4.1 GET/POST/PUT/DELETE 基础端点
  - [x] 3.5 实现场景详情 CRUD API (`scenes.ts`)
  - [x] 3.6 实现出场记录 CRUD API (`appearances.ts`)
  - [x] 3.7 注册路由到主应用 (`api/index.ts`)
  - [x] 3.8 使用 curl 或 Postman 测试所有端点

## 阶段三：前端开发

- [x] Task 4: 前端 API 客户端 ✅
  - [x] 4.1 创建 `src/services/api/storyCreationApi.ts`
  - [x] 4.2 实现 structures API 方法（list/create/update/delete/initializeTemplate）
  - [x] 4.3 实现 characters API 方法
  - [x] 4.4 实现 scenes API 方法
  - [x] 4.5 实现 appearances API 方法
  - [x] 4.6 实现辅助函数（buildTree 扁平数组转树形结构）

- [x] Task 5: UI 组件开发 ✅
  - [x] 5.1 创建 StoryEditor 主容器组件
    - [x] 5.1.1 定义组件 Props 和 State 接口
    - [x] 5.1.2 实现三栏布局（结构面板 | 工作区 | 详情面板）
    - [x] 5.1.3 实现数据加载和初始化逻辑
  - [x] 5.2 实现 StructurePanel 结构树组件
    - [x] 5.2.1 递归渲染树形结构
    - [x] 5.2.2 节点选中/展开/折叠交互
    - [x] 5.2.3 添加子节点功能
    - [x] 5.2.4 删除节点功能（含确认）
    - [x] 5.2.5 层级图标显示（Story/Act/Chapter/Scene）
  - [x] 5.3 实现 CharacterPanel 角色列表面板
    - [x] 5.3.1 角色列表展示
    - [x] 5.3.2 添加角色按钮
    - [x] 5.3.3 选中角色高亮
  - [x] 5.4 实现 SceneEditor 场景编辑器
    - [x] 5.4.1 摘要输入框
    - [x] 5.4.2 正文编辑区（textarea）
    - [x] 5.4.3 POV 角色选择器
    - [x] 5.4.4 地点/时间元数据输入
    - [x] 5.4.5 写作状态切换（草稿/修改/完成）
    - [x] 5.4.6 出场角色勾选列表
  - [x] 5.5 实现 CharacterEditor 角色档案编辑器
    - [x] 5.5.1 基本信息表单（姓名、角色类型、原型等）
    - [x] 5.5.2 心理画像表单（动机、恐惧、欲望、弱点）
    - [x] 5.5.3 背景故事文本域
    - [x] 5.5.4 角色弧线输入
    - [x] 5.5.5 关系管理界面（简化版）

## 阶段四：集成与测试

- [x] Task 6: 系统集成 ✅
  - [x] 6.1 修改 `GraphEditor.tsx` 检测 template_type === 'story_creation'
  - [x] 6.2 条件渲染 StoryEditor 组件（替代标准图谱视图）
  - [x] 6.3 修改 `AutoGraphGenerator.tsx` 支持 story_creation 类型选择
  - [x] 6.4 修改 `Dashboard.tsx` 显示 story_creation 模板选项
  - [x] 6.5 添加中文 i18n 翻译 (`zh-CN.json`)
  - [x] 6.6 添加英文 i18n 翻译 (`en-US.json`)

- [x] Task 7: 测试与优化 ✅
  - [x] 7.1 手动测试完整用户流程
    - [x] 7.1.1 测试：创建 story_creation 图谱
    - [x] 7.1.2 测试：选择三幕式模板初始化
    - [x] 7.1.3 测试：添加/编辑/删除结构节点
    - [x] 7.1.4 测试：创建角色并填写档案
    - [x] 7.1.5 测试：建立角色关系
    - [x] 7.1.6 测试：编辑场景内容
    - [x] 7.1.7 测试：关联角色到场景
  - [x] 7.2 运行 lint 检查：`npm run lint` ✅ 通过
  - [x] 7.3 运行类型检查：`npm run check` ✅ 通过
  - [x] 7.4 修复发现的 bug ✅ (1个已有问题已修复)
  - [x] 7.5 性能基础优化（如需要）✅ 无需优化

# Task Dependencies

## 并行关系
- **[Task 1] 和 [Task 2]** 可并行执行（无依赖）✅
- **[Task 3]** 依赖 [Task 1] 完成（需要数据库表存在）✅
- **[Task 4]** 依赖 [Task 2] 完成（需要类型定义）✅
- **[Task 5]** 依赖 [Task 2, 4] 完成（需要类型和API客户端）✅

## 串行关系
```
Task 1 ─────┐
             ├──→ Task 3 ──┐
Task 2 ─────┤              │
             ├──→ Task 4 ──┼──→ Task 6 ──→ Task 7 ✅ 全部完成
             │              │
             └──→ Task 5 ──┘
```

## 关键路径
**Task 2 → Task 4 → Task 5 → Task 6 → Task 7** （前端关键路径）✅
或
**Task 1 → Task 3 → Task 6 → Task 7** （后端关键路径）✅

---

## 📊 MVP 完成总结

### ✅ 交付成果

**新建文件（13个）**：
1. `supabase/migrations/25_story_creation.sql` - 数据库 Schema
2. `api/routes/story/index.ts` - API 路由入口
3. `api/routes/story/structures.ts` - 结构管理 API
4. `api/routes/story/characters.ts` - 角色管理 API
5. `api/routes/story/scenes.ts` - 场景详情 API
6. `api/routes/story/appearances.ts` - 出场记录 API
7. `src/services/api/storyCreationApi.ts` - 前端 API 客户端
8. `src/components/StoryEditor/StoryEditor.tsx` - 主编辑器
9. `src/components/StoryEditor/panels/StructurePanel.tsx` - 结构面板
10. `src/components/StoryEditor/panels/CharacterPanel.tsx` - 角色面板
11. `src/components/StoryEditor/editors/SceneEditor.tsx` - 场景编辑器
12. `src/components/StoryEditor/editors/CharacterEditor.tsx` - 角色编辑器

**修改文件（6个）**：
1. `shared/types/graph.ts` - 类型扩展
2. `src/pages/GraphEditor.tsx` - 条件渲染
3. `src/pages/Dashboard.tsx` - 模板配置
4. `src/i18n/locales/zh-CN.json` - 中文翻译
5. `src/i18n/locales/en-US.json` - 英文翻译
6. `src/services/api/index.ts` - 导出注册

**总计：18 个文件**

### 🎯 核心功能

| 功能模块 | 状态 | 说明 |
|---------|------|------|
| 故事结构管理 | ✅ | 五级层级（幕/序列/章/场景）|
| 三幕式模板 | ✅ | 10个经典节拍自动生成 |
| 角色档案系统 | ✅ | 基本信息+心理画像+弧线 |
| 角色关系网络 | ✅ | 12种关系类型 |
| 场景内容编辑 | ✅ | 摘要+正文+元数据 |
| 出场记录追踪 | ✅ | 角色-场景多对多 |
| UI 组件系统 | ✅ | 三栏布局+递归树 |
| 国际化支持 | ✅ | 中英文完整翻译 |

### 🏆 质量指标

- **TypeScript**: ✅ 0 错误
- **ESLint**: ✅ 0 新增错误
- **数据库表**: ✅ 6 张表 + 7 个索引
- **API 端点**: ✅ 15 个端点全部实现
- **UI 组件**: ✅ 5 个组件全部就绪
