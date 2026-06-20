# FSRS 参数个性化与 FSRS-6 难度衰减 Spec

## Why

当前系统所有用户共享相同的 FSRS 默认参数（21 个 w 值），无法根据个人记忆特征调整复习间隔。同时，ts-fsrs 5.3.1 已内置 FSRS-6 的难度衰减参数（w[20]=0.1542）和幂律遗忘曲线，但项目仅使用 `request_retention` 和 `maximum_interval` 两个参数覆盖，未利用 w 数组的个性化能力和 FSRS-6 的衰减机制。此外，`masteryDecayService` 仍使用旧指数衰减公式 `e^(-days/S)`，与 ts-fsrs 内置的 FSRS-6 幂律遗忘曲线 `(1 + FACTOR * t / (9*S))^DECAY` 不一致。

## What Changes

- 在 `users.settings` 中新增 `fsrs_parameters` 字段，存储用户个性化的 FSRS w 参数数组
- 修改 `getFSRS()` 函数，从用户设置中读取个性化 w 参数并传入 `fsrs()`
- 新增 `fsrsParameterService`，提供参数优化入口：收集用户复习历史 → 调用优化算法 → 存储优化参数
- 实现轻量级参数优化算法（基于用户复习历史数据的梯度下降），替代不存在的 ts-fsrs-optimizer
- 修改 `masteryDecayService.calculateDecay()`，使用 ts-fsrs 的 `forgetting_curve()` 替代手写的指数衰减公式，确保与 FSRS-6 幂律曲线一致
- 修改 `spacedRepetitionBridge` 中的 masteryLevel 估算，使用 `forgetting_curve` 替代 `stability/30` 的线性估算
- 新增 API 端点：触发参数优化、获取/设置 FSRS 参数、重置为默认参数
- 新增前端设置面板：FSRS 参数展示与手动调整、优化触发按钮

## Impact

- Affected specs: study 模块、scheduler 模块、用户设置
- Affected code:
  - `api/services/study/studyService.ts` — getFSRS() 函数，需读取用户 w 参数
  - `api/services/scheduler/masteryDecayService.ts` — 衰减计算改用 forgetting_curve
  - `api/services/study/spacedRepetitionBridge.ts` — masteryLevel 估算改用 forgetting_curve
  - `api/services/study/masteryCalculationService.ts` — retrievability 聚合需考虑 FSRS-6 曲线
  - `shared/types/scheduler.ts` — FsrsParamOverride 扩展
  - `shared/constants/studyModePresets.ts` — 预设参数可能需要调整
  - `supabase/migrations/` — users 表 settings 字段扩展（JSONB 内新增键）
  - `src/pages/Settings.tsx` — 新增 FSRS 参数设置 UI

## ADDED Requirements

### Requirement: 用户级 FSRS 参数存储

系统 SHALL 支持为每个用户存储个性化的 FSRS w 参数数组。

#### Scenario: 新用户使用默认参数
- **WHEN** 新用户首次使用系统
- **THEN** 该用户的 `fsrs_parameters` 为 null，系统使用 ts-fsrs 的 `default_w`（21 个参数）

#### Scenario: 用户有个性化参数
- **WHEN** 用户的 `settings.fsrs_parameters` 包含有效的 w 数组
- **THEN** `getFSRS()` 使用该数组创建 FSRS 实例，而非默认参数

#### Scenario: 参数长度兼容
- **WHEN** 存储的 w 数组长度为 17 或 19（旧版参数）
- **THEN** 系统通过 `migrateParameters()` 自动迁移到 21 参数，并更新存储

### Requirement: FSRS-6 遗忘曲线统一

系统 SHALL 在所有遗忘曲线计算中使用 ts-fsrs 的 `forgetting_curve()` 函数，确保与 FSRS-6 幂律公式一致。

#### Scenario: masteryDecayService 使用 FSRS-6 曲线
- **WHEN** `masteryDecayService.calculateDecay()` 计算衰减后的掌握度
- **THEN** 使用 `forgetting_curve(w_parameters, elapsed_days, stability)` 替代 `e^(-days/stability)`

#### Scenario: spacedRepetitionBridge 使用 FSRS-6 曲线
- **WHEN** `spacedRepetitionBridge` 估算卡片的 masteryLevel
- **THEN** 使用 `forgetting_curve()` 计算 retrievability，替代 `stability/30` 的线性估算

### Requirement: 轻量级参数优化

系统 SHALL 提供基于用户复习历史数据的 FSRS 参数优化功能。

#### Scenario: 触发参数优化
- **WHEN** 用户通过设置面板或 API 触发参数优化
- **THEN** 系统收集该用户最近 N 条复习记录（rating + elapsed_days + scheduled_days），运行优化算法，将优化后的 w 参数存入 `settings.fsrs_parameters`

#### Scenario: 复习数据不足时
- **WHEN** 用户的复习记录少于 100 条
- **THEN** 系统返回提示"复习数据不足，继续使用默认参数"，不执行优化

#### Scenario: 优化后参数验证
- **WHEN** 优化算法输出新的 w 参数
- **THEN** 系统通过 `checkParameters()` 验证参数合法性，验证通过后存储；验证失败则保留原参数

### Requirement: FSRS 参数设置 API

系统 SHALL 提供 FSRS 参数管理的 API 端点。

#### Scenario: 获取当前 FSRS 参数
- **WHEN** 用户请求 GET `/api/study/fsrs-parameters`
- **THEN** 返回当前使用的 w 参数数组、参数来源（default/custom/optimized）、上次优化时间

#### Scenario: 手动设置 FSRS 参数
- **WHEN** 用户请求 PUT `/api/study/fsrs-parameters` 并提供 w 数组
- **THEN** 系统验证参数合法性后存储，并标记来源为 custom

#### Scenario: 重置为默认参数
- **WHEN** 用户请求 DELETE `/api/study/fsrs-parameters`
- **THEN** 清除 `settings.fsrs_parameters`，后续使用 default_w

#### Scenario: 触发参数优化
- **WHEN** 用户请求 POST `/api/study/fsrs-parameters/optimize`
- **THEN** 异步执行优化，返回任务 ID，优化完成后更新参数

### Requirement: FSRS 参数设置 UI

系统 SHALL 在设置页面提供 FSRS 参数管理界面。

#### Scenario: 查看当前参数
- **WHEN** 用户打开设置页面的"学习算法"部分
- **THEN** 显示当前 FSRS 参数来源（默认/自定义/优化）、request_retention 值、上次优化时间

#### Scenario: 触发优化
- **WHEN** 用户点击"优化参数"按钮
- **THEN** 显示优化进度，完成后展示优化前后的参数对比

#### Scenario: 重置参数
- **WHEN** 用户点击"重置为默认"按钮
- **THEN** 弹出确认对话框，确认后清除个性化参数

## MODIFIED Requirements

### Requirement: getFSRS() 参数加载

**原**：`getFSRS()` 仅从 `users.settings` 读取 `request_retention` 和 `maximum_interval`，其余参数使用库默认值。

**新**：`getFSRS()` 从 `users.settings` 读取 `request_retention`、`maximum_interval` 和 `fsrs_parameters`（w 数组），通过 `generatorParameters()` 构建完整参数。若 `fsrs_parameters` 为 null，使用 `default_w`。

### Requirement: masteryDecayService 衰减计算

**原**：使用 `e^(-days/stability)` 指数衰减公式计算 retrievability。

**新**：使用 ts-fsrs 的 `forgetting_curve(w_parameters, elapsed_days, stability)` FSRS-6 幂律公式计算 retrievability，确保与 FSRS 调度算法使用同一遗忘曲线。

### Requirement: FsrsParamOverride 类型

**原**：`FsrsParamOverride` 仅包含 `request_retention` 和 `maximum_interval`。

**新**：`FsrsParamOverride` 新增可选的 `w: number[]` 字段，支持传入完整的 w 参数数组。

## REMOVED Requirements

（无移除项）
