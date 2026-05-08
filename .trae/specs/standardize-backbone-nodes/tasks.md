# Tasks

## Phase 1: 类型定义与常量

- [x] Task 1: 定义骨干节点枚举和常量
  - [x] SubTask 1.1: 在 `shared/types/graph.ts` 中定义 `BackboneModule` 枚举类型
  - [x] SubTask 1.2: 定义 `BACKBONE_MODULE_TITLES` 标题映射常量
  - [x] SubTask 1.3: 定义 `BACKBONE_MODULE_ICONS` 图标映射常量
  - [x] SubTask 1.4: 定义 `BACKBONE_MODULE_DESCRIPTIONS` 描述映射常量
  - [x] SubTask 1.5: 扩展 `NodeProperties` 接口，添加 `backboneModule` 可选字段
  - [x] SubTask 1.6: 编写类型定义单元测试

## Phase 2: 后端验证服务

- [x] Task 2: 创建骨干节点验证服务
  - [x] SubTask 2.1: 创建 `api/services/graph/backboneValidatorService.ts`
  - [x] SubTask 2.2: 实现 `validateBackboneNodeTitle` 方法，验证标题是否符合标准
  - [x] SubTask 2.3: 实现 `correctBackboneNodeTitle` 方法，自动修正标题
  - [x] SubTask 2.4: 实现 `validateBackboneModule` 方法，验证枚举值有效性
  - [x] SubTask 2.5: 实现 `isBackboneNode` 方法，判断节点是否为骨干节点
  - [x] SubTask 2.6: 编写验证服务单元测试

- [x] Task 3: 创建骨干节点验证 API
  - [x] SubTask 3.1: 在 `api/routes/graph.ts` 添加验证接口
  - [x] SubTask 3.2: 实现 `POST /api/graphs/:graphId/nodes/validate-backbone` 接口
  - [x] SubTask 3.3: 添加请求验证 schema
  - [x] SubTask 3.4: 编写 API 集成测试

## Phase 3: AI 生成增强

- [x] Task 4: 增强骨干网络生成服务
  - [x] SubTask 4.1: 更新 `api/services/ai/backboneNetworkService.ts`
  - [x] SubTask 4.2: 在 prompt 中明确要求使用标准标题
  - [x] SubTask 4.3: 在生成后调用验证服务验证标题
  - [x] SubTask 4.4: 自动修正不符合标准的标题
  - [x] SubTask 4.5: 为每个骨干节点设置 `backboneModule` 属性
  - [x] SubTask 4.6: 添加生成日志记录，监控 AI 标题生成质量
  - [x] SubTask 4.7: 编写生成服务测试

- [x] Task 5: 更新模板生成服务
  - [x] SubTask 5.1: 更新 `api/services/ai/templateGeneratorService.ts`
  - [x] SubTask 5.2: 更新 `template_type_topic_research` prompt 模板
  - [x] SubTask 5.3: 确保模板生成使用标准标题
  - [x] SubTask 5.4: 测试模板生成流程

## Phase 4: 数据库迁移

- [x] Task 6: 创建数据库迁移脚本
  - [x] SubTask 6.1: 创建迁移脚本为现有骨干节点添加 `backboneModule` 属性
  - [x] SubTask 6.2: 编写 SQL 脚本识别现有骨干节点（基于标题匹配）
  - [x] SubTask 6.3: 编写 SQL 脚本更新节点属性
  - [x] SubTask 6.4: 测试迁移脚本

## Phase 5: 前端组件开发

- [x] Task 7: 创建骨干节点图标组件
  - [x] SubTask 7.1: 创建 `src/components/GraphEditor/BackboneNodeIcon.tsx`
  - [x] SubTask 7.2: 实现图标映射逻辑
  - [x] SubTask 7.3: 支持不同尺寸（small、medium、large）
  - [x] SubTask 7.4: 添加 tooltip 显示模块类型
  - [x] SubTask 7.5: 编写组件测试

- [x] Task 8: 增强节点渲染器
  - [x] SubTask 8.1: 更新 `src/components/GraphEditor/NodeRenderer.tsx`
  - [x] SubTask 8.2: 检测节点是否包含 `backboneModule` 属性
  - [x] SubTask 8.3: 为骨干节点渲染专属图标
  - [x] SubTask 8.4: 调整骨干节点样式（可选：边框、背景色等）
  - [x] SubTask 8.5: 测试节点渲染效果

- [x] Task 9: 增强节点编辑面板
  - [x] SubTask 9.1: 更新 `src/components/GraphEditor/NodeEditPanel.tsx`
  - [x] SubTask 9.2: 检测节点是否为骨干节点
  - [x] SubTask 9.3: 为骨干节点标题输入框设置为只读
  - [x] SubTask 9.4: 显示提示信息："骨干节点标题不可修改"
  - [x] SubTask 9.5: 保持其他属性可编辑
  - [x] SubTask 9.6: 测试编辑限制功能

- [x] Task 10: 创建前端验证服务
  - [x] SubTask 10.1: 创建 `src/services/backboneValidator.ts`
  - [x] SubTask 10.2: 实现 `isBackboneNode` 方法
  - [x] SubTask 10.3: 实现 `getBackboneModuleTitle` 方法
  - [x] SubTask 10.4: 实现 `getBackboneModuleIcon` 方法
  - [x] SubTask 10.5: 编写服务测试

## Phase 6: API 保护机制

- [x] Task 11: 增强 API 保护机制
  - [x] SubTask 11.1: 更新 `api/routes/graph.ts` 节点更新接口
  - [x] SubTask 11.2: 在更新节点前检查是否为骨干节点
  - [x] SubTask 11.3: 如果尝试修改骨干节点标题，拒绝请求
  - [x] SubTask 11.4: 返回友好的错误信息
  - [x] SubTask 11.5: 测试 API 保护机制

- [x] Task 12: 批量操作保护
  - [x] SubTask 12.1: 更新批量节点更新接口
  - [x] SubTask 12.2: 过滤骨干节点的标题修改
  - [x] SubTask 12.3: 返回跳过提示信息
  - [x] SubTask 12.4: 测试批量操作保护

## Phase 7: 兼容性处理

- [x] Task 13: 现有图谱兼容性处理
  - [x] SubTask 13.1: 创建 `src/components/GraphEditor/BackboneCompatibilityChecker.tsx`
  - [x] SubTask 13.2: 检测现有图谱骨干节点是否缺少 `backboneModule` 属性
  - [x] SubTask 13.3: 自动补充缺失的属性
  - [x] SubTask 13.4: 检测标题是否符合标准
  - [x] SubTask 13.5: 提示用户是否标准化标题
  - [x] SubTask 13.6: 用户确认后执行标准化
  - [x] SubTask 13.7: 测试兼容性处理流程

## Phase 8: 国际化支持

- [x] Task 14: 添加国际化支持
  - [x] SubTask 14.1: 在 `src/i18n/locales/zh-CN.json` 添加骨干节点相关翻译
  - [x] SubTask 14.2: 在 `src/i18n/locales/en-US.json` 添加英文翻译
  - [x] SubTask 14.3: 添加错误提示翻译
  - [x] SubTask 14.4: 测试国际化显示

## Phase 9: 测试与文档

- [x] Task 15: 编写 E2E 测试
  - [x] SubTask 15.1: 测试专题研究图谱初始化，验证骨干节点标题标准化
  - [x] SubTask 15.2: 测试骨干节点图标显示
  - [x] SubTask 15.3: 测试骨干节点标题修改限制
  - [x] SubTask 15.4: 测试 API 保护机制
  - [x] SubTask 15.5: 测试现有图谱兼容性处理
  - [x] SubTask 15.6: 测试批量操作保护

# Task Dependencies

- Task 1 是基础，所有其他任务依赖类型定义
- Task 2-3 可以并行（验证服务和 API）
- Task 4-5 依赖 Task 2（AI 生成需要验证服务）
- Task 6 可以与 Task 4-5 并行
- Task 7-10 依赖 Task 1（前端组件需要类型定义）
- Task 11-12 依赖 Task 2（API 保护需要验证服务）
- Task 13 依赖 Task 1 和 Task 11
- Task 14 可以与 Task 7-10 并行
- Task 15 依赖所有功能完成
