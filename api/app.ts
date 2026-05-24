/**
 * This is a API server
 */

import express, { type Request, type Response } from "express";
import "express-async-errors";
import cors from "cors";
import helmet from "helmet";
import compression from "compression";
import cookieParser from "cookie-parser";
import authRoutes from "./routes/auth";
import graphRoutes from "./routes/graphs";
import nodeRoutes from "./routes/nodes";
import aiRoutes from "./routes/ai";
import studyRoutes from "./routes/study";
import practiceSessionRoutes from "./routes/study/practiceSessions";
import quizSessionRoutes from "./routes/study/quizSessions";
import dataRoutes from "./routes/data";
import dashboardRoutes from "./routes/dashboard";
import taskRoutes from "./routes/tasks";
import statisticsRoutes from "./routes/statistics";
import searchRoutes from "./routes/search";
import templateRoutes from "./routes/templates";
import promptRoutes from "./routes/prompts";
import aiActionRoutes from "./routes/aiActions";
import achievementRoutes from "./routes/achievements";
import periodicTaskRoutes from "./routes/periodicTasks";
import ragRoutes from "./routes/rag";
import autoGraphRoutes from "./routes/autoGraph";
import learningPathRoutes from "./routes/learningPath";
import learningPathsRoutes from "./routes/learningPaths";
import graphRelationsRoutes from "./routes/graphRelations";
import healthRoutes from "./routes/health";
import analyticsRoutes from "./routes/analytics";
import alertsRoutes from "./routes/alerts";
import systemMonitorRoutes from "./routes/systemMonitor";
import backupRoutes from "./routes/backup";
import knowledgePointRoutes from "./routes/knowledgePoints";
import graphNodesRoutes from "./routes/graphNodes";
import combinedViewRoutes from "./routes/combinedView";
import schedulerRoutes from "./routes/scheduler/index";
import notificationRoutes from "./routes/notifications";
import relationshipTypesRoutes from "./routes/relationshipTypes";
import calendarRoutes from "./routes/calendar";
import quizSetRoutes from "./routes/quizSets";
import collaboratorRoutes from "./routes/collaborators";
import agentRoutes from "./routes/agent";
import domainRoutes from "./routes/domains";
import pluginsRoutes from "./routes/plugins";
import databaseRoutes from "./routes/database";
import supabaseRoutes from "./routes/supabase";
import literatureRoutes from "./routes/literature";
import regionRoutes from "./routes/regions";
import { startAutoBackupScheduler } from "./jobs/autoBackupScheduler";
import { syncExistingBackups } from "./services/common/backupSyncService";
import { Kernel } from "./services/kernel/Kernel";
import { registerCoreEventTypes } from "./services/kernel/coreEvents";
import { graphTaskEventHandler } from "./services/scheduler/graphTaskEventHandler";

import { errorHandler } from "./middleware/errorHandler";
import { csrfProtection, getCsrfToken } from "./middleware/csrf";
import { rateLimiters } from "./middleware/rateLimiter";
import { requestLogger, slowRequestLogger } from "./middleware/requestLogger";
import { requestIdMiddleware } from "./middleware/requestId";
import { logger } from "./utils/logger";

const app: express.Application = express();

const kernel = new Kernel();
registerCoreEventTypes(kernel);

function applyKernelRoutes(app: express.Application, kernel: Kernel): void {
  const routes = kernel.getRegisteredRoutes();
  const rateLimiterMap: Record<string, express.RequestHandler> = {
    auth: rateLimiters.auth,
    ai: rateLimiters.ai,
    aiHeavy: rateLimiters.aiHeavy,
    general: rateLimiters.general,
    write: rateLimiters.write,
  };

  for (const [, entry] of routes) {
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
    level: 6, // Balanced setting
    threshold: 1024, // Only compress responses larger than 1KB
    filter: (req, res) => {
      if (req.headers["x-no-compression"]) {
        // don't compress responses with this request header
        return false;
      }
      // fallback to standard filter function
      return compression.filter(req, res);
    },
  }),
);

// Trust Proxy (Required for correct IP rate limiting behind proxies like Vercel/Nginx)
app.set("trust proxy", 1);

// CORS Configuration
const allowedOrigins = [
  "http://localhost:5173",
  "http://localhost:4173", // Vite preview
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
      // Allow requests with no origin (like mobile apps or curl requests)
      if (!origin) return callback(null, true);

      // Allow Vercel preview deployments
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

// app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec));
app.get("/api/csrf-token", getCsrfToken);

/**
 * API Routes
 */
app.use("/api/auth", rateLimiters.auth, authRoutes);
app.use("/api/graphs", graphRoutes);
app.use("/api/graphs", graphRelationsRoutes);
app.use("/api/domains", domainRoutes);
app.use("/api", nodeRoutes);
app.use("/api/ai", rateLimiters.ai, aiRoutes);
app.use("/api/study", studyRoutes);
app.use("/api/study/practice-sessions", practiceSessionRoutes);
app.use("/api/study/quiz-sessions", quizSessionRoutes);
app.use("/api/data", dataRoutes);
app.use("/api/dashboard", dashboardRoutes);
app.use("/api/tasks", taskRoutes);
app.use("/api/statistics", statisticsRoutes);
app.use("/api/search", searchRoutes);
app.use("/api/templates", templateRoutes);
app.use("/api/prompts", promptRoutes);
app.use("/api/ai-actions", aiActionRoutes);
app.use("/api/achievements", achievementRoutes);
app.use("/api/periodic-tasks", periodicTaskRoutes);
app.use("/api/rag", ragRoutes);
app.use("/api/auto-graph", rateLimiters.aiHeavy, autoGraphRoutes);
app.use("/api/learning-path", learningPathRoutes);
app.use("/api/learning-paths", learningPathsRoutes);
app.use("/api/health", healthRoutes);
app.use("/api/analytics", analyticsRoutes);
app.use("/api/alerts", alertsRoutes);
app.use("/api/system-monitor", systemMonitorRoutes);
app.use("/api/backup", backupRoutes);
app.use("/api/knowledge-points", knowledgePointRoutes);
app.use("/api/graph-nodes", graphNodesRoutes);
app.use("/api/combined-view", combinedViewRoutes);
app.use("/api/scheduler", schedulerRoutes);
app.use("/api/notifications", notificationRoutes);
app.use("/api/relationship-types", relationshipTypesRoutes);
app.use("/api/calendar", calendarRoutes);
app.use("/api/collaborations", collaboratorRoutes);
app.use("/api/agent", agentRoutes);
app.use("/api", quizSetRoutes);
app.use("/api/plugins", pluginsRoutes);
app.use("/api/database", databaseRoutes);
app.use("/api/supabase", supabaseRoutes);
app.use("/api/literature", rateLimiters.aiHeavy, literatureRoutes);
app.use("/api/graphs/:graphId/regions", regionRoutes);

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
