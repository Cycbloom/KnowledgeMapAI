# 象限视图幽灵高亮深度调试与修复计划

## 问题分析

用户反馈：点击"网络钓鱼检测"节点后，"钓鱼欺诈检测"节点被高亮，但两者之间**没有可见连线**。

### 已完成的修复（上一轮）
- ✅ 添加了 ID 标准化机制 (`normalizeId`)
- ✅ 修复了 hasFocusMode 判断逻辑
- ✅ 重构了 visibleFocusedNodeIds 计算
- ✅ 添加了调试日志
- ✅ 添加了单元测试

### 🔍 新发现的潜在根因

#### 问题1：关系类型映射不完整 ❌❌❌ **高度可疑**

**数据库中的关系类型** ([54_seed_relationship_types.sql](file:///d:/KnowledgeMap/supabase/migrations/54_seed_relationship_types.sql)):
```sql
-- 默认值: 'related'
relationship_type VARCHAR(50) DEFAULT 'related'

-- 实际类型包括:
'related', 'similar_to', 'opposite', 'synonym', 'equivalent'
'contains', 'part_of', 'parent_child'
'depends_on', 'prerequisite', 'constrains', 'supports', 'mutex', 'exclusive'
'follows', 'parallel', 'branch', 'merge', 'trigger', 'loop'
'points_to', 'acts_on', 'influences', 'feedback', 'calls'
'causes', 'derives', 'proportional', 'inverse'
```

**QuadrantEdge 组件定义的类型** ([QuadrantEdge.tsx:15-22](file:///d:/KnowledgeMap/src/components/GraphEditor/canvas/QuadrantEdge.tsx#L15-L22)):
```typescript
const RELATION_COLORS: Record<string, string> = {
  depends_on: "var(--primary-500)",    // ✓ 存在
  part_of: "#10B981",                   // ✓ 存在
  related_to: "var(--tertiary-500)",   // ❌ 数据库是 'related' 不是 'related_to'
  derived_from: "#F59E0B",              // ❌ 数据库是 'derives' 不是 'derived_from'
  prerequisite: "#EF4444",             // ✓ 存在
  default: "var(--slate-500)",         // fallback 灰色
};
```

**⚠️ 关键发现**：
- 如果边的 `relationship_type = 'related'`（数据库默认值），会 fallback 到 `default`
- 使用**灰色** + `opacity=0.45` → 几乎不可见！
- 这解释了为什么"边存在但看不见"

#### 问题2：默认透明度可能过低 ⚠️

[QuadrantEdge.tsx:50-51](file:///d:/KnowledgeMap/src/components/GraphEditor/canvas/QuadrantEdge.tsx#L50-L51):
```typescript
const strokeWidth = highlighted ? 2.5 : hasFocusMode ? 1 : 1.2;
const strokeOpacity = highlighted ? 1 : hasFocusMode ? 0.15 : 0.45;  // ← 默认 0.45 可能太低
```

- 非聚焦模式：`opacity=0.45` + 灰色 → 在复杂背景下几乎不可见
- 聚焦模式暗淡：`opacity=0.15` → 完全不可见

#### 问题3：边可能被过滤掉 ❓

需要验证：
- 边的两端是否都在 `nodePositions` 中？
- 是否有一端是 core 节点或折叠区域节点？

---

## 实施步骤

### Phase 1: 增强诊断能力（立即执行）

#### Step 1.1: 扩展调试日志
在 [QuadrantCanvas.tsx](file:///d:/KnowledgeMap/src/components/GraphEditor/canvas/QuadrantCanvas.tsx) 的 regionEdges 计算中添加详细日志：

```typescript
if (process.env.NODE_ENV === "development") {
  console.warn("[QuadrantCanvas] regionEdges 详细分析:", {
    totalEdges: edges.length,
    filteredEdges: filtered.length,
    visibleNodeCount: nodeIds.size,
    
    // 显示被过滤掉的边及原因
    filteredOutEdges: edges.filter((edge) => {
      const srcId = normalizeId(edge.source_knowledge_point_id);
      const tgtId = normalizeId(edge.target_knowledge_point_id);
      return !(srcId && tgtId && nodeIds.has(srcId) && nodeIds.has(tgtId));
    }).map((edge) => ({
      id: edge.id,
      source: edge.source_knowledge_point_id,
      target: edge.target_knowledge_point_id,
      sourceVisible: nodeIds.has(normalizeId(edge.source_knowledge_point_id)),
      targetVisible: nodeIds.has(normalizeId(edge.target_knowledge_point_id)),
      relationship_type: edge.relationship_type,
    })),
    
    // 显示保留的边及其类型分布
    keptEdges: filtered.map((edge) => ({
      id: edge.id,
      source: edge.source_knowledge_point_id,
      target: edge.target_knowledge_point_id,
      relationship_type: edge.relationship_type,
    })),
  });
}
```

#### Step 1.2: 在 visibleFocusedNodeIds 中添加日志
输出：
- focusedNodeId
- regionEdges 中与 focusedNodeId 相关的边
- 最终的 visibleFocusedNodeIds 内容
- 对比：focusedNodeIds（父组件传入）vs visibleFocusedNodeIds（实际使用）

### Phase 2: 修复关系类型映射（核心修复）

#### Step 2.1: 更新 QuadrantEdge 的 RELATION_COLORS 和 LINE_STYLES

文件：[QuadrantEdge.tsx](file:///d:/KnowledgeMap/src/components/GraphEditor/canvas/QuadrantEdge.tsx)

**修改为完整的类型映射**：
```typescript
const RELATION_COLORS: Record<string, string> = {
  // 层级结构 (hierarchical)
  contains: "var(--primary-500)",
  part_of: "#10B981",
  parent_child: "var(--primary-500)",
  
  // 依赖约束 (dependency)
  depends_on: "#F59E0B",
  prerequisite: "#EF4444",
  constrains: "#F59E0B",
  supports: "#10B981",
  mutex: "#EF4444",
  exclusive: "#EF4444",
  
  // 语义关系 (semantic) ← 修复重点
  related: "var(--slate-400)",        // 新增：数据库默认值
  similar_to: "var(--tertiary-500)",
  opposite: "#EC4899",
  synonym: "var(--tertiary-500)",
  equivalent: "var(--tertiary-500)",
  generalization: "#10B981",
  specialization: "#10B981",
  
  // 时序流程 (temporal)
  follows: "#06B6D4",
  parallel: "#06B6D4",
  branch: "#06B6D4",
  merge: "#06B6D4",
  trigger: "#06B6D4",
  loop: "#06B6D4",
  
  // 交互行为 (interaction)
  points_to: "#F97316",
  acts_on: "#F97316",
  influences: "#F97316",
  feedback: "#F97316",
  calls: "#F97316",
  
  // 因果推导 (causal)
  causes: "#DC2626",
  derives: "#DC2626",                  // 修复：原 derived_from
  proportional: "#DC2626",
  inverse: "#DC2626",
  
  // 兼容旧代码
  related_to: "var(--tertiary-500)",   // 保留兼容
  derived_from: "#F59E0B",             // 保留兼容
  
  default: "var(--slate-500)",
};

const LINE_STYLES: Record<string, string> = {
  // 层级结构 (hierarchical)
  contains: "solid",
  part_of: "solid",
  parent_child: "solid",
  
  // 依赖约束 (dependency)
  depends_on: "dashed",
  prerequisite: "dotted",
  constrains: "dashed",
  supports: "dashed",
  mutex: "dotted",
  exclusive: "dotted",
  
  // 语义关系 (semantic)
  related: "solid",
  similar_to: "solid",
  opposite: "solid",
  synonym: "solid",
  equivalent: "solid",
  generalization: "solid",
  specialization: "solid",
  
  // 时序流程 (temporal)
  follows: "dashed",
  parallel: "solid",
  branch: "solid",
  merge: "solid",
  trigger: "dashed",
  loop: "dashed",
  
  // 交互行为 (interaction)
  points_to: "solid",
  acts_on: "solid",
  influences: "dashed",
  feedback: "dashed",
  calls: "solid",
  
  // 因果推导 (causal)
  causes: "solid",
  derives: "solid",
  proportional: "solid",
  inverse: "solid",
  
  // 兼容旧代码
  related_to: "dashed",
  derived_from: "dashed",
  
  default: "solid",
};
```

### Phase 3: 提升边的可见性（视觉优化）

#### Step 3.1: 调整默认透明度

文件：[QuadrantEdge.tsx:50-51](file:///d:/KnowledgeMap/src/components/GraphEditor/canvas/QuadrantEdge.tsx#L50-L51)

```typescript
// 修改前
const strokeOpacity = highlighted ? 1 : hasFocusMode ? 0.15 : 0.45;

// 修改后：提升可见性
const strokeOpacity = highlighted 
  ? 1 
  : hasFocusMode 
    ? 0.25   // 从 0.15 提升到 0.25（仍可辨识但不抢眼）
    : 0.55;  // 从 0.45 提升到 0.55（更清晰可见）
```

#### Step 3.2: 提升线宽

```typescript
// 修改前
const strokeWidth = highlighted ? 2.5 : hasFocusMode ? 1 : 1.2;

// 修改后
const strokeWidth = highlighted 
  ? 2.5 
  : hasFocusMode 
    ? 1.2   // 从 1 提升到 1.2
    : 1.5;  // 从 1.2 提升到 1.5
```

### Phase 4: 添加边的自定义属性支持（可选增强）

如果 Edge 类型包含 `custom_color`、`custom_line_style` 字段（从数据库 schema 看确实有）：

#### Step 4.1: 使用边的自定义属性覆盖默认样式

```typescript
const relationType = edge.relationship_type || "default";
let color = RELATION_COLORS[relationType] || RELATION_COLORS.default;
let lineStyle = LINE_STYLES[relationType] || LINE_STYLES.default;

// 支持边的自定义属性（优先级高于关系类型默认值）
if (edge.custom_color) {
  color = edge.custom_color;
}
if (edge.custom_line_style) {
  lineStyle = edge.custom_line_style;
}
```

### Phase 5: 测试验证

#### Step 5.1: 手动测试场景
1. 打开象限视图
2. 点击"网络钓鱼检测"节点
3. 观察控制台 `[QuadrantCanvas]` 日志：
   - 确认 regionEdges 是否包含目标边
   - 确认边的 relationship_type 是什么
   - 确认 visibleFocusedNodeIds 是否包含"钓鱼欺诈检测"
4. 视觉检查：
   - 是否能看到连线？
   - 连线颜色是否正确？
   - 高亮是否合理？

#### Step 5.2: 自动化测试
更新现有单元测试，增加对以下场景的验证：
- `relationship_type='related'` 的边能正确渲染
- 自定义颜色属性能正确应用
- 不同透明度设置下的可见性

---

## 预期效果

### 修复前的问题现象
- ❌ 点击节点A，节点B高亮但无可见连线
- ❌ 大量边因 fallback 到灰色+低透明度而不可见
- ❌ 关系类型映射不完整导致样式错误

### 修复后的预期效果
- ✅ 所有数据库中的关系类型都有正确的颜色和线型
- ✅ 默认透明度和线宽提升，边更清晰可见
- ✅ 幽灵高亮彻底消除（只有通过可见边连接的节点才高亮）
- ✅ 支持边的自定义样式属性
- ✅ 调试日志完善，便于后续排查

---

## 文件修改清单

| 文件 | 修改内容 | 优先级 |
|------|---------|--------|
| `src/components/GraphEditor/canvas/QuadrantEdge.tsx` | 完整关系类型映射 + 可见性优化 | P0 - 必须 |
| `src/components/GraphEditor/canvas/QuadrantCanvas.tsx` | 增强调试日志 | P0 - 必须 |
| `src/components/GraphEditor/canvas/__tests__/QuadrantCanvas.test.tsx` | 新增边界测试用例 | P1 - 重要 |

---

## 风险评估

### 低风险
- ✅ 关系类型扩展：只影响视觉效果，不影响逻辑
- ✅ 透明度调整：微调数值，可快速回滚
- ✅ 日志添加：仅开发环境生效

### 注意事项
- ⚠️ 确保 `custom_color`、`custom_line_style` 字段在 Edge 类型定义中存在
- ⚠️ 测试不同背景色下的边可见性（亮色/暗色模式）

---

## 时间估计

- Phase 1（诊断）：10 分钟
- Phase 2（类型映射修复）：15 分钟
- Phase 3（可见性优化）：10 分钟
- Phase 4（可选增强）：10 分钟
- Phase 5（测试验证）：15 分钟

**总计**：约 60 分钟（不含可选增强则为 50 分钟）
