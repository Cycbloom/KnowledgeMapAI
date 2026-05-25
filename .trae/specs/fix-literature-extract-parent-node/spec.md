# 修复文献提取概念父节点指向错误 Spec

## Why

当前文献提取（`/literature/apply`）功能存在一个 **关键 Bug**：提取的新概念在创建 `contains` 边时，**错误地连接到了骨干模块的子节点**，而不是骨干模块的核心节点本身。

### 问题现象

用户执行文献提取后，新创建的概念节点通过 `contains` 边挂载到图谱时：
- **期望行为**：连接到骨干模块的 **core 级别根节点**（如"核心概念"、"研究方法"等）
- **实际行为**：可能连接到该模块下的 **普通子节点**（normal/leaf 级别）

### 影响范围

- 导致知识图谱树状结构混乱
- 新概念无法正确归类到对应的骨干模块
- 用户需要手动调整大量节点的父子关系

## What Changes

- **修复 `backboneModuleMap` 构建逻辑**：只选择 `level === 'root' || level === 'core'` 的节点作为骨干节点
- **增加优先级判断**：同一模块有多个匹配时，优先选择 `core` 级别 > `root` 级别
- **添加日志警告**：当检测到非核心级别节点被跳过时记录日志

## Impact

- Affected specs: 无
- Affected code:
  - `api/routes/literature.ts` - `/apply` 路由中的 backbone 节点查询逻辑（第954-1002行）

## Bug 根因分析

### 问题代码位置

[api/routes/literature.ts](file:///d:/KnowledgeMap/api/routes/literature.ts#L954-L1002)

### 当前实现（有 Bug）

```typescript
// 第954-1002行：查询所有 graph_nodes，没有过滤 level
const { data: backboneNodes } = await supabase
  .from("graph_nodes")
  .select(`
    id,
    knowledge_point_id,
    knowledge_points (
      id,
      title,
      properties
    )
  `)
  .eq("graph_id", graph_id)
  .is("deleted_at", null);

const backboneModuleMap = new Map<BackboneModule, string>();

if (backboneNodes) {
  for (const gn of backboneNodes) {
    // ... 检查 backboneModule 属性或标题匹配 ...

    if (moduleValue) {
      backboneModuleMap.set(moduleValue, gn.id);  // ❌ BUG：后面的节点会覆盖前面的！
    }
  }
}
```

### Bug 原因

1. **查询范围过大**：查询了图谱中**所有级别**的节点（root/core/sub/normal/leaf），而不是只查询骨干节点
2. **覆盖逻辑错误**：遍历时后面的节点会**覆盖**前面同模块的节点
3. **缺少级别过滤**：没有检查 `graph_nodes.level` 字段来确保只选择核心级别的节点

### 触发场景示例

假设图谱结构如下：
```
核心概念 [core, id: node-eee] ← 正确的骨干节点
  ├── CNN [normal, id: node-fff]
  └── 深度学习 [normal, id: node-ggg] ← 可能被错误选中！

研究背景 [core, id: node-aaa] ← 正确的骨干节点
  └── 背景介绍 [normal, id: node-bbb] ← 可能被错误选中！
```

如果遍历顺序是 aaa → bbb → eee → fff → ggg：
- `backboneModuleMap["core_concepts"]` 最终 = `node-ggg` ❌ （应该是 `node-eee`）
- 新提取的概念会错误地挂载到"深度学习"下，而不是"核心概念"下

## ADDED Requirements

### Requirement: 骨干节点级别过滤

系统 SHALL 在构建 `backboneModuleMap` 时，**只选择 `level` 为 `'root'` 或 `'core'` 的节点**作为有效的骨干节点。

#### 场景 1: 过滤非核心节点

**WHEN** 查询图谱中的潜在骨干节点时

**THEN** 系统 SHALL 过滤掉 `level` 为 `'sub'`、`'normal'`、`'leaf'` 的节点

**AND** 只保留 `gn.level === 'root' || gn.level === 'core'` 的节点

#### 场景 2: 同模块多节点优先级

**WHEN** 同一个 `BackboneModule` 匹配到多个候选节点时

**THEN** 系统 SHALL 按以下优先级选择：
1. **首选**：`level === 'core'` 的节点
2. **次选**：`level === 'root'` 的节点
3. **忽略**：其他级别的节点

### Requirement: 日志增强

系统 SHALL 在构建骨干节点映射时输出详细的调试日志。

#### 场景 1: 记录跳过的非核心节点

**WHEN** 遍历到一个具有 `backboneModule` 属性但 `level` 不是 `'root'` 或 `'core'` 的节点时

**THEN** 系统 SHALL 记录一条 `warn` 级别的日志，说明该节点被跳过及其原因

```typescript
logger.warn(`Skipping non-core backbone node`, {
  nodeId: gn.id,
  nodeTitle: kp.title,
  moduleValue,
  level: gn.level,
  reason: "Node level is not root or core"
});
```

#### 场景 2: 记录最终选择的骨干节点

**WHEN** `backboneModuleMap` 构建完成时

**THEN** 系统 SHALL 记录每个模块最终选择的节点 ID 和标题

```typescript
logger.info(`Backbone module mapping completed`, {
  modules: Array.from(backboneModuleMap.entries()).map(([module, nodeId]) => ({
    module,
    nodeId,
    // 可选：查询节点标题
  }))
});
```

## MODIFIED Requirements

### Requirement: Literature Apply Route - Backbone Node Selection

修改后的骨干节点选择逻辑：

```typescript
// 第954-1002行修复后的代码
const { data: allGraphNodes } = await supabase
  .from("graph_nodes")
  .select(`
    id,
    level,  // ✅ 新增：必须查询 level 字段
    knowledge_point_id,
    knowledge_points (
      id,
      title,
      properties
    )
  `)
  .eq("graph_id", graph_id)
  .is("deleted_at", null);

const backboneModuleMap = new Map<BackboneModule, string>();
const candidateMap = new Map<BackboneModule, Array<{id: string, title: string, level: string}>>();

if (allGraphNodes) {
  for (const gn of allGraphNodes) {
    const kp = gn.knowledge_points as unknown as {
      id: string;
      title: string;
      properties?: { backboneModule?: BackboneModule };
    };

    if (!kp) continue;

    let moduleValue = kp?.properties?.backboneModule;

    if (!moduleValue) {
      const matchedModule = TITLE_TO_BACKBONE_MODULE[kp.title.trim()];
      if (matchedModule) {
        moduleValue = matchedModule;
      }
    }

    if (moduleValue) {
      // ✅ 新增：只处理 root 或 core 级别的节点
      if (gn.level !== 'root' && gn.level !== 'core') {
        logger.warn(`Skipping non-core backbone node`, {
          nodeId: gn.id,
          nodeTitle: kp.title,
          moduleValue,
          level: gn.level,
        });
        continue;  // 跳过非核心节点
      }

      // ✅ 新增：收集所有候选节点
      if (!candidateMap.has(moduleValue)) {
        candidateMap.set(moduleValue, []);
      }
      candidateMap.get(moduleValue)!.push({
        id: gn.id,
        title: kp.title,
        level: gn.level,
      });
    }
  }

  // ✅ 新增：从候选节点中选择最优的
  for (const [module, candidates] of candidateMap) {
    // 优先选择 core 级别，其次是 root
    const coreCandidate = candidates.find(c => c.level === 'core');
    const selected = coreCandidate || candidates.find(c => c.level === 'root');

    if (selected) {
      backboneModuleMap.set(module, selected.id);
      logger.info(`Selected backbone node for module ${module}`, {
        moduleId: module,
        nodeId: selected.id,
        nodeTitle: selected.title,
        nodeLevel: selected.level,
        totalCandidates: candidates.length,
      });
    }
  }
}
```

## REMOVED Requirements

无

## 测试用例

### 测试用例 1: 正确选择 core 级别节点

**前置条件**:
- 图谱中存在"核心概念"模块
- 有以下节点：
  - `{ id: "node-core", title: "核心概念", level: "core", backboneModule: "core_concepts" }`
  - `{ id: "node-child1", title: "CNN", level: "normal" }`
  - `{ id: "node-child2", title: "深度学习", level: "normal" }`

**操作**: 执行文献提取 apply，目标模块为 `core_concepts`

**预期结果**:
- 新概念的 `parentId` 应为 `"node-core"`（核心概念）
- 不应为 `"node-child1"` 或 `"node-child2"`

### 测试用例 2: 多个 core 级别节点取第一个

**前置条件**:
- 图谱中存在两个 `backboneModule: "research_methods"` 的 core 节点（异常情况）

**操作**: 构建 backboneModuleMap

**预期结果**:
- 选择第一个遇到的 core 节点
- 记录警告日志说明存在重复

### 测试用例 3: 只有 root 级别节点

**前置条件**:
- 图谱中只有 root 级别的研究主题节点标记为某模块

**操作**: 构建 backboneModuleMap

**预期结果**:
- 正确选择 root 级别节点作为骨干节点

## 实现检查清单

- [ ] 修改 `api/routes/literature.ts` 第954-1002行的查询逻辑
- [ ] 增加 `level` 字段到 SELECT 查询中
- [ ] 添加级别过滤条件（只接受 root/core）
- [ ] 实现候选节点收集和优先级选择逻辑
- [ ] 添加详细的日志输出（跳过警告 + 最终选择信息）
- [ ] 手动测试：在有子节点的图谱上执行文献提取，验证 parentId 正确性
- [ ] 运行 `npm run check` 和 `npm run lint` 确保代码质量
