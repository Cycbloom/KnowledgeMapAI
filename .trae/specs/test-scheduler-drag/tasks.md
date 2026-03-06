# Tasks

- [x] Task 1: 创建测试基础设施
  - [x] SubTask 1.1: 创建 tests 目录结构（如果不存在）
  - [x] SubTask 1.2: 创建 Page Object Model 文件 `tests/pages/SchedulerPage.ts`
  - [x] SubTask 1.3: 创建测试辅助函数文件 `tests/utils/schedulerHelpers.ts`

- [x] Task 2: 实现 SchedulerPage Page Object Model
  - [x] SubTask 2.1: 定义页面元素选择器（队列容器、任务卡片、拖拽区域）
  - [x] SubTask 2.2: 实现页面导航方法（访问调度器页面）
  - [x] SubTask 2.3: 实现任务获取方法（获取队列中的任务列表）
  - [x] SubTask 2.4: 实现拖拽操作方法（跨队列拖拽、队列内排序）

- [x] Task 3: 实现测试辅助函数
  - [x] SubTask 3.1: 实现测试数据创建函数（创建测试任务）
  - [x] SubTask 3.2: 实现测试数据清理函数（删除测试任务）
  - [x] SubTask 3.3: 实现状态验证函数（验证任务位置、顺序）
  - [x] SubTask 3.4: 实现登录辅助函数（复用现有登录逻辑）

- [x] Task 4: 编写拖拽功能测试用例
  - [x] SubTask 4.1: 编写「同一队列内任务排序」测试用例
  - [x] SubTask 4.2: 编写「跨队列移动任务」测试用例
  - [x] SubTask 4.3: 编写「拖拽到空队列」测试用例
  - [x] SubTask 4.4: 编写「拖拽取消操作」测试用例

- [x] Task 5: 编写视觉反馈测试用例
  - [x] SubTask 5.1: 编写「拖拽视觉反馈」测试用例
  - [x] SubTask 5.2: 编写「队列悬停状态」测试用例

- [x] Task 6: 编写状态更新测试用例
  - [x] SubTask 6.1: 编写「任务计数更新」测试用例
  - [x] SubTask 6.2: 编写「预计时长更新」测试用例

- [x] Task 7: 编写数据持久化测试用例
  - [x] SubTask 7.1: 编写「页面刷新后数据保持」测试用例
  - [x] SubTask 7.2: 编写「多次连续拖拽」测试用例

- [x] Task 8: 运行测试并验证
  - [x] SubTask 8.1: 运行所有测试用例
  - [x] SubTask 8.2: 修复发现的问题
  - [x] SubTask 8.3: 确保测试在 CI 环境中通过

# Task Dependencies
- [Task 2] depends on [Task 1]
- [Task 3] depends on [Task 1]
- [Task 4] depends on [Task 2, Task 3]
- [Task 5] depends on [Task 2, Task 3]
- [Task 6] depends on [Task 2, Task 3]
- [Task 7] depends on [Task 2, Task 3]
- [Task 8] depends on [Task 4, Task 5, Task 6, Task 7]
