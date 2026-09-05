/**
 * This is a API server
 */

import express, { type Request, type Response } from "express";
import path from "node:path";
import "express-async-errors";
import cors from "cors";
import helmet from "helmet";
import compression from "compression";
import cookieParser from "cookie-parser";
import "./supabase";
import "./utils/i18n";
import { type Kernel } from "./services/kernel/Kernel";
import { bootstrapKernel } from "./services/kernel/bootstrap";
import { startAutoBackupScheduler } from "./jobs/autoBackupScheduler";
import { syncExistingBackups } from "./services/common/backupSyncService";
import { graphTaskEventHandler } from "./services/scheduler/graphTaskEventHandler";
import { asyncTaskService } from "./services/asyncTaskService";

import { errorHandler } from "./middleware/errorHandler";
import { csrfProtection, getCsrfToken } from "./middleware/csrf";
import { rateLimiters } from "./middleware/rateLimiter";
import { requestLogger, slowRequestLogger } from "./middleware/requestLogger";
import { requestIdMiddleware } from "./middleware/requestId";
import { logger } from "./utils/logger";

export function applyKernelRoutes(app: express.Application, kernel: Kernel): void {
  const routes = kernel.getRegisteredRoutes();
  const rateLimiterMap: Record<string, express.RequestHandler> = {
    auth: rateLimiters.auth,
    ai: rateLimiters.ai,
    aiHeavy: rateLimiters.aiHeavy,
    general: rateLimiters.general,
    write: rateLimiters.write,
  };

  for (const entry of routes) {
    const middleware: express.RequestHandler[] = [];

    if (entry.options?.rateLimiter) {
      const limiter = rateLimiterMap[entry.options.rateLimiter];
      if (limiter) {
        middleware.push(limiter);
      }
    }

    if (entry.options?.middleware) {
      middleware.push(...entry.options.middleware);
    }

    if (middleware.length > 0) {
      app.use(entry.prefix, ...middleware, entry.router);
    } else {
      app.use(entry.prefix, entry.router);
    }
  }
}

/**
 * Express 应用工厂。
 *
 * 传入 `kernel` 时，插件路由会被挂载且后台任务（自动备份、备份同步、图任务事件
 * 处理器）会被启动 —— 这是生产路径。传入 `undefined` 时返回的 app 不挂载任何
 * 插件路由、不启动后台任务，供测试用例进行隔离测试。
 *
 * 模块底部的单例通过 `bootstrapKernel()` 构造 Kernel 并调用本工厂，因此
 * `server.ts` 与 `electron/main.ts` 通过动态 import 拿到的 `default` 仍是
 * 完整初始化的 app 实例。
 */
export function createApp(kernel?: Kernel): express.Express {
  const app = express();

  app.use(requestIdMiddleware);

  app.use(express.json({ limit: "10mb" }));
  app.use(express.urlencoded({ extended: true, limit: "10mb" }));
  app.use(cookieParser());

  // Security Headers with Content Security Policy
  const isDev = process.env.NODE_ENV === "development";
  const supabaseUrl = process.env.VITE_SUPABASE_URL;

  app.use(
    helmet({
      contentSecurityPolicy: {
        reportOnly: false,
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: [
            "'self'",
            ...(isDev ? ["'unsafe-inline'"] : []),
          ],
          styleSrc: ["'self'", "'unsafe-inline'"],
          imgSrc: ["'self'", "data:", "blob:"],
          connectSrc: [
            "'self'",
            ...(supabaseUrl ? [supabaseUrl] : []),
            ...(isDev ? ["ws://localhost:5173", "http://localhost:5173"] : []),
          ],
          fontSrc: ["'self'"],
          objectSrc: ["'none'"],
          frameAncestors: ["'none'"],
          baseUri: ["'self'"],
          formAction: ["'self'"],
          "report-uri": ["/api/v1/csp-violation"],
        },
      },
    }),
  );

  // Gzip Compression
  app.use(
    compression({
      level: 6,
      threshold: 1024,
      filter: (req, res) => {
        if (req.headers["x-no-compression"]) {
          return false;
        }
        return compression.filter(req, res);
      },
    }),
  );

  // Trust Proxy
  app.set("trust proxy", 1);

  // CORS Configuration
  const allowedOrigins = [
    "http://localhost:5173",
    "http://localhost:4173",
    // Capacitor WebView 源：Android 端 androidScheme 为 https，页面源是 https://localhost；
    // iOS 端默认页面源是 capacitor://localhost。移动端 App 以 Bearer 头鉴权并携带
    // x-mobile-client 头（CSRF 中间件对其豁免），放行其跨域请求。
    "https://localhost",
    "capacitor://localhost",
    process.env.FRONTEND_URL,
  ].filter(Boolean) as string[];

  // Strict CORS allowlist: only local dev origins and explicit FRONTEND_URL.
  const LOCALHOST_REGEX = /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/;

  const isAllowedOrigin = (origin: string): boolean => {
    if (LOCALHOST_REGEX.test(origin)) {
      return true;
    }
    return allowedOrigins.indexOf(origin) !== -1;
  };

  app.use(
    cors({
      origin: (origin, callback) => {
        // No Origin header (same-origin / non-browser clients): allow.
        if (!origin) return callback(null, true);

        if (isAllowedOrigin(origin)) {
          return callback(null, true);
        }

        logger.warn("CORS blocked origin", { origin, allowedOrigins });
        callback(new Error("Not allowed by CORS"));
      },
      credentials: true,
    }),
  );

  app.use(csrfProtection);

  app.use(requestLogger);
  app.use(slowRequestLogger(2000));

  // 静态文件:笔记图片上传后落盘到 public/uploads/notes/,
  // 通过 /uploads/notes/{filename} 直接访问(express.static 不走 CSRF / 限流,
  // 与 API 路由隔离;目录由 multer 在上传时按需创建)。
  app.use(
    "/uploads",
    express.static(path.join(process.cwd(), "public", "uploads"), {
      maxAge: "7d",
      fallthrough: true,
    }),
  );

  app.get("/api/v1/csrf-token", getCsrfToken);

  // CSP violation report endpoint
  app.post("/api/v1/csp-violation", (req, res) => {
    logger.warn("CSP violation reported", { report: req.body });
    res.status(204).end();
  });

  if (kernel) {
    /**
     * API Routes - All routes are registered through the Kernel plugin system.
     * applyKernelRoutes is called after middleware setup to ensure all middleware
     * applies to plugin routes.
     */
    applyKernelRoutes(app, kernel);

    startAutoBackupScheduler();
    syncExistingBackups();
    graphTaskEventHandler.initialize();

    // 启动恢复：恢复因进程崩溃/重启而滞留的 pending 任务（非阻塞）
    asyncTaskService.initialize().catch((err) => {
      logger.error("Failed to initialize asyncTaskService during startup:", err);
    });
  }

  /**
   * error handler middleware
   */
  app.use(errorHandler);

  /**
   * 404 handler
   */
  app.use((_req: Request, res: Response) => {
    res.status(404).json({
      success: false,
      code: "NOT_FOUND",
      message: "API not found",
      requestId: _req.requestId ?? "unknown",
      timestamp: new Date().toISOString(),
    });
  });

  return app;
}

// Module-level singleton: bootstrap a fully-initialized Kernel and construct the
// production app for `server.ts` and `electron/main.ts` (which dynamically
// imports this module). Tests should import `createApp` directly and pass
// `undefined` (or a stub Kernel) to avoid these side effects.
const kernel = bootstrapKernel();
const app = createApp(kernel);

export default app;
export { kernel };
