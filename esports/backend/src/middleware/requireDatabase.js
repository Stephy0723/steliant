import { getDatabaseStatus } from '../database/mongo.js'

export function requireDatabase(_req, res, next) {
  if (getDatabaseStatus() !== 'connected') {
    return res.status(503).json({ message: 'Database unavailable', status: getDatabaseStatus() })
  }
  next()
}
