# 联立式图谱视图 Spec

## Why
用户在学习过程中经常需要同时查看多个相关联的图谱（如前置知识和扩展知识），目前只能单独打开每个图谱，无法在同一视图中对比和关联查看，降低了学习效率。

## What Changes
- 在图谱地图中增加多选功能，允许用户选择两个图谱
- 新增"联立打开"按钮，将选中的两个图谱在分屏视图中同时展示
- 创建新的联立视图页面 `CombinedGraphView`，支持左右分屏或上下分屏显示两个图谱
- 支持在联立视图中查看两个图谱的节点，并高亮显示图谱间的关系连接

## Impact
- Affected specs: 图谱地图、图谱编辑器
- Affected code: 
  - `src/pages/GraphMap.tsx` - 添加多选和联立打开功能
  - `src/components/GraphMap/GraphMapCanvas.tsx` - 支持多选渲染
  - `src/pages/CombinedGraphView.tsx` - 新建联立视图页面
  - `src/App.tsx` - 添加新路由
  - `src/types/index.ts` - 添加相关类型定义

## ADDED Requirements

### Requirement: 图谱多选功能
系统 SHALL 允许用户在图谱地图中选择多个图谱。

#### Scenario: 选择图谱
- **WHEN** 用户按住 Ctrl/Cmd 键点击图谱节点
- **THEN** 该图谱被添加到选中集合中，已选中的图谱显示高亮边框

#### Scenario: 取消选择
- **WHEN** 用户再次按住 Ctrl/Cmd 键点击已选中的图谱
- **THEN** 该图谱从选中集合中移除

#### Scenario: 选择数量限制
- **WHEN** 用户已选择2个图谱后继续尝试选择
- **THEN** 系统提示"最多只能选择2个图谱进行联立查看"

### Requirement: 联立打开功能
系统 SHALL 提供联立打开按钮，用于同时打开两个选中的图谱。

#### Scenario: 显示联立按钮
- **WHEN** 用户选中恰好2个图谱
- **THEN** 显示"联立打开"按钮

#### Scenario: 联立打开
- **WHEN** 用户点击"联立打开"按钮
- **THEN** 系统导航到联立视图页面，URL格式为 `/combined-graphs/:id1/:id2`

#### Scenario: 选择数量不足
- **WHEN** 用户选中少于2个图谱
- **THEN** 联立按钮显示为禁用状态

### Requirement: 联立视图页面
系统 SHALL 提供联立视图页面，同时展示两个图谱。

#### Scenario: 分屏显示
- **WHEN** 用户进入联立视图页面
- **THEN** 两个图谱以左右分屏方式显示，中间有可拖拽调整的分隔条

#### Scenario: 图谱间关系高亮
- **WHEN** 两个图谱之间存在关系
- **THEN** 在两个图谱之间显示关系连接线，并标注关系类型

#### Scenario: 单个图谱操作
- **WHEN** 用户在联立视图中操作单个图谱
- **THEN** 该图谱支持常规的节点选择、缩放、平移等操作

#### Scenario: 返回图谱地图
- **WHEN** 用户点击返回按钮
- **THEN** 系统导航回图谱地图页面

### Requirement: 联立视图工具栏
系统 SHALL 在联立视图页面提供工具栏。

#### Scenario: 工具栏内容
- **WHEN** 用户查看联立视图
- **THEN** 工具栏显示：返回按钮、两个图谱标题、分屏方向切换按钮

#### Scenario: 切换分屏方向
- **WHEN** 用户点击分屏方向切换按钮
- **THEN** 分屏从左右布局切换为上下布局，或反之

## MODIFIED Requirements
无

## REMOVED Requirements
无
