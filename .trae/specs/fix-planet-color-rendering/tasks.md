# Tasks

- [x] Task 1: 修复 MeshStandardMaterial 材质配置
  - [x] SubTask 1.1: 将 `metalness` 从 0.8 降至 0.15
  - [x] SubTask 1.2: 将 `roughness` 从 0.2 调整到 0.5
  - [x] SubTask 1.3: 添加 `emissive: new THREE.Color('#ffffff')`，让节点有自发光基础亮度
  - [x] SubTask 1.4: 将 `emissiveIntensity` 从 0.4 调整到 0.15（配合白色 emissive，避免过亮）

- [x] Task 2: 增强场景环境光
  - [x] SubTask 2.1: 将 `ambientLight` 的 `intensity` 从 0.3 提升到 0.5

- [x] Task 3: 验证
  - [x] SubTask 3.1: 类型检查通过（`npm run check`）— 唯一错误为预存问题
  - [x] SubTask 3.2: lint 通过（`npm run lint`）

# Task Dependencies

- Task 1 和 Task 2 可并行执行
- Task 3 依赖 Task 1 和 Task 2 完成
