import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import tsconfigPaths from "vite-tsconfig-paths";
import { traeBadgePlugin } from 'vite-plugin-trae-solo-badge';
import { VitePWA } from 'vite-plugin-pwa';

function getChunkStrategy(id: string): string | undefined {
  if (!id.includes('node_modules')) return undefined;

  if (id.includes('mermaid')) {
    return 'vendor-mermaid';
  }

  if (id.includes('dagre') || id.includes('graphlib') || id.includes('elkjs')) {
    return 'vendor-mermaid';
  }

  if (id.includes('katex')) return 'vendor-katex';

  if (id.includes('react-markdown') || id.includes('remark-') || id.includes('rehype-') || 
      id.includes('unified') || id.includes('unist-') || id.includes('mdast-') || 
      id.includes('micromark') || id.includes('decode-named-character-reference')) {
    return 'vendor-markdown';
  }

  if (id.includes('@react-three') || id.includes('three') || id.includes('postprocessing')) {
    return 'vendor-three';
  }

  if (id.includes('recharts')) return 'vendor-charts';

  if (id.includes('d3-')) return 'vendor-d3';

  if (id.includes('lucide-react') || id.includes('framer-motion')) return 'vendor-ui';
  if (id.includes('@dnd-kit')) return 'vendor-dnd';

  if (id.includes('zustand') || id.includes('@tanstack/react-query')) return 'vendor-state';

  if (id.includes('@supabase')) return 'vendor-supabase';

  if (id.includes('openai') || id.includes('zod')) return 'vendor-ai';

  if (id.includes('react') || id.includes('react-dom') || id.includes('react-router') || id.includes('scheduler')) {
    return 'vendor-react';
  }

  if (id.includes('react-')) return 'vendor-react-ecosystem';

  if (id.includes('clsx') || id.includes('tailwind-merge') || id.includes('axios') || id.includes('comlink')) {
    return 'vendor-utils';
  }

  if (id.includes('html2canvas')) return 'vendor-export';
  if (id.includes('ts-fsrs')) return 'vendor-fsrs';
  if (id.includes('cheerio')) return 'vendor-parser';
  if (id.includes('bullmq') || id.includes('ioredis')) return 'vendor-queue';

  return undefined;
}

export default defineConfig({
  plugins: [
    react(),
    traeBadgePlugin({
      variant: 'dark',
      position: 'bottom-right',
      prodOnly: true,
      clickable: true,
      clickUrl: 'https://www.trae.ai/solo?showJoin=1',
      autoTheme: true,
      autoThemeTarget: '#root'
    }), 
    tsconfigPaths(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'robots.txt'],
      manifest: {
        name: 'Knowledge Map AI',
        short_name: 'KnowledgeMap',
        description: 'AI-powered Knowledge Graph Editor',
        theme_color: '#ffffff',
        background_color: '#ffffff',
        display: 'standalone',
        icons: [
          {
            src: 'favicon.svg',
            sizes: '192x192',
            type: 'image/svg+xml',
            purpose: 'any maskable'
          },
          {
            src: 'favicon.svg',
            sizes: '512x512',
            type: 'image/svg+xml',
            purpose: 'any maskable'
          }
        ]
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff,woff2}'],
        maximumFileSizeToCacheInBytes: 4 * 1024 * 1024,
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-fonts-cache',
              expiration: {
                maxEntries: 10,
                maxAgeSeconds: 60 * 60 * 24 * 365
              },
              cacheableResponse: {
                statuses: [0, 200]
              }
            }
          },
          {
            urlPattern: /^https:\/\/fonts\.gstatic\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'gstatic-fonts-cache',
              expiration: {
                maxEntries: 10,
                maxAgeSeconds: 60 * 60 * 24 * 365
              },
              cacheableResponse: {
                statuses: [0, 200]
              }
            }
          },
          {
            urlPattern: /\/api\/.*/i,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'api-cache',
              expiration: {
                maxEntries: 50,
                maxAgeSeconds: 60 * 5
              },
              cacheableResponse: {
                statuses: [0, 200]
              }
            }
          }
        ]
      }
    })
  ],
  build: {
    chunkSizeWarningLimit: 1000,
    rollupOptions: {
      output: {
        manualChunks: getChunkStrategy,
        compact: true,
        experimentalMinChunkSize: 20000,
        chunkFileNames: 'assets/[name]-[hash].js',
        assetFileNames: 'assets/[name]-[hash][extname]',
      },
    },
    target: 'es2020',
    minify: 'esbuild',
    esbuild: {
      drop: ['console', 'debugger'],
      legalComments: 'none',
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
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
        ws: true,
        secure: false,
        configure: (proxy, _options) => {
          proxy.on('error', (err, _req, _res) => {
            console.log('proxy error', err);
          });
          proxy.on('proxyReq', (proxyReq, req, _res) => {
            console.log('Sending Request to the Target:', req.method, req.url);
          });
          proxy.on('proxyRes', (proxyRes, req, _res) => {
            console.log('Received Response from the Target:', proxyRes.statusCode, req.url);
          });
          proxy.on('proxyReqWs', (_proxyReq, req, _socket, _options, _head) => {
            console.log('WebSocket/SSE Proxy Request:', req.url);
          });
        },
      }
    }
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './src/setupTests.ts',
  },
})
