# Tasks

- [ ] Task 1: 迁移页面组件（src/pages/）中的 blue-* 颜色为 primary-*
  - [ ] SubTask 1.1: 迁移 Dashboard.tsx（48 处）
  - [ ] SubTask 1.2: 迁移 GraphMap.tsx（43 处）
  - [ ] SubTask 1.3: 迁移 Templates.tsx（42 处）
  - [ ] SubTask 1.4: 迁移 LearningPaths.tsx（39 处）
  - [ ] SubTask 1.5: 迁移 UnifiedWorkbench.tsx（25 处）
  - [ ] SubTask 1.6: 迁移 Profile.tsx（22 处）
  - [ ] SubTask 1.7: 迁移 Register.tsx（12 处）
  - [ ] SubTask 1.8: 迁移 Login.tsx（12 处）
  - [ ] SubTask 1.9: 迁移 LearningPathDetail.tsx（15 处）
  - [ ] SubTask 1.10: 迁移 RecycleBin.tsx（16 处）
  - [ ] SubTask 1.11: 迁移 Achievements.tsx（15 处）
  - [ ] SubTask 1.12: 迁移 CalendarPage.tsx（8 处）
  - [ ] SubTask 1.13: 迁移 Study.tsx（11 处）
  - [ ] SubTask 1.14: 迁移 Settings.tsx（非主题选择器部分）
  - [ ] SubTask 1.15: 迁移其余 pages 目录下的 blue-* 文件

- [ ] Task 2: 迁移 GraphEditor 组件中的 blue-* 颜色为 primary-*
  - [ ] SubTask 2.1: 迁移 AutoGraphGenerator.tsx（47 处）
  - [ ] SubTask 2.2: 迁移 GraphOutline.tsx（29 处）
  - [ ] SubTask 2.3: 迁移 GraphAnalysisPanel.tsx（27 处）
  - [ ] SubTask 2.4: 迁移 TextToGraphModal.tsx（26 处）
  - [ ] SubTask 2.5: 迁移 GraphToolbar.tsx（31 处）
  - [ ] SubTask 2.6: 迁移 ShareModal.tsx（17 处）
  - [ ] SubTask 2.7: 迁移 ExportDialog.tsx（13 处）
  - [ ] SubTask 2.8: 迁移 AIActionSettingsPanel.tsx（12 处）
  - [ ] SubTask 2.9: 迁移 PromptEditor.tsx（10 处）
  - [ ] SubTask 2.10: 迁移其余 GraphEditor 目录下的 blue-* 文件

- [ ] Task 3: 迁移 GraphMap 组件中的 blue-* 颜色为 primary-*
  - [ ] SubTask 3.1: 迁移 QuickCreateGraphPanel.tsx（32 处）
  - [ ] SubTask 3.2: 迁移 DomainManager.tsx（22 处）
  - [ ] SubTask 3.3: 迁移 AIExpansionPanel.tsx（17 处）
  - [ ] SubTask 3.4: 迁移 DomainFilter.tsx（15 处）
  - [ ] SubTask 3.5: 迁移 DomainGraphGenerator.tsx（12 处）
  - [ ] SubTask 3.6: 迁移 RelationsResultSection.tsx（10 处）
  - [ ] SubTask 3.7: 迁移 LearningPathSuggestionsSection.tsx（10 处）
  - [ ] SubTask 3.8: 迁移其余 GraphMap 目录下的 blue-* 文件

- [ ] Task 4: 迁移 Templates/Scheduler 组件中的 blue-* 颜色为 primary-*
  - [ ] SubTask 4.1: 迁移 TemplateGenerator.tsx（25 处）
  - [ ] SubTask 4.2: 迁移 SaveAsTemplateModal.tsx（25 处）
  - [ ] SubTask 4.3: 迁移 TemplateEditor.tsx（20 处）
  - [ ] SubTask 4.4: 迁移 TaskTemplates.tsx（36 处）
  - [ ] SubTask 4.5: 迁移 ListView.tsx（12 处）
  - [ ] SubTask 4.6: 迁移其余 Templates/Scheduler 目录下的 blue-* 文件

- [ ] Task 5: 迁移其他组件中的 blue-* 颜色为 primary-*
  - [ ] SubTask 5.1: 迁移 Console 组件（PerformanceTab.tsx、ConsoleOutput.tsx）
  - [ ] SubTask 5.2: 迁移 Notifications 组件（NotificationCenter.tsx）
  - [ ] SubTask 5.3: 迁移 Knowledge 组件（RelatedTasks.tsx）
  - [ ] SubTask 5.4: 迁移 Statistics 组件（TaskStatsTab.tsx）
  - [ ] SubTask 5.5: 迁移 Learning 组件（GenerateCardsModal.tsx）
  - [ ] SubTask 5.6: 迁移 common 组件（FocusTimer.tsx）
  - [ ] SubTask 5.7: 迁移 Layout 组件
  - [ ] SubTask 5.8: 迁移其余所有含 blue-* 的组件文件

- [ ] Task 6: 验证迁移结果
  - [ ] SubTask 6.1: 运行 `npm run lint` 确保无代码规范错误
  - [ ] SubTask 6.2: 运行 `npm run check` 确保无类型错误
  - [ ] SubTask 6.3: 全局搜索确认无遗漏的 blue-* 颜色（排除 Settings 主题选择器和功能性颜色）

# Task Dependencies
- [Task 1-5] 可并行执行，各文件独立迁移
- [Task 6] depends on [Task 1, Task 2, Task 3, Task 4, Task 5] — 验证需在所有迁移完成后进行
