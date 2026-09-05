import { defineConfig } from "vitest/config";
import { loadEnv } from "vite";

import react from "@vitejs/plugin-react";
import tsconfigPaths from "vite-tsconfig-paths";
import { getPwaPlugins } from "./vite.pwa";
import { visualizer } from "rollup-plugin-visualizer";

function getChunkStrategy(id: string): string | undefined {
  // 移动端构建：资源从设备本地存储加载，细粒度 vendor 拆分的并行下载/缓存收益为零。
  // 且拆分产生的 vendor-* chunk 间循环（vendor-react ↔ vendor-mermaid、vendor-charts ↔
  // vendor-react，见下方 onwarn 注释）在移动端入口的模块求值顺序下会以
  // "Cannot access 'z5' before initialization"（TDZ）形式在启动时崩溃——React 无法挂载，
  // App 永远停在 index.html 的静态 spinner（2026-09-05 实测）。故移动端把全部
  // node_modules 合并为单一 vendor chunk，从根上消除 chunk 间循环初始化。
  if (process.env.MOBILE_BUILD === "true") {
    if (id.includes("node_modules")) return "vendor";
    return undefined;
  }

  if (!id.includes("node_modules")) {
    return undefined;
  }

  // R16 Task 14: 拆分原 vendor-mermaid 巨型 chunk（937 KB gzip）为多个独立 chunk。
  // 顺序敏感：更具体的规则必须在 mermaid 通用规则之前，否则会被 mermaid 规则先匹配。
  // 拆分后即使运行时仍被同时加载（mermaid 内部 import d3/katex 等），也可并行下载。
  if (id.includes("katex")) return "vendor-katex";
  if (id.includes("cytoscape")) return "vendor-cytoscape";
  if (
    id.includes("react-markdown") ||
    id.includes("remark-") ||
    id.includes("rehype-") ||
    id.includes("unified") ||
    id.includes("unist-") ||
    id.includes("mdast-") ||
    id.includes("micromark") ||
    id.includes("decode-named-character-reference") ||
    id.includes("mdast-util-from-markdown")
  ) {
    return "vendor-markdown";
  }
  if (
    id.includes("d3-") ||
    id.includes("d3/") ||
    id.includes("dagre") ||
    id.includes("graphlib")
  ) {
    return "vendor-d3";
  }
  // R16 Task 14: 拆分 vendor-mermaid（2,321.89 kB）中的大型子依赖为独立 chunk。
  // 顺序敏感：这些规则必须在 vendor-mermaid 之前，否则会被 mermaid 通用规则先匹配。
  // dompurify 被 src/utils/sanitize.ts 直接使用，独立 chunk 可避免在 sanitize 时加载整个 mermaid。
  if (id.includes("dompurify")) return "vendor-dompurify";
  // @mermaid-js/parser 是 mermaid 的解析器子包，独立拆分可减少 vendor-mermaid 体积。
  if (id.includes("@mermaid-js/parser")) return "vendor-mermaid-parser";
  if (id.includes("es-toolkit")) return "vendor-mermaid-utils";
  if (id.includes("dayjs")) return "vendor-mermaid-date";
  if (id.includes("marked")) return "vendor-mermaid-marked";
  if (id.includes("@iconify/utils")) return "vendor-mermaid-icons";
  if (id.includes("roughjs")) return "vendor-mermaid-rough";
  if (id.includes("@upsetjs")) return "vendor-mermaid-venn";
  if (id.includes("@braintree/sanitize-url")) return "vendor-mermaid-url";
  if (id.includes("ts-dedent")) return "vendor-mermaid-dedent";

  if (
    id.includes("mermaid") ||
    id.includes("elkjs") ||
    id.includes("khroma") ||
    id.includes("non-layered-tidy-tree-layout") ||
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

  // R16 Task 4 + Task 6: react-syntax-highlighter 通过 React.lazy 动态加载，
  // 拆为独立 chunk 避免污染主 entry（且需在 react catch-all 之前匹配）。
  if (id.includes("react-syntax-highlighter")) return "vendor-syntax";

  if (id.includes("lucide-react")) return "vendor-lucide";
  if (id.includes("framer-motion")) return "vendor-framer";

  // Task 5: 从 vendor-react 中拆分 react-router-dom 为独立 chunk，
  // 减少 vendor-react 体积，使路由代码可独立缓存。
  if (id.includes("react-router")) return "vendor-router";

  // Task 5: 从 vendor-react 中拆分 @tiptap 编辑器生态为独立 chunk。
  // @tiptap/react 会匹配 vendor-react 的 "react-" 规则，必须在之前匹配。
  if (id.includes("@tiptap")) return "vendor-tiptap";

  // Task 5: 从 vendor-react 中拆分 i18next 国际化生态为独立 chunk。
  // react-i18next 会匹配 vendor-react 的 "react-" 规则，必须在之前匹配。
  if (id.includes("i18next")) return "vendor-i18n";

  // Task 5: 从 vendor-react 中拆分 @tanstack/react-virtual 为独立 chunk。
  if (id.includes("@tanstack/react-virtual")) return "vendor-virtual";

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

  // P6: 主入口瘦身——将静态打入主入口的启动依赖独立成 vendor chunk，
  // 减小主入口原始体积并改善缓存复用（vendor chunk 变更频率低，可独立缓存）。
  // 三者均为启动必需依赖，拆分不改变功能与加载时序。
  if (id.includes("localforage")) return "vendor-storage";
  if (id.includes("event-source-polyfill")) return "vendor-eventsource";
  if (id.includes("@capacitor")) return "vendor-capacitor";

  return undefined;
}

const isElectronBuild = process.env.ELECTRON_BUILD === "true";

/** Vite plugin: check required env vars on dev server start */
function checkEnvPlugin(): import("vite").Plugin {
  return {
    name: "check-env",
    configureServer(server) {
      server.httpServer?.once("listening", () => {
        // 用 loadEnv 读取 Vite 实际加载的 .env.* 文件（含优先级），而非 process.env。
        // process.env 不含 Vite 加载的变量，会导致误报。
        const env = loadEnv(
          server.config.mode ?? "development",
          server.config.envDir || process.cwd(),
          "",
        );
        const requiredVars = ["VITE_SUPABASE_URL", "VITE_SUPABASE_ANON_KEY"];
        let hasWarning = false;
        for (const name of requiredVars) {
          if (!env[name]) {
            console.warn(`  ⚠️  环境变量 ${name} 未设置 — 某些功能可能受限`);
            hasWarning = true;
          }
        }
        if (hasWarning) {
          console.warn("\n  ⚠️  部分环境变量缺失，但启动将继续\n");
        }
      });
    },
  };
}

export default defineConfig({
  base: "./",
  esbuild: {
    legalComments: "none",
  },
  plugins: [
    checkEnvPlugin(),
    react(),
    tsconfigPaths(),
    ...getPwaPlugins(isElectronBuild),
    // 视觉分析插件仅在显式开启时挂载（BUILD_ANALYZE=1 npm run build）。
    // 默认关闭：visualizer 的 gzipSize/brotliSize 会对每个 chunk 做压缩计算，
    // 是构建耗时的主要非必要开销之一，关闭可显著缩短常规构建时间。
    ...(process.env.BUILD_ANALYZE === "1"
      ? [
          visualizer({
            filename: "dist/stats.html",
            open: false,
            gzipSize: true,
            brotliSize: true,
            emitFile: false,
          }),
        ]
      : []),
  ],
  build: {
    chunkSizeWarningLimit: 1500,
    rollupOptions: {
      cache: true,
      // R16 Task 16: 抑制 Circular chunk 警告。
      // 已验证（2026-07-18）：放开抑制后 `vite build` 仅产生 2 条 Circular chunk 警告，
      // 均为 node_modules 第三方库 chunk 间循环，无 src/ 内部循环依赖：
      //   1. vendor-charts -> vendor-react -> vendor-charts
      //      recharts 与 react 生态（react-is / scheduler 等）相互引用，
      //      由 manualChunks 将 recharts 拆到独立 chunk 引起。
      //   2. vendor-react -> vendor-mermaid -> vendor-react
      //      mermaid 生态（含 react-markdown / remark-* / unified 等）与
      //      react 生态（@emotion / stylis / react-* 等）相互引用。
      // 这些循环在 Web 端入口下由 Rollup 通过 lazy module init 正确处理；
      // 但 2026-09-05 实测：移动端入口（MOBILE_BUILD）下该循环会导致启动期 TDZ 崩溃
      // （"Cannot access 'z5' before initialization"），已通过移动端分支的单一 vendor
      // chunk 规避（见 getChunkStrategy）。修复需合并 chunk（与 Task 14 bundle 拆分目标冲突）或重构第三方库（不可行），
      // 故保留抑制。详见 .trae/specs/polish-ux-r16-perf-bundle-slimming/tasks.md Task 16。
      onwarn(warning, warn) {
        if (warning.message.includes("Circular chunk")) {
          return;
        }
        warn(warning);
      },
      output: {
        manualChunks: getChunkStrategy,
        compact: true,
        // P7: 20000 会把 React.lazy 的小型 web-only 壳层组件（SyncStatusBadge、
        // ConflictResolutionDialog、UpdatePrompt、OfflineSyncProgress、CelebrationOverlay）
        // 并回主入口 chunk，使懒加载失效。调低阈值让这些按需组件真正拆分为独立 chunk，
        // 从首屏主入口移除其代码。仍会合并更小的碎片 chunk，避免产生过多请求。
        experimentalMinChunkSize: 5000,
        chunkFileNames: "assets/[name]-[hash].js",
        assetFileNames: "assets/[name]-[hash][extname]",
      },
    },
    target: "es2020",
    minify: "esbuild",
    sourcemap: false,
    cssCodeSplit: true,
    // 常规构建关闭压缩体积报告：reportCompressedSize 会对每个 chunk 计算 gzip 体积，
    // 是构建耗时的主要非必要开销之一。需要查看 gzip/brotli 体积时用
    // `BUILD_ANALYZE=1 npm run build`（visualizer 会一并输出压缩体积）。
    reportCompressedSize: process.env.BUILD_ANALYZE === "1",
    modulePreload: {
      polyfill: true,
    },
  },
  server: {
    host: true,
    watch: {
      usePolling: true,
    },
    proxy: {
      "/api": {
        // 允许通过 API_PROXY_TARGET 环境变量覆盖代理目标（Docker 容器内使用 http://backend:3001）。
        // 本地开发默认使用 localhost:3001。
        target: process.env.API_PROXY_TARGET || `http://localhost:${process.env.API_PORT || '3001'}`,
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
});
