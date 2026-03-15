# Tasks

- [x] Task 1: 手势操作优化 - 实现增强的手势系统
  - [x] SubTask 1.1: 创建 useGestures hook，实现双指缩放、旋转、滑动切换等手势
  - [x] SubTask 1.2: 优化 MindMapCanvas 的手势处理逻辑
  - [x] SubTask 1.3: 添加手势配置选项（灵敏度开关）
  - [x] SubTask 1.4: 实现边缘滑动返回和快速滑动惯性效果

- [x] Task 2: 离线模式增强 - 实现完整离线功能
  - [x] SubTask 2.1: 创建 offlineStorage.ts 工具，管理 IndexedDB 存储
  - [x] SubTask 2.2: 实现图谱数据缓存机制
  - [x] SubTask 2.3: 实现离线编辑队列
  - [x] SubTask 2.4: 实现自动同步和冲突处理
  - [x] SubTask 2.5: 添加离线状态栏 UI

- [x] Task 3: PWA 推送通知 - 完善推送功能
  - [x] SubTask 3.1: 更新 Vite PWA 配置，添加 Push API 支持
  - [x] SubTask 3.2: 创建 backgroundSync.ts，处理后台同步
  - [x] SubTask 3.3: 完善 Web Push 通知权限请求
  - [x] SubTask 3.4: 实现学习提醒、协作通知推送
  - [x] SubTask 3.5: 优化通知设置面板

- [x] Task 4: 测试验证
  - [x] SubTask 4.1: 运行 npm run lint 检查代码
  - [x] SubTask 4.2: 运行 npm run check 检查类型
  - [x] SubTask 4.3: 使用 Playwright 测试移动端功能

# Task Dependencies
- [Task 2] depends on [Task 1]
- [Task 3] depends on [Task 2]
- [Task 4] depends on [Task 1, Task 2, Task 3]
