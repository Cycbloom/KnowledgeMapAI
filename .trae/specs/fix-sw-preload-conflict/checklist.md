# Checklist

- [x] [vite.config.ts](file:///d:/KnowledgeMap/vite.config.ts) 的 `VitePWA({...})` 配置中显式存在 `injectRegister: false`
- [x] [vite.config.ts](file:///d:/KnowledgeMap/vite.config.ts) 的 `workbox` 配置块显式存在 `swDest: 'pwa-sw.js'`（或等价非冲突文件名）
- [x] [public/sw.js](file:///d:/KnowledgeMap/public/sw.js) 的 `request.destination === 'document'` 分支在返回响应前 `await event.preloadResponse`
- [x] [public/sw.js](file:///d:/KnowledgeMap/public/sw.js) 的 `activate` 阶段调用 `self.registration.navigationPreload.disable()` 显式禁用预载
- [x] [public/sw.js](file:///d:/KnowledgeMap/public/sw.js) 的 `activate` 阶段清理 `workbox-precache-v2-*` 缓存
- [x] [public/sw.js](file:///d:/KnowledgeMap/public/sw.js) 的 `activate` 阶段注销非当前脚本的残留 SW 注册
- [x] [src/utils/serviceWorker.ts](file:///d:/KnowledgeMap/src/utils/serviceWorker.ts) 与 [src/main.tsx](file:///d:/KnowledgeMap/src/main.tsx) 的注册路径未被改动
- [x] `npm run check` 通过（exit code 0；改用标准 check 因 check:incremental 脚本本身有缓存路径 bug）
- [x] `npm run lint` 通过（exit code 0）
- [x] `npm run build` 产物中 `dist/sw.js` 与 [public/sw.js](file:///d:/KnowledgeMap/public/sw.js) 一致
- [ ] 浏览器 DevTools → Application → Service Workers 仅显示一个 `/sw.js` 注册项（需用户实测）
- [ ] 刷新页面后控制台不再出现 "navigation preload request was cancelled before 'preloadResponse' settled" 警告（需用户实测）
- [ ] 离线状态下导航请求仍能返回缓存的 `/index.html`（需用户实测）
