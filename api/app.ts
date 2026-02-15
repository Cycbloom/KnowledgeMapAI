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
import rateLimit from 'express-rate-limit'
import { RedisStore } from 'rate-limit-redis'
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
import battleRoutes from './routes/battles.js'
import healthRoutes from './routes/health.js'
import collaborationRoutes from './routes/collaboration.js'
import swaggerUi from 'swagger-ui-express'
import { swaggerSpec } from './docs/swagger.js'

// for esm mode
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// load env
dotenv.config()

import { errorHandler } from './middleware/errorHandler.js'
import { logger } from './utils/logger.js'

const app: express.Application = express()

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

// Rate Limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 1000, // limit each IP to 1000 requests per windowMs (approx 1 req/sec)
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
  store: redisClient ? new RedisStore({
    // @ts-expect-error - Known issue with types compatibility
    sendCommand: (...args: string[]) => redisClient!.call(...args),
  }) : undefined,
  message: { success: false, error: 'Too many requests, please try again later.' }
})
app.use('/api', limiter)

// AI Rate Limiting (Stricter)
const aiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 50, // limit each IP to 50 requests per windowMs
  standardHeaders: true,
  legacyHeaders: false,
  store: redisClient ? new RedisStore({
    // @ts-expect-error
    sendCommand: (...args: string[]) => redisClient!.call(...args),
    prefix: 'rl:ai:'
  }) : undefined,
  message: { success: false, error: 'AI request quota exceeded, please try again later.' }
})

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
app.use(express.json({ limit: '10mb' }))
app.use(express.urlencoded({ extended: true, limit: '10mb' }))

app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec))

/**
 * API Routes
 */
app.use('/api/auth', authRoutes)
app.use('/api/graphs', graphRoutes)
app.use('/api', nodeRoutes) // /api/nodes, /api/edges
app.use('/api/ai', aiLimiter, aiRoutes)
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
app.use('/api/auto-graph', aiLimiter, autoGraphRoutes)
app.use('/api/learning-path', learningPathRoutes)
app.use('/api/battles', battleRoutes)
app.use('/api/health', healthRoutes)
app.use('/api/collaboration', collaborationRoutes)

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
