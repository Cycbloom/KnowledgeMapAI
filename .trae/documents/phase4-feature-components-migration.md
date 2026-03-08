# 下一阶段工作计划：功能组件迁移与清理

## 当前状态

### 已完成
- ✅ 类型定义统一 (`shared/types/`)
- ✅ 通用组件迁移到 `common/`
- ✅ 布局组件迁移到 `Layout/`

### 当前组件结构
```
src/components/
├── common/           # 通用组件 ✅
├── Layout/           # 布局组件 ✅
├── features/         # 功能组件索引（待扩展）
├── Scheduler/        # 调度器组件
├── GraphEditor/      # 图谱编辑器组件
├── Study/            # 学习组件
├── ...               # 其他功能组件
└── *.tsx             # 根目录下的零散组件
```

---

## 任务一：迁移功能组件到 features/

### 目标结构
```
src/components/features/
├── Scheduler/        # 从 ../Scheduler/ 迁移
├── GraphEditor/      # 从 ../GraphEditor/ 迁移
├── Study/            # 从 ../Study/ 迁移
├── Calendar/         # 从 ../Calendar/ 迁移
├── Statistics/       # 从 ../Statistics/ 迁移
├── Achievements/     # 从 ../Achievements/ 迁移
├── Templates/        # 从 ../Templates/ 迁移
├── Notifications/    # 从 ../Notifications/ 迁移
├── RAGChat/          # 从 ../RAGChat/ 迁移
├── GraphMap/         # 从 ../GraphMap/ 迁移
├── LearningPath/     # 从 ../LearningPath/ 迁移
├── LearningMode/     # 从 ../LearningMode/ 迁移
├── AutoGraph/        # 从 ../AutoGraph/ 迁移
├── CombinedView/     # 从 ../CombinedView/ 迁移
└── Graph/            # 从 ../Graph/ 迁移
```

### 实施步骤

#### 1. 迁移 Scheduler 组件
- 移动 `Scheduler/` 目录到 `features/Scheduler/`
- 更新 `features/index.ts` 导出
- 更新所有导入路径

#### 2. 迁移 GraphEditor 组件
- 移动 `GraphEditor/` 目录到 `features/GraphEditor/`
- 更新导入路径

#### 3. 迁移其他功能组件
- 按优先级逐个迁移

#### 4. 验证
- 运行类型检查
- 运行 lint 检查

---

## 任务二：清理根目录下的零散组件

### 需要处理的组件
根目录下有以下零散组件需要归类：
- `AIActionSettingsPanel.tsx` → `features/Settings/`
- `ActivityHeatmap.tsx` → `features/Statistics/`
- `BlindSpotList.tsx` → `features/Study/`
- `ConnectionDiscovery.tsx` → `features/Graph/`
- `GlobalSearch.tsx` → `common/`
- `HelpModal.tsx` → `common/`
- `KnowledgePointDialogs.tsx` → `features/Study/`
- `LearningStatsEnhanced.tsx` → `features/Statistics/`
- `PromptEditor.tsx` → `features/AI/`
- `PromptSettingsPanel.tsx` → `features/AI/`
- `SSEStatusIndicator.tsx` → `common/`
- `SearchResults.tsx` → `features/Search/`
- `ShortcutHelpPanel.tsx` → `common/`
- `StatsOverview.tsx` → `features/Statistics/`
- `TagSystem.tsx` → `common/`
- `TemplateCard.tsx` → `features/Templates/`
- `TemplatePreview.tsx` → `features/Templates/`
- `TemplateSelector.tsx` → `features/Templates/`
- `TermTooltip.tsx` → `common/`

---

## 风险和注意事项

1. **导入路径更新**：每次迁移后需要更新所有引用
2. **渐进式迁移**：建议按功能域逐个迁移
3. **测试验证**：每次迁移后运行类型检查

---

## 预期收益

- 组件按功能域组织，结构清晰
- 减少根目录混乱
- 便于团队协作和维护
