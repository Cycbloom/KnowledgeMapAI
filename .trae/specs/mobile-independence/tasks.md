# 移动端独立运行 - 实现计划

## [x] 任务 1: 更新移动端配置和环境检测
- **Priority**: P0
- **Depends On**: None
- **Description**: 
  - 更新 `mobileApiConfig.ts`，移除硬编码的本地后端地址
  - 实现环境检测逻辑，区分移动端（Capacitor）和 Web/桌面端
  - 配置移动端直接使用 Supabase 的模式
- **Acceptance Criteria Addressed**: [AC-1]
- **Test Requirements**:
  - `programmatic` TR-1.1: 在 Capacitor 环境下正确检测为移动端
  - `programmatic` TR-1.2: 在 Web 环境下正确检测为非移动端
  - `programmatic` TR-1.3: 移动端模式下不使用本地后端地址
- **Status**: ✅ 已完成

## [x] 任务 2: 创建移动端 Supabase 数据访问层
- **Priority**: P0
- **Depends On**: [任务 1]
- **Description**: 
  - 创建新的移动端数据访问服务层
  - 实现基于 Supabase SDK 的 CRUD 操作（图谱、节点、边等）
  - 封装与现有 API 接口兼容的方法，便于切换
- **Acceptance Criteria Addressed**: [AC-2, AC-3]
- **Test Requirements**:
  - `programmatic` TR-2.1: 可以使用 Supabase Auth 进行登录
  - `programmatic` TR-2.2: 可以创建、读取、更新、删除图谱
  - `programmatic` TR-2.3: 可以创建、读取、更新、删除节点和边
  - `programmatic` TR-2.4: 数据操作正确保存到 Supabase
- **Status**: ✅ 已完成

## [x] 任务 3: 更新 React Query hooks 支持移动端模式
- **Priority**: P0
- **Depends On**: [任务 2]
- **Description**: 
  - 修改现有的 queries 和 mutations hooks
  - 添加环境检测，在移动端使用 Supabase 数据访问层
  - 保持现有 API 不变，确保桌面端/Web 端继续正常工作
- **Acceptance Criteria Addressed**: [AC-3]
- **Test Requirements**:
  - `programmatic` TR-3.1: 移动端模式下使用 Supabase 数据层
  - `programmatic` TR-3.2: 桌面端/Web 端继续使用原有 API
  - `programmatic` TR-3.3: 所有现有功能在移动端正常工作
- **Status**: ✅ 已完成

## [x] 任务 4: 实现 Supabase Realtime 数据同步
- **Priority**: P1
- **Depends On**: [任务 3]
- **Description**: 
  - 集成 Supabase Realtime 订阅
  - 实现数据变更监听和本地状态更新
  - 处理与桌面端/Web 端的实时同步
- **Acceptance Criteria Addressed**: [AC-4]
- **Test Requirements**:
  - `programmatic` TR-4.1: 可以订阅 Supabase Realtime 变更
  - `programmatic` TR-4.2: 其他设备的变更可以实时反映在移动端
  - `programmatic` TR-4.3: 移动端的变更可以实时反映在其他设备
- **Status**: ✅ 已完成

## [x] 任务 5: 配置移动端 AI API 访问
- **Priority**: P1
- **Depends On**: [任务 1]
- **Description**: 
  - 确保移动端可以直接访问云 AI API
  - 更新 AI 相关的 API 调用代码
  - 配置必要的 CORS 和认证
- **Acceptance Criteria Addressed**: [AC-5]
- **Test Requirements**:
  - `programmatic` TR-5.1: 移动端可以调用 AI 内容生成 API
  - `programmatic` TR-5.2: 移动端可以调用 AI 问答 API
  - `programmatic` TR-5.3: AI 功能返回结果正常
- **Status**: ✅ 已完成

## [x] 任务 6: 优化移动端网络状态和离线体验
- **Priority**: P1
- **Depends On**: [任务 3]
- **Description**: 
  - 完善 Capacitor Network 插件的使用
  - 实现网络状态变化监听和 UI 提示
  - 优化离线时使用 IndexedDB 缓存数据
- **Acceptance Criteria Addressed**: [AC-6]
- **Test Requirements**:
  - `human-judgement` TR-6.1: 网络状态变化时显示正确的提示
  - `programmatic` TR-6.2: 离线时可以查看已缓存的数据
  - `human-judgement` TR-6.3: 离线体验流畅，无错误提示
- **Status**: ✅ 已完成

## [x] 任务 7: 实现离线操作队列和同步机制
- **Priority**: P1
- **Depends On**: [任务 6]
- **Description**: 
  - 完善离线操作队列功能
  - 实现网络恢复时的自动同步
  - 处理同步冲突（采用最后写入获胜策略）
- **Acceptance Criteria Addressed**: [AC-7]
- **Test Requirements**:
  - `programmatic` TR-7.1: 离线操作正确保存到队列
  - `programmatic` TR-7.2: 网络恢复时自动同步离线操作
  - `programmatic` TR-7.3: 同步成功后清空离线队列
- **Status**: ✅ 已完成

## [x] 任务 8: 更新移动端构建和部署配置
- **Priority**: P2
- **Depends On**: [任务 1-7]
- **Description**: 
  - 更新 `capacitor.config.ts` 配置
  - 更新 `package.json` 中的移动端构建脚本
  - 确保 Android 构建正常工作
- **Acceptance Criteria Addressed**: [AC-1]
- **Test Requirements**:
  - `programmatic` TR-8.1: `npm run mobile:build` 成功执行
  - `programmatic` TR-8.2: `npm run mobile:sync` 成功执行
  - `programmatic` TR-8.3: Android APK 可以正常构建
- **Status**: ✅ 已完成

## [x] 任务 9: 编写和运行移动端端到端测试
- **Priority**: P2
- **Depends On**: [任务 8]
- **Description**: 
  - 更新现有的移动端测试用例
  - 添加新的测试覆盖核心功能
  - 运行测试确保所有功能正常
- **Acceptance Criteria Addressed**: [AC-1, AC-2, AC-3, AC-5, AC-6, AC-7]
- **Test Requirements**:
  - `programmatic` TR-9.1: 所有移动端测试通过
  - `programmatic` TR-9.2: 核心功能测试覆盖完整
  - `programmatic` TR-9.3: 测试可以在 Playwright 中正常运行
- **Status**: ✅ 已完成

## [x] 任务 10: 文档和用户指南
- **Priority**: P2
- **Depends On**: [任务 9]
- **Description**: 
  - 更新项目 README 说明移动端独立功能
  - 添加移动端使用指南
  - 记录架构变更和技术决策
- **Acceptance Criteria Addressed**: [AC-1]
- **Test Requirements**:
  - `human-judgement` TR-10.1: 文档清晰易懂
  - `human-judgement` TR-10.2: 包含移动端使用说明
  - `human-judgement` TR-10.3: 技术文档完整
- **Status**: ✅ 已完成
