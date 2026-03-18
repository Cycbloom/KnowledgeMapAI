# 移动端UI适配 - 产品需求文档

## Overview
- **Summary**: 完善知识图谱应用的移动端UI适配，确保所有功能和界面在移动端设备上都能正常显示和交互，提供优秀的用户体验。
- **Purpose**: 解决当前移动端UI支持不足的问题，让用户可以在手机和平板设备上顺畅使用所有功能，包括图谱编辑、学习、任务管理等核心模块。
- **Target Users**: 使用移动设备（手机、平板）访问知识图谱应用的用户。

## Goals
- 确保所有核心页面在移动端都有良好的响应式布局
- 优化触摸交互体验，包括按钮大小、手势操作等
- 完善移动端专用组件，如底部导航、抽屉菜单等
- 优化性能，确保在移动设备上运行流畅
- 通过所有移动端自动化测试

## Non-Goals (Out of Scope)
- 不重构现有的桌面端UI
- 不添加新的功能特性，只适配现有功能
- 不改变后端API或数据结构
- 不开发原生移动应用（已通过Capacitor支持）

## Background & Context
- 当前项目已基于Capacitor支持移动端，但UI适配不够完善
- 已有基础的移动端支持：useIsMobile hook、MobileBottomNav、MobileFocusTimer等
- 已有移动端测试用例，但测试覆盖率有限
- 使用Tailwind CSS作为样式框架，便于响应式设计
- 已有GraphEditor的部分移动端组件，但需要进一步完善

## Functional Requirements
- **FR-1**: 所有页面在移动端（<768px）和平板端（768-1024px）都有正确的响应式布局
- **FR-2**: 移动端按钮和可点击元素的触摸区域至少为44x44px
- **FR-3**: 图谱编辑器在移动端提供简化的工具栏和操作菜单
- **FR-4**: 表单元素在移动端有合适的尺寸和间距
- **FR-5**: 模态框和弹窗在移动端有全屏或适配显示
- **FR-6**: 支持常见的触摸手势（如双击、长按、滑动等）
- **FR-7**: 页面滚动和内容溢出在移动端有合适的处理

## Non-Functional Requirements
- **NFR-1**: 移动端首次加载时间不超过3秒
- **NFR-2**: 触摸操作响应时间不超过100ms
- **NFR-3**: 在主流移动浏览器（Safari、Chrome）上兼容
- **NFR-4**: 支持横竖屏切换，布局自动适应
- **NFR-5**: 符合WCAG可访问性标准

## Constraints
- **Technical**: 保持与现有桌面端代码的一致性，使用Tailwind CSS实现响应式
- **Business**: 在不改变现有功能的前提下完成适配
- **Dependencies**: 依赖现有的useIsMobile hook和Tailwind CSS框架

## Assumptions
- 用户使用现代移动设备，屏幕宽度在320px以上
- 主要使用触摸操作，不依赖精确的鼠标操作
- 网络连接状况可能不稳定，需要考虑离线场景

## Acceptance Criteria

### AC-1: 响应式布局适配
- **Given**: 用户在移动设备（宽度<768px）上访问应用
- **When**: 打开任意页面
- **Then**: 页面元素正确排列，没有横向滚动，内容完整显示
- **Verification**: programmatic
- **Notes**: 使用Playwright测试验证所有核心页面

### AC-2: 触摸区域大小
- **Given**: 用户在移动端使用应用
- **When**: 点击任意按钮或可交互元素
- **Then**: 元素的触摸区域至少为44x44px，易于点击
- **Verification**: programmatic
- **Notes**: 检查所有按钮、链接、输入框的尺寸

### AC-3: 图谱编辑器移动端适配
- **Given**: 用户在移动端打开图谱编辑器
- **When**: 进行节点操作、缩放、拖拽等
- **Then**: 所有操作都能正常完成，有合适的移动端操作菜单
- **Verification**: programmatic + human-judgment

### AC-4: 表单适配
- **Given**: 用户在移动端填写表单
- **When**: 输入文字、选择选项等
- **Then**: 表单元素有合适的尺寸，键盘弹出时布局正常
- **Verification**: human-judgment

### AC-5: 模态框适配
- **Given**: 用户在移动端打开模态框
- **When**: 模态框显示
- **Then**: 模态框在移动端全屏或有合适的边距，关闭按钮易于访问
- **Verification**: human-judgment

### AC-6: 横竖屏切换
- **Given**: 用户在移动端旋转设备
- **When**: 屏幕方向改变
- **Then**: 布局自动适应新的屏幕尺寸，没有内容错位
- **Verification**: programmatic

### AC-7: 性能要求
- **Given**: 用户在移动设备上使用应用
- **When**: 进行常规操作
- **Then**: 页面加载和操作响应流畅，没有明显卡顿
- **Verification**: programmatic + human-judgment

## Open Questions
- [ ] 是否需要为平板设备（768-1024px）提供专门的布局，还是直接复用桌面端布局？
- [ ] 图谱编辑器在移动端是否需要提供简化的视图模式？
- [ ] 是否需要添加移动端独有的手势操作（如滑动删除等）？
