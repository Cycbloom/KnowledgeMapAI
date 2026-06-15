# 知识图谱可视化增强 Spec

## Why

KnowledgeMap 已具备多种图谱视图（思维导图、时间线、象限、3D）和基础的颜色模式（层级/学习状态），但可视化深度不足：缺乏按学习路径的叙事式动画播放、缩放仅影响文字可见性而非信息粒度、热力图仅有 5 种离散状态而非连续渐变。通过增强这三个维度，可将图谱从"静态展示"升级为"动态叙事+语义缩放+热度感知"的沉浸式体验。

## What Changes

- **力导向图动画叙事** — 在 MindMapCanvas 中新增叙事播放模式，按学习路径顺序逐步展开节点，配合相机跟随动画和边流动特效，像讲故事一样呈现知识体系
- **缩放语义** — 扩展现有缩放机制，在不同缩放级别展示不同粒度信息：概览（领域聚合）→ 集群（核心节点）→ 节点（完整信息）→ 详情（内容预览），类似地图 zoom 体验
- **知识热力图** — 新增 `heatmap` 颜色模式，基于学习频率/掌握度/衰减程度使用连续色温渐变渲染节点热度，替代当前 5 种离散状态

## Impact

- Affected specs: 图谱编辑器视图系统、颜色模式系统、学习路径可视化
- Affected code:
  - `src/components/GraphEditor/canvas/MindMapCanvas.tsx` — 叙事模式 + 缩放语义 + 热力图渲染
  - `src/components/GraphEditor/canvas/MindMapNode.tsx` — 热力图节点样式 + 缩放语义节点聚合
  - `src/components/GraphEditor/canvas/MindMapLink.tsx` — 叙事模式边动画
  - `src/hooks/graphEditor/useViewState.ts` — 新增叙事模式状态
  - `src/hooks/graphEditor/usePresentationState.ts` — 扩展为叙事播放控制器
  - `src/config/graphConfig.ts` — 新增热力图配色和缩放语义阈值配置
  - `src/hooks/graphEditor/useGraphComputed.ts` — 新增热力图数据计算
  - `src/components/GraphEditor/GraphEditor.tsx` — 叙事模式 UI 控件集成

## ADDED Requirements

### Requirement: 力导向图动画叙事

系统 SHALL 在 MindMapCanvas 中提供叙事播放模式，按学习路径顺序逐步展开图谱节点，配合相机跟随和边流动动画，实现知识体系的叙事式呈现。

#### Scenario: 启动叙事播放
- **WHEN** 用户在图谱编辑器中选择一条学习路径并点击"叙事播放"按钮
- **THEN** 系统进入叙事模式，初始状态仅显示根节点，相机聚焦到根节点位置

#### Scenario: 逐步展开节点
- **WHEN** 叙事模式播放中
- **THEN** 系统按学习路径顺序逐步显示节点，每个节点出现时伴随缩放淡入动画（0.3s），同时从父节点到当前节点的边显示流动动画（flow），相机平滑跟随到新节点位置（animateCamera）

#### Scenario: 播放控制
- **WHEN** 用户使用播放控制栏
- **THEN** 系统支持播放/暂停、步进/步退（跳到路径中上/下一个节点）、重置、速度调节（0.5x/1x/2x），与 TimelineView 的控制体验一致

#### Scenario: 叙事模式下的视觉聚焦
- **WHEN** 叙事模式播放到某个节点
- **THEN** 当前节点高亮放大（1.2x），已展开的路径节点正常显示，未展开的节点隐藏，非路径节点始终隐藏

#### Scenario: 叙事完成
- **WHEN** 叙事播放到路径最后一个节点
- **THEN** 系统自动暂停，显示"叙事完成"提示，相机执行 fitView 动画展示完整路径

#### Scenario: 退出叙事模式
- **WHEN** 用户点击退出或按 Escape 键
- **THEN** 系统恢复所有节点的可见性，清除叙事状态，相机回到进入前的位置

---

### Requirement: 缩放语义

系统 SHALL 在 MindMapCanvas 中实现语义缩放，不同缩放级别展示不同粒度的信息，类似地图的 zoom 体验。

#### Scenario: 概览级别（zoom < 0.3）
- **WHEN** 用户缩小到概览级别
- **THEN** 系统仅显示 root 和 core 层级节点，节点以聚合圆点形式呈现（显示节点数量），隐藏所有文字标签和边，相同领域的节点用相同底色分组

#### Scenario: 集群级别（0.3 <= zoom < 0.7）
- **WHEN** 用户缩放到集群级别
- **THEN** 系统显示 root、core、sub 层级节点，显示核心节点标题（截断至 8 字符），显示主要边连接，leaf 节点以小圆点聚合到父节点旁

#### Scenario: 节点级别（0.7 <= zoom < 1.5）
- **WHEN** 用户缩放到节点级别
- **THEN** 系统显示所有层级节点和完整标题，显示所有边和关系标签，这是当前的默认显示模式

#### Scenario: 详情级别（zoom >= 1.5）
- **WHEN** 用户放大到详情级别
- **THEN** 系统在节点下方显示内容预览（前 50 字符）、学习状态标签、复习次数等信息，节点尺寸增大以容纳详情

#### Scenario: 缩放级别平滑过渡
- **WHEN** 用户在两个缩放级别之间切换
- **THEN** 信息粒度变化通过 CSS transition 平滑过渡（0.3s），避免突兀的跳变

#### Scenario: 缩放级别指示器
- **WHEN** 用户缩放画布
- **THEN** 左下角缩放百分比旁显示当前语义级别标签（概览/集群/节点/详情）

---

### Requirement: 知识热力图

系统 SHALL 新增 `heatmap` 颜色模式，基于学习频率和掌握度使用连续色温渐变渲染节点热度。

#### Scenario: 切换到热力图模式
- **WHEN** 用户在颜色模式选择器中选择"热力图"
- **THEN** 系统将所有节点从当前颜色模式切换为热力图渲染，使用连续色温渐变（冷色=低活跃 → 暖色=高活跃）

#### Scenario: 热度计算
- **WHEN** 系统渲染热力图
- **THEN** 每个节点的热度值由以下因素加权计算：
  - 复习次数（review_count）：权重 0.3
  - 掌握状态（mastered=1.0, learning=0.6, due=0.4, new=0.2, locked=0.0）：权重 0.4
  - 最近活跃度（距今天数越近越高，7天内线性衰减）：权重 0.3
  - 最终热度值归一化到 [0, 1]

#### Scenario: 色温映射
- **WHEN** 节点热度值计算完成
- **THEN** 系统将热度值映射到色温渐变：
  - 0.0（冷）→ #3B82F6（蓝色）
  - 0.25 → #06B6D4（青色）
  - 0.5 → #10B981（绿色）
  - 0.75 → #F59E0B（橙色）
  - 1.0（热）→ #EF4444（红色）
  - 节点发光强度随热度值增大（glow opacity 0.1~0.5）

#### Scenario: 热力图图例
- **WHEN** 热力图模式激活
- **THEN** 画布右下角显示色温图例条（渐变色条 + 低/高标签），帮助用户理解颜色含义

#### Scenario: 无学习数据时的降级显示
- **WHEN** 节点没有学习状态数据
- **THEN** 该节点使用中性灰色（#9CA3AF）渲染，表示"无数据"

#### Scenario: 热力图与叙事模式兼容
- **WHEN** 叙事模式播放中且颜色模式为热力图
- **THEN** 已展开节点按热力图渲染，未展开节点隐藏，叙事模式优先级高于热力图的节点可见性控制

## MODIFIED Requirements

### Requirement: 图谱颜色模式（现有）

现有 `GraphColorMode` 类型从 `"level" | "status"` 扩展为 `"level" | "status" | "heatmap"`，新增 `heatmap` 选项。

### Requirement: 演示模式（现有）

现有 `usePresentationState` 的 DFS 遍历逻辑扩展为支持多种遍历策略：DFS（原有）、学习路径顺序（新增）。叙事模式复用演示模式的基础设施但增加相机跟随和边动画。

### Requirement: 缩放文字可见性（现有）

现有 `getTextVisibility` 函数从简单的层级阈值判断升级为多级别语义缩放系统的一部分，保留向后兼容的默认行为（节点级别）。

## REMOVED Requirements

无移除项。
