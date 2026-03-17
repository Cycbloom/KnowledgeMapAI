# Tasks

- [x] Task 1: 扩展 useFocusStore 状态管理
  - [x] SubTask 1.1: 添加白噪声相关状态（selectedNoise, volume）
  - [x] SubTask 1.2: 添加专注模式开关状态（isInFocusMode）
  - [x] SubTask 1.3: 添加智能高亮相关状态（highlightEnabled, highlightIntensity）
  - [x] SubTask 1.4: 实现状态的持久化存储

- [x] Task 2: 创建智能高亮阅读器组件
  - [x] SubTask 2.1: 创建 HighlightedReader 组件基础结构
  - [x] SubTask 2.2: 实现 AI 文本分析 API 调用（分析重点内容）
  - [x] SubTask 2.3: 实现高亮渲染逻辑（标记重点内容）
  - [x] SubTask 2.4: 实现高亮强度调节功能
  - [x] SubTask 2.5: 添加鼠标悬停显示重点解释

- [x] Task 3: 创建专注模式面板组件
  - [x] SubTask 3.1: 创建 LearningFocusPanel 组件
  - [x] SubTask 3.2: 集成白噪声选择器和音量控制
  - [x] SubTask 3.3: 集成番茄钟计时器显示和控制
  - [x] SubTask 3.4: 实现专注模式全屏切换

- [x] Task 4: 在 LearningMode 页面集成专注模式
  - [x] SubTask 4.1: 在头部工具栏添加专注模式入口按钮
  - [x] SubTask 4.2: 集成 LearningFocusPanel 组件
  - [x] SubTask 4.3: 替换原有阅读区域为 HighlightedReader（可选开关）
  - [x] SubTask 4.4: 实现专注模式与正常模式的切换逻辑

- [x] Task 5: 实现番茄钟联动功能
  - [x] SubTask 5.1: 在专注模式内显示番茄钟状态
  - [x] SubTask 5.2: 实现专注模式内控制番茄钟（开始/暂停/重置）
  - [x] SubTask 5.3: 番茄钟计时结束时在专注模式内显示提醒
  - [x] SubTask 5.4: 专注模式激活时隐藏悬浮番茄钟

- [x] Task 6: 后端 API 支持（可选，如需新增）
  - [x] SubTask 6.1: 添加文本重点分析 AI API 端点
  - [x] SubTask 6.2: 实现重点内容提取逻辑

- [x] Task 7: 测试与优化
  - [x] SubTask 7.1: 编写组件单元测试
  - [x] SubTask 7.2: 测试白噪声播放功能
  - [x] SubTask 7.3: 测试番茄钟联动功能
  - [x] SubTask 7.4: 测试智能高亮功能
  - [x] SubTask 7.5: 性能优化（大文本渲染）

# Task Dependencies
- [Task 2] depends on [Task 6] (如果需要后端 API)
- [Task 3] depends on [Task 1]
- [Task 4] depends on [Task 2, Task 3]
- [Task 5] depends on [Task 1, Task 4]
- [Task 7] depends on [Task 1, Task 2, Task 3, Task 4, Task 5]
