# PlanetView 性能优化 Spec

## Why

PlanetView（3D 知识星球视图）存在严重的性能瓶颈：每个节点独立创建 SphereGeometry(32,32) + MeshStandardMaterial + troika-text Text 对象，每个节点在 useFrame 中调用 setState 触发 React 重渲染。50 个节点时 Draw Call 约 200+、每帧 50 次 setState；100 个节点时 Draw Call 约 400+、每帧 100 次 setState，远超 60fps 安全线。2D 视图（MindMapCanvas/QuadrantCanvas）已实现完整的视口裁剪和语义缩放，但 PlanetView 完全缺失任何优化机制。

## What Changes

- **消除 useFrame setState** — 用 ref + 直接操作 Three.js 对象 scale 替代 useState，绕过 React 渲染循环，消除每帧 N 次 setState + Text 重新布局的 CPU 瓶颈
- **共享 Geometry** — 在 Scene 层级创建单个 SphereGeometry(1, 32, 32)，所有节点通过 scale 矩阵实现不同大小，消除 N 份独立几何体的内存浪费
- **3D 视口裁剪** — 使用 THREE.Frustum 视锥体裁剪，仅渲染摄像机可见范围内的节点和边，与 2D 视图的 useVisibleNodes 对齐
- **Text 距离 LOD** — 根据节点到摄像机距离分三级：近距显示标题+标签、中距仅标题、远距不渲染文字，消除远距离 Text 对象的 Draw Call 和内存开销
- **InstancedMesh 球体渲染** — 将所有球体合并为 1 个 InstancedMesh，通过 instanceMatrix 控制位置/旋转/缩放、instanceColor 控制颜色，将 N 个球体 Draw Call 降为 1 个
- **InstancedMesh 交互** — 使用 Raycaster + instanceId 映射实现 InstancedMesh 的点击/hover 交互，替代逐节点事件监听

## Impact

- Affected specs: 3D 知识星球视图、图谱编辑器视图系统
- Affected code:
  - `src/three/PlanetView.tsx` — 主要重构目标（全部 6 项变更）
  - `src/three/layout/forceLayout3D.ts` — 无修改（布局算法独立，不影响渲染）
- 无破坏性变更：优化对用户透明，视觉行为和交互行为保持不变

## ADDED Requirements

### Requirement: 消除 useFrame 中的 setState

系统 SHALL 在 PlanetView 的 useFrame 回调中使用 ref 直接操作 Three.js 对象的 scale 属性，而非通过 useState 触发 React 重渲染。

#### Scenario: 节点缩放不触发 React 重渲染
- **WHEN** 摄像机移动导致节点到摄像机距离变化
- **THEN** 节点球体的 scale 通过 `groupRef.current.scale.setScalar(newScale)` 直接更新，不调用 setScale()，不触发 React 组件重渲染

#### Scenario: 文字大小跟随缩放
- **WHEN** 节点缩放值变化
- **THEN** Text 组件的 fontSize 通过 ref 直接操作 troika-text 的内部属性更新，而非通过 React props 变化触发重渲染

#### Scenario: 缩放阈值节流保留
- **WHEN** 摄像机缓慢移动
- **THEN** 缩放更新仍保留 0.05 的阈值节流，避免微小变化导致不必要的 Three.js 对象更新

---

### Requirement: 共享 SphereGeometry

系统 SHALL 在 Scene 层级创建单个共享的 SphereGeometry，所有节点复用同一几何体，通过 scale 矩阵实现不同大小。

#### Scenario: 几何体共享
- **WHEN** Scene 渲染 N 个节点
- **THEN** 仅创建 1 个 SphereGeometry(1, 32, 32) 实例，所有球体 mesh 共享此几何体

#### Scenario: 节点大小通过 scale 实现
- **WHEN** 节点的 baseSize 为 3-8
- **THEN** 球体 mesh 的 scale 设置为 `[baseSize, baseSize, baseSize]`，而非创建不同半径的几何体

#### Scenario: 几何体内存节省
- **WHEN** 渲染 100 个节点
- **THEN** SphereGeometry 内存占用从约 5MB（100 × 50KB）降为约 50KB（1 × 50KB）

---

### Requirement: 3D 视口裁剪

系统 SHALL 使用 THREE.Frustum 视锥体裁剪，仅渲染摄像机可见范围内的节点和边。

#### Scenario: 视锥体裁剪节点
- **WHEN** 用户旋转/缩放/平移摄像机
- **THEN** 系统使用 Frustum 检测节点是否在视锥体内（含缓冲距离），仅渲染可见节点

#### Scenario: 视锥体裁剪边
- **WHEN** 系统计算可见边
- **THEN** 仅当边的 source 或 target 节点在视锥体内时，该边被渲染

#### Scenario: 裁剪更新节流
- **WHEN** 摄像机持续移动
- **THEN** 视锥体裁剪结果通过 useFrame 每帧更新（不额外节流，因为 Frustum 检测开销极低）

#### Scenario: 全部节点可见时跳过裁剪
- **WHEN** 节点数 <= 50 且摄像机距离足够远（所有节点在视锥体内）
- **THEN** 系统跳过裁剪计算，直接渲染所有节点，避免不必要的 Frustum 检测

---

### Requirement: Text 距离 LOD

系统 SHALL 根据节点到摄像机距离分三级控制文字渲染，远距离不渲染文字以减少 Draw Call 和内存。

#### Scenario: LOD 0 — 近距（距离 < 150）
- **WHEN** 节点到摄像机距离小于 150
- **THEN** 渲染标题 Text + 标签 Text（如有 tags），与当前行为一致

#### Scenario: LOD 1 — 中距（150 <= 距离 < 350）
- **WHEN** 节点到摄像机距离在 150-350 之间
- **THEN** 仅渲染标题 Text，不渲染标签 Text

#### Scenario: LOD 2 — 远距（距离 >= 350）
- **WHEN** 节点到摄像机距离大于等于 350
- **THEN** 不渲染任何 Text，球体仅显示为发光点

#### Scenario: LOD 级别切换平滑
- **WHEN** 节点在两个 LOD 级别之间切换
- **THEN** 文字通过 opacity 淡入淡出过渡（0.2s），避免突兀的跳变

---

### Requirement: InstancedMesh 球体渲染

系统 SHALL 将所有球体合并为 1 个 InstancedMesh，通过 instanceMatrix 和 instanceColor 批量渲染。

#### Scenario: 单个 InstancedMesh 渲染所有球体
- **WHEN** Scene 渲染 N 个节点
- **THEN** 所有球体通过 1 个 InstancedMesh 渲染，Draw Call 从 N 降为 1

#### Scenario: instanceMatrix 控制位置和缩放
- **WHEN** 节点位置或缩放变化
- **THEN** 系统更新 InstancedMesh 的 instanceMatrix 对应行的 position 和 scale 分量

#### Scenario: instanceColor 控制颜色
- **WHEN** 节点被选中或 hover
- **THEN** 系统更新 InstancedMesh 的 instanceColor 对应行为选中/hover 颜色

#### Scenario: 球体自转动画
- **WHEN** useFrame 执行
- **THEN** 系统更新 instanceMatrix 对应行的旋转分量，实现球体自转动画

#### Scenario: 节点增减时更新 InstancedMesh
- **WHEN** 图谱数据变化导致节点增减
- **THEN** 系统重新创建 InstancedMesh（节点数变化时）或更新 instanceMatrix（节点属性变化时）

---

### Requirement: InstancedMesh 交互

系统 SHALL 使用 Raycaster 对 InstancedMesh 进行射线检测，通过 instanceId 映射到具体节点，实现点击和 hover 交互。

#### Scenario: 点击节点
- **WHEN** 用户点击 InstancedMesh 上的某个球体
- **THEN** Raycaster 检测到交叉点，通过 instanceId 找到对应节点，触发 onNodeClick 回调

#### Scenario: Hover 节点
- **WHEN** 用户鼠标移入 InstancedMesh 上的某个球体
- **THEN** Raycaster 检测到交叉点，通过 instanceId 找到对应节点，更新 hoveredNodeId，对应球体颜色变为 hover 色

#### Scenario: 鼠标离开节点
- **WHEN** 用户鼠标移出 InstancedMesh
- **THEN** hoveredNodeId 重置为 null，前一个 hover 球体颜色恢复

#### Scenario: 选中节点高亮
- **WHEN** selectedNodeId 变化
- **THEN** 对应球体的 instanceColor 更新为选中色，前一个选中球体恢复原色

---

### Requirement: 边线简化渲染

系统 SHALL 对边线实现距离 LOD，远距离时使用直线替代贝塞尔曲线，超远距离时不渲染边线。

#### Scenario: 近距边线（摄像机距离 < 200）
- **WHEN** 摄像机距离较近
- **THEN** 边线使用贝塞尔曲线渲染（当前行为），21 个采样点

#### Scenario: 远距边线（摄像机距离 >= 200）
- **WHEN** 摄像机距离较远
- **THEN** 边线使用直线渲染（仅 2 个端点），减少顶点数

#### Scenario: 超远距边线（摄像机距离 >= 500）
- **WHEN** 摄像机距离非常远
- **THEN** 不渲染边线，仅显示球体点

## MODIFIED Requirements

### Requirement: PlanetNode 组件（现有）

PlanetNode 从独立的 React 组件重构为 InstancedMesh 的数据驱动模式：节点数据（位置、颜色、缩放）通过 instanceMatrix 和 instanceColor 批量设置，而非逐组件渲染。Text 和 Html 组件根据 LOD 级别条件渲染。

### Requirement: PlanetLink 组件（现有）

PlanetLink 增加距离 LOD：近距离保持贝塞尔曲线，远距离降级为直线，超远距离不渲染。

## REMOVED Requirements

无移除项。
