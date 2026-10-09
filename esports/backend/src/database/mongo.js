import mongoose from 'mongoose'
import { config } from '../config/index.js'
import { rejectDataUrlFields } from '../models/plugins/rejectDataUrlFields.js'

// Plugin GLOBAL: se aplica a todo schema que se compile despues de este
// punto (por eso este archivo tiene que ser de los primeros que importa
// server.js, antes de cualquier import de un modelo -- Mongoose solo
// engancha plugins globales a schemas creados DESPUES de registrarlo).
// Ver models/plugins/rejectDataUrlFields.js para el motivo.
mongoose.plugin(rejectDataUrlFields)

const STATES = ['disconnected', 'connected', 'connecting', 'disconnecting']

export function getDatabaseStatus() {
  if (!config.mongoEnabled) return 'disabled'
  return STATES[mongoose.connection.readyState] ?? 'unknown'
}

export async function connectDatabase() {
  if (!config.mongoEnabled) {
    console.warn('[db] MongoDB disabled — running in demo mode')
    return
  }

  mongoose.connection.on('connected', () => console.log('[db] MongoDB connected'))
  mongoose.connection.on('error', (err) => console.error('[db] Error:', err.message))
  mongoose.connection.on('disconnected', () => console.warn('[db] MongoDB disconnected'))

  await mongoose.connect(config.mongoUri, {
    maxPoolSize: 50,
    minPoolSize: 5,
    serverSelectionTimeoutMS: 5000,
    socketTimeoutMS: 45000,
  })
}

export async function disconnectDatabase() {
  if (mongoose.connection.readyState !== 0) await mongoose.disconnect()
}
