# 调试和修复象限视图节点显示问题

## 问题分析

象限视图中节点没有显示，可能的原因：

1. **骨干节点识别问题**：`properties.backboneModule` 没有被正确设置
2. **子节点查找问题**：BFS 遍历时 `knowledge_point_id` 不匹配
3. **节点过滤问题**：在 QuadrantCanvas 中过滤骨干节点时，可能过滤掉了所有节点
4. **数据结构问题**：节点和边的数据结构不一致

## 调试步骤

### Step 1: 添加调试日志到 GraphEditor.tsx

在 regions 计算中添加 console.log 来诊断问题：

```typescript
const regions = useMemo<RegionInfo[]>(() => {
  if (nodes.length === 0) return [];

  const isTopicResearch = graphMeta?.template_type === "topic_research";
  console.log("=== Quadrant View Debug ===");
  console.log("isTopicResearch:", isTopicResearch);
  console.log("Total nodes:", nodes.length);
  console.log("Total edges:", edges.length);

  if (isTopicResearch) {
    const backboneNodes = nodes.filter(
      (n) => n.properties?.backboneModule,
    );
    console.log("Backbone nodes found:", backboneNodes.length);
    backboneNodes.forEach(n => {
      console.log(`  - ${n.title}: backboneModule=${n.properties?.backboneModule}, knowledge_point_id=${n.knowledge_point_id}`);
    });
    // ... 继续调试
  }
}, [nodes, edges, graphMeta?.template_type, customRegions, collapsedRegions]);
```

### Step 2: 检查骨干节点的 properties.backboneModule

可能问题：骨干节点的 `properties.backboneModule` 没有被正确设置。

需要检查：
- 数据库中骨干节点的 `properties` 字段是否包含 `backboneModule`
- 前端获取节点数据时是否正确解析了 `properties`

### Step 3: 检查边的 knowledge_point_id 匹配

可能问题：边的 `source_knowledge_point_id` 和节点的 `knowledge_point_id` 不匹配。

需要检查：
- 边的数据结构
- BFS 遍历时是否能找到子节点

### Step 4: 检查节点渲染

可能问题：QuadrantNode 组件渲染有问题。

需要检查：
- `region.nodes` 是否有数据
- 节点的位置计算是否正确
- SVG 元素是否正确渲染

## 修复方案

根据调试结果，可能需要：

1. **如果骨干节点没有 properties.backboneModule**：
   - 检查数据获取逻辑
   - 确保数据库中的数据正确

2. **如果子节点查找失败**：
   - 检查边的 `source_knowledge_point_id` 和 `target_knowledge_point_id`
   - 确保 BFS 遍历逻辑正确

3. **如果节点渲染失败**：
   - 检查 QuadrantNode 组件
   - 确保位置计算正确

## 文件修改清单

1. `src/pages/GraphEditor.tsx` - 添加调试日志
2. 根据调试结果修复具体问题
