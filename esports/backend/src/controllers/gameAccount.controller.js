import mongoose from 'mongoose'
import { GameAccount } from '../models/GameAccount.js'
import { Team } from '../models/Team.js'
import { Tournament } from '../models/Tournament.js'
import { LOCKING_TOURNAMENT_STATUSES } from '../services/rosterLock.service.js'
import { notifyUsers } from '../services/tournamentTeams.service.js'
import { syncVerifiedAccountToProfile, syncVerifiedAccountToTeams } from '../services/gameAccountSync.service.js'
import {
  CODE_TTL_MS, CONFIRM_TTL_MS, MAX_CODE_ATTEMPTS, gameAccountError, ownAccountView,
  parseMlbbIds, sendMlbbCode, verifyMlbbCode,
} from '../services/gameAccount.service.js'

// Cuentas de juego verificadas (Mobile Legends). Ver services/gameAccount.service.js
// para el flujo del codigo al correo del juego.
const GAME = 'mlbb'
const PENDING = ['pending_code', 'pending_confirm']

/**
 * Torneos activos en los que juega este usuario: su roster congelado al
 * check-in, o un equipo suyo que ya hizo check-in. Con alguno, el ID de juego
 * no se puede cambiar ni desconectar (la IA lo compara durante el torneo).
 */
async function activeTournamentsFor(userId) {
  const teams = await Team.find({ $or: [{ leader: userId }, { members: userId }] }).select('_id').lean()
  const tournaments = await Tournament.find({
    status: { $in: LOCKING_TOURNAMENT_STATUSES },
    $or: [
      { registrations: { $elemMatch: { status: 'checked_in', 'rosterSnapshot.userId': userId } } },
      { registrations: { $elemMatch: { status: 'checked_in', team: { $in: teams.map(t => t._id) } } } },
    ],
  }).select('title').lean()
  return tournaments.map(t => t.title || 'Torneo')
}

async function assertNotInActiveTournament(userId, action) {
  const titles = await activeTournamentsFor(userId)
  if (titles.length) {
    throw gameAccountError(`No puedes ${action} tu cuenta de juego mientras juegas ${titles.join(', ')}. Podrás hacerlo cuando termine el torneo.`, 409, 'GAME_ACCOUNT_LOCKED')
  }
}

/** GET /api/game-accounts/me */
export async function getMyGameAccounts(req, res, next) {
  try {
    const [verified, pending] = await Promise.all([
      GameAccount.findOne({ user: req.user._id, game: GAME, status: 'verified' }).lean(),
      GameAccount.findOne({ user: req.user._id, game: GAME, status: { $in: PENDING } }).sort({ updatedAt: -1 }).lean(),
    ])
    // Quien verifico antes de que existiera la sincronizacion (o cuyo equipo
    // tenia el roster congelado) recibe aqui el ID en sus equipos y su tarjeta.
    // Es idempotente: no escribe nada si ya coincide.
    if (verified) {
      await Promise.all([
        syncVerifiedAccountToTeams(req.user._id, verified, { withNick: false }),
        syncVerifiedAccountToProfile(req.user._id, verified),
      ]).catch(error => console.error('[GameAccount] Sincronizacion pendiente fallo:', error.message))
    }
    res.json({ mlbb: { account: ownAccountView(verified), pending: ownAccountView(pending) } })
  } catch (err) { next(err) }
}

/** POST /api/game-accounts/mlbb/send-code { roleId, zoneId } */
export async function sendGameCode(req, res, next) {
  try {
    const { roleId, zoneId } = parseMlbbIds(req.body?.roleId, req.body?.zoneId)
    const userId = req.user._id
    const [mine, other] = await Promise.all([
      GameAccount.findOne({ user: userId, game: GAME, status: 'verified' }).lean(),
      GameAccount.findOne({ game: GAME, roleId, zoneId, status: 'verified', user: { $ne: userId } }).select('_id').lean(),
    ])
    if (mine && mine.roleId === roleId && mine.zoneId === zoneId) {
      throw gameAccountError('Esa cuenta ya está verificada en tu perfil.', 409, 'GAME_ACCOUNT_ALREADY_VERIFIED')
    }
    if (mine) await assertNotInActiveTournament(userId, 'cambiar')

    await sendMlbbCode(roleId, zoneId)

    await GameAccount.deleteMany({ user: userId, game: GAME, status: { $in: PENDING } })
    const pending = await GameAccount.create({ user: userId, game: GAME, roleId, zoneId, status: 'pending_code', codeSentAt: new Date(), codeAttempts: 0 })
    res.json({ pending: ownAccountView(pending), claimedByOther: Boolean(other) })
  } catch (err) { next(err) }
}

/** POST /api/game-accounts/mlbb/verify { code } */
export async function verifyGameCode(req, res, next) {
  try {
    const code = String(req.body?.code ?? '').trim()
    if (!/^\d{4,6}$/.test(code)) throw gameAccountError('El código son los 4 números que llegaron al correo del juego.', 400, 'GAME_CODE_FORMAT')
    const pending = await GameAccount.findOne({ user: req.user._id, game: GAME, status: 'pending_code' })
    if (!pending) throw gameAccountError('Primero pide el código con tu ID y servidor.', 404, 'GAME_CODE_NOT_REQUESTED')
    if (Date.now() - new Date(pending.codeSentAt).getTime() > CODE_TTL_MS) {
      throw gameAccountError('El código venció (dura 5 minutos). Pide uno nuevo.', 410, 'GAME_CODE_EXPIRED')
    }
    if (pending.codeAttempts >= MAX_CODE_ATTEMPTS) {
      throw gameAccountError('Demasiados intentos con este código. Pide uno nuevo.', 429, 'GAME_CODE_TOO_MANY_ATTEMPTS')
    }
    // Se cuenta el intento antes de llamar al juego: dos pestanas a la vez no suman intentos gratis.
    const counted = await GameAccount.findOneAndUpdate(
      { _id: pending._id, status: 'pending_code', codeAttempts: { $lt: MAX_CODE_ATTEMPTS } },
      { $inc: { codeAttempts: 1 } },
      { new: true },
    )
    if (!counted) throw gameAccountError('Demasiados intentos con este código. Pide uno nuevo.', 429, 'GAME_CODE_TOO_MANY_ATTEMPTS')

    const profile = await verifyMlbbCode(counted.roleId, counted.zoneId, code)
    Object.assign(counted, profile, { status: 'pending_confirm', checkedAt: new Date() })
    await counted.save()
    res.json({ pending: ownAccountView(counted) })
  } catch (err) { next(err) }
}

/** POST /api/game-accounts/mlbb/confirm { accept } -- "¿Esta es tu cuenta?" */
export async function confirmGameAccount(req, res, next) {
  try {
    const userId = req.user._id
    const pending = await GameAccount.findOne({ user: userId, game: GAME, status: 'pending_confirm' })
    if (!pending) throw gameAccountError('No hay ninguna cuenta esperando confirmación. Empieza de nuevo.', 404, 'GAME_CONFIRM_NOT_FOUND')
    if (req.body?.accept !== true) {
      await pending.deleteOne()
      return res.json({ ok: true, account: null })
    }
    if (Date.now() - new Date(pending.checkedAt).getTime() > CONFIRM_TTL_MS) {
      await pending.deleteOne()
      throw gameAccountError('Pasó demasiado tiempo desde el código. Vuelve a verificar la cuenta.', 410, 'GAME_CONFIRM_EXPIRED')
    }

    const mine = await GameAccount.findOne({ user: userId, game: GAME, status: 'verified' })
    if (mine) {
      await assertNotInActiveTournament(userId, 'cambiar')
      Object.assign(mine, { status: 'revoked', revokedAt: new Date(), revokedReason: 'replaced' })
      await mine.save()
    }

    // Quien demuestra el codigo es el dueno real: si otro usuario tenia este
    // ID verificado, se le quita y se le avisa.
    const previousOwner = await GameAccount.findOne({ game: GAME, roleId: pending.roleId, zoneId: pending.zoneId, status: 'verified', user: { $ne: userId } })
    if (previousOwner) {
      Object.assign(previousOwner, { status: 'revoked', revokedAt: new Date(), revokedReason: 'claimed_by_owner' })
      await previousOwner.save()
      await notifyUsers([previousOwner.user], {
        type: 'game_account_claimed',
        title: 'Tu cuenta de Mobile Legends fue reclamada',
        message: `Otra persona verificó con el código del juego que el ID ${pending.roleId} (${pending.zoneId}) es suyo. Si es tuyo, vuelve a verificarlo desde Ajustes → Conexiones.`,
        link: '/ajustes?tab=conexiones',
      }).catch(() => {})
    }

    Object.assign(pending, { status: 'verified', verifiedAt: new Date(), verifiedBy: 'ingame_code' })
    try {
      await pending.save()
    } catch (error) {
      if (error?.code === 11000) throw gameAccountError('Esa cuenta se acaba de verificar en otro perfil. Vuelve a intentarlo.', 409, 'GAME_ACCOUNT_TAKEN')
      throw error
    }
    // El ID y el nick del juego pasan solos a la tarjeta de jugador y al
    // puesto en sus equipos de MLBB (los que no tengan el roster congelado).
    await syncVerifiedAccountToProfile(userId, pending).catch(error => {
      console.error('[GameAccount] No se pudo actualizar la tarjeta de jugador:', error.message)
    })
    await syncVerifiedAccountToTeams(userId, pending).catch(error => {
      console.error('[GameAccount] No se pudo actualizar el roster de sus equipos:', error.message)
    })
    res.json({ ok: true, account: ownAccountView(pending) })
  } catch (err) { next(err) }
}

/** DELETE /api/game-accounts/mlbb */
export async function disconnectGameAccount(req, res, next) {
  try {
    const userId = req.user._id
    const mine = await GameAccount.findOne({ user: userId, game: GAME, status: 'verified' })
    if (!mine) throw gameAccountError('No tienes una cuenta de Mobile Legends verificada.', 404, 'GAME_ACCOUNT_NOT_CONNECTED')
    await assertNotInActiveTournament(userId, 'desconectar')
    Object.assign(mine, { status: 'revoked', revokedAt: new Date(), revokedReason: 'disconnected' })
    await mine.save()
    res.json({ ok: true })
  } catch (err) { next(err) }
}

/**
 * GET /api/game-accounts/status?users=id1,id2 -- insignia "verificada" para
 * listas de integrantes. No expone el ID de juego, solo si esta verificada y
 * el nick con que se verifico.
 */
export async function getGameAccountStatus(req, res, next) {
  try {
    const ids = [...new Set(String(req.query?.users || '').split(',').map(s => s.trim()).filter(id => mongoose.isValidObjectId(id)))].slice(0, 60)
    const statuses = Object.fromEntries(ids.map(id => [id, { mlbb: null }]))
    if (ids.length) {
      const rows = await GameAccount.find({ user: { $in: ids }, game: GAME, status: 'verified' }).select('user nickname verifiedAt').lean()
      for (const row of rows) statuses[String(row.user)] = { mlbb: { verified: true, nickname: row.nickname || '', verifiedAt: row.verifiedAt } }
    }
    res.json({ statuses })
  } catch (err) { next(err) }
}
