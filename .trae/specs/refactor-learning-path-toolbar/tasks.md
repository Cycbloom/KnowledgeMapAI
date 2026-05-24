# Tasks

## Phase 1: 核心工具栏重构（本次实施）

- [x] Task 1: 重构 LearningPathPanel 组件，实现固定顶部工具栏
  - [x] 1.1 创建 `renderToolbar()` 方法，实现 sticky 定位的工具栏组件
  - [x] 1.2 工具栏左侧显示：Route 图标 + "学习路径"标题 + 路径数量（如有）
  - [x] 1.3 工具栏右侧显示：AI 规划按钮（Wand2 图标）+ 设置按钮（Settings2 图标）+ 统计按钮（有路径时）
  - [x] 1.4 应用 glass morphism 效果：`bg-gray-50 dark:bg-slate-900/95 backdrop-blur-md`
  - [x] 1.5 按钮样式统一：与文献提取面板保持一致

- [x] Task 2: 移除重复标题并整合设置面板
  - [x] 2.1 删除第 538-571 行的重复标题区块（包含 Route 图标和 h2 标题）
  - [x] 2.2 将第 573-625 行的设置面板（学习风格、每日时间）移入工具栏内部
  - [x] 2.3 使用 AnimatePresence 实现设置面板的展开/收起动画
  - [x] 2.4 确保内容区域不再显示"学习路径"标题

- [x] Task 3: 优化空状态和列表视图布局
  - [x] 3.1 简化空状态展示（第 832-850 行）：更突出的 AI 规划引导
  - [x] 3.2 保持列表视图的卡片式布局不变
  - [x] 3.3 确保内容区域可正常滚动，工具栏保持固定

- [x] Task 4: 添加国际化文本
  - [x] 4.1 在 zh-CN.json 中添加工具栏相关的翻译键值
  - [x] 4.2 在 en-US.json 中添加对应的英文翻译
  - [x] 4.3 更新组件中的 t() 调用使用新的键值

- [x] Task 5: 测试和验证
  - [x] 5.1 验证工具栏在滚动时保持固定（sticky 定位）
  - [x] 5.2 验证 AI 规划功能正常工作（向导流程不受影响）
  - [x] 5.3 验证设置面板展开/收起动画流畅
  - [x] 5.4 验证深色模式下的显示效果
  - [x] 5.5 运行类型检查：`npm run check` ✅ 通过
  - [x] 5.6 运行代码检查：`npm run lint` ✅ 通过（1 个错误来自其他文件）

# Task Dependencies

- Task 2 depends on Task 1 (需要先有工具栏才能整合设置面板)
- Task 3 depends on Task 2 (需要在移除重复标题后优化内容区)
- Task 4 can be done in parallel with Task 1-3
- Task 5 depends on Task 1-4 (所有实现完成后测试)
