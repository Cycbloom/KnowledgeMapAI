# 领域图谱扩展功能 - 实现计划

## [ ] Task 1: 增强后端 API - 支持从现有图谱扩展
- **Priority**: P0
- **Depends On**: None
- **Description**: 
  - 在 `api/routes/graphs.ts` 中添加新的端点 `POST /graphs/domain/expand`
  - 接收参数：`graph_ids`（要扩展的图谱ID列表）、`count`（推荐数量）
  - 获取选中图谱的详细信息（标题、描述、领域等）
  - 构建 AI 提示词，基于选中图谱推荐相关的新图谱
  - 调用现有的去重逻辑
  - 返回推荐图谱列表和关系
- **Acceptance Criteria Addressed**: [AC-3, AC-4]
- **Test Requirements**:
  - `programmatic` TR-1.1: 新端点能正确接收和验证参数
  - `programmatic` TR-1.2: 能正确获取选中图谱的信息
  - `programmatic` TR-1.3: AI 能基于选中图谱生成相关推荐
  - `programmatic` TR-1.4: 去重逻辑能正确检测已存在的图谱
- **Notes**: 复用现有的 `analyzeDomainSchema` 和 `batchCreateDomainGraphsSchema` 的相关代码

## [ ] Task 2: 增强 DomainGraphGenerator - 添加模式选择
- **Priority**: P0
- **Depends On**: [Task 1]
- **Description**: 
  - 在 `DomainGraphGenerator.tsx` 中添加模式选择（"从零开始" vs "从现有图谱扩展"）
  - 添加现有图谱列表选择器组件
  - 显示用户的所有图谱供选择
  - 支持多选（最多 5 个）
  - 显示图谱卡片展示：标题、描述、节点数量
- **Acceptance Criteria Addressed**: [AC-1, AC-2]
- **Test Requirements**:
  - `programmatic` TR-2.1: 模式选择器能正确显示
  - `programmatic` TR-2.2: 现有图谱列表能正确加载和显示
  - `programmatic` TR-2.3: 支持多选功能正常
  - `human-judgement` TR-2.4: UI 清晰直观
- **Notes**: 复用现有的图谱选择相关组件

## [ ] Task 3: 增强 DomainGraphGenerator - 集成扩展模式的推荐生成
- **Priority**: P0
- **Depends On**: [Task 2]
- **Description**: 
  - 在扩展模式下，调用新的 `/graphs/domain/expand` 端点
  - 显示推荐列表
  - 清晰标识已存在的图谱（灰色、默认不选中）
  - 新推荐的图谱正常显示（可选中）
  - 保持与现有推荐列表相同的 UI
- **Acceptance Criteria Addressed**: [AC-5]
- **Test Requirements**:
  - `programmatic` TR-3.1: 能正确调用新的 API 端点
  - `programmatic` TR-3.2: 推荐列表正确显示
  - `human-judgement` TR-3.3: 已存在图谱的标识清晰
  - `human-judgement` TR-3.4: 默认选中状态正确
- **Notes**: 复用现有的推荐列表展示逻辑

## [ ] Task 4: 增强去重检测 - 内容相似度
- **Priority**: P1
- **Depends On**: [Task 1]
- **Description**: 
  - 增强后端去重逻辑，不仅检查标题
  - 考虑描述的文本相似度（可以使用简单的字符串相似度算法）
  - 或使用已有的嵌入向量（如果有的话）
  - 更新 API 返回更准确的去重结果
- **Acceptance Criteria Addressed**: [AC-4]
- **Test Requirements**:
  - `programmatic` TR-4.1: 标题相同的检测正常
  - `programmatic` TR-4.2: 内容相似的检测正常
  - `programmatic` TR-4.3: 去重准确率满足要求
- **Notes**: 可以先用简单的 Levenshtein 距离或 Jaccard 相似度

## [ ] Task 5: 集成和测试
- **Priority**: P0
- **Depends On**: [Task 3, Task 4]
- **Description**: 
  - 完整的端到端测试
  - 确保从零开始模式仍然正常工作
  - 确保从现有图谱扩展模式正常工作
  - 确保批量创建功能正常
  - 性能测试（确保响应时间在可接受范围内）
- **Acceptance Criteria Addressed**: [AC-6]
- **Test Requirements**:
  - `programmatic` TR-5.1: 从零开始模式功能正常
  - `programmatic` TR-5.2: 从现有图谱扩展模式功能正常
  - `programmatic` TR-5.3: 批量创建功能正常
  - `programmatic` TR-5.4: 性能符合要求
- **Notes**: 使用现有的 Playwright 测试框架
