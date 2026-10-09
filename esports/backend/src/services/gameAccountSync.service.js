// Lleva la cuenta de Mobile Legends verificada a donde se escribe el Game ID
// a mano: el puesto del jugador en sus equipos de MLBB (rosterSlots) y su
// tarjeta de jugador (gamerProfile.pro.entries). Asi el ID verificado es el
// mismo en todas partes y nadie tiene que copiarlo.
import { GameAccount } from '../models/GameAccount.js'
import { Team } from '../models/Team.js'
import { User } from '../models/User.js'
import { findRosterLockTournaments } from './rosterLock.service.js'
import { isMobileLegends } from '../../../shared/matchStats.mjs'

const PROFILE_GAME_ID = 'mobile-legends-bang-bang'

/** "123456789 (2045)": el formato que ya usa checkGameAccountId para MLBB. */
export const mlbbAccountId = account => `${account.roleId} (${account.zoneId})`

export async function verifiedMlbbAccount(userId) {
  if (!userId) return null
  return GameAccount.findOne({ user: userId, game: 'mlbb', status: 'verified' }).lean()
}

/**
 * Pone el ID verificado (y el nick del juego, si lo hay) en el puesto del
 * usuario en cada equipo de MLBB. Los equipos con el roster congelado por un
 * check-in no se tocan: ahi el Game ID no puede cambiar hasta que termine el torneo.
 * withNick:false solo corrige el ID (para no pisar un nick que el jugador
 * cambio a mano despues de verificar).
 */
export async function syncVerifiedAccountToTeams(userId, account, { withNick = true } = {}) {
  const teams = await Team.find({ $or: [{ leader: userId }, { members: userId }] }).select('game rosterSlots').lean()
  const accountId = mlbbAccountId(account)
  let updated = 0
  for (const team of teams) {
    if (!isMobileLegends(team.game)) continue
    const slots = team.rosterSlots && typeof team.rosterSlots === 'object' ? { ...team.rosterSlots } : {}
    const key = Object.keys(slots).find(k => String(slots[k]?.userId || '') === String(userId))
    if (!key) continue
    const nick = (withNick && account.nickname) || slots[key].nick
    if (slots[key].gameId === accountId && slots[key].nick === nick) continue
    if ((await findRosterLockTournaments(team._id)).length) continue
    // updateOne directo: el equipo se cargo solo con game/rosterSlots.
    await Team.updateOne({ _id: team._id }, { $set: { [`rosterSlots.${key}`]: { ...slots[key], gameId: accountId, nick } } })
    updated += 1
  }
  return updated
}

/** Tarjeta de jugador: actualiza la entrada de MLBB o la crea con el ID. */
export async function syncVerifiedAccountToProfile(userId, account) {
  const user = await User.findById(userId).select('gamerProfile.pro')
  if (!user) return
  const pro = user.gamerProfile?.pro && typeof user.gamerProfile.pro === 'object' ? user.gamerProfile.pro : {}
  const entries = Array.isArray(pro.entries) ? [...pro.entries] : []
  const accountId = mlbbAccountId(account)
  const index = entries.findIndex(e => e?.gameId === PROFILE_GAME_ID)
  if (index >= 0 && entries[index].accountId === accountId) return
  if (index >= 0) entries[index] = { ...entries[index], accountId }
  else entries.push({ gameId: PROFILE_GAME_ID, accountId, rank: '', peakRank: '', role: '', secondaryRole: '' })
  // Solo se cargo gamerProfile.pro: se escribe esa ruta, nunca gamerProfile entero.
  user.set('gamerProfile.pro', { ...pro, entries })
  user.markModified('gamerProfile.pro')
  await user.save()
}

/**
 * Si el usuario tiene MLBB verificada, su puesto en un equipo de MLBB usa
 * ese ID (no uno escrito a mano). Devuelve el slot ajustado.
 */
export function applyVerifiedAccountToSlot(slot, account) {
  if (!slot || !account) return slot
  return { ...slot, gameId: mlbbAccountId(account), nick: slot.nick || account.nickname || '' }
}
