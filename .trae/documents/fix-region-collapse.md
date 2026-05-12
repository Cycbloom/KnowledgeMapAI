# 区域折叠功能修复计划

## 问题分析

用户反馈：手动折叠功能无法正常工作，点击区域标题无法折叠区域。

### 代码流程分析

1. **GraphEditor.tsx**
   - `collapsedRegions` 状态为 `string[]` 类型
   - `handleRegionToggle` 正确更新状态

2. **QuadrantCanvas.tsx**
   - 接收 `externalCollapsedRegions`（string[]）
   - 通过 `useMemo` 转换为 `Set<string>`
   - 当 `externalCollapsedRegions.length > 0` 时使用外部状态，否则使用内部状态

3. **RegionHeader.tsx**
   - `onClick` 绑定在最外层 `<g>` 元素上
   - 内部 `motion.g` 和 `motion.text` 可能阻止事件传播

### 根本原因

`RegionHeader` 组件中的点击事件处理存在问题：
- `onClick` 绑定在外层 `<g>` 元素
- 内部 `motion.g` 元素没有 `pointerEvents: "none"`
- 点击时事件被 `motion.g` 捕获但没有处理函数
- 事件没有正确冒泡到外层 `<g>`

## 修复方案

### 修改 RegionHeader.tsx

1. **将点击事件移到 motion.g 上**
   - 删除外层 `<g>` 的 `onClick`
   - 在 `motion.g` 上添加 `onClick` 处理

2. **确保事件正确传播**
   - 为 `motion.g` 添加 `style={{ cursor: "pointer" }}`
   - 保持内部 `motion.text` 的 `pointerEvents: "none"`

3. **添加悬停效果（可选）**
   - 添加 `whileHover` 动画提供视觉反馈

### 代码修改

```tsx
// RegionHeader.tsx
export const RegionHeader: React.FC<RegionHeaderProps> = ({
  region,
  isCollapsed,
  onToggle,
  originX,
  originY,
  radius,
  isDark,
}) => {
  // ... 现有计算逻辑 ...

  return (
    <g data-region-id={region.id}>
      <motion.g
        onClick={onToggle}
        style={{ cursor: "pointer" }}
        initial={false}
        animate={{ opacity: isCollapsed ? 0.6 : 1 }}
        whileHover={{ scale: 1.02 }}
        transition={{ duration: 0.2 }}
      >
        {/* 文字和折叠指示器 */}
      </motion.g>
    </g>
  );
};
```

## 实施步骤

1. 修改 `RegionHeader.tsx`：
   - 将 `onClick` 和 `style={{ cursor: "pointer" }}` 从外层 `<g>` 移到 `motion.g`
   - 添加 `whileHover` 动画效果
   - 保持 `data-region-id` 在外层 `<g>` 用于事件检测

2. 运行类型检查：`npm run check`

3. 测试功能：
   - 点击区域标题应能折叠/展开
   - 折叠后显示节点数量指示器
   - 再次点击应能展开

## 预期结果

- 用户点击区域标题时，区域正确折叠/展开
- 折叠状态下显示节点数量徽章
- 展开状态下显示节点和边
