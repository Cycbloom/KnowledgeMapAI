# 闯关学习模式设置 - The Implementation Plan (Decomposed and Prioritized Task List)

## [x] Task 1: 创建学习设置 Store
- **Priority**: P0
- **Depends On**: None
- **Description**: 
  - 创建 `useLearningSettingsStore.ts` Zustand store
  - 包含字体大小、阅读模式、分页方式等状态
  - 实现持久化存储到 localStorage
  - 提供设置更新和重置方法
- **Acceptance Criteria Addressed**: [AC-4, AC-6]
- **Test Requirements**:
  - `programmatic` TR-1.1: Store 初始化时读取 localStorage 中的设置
  - `programmatic` TR-1.2: 更新设置时立即写入 localStorage
  - `programmatic` TR-1.3: 调用 reset 方法时所有设置恢复默认值
- **Notes**: 默认字体大小 16px，默认阅读模式为 default，默认分页方式为 scroll

## [x] Task 2: 创建学习设置面板组件
- **Priority**: P0
- **Depends On**: [Task 1]
- **Description**: 
  - 创建 `LearningSettingsPanel.tsx` 组件
  - 包含字体大小滑块（12px - 24px）
  - 包含阅读模式选择（默认/护眼/深色）
  - 包含分页方式选择（滚动/翻页）
  - 包含重置默认设置按钮
  - 样式与现有设计风格一致
- **Acceptance Criteria Addressed**: [AC-5]
- **Test Requirements**:
  - `human-judgement` TR-2.1: 设置面板包含所有必需的控件
  - `human-judgement` TR-2.2: 设置面板 UI 风格与现有界面一致
  - `human-judgement` TR-2.3: 设置面板支持移动端和桌面端显示
- **Notes**: 放置在 `src/components/Learning/` 目录下

## [x] Task 3: 集成设置面板到 LearningMode
- **Priority**: P0
- **Depends On**: [Task 2]
- **Description**: 
  - 在 LearningMode 页面添加设置按钮
  - 集成 LearningSettingsPanel 组件
  - 实现设置面板的打开/关闭功能
  - 添加平滑的动画过渡效果
- **Acceptance Criteria Addressed**: [AC-5]
- **Test Requirements**:
  - `human-judgement` TR-3.1: 页面右上角有设置按钮
  - `human-judgement` TR-3.2: 点击按钮时设置面板平滑打开/关闭
- **Notes**: 设置按钮可以放在现有设置按钮旁边或替换现有设置按钮

## [x] Task 4: 实现字体大小调整功能
- **Priority**: P0
- **Depends On**: [Task 1, Task 3]
- **Description**: 
  - 从 store 读取字体大小设置
  - 动态应用字体大小到学习资料区域
  - 确保字体大小调整影响标题、正文、代码块等所有文本元素
- **Acceptance Criteria Addressed**: [AC-1]
- **Test Requirements**:
  - `programmatic` TR-4.1: 调整字体大小滑块时，学习资料区域字体立即更新
  - `programmatic` TR-4.2: 字体大小范围为 12px - 24px
- **Notes**: 可能需要通过 CSS 变量或 inline style 实现

## [x] Task 5: 实现阅读模式切换功能
- **Priority**: P1
- **Depends On**: [Task 1, Task 3]
- **Description**: 
  - 从 store 读取阅读模式设置
  - 实现默认模式、护眼模式（浅黄色背景）、深色模式
  - 动态应用背景色、文字色等样式
  - 确保与现有主题切换功能兼容
- **Acceptance Criteria Addressed**: [AC-2]
- **Test Requirements**:
  - `programmatic` TR-5.1: 切换阅读模式时，学习资料区域样式立即更新
  - `human-judgement` TR-5.2: 护眼模式提供舒适的阅读体验
- **Notes**: 阅读模式主要针对学习资料区域，不影响整体主题

## [ ] Task 6: 实现分页方式选择功能
- **Priority**: P1
- **Depends On**: [Task 1, Task 3]
- **Description**: 
  - 从 store 读取分页方式设置
  - 实现滚动模式（默认）
  - 实现翻页模式（按页显示，添加翻页按钮）
  - 动态切换滚动行为
- **Acceptance Criteria Addressed**: [AC-3]
- **Test Requirements**:
  - `programmatic` TR-6.1: 选择翻页模式时，学习资料区域按页显示
  - `programmatic` TR-6.2: 翻页模式下有上一页/下一页按钮
- **Notes**: 翻页模式可能需要将 Markdown 内容分页处理

## [ ] Task 7: 编写测试用例
- **Priority**: P2
- **Depends On**: [Task 1-6]
- **Description**: 
  - 编写 Playwright 测试用例
  - 测试设置面板打开/关闭
  - 测试字体大小调整
  - 测试阅读模式切换
  - 测试设置持久化
  - 测试重置默认设置
- **Acceptance Criteria Addressed**: [AC-1, AC-2, AC-3, AC-4, AC-5, AC-6]
- **Test Requirements**:
  - `programmatic` TR-7.1: 所有测试用例通过
- **Notes**: 参考现有测试文件结构
