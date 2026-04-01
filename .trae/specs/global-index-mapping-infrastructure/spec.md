# 全局虚拟索引转换架构规范

## Why

当前索引到UUID的映射转换机制分散在各个工具文件中，存在以下问题：
1. **代码重复**：每个工具文件都需要实现相同的 `resolveGraphId`、`isIndexValue` 函数
2. **维护困难**：修改转换逻辑需要在多个文件中同步修改
3. **不一致风险**：不同工具可能使用不同的转换逻辑
4. **缺乏统一管理**：没有统一的索引映射表管理机制

需要实现一个类似操作系统虚拟内存地址转换的全局基础设施。

## What Changes

- 创建全局索引转换服务 `IndexMappingService`
- 创建索引转换中间件，自动处理请求中的索引值
- 统一前端和后端的索引转换逻辑
- 提供索引映射表的缓存和同步机制

## Impact

- **Affected code**:
  - `api/services/indexMapping/` - 新增索引映射服务
  - `api/services/agent/tools/` - 移除重复的转换函数
  - `api/routes/` - 添加索引转换中间件
  - `src/services/api/` - 前端索引转换服务
  - `shared/utils/` - 共享的索引转换工具

---

## ADDED Requirements

### Requirement: 全局索引映射服务

系统 SHALL 提供全局的索引映射服务，统一管理虚拟索引到真实UUID的转换。

#### 架构设计

```
┌─────────────────────────────────────────────────────────────┐
│                      前端 (Frontend)                         │
│  ┌─────────────────────────────────────────────────────┐   │
│  │              IndexMappingService                      │   │
│  │  - getGraphIndexMap()                                │   │
│  │  - resolveGraphId(idx) → UUID                        │   │
│  │  - resolveNodeId(idx) → UUID                         │   │
│  └─────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
                              │
                              │ HTTP Request (with idx)
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                      后端 (Backend)                          │
│  ┌─────────────────────────────────────────────────────┐   │
│  │          IndexMappingMiddleware                       │   │
│  │  - 自动转换请求中的索引值                              │   │
│  │  - 注入映射表到请求上下文                              │   │
│  └─────────────────────────────────────────────────────┘   │
│                              │                              │
│  ┌─────────────────────────────────────────────────────┐   │
│  │              IndexMappingService                      │   │
│  │  - buildGraphIndexMap(userId) → Map<idx, UUID>       │   │
│  │  - resolveGraphId(idxOrUuid) → UUID                  │   │
│  │  - resolveNodeId(idxOrUuid) → UUID                   │   │
│  │  - 缓存机制                                           │   │
│  └─────────────────────────────────────────────────────┘   │
│                              │                              │
│  ┌─────────────────────────────────────────────────────┐   │
│  │                  ToolContext                          │   │
│  │  - graphIndexMap: Map<number, string>                │   │
│  │  - nodeIndexMap: Map<number, string>                 │   │
│  └─────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

#### Scenario: 索引转换流程
- **WHEN** 前端发送包含索引值的请求
- **THEN** 中间件自动将索引转换为UUID
- **AND** 工具函数使用转换后的UUID进行数据库操作

### Requirement: 索引映射服务API

系统 SHALL 提供以下索引映射服务API：

#### 后端服务 (`api/services/indexMapping/IndexMappingService.ts`)

```typescript
export class IndexMappingService {
  private static instance: IndexMappingService;
  private graphIndexCache: Map<string, Map<number, string>> = new Map();
  private nodeIndexCache: Map<string, Map<number, string>> = new Map();

  static getInstance(): IndexMappingService;

  async buildGraphIndexMap(userId: string, supabase: SupabaseClient): Promise<Map<number, string>>;
  
  async buildNodeIndexMap(graphId: string, supabase: SupabaseClient): Promise<Map<number, string>>;

  resolveGraphId(idxOrUuid: string | number, indexMap: Map<number, string>): string;

  resolveNodeId(idxOrUuid: string | number, indexMap: Map<number, string>): string;

  isIndexValue(value: string | number): boolean;

  clearCache(userId?: string): void;
}
```

#### 前端服务 (`src/services/indexMapping.ts`)

```typescript
export const indexMappingService = {
  getGraphIndexMap(): Promise<Record<string, string>>;
  
  resolveGraphId(idx: number, indexMap?: Record<string, string>): string;

  resolveNodeId(idx: number, indexMap?: Record<string, string>): string;

  buildIndexMapFromData(data: { idx: number; title?: string }[]): Record<string, string>;
};
```

### Requirement: 索引转换中间件

系统 SHALL 提供索引转换中间件，自动处理请求中的索引值。

#### 中间件实现 (`api/middleware/indexMapping.ts`)

```typescript
export const indexMappingMiddleware = async (req: Request, res: Response, next: NextFunction) => {
  // 1. 获取用户ID
  const userId = req.user?.id;
  
  // 2. 构建索引映射表
  if (userId) {
    const graphIndexMap = await IndexMappingService.getInstance()
      .buildGraphIndexMap(userId, req.supabase!);
    
    // 3. 注入到请求上下文
    req.indexContext = {
      graphIndexMap,
      resolveGraphId: (idx) => IndexMappingService.getInstance()
        .resolveGraphId(idx, graphIndexMap),
    };
  }
  
  next();
};
```

### Requirement: 共享工具函数

系统 SHALL 在 `shared/utils/indexMapping.ts` 中提供共享的索引转换工具函数：

```typescript
export const isIndexValue = (value: string | number): boolean => {
  if (typeof value === 'number') return true;
  if (typeof value === 'string') return /^\d+$/.test(value) && value.length < 10;
  return false;
};

export const resolveId = <T>(
  idxOrId: string | number,
  indexMap: Map<number, string> | Record<string, string>
): string => {
  if (!isIndexValue(idxOrId)) {
    return String(idxOrId);
  }
  
  const idx = typeof idxOrId === 'number' ? idxOrId : parseInt(idxOrId, 10);
  
  if (indexMap instanceof Map) {
    return indexMap.get(idx) || String(idxOrId);
  }
  
  return indexMap[String(idx)] || String(idxOrId);
};

export const buildIndexMap = <T extends { id: string }>(
  items: T[]
): Map<number, string> => {
  const map = new Map<number, string>();
  items.forEach((item, idx) => map.set(idx, item.id));
  return map;
};

export const buildIndexMapFromTitles = <T extends { id: string; title: string }>(
  items: T[]
): Record<string, string> => {
  const map: Record<string, string> = {};
  items.forEach((item, idx) => {
    map[idx] = item.title;
  });
  return map;
};
```

### Requirement: 工具文件重构

所有Agent工具文件 SHALL 使用共享的索引转换工具，移除重复代码：

#### 修改前
```typescript
// 每个工具文件都有自己的实现
const isIndexValue = (value: string): boolean => { ... };
const resolveGraphId = async (idOrIdx: string, context: ToolContext): Promise<string> => { ... };
```

#### 修改后
```typescript
// 使用共享工具
import { isIndexValue, resolveId } from '../../../shared/utils/indexMapping';

// 在工具执行时使用
const graphId = resolveId(params.graphId, context.graphIndexMap);
```

---

## 预期效果

| 指标 | 优化前 | 优化后 |
|-----|-------|-------|
| 重复代码行数 | ~150行（分布在多个文件） | ~30行（共享工具） |
| 维护文件数 | 4+ 个工具文件 | 1 个共享工具文件 |
| 转换一致性 | 可能不一致 | 完全一致 |
| 缓存效率 | 无缓存/分散缓存 | 统一缓存管理 |
