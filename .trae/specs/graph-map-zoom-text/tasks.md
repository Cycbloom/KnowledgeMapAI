# 知识图谱缩放文字显示优化 - 实现计划

## [ ] 任务 1: 优化文字大小计算逻辑
- **Priority**: P0
- **Depends On**: None
- **Description**: 
  - 修改 `MindMapNode.tsx` 中的文字大小计算逻辑
  - 确保在缩放较小时文字不会过小
  - 实现文字大小的合理范围限制
- **Acceptance Criteria Addressed**: AC-1, AC-3
- **Test Requirements**:
  - `human-judgment` TR-1.1: 缩放到 0.1 时文字依然清晰可读
  - `human-judgment` TR-1.2: 缩放过程中文字大小变化平滑
- **Notes**: 可以使用 clamp 函数限制文字大小的范围

## [ ] 任务 2: 改进文字显示阈值逻辑
- **Priority**: P0
- **Depends On**: 任务 1
- **Description**: 
  - 修改 `getTextVisibility` 函数中的阈值设置
  - 确保在不同缩放级别下，不同层级的节点文字显示合理
  - 实现平滑的文字显示/隐藏过渡
- **Acceptance Criteria Addressed**: AC-2, AC-3
- **Test Requirements**:
  - `human-judgment` TR-2.1: 缩放到 0.8 以上时，leaf 级节点文字被过滤
  - `human-judgment` TR-2.2: 文字显示/隐藏过渡平滑自然
- **Notes**: 调整不同层级的 minZoom 阈值，确保按层级过滤效果明显

## [ ] 任务 3: 性能优化
- **Priority**: P1
- **Depends On**: 任务 1, 任务 2
- **Description**: 
  - 确保文字显示优化不会影响图谱的整体性能
  - 检查并优化相关计算逻辑
  - 确保在大量节点的情况下依然保持流畅
- **Acceptance Criteria Addressed**: AC-4
- **Test Requirements**:
  - `human-judgment` TR-3.1: 100+ 节点的图谱缩放操作流畅
  - `human-judgment` TR-3.2: 没有明显的卡顿或延迟
- **Notes**: 可以考虑使用 React.memo 进一步优化渲染性能

## [ ] 任务 4: 测试和验证
- **Priority**: P1
- **Depends On**: 任务 1, 任务 2, 任务 3
- **Description**: 
  - 测试不同缩放级别的文字显示效果
  - 验证按层级过滤的效果
  - 确保整体用户体验良好
- **Acceptance Criteria Addressed**: AC-1, AC-2, AC-3, AC-4
- **Test Requirements**:
  - `human-judgment` TR-4.1: 所有验收标准都得到满足
  - `human-judgment` TR-4.2: 用户体验得到明显改善
- **Notes**: 测试时使用不同数量的节点，确保在各种情况下都能正常工作