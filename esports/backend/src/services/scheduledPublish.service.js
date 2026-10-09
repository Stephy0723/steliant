import { Tournament } from '../models/Tournament.js'
import { sendNotif } from './notifications.service.js'

const CHECK_INTERVAL_MS = 2 * 60 * 1000 // cada 2 min, ver BACKEND-PENDIENTE.md #publicacion-programada

// Publica solo los torneos en 'draft' cuya fecha programada ya llego. Uno
// por uno (no updateMany) para poder notificar al organizador y reusar el
// mismo criterio de "que significa publicar" que ya usa updateTournament.
export async function publishDueTournaments() {
  const due = await Tournament.find({
    status: 'draft',
    scheduledPublishAt: { $ne: null, $lte: new Date() },
  })

  for (const tournament of due) {
    try {
      tournament.status = 'open'
      tournament.visibility = 'public'
      tournament.scheduledPublishAt = null
      await tournament.save()

      await sendNotif(tournament.organizer, {
        type: 'tournament_scheduled_published',
        title: 'Tu torneo se publicó automáticamente',
        message: `${tournament.title} ya está publicado según la fecha que programaste.`,
        link: `/torneos/${tournament.publicId || tournament._id}`,
        meta: { tournamentId: String(tournament._id), tournamentTitle: tournament.title },
      }).catch(() => {})
    } catch (err) {
      console.error('[scheduled-publish] failed to publish tournament', tournament._id.toString(), err.message)
    }
  }
}

let intervalHandle = null

export function startScheduledPublishJob() {
  if (intervalHandle) return
  intervalHandle = setInterval(() => { publishDueTournaments().catch(err => console.error('[scheduled-publish] tick failed:', err.message)) }, CHECK_INTERVAL_MS)
  intervalHandle.unref?.()
  publishDueTournaments().catch(err => console.error('[scheduled-publish] initial tick failed:', err.message))
}

export function stopScheduledPublishJob() {
  if (intervalHandle) clearInterval(intervalHandle)
  intervalHandle = null
}
