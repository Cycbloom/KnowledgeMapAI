# 为联立视图添加侧边栏和工具栏

## 问题分析

当前联立视图 `CombinedGraphView.tsx` 功能比较简单，只有基本的图谱显示功能，缺少：
1. 操作图谱的工具栏（缩放、样式、导出等）
2. 查看节点详情的侧边栏
3. 节点大纲视图

## 解决方案

参考 `GraphEditor.tsx` 的实现，为联立视图添加精简版的工具栏和侧边栏。

### 1. 工具栏功能

创建 `CombinedGraphToolbar.tsx` 组件，包含：

**基础功能：**
- 返回按钮
- 两个图谱的标题显示
- 撤销/重做（如果支持）

**视图功能：**
- 缩放控制（放大、缩小、适应屏幕）
- 显示/隐藏网格
- 深色/浅色模式切换

**样式功能：**
- 着色模式切换（结构/热力图）
- 连线样式切换

**导出功能：**
- 导出为图片
- 导出为 JSON

### 2. 侧边栏功能

创建 `CombinedGraphSidebar.tsx` 组件，包含：

**节点大纲：**
- 显示两个图谱的节点树形结构
- 点击节点可定位到该节点

**节点详情：**
- 显示选中节点的详细信息
- 显示节点的内容、标签等

### 3. 状态管理

添加必要的状态：
- `selectedNode`: 当前选中的节点
- `sidebarMode`: 侧边栏模式 ('none' | 'outline' | 'detail')
- `showGrid`: 是否显示网格
- `coloringMode`: 着色模式

## 修改文件

### 新建文件
- `src/components/CombinedGraph/CombinedGraphToolbar.tsx` - 联立视图工具栏
- `src/components/CombinedGraph/CombinedGraphSidebar.tsx` - 联立视图侧边栏

### 修改文件
- `src/pages/CombinedGraphView.tsx` - 集成工具栏和侧边栏

## 实现步骤

1. 创建 `CombinedGraphToolbar.tsx` 组件
2. 创建 `CombinedGraphSidebar.tsx` 组件
3. 在 `CombinedGraphView.tsx` 中集成工具栏和侧边栏
4. 添加必要的状态管理和事件处理
