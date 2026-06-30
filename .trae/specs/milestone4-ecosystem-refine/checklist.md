# Round 1 检查点
- [x] `shared/types/appError.ts` 存在，定义了 `AppErrorBase` 抽象类
- [x] 后端 `AppError` 继承 `AppErrorBase`，保留重载构造函数和链式调用
- [x] 前端 `AppError` 继承 `AppErrorBase`，保留 fromJSON 和子类
- [x] 404 catch-all handler 响应包含 `code`、`message`、`requestId`、`timestamp` 字段
- [x] `api/services/ai/providerRegistry.ts` 存在，实现 register/create 方法
- [x] `factory.ts` 使用 providerRegistry.create() 替换 switch-case
- [x] `BaseAIProvider.client` 类型为 `AIProviderClient`（非 `OpenAI`）
- [x] `config.ts` 无 `any` 类型
- [x] 前端 `SetupWizard.tsx` / `Login.tsx` 从 shared 导入 `AIProviderType`
- [x] `npm run check:full` 通过
- [x] `npm run lint:full` 通过

# Round 2 检查点
- [x] `RouteRegistration` 含 `layout` 字段（`"protected" | "public"`）
- [x] `NavItemRegistration` 含 `category` 字段（`"main" | "more"`）
- [x] plugins.ts 补充了 `/setup` 路由和重定向路由
- [x] App.tsx 无硬编码 lazy import 和 Route 组件
- [x] `useKernelRoutes()` 根据 layout 字段正确分组渲染
- [x] Layout.tsx 侧边栏从 `frontendKernel.getNavItems()` 动态渲染
- [x] MobileBottomNav.tsx 从 Kernel NavItem 动态渲染
- [x] `npm run check:full` 通过
- [x] `npm run lint:full` 通过

# Round 3 检查点
- [x] `MAX_CACHE_KEYS` = 5000
- [x] `invalidateAllGraphRelated` 中每个 key 只被删除一次
- [x] `CacheInterface` 包含 getStats/delMany/delByTagsWithCount/getRemainingTTL 方法
- [x] `cacheService.ts` 中无 `instanceof MemoryCacheStore` 检查
- [x] 新增 Provider 需修改文件数 ≤ 2
- [x] 新增页面需修改文件数 = 1（plugins.ts）
- [x] `npm run check:full` 通过
- [x] `npm run lint:full` 通过
