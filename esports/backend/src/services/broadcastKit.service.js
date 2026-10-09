// Kit de transmision: logo + nick + foto de cada jugador de los equipos
// inscritos, para que produccion arme los overlays (ver
// frontend/.../OrganizerTournamentManage/BroadcastKit.jsx).
//
// Quien juega sale del roster congelado en el check-in (rosterSnapshot, ver
// rosterLock.service.js). Si el equipo aun no hizo check-in, se usa el roster
// actual armado igual que buildRosterSnapshot (puestos del equipo y, si no
// tiene, las cuentas miembro), asi el kit no cambia de forma al hacer check-in.

const SLOT_RANK = { titular: 0, sub: 1, coach: 2, manager: 3 }

function idOf(value) {
  return String(value?._id || value?.id || value || '')
}

function slotKind(slot = '') {
  const key = String(slot).toLowerCase()
  return Object.keys(SLOT_RANK).find(kind => key.startsWith(kind)) || ''
}

export function slotRoleLabel(slot = '') {
  const kind = slotKind(slot)
  if (kind === 'titular') return 'Titular'
  if (kind === 'sub') return 'Suplente'
  if (kind === 'coach') return 'Coach'
  if (kind === 'manager') return 'Manager'
  return 'Jugador'
}

function slotOrder(a, b) {
  const rank = (slot) => (slotKind(slot) ? SLOT_RANK[slotKind(slot)] : 9)
  const num = (slot) => Number(String(slot).match(/(\d+)$/)?.[1] || 0)
  return rank(a.slot) - rank(b.slot) || num(a.slot) - num(b.slot)
}

const sameNick = (a, b) => Boolean(a) && String(a).trim().toLowerCase() === String(b || '').trim().toLowerCase()

// La foto del puesto (la que el jugador subio para ESE equipo) gana sobre la
// de la cuenta, igual que en getTeamById. Solo si el puesto sigue siendo de
// la misma persona: si lo ocupa otro despues del check-in, no se le pone su cara.
function slotAvatarFor(entry, currentSlots) {
  const slot = entry.slot && currentSlots?.[entry.slot]
  if (!slot || typeof slot !== 'object' || !slot.avatar) return ''
  const sameUser = entry.userId && idOf(slot.userId) === entry.userId
  return sameUser || (!entry.userId && sameNick(slot.nick, entry.nick)) ? slot.avatar : ''
}

function playerRow(entry, usersById, currentSlots, leaderId) {
  const user = entry.userId ? usersById.get(entry.userId) : null
  return {
    userId: entry.userId || null,
    nick: entry.nick || user?.nick || 'Jugador',
    avatar: slotAvatarFor(entry, currentSlots) || user?.avatar || '',
    slot: entry.slot || '',
    role: slotRoleLabel(entry.slot),
    captain: Boolean(entry.userId && entry.userId === leaderId),
  }
}

// Mismo criterio que buildRosterSnapshot, pero con el equipo ya poblado.
function currentRosterEntries(team) {
  const slots = team?.rosterSlots && typeof team.rosterSlots === 'object' ? team.rosterSlots : {}
  const fromSlots = Object.entries(slots)
    .filter(([, slot]) => slot && typeof slot === 'object' && (slot.nick || slot.gameId || slot.userId))
    .map(([key, slot]) => ({ userId: idOf(slot.userId) || null, nick: String(slot.nick || ''), slot: key }))
  if (fromSlots.length) return fromSlots
  const seen = new Set()
  return [team?.leader, ...(team?.members || [])]
    .map(idOf)
    .filter(id => id && !seen.has(id) && seen.add(id))
    .map(id => ({ userId: id, nick: '', slot: '' }))
}

/** Ids de usuario que hay que buscar para armar el kit (snapshot + roster actual + individuales). */
export function broadcastKitUserIds(registrations = []) {
  const ids = new Set()
  for (const reg of registrations) {
    if (reg?.status === 'withdrawn') continue
    ;(reg.rosterSnapshot || []).forEach(p => p?.userId && ids.add(idOf(p.userId)))
    const team = reg.team && typeof reg.team === 'object' ? reg.team : null
    if (team) currentRosterEntries(team).forEach(e => e.userId && ids.add(e.userId))
    else if (reg.user) ids.add(idOf(reg.user))
  }
  return [...ids]
}

/**
 * @param registrations inscripciones con `team` poblado (name tag color logo leader members rosterSlots)
 * @param usersById Map id -> { nick, avatar }
 */
export function buildBroadcastTeams(registrations = [], usersById = new Map()) {
  return registrations
    .filter(reg => reg && reg.status !== 'withdrawn')
    .map(reg => {
      const team = reg.team && typeof reg.team === 'object' ? reg.team : null
      const base = {
        registrationId: idOf(reg._id),
        status: reg.status || 'registered',
        teamId: team ? idOf(team._id) : null,
        name: team?.name || reg.teamMeta?.name || 'Equipo',
        tag: team?.tag || reg.teamMeta?.tag || '',
        color: team?.color || '',
        logo: team?.logo || reg.teamMeta?.logo || '',
      }

      if (!team) {
        // Inscripcion individual (1v1): el "equipo" es el jugador.
        const userId = idOf(reg.user)
        const user = usersById.get(userId)
        return {
          ...base,
          name: user?.nick || base.name,
          source: 'individual',
          players: userId ? [{ userId, nick: user?.nick || 'Jugador', avatar: user?.avatar || '', slot: '', role: 'Jugador', captain: true }] : [],
        }
      }

      const leaderId = idOf(team.leader)
      const snapshot = Array.isArray(reg.rosterSnapshot) ? reg.rosterSnapshot : []
      const entries = snapshot.length
        ? snapshot.map(p => ({ userId: idOf(p.userId) || null, nick: p.nick || '', slot: p.slot || '' }))
        : currentRosterEntries(team)
      return {
        ...base,
        source: snapshot.length ? 'checkin' : 'roster',
        players: entries.map(e => playerRow(e, usersById, team.rosterSlots, leaderId)).sort(slotOrder),
      }
    })
}
