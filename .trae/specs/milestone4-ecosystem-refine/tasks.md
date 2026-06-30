# Tasks

## Round 1 — 错误体系 + Provider注册表（基础设施层）

- [x] Task R1-1: 创建共享错误基类 `shared/types/appError.ts`
  - [x] SubTask R1-1.1: 读取当前前后端 AppError 实现，确定共享字段
  - [x] SubTask R1-1.2: 创建 `shared/types/appError.ts`，定义 `AppErrorBase` + `ErrorContext` + `ErrorSerialization`
  - [x] SubTask R1-1.3: `shared/types/index.ts` 导出新模块

- [x] Task R1-2: 重构后端 AppError 继承共享基类
  - [x] SubTask R1-2.1: 后端 `AppError` 继承 `AppErrorBase`，保留重载构造函数和链式调用
  - [x] SubTask R1-2.2: 统一404 catch-all handler响应格式
  - [x] SubTask R1-2.3: 验证后端 `new AppError(...)` 调用正常

- [x] Task R1-3: 重构前端 AppError 继承共享基类
  - [x] SubTask R1-3.1: 前端 `AppError` 继承 `AppErrorBase`，保留 fromJSON 和子类
  - [x] SubTask R1-3.2: `createErrorFromResponse` 正确映射 `code` 字段
  - [x] SubTask R1-3.3: 验证前端错误处理路径正常

- [x] Task R1-4: 创建 Provider 注册表
  - [x] SubTask R1-4.1: 创建 `providerRegistry.ts`
  - [x] SubTask R1-4.2: `factory.ts` 使用 `providerRegistry.create()`
  - [x] SubTask R1-4.3: 6个Provider文件自注册

- [x] Task R1-5: 解耦 BaseAIProvider 对 OpenAI SDK 的强绑定
  - [x] SubTask R1-5.1: `AIProviderClient` 接口定义
  - [x] SubTask R1-5.2: `BaseAIProvider.client` 类型改为 `AIProviderClient`
  - [x] SubTask R1-5.3: Volcengine/Aliyun 正常工作

- [x] Task R1-6: 消除 config.ts 中 any 类型 + 统一前端 AIProviderType
  - [x] SubTask R1-6.1: `AIProviderConfig` 类型定义
  - [x] SubTask R1-6.2: config.ts `any` 已替换
  - [x] SubTask R1-6.3: SetupWizard/Login 从 shared 导入 AIProviderType
  - [x] SubTask R1-6.4: aiClient.ts 使用 shared 类型
  - [x] SubTask R1-6.5: providers.ts 从 registry 动态获取

- [x] Task R1-7: Round 1 验证
  - [x] SubTask R1-7.1: `npm run check:full` 通过
  - [x] SubTask R1-7.2: `npm run lint:full` 通过

## Round 2 — 路由统一（前端架构层）

- [x] Task R2-1: 增强 Kernel RouteRegistration 类型
  - [x] SubTask R2-1.1: `RouteRegistration` 增加 `layout` 字段
  - [x] SubTask R2-1.2: `NavItemRegistration` 增加 `category` 字段
  - [x] SubTask R2-1.3: 更新 `plugins.ts` 所有 `registerRoute()` 调用
  - [x] SubTask R2-1.4: 更新 `plugins.ts` 所有 `registerNavItem()` 调用
  - [x] SubTask R2-1.5: 补充遗漏路由：`/setup`、重定向 `/dashboard`→`/`、`/graphs`→`/`

- [x] Task R2-2: 移除 App.tsx 硬编码路由
  - [x] SubTask R2-2.1: 重写 `useKernelRoutes()` hook
  - [x] SubTask R2-2.2: 删除全部24个 `lazy()` + 26个 `<Route>`
  - [x] SubTask R2-2.3: 调整路由结构为 public + Layout内protected
  - [x] SubTask R2-2.4: 验证路由正常

- [x] Task R2-3: Layout 侧边栏从 Kernel 动态渲染
  - [x] SubTask R2-3.1: 创建 `src/utils/iconMap.ts`
  - [x] SubTask R2-3.2: Layout.tsx 从 Kernel 动态渲染 SidebarLink
  - [x] SubTask R2-3.3: MobileBottomNav.tsx 从 Kernel 动态渲染
  - [x] SubTask R2-3.4: 验证侧边栏和底部导航正确

- [x] Task R2-4: Round 2 验证
  - [x] SubTask R2-4.1: `npm run check:full` 通过
  - [x] SubTask R2-4.2: `npm run lint:full` 通过

## Round 3 — 缓存优化 + 全局验证（收尾层）

- [x] Task R3-1: 提升缓存容量
  - [x] SubTask R3-1.1: MAX_CACHE_KEYS 从 1000 提升至 5000

- [x] Task R3-2: 消除冗余缓存失效
  - [x] SubTask R3-2.1: 分析 `invalidateAllGraphRelated` 3个子方法，确认 key 重叠范围
  - [x] SubTask R3-2.2: 重写 `invalidateAllGraphRelated`，合并为用户级显式删除 + graph tag 标签化失效
  - [x] SubTask R3-2.3: 优化 `invalidateStructureCache` 同样模式

- [x] Task R3-3: CacheInterface 抽象消除 instanceof
  - [x] SubTask R3-3.1: `CacheInterface` 新增 `getStats()` 方法
  - [x] SubTask R3-3.2: `CacheInterface` 新增 `delMany()` 方法
  - [x] SubTask R3-3.3: `CacheInterface` 新增 `delByTagsWithCount()` 方法
  - [x] SubTask R3-3.4: `CacheInterface` 新增 `getRemainingTTL()` 方法
  - [x] SubTask R3-3.5: `MemoryCacheStore` 实现上述方法
  - [x] SubTask R3-3.6: 修改 `cacheService.ts` 中5处 `instanceof` 检查，改为调用 `CacheInterface` 方法
  - [x] SubTask R3-3.7: 验证缓存功能正常

- [x] Task R3-4: 全局验证
  - [x] SubTask R3-4.1: `npm run check:full` 通过
  - [x] SubTask R3-4.2: `npm run lint:full` 通过
  - [x] SubTask R3-4.3: 验证新增 Provider 需修改文件数 ≤ 2（Provider类文件 + 注册调用）
  - [x] SubTask R3-4.4: 验证新增页面需修改文件数 = 1（plugins.ts）

# Task Dependencies

## Round 内依赖
- [R1-1] → [R1-2, R1-3]（共享基类先建好才能继承）
- [R1-4] → [R1-5]（注册表先建好才能改 factory）
- [R1-5] → [R1-6]（解耦后才能定义具体配置类型）
- [R1-1~R1-6] → [R1-7]
- [R2-1] → [R2-2]（类型增强先完成才能重写路由渲染）
- [R2-2] → [R2-3]（路由移除后再改导航）
- [R2-1~R2-3] → [R2-4]
- [R3-1, R3-2, R3-3] 无依赖，可并行
- [R3-1~R3-3] → [R3-4]

## Round 间依赖
- [Round 2] 建议在 Round 1 完成后再开始（错误体系是基础设施）
- [Round 3] 建议在 Round 2 完成后再开始（避免合并冲突）
