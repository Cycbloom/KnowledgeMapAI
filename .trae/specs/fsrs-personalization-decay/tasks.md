# Tasks

- [x] Task 1: 统一遗忘曲线为 FSRS-6 幂律公式
  - [x] SubTask 1.1: 修改 `masteryDecayService.calculateDecay()`，使用 ts-fsrs 的 `forgetting_curve()` 替代手写的 `e^(-days/stability)` 指数衰减
  - [x] SubTask 1.2: 修改 `spacedRepetitionBridge.getFSRSReviewQueue()` 中的 masteryLevel 估算，使用 `fsrs_retrievability` 字段替代 `stability/30` 线性估算
  - [x] SubTask 1.3: 确保 `masteryDecayService` 在无 FSRS 数据时仍能降级计算（使用 easeFactor 估算）

- [x] Task 2: 扩展 FSRS 参数存储与加载
  - [x] SubTask 2.1: 扩展 `FsrsParamOverride` 类型，新增可选的 `w: number[]` 字段
  - [x] SubTask 2.2: 修改 `getFSRS()` 函数，从 `users.settings` 读取 `fsrs_parameters`（w 数组），通过 `generatorParameters()` 构建完整参数
  - [x] SubTask 2.3: 处理参数迁移：若存储的 w 数组长度为 17 或 19，通过 `migrateParameters()` 自动迁移到 21 参数
  - [x] SubTask 2.4: 修改 `studyModePresets.ts`，预设的 `fsrsOverride` 支持传入 w 参数子集（FsrsParamOverride 类型已扩展，预设无需修改）

- [x] Task 3: 实现 FSRS 参数优化服务
  - [x] SubTask 3.1: 创建 `api/services/study/fsrsParameterService.ts`，实现参数优化核心逻辑
  - [x] SubTask 3.2: 实现复习历史数据收集：从 study_cards 聚合用户的 (rating, elapsed_days, scheduled_days) 三元组
  - [x] SubTask 3.3: 实现轻量级优化算法：基于收集的复习数据，使用梯度下降最小化预测误差，输出优化后的 w 参数
  - [x] SubTask 3.4: 实现参数验证：通过 `checkParameters()` 验证优化结果合法性
  - [x] SubTask 3.5: 实现参数存储：将优化后的 w 数组写入 `users.settings.fsrs_parameters`，记录来源为 "optimized" 和优化时间

- [x] Task 4: 新增 FSRS 参数管理 API
  - [x] SubTask 4.1: 新增 GET `/api/study/fsrs-parameters` 端点，返回当前参数、来源、上次优化时间
  - [x] SubTask 4.2: 新增 PUT `/api/study/fsrs-parameters` 端点，手动设置 w 参数（标记来源为 custom）
  - [x] SubTask 4.3: 新增 DELETE `/api/study/fsrs-parameters` 端点，重置为默认参数
  - [x] SubTask 4.4: 新增 POST `/api/study/fsrs-parameters/optimize` 端点，触发异步参数优化
  - [x] SubTask 4.5: 在 `api/routes/study.ts` 中注册新路由

- [x] Task 5: 前端 FSRS 参数设置 UI
  - [x] SubTask 5.1: 在 Settings 页面新增"学习算法"设置区域
  - [x] SubTask 5.2: 展示当前参数来源（默认/自定义/优化）、request_retention 值、上次优化时间
  - [x] SubTask 5.3: 添加"优化参数"按钮，触发优化并展示进度和结果对比
  - [x] SubTask 5.4: 添加"重置为默认"按钮
  - [x] SubTask 5.5: 前端 API 层新增对应的方法（studyApi + IStudyApi 接口 + mobile 层）

- [x] Task 6: 集成测试与验证
  - [x] SubTask 6.1: 验证 `masteryDecayService.calculateDecay()` 使用 FSRS-6 曲线后结果与 `forgetting_curve()` 一致
  - [x] SubTask 6.2: 验证 `getFSRS()` 正确加载用户个性化参数
  - [x] SubTask 6.3: 验证参数优化流程：数据收集 → 优化 → 验证 → 存储
  - [x] SubTask 6.4: 验证 API 端点的正确性和安全性（参数验证、权限检查）
  - [x] SubTask 6.5: 运行 `npm run check` 和 `npm run lint` 确保无类型错误和代码规范问题

# Task Dependencies
- [Task 2] depends on [Task 1] (遗忘曲线统一后再扩展参数加载，确保一致性)
- [Task 3] depends on [Task 2] (优化服务需要参数加载机制)
- [Task 4] depends on [Task 3] (API 端点需要优化服务)
- [Task 5] depends on [Task 4] (前端 UI 需要 API 端点)
- [Task 6] depends on [Task 1, Task 2, Task 3, Task 4, Task 5]
- [Task 1] 可独立开始
