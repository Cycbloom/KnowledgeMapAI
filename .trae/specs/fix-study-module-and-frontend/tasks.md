# Tasks

- [ ] Task 1: 修复学习模块的选择器问题
  - [ ] SubTask 1.1: 修复学习统计卡片选择器（`p:has-text("总卡片")`）
  - [ ] SubTask 1.2: 修复题库管理标签选择器（`button:has-text("题库管理")`）
  - [ ] SubTask 1.3: 修复开始自测按钮选择器（`button:has-text("开始自测")`）
  - [ ] SubTask 1.4: 为移动端测试添加独立的选择器

- [ ] Task 2: 修复学习模块的超时问题
  - [ ] SubTask 2.1: 优化 hasAnyCards 方法的等待逻辑
  - [ ] SubTask 2.2: 增加学习页面加载的等待时间
  - [ ] SubTask 2.3: 使用 waitForFunction 等待特定条件

- [ ] Task 3: 实现学习统计卡片组件
  - [ ] SubTask 3.1: 创建学习统计卡片组件（总卡片、已掌握、待复习）
  - [ ] SubTask 3.2: 实现连续学习天数显示
  - [ ] SubTask 3.3: 实现本周学习时间显示
  - [ ] SubTask 3.4: 实现进度百分比计算和显示

- [ ] Task 4: 实现题库管理标签页
  - [ ] SubTask 4.1: 创建题库管理标签页组件
  - [ ] SubTask 4.2: 实现题库列表显示
  - [ ] SubTask 4.3: 实现题库筛选功能

- [ ] Task 5: 实现薄弱知识点区域
  - [ ] SubTask 5.1: 创建薄弱知识点区域组件
  - [ ] SubTask 5.2: 实现薄弱知识点列表显示
  - [ ] SubTask 5.3: 实现薄弱知识点统计

- [ ] Task 6: 优化 React Flow 渲染性能
  - [ ] SubTask 6.1: 优化节点渲染逻辑
  - [ ] SubTask 6.2: 优化边渲染逻辑
  - [ ] SubTask 6.3: 添加渲染性能监控

- [ ] Task 7: 修复图谱编辑器的剩余失败测试
  - [ ] SubTask 7.1: 修复图谱卡片点击跳转逻辑
  - [ ] SubTask 7.2: 优化父节点选择器更新逻辑
  - [ ] SubTask 7.3: 增加节点列表更新后的等待时间

- [ ] Task 8: 验证所有修复
  - [ ] SubTask 8.1: 运行学习模块测试验证修复
  - [ ] SubTask 8.2: 运行图谱编辑器测试验证修复
  - [ ] SubTask 8.3: 运行完整测试套件确保无回归

# Task Dependencies
- [Task 1] depends on [] - 可独立进行
- [Task 2] depends on [Task 1] - 修复选择器后再优化超时
- [Task 3] depends on [] - 可独立进行
- [Task 4] depends on [] - 可独立进行
- [Task 5] depends on [] - 可独立进行
- [Task 6] depends on [] - 可独立进行
- [Task 7] depends on [Task 6] - 性能优化后修复剩余问题
- [Task 8] depends on [Task 1, Task 2, Task 3, Task 4, Task 5, Task 6, Task 7] - 所有修复完成后验证
