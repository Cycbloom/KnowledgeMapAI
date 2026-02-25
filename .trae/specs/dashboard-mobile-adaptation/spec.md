# Dashboard 首页移动端适配 Spec

## Why
Dashboard 首页（"我的知识图谱"）是用户进入应用后的核心页面，当前布局主要针对桌面端设计，在移动设备上存在操作不便、信息密度过高、交互元素过小等问题，需要优化移动端体验。

## What Changes
- 优化页面头部区域在移动端的布局和间距
- 重构操作按钮组，在移动端采用更紧凑的布局
- 优化搜索框在移动端的显示和交互
- 调整标签云区域在移动端的展示方式
- 优化图谱卡片网格在移动端的布局
- 改进分页控件在移动端的交互
- 优化模态框/弹窗在移动端的适配
- 添加移动端专用的快捷操作入口

## Impact
- Affected specs: 无
- Affected code: 
  - `src/pages/Dashboard.tsx` - 主要修改文件
  - `src/components/Layout.tsx` - 可能需要配合调整
  - `src/hooks/useIsMobile.ts` - 复用现有 Hook

## ADDED Requirements

### Requirement: 移动端页面头部优化
系统 SHALL 在移动端提供优化的头部布局。

#### Scenario: 移动端头部显示
- **WHEN** 用户在移动设备（宽度 < 768px）访问 Dashboard
- **THEN** 标题区域采用垂直堆叠布局
- **AND** 统计信息卡片采用简化显示
- **AND** 间距和字体大小适配移动端

### Requirement: 移动端操作按钮组
系统 SHALL 在移动端提供紧凑且易于触摸的操作按钮组。

#### Scenario: 移动端按钮布局
- **WHEN** 用户在移动设备访问 Dashboard
- **THEN** 主要操作按钮（新建、AI生成）保持可见
- **AND** 次要按钮（导入、图谱地图）收纳到"更多"菜单
- **AND** 所有按钮触摸目标不小于 44x44px

### Requirement: 移动端搜索框优化
系统 SHALL 在移动端提供优化的搜索体验。

#### Scenario: 移动端搜索交互
- **WHEN** 用户在移动设备使用搜索功能
- **THEN** 搜索框占满可用宽度
- **AND** 搜索模式切换按钮保持可点击
- **AND** 搜索结果弹窗适配移动端屏幕

### Requirement: 移动端标签云展示
系统 SHALL 在移动端优化标签云的展示方式。

#### Scenario: 移动端标签云显示
- **WHEN** 用户在移动设备查看标签云
- **THEN** 标签采用可滚动的水平布局或折叠展示
- **AND** 默认显示较少标签，提供展开选项
- **AND** 已选标签在顶部突出显示

### Requirement: 移动端图谱卡片网格
系统 SHALL 在移动端提供单列卡片布局。

#### Scenario: 移动端卡片显示
- **WHEN** 用户在移动设备浏览图谱列表
- **THEN** 卡片采用单列布局
- **AND** 卡片内容（标题、描述、统计）适配移动端
- **AND** 卡片操作按钮在触摸时清晰可见

### Requirement: 移动端分页控件
系统 SHALL 在移动端提供简化的分页控件。

#### Scenario: 移动端分页显示
- **WHEN** 用户在移动设备浏览多页图谱
- **THEN** 分页控件采用简化的左右箭头形式
- **AND** 显示当前页码和总页数
- **AND** 隐藏中间页码数字，节省空间

### Requirement: 移动端模态框适配
系统 SHALL 在移动端提供全屏或底部弹出式模态框。

#### Scenario: 移动端模态框显示
- **WHEN** 用户在移动设备触发创建图谱等模态框
- **THEN** 模态框采用全屏或底部弹出形式
- **AND** 输入框适配移动端键盘弹出
- **AND** 确认/取消按钮固定在底部

### Requirement: 移动端快捷操作
系统 SHALL 在移动端提供悬浮快捷操作按钮。

#### Scenario: 移动端快捷创建
- **WHEN** 用户在移动设备浏览图谱列表
- **THEN** 页面右下角显示悬浮的"新建"按钮
- **AND** 点击后弹出快捷操作菜单
- **AND** 包含新建图谱、AI生成、导入等选项

## MODIFIED Requirements
无

## REMOVED Requirements
无
