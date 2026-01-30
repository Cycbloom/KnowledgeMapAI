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
import { fileURLToPath } from 'url'
import authRoutes from './routes/auth.js'
import graphRoutes from './routes/graphs.js'
import nodeRoutes from './routes/nodes.js'
import aiRoutes from './routes/ai.js'
import studyRoutes from './routes/study.js'
import dataRoutes from './routes/data.js'

// for esm mode
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// load env
dotenv.config()

import { errorHandler } from './middleware/errorHandler.js'

const app: express.Application = express()

// Security Headers
app.use(helmet())

// Gzip Compression
app.use(compression())

// Rate Limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 1000, // limit each IP to 1000 requests per windowMs (approx 1 req/sec)
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
  message: { success: false, error: 'Too many requests, please try again later.' }
})
app.use('/api', limiter)

app.use(cors())
app.use(express.json({ limit: '10mb' }))
app.use(express.urlencoded({ extended: true, limit: '10mb' }))

/**
 * API Routes
 */
app.use('/api/auth', authRoutes)
app.use('/api/graphs', graphRoutes)
app.use('/api', nodeRoutes) // /api/nodes, /api/edges
app.use('/api/ai', aiRoutes)
app.use('/api/study', studyRoutes)
app.use('/api/data', dataRoutes)

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
