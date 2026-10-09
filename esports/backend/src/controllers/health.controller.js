import { getDatabaseStatus } from '../database/mongo.js'

export function health(_req, res) {
  const db = getDatabaseStatus()
  res.json({
    status: (db === 'connected' || db === 'disabled') ? 'ok' : 'degraded',
    service: 'glitchgang-api',
    version: '2.0.0',
    database: db,
    time: new Date().toISOString(),
  })
}
