# 修复象限视图骨干节点区域划分问题

## 问题分析

当前实现错误地按照节点的 `level` 属性（root/core）来划分区域，但正确做法应该是：

1. **专题研究图谱的骨干节点**：有固定的6个类型（BackboneModule枚举）
   - 研究背景 (research_background)
   - 文献综述 (literature_review)
   - 研究方法 (research_methods)
   - 核心概念 (core_concepts)
   - 应用领域 (application_domains)
   - 未来方向 (future_directions)

2. **骨干节点的识别**：通过节点的 `properties.backboneModule` 属性识别，而不是 `level`

3. **区域划分**：每个骨干节点固定占60度（360°/6），按固定顺序排列

4. **骨干节点不显示为节点**：骨干节点只作为区域标题，不作为节点渲染

## 修复步骤

### Step 1: 修改 GraphEditor.tsx 中的 regions 计算逻辑

修改 `regions` 的 useMemo 计算：

```typescript
const regions = useMemo<RegionInfo[]>(() => {
  if (nodes.length === 0) return [];

  const isTopicResearch = graphMeta?.template_type === "topic_research";
  
  if (isTopicResearch) {
    // 找到所有骨干节点（通过 backboneModule 属性识别）
    const backboneNodes = nodes.filter(
      (n) => n.properties?.backboneModule
    );
    
    // 按照固定的骨干节点顺序排列
    const orderedBackboneModules = [
      BackboneModule.RESEARCH_BACKGROUND,
      BackboneModule.LITERATURE_REVIEW,
      BackboneModule.RESEARCH_METHODS,
      BackboneModule.CORE_CONCEPTS,
      BackboneModule.APPLICATION_DOMAINS,
      BackboneModule.FUTURE_DIRECTIONS,
    ];
    
    // 每个骨干节点固定占60度
    const angleStep = (2 * Math.PI) / 6;
    
    return orderedBackboneModules.map((module, index) => {
      // 找到对应的骨干节点
      const backboneNode = backboneNodes.find(
        (n) => n.properties?.backboneModule === module
      );
      
      const angleStart = index * angleStep;
      const angleEnd = (index + 1) * angleStep;
      
      // 找到该骨干节点下的所有子节点（不包括骨干节点本身）
      const childNodeIds = new Set<string>();
      if (backboneNode) {
        const queue = [backboneNode.id];
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
      
      // 区域内的节点（不包括骨干节点本身）
      const regionNodes = nodes.filter(
        (n) => childNodeIds.has(n.id) && n.id !== backboneNode?.id
      );
      
      return {
        id: `region-${module}`,
        name: BACKBONE_MODULE_TITLES[module],
        color: BACKBONE_MODULE_COLORS[module],
        icon: BACKBONE_MODULE_ICONS[module],
        angleStart,
        angleEnd,
        nodes: regionNodes,
        isCollapsed: collapsedRegions.includes(`region-${module}`),
      };
    });
  }
  // ... 其他图谱类型的处理保持不变
}, [nodes, edges, graphMeta?.template_type, customRegions, collapsedRegions]);
```

### Step 2: 导入必要的常量

在 GraphEditor.tsx 顶部导入：
```typescript
import {
  BackboneModule,
  BACKBONE_MODULE_TITLES,
  BACKBONE_MODULE_COLORS,
  BACKBONE_MODULE_ICONS,
} from "@shared/types/graph";
```

### Step 3: 修改 QuadrantCanvas.tsx

确保骨干节点不会被渲染为普通节点：
- 在渲染节点时，过滤掉带有 `properties.backboneModule` 属性的节点

### Step 4: 测试验证

1. 打开专题研究图谱
2. 切换到象限视图
3. 验证：
   - 6个区域按固定顺序排列
   - 每个区域占60度
   - 区域标题显示骨干节点名称和图标
   - 骨干节点本身不显示为节点
   - 子节点正确分布在对应区域内

## 文件修改清单

1. `src/pages/GraphEditor.tsx` - 修改 regions 计算逻辑
2. `src/components/GraphEditor/canvas/QuadrantCanvas.tsx` - 过滤骨干节点不渲染
