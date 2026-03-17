import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import tsconfigPaths from "vite-tsconfig-paths";
import { VitePWA } from "vite-plugin-pwa";

function getChunkStrategy(id: string): string | undefined {
  if (!id.includes("node_modules")) return undefined;

  if (id.includes("mermaid")) {
    return "vendor-mermaid";
  }

  if (id.includes("dagre") || id.includes("graphlib") || id.includes("elkjs")) {
    return "vendor-mermaid";
  }

  if (id.includes("katex")) return "vendor-katex";

  if (
    id.includes("react-markdown") ||
    id.includes("remark-") ||
    id.includes("rehype-") ||
    id.includes("unified") ||
    id.includes("unist-") ||
    id.includes("mdast-") ||
    id.includes("micromark") ||
    id.includes("decode-named-character-reference")
  ) {
    return "vendor-markdown";
  }

  if (
    id.includes("@react-three") ||
    id.includes("three") ||
    id.includes("postprocessing")
  ) {
    return "vendor-three";
  }

  if (id.includes("recharts")) return "vendor-charts";

  if (id.includes("d3-")) return "vendor-d3";

  if (id.includes("lucide-react") || id.includes("framer-motion"))
    return "vendor-ui";
  if (id.includes("@dnd-kit")) return "vendor-dnd";

  if (id.includes("zustand") || id.includes("@tanstack/react-query"))
    return "vendor-state";

  if (id.includes("@supabase")) return "vendor-supabase";

  if (id.includes("openai") || id.includes("zod")) return "vendor-ai";

  if (
    id.includes("react") ||
    id.includes("react-dom") ||
    id.includes("react-router") ||
    id.includes("scheduler")
  ) {
    return "vendor-react";
  }

  if (id.includes("react-")) return "vendor-react-ecosystem";

  if (
    id.includes("clsx") ||
    id.includes("tailwind-merge") ||
    id.includes("axios") ||
    id.includes("comlink")
  ) {
    return "vendor-utils";
  }

  if (id.includes("html2canvas")) return "vendor-export";
  if (id.includes("ts-fsrs")) return "vendor-fsrs";
  if (id.includes("cheerio")) return "vendor-parser";
  if (id.includes("bullmq") || id.includes("ioredis")) return "vendor-queue";

  return undefined;
}

const isElectronBuild = process.env.ELECTRON_BUILD === "true";
const isMobileBuild = process.env.MOBILE_BUILD === "true";

function getBasePath(): string {
  if (isElectronBuild || isMobileBuild) {
    return "./";
  }
  return "/";
}

export default defineConfig({
  base: getBasePath(),
  plugins: [
    react(),
    tsconfigPaths(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["favicon.svg", "robots.txt", "icons/*.png"],
      manifest: {
        name: "Knowledge Map AI",
        short_name: "KnowledgeMap",
        description: "AI-powered Knowledge Graph Editor",
        theme_color: "#ffffff",
        background_color: "#ffffff",
        display: "standalone",
        orientation: "any",
        start_url: "/",
        scope: "/",
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
            url: "/dashboard?action=create",
            icons: [{ src: "icons/96x96.png", sizes: "96x96" }],
          },
          {
            name: "学习模式",
            short_name: "学习",
            description: "进入学习模式",
            url: "/study",
            icons: [{ src: "icons/96x96.png", sizes: "96x96" }],
          },
          {
            name: "任务管理",
            short_name: "任务",
            description: "查看和管理任务",
            url: "/scheduler",
            icons: [{ src: "icons/96x96.png", sizes: "96x96" }],
          },
        ],
        share_target: {
          action: "/api/share-target",
          method: "POST",
          enctype: "multipart/form-data",
          params: {
            title: "title",
            text: "text",
            url: "url",
            files: [
              {
                name: "file",
                accept: ["text/plain", "text/markdown", "application/json"],
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
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
        cleanupOutdatedCaches: true,
        navigationPreload: false,
        runtimeCaching: [
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
            urlPattern: /\/api\/graphs\/[^/]+$/i,
            handler: "NetworkFirst",
            options: {
              cacheName: "graph-data-cache",
              expiration: {
                maxEntries: 50,
                maxAgeSeconds: 60 * 60 * 24,
              },
              cacheableResponse: {
                statuses: [0, 200],
              },
              networkTimeoutSeconds: 10,
            },
          },
          {
            urlPattern: /\/api\/graphs\/[^/]+\/nodes/i,
            handler: "NetworkFirst",
            options: {
              cacheName: "graph-nodes-cache",
              expiration: {
                maxEntries: 100,
                maxAgeSeconds: 60 * 60,
              },
              cacheableResponse: {
                statuses: [0, 200],
              },
              networkTimeoutSeconds: 10,
            },
          },
          {
            urlPattern: /\/api\/templates/i,
            handler: "CacheFirst",
            options: {
              cacheName: "templates-cache",
              expiration: {
                maxEntries: 30,
                maxAgeSeconds: 60 * 60 * 24 * 7,
              },
              cacheableResponse: {
                statuses: [0, 200],
              },
            },
          },
          {
            urlPattern: /\/api\/auth\/user/i,
            handler: "NetworkFirst",
            options: {
              cacheName: "user-cache",
              expiration: {
                maxEntries: 1,
                maxAgeSeconds: 60 * 60,
              },
              cacheableResponse: {
                statuses: [0, 200],
              },
              networkTimeoutSeconds: 5,
            },
          },
          {
            urlPattern: /\/api\/.*/i,
            handler: "NetworkFirst",
            options: {
              cacheName: "api-cache",
              expiration: {
                maxEntries: 100,
                maxAgeSeconds: 60 * 10,
              },
              cacheableResponse: {
                statuses: [0, 200],
              },
              networkTimeoutSeconds: 5,
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
        ],
      },
      devOptions: {
        enabled: true,
        type: "module",
      },
    }),
  ],
  build: {
    chunkSizeWarningLimit: 1000,
    rollupOptions: {
      output: {
        manualChunks: getChunkStrategy,
        compact: true,
        experimentalMinChunkSize: 20000,
        chunkFileNames: "assets/[name]-[hash].js",
        assetFileNames: "assets/[name]-[hash][extname]",
      },
    },
    target: "es2020",
    minify: "esbuild",
    esbuild: {
      legalComments: "none",
    },
    sourcemap: false,
    cssCodeSplit: true,
    reportCompressedSize: true,
    modulePreload: {
      polyfill: true,
    },
  },
  server: {
    host: true,
    proxy: {
      "/api": {
        target: "http://localhost:3001",
        changeOrigin: true,
        ws: true,
        secure: false,
        configure: (proxy, _options) => {
          proxy.on("error", (err, _req, _res) => {
            console.log("proxy error", err);
          });
          proxy.on("proxyReq", (proxyReq, req, _res) => {
            console.log("Sending Request to the Target:", req.method, req.url);
          });
          proxy.on("proxyRes", (proxyRes, req, _res) => {
            console.log(
              "Received Response from the Target:",
              proxyRes.statusCode,
              req.url,
            );
          });
          proxy.on("proxyReqWs", (_proxyReq, req, _socket, _options, _head) => {
            console.log("WebSocket/SSE Proxy Request:", req.url);
          });
        },
      },
    },
  },
  test: {
    globals: true,
    environment: "jsdom",
    setupFiles: "./src/setupTests.ts",
    exclude: [
      "**/node_modules/**",
      "**/dist/**",
      "**/e2e/**",
      "**/.{idea,git,cache,output,temp}/**",
    ],
  },
});
