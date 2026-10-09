import { AdminActionLog } from '../models/AdminActionLog.js'

function actorName(user) {
  return user?.nick || user?.email || 'Admin'
}

// Registro explicito (con resumen/antes/despues legibles). Marca la request
// como auditada para que auditAdminMutations no duplique la fila.
export async function logAdminAction(req, payload) {
  if (req) req._adminAudited = true
  try {
    await AdminActionLog.create({ actor: req?.user?._id || null, actorName: actorName(req?.user), ...payload })
  } catch (error) {
    console.error('[adminAudit] log error:', error.message)
  }
}

const MUTATING = new Set(['POST', 'PUT', 'PATCH', 'DELETE'])
// Rutas de gestion del staff: todo lo que cuelga de un segmento /admin
// (en /api/admin y en los /admin de cada modulo: /news, /role-applications,
// /university, /brands, /system-tickets...) y la gestion de noticias.
const AUDITED_PATH = /(^|\/)admin(\/|$)|^\/api\/news(\/|$)/

const MODULE_ALIASES = {
  'role-applications': 'role', 'system-tickets': 'ticket', 'game-requests': 'game_request',
  'publication-requests': 'publication', 'site-ads': 'ads', 'site-promos': 'ads',
}

function describe(req) {
  const path = String(req.originalUrl || '').split('?')[0].replace(/^\/api\//, '')
  const parts = path.split('/').filter(Boolean).filter(p => p !== 'admin')
  const moduleKey = parts[0] || 'admin'
  const objectId = parts.find(p => /^[a-f0-9]{24}$/i.test(p))
  return {
    module: MODULE_ALIASES[moduleKey] || moduleKey,
    targetId: objectId || parts.slice(1).join('/') || moduleKey,
    path,
  }
}

// Red de seguridad de la bitacora (/admin/logs): cualquier cambio exitoso que
// haga un admin en rutas de gestion queda registrado aunque su controlador no
// llame logAdminAction a mano. Antes solo 5 controladores escribian log, asi
// que editar/borrar equipos, organizaciones, comunidades, noticias, solicitudes
// de rol, etc. no dejaban rastro.
export function auditAdminMutations(req, res, next) {
  if (!MUTATING.has(req.method)) return next()
  res.on('finish', () => {
    if (req._adminAudited || res.statusCode >= 400) return
    if (req.user?.role !== 'admin') return
    if (!AUDITED_PATH.test(String(req.originalUrl || '').split('?')[0])) return
    const { module, targetId, path } = describe(req)
    AdminActionLog.create({
      actor: req.user._id,
      actorName: actorName(req.user),
      action: `${req.method.toLowerCase()}_${module}`.slice(0, 80),
      module,
      targetId: String(targetId).slice(0, 120),
      summary: `${req.method} /${path}`.slice(0, 400),
    }).catch(error => console.error('[adminAudit] auto log error:', error.message))
  })
  next()
}
