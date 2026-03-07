# Tasks

## Phase 1: 数据库扩展

- [x] Task 1: 扩展 scheduled_tasks 表结构
  - [x] SubTask 1.1: 添加 task_type 字段（任务类型）
  - [x] SubTask 1.2: 添加 total_duration 字段（任务总时长）
  - [x] SubTask 1.3: 添加 progress_mode 字段（进度模式）
  - [x] SubTask 1.4: 添加 progress_percentage 字段（当前进度百分比）
  - [x] SubTask 1.5: 添加 parent_task_id 字段（父任务ID，用于周期任务实例）
  - [x] SubTask 1.6: 添加 context 字段（任务上下文描述）
  - [x] SubTask 1.7: 添加相关索引和约束

- [x] Task 2: 创建 task_dependencies 表
  - [x] SubTask 2.1: 创建表结构（task_id, depends_on_task_id, dependency_type）
  - [x] SubTask 2.2: 添加外键约束和级联删除
  - [x] SubTask 2.3: 添加唯一约束防止重复依赖
  - [x] SubTask 2.4: 添加索引优化查询性能
  - [x] SubTask 2.5: 配置 RLS 策略

- [x] Task 3: 创建 task_schedules 表（周期性任务配置）
  - [x] SubTask 3.1: 创建表结构
  - [x] SubTask 3.2: 定义 schedule_type 枚举（daily, weekly, custom, smart）
  - [x] SubTask 3.3: 添加 schedule_config JSONB 字段存储配置
  - [x] SubTask 3.4: 添加索引和 RLS 策略

- [x] Task 4: 创建 task_progress_plans 表
  - [x] SubTask 4.1: 创建表结构
  - [x] SubTask 4.2: 添加计划日期和进度百分比字段
  - [x] SubTask 4.3: 添加唯一约束（task_id, plan_date）
  - [x] SubTask 4.4: 添加索引和 RLS 策略

- [x] Task 5: 创建 user_time_slots 表
  - [x] SubTask 5.1: 创建表结构
  - [x] SubTask 5.2: 添加星期几、开始时间、结束时间字段
  - [x] SubTask 5.3: 添加唯一约束和索引
  - [x] SubTask 5.4: 配置 RLS 策略

## Phase 2: 后端 API 扩展

- [x] Task 6: 扩展任务 Schema 定义
  - [x] SubTask 6.1: 更新 createScheduledTaskSchema 支持新字段
  - [x] SubTask 6.2: 更新 updateScheduledTaskSchema 支持新字段
  - [x] SubTask 6.3: 添加任务依赖相关 Schema
  - [x] SubTask 6.4: 添加周期任务相关 Schema
  - [x] SubTask 6.5: 添加进度计划相关 Schema
  - [x] SubTask 6.6: 添加时间设置相关 Schema

- [x] Task 7: 实现任务依赖 API
  - [x] SubTask 7.1: POST /tasks/:id/dependencies - 添加任务依赖
  - [x] SubTask 7.2: DELETE /tasks/:id/dependencies/:dependencyId - 删除依赖
  - [x] SubTask 7.3: GET /tasks/:id/dependencies - 获取前置任务列表
  - [x] SubTask 7.4: GET /tasks/:id/dependents - 获取后置任务列表
  - [x] SubTask 7.5: 实现循环依赖检测逻辑

- [ ] Task 8: 实现周期性任务 API
  - [ ] SubTask 8.1: POST /schedules - 创建周期性任务配置
  - [ ] SubTask 8.2: PUT /schedules/:id - 更新周期配置
  - [ ] SubTask 8.3: DELETE /schedules/:id - 删除周期配置
  - [ ] SubTask 8.4: GET /schedules - 获取周期性任务列表
  - [ ] SubTask 8.5: 实现周期任务实例生成逻辑

- [x] Task 9: 实现进度管理 API
  - [x] SubTask 9.1: POST /tasks/:id/progress-plan - 创建进度计划
  - [x] SubTask 9.2: PUT /tasks/:id/progress-plan - 更新进度计划
  - [x] SubTask 9.3: GET /tasks/:id/progress-plan - 获取进度计划
  - [x] SubTask 9.4: POST /tasks/:id/progress - 更新当日进度
  - [x] SubTask 9.5: 实现进度分配算法（平均、递减、递增）

- [x] Task 10: 实现用户时间设置 API
  - [x] SubTask 10.1: GET /time-slots - 获取用户时间设置
  - [x] SubTask 10.2: POST /time-slots - 添加可用时间段
  - [x] SubTask 10.3: PUT /time-slots/:id - 更新时间段
  - [x] SubTask 10.4: DELETE /time-slots/:id - 删除时间段

- [x] Task 11: 扩展现有任务 API
  - [x] SubTask 11.1: 更新创建任务接口支持新字段
  - [x] SubTask 11.2: 更新获取任务接口返回新字段
  - [x] SubTask 11.3: 添加任务详情接口（包含依赖、进度等完整信息）
  - [x] SubTask 11.4: 实现时间片自动计算逻辑

## Phase 3: 前端类型定义

- [x] Task 12: 扩展前端类型定义
  - [x] SubTask 12.1: 添加 TaskType 类型
  - [x] SubTask 12.2: 添加 ProgressMode 类型
  - [x] SubTask 12.3: 添加 TaskDependency 接口
  - [x] SubTask 12.4: 添加 TaskSchedule 接口
  - [x] SubTask 12.5: 添加 TaskProgressPlan 接口
  - [x] SubTask 12.6: 添加 UserTimeSlot 接口
  - [x] SubTask 12.7: 扩展 ScheduledTask 接口
  - [x] SubTask 12.8: 添加 TaskDetail 接口

## Phase 4: 前端 API 服务

- [x] Task 13: 实现前端 API 服务
  - [x] SubTask 13.1: 实现任务依赖 API 调用函数
  - [x] SubTask 13.2: 实现周期任务 API 调用函数
  - [x] SubTask 13.3: 实现进度管理 API 调用函数
  - [x] SubTask 13.4: 实现时间设置 API 调用函数

## Phase 5: UI 组件开发

- [x] Task 14: 创建任务详情面板组件
  - [x] SubTask 14.1: 创建 TaskDetailPanel 主组件
  - [x] SubTask 14.2: 创建 BasicInfoSection 子组件
  - [x] SubTask 14.3: 创建 DependencySection 子组件
  - [x] SubTask 14.4: 创建 ProgressSection 子组件
  - [x] SubTask 14.5: 创建 RelatedResourcesSection 子组件

- [x] Task 15: 创建任务依赖关系图组件
  - [x] SubTask 15.1: 实现依赖关系图布局算法
  - [x] SubTask 15.2: 实现节点渲染（任务卡片）
  - [x] SubTask 15.3: 实现边渲染（依赖连线）
  - [x] SubTask 15.4: 实现交互（点击跳转、悬停提示）
  - [x] SubTask 15.5: 区分严格依赖和软性依赖的视觉样式

- [x] Task 16: 创建进度时间线组件
  - [x] SubTask 16.1: 实现时间线基础布局
  - [x] SubTask 16.2: 实现计划进度条显示
  - [x] SubTask 16.3: 实现实际进度条显示
  - [x] SubTask 16.4: 实现里程碑标记
  - [x] SubTask 16.5: 实现进度编辑交互

- [x] Task 17: 创建时间设置组件
  - [x] SubTask 17.1: 创建周视图布局
  - [x] SubTask 17.2: 实现时间段拖拽设置
  - [x] SubTask 17.3: 实现不可用日期标记
  - [x] SubTask 17.4: 实现时间段编辑和删除

- [x] Task 18: 扩展任务创建/编辑表单
  - [x] SubTask 18.1: 添加任务类型选择
  - [x] SubTask 18.2: 添加总时长输入
  - [x] SubTask 18.3: 添加进度模式选择
  - [x] SubTask 18.4: 添加依赖任务选择器
  - [x] SubTask 18.5: 添加上下文描述输入

- [x] Task 19: 扩展任务列表/卡片组件
  - [x] SubTask 19.1: 显示任务类型标识
  - [x] SubTask 19.2: 显示进度百分比
  - [x] SubTask 19.3: 显示依赖状态指示
  - [x] SubTask 19.4: 显示周期标识

## Phase 6: 集成与测试

- [ ] Task 20: 集成测试
  - [ ] SubTask 20.1: 测试任务依赖创建和删除
  - [ ] SubTask 20.2: 测试循环依赖检测
  - [ ] SubTask 20.3: 测试周期任务实例生成
  - [ ] SubTask 20.4: 测试进度计划创建和更新
  - [ ] SubTask 20.5: 测试时间设置保存和读取

- [ ] Task 21: E2E 测试
  - [ ] SubTask 21.1: 测试创建长期任务并设置进度计划
  - [ ] SubTask 21.2: 测试创建任务依赖关系
  - [ ] SubTask 21.3: 测试创建周期性任务
  - [ ] SubTask 21.4: 测试设置用户可用时间

---

# Task Dependencies

- Task 6 依赖 Task 1-5（数据库结构完成后才能定义 Schema）
- Task 7-11 依赖 Task 6（Schema 定义完成后才能实现 API）
- Task 12 依赖 Task 6（后端 Schema 完成后定义前端类型）
- Task 13 依赖 Task 12（类型定义完成后实现 API 服务）
- Task 14-19 依赖 Task 13（API 服务完成后开发 UI）
- Task 20-21 依赖 Task 14-19（UI 完成后进行测试）

# Parallel Execution

以下任务可以并行执行：
- Task 1-5（数据库表创建）可以并行
- Task 7-11（API 实现）在 Task 6 完成后可以并行
- Task 14-19（UI 组件）在 Task 13 完成后可以并行
- Task 20 和 Task 21 可以并行
