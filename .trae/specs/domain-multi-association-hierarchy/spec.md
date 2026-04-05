# 领域体系重构 — 完整需求规格 v3

## Why

当前 `knowledge_graphs.domain` 是单一字符串字段，无法表达：
- 一个图谱属于多个学科领域
- 领域的层级分类体系
- 在知识地图上按领域筛选和分区展示

需要建立独立的领域实体体系，服务于 **GraphMap（图谱地图）** 层级——对地图上的每个 Graph 节点进行学科分类。

## 产品层级定位

```
GraphMap（图谱地图）          ← 用户看到的「星空」视图
├── 每个节点 = 一个 Graph     ← 知识图谱
│   └── Graph 内部 = KnowledgePoint + Edge  ← 思维导图内容
│
Domain（领域）                 ← 新功能！对 Graph 进行分类
├── 只作用于 GraphMap 层级
└── 与 tags（标签）完全独立
```

## 设计决策总表

| # | 决策项 | 结论 |
|---|--------|------|
| D1 | **层级结构** | 树形（parent_id 自引用），无限嵌套 |
| D2 | **图谱↔领域关系** | 多对多（graph_domains 中间表） |
| D3 | **领域粒度** | 学科级（粗粒度）。叶子节点对应的是 Graph，不是 KnowledgePoint |
| D4 | **领域 vs 标签** | 完全独立的两套分类体系 |
| D5 | **领域来源** | ① 系统预置 ② 用户自建 ③ AI 推荐（后续） |
| D6 | **核心用途** | 筛选高亮 + 分区展示（同等重要） |
| D7 | **展示形式** | 自适应混合：缩放小→背景圈，放大→颜色区块/网格 |
| D8 | **跨域展示** | 多区域显示（一个图谱在所有所属领域中可见） |
| D9 | **无领域处理** | 归入系统初始创建的「未分类」兜底领域 |
| D10 | **颜色方案** | AI 根据领域语义/感情色彩自动生成 |
| D11 | **AI 推荐时机** | 创建图谱时触发推荐 |
| D12 | **批量操作** | 支持批量给多个 Graph 设置同一领域 |
| D13 | **统计信息** | 每个领域旁显示该领域的图谱数量 |
| D14 | **领域数量** | 预计较多 → UI 需搜索功能 |
| D15 | **移动端** | 简化版本 |
| D16 | **URL 分享** | 支持 ?domain=xxx 同步筛选状态 |
| D17 | **旧数据迁移** | 懒迁移（读取时自动同步 domain→graph_domains） |

## 数据模型（不变）

### domains 表
```sql
CREATE TABLE domains (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),  -- 自动生成！不硬编码
  name VARCHAR(255) NOT NULL,
  description TEXT,
  color VARCHAR(7) DEFAULT '#6366F1',
  icon VARCHAR(50),
  parent_id UUID REFERENCES domains(id) ON DELETE SET NULL,
  sort_order INTEGER DEFAULT 0,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  is_system BOOLEAN DEFAULT FALSE,   -- TRUE=系统预置 FALSE=用户创建
  deleted_at TIMESTAMP WITH TIME ZONE DEFAULT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

### graph_domains 表
```sql
CREATE TABLE graph_domains (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  graph_id UUID NOT NULL REFERENCES knowledge_graphs(id) ON DELETE CASCADE,
  domain_id UUID NOT NULL REFERENCES domains(id) ON DELETE CASCADE,
  is_primary BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

## 功能需求详述

### FR-1: 领域筛选器（工具栏）
- 位置：GraphMapToolbar 中，现有筛选按钮旁边
- 形式：下拉面板，包含搜索框 + 树形列表
- 功能：
  - 搜索过滤（因为领域较多）
  - 树形展开/折叠
  - 多选（Checkbox）
  - 「全部」选项清除筛选
  - 选中计数 badge
  - 移动端简化版
- 行为：选中后画布中匹配领域的 Graph 节点正常显示，其他淡化（opacity 0.3）

### FR-2: 领域分区展示（画布）
- 组件：DomainBackground 增强
- 缩放级别 < 1.0：显示半透明背景光晕圈（当前实现）
- 缩放级别 >= 1.0：切换为颜色区块/网格分区
- 跨域图谱在所有所属领域区域中都渲染
- 未归属图谱显示在「未分类」区域

### FR-3: 图谱关联领域
- 创建图谱时 AI 推荐可能领域 → 用户确认
- 图谱详情页可编辑关联领域
- 批量操作：选中多个 Graph 后统一设置领域
- 支持 is_primary 主领域标记

### FR-4: 领域管理
- 领域列表（树形展示 + 图谱数量统计）
- 创建/编辑/删除领域
- 拖拽排序调整层级
- 颜色：用户可选 或 AI 自动生成

### FR-5: URL 状态同步
- 筛选状态同步到 searchParams（?domain=id1,id2,id3）
- 页面加载时从 URL 恢复筛选状态
- 便于分享特定领域的视图链接

## 不做的事（明确排除）

- ❌ 不硬编码种子数据 / 不指定 UUID
- ❌ 不删除旧的 `domain` 字段（向后兼容）
- ❌ 当前不做 AI 自动识别（仅做 AI 推荐）
- ❌ 不作用于 KnowledgePoint 层级（只作用于 Graph）

## 已完成 ✅

Phase 2 基础设施全部完成：
- [x] 数据库 Schema（domains + graph_domains 表、索引、RLS）
- [x] 类型定义（Domain / DomainTreeNode / GraphDomain）
- [x] 后端 CRUD API（domains.ts + graphs.ts 扩展）
- [x] 前端 API 服务层（domainsApi + graphDomainsApi）
- [x] DomainFilter 筛选器组件
- [x] GraphMapCanvas 高亮逻辑
- [x] DomainBackground 基础分区
- [x] GraphMap 页面集成串联
- [x] npm run check + lint 通过

## 待实施 📋

Phase 1: 清理 ✅
- [x] 删除 seed 文件中的硬编码假数据

Phase 3: 增强
- [x] FR-5: URL 状态同步
- [x] DomainFilter 增加搜索功能
- [x] DomainBackground 缩放自适应切换
- [x] 「未分类」兜底领域初始化
- [x] 领域图谱数量统计显示
- [x] FR-3: 图谱关联领域入口（✅ 创建时选择器 + 批量操作；⏳ AI推荐/详情页编辑 后续迭代）
- [x] FR-4: 领域管理界面（✅ CRUD + 树形展示；⏳ 拖拽排序/AI颜色 后续迭代）

## Phase 4: 后续迭代（低优先级）
- [ ] AI 领域推荐（创建图谱时调用 AI 分析内容推荐领域）
- [ ] 图谱详情页领域编辑入口（GraphDetail 页面支持）
- [ ] 领域拖拽排序（dnd-kit 树形拖拽）
- [ ] AI 自动生成领域颜色（语义/情感色彩）
