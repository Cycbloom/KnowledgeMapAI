# Tasks

- [x] Task 1: 修复 getOrSet falsy 值缓存 bug
  - [x] SubTask 1.1: 将 `if (cached)` 改为 `if (cached !== undefined)`（第 175 行）
  - [x] SubTask 1.2: 同步检查 `warmup` 方法中的 `if (!cached)` 是否也有此问题（第 203 行）

- [x] Task 2: 为 NodeCache 添加 maxKeys 容量限制
  - [x] SubTask 2.1: 在 NodeCache 初始化时添加 `maxKeys: 1000` 参数

- [x] Task 3: 将 delByPrefix 生产调用改为标签索引方式
  - [x] SubTask 3.1: 修改 `api/routes/templates.ts` 第 96 行，将 `delByPrefix("templates_")` 改为 `delByTags(["template:all"])`
  - [x] SubTask 3.2: 修改 `api/services/core/subscribers/cacheInvalidationSubscriber.ts` 第 114 行，将 `delByPrefix` 改为 `delByTags`
  - [x] SubTask 3.3: 修改 `invalidateStructureCache` 中第 425 行的 `delByPrefix` 调用，改为 `delByTags`
  - [x] SubTask 3.4: 将 `delByPrefix` 方法标记为 `@deprecated`

- [x] Task 4: 更新测试
  - [x] SubTask 4.1: 添加 falsy 值缓存测试（空数组、0、false、null、空字符串）
  - [x] SubTask 4.2: 添加 maxKeys 容量限制测试
  - [x] SubTask 4.3: 确认现有测试全部通过

# Task Dependencies
- Task 3 依赖 Task 1（先修复 bug 再改调用方式）
- Task 4 依赖 Task 1、2、3
