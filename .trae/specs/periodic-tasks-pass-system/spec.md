# 周期任务与通行证系统 Spec

## Why

现有成就系统仅有终身成就和每日任务，缺乏中期激励目标。用户完成每日任务后缺乏持续动力，需要引入周期性任务和通行证系统，通过游戏化机制增加学习乐趣和持续激励。

## What Changes

- 新增**周期任务系统**：每周任务、每月任务、每季度任务
- 新增**周期通行证系统**：每个周期一个通行证，完成任务获得通行证积分，解锁混合奖励序列
- 新增**连续完成奖励**：周期连续奖励 + 每日连续奖励
- 扩展成就系统：新增周期成就类型

## Impact

- Affected specs: 成就系统、用户激励系统
- Affected code:
  - `api/services/achievementService.ts`
  - `api/routes/achievements.ts`
  - `src/pages/Achievements.tsx`
  - 数据库新增表：`periodic_tasks`、`periodic_passes`、`pass_rewards`、`user_pass_progress`

---

## ADDED Requirements

### Requirement: 周期任务系统

系统应提供周期性任务功能，支持每周、每月、每季度三种周期类型。

#### Scenario: 创建周期任务
- **WHEN** 新的周期开始时
- **THEN** 系统自动为用户创建该周期的任务列表

#### Scenario: 更新周期任务进度
- **WHEN** 用户完成相关行为（专注、学习、创造、完成任务）
- **THEN** 系统自动更新对应周期任务的进度

#### Scenario: 周期任务重置
- **WHEN** 周期结束时
- **THEN** 系统计算任务完成情况，重置下一周期任务

### Requirement: 周期任务内容类型

周期任务应包含以下内容类型：

| 类型 | 周任务示例 | 月任务示例 | 季度任务示例 |
|------|-----------|-----------|-------------|
| 专注类 | 本周专注 10 小时 | 本月专注 40 小时 | 本季度专注 120 小时 |
| 学习类 | 本周复习 100 张卡片 | 本月掌握 50 张卡片 | 本季度掌握 150 张卡片 |
| 创造类 | 本周创建 10 个节点 | 本月创建 50 个节点 | 本季度创建 150 个节点 |
| 任务类 | 本周完成 15 个任务 | 本月完成 60 个任务 | 本季度完成 180 个任务 |

### Requirement: 周期通行证系统

系统应提供周期通行证功能，每个周期一个通行证。

#### Scenario: 通行证积分获取
- **WHEN** 用户完成周期任务
- **THEN** 用户获得通行证积分（每完成一个任务获得固定积分）

#### Scenario: 通行证等级解锁
- **WHEN** 用户积分达到等级阈值
- **THEN** 自动解锁该等级的奖励

#### Scenario: 奖励领取
- **WHEN** 用户点击领取奖励
- **THEN** 发放 XP 或成就到用户账户

### Requirement: 通行证奖励序列

通行证奖励采用混合奖励序列，每级通行证包含以下奖励类型：

| 等级范围 | 奖励类型 |
|---------|---------|
| 1-5 级 | XP 奖励（50-100 XP） |
| 6-10 级 | XP 奖励 + 小型成就徽章 |
| 11-15 级 | XP 奖励（150-200 XP） |
| 16-20 级 | XP 奖励 + 稀有成就徽章 |

每个周期通行证共 15-20 级。

### Requirement: 连续完成奖励

系统应提供两种连续完成奖励机制。

#### Scenario: 周期连续奖励
- **WHEN** 用户连续完成 N 个周期的所有任务
- **THEN** 获得额外 XP 奖励
  - 连续 4 周：+100 XP
  - 连续 3 个月：+300 XP
  - 连续 4 个季度：+1000 XP

#### Scenario: 每日连续奖励
- **WHEN** 用户连续 N 天完成所有每日任务
- **THEN** 获得额外 XP 奖励
  - 连续 7 天：+50 XP
  - 连续 14 天：+100 XP
  - 连续 30 天：+300 XP

### Requirement: 进度显示

周期任务应显示进度条和数字。

#### Scenario: 进度展示
- **WHEN** 用户查看周期任务
- **THEN** 显示「当前进度/目标值」和进度条百分比

### Requirement: 数据库设计

新增以下数据表：

#### periodic_tasks 表
```sql
CREATE TABLE periodic_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  period_type TEXT NOT NULL, -- 'weekly' | 'monthly' | 'quarterly'
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  task_type TEXT NOT NULL, -- 'focus' | 'study' | 'create' | 'tasks'
  target INTEGER NOT NULL,
  progress INTEGER DEFAULT 0,
  status TEXT DEFAULT 'pending', -- 'pending' | 'completed'
  xp_reward INTEGER NOT NULL,
  pass_points INTEGER NOT NULL, -- 通行证积分
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

#### periodic_passes 表
```sql
CREATE TABLE periodic_passes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  period_type TEXT NOT NULL,
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  total_points INTEGER DEFAULT 0,
  current_level INTEGER DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, period_type, period_start)
);
```

#### pass_rewards 表
```sql
CREATE TABLE pass_rewards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  period_type TEXT NOT NULL,
  level INTEGER NOT NULL,
  points_required INTEGER NOT NULL,
  reward_type TEXT NOT NULL, -- 'xp' | 'achievement' | 'badge'
  reward_value INTEGER, -- XP 数量
  achievement_code TEXT, -- 成就代码（如果是成就奖励）
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(period_type, level)
);
```

#### user_pass_progress 表
```sql
CREATE TABLE user_pass_progress (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  pass_id UUID REFERENCES periodic_passes(id) ON DELETE CASCADE,
  level INTEGER NOT NULL,
  claimed BOOLEAN DEFAULT FALSE,
  claimed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(pass_id, level)
);
```

#### user_streaks 表（扩展现有）
```sql
-- 添加周期连续记录字段
ALTER TABLE user_focus_stats ADD COLUMN IF NOT EXISTS weekly_streak INTEGER DEFAULT 0;
ALTER TABLE user_focus_stats ADD COLUMN IF NOT EXISTS monthly_streak INTEGER DEFAULT 0;
ALTER TABLE user_focus_stats ADD COLUMN IF NOT EXISTS quarterly_streak INTEGER DEFAULT 0;
ALTER TABLE user_focus_stats ADD COLUMN IF NOT EXISTS daily_task_streak INTEGER DEFAULT 0;
ALTER TABLE user_focus_stats ADD COLUMN IF NOT EXISTS last_daily_completion DATE;
```

---

## MODIFIED Requirements

### Requirement: 成就页面扩展

现有成就页面需要扩展以展示周期任务和通行证。

#### Scenario: 页面布局
- **WHEN** 用户访问成就页面
- **THEN** 显示以下标签页：
  1. 每日任务（现有）
  2. 周期任务（新增）
  3. 通行证（新增）
  4. 终身成就（现有）

### Requirement: 成就服务扩展

现有成就服务需要扩展以支持周期任务。

#### Scenario: 任务进度更新
- **WHEN** 用户完成学习/专注/创造行为
- **THEN** 同时更新每日任务、周期任务进度
