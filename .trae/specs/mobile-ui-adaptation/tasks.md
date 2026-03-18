# 移动端UI适配 - 实施计划（分解和优先级任务列表）

## [x] Task 1: 完善Tailwind响应式配置
- **Priority**: P0
- **Depends On**: None
- **Description**: 
  - 配置Tailwind的断点，确保移动端、平板端、桌面端有合适的断点
  - 添加移动端专用的工具类（如触摸区域最小尺寸等）
  - 优化颜色和间距配置，适合移动端显示
- **Acceptance Criteria Addressed**: [AC-1, AC-2]
- **Test Requirements**:
  - `programmatic` TR-1.1: 验证tailwind.config.js中包含合适的断点配置
  - `programmatic` TR-1.2: 验证新增的移动端工具类在CSS中正确生成
- **Notes**: 断点参考：sm(640px), md(768px), lg(1024px), xl(1280px)

## [x] Task 2: 优化Dashboard页面移动端布局
- **Priority**: P0
- **Depends On**: Task 1
- **Description**: 
  - 优化Dashboard页面在移动端的卡片布局和网格
  - 调整搜索框和筛选器的移动端显示
  - 确保图谱列表在移动端有合适的显示方式
- **Acceptance Criteria Addressed**: [AC-1, AC-2]
- **Test Requirements**:
  - `programmatic` TR-2.1: 使用Playwright测试Dashboard在390x844视口下的显示
  - `human-judgement` TR-2.2: 检查卡片间距、按钮尺寸是否适合移动端
- **Notes**: 主要关注图谱卡片、统计卡片的布局

## [ ] Task 3: 优化GraphEditor移动端适配
- **Priority**: P0
- **Depends On**: Task 1
- **Description**: 
  - 完善移动端工具栏，使用底部操作菜单
  - 优化节点操作菜单（MobileNodeActionMenu）
  - 确保图谱缩放、拖拽在移动端正常工作
  - 添加移动端专用的节点预览卡片
- **Acceptance Criteria Addressed**: [AC-1, AC-2, AC-3, AC-6]
- **Test Requirements**:
  - `programmatic` TR-3.1: 测试移动端工具栏和操作菜单的显示
  - `programmatic` TR-3.2: 测试图谱缩放和拖拽功能
  - `human-judgement` TR-3.3: 评估移动端操作的便利性
- **Notes**: 参考现有的MobileNodeActionMenu和MobileNodePreviewCard组件

## [ ] Task 4: 优化Scheduler页面移动端布局
- **Priority**: P1
- **Depends On**: Task 1
- **Description**: 
  - 优化调度器在移动端的视图（队列视图、看板视图等）
  - 调整任务卡片的移动端尺寸和间距
  - 确保时间槽设置在移动端可用
- **Acceptance Criteria Addressed**: [AC-1, AC-2, AC-4]
- **Test Requirements**:
  - `programmatic` TR-4.1: 测试Scheduler在移动端的各视图显示
  - `human-judgement` TR-4.2: 检查任务操作在移动端的便利性
- **Notes**: 优先确保ListView在移动端正常工作

## [x] Task 5: 优化表单和模态框移动端适配
- **Priority**: P1
- **Depends On**: Task 1
- **Description**: 
  - 为所有表单添加移动端样式，确保输入框、选择器有合适的尺寸
  - 优化模态框在移动端的显示（全屏或合适边距）
  - 确保键盘弹出时布局正常
  - 为所有按钮添加最小触摸区域
- **Acceptance Criteria Addressed**: [AC-2, AC-4, AC-5]
- **Test Requirements**:
  - `programmatic` TR-5.1: 检查所有按钮的触摸区域≥44x44px
  - `human-judgement` TR-5.2: 评估表单填写体验
  - `human-judgement` TR-5.3: 评估模态框在移动端的显示效果
- **Notes**: 创建通用的移动端表单和模态框样式组件

## [x] Task 6: 优化学习中心页面移动端布局
- **Priority**: P1
- **Depends On**: Task 1
- **Description**: 
  - 优化学习中心的移动端布局
  - 确保学习卡片、进度条在移动端显示正常
  - 优化学习模式在移动端的体验
- **Acceptance Criteria Addressed**: [AC-1, AC-2]
- **Test Requirements**:
  - `programmatic` TR-6.1: 测试学习中心页面在移动端的显示
  - `human-judgement` TR-6.2: 评估学习体验在移动端的流畅性

## [ ] Task 7: 优化其他页面移动端布局
- **Priority**: P2
- **Depends On**: Task 1
- **Description**: 
  - 优化统计中心、日历、成就系统等页面的移动端布局
  - 优化个人设置页面的移动端体验
  - 确保所有导航在移动端正常工作
- **Acceptance Criteria Addressed**: [AC-1, AC-2]
- **Test Requirements**:
  - `programmatic` TR-7.1: 测试各页面在移动端的基本显示
  - `human-judgement` TR-7.2: 检查各页面的操作便利性

## [x] Task 8: 增强移动端测试用例
- **Priority**: P1
- **Depends On**: Tasks 2-7
- **Description**: 
  - 扩展现有的mobile-experience.spec.ts测试
  - 添加各核心页面的移动端测试
  - 添加横竖屏切换测试
  - 添加触摸操作测试
- **Acceptance Criteria Addressed**: [AC-1, AC-2, AC-3, AC-6]
- **Test Requirements**:
  - `programmatic` TR-8.1: 所有新增的移动端测试通过
  - `programmatic` TR-8.2: 运行`npm run mobile:test`所有测试通过
- **Notes**: 参考现有的mobile-experience.spec.ts

## [x] Task 9: 性能优化和最终测试
- **Priority**: P1
- **Depends On**: Tasks 2-8
- **Description**: 
  - 优化移动端加载性能
  - 进行全面的移动端手动测试
  - 在真实移动设备上进行测试（如条件允许）
  - 确保所有功能在移动端正常工作
- **Acceptance Criteria Addressed**: [AC-7]
- **Test Requirements**:
  - `programmatic` TR-9.1: Lighthouse移动端性能评分≥80
  - `human-judgement` TR-9.2: 全面的移动端体验评估
  - `programmatic` TR-9.3: 所有Playwright测试通过
