import { config } from '../config/index.js'

export function errorHandler(err, _req, res, _next) {
  const status = err.status || err.statusCode || 500
  const message = err.message || 'Internal server error'

  if (status >= 500) console.error('[error]', err)

  // Mongoose duplicate key
  if (err.code === 11000) {
    const field = Object.keys(err.keyValue ?? {})[0] ?? 'field'
    return res.status(409).json({ message: `${field} is already in use` })
  }

  // Id o valor con formato invalido (ObjectId, fecha, booleano...): error del cliente, no 500.
  if (err.name === 'CastError') {
    return res.status(400).json({ message: `Invalid ${err.path || 'value'}` })
  }

  // Mongoose validation
  if (err.name === 'ValidationError') {
    const messages = Object.values(err.errors).map(e => e.message)
    return res.status(400).json({ message: messages[0] })
  }

  // Multer file size
  if (err.code === 'LIMIT_FILE_SIZE') {
    return res.status(400).json({ message: 'File is too large' })
  }

  // En producción un 500 no expone el mensaje interno (nombres de campos,
  // rutas, errores de librerías); el detalle queda en el log de arriba.
  const safeMessage = status >= 500 && config.isProd ? 'Error interno del servidor. Inténtalo de nuevo.' : message

  // `payload`: campos extra para el cliente (ej. { code: 'ROSTER_LOCKED', tournaments }).
  res.status(status).json({ ...(err.payload || {}), message: safeMessage })
}
