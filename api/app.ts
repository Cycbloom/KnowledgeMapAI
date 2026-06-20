/**
 * This is a API server
 */

import express, { type Request, type Response } from "express";
import "express-async-errors";
import cors from "cors";
import helmet from "helmet";
import compression from "compression";
import cookieParser from "cookie-parser";
import { Kernel } from "./services/kernel/Kernel";
import { startAutoBackupScheduler } from "./jobs/autoBackupScheduler";
import { syncExistingBackups } from "./services/common/backupSyncService";
import { graphTaskEventHandler } from "./services/scheduler/graphTaskEventHandler";

import { errorHandler } from "./middleware/errorHandler";
import { csrfProtection, getCsrfToken } from "./middleware/csrf";
import { rateLimiters } from "./middleware/rateLimiter";
import { requestLogger, slowRequestLogger } from "./middleware/requestLogger";
import { requestIdMiddleware } from "./middleware/requestId";
import { logger } from "./utils/logger";

const app: express.Application = express();

const kernel = new Kernel();

function applyKernelRoutes(app: express.Application, kernel: Kernel): void {
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

app.use(requestIdMiddleware);

app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));
app.use(cookieParser());

// Security Headers
app.use(helmet());

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
  process.env.FRONTEND_URL,
].filter(Boolean) as string[];

const isVercelOrigin = (origin: string): boolean => {
  return (
    origin.endsWith(".vercel.app") ||
    origin.includes(".vercel.app") ||
    /^https?:\/\/[a-z0-9-]+\.vercel\.app$/i.test(origin)
  );
};

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin) return callback(null, true);

      if (isVercelOrigin(origin)) {
        return callback(null, true);
      }

      if (
        allowedOrigins.indexOf(origin) !== -1 ||
        !process.env.NODE_ENV ||
        process.env.NODE_ENV === "development"
      ) {
        callback(null, true);
      } else {
        logger.warn("CORS blocked origin", { origin, allowedOrigins });
        callback(new Error("Not allowed by CORS"));
      }
    },
    credentials: true,
  }),
);

app.use(csrfProtection);

app.use(requestLogger);
app.use(slowRequestLogger(2000));

app.get("/api/csrf-token", getCsrfToken);

/**
 * API Routes - All routes are registered through the Kernel plugin system
 */
applyKernelRoutes(app, kernel);

startAutoBackupScheduler();
syncExistingBackups();
graphTaskEventHandler.initialize();

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
    error: "API not found",
  });
});

export default app;
export { kernel };
