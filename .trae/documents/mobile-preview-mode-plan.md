# 移动端节点预览模式计划

## 需求背景

当前移动端点击节点会直接打开全屏侧边栏，完全遮挡知识图谱，用户无法同时查看图谱和节点信息，操作不便。

## 解决方案

在移动端底部工具栏添加"预览模式"切换按钮，支持两种模式：

### 模式一：侧边栏模式（默认）
- 点击节点 → 打开全屏侧边栏
- 适合需要详细编辑的场景

### 模式二：预览模式（新增）
- 点击节点 → 显示浮动预览框（使用现有的 NodePreviewCard 组件）
- 预览框不遮挡图谱，用户可以继续操作
- 预览框底部添加"查看详情"按钮，点击后打开侧边栏

## 实现方案

### 1. 添加预览模式状态
**文件**: `src/pages/GraphEditor.tsx`

```typescript
const [isMobilePreviewMode, setIsMobilePreviewMode] = useState(false);
```

### 2. 修改节点点击逻辑
**文件**: `src/pages/GraphEditor.tsx`

```typescript
const handleNodeClick = useCallback((node: GraphNode) => {
  // ... 现有逻辑
  
  if (isMobile && isMobilePreviewMode) {
    // 预览模式：只选中节点，不打开侧边栏
    setSelectedNode(node);
    setSelectedNodeIds(new Set([node.id]));
    setFocusedNodeId(node.id);
    // 预览框由 MindMapCanvas 的 hover 机制自动显示
  } else {
    // 侧边栏模式：打开详情侧边栏
    setSidebarMode('detail');
    // ... 其他逻辑
  }
}, [isMobile, isMobilePreviewMode, ...]);
```

### 3. 底部工具栏添加切换按钮
**文件**: `src/components/GraphEditor/GraphToolbar.tsx`

在移动端底部导航栏添加"预览模式"切换按钮：
- 图标：Eye / EyeOff
- 位置：在"视图"按钮旁边
- 状态指示：激活时高亮显示

### 4. 增强移动端预览框
**文件**: `src/components/GraphEditor/NodePreviewCard.tsx`

移动端预览框需要增强：
- 固定在屏幕底部显示（而不是跟随鼠标位置）
- 添加"查看详情"按钮，点击打开侧边栏
- 添加关闭按钮
- 适配移动端触摸操作

### 5. MindMapCanvas 移动端预览支持
**文件**: `src/components/GraphEditor/MindMapCanvas.tsx`

- 添加 `mobilePreviewNode` prop
- 当移动端预览模式且选中节点时，显示固定位置的预览框

## 涉及文件

1. `src/pages/GraphEditor.tsx` - 添加状态和修改点击逻辑
2. `src/components/GraphEditor/GraphToolbar.tsx` - 添加切换按钮
3. `src/components/GraphEditor/NodePreviewCard.tsx` - 增强移动端适配
4. `src/components/GraphEditor/MindMapCanvas.tsx` - 添加移动端预览支持

## 任务清单

- [x] Task 1: GraphEditor 添加预览模式状态和逻辑
- [x] Task 2: GraphToolbar 添加预览模式切换按钮
- [x] Task 3: NodePreviewCard 增强移动端适配
- [x] Task 4: MindMapCanvas 添加移动端预览框显示
- [x] Task 5: 测试验证
