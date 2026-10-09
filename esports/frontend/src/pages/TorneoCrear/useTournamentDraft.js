import { useEffect, useRef, useState } from 'react'
import { tournamentsApi } from '../../lib/serverApi.js'
import { clearDraft, readDraft, writeDraft } from '../../lib/tournamentDraft.js'
import { initialTournamentForm, normalizeCompetition } from '../../../../shared/tournamentSetup.mjs'
import { gameIdFromName, gameCategoryId } from '../../../../shared/games.mjs'

// Borradores guardados antes de la Etapa 2 traen `game` (nombre) y `format`
// pero no `gameId` ni `competition`. Los completamos al cargar.
function migrateForm(form) {
  const out = { ...form }
  if (!out.gameId && out.game) out.gameId = gameIdFromName(out.game)
  if (out.gameId && !out.categoryId) out.categoryId = gameCategoryId(out.gameId)
  out.competition = normalizeCompetition(out.competition, out.maxSlots)
  return out
}

export default function useTournamentDraft(user) {
  const userId = user._id || user.id
  const [draft, setDraft] = useState(null)
  const [ready, setReady] = useState(false)
  const [status, setStatus] = useState('')
  const latest = useRef(null)
  const timer = useRef(null)
  const queue = useRef(Promise.resolve())
  const alive = useRef(true)
  useEffect(() => {
    alive.current = true
    const local = readDraft(userId)
    let active = true
    const load = (chosen) => {
      const next = chosen ? { ...chosen, form: migrateForm({ ...initialTournamentForm(user), ...chosen.form }) } : {
        form: initialTournamentForm(user), step: 0, creationKey: crypto.randomUUID(), savedAt: 0,
      }
      latest.current = next
      setDraft(next)
      if (chosen) { try { writeDraft(userId, next) } catch {} }
    }
    tournamentsApi.draft().then(({ draft: remote }) => {
      if (!active) return
      const chosen = remote && (!local || remote.savedAt > local.savedAt) ? remote : local
      load(chosen)
      if (chosen) setStatus('Borrador recuperado')
    }).catch(() => {
      if (!active) return
      load(local)
      setStatus('Sin conexion. Guardado disponible en este navegador.')
    }).finally(() => { if (active) setReady(true) })
    return () => { active = false; alive.current = false; clearTimeout(timer.current) }
  }, [userId])
  const saveRemote = (next) => {
    const task = queue.current.catch(() => {}).then(() => tournamentsApi.saveDraft(next))
    queue.current = task
    return task.then(() => {
      if (alive.current && latest.current?.savedAt === next.savedAt) setStatus('Guardado en tu cuenta')
    }).catch(err => {
      if (alive.current) setStatus(err.status === 409 ? err.message : 'Guardado local. Sin sincronizar con tu cuenta.')
      throw err
    })
  }
  const update = (form, step = latest.current.step) => {
    if (typeof form === 'function') form = form(latest.current.form)
    if (form === latest.current.form && step === latest.current.step) return
    const next = { ...latest.current, form, step, savedAt: Math.max(Date.now(), latest.current.savedAt + 1) }
    latest.current = next
    setDraft(next)
    try { writeDraft(userId, next); setStatus('Guardando...') }
    catch { setStatus('No se pudo guardar en este navegador. Sincronizando...') }
    clearTimeout(timer.current)
    timer.current = setTimeout(() => { saveRemote(next).catch(() => {}) }, 700)
  }
  const flush = async () => {
    clearTimeout(timer.current)
    if (latest.current?.savedAt) await saveRemote(latest.current)
  }
  const clear = async () => {
    clearTimeout(timer.current)
    await queue.current.catch(() => {})
    clearDraft(userId)
    await tournamentsApi.deleteDraft(latest.current.creationKey).catch(() => {})
  }
  const discard = async () => {
    clearTimeout(timer.current)
    await queue.current.catch(() => {})
    await tournamentsApi.deleteDraft(latest.current.creationKey)
    clearDraft(userId)
    const next = { form: initialTournamentForm(user), step: 0, creationKey: crypto.randomUUID(), savedAt: 0 }
    latest.current = next
    setDraft(next)
    setStatus('Nuevo torneo')
  }
  return { draft, ready, status, update, flush, clear, discard }
}

