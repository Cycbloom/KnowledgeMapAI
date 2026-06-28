# 修复 Service Worker Navigation Preload 冲突 Spec

## Why

用户在使用 Web 端时偶发出现浏览器警告：

> The service worker navigation preload request was cancelled before 'preloadResponse' settled.

根因是项目同时存在两套争抢 `/sw.js` URL 的 Service Worker：手写的 [public/sw.js](file:///d:/KnowledgeMap/public/sw.js)（由 [src/main.tsx](file:///d:/KnowledgeMap/src/main.tsx) 手动注册）与 VitePWA 生成的 Workbox SW（由 `vite-plugin-pwa` 默认 `injectRegister: 'auto'` 自动注入注册）。两者在同一 URL 上互相覆盖/竞争控制器，且手写 SW 的导航 fetch 处理器没有消费 `event.preloadResponse`，导致浏览器发起的 navigation preload 请求被取消，触发该警告。

## What Changes

- 在 [vite.config.ts](file:///d:/KnowledgeMap/vite.config.ts) 的 `VitePWA({...})` 配置中显式设置 `injectRegister: false`，停止 VitePWA 自动注入 SW 注册脚本
- 在 VitePWA 配置中显式设置 `swDest: 'pwa-sw.js'`（或等价非冲突名），避免 VitePWA 生成的 SW 在构建产物中覆盖手写的 `public/sw.js`
- 修改 [public/sw.js](file:///d:/KnowledgeMap/public/sw.js) 的导航请求处理逻辑，正确 `await event.preloadResponse`（若存在）后再回退到 `fetch`/缓存，消除 preload 被取消的警告
- 在 [public/sw.js](file:///d:/KnowledgeMap/public/sw.js) 的 `activate` 阶段增加一次性清理逻辑：注销历史上由 VitePWA/Workbox 注册的残留 SW 与缓存（`workbox-precache-v2-*` 等），避免旧 SW 长期残留
- 不改动 [src/utils/serviceWorker.ts](file:///d:/KnowledgeMap/src/utils/serviceWorker.ts) 的注册入口与 [src/main.tsx](file:///d:/KnowledgeMap/src/main.tsx) 的调用（保留手写 SW 的注册路径）

## Impact

- Affected specs: 无（PWA/Service Worker 为独立能力，未与其它 spec 交叉）
- Affected code:
  - [vite.config.ts](file:///d:/KnowledgeMap/vite.config.ts) — VitePWA 插件配置
  - [public/sw.js](file:///d:/KnowledgeMap/public/sw.js) — 手写 SW 的 fetch / activate 处理
  - 构建产物：`dist/sw.js`（来自 `public/sw.js`）、`dist/pwa-sw.js`（VitePWA 生成但不再注册，仅作为不再覆盖 `sw.js` 的副作用产物保留；后续可在另一变更中清理）

## ADDED Requirements

### Requirement: 单一 Service Worker 注册源

系统 SHALL 在 Web 构建（非 Electron）中仅由 [src/main.tsx](file:///d:/KnowledgeMap/src/main.tsx) 通过 `registerServiceWorker('/sw.js')` 注册唯一的 Service Worker，且 `/sw.js` 始终指向 [public/sw.js](file:///d:/KnowledgeMap/public/sw.js)。

#### Scenario: VitePWA 不再自动注册 SW
- **WHEN** 执行 `npm run build`（非 Electron）后加载页面
- **THEN** 浏览器只存在一个由 `main.tsx` 触发的 `/sw.js` 注册项，不出现 VitePWA 注入的第二个注册脚本

#### Scenario: 构建产物不再互相覆盖
- **WHEN** 检查 `dist/` 目录
- **THEN** `dist/sw.js` 内容与 [public/sw.js](file:///d:/KnowledgeMap/public/sw.js) 一致；VitePWA 生成的 SW（若仍输出）使用非 `sw.js` 的文件名

### Requirement: Navigation Preload 安全消费

[public/sw.js](file:///d:/KnowledgeMap/public/sw.js) 的导航请求处理器 SHALL 在响应前优先 `await event.preloadResponse`（当其存在时），并在 `activate` 阶段显式禁用 `navigationPreload`（因手写 SW 不依赖预载能力），避免出现 "preloadResponse 未落定即被取消" 的警告。

#### Scenario: 导航请求不触发 preload 警告
- **WHEN** 用户在已激活新 SW 的页面上进行导航刷新
- **THEN** 控制台不再出现 "The service worker navigation preload request was cancelled before 'preloadResponse' settled" 警告

#### Scenario: 离线回退仍可用
- **WHEN** 用户在离线状态下访问已缓存的导航路由
- **THEN** SW 返回缓存的 `/index.html`，不因 preload 处理逻辑变更而失效

### Requirement: 残留 Workbox SW 清理

新激活的 [public/sw.js](file:///d:/KnowledgeMap/public/sw.js) SHALL 在 `activate` 阶段一次性注销历史上由 VitePWA/Workbox 注册的同 scope 残留 SW，并清理 `workbox-precache-v2-*` 缓存，避免旧 SW 长期占据控制器导致行为漂移。

#### Scenario: 升级后旧 Workbox SW 被移除
- **GIVEN** 用户浏览器中存在历史 VitePWA 注册的 `/sw.js`（Workbox 版本）残留
- **WHEN** 新版 [public/sw.js](file:///d:/KnowledgeMap/public/sw.js) 激活
- **THEN** 旧 Workbox SW 注销，`workbox-precache-v2-*` 缓存被清空，新 SW 成为唯一控制器

## MODIFIED Requirements

### Requirement: VitePWA 插件配置

[vite.config.ts](file:///d:/KnowledgeMap/vite.config.ts) 中的 `VitePWA({...})` 配置 SHALL 显式声明 `injectRegister: false` 与非冲突的 `swDest`，保留 PWA manifest 生成能力，但不再参与 SW 注册与 `/sw.js` 文件输出。

## REMOVED Requirements

无（不删除任何现有功能，仅解除冲突并收敛 SW 注册路径）。
