// Roster congelado: desde que el equipo hace check-in en un torneo activo
// (open / registration_closed / ongoing) no se puede cambiar quien juega
// hasta que el torneo termine o la inscripcion salga del torneo. El bloqueo
// real lo aplica el backend (ver BACKEND-PENDIENTE "Roster congelado al
// check-in"); esto solo avisa y apaga los botones antes de que el servidor
// responda que no.
import { useEffect, useState } from 'react'
import { tournamentsApi, registrationsApi } from './serverApi.js'

const UNLOCKED = { locked: false, tournaments: [] }

export function useRosterLock(teamId) {
  const [state, setState] = useState(UNLOCKED)

  useEffect(() => {
    if (!teamId) { setState(UNLOCKED); return }
    let alive = true
    tournamentsApi.byTeam(teamId)
      .then(async (res) => {
        const list = Array.isArray(res?.tournaments) ? res.tournaments : []
        const hits = await Promise.all(list.map(async (t) => {
          const tid = t.id || t._id
          try {
            const r = await registrationsApi.list(tid)
            const regs = Array.isArray(r?.registrations) ? r.registrations : []
            const mine = regs.find(reg => String(reg.teamId || '') === String(teamId))
            return mine?.status === 'checked_in' ? { id: tid, title: t.title || 'Torneo' } : null
          } catch { return null }
        }))
        if (!alive) return
        const tournaments = hits.filter(Boolean)
        setState({ locked: tournaments.length > 0, tournaments })
      })
      .catch(() => { if (alive) setState(UNLOCKED) })
    return () => { alive = false }
  }, [teamId])

  return state
}

export function rosterLockMessage(lock) {
  const names = lock.tournaments.map(t => t.title).join(', ')
  return `El roster esta congelado: el equipo ya hizo check-in en ${names}. No se pueden sumar, quitar ni cambiar jugadores hasta que el torneo termine.`
}

