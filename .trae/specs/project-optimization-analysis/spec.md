# 项目优化机会分析 Spec

## Why

项目经过多轮迭代和重构，已完成组件重组、服务层重组、类型统一、错误处理增强等优化工作。但通过全面分析，仍发现一些可以进一步优化的地方，包括 Hooks 组织、Store 状态管理、路由文件组织、测试覆盖等方面。

## What Changes

- 分析当前项目状态和已完成的重构工作
- 识别剩余的优化机会
- 提出具体的优化建议和实施优先级
- 不涉及代码修改，仅做分析和规划

## Impact

- Affected specs: 整体项目架构
- Affected code: 全部代码目录

---

## 一、已完成的重构工作总结

### 1.1 已完成并验证通过的优化

| 优化项 | 状态 | 说明 |
|--------|------|------|
| 组件组织结构重组 | ✅ 完成 | GraphEditor 按功能子域划分，Learning 目录合并 |
| 服务层目录重组 | ✅ 完成 | 按 ai/graph/study/scheduler/core/common 分类 |
| 类型定义统一 | ✅ 完成 | api/types/, src/types/, shared/types 分离 |
| 错误处理增强 | ✅ 完成 | 统一错误码、请求ID追踪、结构化日志 |
| 学习路径子任务显示 | ✅ 完成 | 任务卡片显示子任务进度 |
| 学习路径可视化 | ✅ 完成 | 学习顺序标注、交互高亮 |
| AI 测验生成 | ✅ 完成 | 测验集合管理、批量生成 |

### 1.2 已完成但验证未完成的优化

| 优化项 | 状态 | 待完成项 |
|--------|------|----------|
| Prompt 配置功能 | ⚠️ 部分完成 | 功能验收测试未完成 |
| 学习路径功能增强 | ⚠️ 部分完成 | E2E 测试、功能验收未完成 |
| AI 测验生成 | ⚠️ 部分完成 | E2E 测试未完成 |

---

## 二、发现的优化机会

### 2.1 Hooks 组织优化（优先级：高）

**问题描述**：
`src/hooks/` 目录下有约 25 个根目录 hook 文件，缺乏分类：

```
src/hooks/
├── graphAI/           # 已分类
├── graphEditor/       # 已分类
├── mutations/         # 已分类
├── queries/           # 已分类
├── utils/             # 已分类
└── (25个根目录文件)    # 未分类
```

**根目录待分类的 Hooks**：

| Hook | 建议分类 | 说明 |
|------|----------|------|
| useCombinedGraphAIOperations | graphAI | 图谱 AI 操作 |
| useGraphAIOperations | graphAI | 图谱 AI 操作 |
| useGraphComputed | graphEditor | 图谱计算 |
| useGraphEditorState | graphEditor | 图谱编辑器状态 |
| useGraphEffects | graphEditor | 图谱副作用 |
| useGraphExportOperations | graphEditor | 图谱导出 |
| useGraphHistoryHandlers | graphEditor | 图谱历史 |
| useGraphInteraction | graphEditor | 图谱交互 |
| useGraphNodeOperations | graphEditor | 图谱节点操作 |
| useKnowledgePointOperations | graphEditor | 知识点操作 |
| useExplorationPath | graphEditor | 探索路径 |
| useScheduler | scheduler | 调度器 |
| useSchedulerHotkeys | scheduler | 调度器快捷键 |
| useTaskEvents | scheduler | 任务事件 |
| useSearch | common | 搜索功能 |
| useError | common | 错误处理 |
| useErrorHandler | common | 错误处理 |
| useNetworkStatus | common | 网络状态 |
| useNetworkStatusEnhanced | common | 网络状态 |
| usePerformance | common | 性能监控 |
| useIntersectionObserver | common | UI 工具 |
| useIsMobile | common | UI 工具 |
| useVirtualScroll | common | UI 工具 |
| useKeyboardShortcuts | common | 快捷键 |
| useGlobalShortcuts | common | 快捷键 |
| useHistory | common | 历史记录 |
| useLocalSnapshot | common | 本地快照 |
| useTheme | common | 主题 |
| useSpeechRecognition | common | 语音识别 |
| useTextToSpeech | common | 语音合成 |
| useTopicCheck | common | 话题检查 |
| useTutorOperations | common | 导师操作 |
| useWorker | common | Web Worker |
| useCombinedView | view | 组合视图 |

**优化建议**：
```
src/hooks/
├── graphAI/           # 图谱 AI 相关
├── graphEditor/       # 图谱编辑器相关
├── scheduler/         # 调度器相关（新建）
├── mutations/         # React Query 变更
├── queries/           # React Query 查询
├── common/            # 通用 hooks（新建）
│   ├── useError.ts
│   ├── useErrorHandler.ts
│   ├── useNetworkStatus.ts
│   ├── usePerformance.ts
│   ├── useSearch.ts
│   └── ...
└── index.ts
```

### 2.2 Store 状态管理优化（优先级：中）

**问题描述**：
当前只有 5 个 Zustand store，状态管理不够系统化：

```
src/store/
├── useFocusStore.ts      # 专注模式状态
├── useMessageStore.ts    # 消息状态
├── usePerformanceStore.ts # 性能状态
├── useShortcutStore.ts   # 快捷键状态
└── useStore.ts           # 主要认证状态
```

**问题点**：
1. Store 命名不统一（`useStore.ts` vs `useXxxStore.ts`）
2. 部分状态分散在组件 hooks 中（如 `useGraphEditorState`）
3. 缺乏统一的状态管理规范

**优化建议**：
1. 统一 Store 命名规范：`useXxxStore.ts`
2. 将 `useStore.ts` 重命名为 `useAuthStore.ts`
3. 考虑将图谱编辑器状态迁移到专用 Store
4. 建立状态管理规范文档

### 2.3 路由文件组织优化（优先级：中）

**问题描述**：
`api/routes/` 根目录有约 30 个路由文件，缺乏分类：

```
api/routes/
├── ai/              # 已分类（7个文件）
├── scheduler/       # 已分类（15个文件）
└── (30个根目录文件)  # 未分类
```

**根目录待分类的路由**：

| 路由文件 | 建议分类 | 说明 |
|----------|----------|------|
| graphs.ts | graph | 图谱相关 |
| nodes.ts | graph | 图谱节点 |
| knowledgePoints.ts | graph | 知识点 |
| graphRelations.ts | graph | 图谱关系 |
| relationshipTypes.ts | graph | 关系类型 |
| autoGraph.ts | graph | 自动图谱 |
| study.ts | study | 学习相关 |
| learningPath.ts | study | 学习路径 |
| learningPaths.ts | study | 学习路径 |
| quizSets.ts | study | 测验集合 |
| achievements.ts | achievement | 成就相关 |
| periodicTasks.ts | achievement | 周期任务 |
| auth.ts | core | 认证相关 |
| health.ts | core | 健康检查 |
| systemMonitor.ts | core | 系统监控 |
| backup.ts | data | 数据管理 |
| data.ts | data | 数据管理 |
| search.ts | data | 搜索 |
| rag.ts | data | RAG |
| dashboard.ts | view | 视图相关 |
| statistics.ts | view | 统计 |
| analytics.ts | view | 分析 |
| calendar.ts | view | 日历 |
| notifications.ts | notification | 通知 |
| alerts.ts | notification | 提醒 |
| prompts.ts | ai | 提示词 |
| aiActions.ts | ai | AI 操作 |
| focus.ts | scheduler | 专注（重复） |
| tasks.ts | scheduler | 任务（重复） |
| templates.ts | common | 模板 |

**优化建议**：
```
api/routes/
├── ai/              # AI 相关
├── graph/           # 图谱相关（新建）
├── study/           # 学习相关（新建）
├── scheduler/       # 调度相关
├── achievement/     # 成就相关（新建）
├── core/            # 核心功能（新建）
├── data/            # 数据管理（新建）
├── view/            # 视图相关（新建）
├── notification/    # 通知相关（新建）
└── index.ts
```

### 2.4 测试覆盖优化（优先级：高）

**问题描述**：
多个功能的 E2E 测试未完成，测试覆盖不完整：

| 功能模块 | 单元测试 | E2E 测试 | 状态 |
|----------|----------|----------|------|
| 认证 | ✅ | ✅ | 完成 |
| Dashboard | ✅ | ✅ | 完成 |
| 学习系统 | ✅ | ✅ | 完成 |
| 图谱编辑 | ✅ | ✅ | 完成 |
| 设置 | ✅ | ✅ | 完成 |
| 调度器 | ✅ | ✅ | 完成 |
| 成就系统 | ✅ | ✅ | 完成 |
| AI 测验生成 | ❌ | ❌ | 未完成 |
| 学习路径功能 | ❌ | ❌ | 未完成 |
| Prompt 配置 | ❌ | ❌ | 未完成 |

**优化建议**：
1. 补充 AI 测验生成的 E2E 测试
2. 补充学习路径功能的 E2E 测试
3. 补充 Prompt 配置的功能验收测试
4. 建立测试覆盖报告机制

### 2.5 性能优化机会（优先级：中）

**问题描述**：
项目规模增大后，性能优化空间显现：

**前端性能**：
1. 部分大组件未做代码分割
2. 图谱渲染可能存在性能瓶颈
3. 虚拟列表使用不够广泛

**后端性能**：
1. 部分查询可能存在 N+1 问题
2. 缓存策略可以进一步优化
3. AI 调用可以增加结果缓存

**优化建议**：
1. 对大组件进行懒加载
2. 图谱渲染使用 Web Worker
3. 扩展虚拟列表使用范围
4. 优化数据库查询，添加必要索引
5. 实现 AI 结果缓存机制

### 2.6 代码质量优化（优先级：低）

**问题描述**：
1. 部分组件文件过大（如 GraphEditor.tsx）
2. 可能存在重复代码
3. 部分函数缺少类型注解
4. 缺少代码复杂度监控

**优化建议**：
1. 对大文件进行拆分
2. 使用工具检测重复代码
3. 补充类型注解
4. 添加代码复杂度检查工具

---

## 三、实施优先级建议

### 第一阶段（1-2 周）- 高优先级

1. **补充测试覆盖**
   - 完成 AI 测验生成 E2E 测试
   - 完成学习路径功能 E2E 测试
   - 完成 Prompt 配置功能验收

2. **Hooks 组织优化**
   - 创建 scheduler/ 和 common/ 子目录
   - 移动相关 hooks 到对应目录
   - 更新导入路径

### 第二阶段（2-4 周）- 中优先级

1. **Store 状态管理优化**
   - 统一 Store 命名规范
   - 建立状态管理规范文档

2. **路由文件组织优化**
   - 创建 graph/, study/, achievement/ 等子目录
   - 移动路由文件到对应目录
   - 更新导入路径

### 第三阶段（持续）- 低优先级

1. **性能优化**
   - 组件懒加载
   - 查询优化
   - 缓存策略优化

2. **代码质量优化**
   - 大文件拆分
   - 重复代码消除
   - 类型注解补充

---

## 四、风险评估

| 优化项 | 风险等级 | 影响范围 | 回滚方案 |
|--------|----------|----------|----------|
| Hooks 组织 | 低 | 前端导入路径 | Git 回滚 |
| Store 重命名 | 低 | 前端导入路径 | Git 回滚 |
| 路由组织 | 中 | 后端路由注册 | Git 回滚 |
| 测试补充 | 低 | 无代码变更 | 删除测试文件 |
| 性能优化 | 中 | 功能行为 | Git 回滚 |
| 代码拆分 | 低 | 模块结构 | Git 回滚 |

---

## 五、总结

项目已完成大部分架构优化工作，代码组织更加清晰。剩余的优化机会主要集中在：

1. **Hooks 组织**：根目录 hooks 需要分类整理
2. **测试覆盖**：部分新功能的 E2E 测试未完成
3. **路由组织**：根目录路由文件需要分类
4. **状态管理**：Store 命名和规范需要统一

建议优先完成测试覆盖和 Hooks 组织优化，这两项工作风险低、收益高。
