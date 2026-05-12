# 修复象限视图节点显示和标题位置问题

## 问题分析

### 问题1: 节点没有显示

**根本原因**：ID 匹配错误

在 GraphEditor.tsx 的 regions 计算中：
- `queue` 使用 `backboneNode.id`（这是 graph_node 表的主键 ID）
- 但边（Edge）使用的是 `source_knowledge_point_id` 和 `target_knowledge_point_id`（这是知识点 ID）
- 这两个 ID 不匹配，导致无法找到子节点

**修复方案**：
- 使用 `knowledge_point_id` 而不是 `id` 来匹配边

### 问题2: 区域标题显示位置

**当前问题**：
- 标题作为按钮显示在区域中间
- 用户希望标题显示在区域边缘（最外面的圆周上）

**修复方案**：
- 将标题文字沿着圆弧边缘显示
- 文字贴着最外面的圆周
- 不作为按钮，而是纯文字显示
- 图标可以保留在文字旁边

## 修复步骤

### Step 1: 修复 GraphEditor.tsx 中的 ID 匹配问题

修改 regions 计算逻辑，使用 `knowledge_point_id`：

```typescript
const childNodeIds = new Set<string>();
if (backboneNode) {
  // 使用 knowledge_point_id 而不是 id
  const queue = [backboneNode.knowledge_point_id];
  while (queue.length > 0) {
    const currentId = queue.shift()!;
    edges
      .filter((e) => e.source_knowledge_point_id === currentId)
      .forEach((e) => {
        if (!childNodeIds.has(e.target_knowledge_point_id)) {
          childNodeIds.add(e.target_knowledge_point_id);
          queue.push(e.target_knowledge_point_id);
        }
      });
  }
}

// 使用 knowledge_point_id 匹配节点
const regionNodes = nodes.filter(
  (n) => childNodeIds.has(n.knowledge_point_id) && n.knowledge_point_id !== backboneNode?.knowledge_point_id,
);
```

### Step 2: 修改 RegionHeader.tsx 显示在边缘

将标题显示在区域边缘：
- 计算标题位置在最外圆周上（使用 regionRadius）
- 文字沿着圆弧方向显示
- 使用 SVG text 元素的 transform 属性旋转文字
- 移除按钮样式，改为纯文字显示

```typescript
// 标题位置在最外圆周上
const labelRadius = radius;
const labelX = originX + labelRadius * Math.cos(midAngle);
const labelY = originY + labelRadius * Math.sin(midAngle);

// 文字旋转角度（让文字沿着圆弧方向）
const textRotation = (midAngle * 180 / Math.PI) + 90;
```

### Step 3: 简化 RegionHeader 组件

- 移除折叠按钮
- 移除圆形背景
- 只显示图标和文字
- 文字沿着圆弧边缘显示

## 文件修改清单

1. `src/pages/GraphEditor.tsx` - 修复 ID 匹配问题
2. `src/components/GraphEditor/canvas/RegionHeader.tsx` - 修改标题显示位置
