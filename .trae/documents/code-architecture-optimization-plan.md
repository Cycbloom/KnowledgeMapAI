# 代码组织架构优化计划

## 概述

基于代码组织架构分析结果，制定分阶段优化方案，从低风险到高风险逐步实施。

## 第一阶段：短期优化（低风险）

### 1.1 统一命名规范

**目标**：建立并应用统一的命名规范

**步骤**：
1. 制定命名规范文档
   - 服务文件：统一使用 `xxxService.ts` 格式
   - 路由文件：统一使用 `xxx.ts`（小写，无 Router 后缀）
   - API 模块：统一使用 `xxxApi.ts` 格式
   - Hooks：统一使用 `useXxx.ts` 格式
   - 组件：统一使用 PascalCase

2. 重命名不一致的文件
   - `api/services/focusService.ts` → 保持不变（已符合规范）
   - `api/services/graphService.ts` → 保持不变（已符合规范）
   - 检查并修复其他不一致的命名

### 1.2 整理配置文件

**目标**：集中管理配置文件

**步骤**：
1. 创建 `api/config/` 目录
2. 迁移配置文件：
   - `api/constants/errorCodes.ts` → `api/config/errorCodes.ts`
   - 创建 `api/config/index.ts` 统一导出
3. 更新所有导入路径

### 1.3 补充文档说明

**目标**：为关键目录添加 README 说明

**步骤**：
1. 创建 `api/README.md` - 后端架构说明
2. 创建 `src/README.md` - 前端架构说明
3. 创建 `shared/README.md` - 共享类型说明
4. 更新根目录 `README.md` 添加架构概览

---

## 第二阶段：中期优化（中等风险）

### 2.1 重组服务层目录结构

**目标**：按业务领域组织服务文件

**目标结构**：
```
api/services/
├── core/           # 核心服务
│   ├── authService.ts
│   ├── userService.ts
│   └── settingsService.ts
├── graph/          # 图谱相关
│   ├── graphService.ts
│   ├── graphNodeService.ts
│   ├── graphRelationService.ts
│   ├── edgeService.ts
│   └── knowledgePointService.ts
├── study/          # 学习相关
│   ├── studyService.ts
│   ├── studyProgressService.ts
│   ├── reviewService.ts
│   └── embeddingService.ts
├── scheduler/      # 调度相关（已存在）
│   ├── taskService.ts
│   ├── focusService.ts
│   ├── executionService.ts
│   └── ...
├── ai/             # AI 相关（已存在）
│   └── ...
├── taskProcessors/ # 任务处理器（已存在）
│   └── ...
├── common/         # 通用服务
│   ├── cache.ts
│   ├── queue.ts
│   ├── sseService.ts
│   └── searchService.ts
└── index.ts        # 统一导出
```

**步骤**：
1. 创建新的目录结构
2. 移动服务文件到对应目录
3. 更新所有导入路径
4. 更新 `api/services/index.ts` 导出
5. 运行测试验证

### 2.2 完善 Repository 模式或移除

**决策**：移除未使用的 Repository 代码

**理由**：
- 当前服务层直接使用 Supabase client
- Repository 模式未被实际使用
- 移除可减少维护负担

**步骤**：
1. 确认 `api/repositories/` 目录未被使用
2. 删除 `api/repositories/` 目录
3. 更新相关导入（如有）

### 2.3 统一类型定义位置

**目标**：明确类型定义边界

**规则**：
- `shared/types/` - 前后端共享的类型定义
- `src/types/` - 仅前端使用的类型定义
- `api/types/` - 仅后端使用的类型定义（如需要）

**步骤**：
1. 审查 `src/types/index.ts` 内容
2. 将共享类型迁移到 `shared/types/`
3. 更新所有导入路径
4. 创建类型定义规范文档

---

## 第三阶段：长期优化（高风险）

### 3.1 重构组件组织结构

**目标**：优化组件目录结构

**目标结构**：
```
src/components/
├── common/         # 通用组件（保持不变）
├── layout/         # 布局组件（重命名 Layout → layout）
├── graph/          # 图谱相关
│   ├── editor/     # 编辑器组件（从 GraphEditor 拆分）
│   ├── map/        # 图谱地图（从 GraphMap 重命名）
│   └── shared/     # 图谱共享组件
├── scheduler/      # 调度相关（保持不变）
├── study/          # 学习相关（保持不变）
├── statistics/     # 统计相关（保持不变）
└── index.ts        # 统一导出
```

**步骤**：
1. 拆分 GraphEditor 目录（40+ 文件）
2. 重命名 Layout → layout
3. 删除空的 features 目录
4. 更新所有导入路径
5. 运行测试验证

### 3.2 统一状态管理方案

**目标**：建立系统化的状态管理

**目标结构**：
```
src/store/
├── modules/        # 按业务域划分
│   ├── auth.ts     # 认证状态
│   ├── graph.ts    # 图谱状态
│   ├── scheduler.ts # 调度状态
│   ├── study.ts    # 学习状态
│   └── ui.ts       # UI 状态
├── index.ts        # 统一导出
└── types.ts        # Store 类型定义
```

**步骤**：
1. 创建新的 Store 目录结构
2. 迁移现有 Store 到对应模块
3. 合并分散在 hooks 中的状态
4. 更新所有使用处
5. 运行测试验证

### 3.3 完善 Hooks 组织

**目标**：按业务域组织 hooks

**目标结构**：
```
src/hooks/
├── graph/          # 图谱相关 hooks
├── scheduler/      # 调度相关 hooks
├── study/          # 学习相关 hooks
├── queries/        # React Query 查询（保持不变）
├── mutations/      # React Query 变更（保持不变）
├── common/         # 通用 hooks
│   ├── useTheme.ts
│   ├── useIsMobile.ts
│   ├── useNetworkStatus.ts
│   └── ...
└── index.ts        # 统一导出
```

**步骤**：
1. 创建新的 hooks 目录结构
2. 移动 hooks 到对应目录
3. 更新所有导入路径
4. 运行测试验证

---

## 执行顺序

1. **第一周**：第一阶段全部任务
2. **第二周**：第二阶段任务 2.2（移除 Repository）
3. **第三周**：第二阶段任务 2.1（重组服务层）
4. **第四周**：第二阶段任务 2.3（统一类型定义）
5. **第五周起**：根据需要执行第三阶段

## 风险控制

1. 每个阶段完成后运行完整测试
2. 使用 Git 分支进行开发
3. 保持向后兼容的导入路径（使用 re-export）
4. 分批提交，便于回滚

## 验收标准

1. 所有测试通过
2. TypeScript 编译无错误
3. ESLint 检查通过
4. 功能无回归
