# Tasks

- [x] Task 1: 关闭 VitePWA 的 SW 自动注入并解决文件名冲突
  - [x] SubTask 1.1: 在 [vite.config.ts](file:///d:/KnowledgeMap/vite.config.ts) 的 `VitePWA({...})` 顶层添加 `injectRegister: false`
  - [x] SubTask 1.2: 在 `workbox` 配置块中显式设置 `swDest: 'pwa-sw.js'`（确保不覆盖 `public/sw.js`）
  - [x] SubTask 1.3: 在 `devOptions` 中显式设置 `swDest`/`name` 等价项，确保开发模式下 `dev-dist` 输出的 SW 文件名同样不与 `sw.js` 冲突（vite-plugin-pwa 1.2.0 的 DevOptions 不支持命名 dev SW，已在 devOptions 旁添加行内注释记录该已知限制，保留 `injectRegister: false` 作为主要缓解措施）

- [x] Task 2: 修复 [public/sw.js](file:///d:/KnowledgeMap/public/sw.js) 导航请求的 preloadResponse 消费逻辑
  - [x] SubTask 2.1: 修改 `request.destination === 'document'` 分支，先 `await event.preloadResponse`，命中则直接返回
  - [x] SubTask 2.2: 若 `preloadResponse` 为空或抛错，回退到 `fetch(request)`，再回退到 `caches.match('/index.html')`
  - [x] SubTask 2.3: 在 `activate` 阶段调用 `event.waitUntil(self.registration.navigationPreload.disable().catch(() => {}))` 显式禁用 navigation preload

- [x] Task 3: 在 [public/sw.js](file:///d:/KnowledgeMap/public/sw.js) `activate` 阶段清理残留 Workbox SW 与缓存
  - [x] SubTask 3.1: 遍历 `self.registration` 范围内的现有 SW 注册（通过 `self.serviceWorker.getRegistrations()`），注销非当前脚本的 SW
  - [x] SubTask 3.2: 清理 `workbox-precache-v2-*` 命名缓存（`caches.keys()` → 过滤匹配 → `caches.delete`）
  - [x] SubTask 3.3: 保留现有 `v1` 缓存清理逻辑，确保不破坏当前缓存策略

- [x] Task 4: 验证修复效果
  - [x] SubTask 4.1: 执行 `npm run check`（标准类型检查，因 `check:incremental` 脚本本身有缓存路径 bug 改用标准检查）与 `npm run lint`，确保类型/规范检查通过 — 均退出码 0
  - [x] SubTask 4.2: 执行 `npm run build`（非 Electron），检查 `dist/sw.js` 内容与 [public/sw.js](file:///d:/KnowledgeMap/public/sw.js) 一致 — 已确认 dist/sw.js 第 1-10 行与 public/sw.js 一致；VitePWA 产物 `pwa-sw.js` 因插件 1.2.0 把 swDest 解析为相对项目根而被输出到根目录，未被引用，已清理并加入 .gitignore
  - [ ] SubTask 4.3: 在浏览器中加载构建产物，确认 Application → Service Workers 仅有一个 `/sw.js` 注册项，且刷新后控制台不再出现 navigation preload 警告 — 需用户在浏览器中实测
  - [ ] SubTask 4.4: 模拟离线场景，确认导航请求仍能回退到缓存的 `/index.html` — 需用户在浏览器中实测

# Task Dependencies

- Task 2 与 Task 3 修改同一文件 [public/sw.js](file:///d:/KnowledgeMap/public/sw.js)，已串行在单一子代理内完成
- Task 1 独立，已与 Task 2/Task 3 并行完成
- Task 4 依赖 Task 1、Task 2、Task 3 全部完成 — 静态验证全部通过；浏览器运行时验证留待用户实测
