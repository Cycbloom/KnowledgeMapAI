# Tasks

- [x] Task 1: 添加调试日志到 visibleFocusedNodeIds 计算逻辑
  - [x] SubTask 1.1: 在 QuadrantCanvas.tsx 的 visibleFocusedNodeIds useMemo 中添加 development 模式日志
  - [x] SubTask 1.2: 输出 focusedNodeId、regionEdges 长度、regionEdges 内容、visibleFocusedNodeIds 内容
  - [x] SubTask 1.3: 在 regionEdges 过滤逻辑处添加日志，显示被过滤掉的边及原因

- [x] Task 2: 验证并修复 regionEdges 过滤逻辑
  - [x] SubTask 2.1: 检查 nodePositions 的构建逻辑，确认 core 节点是否正确排除（第202行 filter）
  - [x] SubTask 2.2: 检查 regionEdges 过滤条件，确认是否正确过滤了不可见节点的边（第248-252行）
  - [x] SubTask 2.3: 如果发现过滤逻辑缺陷，修复并确保只保留两端都在可见节点集合中的边

- [x] Task 3: 强化 visibleFocusedNodeIds 计算的防御性检查
  - [x] SubTask 3.1: 确保当 hasFocusMode 为 true 但 focusedNodeId 为 null 时返回空集
  - [x] SubTask 3.2: 确保当 regionEdges 为空数组时只高亮选中节点本身
  - [x] SubTask 3.3: 验证依赖数组的完整性，避免 stale closure 导致的计算错误

- [x] Task 4: 添加单元测试覆盖幽灵高亮场景
  - [x] SubTask 4.1: 测试场景1：选中节点，邻居节点通过 core 节点间接连接 → 邻居不应高亮
  - [x] SubTask 4.2: 测试场景2：选中节点，邻居节点在同一区域且有直接边 → 邻居应高亮
  - [x] SubTask 4.3: 测试场景3：选中节点，邻居节点在不同区域但有可见跨区域边 → 邻居应高亮
  - [x] SubTask 4.4: 测试场景4：无聚焦模式时所有节点不高亮

- [x] Task 5: 运行测试和类型检查
  - [x] SubTask 5.1: 运行 `npm run check` 确保类型检查通过
  - [x] SubTask 5.2: 运行 `npm run lint` 确保代码检查通过
  - [x] SubTask 5.3: 运行单元测试确保所有测试通过（9/9 通过）

# Task Dependencies
- Task 1 可独立执行（用于调试）
- Task 2 依赖 Task 1 的日志输出确认问题根因
- Task 3 可与 Task 2 并行执行
- Task 4 依赖 Task 2 和 Task 3 完成
- Task 5 依赖所有前序任务完成
