# 象限视图密集节点布局优化 Spec

## Why
当前象限视图（QuadrantCanvas）在节点数量较多时（如截图中的 ~30+ 节点），存在两个核心问题：① `regionRadius` 的密度缩放因子在节点数 ≥25 时即达到上限 1.5 倍，无法随更多节点继续扩展范围；② 节点间无碰撞检测/间距保障机制（`avoidCollisions()` 已存在于 `quadrantLayout.ts` 但从未被调用），导致节点重叠、拥挤、难以阅读。

## What Changes
- **优化**：`regionRadius` 密度因子改为对数增长或分段线性增长，支持更大节点量级（50~100+）的合理扩展
- **新增**：将 `avoidCollisions()` 碰撞检测集成到 `QuadrantCanvas` 的位置计算流程中，渲染前对重叠节点施加斥力推开
- **优化**：`distanceRatio` 范围根据区域内节点密度动态调整——节点多时扩大可用半径区间 [0.15, 0.92]，减少中心区域拥挤
- **优化**：`baseRadius` 容器比例从固定 0.35 改为随节点数自适应（节点越多占比越大）

## Impact
- Affected code:
  - `src/components/GraphEditor/canvas/QuadrantCanvas.tsx` — regionRadius 计算 + 碰撞检测集成 + getNodePosition 参数调整
  - `src/components/GraphEditor/canvas/QuadrantNode.tsx` — 同步更新 distanceRatio 计算逻辑
  - `src/utils/quadrantLayout.ts` — avoidCollisions 可能需要性能优化（当前 50 次迭代对大量节点偏慢）

## ADDED Requirements

### Requirement: 自适应半径扩展
当图谱总节点数增加时，regionRadius SHALL 按非线性方式持续增长，而非在 25 个节点时封顶。

#### Scenario: 10 个节点的图谱
- **WHEN** 图谱包含 10 个节点
- **THEN** regionRadius ≈ 容器短边 × 0.35 × 1.2 = 约 42% 短边（轻微放大）

#### Scenario: 50 个节点的图谱
- **WHEN** 图谱包含 50 个节点
- **THEN** regionRadius ≈ 容器短边 × 0.38 × 1.8 = 约 68% 短边（显著放大）

#### Scenario: 100+ 个节点的图谱
- **WHEN** 图谱包含 100 个节点
- **THEN** regionRadius ≈ 容器短边 × 0.42 × 2.3 = 约 97% 短边（接近填满容器）

### Requirement: 节点碰撞避免
渲染节点前，系统 SHALL 对计算出的节点位置执行碰撞检测，将距离过近的节点推开到最小安全间距之外。

#### Scenario: 两节点位置过近
- **WHEN** 两个节点计算出的间距 < 最小安全距离（约 60px）
- **THEN** 斥力算法将它们沿连线方向推开，直到间距 ≥ 安全距离

#### Scenario: 大量节点碰撞处理
- **WHEN** 存在 30+ 个节点且多处碰撞
- **THEN** 迭代执行推开操作（20~30 次），每次移动距离带阻尼衰减，确保收敛稳定

#### Scenario: 性能保障
- **WHEN** 节点数 > 100
- **THEN** 碰撞检测使用空间索引（网格分区）或降低迭代次数，保证帧率不卡顿

### Requirement: 动态距离比分布
单个区域内的节点距离原点的分布范围 SHALL 根据该区域的节点密度动态调整。

#### Scenario: 区域内节点少（≤5 个）
- **WHEN** 某个区域有 ≤5 个非 core 节点
- **THEN** distanceRatio 使用标准范围 [0.30, 0.82]（与现有行为接近）

#### Scenario: 区域内节点多（>10 个）
- **WHEN** 某个区域有 >10 个非 core 节点
- **THEN** distanceRatio 扩展为 [0.18, 0.92]（更分散，利用更大的径向空间）

## MODIFIED Requirements

### Requirement: 区域背景跟随 radius 扩大
RegionBackground 绘制的扇形/圆形区域 SHALL 始终以 `regionRadius` 为基准绘制，确保视觉上节点不会超出区域边界。