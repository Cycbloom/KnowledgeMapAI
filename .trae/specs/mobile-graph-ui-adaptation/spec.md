# 知识导图移动端 UI 适配 Spec

## Why
知识导图是应用的核心功能，但当前 UI 设计主要针对桌面端，在移动设备上存在工具栏拥挤、侧边栏占用空间过大、触摸操作不友好等问题，严重影响移动端用户体验。

## What Changes
- 重构 GraphToolbar 为移动端友好的底部导航栏模式
- 将 GraphSidebarManager 改为移动端全屏/底部抽屉模式
- 增强 MindMapCanvas 的触摸手势支持
- 优化 NodeDetailSidebar 和 NodeEditSidebar 的移动端布局
- 添加移动端专用的节点快捷操作菜单

## Impact
- Affected specs: 无
- Affected code:
  - `src/pages/GraphEditor.tsx` - 主页面布局调整
  - `src/components/GraphEditor/GraphToolbar.tsx` - 工具栏重构
  - `src/components/GraphEditor/GraphSidebarManager.tsx` - 侧边栏适配
  - `src/components/GraphEditor/MindMapCanvas.tsx` - 触摸手势支持
  - `src/components/GraphEditor/NodeDetailSidebar.tsx` - 详情面板适配
  - `src/components/GraphEditor/NodeEditSidebar.tsx` - 编辑面板适配
  - `src/hooks/useIsMobile.ts` - 移动端检测增强

## ADDED Requirements

### Requirement: 移动端工具栏适配
系统 SHALL 在移动端显示底部导航栏替代顶部工具栏。

#### Scenario: 移动端显示底部工具栏
- **WHEN** 用户在移动设备（宽度 < 768px）访问知识导图
- **THEN** 工具栏显示为底部固定的导航栏
- **AND** 主要操作按钮（返回、添加节点、AI 功能、设置）以图标形式显示
- **AND** 次要功能收纳到"更多"菜单中

#### Scenario: 桌面端保持原有布局
- **WHEN** 用户在桌面设备（宽度 >= 768px）访问知识导图
- **THEN** 工具栏保持顶部水平布局
- **AND** 所有功能按钮正常显示

### Requirement: 侧边栏移动端适配
系统 SHALL 在移动端使用全屏抽屉模式显示侧边栏。

#### Scenario: 移动端侧边栏全屏显示
- **WHEN** 用户在移动端打开侧边栏（大纲/详情/编辑）
- **THEN** 侧边栏以全屏抽屉形式从底部/右侧滑入
- **AND** 画布内容被完全覆盖
- **AND** 提供明显的关闭按钮

#### Scenario: 移动端侧边栏手势关闭
- **WHEN** 用户在移动端侧边栏打开时向下滑动
- **THEN** 侧边栏关闭
- **AND** 返回到画布视图

### Requirement: 画布触摸手势支持
系统 SHALL 支持移动端触摸手势操作画布。

#### Scenario: 双指缩放画布
- **WHEN** 用户在画布上使用双指捏合/张开手势
- **THEN** 画布相应缩放
- **AND** 缩放范围限制在 0.1x 到 3x 之间

#### Scenario: 单指拖动画布
- **WHEN** 用户在画布空白区域单指拖动
- **THEN** 画布相应平移

#### Scenario: 节点触摸选择
- **WHEN** 用户点击节点
- **THEN** 节点被选中并显示详情面板
- **AND** 节点显示选中高亮效果

#### Scenario: 节点长按菜单
- **WHEN** 用户长按节点超过 500ms
- **THEN** 显示节点快捷操作菜单（编辑、删除、AI 拓展等）

### Requirement: 节点详情面板移动端适配
系统 SHALL 在移动端优化节点详情面板布局。

#### Scenario: 移动端详情面板布局
- **WHEN** 用户在移动端查看节点详情
- **THEN** 详情面板以全屏模式显示
- **AND** 标题和主要信息在顶部清晰展示
- **AND** 操作按钮固定在底部
- **AND** 内容区域可滚动

#### Scenario: 移动端编辑面板布局
- **WHEN** 用户在移动端编辑节点
- **THEN** 编辑面板以全屏模式显示
- **AND** 表单字段适配移动端输入
- **AND** 保存/取消按钮固定在底部

### Requirement: 移动端快捷操作菜单
系统 SHALL 提供移动端专用的节点快捷操作菜单。

#### Scenario: 节点快捷操作菜单
- **WHEN** 用户在移动端选中节点后点击浮动操作按钮
- **THEN** 显示快捷操作菜单
- **AND** 包含常用操作：编辑、AI 拓展、生成卡片、删除
- **AND** 菜单以底部弹出形式显示

## MODIFIED Requirements

### Requirement: useIsMobile Hook 增强
Hook SHALL 支持更精细的设备检测和断点配置。

**原实现**:
```typescript
export function useIsMobile(breakpoint = 768) {
  const [isMobile, setIsMobile] = useState(false);
  // ...
}
```

**修改后**:
```typescript
interface DeviceInfo {
  isMobile: boolean;
  isTablet: boolean;
  isDesktop: boolean;
  screenWidth: number;
  orientation: 'portrait' | 'landscape';
}

export function useIsMobile(): DeviceInfo {
  // 返回更详细的设备信息
}
```

## REMOVED Requirements
无
