# 修复知识星球视图节点颜色渲染不可见 Spec

## Why

知识星球视图（PlanetView）的 `MeshStandardMaterial` 配置了 `metalness: 0.8` 但场景中没有环境贴图（envMap），导致金属材质没有可反射的环境，节点颜色几乎不可见。同时 `emissive` 默认为黑色，`emissiveIntensity: 0.4` 完全无效。着色逻辑已正确实现，但渲染管线配置导致颜色无法呈现。

## What Changes

- **降低 metalness** — 从 0.8 降至 0.15，让 diffuse color（instanceColor）成为视觉主导
- **设置 emissive 颜色** — 添加白色自发光，让节点在暗色场景中有基础亮度
- **调整 roughness** — 从 0.2 调整到 0.5，平衡光泽感和颜色可见度
- **增强环境光** — 从 0.3 提升到 0.5，确保基础照明充足

## Impact

- Affected specs: 知识星球视图节点渲染
- Affected code: `src/three/PlanetView.tsx` — 材质配置和光照参数

## ADDED Requirements

### Requirement: 节点颜色在 3D 场景中可见

系统 SHALL 确保 InstancedMesh 的 instanceColor 在 MeshStandardMaterial 渲染下清晰可见，无论场景明暗。

#### Scenario: 暗色主题下节点颜色可见
- **WHEN** 用户在暗色主题下查看知识星球视图
- **THEN** 节点球体清晰显示着色模式对应的颜色，不会因高 metalness 导致颜色不可见

#### Scenario: level 着色模式下不同层级颜色区分明显
- **WHEN** coloringMode 为 level
- **THEN** root（紫色）、core（红色）、sub（橙色）、normal（蓝色）、leaf（绿色）层级颜色清晰可辨

#### Scenario: 金属质感保留
- **WHEN** 节点渲染
- **THEN** 球体保留适度的 3D 质感和光泽，不会显得完全平面化

## MODIFIED Requirements

### Requirement: MeshStandardMaterial 配置

材质配置 SHALL 使用低 metalness（0.15）和适度 roughness（0.5），并设置 emissive 为白色以提供自发光基础亮度。

### Requirement: 场景光照

环境光强度 SHALL 从 0.3 提升至 0.5，确保低 metalness 材质有足够的漫反射光照。

## REMOVED Requirements

无移除项。
