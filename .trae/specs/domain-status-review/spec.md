# 领域-AI 深度集成与高级功能完善 Spec v2

## Why

当前领域（Domain）体系的基础设施已经完整（数据模型、CRUD API、核心 UI），并且 DomainGraphGenerator、CrossDomainInsightsSection 等高级组件的 UI 和后端 API 已经基本就绪。

但存在以下关键问题需要解决：

1. **AI 服务缺乏领域感知**：当前 AI 分析是全局的，没有先判断图谱所属领域再进行针对性分析，导致推荐结果泛化、不够精准
2. **跨域分析管道不完整**：CrossDomainInsightsSection 组件已完成，但缺少与 GraphMap 页面的完整集成和触发入口
3. **Phase 4 功能未实现**：AI 自动生成颜色、领域拖拽排序等增强功能尚未开发
4. **批量处理需优化**：当前的批量创建流程可以进一步完善错误处理和用户体验

本 Spec 的目标是：
- **让 AI 服务具备领域感知能力**：先识别领域 → 再在领域上下文中进行分析和推荐
- **完善跨域洞察的数据管道**：让用户能真正使用跨学科交叉点分析
- **补齐 Phase 4 增强功能**：提升领域的智能化和易用性
- **优化批量处理的健壮性**：确保大规模操作的稳定性

## 当前实现状态（基于调研）

### ✅ 已完成的基础设施

#### 后端 API（已实现）
| 端点 | 状态 | 文件位置 |
|------|------|----------|
| `POST /graphs/domain/analyze` | ✅ 完整 | `api/routes/graphs.ts:874-1027` |
| `POST /graphs/domain/expand` | ✅ 完整 | `api/routes/graphs.ts:1030-1247` |
| `POST /graphs/domain/batch-create` | ✅ 完整 | `api/routes/graphs.ts:1250-1397` |
| `POST /graphs/batch-initialize` | ✅ 完整 | `api/routes/graphs.ts:1408-1489` |
| `POST /graphs/cross-domain-insights` | ✅ 完整 | `api/routes/graphs.ts:1658-1690` |
| `POST /graphs/discover-relations` | ✅ 完整 | `api/routes/graphs.ts:1589-1615` |
| `GET/POST/PUT/DELETE /api/domains` | ✅ 完整 | `api/routes/domains.ts` |

#### 前端组件（已实现）
| 组件 | 状态 | 集成情况 |
|------|------|----------|
| DomainFilter | ✅ 完成 | 已集成到 GraphMapToolbar |
| DomainBackground | ✅ 完成 | 已集成到 GraphMapCanvas |
| DomainManager | ✅ 完成 | 已集成到 GraphMapToolbar |
| DomainGraphGenerator | ✅ UI完成 | 已集成到 GraphMap.tsx:1489-1541 |
| CrossDomainInsightsSection | ✅ UI完成 | 待完善触发入口 |

#### 前端 API 服务层（已实现）
```typescript
// src/services/api/graphs.ts - 已定义的方法
analyzeDomain(domain, count)          // → POST /graphs/domain/analyze
expandDomain(graphIds, count, domain) // → POST /graphs/domain/expand
batchCreateDomainGraphs(data)        // → POST /graphs/domain/batch-create
batchInitializeGraphs(data)          // → POST /graphs/batch-initialize
discoverRelations(data)              // → POST /graphs/discover-relations
```

### 🔶 待完善的缺口

#### 缺口 1: AI 缺乏领域感知（核心问题）

**现状问题**：
```
当前流程（全局分析）:
用户输入 "机器学习"
    ↓
AI 直接分析 → 返回推荐（可能包含数学、编程、硬件等混杂内容）
    ↓
结果泛化，不够精准
```

**目标流程（领域感知）**:
```
优化后的流程（领域感知）:
用户输入 "机器学习" 或 选择现有图谱
    ↓
① 先识别领域归属（查询 domains 表或 AI 判断）
    ↓
② 获取该领域内的已有图谱作为上下文
    ↓
③ 在领域上下文中调用 AI 分析
    ↓
④ 返回的结果更精准、更符合该领域的知识体系
```

**影响范围**：
- `POST /graphs/domain/analyze` - 需要注入领域上下文
- `POST /graphs/domain/expand` - 需要增强领域关联逻辑
- `POST /graphs/discover-relations` - 可选按领域筛选
- AI Prompt 模板需要支持领域变量注入

---

#### 缺口 2: 跨域分析集成不完整

**现状**：
- ✅ `POST /graphs/cross-domain-insights` API 已实现
- ✅ CrossDomainInsightsSection UI 组件已完成
- ❌ 缺少在 GraphMap 页面的触发入口
- ❌ 缺少与 DiscoveryPanel 的联动

**目标**：
- 在 DomainManager 或 DomainFilter 中添加「跨域分析」按钮
- 分析完成后展示 CrossDomainInsightsSection
- 支持点击相关图谱跳转

---

#### 缺口 3: Phase 4 功能未实现

| 功能 | 复杂度 | 说明 |
|------|--------|------|
| AI 自动生成领域颜色 | 中 | 根据领域名称语义分配颜色 |
| 领域拖拽排序 | 高 | dnd-kit 树形拖拽调整层级 |
| 图谱详情页领域编辑 | 中 | GraphDetail 页面添加设置入口 |
| AI 领域推荐（创建时） | 高 | 创建图谱时自动推荐领域 |

---

#### 缺口 4: 批量处理体验优化

**当前问题**：
- 批量创建时如果部分失败，缺少详细的错误反馈
- 大量图谱初始化时进度展示不够直观
- 缺少重试机制

## What Changes

### 变更清单

#### A. AI 领域感知增强（P0 - 核心）
- [ ] **修改** `POST /graphs/domain/analyze` API：
  - 新增可选参数 `context_domain_id?: string`
  - 如果提供了 domain_id，先查询该领域内的已有图谱列表
  - 将领域内图谱作为 context 注入 AI prompt
  - AI 返回结果自动过滤掉已在领域内的重复主题
- [ ] **修改** `POST /graphs/domain/expand` API：
  - 增强 domain 参数的处理逻辑
  - 如果选择了领域，优先推荐该领域内的扩展方向
  - 返回结果中标注推荐的 target_domain
- [ ] **新增** 领域上下文构建服务 (`services/ai/domainContextService.ts`)：
  - 封装获取领域内图谱摘要的逻辑
  - 构建 AI prompt 的领域上下文片段
  - 缓存频繁访问的领域上下文（可选）

#### B. 跨域分析集成（P0 - 核心）
- [ ] **新增** GraphMap 页面触发入口：
  - 在 DomainManager 弹窗中添加「跨域分析」按钮
  - 或在 DomainFilter 旁边添加独立按钮
- [ ] **新增** 跨域分析状态管理：
  - `crossDomainResult: CrossDomainAnalysisResult | null`
  - `isAnalyzingCrossDomain: boolean`
  - `showCrossDomainInsights: boolean`
- [ ] **集成** CrossDomainInsightsSection 组件：
  - 传入分析结果数据
  - 处理图谱点击跳转事件
- [ ] **优化** 跨域分析 API：
  - 支持按领域范围筛选分析的图谱
  - 增加 response time 优化（缓存热门领域的分析结果）

#### C. Phase 4 功能实现（P1 - 增强）

##### C1. AI 自动生成领域颜色
- [ ] **新增** `POST /api/domains/generate-color` API：
  - 输入：领域名称 + 描述（可选）
  - 输出：HEX 颜色值 + 理由说明
  - 实现：调用 AI 分析领域语义/情感色彩
- [ ] **修改** DomainManager 创建表单：
  - 添加「AI 推荐」按钮（在颜色选择器旁）
  - 点击后调用 generate-color API
  - 展示 AI 推荐的颜色 + 一键应用
- [ ] **前端服务**：domainsApi.generateColor(name, description)

##### C2. 领域拖拽排序
- [ ] **安装依赖**：`@dnd-kit/core` + `@dnd-kit/sortable` + `@dnd-kit/utilities`
- [ ] **新增** `PUT /api/domains/reorder` API：
  - 输入：`{ reorder_items: [{ id, parent_id?, sort_order }] }`
  - 批量更新父子关系和排序
  - 校验防止循环引用
- [ ] **修改** DomainManager 组件：
  - 集成 DnD Kit 实现树形拖拽
  - 拖拽时实时预览新位置
  - 拖拽结束后调用 reorder API
  - 错误回滚（如果 API 失败恢复原状）

##### C3. 图谱详情页领域编辑
- [ ] **定位** GraphDetail 页面文件
- [ ] **添加** 「设置领域」按钮/标签区域
- [ ] **复用** DomainPickerModal 或创建简化版选择器
- [ ] **权限控制**：只有所有者可见编辑入口
- [ ] **实时更新**：编辑后刷新页面显示

##### C4. AI 领域推荐（创建图谱时）
- [ ] **新增** `POST /api/domains/recommend` API：
  - 输入：图谱标题 + 描述（可选）
  - 输出：推荐领域列表 `[{ id, name, confidence, reason }]`
  - 实现：AI 分析内容匹配最相关的领域
- [ ] **修改** QuickCreateGraphPanel：
  - 创建时自动调用 recommend API
  - 展示推荐领域标签（可点击选择）
  - 用户可覆盖 AI 推荐

#### D. 批量处理优化（P1 - 稳定性）
- [ ] **增强** `POST /graphs/domain/batch-create` 错误处理：
  - 返回每个图谱的详细状态（成功/失败/跳过/重复）
  - 失败原因分类（标题重复/数据库错误/AI 解析失败）
  - 支持 partial success（部分成功仍返回成功项）
- [ ] **增强** 批量初始化进度追踪：
  - 使用 WebSocket 或 SSE 推送实时进度
  - 或提供轮询接口查询任务状态
  - 前端展示每个图谱的初始化状态
- [ ] **新增** 重试机制：
  - 失败的图谱支持单独重试
  - 批量操作完成后显示「重试失败项」按钮

## Impact

### Affected Specs
- `domain-multi-association-hierarchy` - 原 spec，本 spec 是其延续
- `domain-status-review` - 现状总结 spec

### Affected Code

**后端修改**:
- `api/routes/graphs.ts` - 修改 domain/analyze、domain/expand、domain/batch-create
- `api/routes/domains.ts` - 新增 generate-color、recommend、reorder 端点
- `api/services/ai/` - 可能新增 domainContextService.ts

**前端修改**:
- `src/pages/GraphMap.tsx` - 集成跨域分析触发和管理状态
- `src/components/GraphMap/DomainManager.tsx` - 添加跨域分析入口 + AI 颜色 + 拖拽排序
- `src/components/GraphMap/DomainFilter.tsx` - 可选添加跨域分析快捷入口
- `src/components/GraphMap/QuickCreateGraphPanel.tsx` - 集成 AI 领域推荐
- `src/services/api/domains.ts` - 新增 generateColor、recommend、reorder 方法
- `src/services/api/graphs.ts` - 可能更新类型定义

**新增依赖**:
- `@dnd-kit/core` + `@dnd-kit/sortable` + `@dnd-kit/utilities`（拖拽排序）

## ADDED Requirements

### Requirement: AI 领域感知分析
系统 SHALL 在执行 AI 分析前先识别目标领域，并将该领域内的已有知识体系作为上下文注入 AI prompt，以提升推荐的精准度和相关性。

#### Scenario: 从零开始生成（带领域上下文）
- **WHEN** 用户输入领域主题（如"机器学习"）且系统检测到已有「计算机科学」领域
- **THEN** 系统 SHALL 先加载「计算机科学」领域内的已有图谱列表作为参考上下文，AI 在此上下文中推荐新的图谱主题，避免推荐重复或过于基础的内容

#### Scenario: 从现有图谱扩展（领域增强）
- **WHEN** 用户选择属于「人工智能」领域的多个图谱并请求扩展
- **THEN** 系统 SHALL 优先推荐与「人工智能」领域相关的扩展方向，并在返回结果中标注建议的目标领域

#### Scenario: 领域上下文缓存
- **WHEN** 同一领域被多次分析
- **THEN** 系统 SHOULD 缓存领域上下文摘要以减少数据库查询开销

---

### Requirement: 跨域洞察集成
系统 SHALL 提供完整的跨学科领域交叉点分析和可视化功能，允许用户从 GraphMap 页面直接触发分析并查看结果。

#### Scenario: 触发跨域分析
- **WHEN** 用户在 DomainManager 或工具栏点击「跨域分析」按钮
- **THEN** 系统 SHALL 对当前用户的所有图谱（或选定范围内的图谱）执行跨域聚类分析，识别不同领域之间的交叉点和共同主题

#### Scenario: 查看跨域洞察
- **WHEN** 跨域分析完成
- **THEN** 系统 SHALL 展示 CrossDomainInsightsSection 组件，包括统计信息、领域分布、每个交叉点的详细信息和相关图谱链接

#### Scenario: 从洞察跳转到图谱
- **WHEN** 用户点击跨域洞察中的「查看图谱」链接
- **THEN** 系统 SHALL 选中并聚焦到对应的图谱节点

---

### Requirement: AI 自动生成领域颜色
系统 SHALL 提供基于 AI 的领域颜色自动推荐功能，根据领域的语义和情感色彩智能分配颜色。

#### Scenario: AI 推荐颜色
- **WHEN** 用户在创建/编辑领域时点击「AI 推荐」按钮
- **THEN** 系统 SHALL 调用 AI 分析领域名称和描述，返回一个合适的 HEX 颜色值及推荐理由（如："海洋主题，推荐蓝色系"）

#### Scenario: 应用 AI 颜色
- **WHEN** 用户确认使用 AI 推荐的颜色
- **THEN** 颜色选择器 SHALL 更新为推荐值，并可继续手动微调

---

### Requirement: 领域拖拽排序
系统 SHALL 支持通过拖拽操作调整领域的层级结构和排序顺序。

#### Scenario: 拖拽调整排序
- **WHEN** 用户在 DomainManager 中拖拽某个领域节点到新位置
- **THEN** 系统 SHALL 实时预览拖拽效果，释放后调用后端 API 更新 sort_order 和 parent_id

#### Scenario: 拖拽调整父子关系
- **WHEN** 用户将子领域拖拽到另一个父领域下
- **THEN** 系统 SHALL 校验是否会产生循环引用，校验通过后更新 parent_id

#### Scenario: 拖拽失败回滚
- **WHEN** 后端 API 更新失败（如循环引用、权限不足）
- **THEN** 前端 SHALL 回滚到拖拽前的状态并显示错误提示

---

### Requirement: 图谱详情页领域编辑
系统 SHALL 在图谱详情页提供领域编辑入口，方便用户快速管理单个图谱的领域关联。

#### Scenario: 查看当前领域
- **WHEN** 用户打开图谱详情页
- **THEN** 页面 SHALL 显示当前图谱关联的所有领域（颜色圆点 + 名称）

#### Scenario: 编辑关联领域
- **WHEN** 所有者用户点击「设置领域」按钮
- **THEN** 系统 SHALL 弹出领域选择器，允许用户添加/移除关联领域

#### Scenario: 权限控制
- **WHEN** 非所有者用户查看图谱详情
- **THEN** 领域信息只读显示，无编辑入口

---

### Requirement: AI 领域推荐（创建图谱时）
系统 SHALL 在用户创建新图谱时自动推荐可能所属的领域。

#### Scenario: 自动推荐
- **WHEN** 用户输入图谱标题和描述后
- **THEN** 系统 SHALL 自动调用 AI 分析内容，返回最匹配的 3-5 个推荐领域及置信度分数

#### Scenario: 应用推荐
- **WHEN** 用户点击某个推荐领域标签
- **THEN** 该领域被选中并关联到即将创建的图谱

#### Scenario: 手动覆盖
- **WHEN** 用户不想使用 AI 推荐
- **THEN** 用户可以忽略推荐，手动选择或不选择任何领域

---

### Requirement: 批量处理健壮性增强
系统 SHALL 提供完善的批量操作错误处理、进度追踪和重试机制。

#### Scenario: 详细的状态反馈
- **WHEN** 用户执行批量创建图谱操作
- **THEN** 系统 SHALL 返回每个图谱的详细状态（成功/失败/跳过/重复），失败项附带具体原因

#### Scenario: 部分成功处理
- **WHEN** 批量操作中部分项目失败
- **THEN** 系统 SHALL 仍然返回成功项目的结果，并列出失败项目供用户决定是否重试

#### Scenario: 进度实时追踪
- **WHEN** 用户执行批量初始化操作
- **THEN** 系统 SHALL 提供实时的进度反馈（如：3/10 已完成，正在初始化第 4 个...）

## MODIFIED Requirements

### Requirement: 领域分析 API 增强
原 `POST /graphs/domain/analyze` 和 `POST /graphs/domain/extend` API 需要增强：

1. **新增可选参数** `context_domain_id` 用于指定分析的领域上下文
2. **增强 prompt 构建**：当有领域上下文时，注入该领域内已有图谱的信息
3. **结果过滤**：自动排除已在目标领域内的重复图谱
4. **响应格式扩展**：可选返回推荐的 target_domain 信息

### Requirement: 领域管理器功能扩展
原 DomainManager 组件需要增加：

1. **跨域分析入口**：添加按钮触发跨域洞察分析
2. **AI 颜色推荐**：颜色选择器旁添加 AI 推荐按钮
3. **拖拽排序**：集成 DnD Kit 支持树形拖拽
4. **性能优化**：大量领域时的渲染优化（虚拟滚动）

## REMOVED Requirements

无明确移除的需求。所有原有功能保持向后兼容。
