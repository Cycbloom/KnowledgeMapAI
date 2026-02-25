# Tasks

## Phase 1: 数据库设计与迁移

- [x] Task 1: 创建周期任务相关数据表
  - [x] SubTask 1.1: 创建 `periodic_tasks` 表
  - [x] SubTask 1.2: 创建 `periodic_passes` 表
  - [x] SubTask 1.3: 创建 `pass_rewards` 表
  - [x] SubTask 1.4: 创建 `user_pass_progress` 表
  - [x] SubTask 1.5: 扩展 `user_focus_stats` 表添加连续记录字段
  - [x] SubTask 1.6: 添加必要的索引和 RLS 策略

- [x] Task 2: 初始化通行证奖励配置数据
  - [x] SubTask 2.1: 插入周通行证奖励配置（15级）
  - [x] SubTask 2.2: 插入月通行证奖励配置（20级）
  - [x] SubTask 2.3: 插入季度通行证奖励配置（20级）

## Phase 2: 后端服务层

- [x] Task 3: 扩展 AchievementService 支持周期任务
  - [x] SubTask 3.1: 实现 `initPeriodicTasks` 方法 - 初始化周期任务
  - [x] SubTask 3.2: 实现 `getPeriodicTasks` 方法 - 获取周期任务列表
  - [x] SubTask 3.3: 实现 `updatePeriodicTaskProgress` 方法 - 更新周期任务进度
  - [x] SubTask 3.4: 实现 `checkPeriodicTaskCompletion` 方法 - 检查任务完成状态

- [x] Task 4: 实现通行证服务
  - [x] SubTask 4.1: 实现 `getPassProgress` 方法 - 获取通行证进度
  - [x] SubTask 4.2: 实现 `claimPassReward` 方法 - 领取通行证奖励
  - [x] SubTask 4.3: 实现 `calculatePassLevel` 方法 - 计算通行证等级

- [x] Task 5: 实现连续奖励服务
  - [x] SubTask 5.1: 实现 `checkDailyStreak` 方法 - 检查每日连续奖励
  - [x] SubTask 5.2: 实现 `checkWeeklyStreak` 方法 - 检查周期连续奖励
  - [x] SubTask 5.3: 实现 `awardStreakBonus` 方法 - 发放连续奖励

## Phase 3: API 路由

- [x] Task 6: 添加周期任务 API 路由
  - [x] SubTask 6.1: `GET /periodic-tasks` - 获取周期任务列表
  - [x] SubTask 6.2: `POST /periodic-tasks/check` - 手动检查任务进度

- [x] Task 7: 添加通行证 API 路由
  - [x] SubTask 7.1: `GET /pass` - 获取当前周期通行证
  - [x] SubTask 7.2: `POST /pass/claim` - 领取通行证奖励

## Phase 4: 前端实现

- [x] Task 8: 创建周期任务组件
  - [x] SubTask 8.1: 创建 `PeriodicTaskCard` 组件 - 单个任务卡片
  - [x] SubTask 8.2: 创建 `PeriodicTaskList` 组件 - 任务列表
  - [x] SubTask 8.3: 实现进度条和数字显示

- [x] Task 9: 创建通行证组件
  - [x] SubTask 9.1: 创建 `PassProgress` 组件 - 通行证进度条
  - [x] SubTask 9.2: 创建 `PassRewardItem` 组件 - 单个奖励项
  - [x] SubTask 9.3: 创建 `PassRewardList` 组件 - 奖励列表
  - [x] SubTask 9.4: 创建 `PassClaimModal` 组件 - 领取奖励弹窗

- [x] Task 10: 创建连续奖励组件
  - [x] SubTask 10.1: 创建 `StreakDisplay` 组件 - 连续天数显示
  - [x] SubTask 10.2: 创建 `StreakBonusModal` 组件 - 连续奖励弹窗

- [x] Task 11: 扩展成就页面
  - [x] SubTask 11.1: 添加标签页导航（每日任务、周期任务、通行证、终身成就）
  - [x] SubTask 11.2: 集成周期任务组件
  - [x] SubTask 11.3: 集成通行证组件
  - [x] SubTask 11.4: 集成连续奖励显示

## Phase 5: 集成与测试

- [x] Task 12: 集成任务进度更新逻辑
  - [x] SubTask 12.1: 在专注完成时更新周期任务进度
  - [x] SubTask 12.2: 在学习完成时更新周期任务进度
  - [x] SubTask 12.3: 在创建节点时更新周期任务进度
  - [x] SubTask 12.4: 在任务完成时更新周期任务进度

- [x] Task 13: 测试与验证
  - [x] SubTask 13.1: 测试周期任务初始化
  - [x] SubTask 13.2: 测试任务进度更新
  - [x] SubTask 13.3: 测试通行证积分计算
  - [x] SubTask 13.4: 测试奖励领取
  - [x] SubTask 13.5: 测试连续奖励计算

---

# Task Dependencies

- Task 2 依赖 Task 1（需要表结构）
- Task 3-5 依赖 Task 1-2（需要数据库表和配置数据）
- Task 6-7 依赖 Task 3-5（需要服务层实现）
- Task 8-11 依赖 Task 6-7（需要 API 接口）
- Task 12 依赖 Task 3-5（需要服务层方法）
- Task 13 依赖所有前置任务

# Parallelizable Work

以下任务可以并行执行：
- Task 3、Task 4、Task 5（后端服务层，不同功能模块）
- Task 8、Task 9、Task 10（前端组件，不同 UI 模块）
- Task 6、Task 7（API 路由，不同端点）
