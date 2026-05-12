# 工具栏区域折叠控制功能

## 需求分析

用户希望通过工具栏实现区域折叠控制，并删除原来的点击标题折叠功能：
- 在工具栏中添加一个功能按钮
- 列出所有骨干模块（区域）
- 使用复选框让用户选择显示/隐藏哪些区域
- 只在象限视图 (quadrant) 中显示此功能
- **删除原来的点击标题折叠功能**

## 实现方案

### 1. 修改 GraphToolbar.tsx

添加新的 props：
```typescript
interface GraphToolbarProps {
  // ... 现有 props
  
  // 区域折叠控制（象限视图专用）
  viewMode: GraphViewMode;
  regions?: RegionInfo[];
  collapsedRegions?: string[];
  onRegionToggle?: (regionId: string) => void;
}
```

### 2. 添加区域控制下拉菜单

在视图下拉菜单中添加区域控制子菜单：
- 只在 `viewMode === "quadrant"` 时显示
- 显示所有区域的复选框列表
- 每个区域显示：图标 + 名称 + 节点数量
- 勾选表示展开，取消勾选表示折叠

### 3. 删除点击标题折叠功能

修改 `RegionHeader.tsx`：
- 删除 `onClick` 事件处理
- 删除 `cursor: pointer` 样式
- 删除 `whileHover` 动画
- 保留 `data-region-id` 用于其他事件检测

## 实施步骤

### 步骤 1: 修改 GraphToolbar Props
- 添加 `viewMode`, `regions`, `collapsedRegions`, `onRegionToggle` props

### 步骤 2: 在 GraphEditor.tsx 中传递 props
- 将 `viewMode`, `regions`, `collapsedRegions`, `handleRegionToggle` 传递给 GraphToolbar

### 步骤 3: 实现区域控制 UI
- 在视图下拉菜单中添加区域控制部分
- 使用复选框控制区域显示/隐藏
- 显示每个区域的节点数量

### 步骤 4: 删除 RegionHeader 点击折叠功能
- 移除 `onClick` 和相关样式

### 步骤 5: 运行类型检查
- `npm run check`

### 步骤 6: 测试功能
- 切换到象限视图
- 点击视图下拉菜单
- 勾选/取消勾选区域
- 验证区域正确折叠/展开
- 验证点击标题不再触发折叠

## 文件修改清单

1. **src/components/GraphEditor/toolbar/GraphToolbar.tsx**
   - 添加新 props
   - 添加区域控制 UI

2. **src/pages/GraphEditor.tsx**
   - 传递新 props 给 GraphToolbar

3. **src/components/GraphEditor/canvas/RegionHeader.tsx**
   - 删除点击折叠功能

## 预期效果

- 用户在象限视图中可以通过工具栏控制区域显示
- 复选框直观显示当前状态
- 点击标题不再触发折叠
- 操作简单明了，不会与拖动事件冲突
