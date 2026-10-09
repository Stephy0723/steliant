import 'dotenv/config'
import mongoose from 'mongoose'
import { config } from '../config/index.js'
import { ensureMatchStatsIndexes } from '../services/matchStatsIndexes.service.js'
import { MatchStatsDraft } from '../models/MatchStatsDraft.js'
import { recoverMatchStatsHistory } from '../services/matchStatsRecovery.service.js'

const apply = process.argv.includes('--apply')
try {
  if (!config.mongoEnabled) throw new Error('MongoDB debe estar habilitado.')
  // Disable autoIndex/autoCreate even in dry-run: inspecting must not mutate DB.
  await mongoose.connect(config.mongoUri, { autoIndex: false, autoCreate: false, serverSelectionTimeoutMS: 5000 })
  const pending = await MatchStatsDraft.countDocuments({ status: 'confirmed', historyWrittenAt: null })
  console.log(`Historiales confirmados pendientes: ${pending}.`)
  if (apply) {
    await ensureMatchStatsIndexes()
    console.log('Índices de estadísticas preparados (sin borrar ni reescribir datos).')
    if (process.argv.includes('--recover')) {
      const results = await recoverMatchStatsHistory({ limit: 100 })
      console.log(`Recuperados: ${results.filter(r => r.status === 'recovered').length}; reintentos programados: ${results.filter(r => r.status === 'retry_scheduled').length}.`)
    }
  } else console.log('Solo inspección. Usa --apply para crear índices; añade --recover para completar historiales pendientes.')
} catch (error) {
  console.error('No se pudo preparar estadísticas:', error.code === 11000 ? 'Hay duplicados previos; revisarlos antes de crear índices únicos.' : error.message)
  process.exitCode = 1
} finally { await mongoose.disconnect() }
