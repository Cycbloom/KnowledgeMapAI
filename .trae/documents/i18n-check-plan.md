# 国际化工作检查计划

## 目标
检查项目中所有前端组件是否已完成国际化（i18n），确保没有遗漏的硬编码中文文本。

## 检查范围

### 已完成的模块（根据 tasks.md 和 checklist.md）

**Phase 1: P0 核心页面**
- [x] Settings.tsx - 系统设置页面
- [x] Login.tsx - 登录页面
- [x] Layout.tsx - 布局组件
- [x] MobileBottomNav.tsx - 移动端底部导航

**Phase 2: P1 主要功能**
- [x] GraphMap.tsx - 图谱地图主页面
- [x] GraphMapToolbar.tsx - 图谱地图工具栏
- [x] GraphMapCanvas.tsx - 图谱地图画布
- [x] DomainManager.tsx - 领域管理
- [x] DomainFilter.tsx - 领域筛选
- [x] QuickCreateGraphPanel.tsx - 快速创建图谱面板
- [x] BatchOperationPanel.tsx - 批量操作面板
- [x] AgentAnalysisPanel.tsx - AI 分析面板
- [x] AnalysisConfirmPanel.tsx - 分析确认面板
- [x] DomainGraphGenerator.tsx - 领域图谱生成器
- [x] DomainBackground.tsx - 领域背景
- [x] Console.tsx - 控制台
- [x] ConsoleInput.tsx - 控制台输入
- [x] ConsoleOutput.tsx - 控制台输出
- [x] PerformanceTab.tsx - 性能监控标签
- [x] Templates.tsx - 模板管理
- [x] TemplateSelector.tsx - 模板选择器
- [x] TemplatePreview.tsx - 模板预览
- [x] TemplateGenerator.tsx - 模板生成器
- [x] TemplateEditor.tsx - 模板编辑器

**Phase 3: P2 其他功能**
- [x] LearningMode.tsx - 学习模式
- [x] GenerateCardsModal.tsx - 题目生成弹窗
- [x] GraphOverviewPanel.tsx - 图谱概览面板
- [x] LearningFocusPanel.tsx - 专注模式面板
- [x] LearningPathPanel.tsx - 学习路径面板
- [x] LearningPathOutline.tsx - 路径大纲
- [x] GraphOverviewEditModal.tsx - 概览编辑弹窗
- [x] Study.tsx - 学习中心
- [x] Statistics.tsx - 统计中心
- [x] CalendarPage.tsx - 日历页面
- [x] Achievements.tsx - 成就系统
- [x] Tasks.tsx - 任务中心
- [x] Scheduler.tsx - 任务调度
- [x] AutoGraphGenerator.tsx - AI 图谱生成器

### 待检查的组件（可能遗漏）

根据 Grep 搜索结果，，以下组件可能仍包含硬编码中文文本：

1. **GraphMap 相关**
   - CreateRelationPanel.tsx - 创建关系面板
   - NodeSelectorModal.tsx - 节点选择器
   - AIExpansionPanel.tsx - AI 扩展面板
   - GraphRelationDiscoveryPanel.tsx - 关系发现面板
   - CrossDomainInsightsSection.tsx - 跨域洞察区域
   - ModularAnalysisPanel.tsx - 模块化分析面板
   - AnalysisResultViewer.tsx - 分析结果查看器
   - MergeSuggestionsSection.tsx - 合并建议区域
   - SessionLog.tsx - 会话日志
   - SkillSelector.tsx - 技能选择器
   - AnalysisModuleCard.tsx - 分析模块卡片
   - RelationsResultSection.tsx - 关系结果区域
   - LearningPathSuggestionsSection.tsx - 学习路径建议
   - KnowledgeGapsSection.tsx - 知识缺口区域

2. **GraphEditor 相关**
   - GraphEditor.tsx - 图谱编辑器主页面
   - ExportDialog.tsx - 导出对话框
   - MindMapNode.tsx - 思维导图节点
   - MindMapCanvas.tsx - 思维导图画布
   - GraphSettingsModal.tsx - 图谱设置弹窗
   - RelationshipTypeSettings.tsx - 关系类型设置

3. **Scheduler 相关**
   - TimelineView.tsx - 时间线视图
   - ListView.tsx - 列表视图
   - KanbanView.tsx - 看板视图
   - HorizontalQueueView.tsx - 水平队列视图
   - TaskKnowledgeLink.tsx - 任务知识链接
   - SmartRecommendationBar.tsx - 智能推荐栏
   - ReviewTaskCard.tsx - 复习任务卡片
   - TimeSlotSettings.tsx - 时间槽设置
   - HorizontalQueue.tsx - 水平队列
   - TemplateForm.tsx - 模板表单

4. **Console 相关**
   - ConfirmDialog.tsx - 确认对话框
   - CommandAutocomplete.tsx - 命令自动完成
   - ConsoleHistory.tsx - 控制台历史

5. **其他页面**
   - CombinedGraphView.tsx - 联立视图
   - UnifiedWorkbench.tsx - 统一工作台
   - LearningPathDetail.tsx - 学习路径详情
   - LearningPathWizard.tsx - 学习路径向导
   - StatisticsCenter.tsx - 统计中心（旧版？）

6. **通用组件**
   - OfflineStatusBar.tsx - 离线状态栏
   - OfflineIndicator.tsx - 离线指示器
   - ActivityHeatmap.tsx - 活动热力图
   - RelatedTasks.tsx - 相关任务

7. **Prompt 配置**
   - promptScenarios.tsx - 提示场景配置

## 检查步骤

### 步骤 1: 验证语言文件完整性
- 读取 zh-CN.json 和 en-US.json
- 检查是否包含所有模块的翻译键
- 确保翻译键命名一致

### 步骤 2: 检查遗漏组件
- 对每个待检查组件执行 Grep 搜索
- 确认是否包含硬编码中文文本
- 确认是否已添加 useTranslation hook

### 步骤 3: 运行类型检查
- 执行 `npm run check`
- 确保没有类型错误

### 步骤 4: 更新任务状态
- 根据检查结果更新 tasks.md 和 checklist.md
- 标记已完成和未完成的组件

## 预期结果

1. **完成标准**：
   - 所有用户可见的前端组件都使用 i18n
   - 所有硬编码中文文本都替换为 t('xxx') 格式
   - 语言文件包含所有需要的翻译键
   - 类型检查通过

2. **输出**：
   - 检查报告，列出遗漏的组件
   - 更新后的任务清单
