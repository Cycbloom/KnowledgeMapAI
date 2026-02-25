# Tasks

- [x] Task 1: 引入 useIsMobile Hook 并设置移动端检测
  - [x] SubTask 1.1: 在 Dashboard.tsx 中导入 useIsMobile Hook
  - [x] SubTask 1.2: 获取设备信息（isMobile, isTablet 等）
  - [x] SubTask 1.3: 根据设备类型条件渲染不同布局

- [x] Task 2: 优化移动端页面头部布局
  - [x] SubTask 2.1: 标题区域在移动端采用垂直堆叠布局
  - [x] SubTask 2.2: 统计信息卡片在移动端简化显示
  - [x] SubTask 2.3: 调整移动端字体大小和间距

- [x] Task 3: 重构移动端操作按钮组
  - [x] SubTask 3.1: 主要按钮（新建、AI生成）保持可见
  - [x] SubTask 3.2: 创建"更多"菜单收纳次要按钮（导入、图谱地图）
  - [x] SubTask 3.3: 确保按钮触摸目标不小于 44x44px

- [x] Task 4: 优化移动端搜索框
  - [x] SubTask 4.1: 搜索框在移动端占满可用宽度
  - [x] SubTask 4.2: 搜索模式切换按钮适配移动端
  - [x] SubTask 4.3: 搜索结果弹窗适配移动端屏幕

- [x] Task 5: 优化移动端标签云展示
  - [x] SubTask 5.1: 标签云在移动端默认折叠或简化显示
  - [x] SubTask 5.2: 提供展开/收起标签云的功能
  - [x] SubTask 5.3: 已选标签在移动端突出显示

- [x] Task 6: 优化移动端图谱卡片网格
  - [x] SubTask 6.1: 卡片在移动端采用单列布局
  - [x] SubTask 6.2: 卡片内容（标题、描述、统计）适配移动端
  - [x] SubTask 6.3: 卡片操作按钮在移动端清晰可见

- [x] Task 7: 优化移动端分页控件
  - [x] SubTask 7.1: 分页控件采用简化的左右箭头形式
  - [x] SubTask 7.2: 显示当前页码和总页数文本
  - [x] SubTask 7.3: 隐藏中间页码数字

- [x] Task 8: 优化移动端模态框
  - [x] SubTask 8.1: 创建图谱模态框在移动端全屏或底部弹出
  - [x] SubTask 8.2: 模板选择器适配移动端
  - [x] SubTask 8.3: AI生成器模态框适配移动端

- [x] Task 9: 添加移动端悬浮快捷操作按钮
  - [x] SubTask 9.1: 创建移动端悬浮按钮组件
  - [x] SubTask 9.2: 点击后弹出快捷操作菜单（新建、AI生成、导入）
  - [x] SubTask 9.3: 悬浮按钮仅在移动端显示

# Task Dependencies
- [Task 2] depends on [Task 1] (需要设备检测信息)
- [Task 3] depends on [Task 1] (需要设备检测信息)
- [Task 4] depends on [Task 1] (需要设备检测信息)
- [Task 5] depends on [Task 1] (需要设备检测信息)
- [Task 6] depends on [Task 1] (需要设备检测信息)
- [Task 7] depends on [Task 1] (需要设备检测信息)
- [Task 8] depends on [Task 1] (需要设备检测信息)
- [Task 9] depends on [Task 1] (需要设备检测信息)
- [Task 3, Task 4, Task 5, Task 6, Task 7, Task 8, Task 9] 可并行执行
