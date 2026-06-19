# Tasks

- [x] Task 1: 消除 ragService → graphTraversalService 的直接导入
  - [x] 读取 `api/services/ai/ragService.ts`，识别所有对 `graphTraversalService` 的使用点
  - [x] 为 `ragService` 添加构造函数参数或 setter 方法接收遍历能力
  - [x] 将 `ragService` 内部对 `graphTraversalService` 的调用替换为注入的函数
  - [x] 移除 `ragService` 中对 `graphTraversalService` 的 import 语句

- [x] Task 2: 在服务初始化入口注入遍历能力
  - [x] 读取 `api/services/index.ts`，找到 `ragService` 的初始化位置
  - [x] 在初始化时将 `graphTraversalService` 的遍历方法注入到 `ragService`
  - [x] 确保初始化顺序正确（graphTraversalService 先于 ragService）

- [x] Task 3: 添加依赖方向文档注释
  - [x] 在 `api/services/index.ts` 顶部添加注释说明服务依赖方向规则：common ← core ← ai ← graph ← study ← scheduler

# Task Dependencies
- [Task 2] depends on [Task 1]
- [Task 3] depends on [Task 2]
