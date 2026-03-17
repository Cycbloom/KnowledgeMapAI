# 移动端体验优化 Spec

## Why
移动端存在多个影响用户体验的问题：顶部消息栏遮挡内容、缺少导航入口、图谱视角无法移动、单指操作存在bug。这些问题严重影响了移动端用户的使用体验。

## What Changes
- 移除或优化顶部消息栏的显示方式，避免遮挡内容
- **BREAKING**: 将侧边栏导航改为底部导航栏（移动端）
- 修复图谱地图视角无法移动的问题
- 修复知识图谱单指移动时的触摸事件处理问题

## Impact
- Affected specs: 移动端布局、导航系统、图谱交互
- Affected code: 
  - `src/components/Layout/Layout.tsx` - 布局和导航
  - `src/components/common/MessageBar.tsx` - 消息栏
  - `src/components/GraphMap/GraphMapCanvas.tsx` - 图谱地图画布
  - `src/components/GraphEditor/canvas/MindMapCanvas.tsx` - 知识图谱画布

## ADDED Requirements

### Requirement: 移动端底部导航栏
系统应在移动端提供底部导航栏，替代原有的侧边栏导航。

#### Scenario: 移动端用户访问导航功能
- **WHEN** 用户在移动端访问应用
- **THEN** 应显示底部导航栏，包含主要功能入口
- **AND** 底部导航栏应包含：我的图谱、图谱地图、学习中心、统计中心、更多功能

#### Scenario: 底部导航栏安全区域
- **WHEN** 底部导航栏显示时
- **THEN** 应正确处理安全区域（iPhone 底部横条）
- **AND** 导航栏内容不应被系统UI遮挡

### Requirement: 移除顶部消息栏遮挡
系统应确保消息栏不会遮挡主要内容区域。

#### Scenario: 消息显示不遮挡内容
- **WHEN** 系统显示消息通知
- **THEN** 消息应以不遮挡主要内容的方式显示
- **AND** 在移动端，消息应从底部滑入或使用 Toast 形式

### Requirement: 图谱地图触摸移动
系统应允许用户通过触摸手势移动图谱地图视角。

#### Scenario: 单指移动视角
- **WHEN** 用户在图谱地图上使用单指滑动
- **THEN** 视角应跟随手指移动
- **AND** 移动应流畅无卡顿

#### Scenario: 双指缩放和移动
- **WHEN** 用户使用双指操作
- **THEN** 应支持缩放和移动视角
- **AND** 缩放中心点应在双指中点

### Requirement: 知识图谱单指移动修复
系统应正确处理知识图谱的单指移动操作。

#### Scenario: 单指拖动画布
- **WHEN** 用户在空白区域使用单指拖动
- **THEN** 画布应跟随移动
- **AND** 不应触发节点选择或其他意外行为

#### Scenario: 单指触摸节点
- **WHEN** 用户单指触摸节点
- **THEN** 应选中该节点
- **AND** 不应触发画布移动

## MODIFIED Requirements

### Requirement: 移动端布局适配
原有的移动端布局需要适配底部导航栏。

#### Scenario: 内容区域适配
- **WHEN** 底部导航栏显示时
- **THEN** 主内容区域应预留底部导航栏高度
- **AND** 内容不应被导航栏遮挡

#### Scenario: 全屏页面处理
- **WHEN** 用户进入图谱编辑器等全屏页面
- **THEN** 底部导航栏应隐藏或以最小化形式显示
- **AND** 用户可以通过手势呼出导航栏
