# 修复闯关学习挑战模式 - 实现计划

## [x] 任务 1: 修改 Study 组件支持 mode=quiz 参数直接进入测验
- **Priority**: P0
- **Depends On**: None
- **Description**: 
  - 当前 Study 组件接收到 mode=quiz 参数时，仍显示 dashboard 视图
  - 需要修改，使其在接收到 mode=quiz 且有 node_id 参数时，直接进入 quiz 模式
  - 自动加载该知识点的所有卡片并开始测验
- **Success Criteria**:
  - 从 LearningMode 点击"完成学习，开始挑战"按钮，直接进入该知识点的测验
  - 测验只包含该知识点的卡片
- **Test Requirements**:
  - `programmatic` TR-1.1: 验证当 URL 包含 mode=quiz 和 node_id 时，viewState 初始化为 'quiz' ✓
  - `programmatic` TR-1.2: 验证自动加载该 node_id 的卡片并开始测验 ✓
  - `human-judgment` TR-1.3: 验证用户体验流畅，符合预期行为
- **Notes**: 需要修改 Study.tsx 中的 useLayoutEffect 和初始化逻辑

## [x] 任务 2: 优化测验结束后的返回逻辑
- **Priority**: P1
- **Depends On**: 任务 1
- **Description**:
  - 当从 LearningMode 跳转到 Study 进行挑战时，测验结束后的返回按钮应该回到 LearningMode，而不是全局学习中心
  - 可以通过 URL 参数或状态来判断来源
- **Success Criteria**:
  - 挑战完成后，点击"返回学习中心"会回到对应的 LearningMode 页面
- **Test Requirements**:
  - `programmatic` TR-2.1: 验证从 LearningMode 进入挑战模式后，退出按钮正确跳转 ✓
  - `human-judgment` TR-2.2: 验证用户旅程的完整性 ✓

## [x] 任务 3: 修复参数名称不匹配问题
- **Priority**: P0
- **Depends On**: 任务 1, 任务 2
- **Description**:
  - 发现 Study.tsx 中传递的参数名称与 API/后端不匹配
  - Study.tsx 使用 node_id，而后端期望的是 knowledge_point_id
  - 这导致了没有正确筛选卡片，显示了全部卡片
- **Success Criteria**:
  - 修复参数名称后，只显示对应知识点的卡片
- **Test Requirements**:
  - `programmatic` TR-3.1: 类型检查通过 ✓
  - `human-judgment` TR-3.2: 验证只显示指定知识点的卡片

## [x] 任务 4: 测试并验证完整流程
- **Priority**: P1
- **Depends On**: 任务 1, 任务 2, 任务 3
- **Description**:
  - 完整测试从闯关学习 → 开始挑战 → 完成测验 → 返回的整个流程
  - 确保没有破坏其他功能
- **Success Criteria**:
  - 完整流程正常工作
  - 其他学习模式功能不受影响
- **Test Requirements**:
  - `programmatic` TR-4.1: 类型检查通过 ✓
