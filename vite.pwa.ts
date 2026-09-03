import { VitePWA } from "vite-plugin-pwa";
import type { Plugin } from "vite";

/**
 * Electron 构建使用：提供 `virtual:pwa-register/react` 虚拟模块的解析，
 * 使其能被打包（App.tsx 中 <LazyUpdatePrompt> 始终会被编译进 chunk，
 * 即使 electron 运行时条件渲染为不挂载）。Electron 端不注册 Service Worker，
 * 因此该 stub 的 `useRegisterSW` 返回永远不触发更新的 no-op 状态。
 */
function electronPwaStubPlugin(): Plugin {
  const virtualId = "virtual:pwa-register/react";
  const resolvedId = `\u0000${virtualId}`;
  return {
    name: "electron-pwa-stub",
    resolveId(id) {
      if (id === virtualId) return resolvedId;
    },
    load(id) {
      if (id === resolvedId) {
        return `
          export function useRegisterSW() {
            return {
              needRefresh: [false, () => undefined],
              offlineReady: [false, () => undefined],
              updateServiceWorker: async () => undefined,
            };
          }
        `;
      }
    },
  };
}

export function getPwaPlugins(isElectronBuild: boolean) {
  if (isElectronBuild) {
    return [electronPwaStubPlugin()];
  }

  return [
    VitePWA({
      registerType: "autoUpdate",
      injectRegister: false,
      // R20: 使用顶层 `filename` 而非 `workbox.swDest`，让 vite-plugin-pwa
      // 自动 resolve 到 `${root}/${outDir}/pwa-sw.js`（即 dist/pwa-sw.js）。
      // 直接配置 `workbox.swDest: "pwa-sw.js"` 会被解析为相对 cwd，
      // 导致 SW 生成在项目根目录而非 dist/，部署后无法注册。
      filename: "pwa-sw.js",
      includeAssets: ["favicon.svg", "robots.txt", "icons/*.png"],
      manifest: {
        name: "Knowledge Map AI",
        short_name: "KnowledgeMap",
        description: "AI-powered Knowledge Graph Editor",
        theme_color: "#ffffff",
        background_color: "#ffffff",
        display: "standalone",
        orientation: "any",
        start_url: "./",
        scope: "./",
        icons: [
          {
            src: "favicon.svg",
            sizes: "192x192",
            type: "image/svg+xml",
            purpose: "any maskable",
          },
          {
            src: "favicon.svg",
            sizes: "512x512",
            type: "image/svg+xml",
            purpose: "any maskable",
          },
          {
            src: "icons/192x192.png",
            sizes: "192x192",
            type: "image/png",
            purpose: "any",
          },
          {
            src: "icons/512x512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "any",
          },
          {
            src: "icons/512x512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "maskable",
          },
        ],
        shortcuts: [
          {
            name: "新建图谱",
            short_name: "新建",
            description: "创建一个新的知识图谱",
            url: "./dashboard?action=create",
            icons: [{ src: "icons/96x96.png", sizes: "96x96" }],
          },
          {
            name: "学习模式",
            short_name: "学习",
            description: "进入学习模式",
            url: "./study",
            icons: [{ src: "icons/96x96.png", sizes: "96x96" }],
          },
          {
            name: "任务管理",
            short_name: "任务",
            description: "查看和管理任务",
            url: "./scheduler",
            icons: [{ src: "icons/96x96.png", sizes: "96x96" }],
          },
        ],
        share_target: {
          action: "./api/share-target",
          method: "POST",
          enctype: "multipart/form-data",
          params: {
            title: "title",
            text: "text",
            url: "url",
            files: [
              {
                name: "file",
                accept: [
                  "text/plain",
                  "text/markdown",
                  "application/json",
                ],
              },
            ],
          },
        },
        categories: ["education", "productivity", "utilities"],
        lang: "zh-CN",
        dir: "ltr",
        prefer_related_applications: false,
        related_applications: [],
        iarc_rating_id: "",
      },
      workbox: {
        globPatterns: ["**/*.{js,css,html,ico,png,svg,woff,woff2,json}"],
        // P1-3: 重型懒加载 vendor（mermaid 图表 / three.js 3D 视图 / recharts 统计图）
        // 不进入 SW 预缓存，改为运行时按需缓存——安装 SW 与每次发版不再强制
        // 下载数 MB 的低频资源，首次在线访问后由下方 runtimeCaching 缓存供离线复用。
        // 这些文件名带内容 hash（不可变），CacheFirst 语义安全。
        globIgnores: [
          "**/vendor-mermaid*.js",
          "**/vendor-three*.js",
          "**/vendor-postprocessing*.js",
          "**/vendor-charts*.js",
        ],
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
        cleanupOutdatedCaches: true,
        navigationPreload: false,
        runtimeCaching: [
          {
            // 被 globIgnores 排除出预缓存的重型 vendor chunk：同源 assets/ 下
            // 内容 hash 文件名不可变，CacheFirst 命中后不再回源。
            urlPattern: /assets\/vendor-(?:mermaid|three|postprocessing|charts)[^/]*\.js$/i,
            handler: "CacheFirst",
            options: {
              cacheName: "heavy-vendor-chunks",
              expiration: {
                maxEntries: 48,
                maxAgeSeconds: 60 * 60 * 24 * 30,
              },
              cacheableResponse: {
                statuses: [0, 200],
              },
            },
          },
          {
            urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
            handler: "CacheFirst",
            options: {
              cacheName: "google-fonts-cache",
              expiration: {
                maxEntries: 20,
                maxAgeSeconds: 60 * 60 * 24 * 365,
              },
              cacheableResponse: {
                statuses: [0, 200],
              },
            },
          },
          {
            urlPattern: /^https:\/\/fonts\.gstatic\.com\/.*/i,
            handler: "CacheFirst",
            options: {
              cacheName: "gstatic-fonts-cache",
              expiration: {
                maxEntries: 20,
                maxAgeSeconds: 60 * 60 * 24 * 365,
              },
              cacheableResponse: {
                statuses: [0, 200],
              },
            },
          },
          {
            urlPattern: /\.(?:png|jpg|jpeg|svg|gif)$/i,
            handler: "CacheFirst",
            options: {
              cacheName: "images-cache",
              expiration: {
                maxEntries: 60,
                maxAgeSeconds: 60 * 60 * 24 * 30,
              },
              cacheableResponse: {
                statuses: [0, 200],
              },
            },
          },
          {
            urlPattern: /^https:\/\/.*\.supabase\.co\/rest\/v1\//,
            handler: "NetworkFirst",
            options: {
              cacheName: "supabase-rest-cache",
              networkTimeoutSeconds: 5,
              expiration: {
                maxEntries: 100,
                maxAgeSeconds: 5 * 60, // 5 分钟
              },
              cacheableResponse: {
                statuses: [0, 200],
              },
            },
          },
          {
            urlPattern: /^https:\/\/.*\.supabase\.co\/auth\/v1\//,
            handler: "NetworkOnly",
            options: {
              cacheName: "supabase-auth-noop",
            },
          },
        ],
        navigateFallbackDenylist: [
          /^\/api\//,
          /^https:\/\/.*\.supabase\.co\/rest\/v1\//,
          /^https:\/\/.*\.supabase\.co\/auth\/v1\//,
        ],
      },
      devOptions: { // NOTE: dev SW 文件名冲突通过 injectRegister: false 缓解；vite-plugin-pwa 不支持单独命名 dev SW
        enabled: true,
        type: "module",
      },
    }),
  ];
}