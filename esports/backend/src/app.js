import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import { config } from './config/index.js'
import { csrfMiddleware } from './middleware/csrf.middleware.js'
import { errorHandler } from './middleware/errorHandler.js'
import routes from './routes/index.js'

export function createApp() {
  const app = express()
  app.set('trust proxy', 1)

  const configuredOrigins = String(config.clientOrigin || '')
    .split(',')
    .map(origin => origin.trim())
    .filter(Boolean)
  const isAllowedOrigin = (origin) => {
    if (!origin || configuredOrigins.includes(origin)) return true
    return !config.isProd && /^http:\/\/(localhost|127\.0\.0\.1):\d+$/.test(origin)
  }

  // Security headers
  app.use(helmet({
    crossOriginEmbedderPolicy: false,
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        imgSrc: ["'self'", 'data:', 'https:'],
        connectSrc: ["'self'", config.clientOrigin],
      },
    },
  }))

  // CORS — only the client origin is allowed
  app.use(cors({
    origin(origin, callback) {
      const allowed = isAllowedOrigin(origin)
      callback(allowed ? null : new Error(`Origin not allowed by CORS: ${origin}`), allowed)
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', config.csrf.headerName],
  }))

  // Body parsing
  app.use(express.json({ limit: '12mb' }))
  app.use(express.urlencoded({ extended: true, limit: '12mb' }))

  // NoSQL injection prevention — strips $ and . from req.body and req.params (Express 5 compatible)
  app.use((req, _res, next) => {
    const sanitize = (obj) => {
      if (!obj || typeof obj !== 'object') return obj
      for (const key of Object.keys(obj)) {
        if (key.startsWith('$') || key.includes('.')) {
          delete obj[key]
        } else if (typeof obj[key] === 'object') {
          sanitize(obj[key])
        }
      }
      return obj
    }
    if (req.body) sanitize(req.body)
    if (req.params) sanitize(req.params)
    next()
  })

  // CSRF protection (after cookie parser — we read cookies manually)
  app.use(csrfMiddleware)

  // Static uploads
  app.use('/uploads', express.static('uploads'))

  // API routes
  app.use('/api', routes)

  // Catch-all 404
  app.use((_req, res) => res.status(404).json({ message: 'Not found' }))

  // Central error handler
  app.use(errorHandler)

  return app
}
