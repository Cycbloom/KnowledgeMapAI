# 专题研究图谱优化 Spec

## Why
当前"专题研究 (topic_research)"图谱类型已具备骨架模块（6 个标准研究模块）、文献概念提取、AI 自动生成等能力，但存在多个可优化的设计与性能问题：骨架模块 Preset 实际未生效、概念去重仅限单图、缺少研究进度追踪、提取性能瓶颈等，限制了深度学习用户的专题研究效率。

## What Changes
- **修复**：创建 topic_research 图谱时，根据 Preset 选择正确创建骨架模块（当前始终创建 6 个固定模块，忽略 Preset 差异）
- **新增**：研究进度总览面板 — 按骨架模块展示概念覆盖度、文献数量、空白区域
- **优化**：文献概念提取 `/extract` 和 `/apply` 中嵌入向量生成改为批量并发处理，减少 AI API 调用次数
- **新增**：跨图谱概念去重 — `/apply` 时检测用户其他图谱中已有的相似概念，给出合并建议
- **新增**：模块需求分析 API 端点 — 暴露 `detectNewModuleNeeds` 和 `detectModuleOverlap` 到前端
- **新增**：文献库面板 — 在 topic_research 图谱中展示所有已处理文献的清单，支持按模块过滤

## Impact
- Affected specs: concept-dedup-on-save (相关去重机制)
- Affected code:
  - `api/services/graph/graphService.ts` — 创建图谱时 Preset 骨架模块逻辑
  - `api/routes/literature.ts` — 批量嵌入 + 跨图谱去重
  - `api/services/graph/conceptAggregationService.ts` — 跨图谱去重方法
  - `api/services/graph/autoGraphService.ts` — 批量嵌入优化
  - `src/components/LiteratureExtract/` — 新面板组件
  - `src/components/GraphEditor/` — 进度面板组件
  - `shared/types/graph.ts` — 新类型定义

## ADDED Requirements

### Requirement: 骨架模块 Preset 生效
创建 `topic_research` 类型图谱时，系统 SHALL 根据用户选择的 Preset（如 `experimental_science`、`engineering_research` 等）创建对应的模块集合，而非始终使用统一的 6 个标准模块。

#### Scenario: 用户选择"实验科学研究"Preset创建图谱
- **WHEN** 用户创建 topic_research 图谱并选择 `experimental_science` Preset
- **THEN** 系统应创建 6 个实验科学专属模块（实验设计、数据收集、结果分析等），而非通用学术模块

#### Scenario: 用户不选 Preset（默认行为）
- **WHEN** 用户创建 topic_research 图谱但不指定 Preset
- **THEN** 使用 `academic_research` 作为默认 Preset，向后兼容

### Requirement: 研究进度总览
系统 SHALL 为 topic_research 图谱提供研究进度总览功能，按骨架模块统计概念覆盖情况。

#### Scenario: 查看图谱研究进度
- **WHEN** 用户在 topic_research 图谱中打开进度面板
- **THEN** 系统显示每个骨架模块的概念节点数、已处理文献数、模块覆盖率（有内容的节点 / 总节点）

#### Scenario: 识别研究空白
- **WHEN** 某骨架模块的概念节点数为 0 或远低于其他模块
- **THEN** 系统标记该模块为"研究空白"并提示用户补充文献

### Requirement: 批量嵌入向量生成优化
文献概念提取和应用流程中的嵌入向量生成 SHALL 使用批量 API 调用，减少网络往返次数。

#### Scenario: 提取 20 个概念
- **WHEN** 从一篇文献中提取出 20 个概念
- **THEN** 嵌入向量生成应在 1-2 次批量 API 调用内完成，而非 20 次单独调用

#### Scenario: API 批量调用失败回退
- **WHEN** 批量嵌入 API 调用失败
- **THEN** 系统回退到逐个生成模式，确保流程不中断

### Requirement: 跨图谱概念去重
文献概念应用时，系统 SHALL 检测当前概念是否与用户其他图谱中的已有概念高度相似，给出合并建议。

#### Scenario: 跨图谱发现相似概念
- **WHEN** 用户将论文概念应用到 topic_research 图谱 A
- **AND** 用户在图谱 B 中已有相似概念"深度学习"
- **THEN** 系统应在 /extract 响应中标记该概念为"可能重复"，并显示来源图谱信息

#### Scenario: 用户确认合并
- **WHEN** 用户在提取结果中选择"合并到已有概念"
- **THEN** 新概念不创建新节点，而是增加已有概念的来源引用和权重

### Requirement: 模块需求分析 API
系统 SHALL 提供 REST API 端点，允许前端查询未分类概念统计和模块重叠检测。

#### Scenario: 检测需要新增模块
- **WHEN** 前端调用 `GET /api/graphs/:id/analysis/module-gaps`
- **THEN** 返回未分类概念数量、是否需要新模块、建议的新模块名称

#### Scenario: 检测模块重叠
- **WHEN** 前端调用 `GET /api/graphs/:id/analysis/module-overlap`
- **THEN** 返回存在内容重叠的模块对及相似度

### Requirement: 文献库面板
系统 SHALL 为 topic_research 图谱提供文献清单视图，展示所有已处理的文献并按模块分类。

#### Scenario: 查看图谱下所有文献
- **WHEN** 用户打开 topic_research 图谱的文献面板
- **THEN** 显示所有已提取概念的文献列表，包含标题、作者、年份、提取概念数、所属模块

#### Scenario: 按模块过滤文献
- **WHEN** 用户选择"研究方法"模块过滤
- **THEN** 文献列表仅显示其提取的概念属于"研究方法"模块的文献