# 解决 Service Worker Navigation Preload 警告问题

## 问题分析

### 错误信息
```
The service worker navigation preload request was cancelled before 'preloadResponse' settled. 
If you intend to use 'preloadResponse', use waitUntil() or respondWith() to wait for the promise to settle.
```

### 问题根源

1. **配置位置**: [vite.config.ts:195](file:///d:\KnowledgeMap\vite.config.ts#L195) 启用了 `navigationPreload: true`

2. **Workbox 行为**: Workbox 在处理 navigation preload 时，会 `await event.preloadResponse`（见 [workbox-e39c8652.js:2542](file:///d:\KnowledgeMap\dev-dist\workbox-e39c8652.js#L2542)）

3. **问题场景**: 当用户快速导航或取消请求时，`preloadResponse` promise 还未完成就被取消，导致警告

4. **这是 Workbox 的已知问题**: Workbox 在 `fetch()` 方法中直接 `await event.preloadResponse`，没有使用 `event.waitUntil()` 来确保 promise 完成

### 技术细节

```javascript
// workbox-e39c8652.js:2541-2542
if (request.mode === 'navigate' && event instanceof FetchEvent && event.preloadResponse) {
  const possiblePreloadResponse = await event.preloadResponse; // 问题在这里
  // ...
}
```

当请求被取消时，`preloadResponse` promise 可能永远不会 settle，导致警告。

## 解决方案

### 方案一：禁用 Navigation Preload（推荐）

**优点**: 简单直接，无副作用
**缺点**: 失去 navigation preload 带来的性能优化

**修改**: 在 `vite.config.ts` 中将 `navigationPreload: true` 改为 `navigationPreload: false`

### 方案二：忽略警告

**说明**: 这只是一个警告，不影响功能。如果不需要 navigation preload 的性能优化，可以忽略。

### 方案三：等待 Workbox 更新

**说明**: 这是 Workbox 库的问题，可能在未来版本中修复。

## 推荐方案

**采用方案一：禁用 Navigation Preload**

理由：
1. 这是一个 Electron 桌面应用为主的项目，navigation preload 的性能优化意义不大
2. 禁用后可以消除警告，保持控制台清洁
3. 修改简单，无风险

## 实施步骤

1. 修改 `vite.config.ts` 文件
2. 将 `navigationPreload: true` 改为 `navigationPreload: false`
3. 重新构建项目验证警告消失

## 代码变更

```typescript
// vite.config.ts - workbox 配置部分
workbox: {
  globPatterns: ["**/*.{js,css,html,ico,png,svg,woff,woff2,json}"],
  maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
  cleanupOutdatedCaches: true,
  navigationPreload: false,  // 改为 false
  // ... 其他配置
}
```
