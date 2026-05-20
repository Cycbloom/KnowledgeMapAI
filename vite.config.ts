import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import tsconfigPaths from "vite-tsconfig-paths";
import { VitePWA } from "vite-plugin-pwa";

function getChunkStrategy(id: string): string | undefined {
  if (!id.includes("node_modules")) return undefined;

  if (
    id.includes("mermaid") ||
    id.includes("dagre") ||
    id.includes("graphlib") ||
    id.includes("elkjs") ||
    id.includes("d3-") ||
    id.includes("d3/") ||
    id.includes("katex") ||
    id.includes("cytoscape") ||
    id.includes("khroma") ||
    id.includes("dompurify") ||
    id.includes("dayjs") ||
    id.includes("mdast-util-from-markdown") ||
    id.includes("non-layered-tidy-tree-layout") ||
    id.includes("react-markdown") ||
    id.includes("remark-") ||
    id.includes("rehype-") ||
    id.includes("unified") ||
    id.includes("unist-") ||
    id.includes("mdast-") ||
    id.includes("micromark") ||
    id.includes("decode-named-character-reference") ||
    id.includes("lodash-es") ||
    id.includes("uuid") ||
    id.includes("web-worker")
  ) {
    return "vendor-mermaid";
  }

  if (id.includes("@react-three/drei")) return "vendor-three-drei";
  if (id.includes("@react-three/fiber")) return "vendor-three-fiber";
  if (id.includes("@react-three/postprocessing")) return "vendor-three-postprocessing";
  if (id.includes("three")) return "vendor-three-core";
  if (id.includes("postprocessing")) return "vendor-postprocessing";

  if (id.includes("recharts")) return "vendor-charts";

  if (id.includes("lucide-react")) return "vendor-lucide";
  if (id.includes("framer-motion")) return "vendor-framer";

  if (id.includes("@dnd-kit/core")) return "vendor-dnd-core";
  if (id.includes("@dnd-kit/sortable")) return "vendor-dnd-sortable";
  if (id.includes("@dnd-kit/utilities")) return "vendor-dnd-utils";

  if (id.includes("zustand")) return "vendor-zustand";
  if (id.includes("@tanstack/react-query")) return "vendor-react-query";

  if (id.includes("@supabase/supabase-js")) return "vendor-supabase-core";
  if (id.includes("@supabase")) return "vendor-supabase-utils";

  if (id.includes("openai")) return "vendor-openai";
  if (id.includes("zod")) return "vendor-zod";

  if (
    id.includes("react") ||
    id.includes("react-dom") ||
    id.includes("react-router") ||
    id.includes("scheduler") ||
    id.includes("react-") ||
    id.includes("@emotion") ||
    id.includes("stylis")
  ) {
    return "vendor-react";
  }

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

  return undefined;
}

const isElectronBuild = process.env.ELECTRON_BUILD === "true";

export default defineConfig({
  base: "./",
  esbuild: {
    legalComments: "none",
  },
  plugins: [
    react(),
    tsconfigPaths(),
    ...(!isElectronBuild
      ? [
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
        ]
      : []),
  ],
  build: {
    chunkSizeWarningLimit: 1500,
    rollupOptions: {
      onwarn(warning, warn) {
        if (warning.message.includes("Circular chunk")) {
          return;
        }
        warn(warning);
      },
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
            if (process.env.NODE_ENV === 'development') {
              console.debug("proxy error", err);
            }
          });
          proxy.on("proxyReq", (proxyReq, req, _res) => {
            if (process.env.NODE_ENV === 'development') {
              console.debug("Sending Request to the Target:", req.method, req.url);
            }
          });
          proxy.on("proxyRes", (proxyRes, req, _res) => {
            if (process.env.NODE_ENV === 'development') {
              console.debug(
                "Received Response from the Target:",
                proxyRes.statusCode,
                req.url,
              );
            }
          });
          proxy.on("proxyReqWs", (_proxyReq, req, _socket, _options, _head) => {
            if (process.env.NODE_ENV === 'development') {
              console.debug("WebSocket/SSE Proxy Request:", req.url);
            }
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
