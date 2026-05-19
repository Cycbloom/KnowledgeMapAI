# 象限视图幽灵高亮深度修复 Spec

## Why
用户报告象限视图中点击"网络钓鱼检测"节点后，"钓鱼欺诈检测"节点也被高亮，但两者之间没有可见连线。这是典型的"幽灵高亮"问题——节点被高亮但与选中节点间无可视连线，造成视觉混乱。之前的 `quadrant-edge-visibility` spec 虽然实现了基于 `regionEdges` 的 `visibleFocusedNodeIds` 计算，但问题仍存在，需要深入排查并彻底修复。

## What Changes
- **排查**：添加调试日志确认 `regionEdges` 过滤逻辑是否正确执行
- **修复**：确保 `visibleFocusedNodeIds` 计算严格基于可见边，消除所有幽灵高亮场景
- **增强**：增加防御性检查，确保节点高亮与边可见性完全一致
- **测试**：添加单元测试覆盖跨区域边、core节点边、折叠区域边等边界场景

## Impact
- Affected specs: quadrant-edge-visibility
- Affected code:
  - `src/components/GraphEditor/canvas/QuadrantCanvas.tsx` — visibleFocusedNodeIds 计算逻辑 + 调试日志
  - `src/components/GraphEditor/canvas/__tests__/QuadrantCanvas.test.tsx` — 边界场景测试

## ADDED Requirements

### Requirement: 幽灵高亮彻底消除
选中节点后，只有通过**可见边**（regionEdges）直接相连的节点才被高亮。任何在全量 edges 中存在但在 regionEdges 中不存在的边，其目标节点不得被高亮。

#### Scenario: 基本幽灵高亮消除
- **WHEN** 选中节点 A，节点 B 在全量 edges 中是 A 的邻居
- **AND** 边 A-B 不在 regionEdges 中（例如 B 连接到 core 节点或不可见节点）
- **THEN** 节点 B 不被高亮（opacity=0.45），避免视觉混乱

#### Scenario: 正常邻居高亮
- **WHEN** 选中节点 A，节点 B 是 A 的邻居
- **AND** 边 A-B 在 regionEdges 中（两端都在可见节点集合中）
- **THEN** 节点 B 被高亮（opacity=1），边 A-B 高亮显示

#### Scenario: 跨区域边正确处理
- **WHEN** 选中节点 A（区域 1），节点 B（区域 2）是 A 的邻居
- **AND** 边 A-B 两端都在 nodePositions 中
- **THEN** 节点 B 被高亮，边 A-B 在 regionEdges 中并被正确渲染

### Requirement: regionEdges 过滤逻辑验证
`regionEdges` 的过滤逻辑必须确保只包含两端都在当前可见节点集合（nodePositions）中的边。

#### Scenario: core 节点边过滤
- **WHEN** 某边的 source 或 target 是 core 节点（level="core"）
- **THEN** 该边不在 regionEdges 中

#### Scenario: 折叠区域节点边过滤
- **WHEN** 某边的 source 或 target 在折叠区域中
- **THEN** 该边不在 regionEdges 中

#### Scenario: 可见边保留
- **WHEN** 某边的 source 和 target 都在可见节点集合中
- **THEN** 该边在 regionEdges 中

## MODIFIED Requirements

### Requirement: visibleFocusedNodeIds 计算强化
当前的 `visibleFocusedNodeIds` 计算逻辑需要增加日志输出以便调试，并确保在各种边界条件下都能正确工作。

```typescript
// 当前实现（QuadrantCanvas.tsx 第270-287行）
const visibleFocusedNodeIds = useMemo(() => {
  if (!hasFocusMode || !focusedNodeId) return new Set<string>();

  const result = new Set<string>([focusedNodeId]);

  regionEdges.forEach((edge) => {
    const src = edge.source_knowledge_point_id;
    const tgt = edge.target_knowledge_point_id;

    if (src === focusedNodeId) {
      result.add(tgt);
    } else if (tgt === focusedNodeId) {
      result.add(src);
    }
  });

  return result;
}, [hasFocusMode, focusedNodeId, regionEdges]);
```

**修改要点**：
1. 增加 development 模式下的 console.warn 日志，输出 focusedNodeId、regionEdges 数量、visibleFocusedNodeIds 内容
2. 确保依赖数组完整，避免 stale closure
3. 验证 hasFocusMode 判断不会影响 visibleFocusedNodeIds 的计算准确性

## REMOVED Requirements

无
