import { Order } from '../models/Order.js'
import { User } from '../models/User.js'
import { Team } from '../models/Team.js'
import { Tournament } from '../models/Tournament.js'
import { University } from '../models/University.js'
import { Community } from '../models/Community.js'
import { Invoice } from '../models/Invoice.js'

const ORDER_STATUS = {
  paid: 'Pagado', demo_paid: 'Pagado (modo demo)', refunded: 'Reembolsado',
  failed: 'Fallido', canceled: 'Cancelado', requires_payment: 'Pendiente de pago',
}

const dateOf = (d) => d ? new Date(d).toLocaleDateString('es-DO') : '—'

// Extrae el codigo de un QR de GlitchGang (".../verificar?c=XXX") o texto plano.
function normalize(raw) {
  let code = String(raw || '').trim()
  const m = code.match(/[?&]c=([^&\s]+)/i)
  if (m) code = decodeURIComponent(m[1])
  return code.trim()
}

// GET /admin/validate?code=  — escaner de /admin/validar contra la base real:
// comprobantes de pago (Order), facturas de marca (Invoice), jugadores,
// equipos, torneos, universidades y comunidades. Antes validaba contra el
// censo/torneos de ejemplo y un checksum calculable en el navegador.
export async function validateCode(req, res, next) {
  try {
    const code = normalize(req.query.code)
    if (!code) return res.status(400).json({ message: 'Codigo requerido' })
    const upper = code.toUpperCase()

    const order = await Order.findOne({ id: code }).populate('user', 'nick email playerCode').populate('tournamentId', 'title publicId').lean()
    if (order) {
      const ok = ['paid', 'demo_paid'].includes(order.status)
      return res.json({
        kind: order.kind === 'tournament' ? 'ticket' : 'invoice',
        valid: ok,
        code: order.id,
        reason: ok
          ? `Comprobante emitido por GlitchGang · ${ORDER_STATUS[order.status]}`
          : `Comprobante existe pero esta ${ORDER_STATUS[order.status]?.toLowerCase() || order.status}`,
        detail: {
          concept: order.concept,
          amount: order.amount,
          currency: order.currency,
          status: ORDER_STATUS[order.status] || order.status,
          mode: order.mode,
          date: dateOf(order.createdAt),
          buyer: order.user?.nick || 'Cuenta eliminada',
          buyerId: order.user?.playerCode || '',
          tournament: order.tournamentId?.title || null,
          tournamentId: order.tournamentId?.publicId || null,
        },
      })
    }

    const invoice = await Invoice.findOne({ internalCode: upper }).populate('brandId', 'name').lean()
    if (invoice) {
      const ok = invoice.status === 'verified'
      return res.json({
        kind: 'invoice', valid: ok, code: invoice.internalCode,
        reason: ok ? 'Factura de marca verificada por administracion' : `Factura de marca en estado: ${invoice.status}`,
        detail: { concept: invoice.concept || 'Factura de marca', amount: invoice.amount, currency: invoice.currency || 'USD', status: invoice.status, date: dateOf(invoice.createdAt), buyer: invoice.brandId?.name || 'Marca' },
      })
    }

    const user = await User.findOne({ $or: [{ playerCode: upper }, { internalCode: upper }], deleted: { $ne: true } })
      .select('nick avatar playerCode internalCode countryCode isBanned verified createdAt team').populate('team', 'name publicCode').lean()
    if (user) {
      return res.json({
        kind: 'player', valid: !user.isBanned, code: upper,
        reason: user.isBanned ? 'Cuenta existente pero BANEADA' : 'Jugador registrado en GlitchGang',
        detail: {
          nick: user.nick, avatar: user.avatar || '', publicId: user.playerCode, internalId: user.internalCode,
          country: user.countryCode, verified: Boolean(user.verified), joined: dateOf(user.createdAt),
          team: user.team?.name || null, teamId: user.team?.publicCode || null,
        },
      })
    }

    const team = await Team.findOne({ $or: [{ publicCode: upper }, { internalCode: upper }] }).select('name tag game publicCode status members createdAt').lean()
    if (team) {
      const active = team.status !== 'Eliminado'
      return res.json({
        kind: 'team', valid: active, code: upper,
        reason: active ? 'Equipo registrado en GlitchGang' : 'Equipo dado de baja por administracion',
        detail: { name: team.name, tag: team.tag, game: team.game, publicId: team.publicCode, members: (team.members || []).length, created: dateOf(team.createdAt) },
      })
    }

    const tournament = await Tournament.findOne({ $or: [{ publicId: upper }, { tournamentCode: upper }] }).select('title game status date publicId currentSlots maxSlots').lean()
    if (tournament) {
      return res.json({
        kind: 'tournament', valid: tournament.status !== 'cancelled', code: upper,
        reason: tournament.status === 'cancelled' ? 'Torneo cancelado' : 'Torneo registrado en GlitchGang',
        detail: { name: tournament.title, game: tournament.game, status: tournament.status, date: dateOf(tournament.date), publicId: tournament.publicId, slots: `${tournament.currentSlots || 0}/${tournament.maxSlots || 0}` },
      })
    }

    const uni = await University.findOne({ $or: [{ publicCode: code }, { internalCode: code }, { publicCode: upper }, { internalCode: upper }] }).populate('user', 'nick playerCode').lean()
    if (uni) {
      return res.json({
        kind: 'university', valid: true, code: uni.publicCode || upper,
        reason: 'Vinculo universitario registrado',
        detail: { name: uni.name, siglas: uni.siglas, student: uni.user?.nick || '—', studentId: uni.user?.playerCode || '', regDate: uni.registeredOn || dateOf(uni.createdAt) },
      })
    }

    const community = await Community.findOne({ publicCode: upper }).select('name publicCode status game').lean()
    if (community) {
      return res.json({
        kind: 'community', valid: community.status !== 'archived', code: upper,
        reason: 'Comunidad registrada en GlitchGang',
        detail: { name: community.name, game: community.game, status: community.status },
      })
    }

    res.json({ kind: 'unknown', valid: false, code: upper, reason: 'No corresponde a ningun comprobante, factura ni ID registrado.' })
  } catch (error) { next(error) }
}
