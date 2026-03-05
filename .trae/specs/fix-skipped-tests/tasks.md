# Tasks

- [x] Task 1: 修复登录模块的跳过测试
  - [x] SubTask 1.1: 分析登录模块跳过的测试（Cookie、会话管理、性能测试）
  - [x] SubTask 1.2: 修复登录后跳转逻辑（从 /dashboard 改为 /）
  - [x] SubTask 1.3: 恢复 Cookie 和会话管理测试
  - [x] SubTask 1.4: 恢复主题切换测试
  - [x] SubTask 1.5: 验证登录模块所有测试通过

- [x] Task 2: 修复注册模块的跳过测试
  - [x] SubTask 2.1: 分析注册模块跳过的测试（自动登录、跳转逻辑）
  - [x] SubTask 2.2: 修复注册后自动登录逻辑
  - [x] SubTask 2.3: 修复注册后跳转到 Dashboard 的逻辑（从 /dashboard 改为 /）
  - [x] SubTask 2.4: 恢复注册模块所有测试
  - [x] SubTask 2.5: 验证注册模块所有测试通过

- [ ] Task 3: 修复 Dashboard 模块的跳过测试
  - [ ] SubTask 3.1: 分析 Dashboard 模块跳过的测试（创建图谱、删除、收藏、搜索）
  - [ ] SubTask 3.2: 修复创建图谱功能
  - [ ] SubTask 3.3: 修复删除图谱功能
  - [ ] SubTask 3.4: 修复收藏图谱功能
  - [ ] SubTask 3.5: 修复搜索和筛选功能
  - [ ] SubTask 3.6: 恢复 Dashboard 模块所有测试
  - [ ] SubTask 3.7: 验证 Dashboard 模块所有测试通过

- [ ] Task 4: 修复图谱编辑器模块的跳过测试
  - [ ] SubTask 4.1: 分析图谱编辑器模块跳过的测试
  - [ ] SubTask 4.2: 修复图谱编辑器导航问题
  - [ ] SubTask 4.3: 恢复图谱编辑器所有测试
  - [ ] SubTask 4.4: 验证图谱编辑器模块所有测试通过

- [ ] Task 5: 修复学习模式模块的跳过测试
  - [ ] SubTask 5.1: 分析学习模式模块跳过的测试
  - [ ] SubTask 5.2: 修复学习模式导航问题
  - [ ] SubTask 5.3: 恢复学习模式所有测试
  - [ ] SubTask 5.4: 验证学习模式模块所有测试通过

- [ ] Task 6: 修复任务调度器模块的跳过测试
  - [ ] SubTask 6.1: 分析任务调度器模块跳过的测试
  - [ ] SubTask 6.2: 修复任务调度器导航问题
  - [ ] SubTask 6.3: 恢复任务调度器所有测试
  - [ ] SubTask 6.4: 验证任务调度器模块所有测试通过

- [ ] Task 7: 修复成就系统模块的跳过测试
  - [ ] SubTask 7.1: 分析成就系统模块跳过的测试
  - [ ] SubTask 7.2: 修复成就系统导航问题
  - [ ] SubTask 7.3: 恢复成就系统所有测试
  - [ ] SubTask 7.4: 验证成就系统模块所有测试通过

- [ ] Task 8: 修复跨模块集成测试的跳过测试
  - [ ] SubTask 8.1: 分析跨模块集成测试跳过的测试
  - [ ] SubTask 8.2: 修复跨模块导航和状态同步问题
  - [ ] SubTask 8.3: 恢复跨模块集成所有测试
  - [ ] SubTask 8.4: 验证跨模块集成所有测试通过

- [x] Task 9: 修复设置页面模块的跳过测试
  - [x] SubTask 9.1: 分析设置页面模块跳过的测试
  - [x] SubTask 9.2: 修复设置页面导航超时问题（移除 waitForLoadState）
  - [x] SubTask 9.3: 恢复设置页面所有测试
  - [x] SubTask 9.4: 验证设置页面模块所有测试通过

- [x] Task 10: 修复个人资料模块的跳过测试
  - [x] SubTask 10.1: 分析个人资料模块跳过的测试
  - [x] SubTask 10.2: 修复个人资料返回导航问题
  - [x] SubTask 10.3: 恢复个人资料所有测试
  - [x] SubTask 10.4: 验证个人资料模块所有测试通过

- [ ] Task 11: 修复 Dashboard 分享功能的跳过测试
  - [ ] SubTask 11.1: 分析 Dashboard 分享功能跳过的测试
  - [ ] SubTask 11.2: 修复分享菜单功能（如果存在）
  - [ ] SubTask 11.3: 恢复 Dashboard 分享功能所有测试
  - [ ] SubTask 11.4: 验证 Dashboard 分享功能所有测试通过

- [x] Task 12: 修复主题切换功能的跳过测试
  - [x] SubTask 12.1: 分析主题切换跳过的测试
  - [x] SubTask 12.2: 修复登录页面主题切换功能
  - [x] SubTask 12.3: 恢复主题切换测试
  - [x] SubTask 12.4: 验证主题切换测试通过

- [ ] Task 13: 最终验证所有测试通过
  - [ ] SubTask 13.1: 运行所有测试确认通过
  - [ ] SubTask 13.2: 运行 lint 和 check 确保代码质量
  - [ ] SubTask 13.3: 生成测试报告

# Task Dependencies
- [Task 2] depends on [Task 1] - 先修复登录模块再修复注册模块
- [Task 3] depends on [Task 2] - 先修复注册模块再修复 Dashboard
- [Task 4] depends on [Task 3] - 先修复 Dashboard 再修复图谱编辑器
- [Task 5] depends on [Task 3] - 先修复 Dashboard 再修复学习模式
- [Task 6] depends on [Task 3] - 先修复 Dashboard 再修复任务调度器
- [Task 7] depends on [Task 3] - 先修复 Dashboard 再修复成就系统
- [Task 8] depends on [Task 4, Task 5, Task 6, Task 7] - 先修复各模块再修复跨模块集成
- [Task 9] depends on [Task 8] - 先修复跨模块集成再修复设置页面
- [Task 10] depends on [Task 9] - 先修复设置页面再修复个人资料
- [Task 11] depends on [Task 3] - 先修复 Dashboard 再修复分享功能
- [Task 12] depends on [Task 1] - 先修复登录模块再修复主题切换
- [Task 13] depends on [Task 1, Task 2, Task 3, Task 4, Task 5, Task 6, Task 7, Task 8, Task 9, Task 10, Task 11, Task 12] - 最后验证所有测试
