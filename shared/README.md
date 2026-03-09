# 共享类型定义

## 目录结构

```
shared/
└── types/
    ├── index.ts        # 统一导出
    ├── graph.ts        # 图谱相关类型
    ├── scheduler.ts    # 调度相关类型
    ├── user.ts         # 用户相关类型
    ├── common.ts       # 通用类型
    └── styles.ts       # 样式相关类型
```

## 使用规范

### 前端导入

```typescript
import { Graph, Node, Edge } from '@shared/types';
```

### 后端导入

```typescript
import { Graph, Node, Edge } from '../shared/types/index.js';
```

## 类型分类

### graph.ts
图谱核心类型：
- `Graph` - 图谱
- `Node` - 节点
- `Edge` - 边
- `KnowledgePoint` - 知识点
- `Template` - 模板
- `GraphRelation` - 图谱关系

### scheduler.ts
调度相关类型：
- `ScheduledTask` - 计划任务
- `TaskExecution` - 任务执行
- `Queue` - 队列
- `FocusSession` - 专注会话
- `Achievement` - 成就

### user.ts
用户相关类型：
- `User` - 用户
- `UserProfile` - 用户配置

### common.ts
通用类型：
- 分页
- 响应包装
- 通用枚举

## 注意事项

1. 所有前后端共享的类型必须定义在此目录
2. 仅前端使用的类型定义在 `src/types/`
3. 仅后端使用的类型定义在 `api/` 相应模块中
