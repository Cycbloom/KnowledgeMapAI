# API 命名规范

## 1. API 对象命名

### 1.1 命名格式

| 层级 | 格式 | 示例 |
|------|------|------|
| api 层 | `{资源名}Api` | `graphsApi`, `nodesApi`, `authApi` |
| mobile 层 | `mobile{资源名}Api` | `mobileGraphsApi`, `mobileNodesApi`, `mobileAuthApi` |

### 1.2 资源名命名规则

- 使用 **复数形式** 表示资源集合（如 `graphs`, `nodes`, `tasks`）
- 使用 **camelCase** 驼峰命名
- 名称应与主要数据实体对应

### 1.3 示例

```typescript
// api 层
export const graphsApi = { ... };
export const nodesApi = { ... };
export const knowledgePointsApi = { ... };

// mobile 层
export const mobileGraphsApi = { ... };
export const mobileNodesApi = { ... };
```

## 2. 方法命名

### 2.1 标准 CRUD 方法

| 操作 | 方法名 | 说明 |
|------|--------|------|
| 获取列表 | `list` | 获取资源列表 |
| 获取单个 | `get` | 根据 ID 获取单个资源 |
| 创建 | `create` | 创建新资源 |
| 更新 | `update` | 更新现有资源 |
| 删除 | `delete` | 删除资源 |

**注意**: 方法名不重复资源名，例如使用 `tasksApi.create()` 而非 `tasksApi.createTask()`

### 2.2 批量操作

| 格式 | 示例 |
|------|------|
| `batch{Action}` | `batchDelete`, `batchRestore`, `batchUpdate` |

### 2.3 特定操作

| 格式 | 示例 |
|------|------|
| `get{RelatedResource}` | `getNodes`, `getTags`, `getDomains` |
| `toggle{Property}` | `toggleFavorite`, `togglePublic` |
| `update{Property}` | `updateViewMode`, `updateNotes` |
| `{action}{Resource}` | `startTask`, `pauseTask`, `completeTask` |

### 2.4 查询操作

| 格式 | 示例 |
|------|------|
| `get{Detail}` | `getTaskDetail`, `getNodeStatus` |
| `check{Condition}` | `checkTopic`, `checkTaskDependencies` |
| `search{Method}` | `searchSimilar` |

## 3. 参数命名

### 3.1 基本规则

- 使用 **camelCase** 驼峰命名
- 参数名应简洁且具有描述性

### 3.2 常用参数

| 参数名 | 用途 |
|--------|------|
| `id` | 资源唯一标识 |
| `data` | 创建/更新数据对象 |
| `ids` | ID 数组（批量操作） |
| `filters` | 过滤条件对象 |
| `options` | 可选配置对象 |

### 3.3 示例

```typescript
// 正确
get(id: string)
create(data: CreateGraphData)
update(id: string, data: UpdateGraphData)
batchDelete(ids: string[])

// 避免
getTask(id: string)  // 不应重复资源名
createNewGraph(data)  // 不应冗余
```

## 4. 返回值命名

### 4.1 返回类型

- 使用 TypeScript 类型注解
- 返回类型应为 `Promise<T>` 形式

### 4.2 常用返回类型

| 操作 | 返回类型 |
|------|----------|
| list | `Promise<Resource[]>` |
| get | `Promise<Resource>` |
| create | `Promise<Resource>` |
| update | `Promise<Resource>` |
| delete | `Promise<void>` |
| 批量操作 | `Promise<{ count: number }>` |

## 5. 导出规范

### 5.1 API 对象导出

```typescript
// 推荐: 命名导出对象
export const graphsApi = {
  list: () => { ... },
  get: (id: string) => { ... },
};

// 避免: 独立函数导出
export const createTask = async () => { ... };
export const getTask = async () => { ... };
```

### 5.2 统一 API 对象

```typescript
// api/index.ts
export const api = {
  graphs: graphsApi,
  nodes: nodesApi,
  // ...
};

// mobile/index.ts
export const mobileApi = {
  graphs: mobileGraphsApi,
  nodes: mobileNodesApi,
  // ...
};
```

## 6. 命名对照表

### 6.1 api 层与 mobile 层对应

| api 层 | mobile 层 |
|--------|-----------|
| `graphsApi` | `mobileGraphsApi` |
| `nodesApi` | `mobileNodesApi` |
| `edgesApi` | `mobileEdgesApi` |
| `authApi` | `mobileAuthApi` |
| `aiApi` | `mobileAiApi` |
| `studyApi` | `mobileStudyApi` |
| `quizApi` | `mobileQuizApi` |
| `schedulerApi` | `mobileSchedulerApi` |

## 7. 常见错误示例

### 7.1 方法名重复资源名

```typescript
// 错误
tasksApi.createTask(data)
tasksApi.getTask(id)
tasksApi.getTasks()

// 正确
tasksApi.create(data)
tasksApi.get(id)
tasksApi.list()
```

### 7.2 导出名称不一致

```typescript
// 错误: 文件名与导出名不匹配
// quiz.ts
export const quizApi = { ... };  // 应为 quizSetsApi

// 正确
// quiz.ts
export const quizSetsApi = { ... };
```

### 7.3 函数式导出

```typescript
// 错误: 独立函数导出
export const createTask = async () => { ... };
export const getTask = async () => { ... };

// 正确: 对象式导出
export const tasksApi = {
  create: async () => { ... },
  get: async () => { ... },
};
```
