# API 命名规范

## API 对象命名

| 层级 | 格式 | 示例 |
|------|------|------|
| api 层 | `{资源名}Api` | `graphsApi`, `nodesApi`, `authApi` |
| mobile 层 | `mobile{资源名}Api` | `mobileGraphsApi`, `mobileNodesApi` |

- 资源名使用 **复数形式** + **camelCase**

## 方法命名

| 操作 | 方法名 | 说明 |
|------|--------|------|
| 获取列表 | `list` | 获取资源列表 |
| 获取单个 | `get` | 根据 ID 获取单个资源 |
| 创建 | `create` | 创建新资源 |
| 更新 | `update` | 更新现有资源 |
| 删除 | `delete` | 删除资源 |
| 批量操作 | `batch{Action}` | `batchDelete`, `batchRestore`, `batchUpdate` |
| 特定操作 | `get{RelatedResource}` / `toggle{Property}` / `{action}{Resource}` | `getTags`, `toggleFavorite`, `startTask` |

**注意**：方法名不重复资源名，用 `tasksApi.create()` 而非 `tasksApi.createTask()`

## 参数命名

- 使用 **camelCase**
- 常用：`id`（资源标识）、`data`（创建/更新数据）、`ids`（批量操作）、`filters`（过滤条件）、`options`（可选配置）

## 导出规范

- **推荐**：命名导出对象 `export const graphsApi = { list, get, create }`
- **避免**：独立函数导出 `export const createTask = async () => {}`
- **统一导出**：`api/index.ts` 用 `export const api = { graphs: graphsApi, nodes: nodesApi }`；mobile 同理加 `mobile` 前缀