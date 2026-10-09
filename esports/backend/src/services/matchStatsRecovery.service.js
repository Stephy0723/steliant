import { MatchStatsDraft } from '../models/MatchStatsDraft.js'
import { Tournament } from '../models/Tournament.js'
import { writeStatsHistory } from './matchStats.service.js'
import { config } from '../config/index.js'

// Only completes an already committed human confirmation. Does not extract,
// approve, edit submissions, or depend on the roster's current composition.
export async function recoverMatchStatsHistory({ now = new Date(), limit = 25 } = {}) {
  const results = []
  for (let i = 0; i < Math.min(100, limit); i++) {
    const draft = await MatchStatsDraft.findOneAndUpdate({
      status: 'confirmed', historyWrittenAt: null,
      $or: [{ historyRetryAt: null }, { historyRetryAt: { $lte: now } }],
    }, { $set: { historyRetryAt: new Date(now.getTime() + 120000) }, $inc: { historyAttempts: 1 } },
    { new: true, sort: { updatedAt: 1 } }).lean()
    if (!draft) break
    try {
      const tournament = await Tournament.findById(draft.tournament).select('title game').lean()
      if (!tournament) throw new Error('Torneo no disponible para recuperar el historial.')
      await writeStatsHistory(draft, tournament)
      results.push({ id: String(draft._id), status: 'recovered' })
    } catch {
      const delay = Math.min(1800000, 60000 * 2 ** Math.min(draft.historyAttempts, 5))
      await MatchStatsDraft.updateOne({ _id: draft._id, historyWrittenAt: null }, { $set: {
        historyRetryAt: new Date(now.getTime() + delay), historyError: 'No se pudo completar el historial. Se reintentará automáticamente.',
      } })
      results.push({ id: String(draft._id), status: 'retry_scheduled' })
    }
  }
  return results
}

let timer = null, running = false
async function tick() {
  if (running) return
  running = true
  try { await recoverMatchStatsHistory() }
  catch (error) { console.error('[match-stats-recovery]', error.message) }
  finally { running = false }
}
export function startMatchStatsRecoveryJob() {
  if (timer || !config.matchStats.repairEnabled) return
  timer = setInterval(tick, 60000)
  timer.unref?.()
  void tick()
}
export async function stopMatchStatsRecoveryJob() {
  if (timer) clearInterval(timer)
  timer = null
  // Shutdown must not disconnect Mongo in the middle of a ten-player write.
  while (running) await new Promise(resolve => setTimeout(resolve, 50))
}
