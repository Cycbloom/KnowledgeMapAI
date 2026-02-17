/**
 * This is a API server
 */

import express, {
  type Request,
  type Response,
  type NextFunction,
} from 'express'
import 'express-async-errors'
import cors from 'cors'
import path from 'path'
import dotenv from 'dotenv'
import helmet from 'helmet'
import compression from 'compression'
import cookieParser from 'cookie-parser'
import { fileURLToPath } from 'url'
import redisClient from './utils/redis.js'
import authRoutes from './routes/auth.js'
import graphRoutes from './routes/graphs.js'
import nodeRoutes from './routes/nodes.js'
import aiRoutes from './routes/ai.js'
import studyRoutes from './routes/study.js'
import dataRoutes from './routes/data.js'
import dashboardRoutes from './routes/dashboard.js'
import taskRoutes from './routes/tasks.js'
import statisticsRoutes from './routes/statistics.js'
import searchRoutes from './routes/search.js'
import templateRoutes from './routes/templates.js'
import promptRoutes from './routes/prompts.js'
import aiActionRoutes from './routes/aiActions.js'
import focusRoutes from './routes/focus.js'
import achievementRoutes from './routes/achievements.js'
import ragRoutes from './routes/rag.js'
import autoGraphRoutes from './routes/autoGraph.js'
import learningPathRoutes from './routes/learningPath.js'
import graphRelationsRoutes from './routes/graphRelations.js'
import healthRoutes from './routes/health.js'
import analyticsRoutes from './routes/analytics.js'
import alertsRoutes from './routes/alerts.js'
import systemMonitorRoutes from './routes/systemMonitor.js'
import swaggerUi from 'swagger-ui-express'
import { swaggerSpec } from './docs/swagger.js'

// for esm mode
const _filename = fileURLToPath(import.meta.url)
const _dirname = path.dirname(_filename)

// load env
dotenv.config()

import { errorHandler } from './middleware/errorHandler.js'
import { csrfProtection, getCsrfToken } from './middleware/csrf.js'
import { rateLimiters } from './middleware/rateLimiter.js'
import { requestLogger, slowRequestLogger } from './middleware/requestLogger.js'
import { logger } from './utils/logger.js'

const app: express.Application = express()

app.use(express.json({ limit: '10mb' }))
app.use(express.urlencoded({ extended: true, limit: '10mb' }))
app.use(cookieParser())

// Security Headers
app.use(helmet())

// Gzip Compression
app.use(compression({
  level: 6, // Balanced setting
  threshold: 1024, // Only compress responses larger than 1KB
  filter: (req, res) => {
    if (req.headers['x-no-compression']) {
      // don't compress responses with this request header
      return false
    }
    // fallback to standard filter function
    return compression.filter(req, res)
  }
}))

// Trust Proxy (Required for correct IP rate limiting behind proxies like Vercel/Nginx)
app.set('trust proxy', 1);

// CORS Configuration
const allowedOrigins = [
  'http://localhost:5173',
  'http://localhost:4173', // Vite preview
  process.env.FRONTEND_URL
].filter(Boolean) as string[];

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);
    if (allowedOrigins.indexOf(origin) !== -1 || !process.env.NODE_ENV || process.env.NODE_ENV === 'development') {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true
}))

app.use(csrfProtection)

app.use(requestLogger)
app.use(slowRequestLogger(2000))

app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec))
app.get('/api/csrf-token', getCsrfToken)

app.use('/api/auth', rateLimiters.auth, authRoutes)
app.use('/api/ai', rateLimiters.ai, aiRoutes)

/**
 * API Routes
 */
app.use('/api/auth', rateLimiters.auth, authRoutes)
app.use('/api/graphs', graphRelationsRoutes)
app.use('/api/graphs', graphRoutes)
app.use('/api', nodeRoutes)
app.use('/api/ai', rateLimiters.ai, aiRoutes)
app.use('/api/study', studyRoutes)
app.use('/api/data', dataRoutes)
app.use('/api/dashboard', dashboardRoutes)
app.use('/api/tasks', taskRoutes)
app.use('/api/statistics', statisticsRoutes)
app.use('/api/search', searchRoutes)
app.use('/api/templates', templateRoutes)
app.use('/api/prompts', promptRoutes)
app.use('/api/ai-actions', aiActionRoutes)
app.use('/api/focus', focusRoutes)
app.use('/api/achievements', achievementRoutes)
app.use('/api/rag', ragRoutes)
app.use('/api/auto-graph', rateLimiters.aiHeavy, autoGraphRoutes)
app.use('/api/learning-path', learningPathRoutes)
app.use('/api/health', healthRoutes)
app.use('/api/analytics', analyticsRoutes)
app.use('/api/alerts', alertsRoutes)
app.use('/api/system-monitor', systemMonitorRoutes)

/**
 * health
 */
app.use(
  '/api/health',
  (req: Request, res: Response, next: NextFunction): void => {
    res.status(200).json({
      success: true,
      message: 'ok',
    })
  },
)

/**
 * error handler middleware
 */
app.use(errorHandler)

/**
 * 404 handler
 */
app.use((req: Request, res: Response) => {
  res.status(404).json({
    success: false,
    error: 'API not found',
  })
})

export default app
