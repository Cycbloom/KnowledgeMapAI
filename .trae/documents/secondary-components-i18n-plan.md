# 次要组件国际化完善计划

## 目标
逐步完善项目中剩余次要组件的国际化工作，确保所有用户可见文本都支持多语言切换。

## 当前状态

已完成国际化的主要组件：
- Settings.tsx, Login.tsx, Layout.tsx, MobileBottomNav.tsx
- GraphMap.tsx 及部分相关组件
- Console.tsx 及相关组件
- Templates.tsx 及相关组件
- LearningMode.tsx 及相关组件
- Study.tsx, Statistics.tsx, CalendarPage.tsx
- Achievements.tsx, Tasks.tsx, Scheduler.tsx
- AutoGraphGenerator.tsx, ConfirmDialog.tsx

## 待完善组件清单

### 第一批：GraphMap 相关组件（高优先级）
这些组件用户使用频率较高：

1. **CreateRelationPanel.tsx** - 创建关系面板
2. **NodeSelectorModal.tsx** - 节点选择器弹窗
3. **GraphRelationDiscoveryPanel.tsx** - 关系发现面板
4. **AnalysisResultView.tsx** - 分析结果视图
5. **MergeSuggestionsSection.tsx** - 合并建议区域
6. **SessionLog.tsx** - 会话日志
7. **SkillSelector.tsx** - 技能选择器
8. **ModularAnalysisPanel.tsx** - 模块化分析面板
9. **AnalysisModuleCard.tsx** - 分析模块卡片
10. **RelationsResultSection.tsx** - 关系结果区域
11. **LearningPathSuggestionsSection.tsx** - 学习路径建议
12. **KnowledgeGapsSection.tsx** - 知识缺口区域
13. **CrossDomainInsightsSection.tsx** - 跨域洞察区域

### 第二批：Scheduler 相关组件（中优先级）
任务调度相关组件：

1. **TimelineView.tsx** - 时间线视图
2. **ListView.tsx** - 列表视图
3. **KanbanView.tsx** - 看板视图
4. **HorizontalQueueView.tsx** - 水平队列视图
5. **TaskKnowledgeLink.tsx** - 任务知识链接
6. **SmartRecommendationBar.tsx** - 智能推荐栏
7. **ReviewTaskCard.tsx** - 复习任务卡片

### 第三批：GraphEditor 相关组件（中优先级）
图谱编辑器相关组件：

1. **ExportDialog.tsx** - 导出对话框
2. **MindMapNode.tsx** - 思维导图节点
3. **MindMapCanvas.tsx** - 思维导图画布

### 第四批：其他页面和组件（低优先级）
其他次要组件：

1. **CombinedGraphView.tsx** - 联立视图
2. **LearningPathWizard.tsx** - 学习路径向导
3. **RelatedTasks.tsx** - 相关任务
4. **CommandAutocomplete.tsx** - 命令自动完成
5. **ConsoleHistory.tsx** - 控制台历史
6. **promptScenarios.tsx** - 提示场景配置

## 实施步骤

### 步骤 1：更新语言文件
为每个批次添加对应的翻译键到 zh-CN.json 和 en-US.json

### 步骤 2：修改组件
对每个组件：
1. 添加 `import { useTranslation } from 'react-i18next';`
2. 添加 `const { t } = useTranslation();`
3. 替换硬编码中文文本为 `t('module.key')`

### 步骤 3：验证
- 运行 `npm run check` 确保类型正确
- 手动测试语言切换功能

## 翻译键命名规范

```
graphMap:
├── createRelation: 创建关系相关
├── nodeSelector: 节点选择器相关
├── analysis: 分析相关
├── sessionLog: 会话日志相关
└── ...

scheduler:
├── timeline: 时间线视图
├── kanban: 看板视图
├── listView: 列表视图
└── ...

graphEditor:
├── export: 导出相关
├── mindMap: 思维导图相关
└── ...
```

## 预期工作量

- 第一批：约 13 个组件
- 第二批：约 7 个组件
- 第三批：约 3 个组件
- 第四批：约 6 个组件

总计约 29 个组件需要完善国际化。
