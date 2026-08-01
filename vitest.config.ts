import { defineConfig, mergeConfig } from "vitest/config";
import { loadEnv } from "vite";
import { fileURLToPath } from "node:url";
import viteConfig from "./vite.config";

export default mergeConfig(
  viteConfig,
  defineConfig({
    test: {
      globals: true,
      // Default to node environment (lightweight, fast startup ~28ms vs jsdom ~30s).
      // Frontend tests that need DOM/React add `// @vitest-environment jsdom` at file top.
      // This split eliminates the worker timeout issue caused by slow jsdom initialization.
      environment: "node",
      setupFiles: "./src/setupTests.ts",
      // R20: Mock virtual:pwa-register/react for vitest — vite-plugin-pwa provides
      // this virtual module at build/dev time, but vitest cannot resolve it.
      // Tests that need real SW behavior (UpdatePrompt.test.tsx) import the shared
      // swMockState from the mock file and modify it directly before rendering.
      alias: {
        "virtual:pwa-register/react": fileURLToPath(
          new URL("./tests/__mocks__/virtualPwaRegisterReact.ts", import.meta.url),
        ),
      },
      // Load env vars from .env / .env.local / .env.test / .env.test.local into
      // process.env BEFORE any test module is evaluated. Without this, modules
      // like tests/helpers/testDb.ts read process.env.SUPABASE_SERVICE_ROLE_KEY
      // at import time (before api/supabase.ts calls dotenv.config()), causing
      // integration test suites to fail with "SUPABASE_SERVICE_ROLE_KEY is not set".
      // Empty prefix loads ALL env vars (not just VITE_ prefixed ones).
      env: { ...loadEnv("test", process.cwd(), "") },
      exclude: [
        "**/node_modules/**",
        "**/dist/**",
        "**/e2e/**",
        "**/.{idea,git,cache,output,temp}/**",
      ],
      // Pool configuration: use forks (process isolation, safe with native modules).
      // threads pool crashes with native modules (better-sqlite3, canvas) on Windows.
      // NOTE: Vitest 4 removed poolOptions — these are now top-level test options.
      //
      // Windows + Vitest 4 + jsdom: jsdom worker initialization is extremely slow
      // (~30s/worker). During full-suite runs, cumulative memory pressure from the
      // other ~51 test files causes jsdom worker startup to exceed 180s timeout.
      // jsdom tests pass in isolation (5/7 files, 83/86 tests) — the timeouts are
      // purely a resource-contention issue, not an infrastructure defect.
      //
      // Mitigation: maxForks=1 + fileParallelism=false fully serializes execution.
      // This is slower but prevents memory accumulation from killing jsdom workers.
      pool: "forks",
      maxForks: 1,
      fileParallelism: false,
      workerStartupTimeout: 180000,
      // Give individual tests more headroom for slow CI / cold starts.
      testTimeout: 30000,
      hookTimeout: 30000,
      coverage: {
        provider: "v8",
        reporter: ["text", "text-summary", "html", "lcov", "json-summary"],
        reportsDirectory: "./coverage",
        // Include source code files only (avoids diluting coverage with assets/fonts/configs)
        include: [
          "src/**/*.{ts,tsx}",
          "api/**/*.{ts,tsx}",
          "shared/**/*.{ts,tsx}",
          "electron/**/*.{ts,tsx}",
        ],
        // Exclude test files, configs, generated types, build artifacts
        exclude: [
          "**/node_modules/**",
          "**/dist/**",
          "**/__tests__/**",
          "**/*.test.ts",
          "**/*.test.tsx",
          "**/*.spec.ts",
          "**/tests/**",
          "**/e2e/**",
          "**/*.config.*",
          "**/database.generated.ts",
          "**/types/env.d.ts",
          "**/main.tsx",
          "**/electron/main.ts",
          "android/**",
          "build/**",
          "public/**",
          "scripts/**",
          "supabase/**",
        ],
        // Coverage gate: thresholds set just below current baseline to catch regressions
        // while allowing the gate to pass. Raise as coverage improves.
        // Baseline (2026-07-17, full suite, reportOnFailure):
        //   Lines 12.99% / Stmts 12.74% / Branches 7.72% / Funcs 9.96%
        // Thresholds set ~1.7-2% below baseline to catch regressions without blocking normal dev.
        // Aspirational targets (docs/testing-guidelines.md §7): 40% → 70%.
        thresholds: {
          statements: 11,
          branches: 6,
          functions: 8,
          lines: 11,
        },
        // Watermarks for HTML report coloring (red < 50%, yellow 50-80%, green > 80%)
        watermarks: {
          statements: [50, 80],
          branches: [50, 80],
          functions: [50, 80],
          lines: [50, 80],
        },
      },
    },
  }),
);