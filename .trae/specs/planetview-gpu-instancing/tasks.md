# Tasks

## Phase 1: P0 低成本高收益优化（消除 CPU 瓶颈）

- [x] Task 1: 消除 useFrame 中的 setState — 用 ref + 直接操作 Three.js 对象替代 useState，消除每帧 N 次 React 重渲染
  - [x] SubTask 1.1: 将 PlanetNode 的 `useState(scale)` 替换为 `useRef(scaleRef)`，useFrame 中直接通过 `groupRef.current.scale.setScalar(newScale)` 更新缩放
  - [x] SubTask 1.2: Text 组件的 fontSize 改为通过 ref 直接操作 troika-text 内部属性，而非通过 React props 变化触发重渲染
  - [x] SubTask 1.3: 移除 PlanetNode 中因 scale 变化而重新计算的 `titleFontSize`、`tagFontSize`、`labelOffset` 变量，改为在 useFrame 中直接更新

- [x] Task 2: 共享 SphereGeometry — 在 Scene 层级创建单个共享几何体，所有节点复用
  - [x] SubTask 2.1: 在 Scene 组件中创建 `sharedSphereGeo = useMemo(() => new THREE.SphereGeometry(1, 32, 32), [])`
  - [x] SubTask 2.2: 修改 PlanetNode 使用共享几何体，通过 scale 矩阵实现不同大小（`scale={[baseSize, baseSize, baseSize]}`）
  - [x] SubTask 2.3: 确保 PlanetNode 的 useEffect cleanup 不再 dispose 共享几何体

## Phase 2: P1 视口裁剪与 LOD

- [x] Task 3: 3D 视口裁剪 — 使用 THREE.Frustum 视锥体裁剪，仅渲染可见节点和边
  - [x] SubTask 3.1: 在 Scene 组件中实现视锥体裁剪，使用 `THREE.Frustum` + `camera.projectionMatrix` + `camera.matrixWorldInverse` 计算可见节点列表
  - [x] SubTask 3.2: 边的可见性过滤：仅当 source 或 target 节点在视锥体内时渲染该边
  - [x] SubTask 3.3: 节点数 <= 50 时跳过裁剪计算，直接渲染全部

- [x] Task 4: Text 距离 LOD — 根据节点到摄像机距离分三级控制文字渲染
  - [x] SubTask 4.1: 在 PlanetNode 的 useFrame 中计算节点到摄像机的距离，分为 LOD 0/1/2 三级
  - [x] SubTask 4.2: LOD 0（< 150）渲染标题+标签，LOD 1（150-350）仅标题，LOD 2（>= 350）不渲染文字
  - [x] SubTask 4.3: LOD 级别切换时文字 fillOpacity lerp 平滑过渡（约 0.2s）

- [x] Task 5: 边线距离 LOD — 远距离简化边线渲染
  - [x] SubTask 5.1: 摄像机距离 < 200 时使用贝塞尔曲线（21 点，当前行为）
  - [x] SubTask 5.2: 摄像机距离 >= 200 时使用直线（2 点）
  - [x] SubTask 5.3: 摄像机距离 >= 500 时不渲染边线

## Phase 3: P1 InstancedMesh 核心重构

- [x] Task 6: InstancedMesh 球体渲染 — 将所有球体合并为 1 个 InstancedMesh
  - [x] SubTask 6.1: 在 Scene 中创建 `InstancedMesh(sharedSphereGeo, sharedMaterial, nodeCount)`，设置 instanceMatrix 和 instanceColor
  - [x] SubTask 6.2: 在 useFrame 中批量更新 instanceMatrix（位置 + 旋转 + 缩放）和 instanceColor（选中/hover 状态）
  - [x] SubTask 6.3: 移除 PlanetNode 中的 `<mesh>` + `<sphereGeometry>` + `<meshStandardMaterial>` JSX，改为 InstancedMesh 数据驱动
  - [x] SubTask 6.4: 节点增减时重建 InstancedMesh（count 变化），节点属性变化时仅更新对应 instance 行

- [x] Task 7: InstancedMesh 交互 — Raycaster + instanceId 映射实现点击和 hover
  - [x] SubTask 7.1: 通过 gl.domElement 添加 pointermove/click 事件监听，使用 Raycaster 对 InstancedMesh 进行射线检测
  - [x] SubTask 7.2: 通过 `intersection.instanceId` 映射到 visibleNodes 数组索引，获取对应节点
  - [x] SubTask 7.3: hover 时更新对应 instanceColor 为 hover 色，离开时恢复
  - [x] SubTask 7.4: 选中时更新对应 instanceColor 为选中色，取消选中时恢复
  - [x] SubTask 7.5: hover 节点时在对应位置渲染 Html 悬浮提示（仅 1 个 Html 实例，跟随 hover 节点位置）

## Phase 4: 验证

- [x] Task 8: 性能验证 — 确认优化效果
  - [x] SubTask 8.1: 验证 50 节点场景球体 Draw Call 从 ~50 降至 1
  - [x] SubTask 8.2: 验证类型检查通过（npx tsc --noEmit）
  - [x] SubTask 8.3: 验证 lint 通过（npx eslint，0 errors）
  - [x] SubTask 8.4: 验证点击/hover 交互行为与优化前一致（Raycaster + instanceId 映射）
  - [x] SubTask 8.5: 验证选中节点高亮、悬浮提示功能正常（instanceColor + Html）

# Task Dependencies

- Task 1 和 Task 2 可并行执行（无依赖）
- Task 3 和 Task 4 可并行执行（均依赖 Task 1 完成后的代码结构）
- Task 5 独立，可与 Task 3/4 并行
- Task 6 依赖 Task 1 和 Task 2（共享 Geometry 是 InstancedMesh 的前置条件）
- Task 7 依赖 Task 6（InstancedMesh 创建后才能实现交互）
- Task 8 依赖所有前置 Task 完成
