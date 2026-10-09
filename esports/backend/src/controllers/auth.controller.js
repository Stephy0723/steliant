import crypto from 'node:crypto'
import jwt from 'jsonwebtoken'
import {
  registerUser, loginUser, logoutUser,
  requestPasswordReset, resetPassword, changePassword,
  sendEmailVerification, verifyEmail,
  setup2FA, enable2FA, verify2FA, disable2FA,
  getUserSessions, revokeSession,
} from '../services/auth.service.js'
import { getDiscordAuthUrl, exchangeDiscordCode, getDiscordUser } from '../services/discord.service.js'
import { syncUserToCrm } from '../services/crmSync.service.js'
import { sendWhatsappCode, normalizePhone, isValidPhone } from '../services/whatsapp.service.js'
import { User } from '../models/User.js'
import { Session } from '../models/Session.js'
import { config } from '../config/index.js'
import { extractToken, verifySessionToken } from '../middleware/auth.middleware.js'
import { syncCosmetics } from '../services/cosmetics.service.js'

// Si quien pide conectar Discord ya tiene sesion activa (vino desde Ajustes,
// no desde el login publico), lo llevamos en el "state" de OAuth para que el
// callback vincule Discord a ESA cuenta en vez de tratarlo como alguien
// nuevo. Vida corta (10 min) y firmado — nadie puede forjar un state para
// vincular Discord a la cuenta de otro.
// Only allow same-site relative return paths (no protocol, no //).
function safeReturnPath(value) {
  const v = String(value || '')
  return /^\/[A-Za-z0-9/_\-?=&.%]*$/.test(v) && !v.startsWith('//') ? v : ''
}

// Solo una sesión real puede pedir vincular Discord (antes servía cualquier
// token firmado, incluido el temporal del 2FA).
async function buildLinkState(req) {
  const token = extractToken(req)
  if (!token) return ''
  try {
    const { decoded } = await verifySessionToken(token)
    const returnTo = safeReturnPath(req.query?.return)
    return jwt.sign(
      { purpose: 'discord-link', sub: decoded.sub, ...(returnTo ? { r: returnTo } : {}) },
      config.jwt.secret,
      { expiresIn: '10m' }
    )
  } catch {
    return ''
  }
}

function readLinkState(state) {
  if (!state) return null
  try {
    const decoded = jwt.verify(state, config.jwt.secret)
    if (decoded.purpose !== 'discord-link') return null
    return { sub: decoded.sub, returnTo: safeReturnPath(decoded.r) }
  } catch {
    return null
  }
}

function buildLinkStateForUser(userId, returnTo = '') {
  return jwt.sign(
    { purpose: 'discord-link', sub: String(userId), ...(safeReturnPath(returnTo) ? { r: safeReturnPath(returnTo) } : {}) },
    config.jwt.secret,
    { expiresIn: '10m' }
  )
}

function discordReturnUrl(returnTo, status, extra = {}) {
  const back = safeReturnPath(returnTo) || '/ajustes?tab=conexiones'
  const params = new URLSearchParams({ discord: status, ...extra })
  return `${config.clientOrigin}${back}${back.includes('?') ? '&' : '?'}${params}`
}

// Pista corta para mostrarle a alguien a quien le rechazamos vincular un
// Discord ya usado: nombre + inicial del apellido, nunca el apellido
// completo ni el email, para no exponer de mas la identidad de otra cuenta.
function ownerHint(user) {
  const first = String(user?.firstName || '').trim()
  if (!first) return ''
  const lastInitial = String(user?.lastName || '').trim().charAt(0)
  return lastInitial ? `${first} ${lastInitial}.` : first
}

function onlyDigits(value) {
  return String(value || '').replace(/\D/g, '')
}

function hashWhatsappCode(code) {
  return crypto.createHash('sha256').update(String(code || '').trim().toUpperCase()).digest('hex')
}

function createWhatsappLinkCode() {
  const n = crypto.randomInt(0, 1_000_000).toString().padStart(6, '0')
  return `GG-${n}`
}

function setAuthCookie(res, token) {
  const maxAge = 7 * 24 * 60 * 60 * 1000
  res.setHeader('Set-Cookie',
    `${config.cookie.name}=${token}; Path=/; HttpOnly; SameSite=${config.cookie.sameSite}; Max-Age=${maxAge / 1000}${config.cookie.secure ? '; Secure' : ''}${config.cookie.domain ? `; Domain=${config.cookie.domain}` : ''}`
  )
}

function clearAuthCookie(res) {
  res.setHeader('Set-Cookie',
    `${config.cookie.name}=; Path=/; HttpOnly; SameSite=${config.cookie.sameSite}; Max-Age=0${config.cookie.secure ? '; Secure' : ''}`
  )
}

export async function register(req, res, next) {
  try {
    const result = await registerUser(req.body, { req })
    setAuthCookie(res, result.token)
    syncUserToCrm(result.user, 'glitchgang-web')
    res.status(201).json({ token: result.token, user: result.user })
  } catch (err) { next(err) }
}

export async function login(req, res, next) {
  try {
    const result = await loginUser(req.body, { req })
    if (result.requiresTwoFactor) {
      return res.json({ requiresTwoFactor: true, tempToken: result.tempToken })
    }
    setAuthCookie(res, result.token)
    res.json({ token: result.token, user: result.user })
  } catch (err) { next(err) }
}

export async function logout(req, res, next) {
  try {
    await logoutUser(req.tokenJti)
    clearAuthCookie(res)
    res.json({ message: 'Logged out successfully' })
  } catch (err) { next(err) }
}

export async function me(req, res, next) {
  try {
    // Misma forma que login/registro: `_id` y `id` (ver publicUser).
    const user = { ...req.user, id: String(req.user._id) }
    // Cosmeticos desbloqueados (calculados) y lo equipado ya corregido si se vencio.
    if (config.mongoEnabled) user.cosmeticUnlocks = await syncCosmetics(user)
    res.json({ user })
  } catch (err) { next(err) }
}

export async function getCsrfToken(req, res) {
  res.json({ csrfToken: req.csrfToken })
}

export async function sendVerification(req, res, next) {
  try {
    await sendEmailVerification({ userId: req.user._id })
    res.json({ message: 'Verification email sent' })
  } catch (err) { next(err) }
}

export async function confirmEmail(req, res, next) {
  try {
    await verifyEmail(req.body)
    res.json({ message: 'Email verified successfully' })
  } catch (err) { next(err) }
}

export async function forgotPassword(req, res, next) {
  try {
    const result = await requestPasswordReset(req.body)
    res.json({ message: 'Reset link sent.', ...result })
  } catch (err) { next(err) }
}

export async function updatePassword(req, res, next) {
  try {
    await resetPassword(req.body)
    res.json({ message: 'Password updated successfully.' })
  } catch (err) { next(err) }
}

export async function changeMyPassword(req, res, next) {
  try {
    await changePassword(req.user._id, req.body || {}, { keepJti: req.tokenJti })
    res.json({ message: 'Contraseña actualizada. Se cerraron tus otras sesiones.' })
  } catch (err) { next(err) }
}

// ─── 2FA ────────────────────────────────────────────────────────────────────

export async function twoFactorSetup(req, res, next) {
  try {
    const { secret, otpauth } = await setup2FA(req.user._id)
    const { default: QRCode } = await import('qrcode')
    const qrDataUrl = await QRCode.toDataURL(otpauth)
    res.json({ secret, qrCode: qrDataUrl })
  } catch (err) { next(err) }
}

export async function twoFactorEnable(req, res, next) {
  try {
    const result = await enable2FA(req.user._id, req.body.code)
    res.json({ message: '2FA enabled successfully', backupCodes: result.backupCodes })
  } catch (err) { next(err) }
}

export async function twoFactorVerify(req, res, next) {
  try {
    const result = await verify2FA(req.body, { req })
    setAuthCookie(res, result.token)
    res.json({ token: result.token, user: result.user })
  } catch (err) { next(err) }
}

export async function twoFactorDisable(req, res, next) {
  try {
    await disable2FA(req.user._id, req.body.password)
    res.json({ message: '2FA disabled successfully' })
  } catch (err) { next(err) }
}

// ─── sessions ────────────────────────────────────────────────────────────────

export async function listSessions(req, res, next) {
  try {
    const sessions = await getUserSessions(req.user._id)
    res.json({ sessions })
  } catch (err) { next(err) }
}

export async function deleteSession(req, res, next) {
  try {
    await revokeSession(req.user._id, req.params.id)
    res.json({ message: 'Session revoked' })
  } catch (err) { next(err) }
}

// ─── Discord OAuth ───────────────────────────────────────────────────────────

export async function discordRedirect(req, res) {
  if (!config.discord.clientId) {
    return res.status(501).json({ message: 'Discord OAuth is not configured' })
  }
  res.redirect(getDiscordAuthUrl(await buildLinkState(req)))
}

export async function discordLinkUrl(req, res) {
  if (!config.discord.clientId) {
    return res.status(501).json({ message: 'Discord OAuth is not configured' })
  }
  const state = buildLinkStateForUser(req.user._id, req.body?.returnTo || req.query?.return || '/ajustes?tab=conexiones')
  res.json({ url: getDiscordAuthUrl(state) })
}

export async function discordCallback(req, res, next) {
  try {
    const { code, state } = req.query
    if (!code) return res.status(400).json({ message: 'Missing authorization code' })

    const tokens = await exchangeDiscordCode(code)
    const discordUser = await getDiscordUser(tokens.access_token)

    // Vino desde "Conectar" en Ajustes con sesion activa -> vincula a ESA
    // cuenta, nunca busca ni crea otra.
    const linkState = readLinkState(state)
    if (state && !linkState) {
      console.warn('[discordCallback] state invalido o vencido (link)', { hasState: Boolean(state) })
      return res.redirect(discordReturnUrl('/ajustes?tab=conexiones', 'state-error'))
    }
    if (linkState?.sub) {
      const existingOwner = await User.findOne({ 'discord.id': discordUser.id })
      if (existingOwner && existingOwner._id.toString() !== linkState.sub) {
        console.warn('[discordCallback] discord ya vinculado a otra cuenta', {
          discordId: discordUser.id, existingOwner: existingOwner._id.toString(), sub: linkState.sub,
        })
        const hint = ownerHint(existingOwner)
        return res.redirect(discordReturnUrl(linkState.returnTo, 'already-linked', hint ? { owner: hint } : {}))
      }

      const discordUsername = discordUser.global_name || discordUser.username || ''
      const update = await User.updateOne(
        { _id: linkState.sub },
        { $set: { discord: { id: String(discordUser.id), username: discordUsername } } },
        { runValidators: true }
      )
      if (!update.matchedCount) {
        console.error('[discordCallback] updateOne no matcheo ningun usuario', {
          sub: linkState.sub, discordId: discordUser.id, update,
        })
        return res.redirect(discordReturnUrl(linkState.returnTo, 'error'))
      }

      const linkedUser = await User.findById(linkState.sub)
      if (!linkedUser?.discord?.id) {
        console.error('[discordCallback] re-fetch no muestra discord.id tras el update', {
          sub: linkState.sub, discordId: discordUser.id, matchedCount: update.matchedCount,
          modifiedCount: update.modifiedCount, refetched: linkedUser?.discord,
        })
        return res.redirect(discordReturnUrl(linkState.returnTo, 'error'))
      }
      console.log('[discordCallback] discord vinculado ok', { sub: linkState.sub, discordId: discordUser.id })
      syncUserToCrm(linkedUser, 'discord-oauth')
      return res.redirect(discordReturnUrl(linkState.returnTo, 'linked'))
    }

    // Sin sesion activa: es login/signup con Discord, no vinculacion.
    // Find existing user by Discord ID or matching email
    let user = await User.findOne({ 'discord.id': discordUser.id })

    if (!user && discordUser.email) {
      user = await User.findOne({ email: discordUser.email.toLowerCase() })
      if (user) {
        await User.updateOne({ _id: user._id }, {
          $set: {
            'discord.id': discordUser.id,
            'discord.username': discordUser.username,
          },
        })
        user = await User.findById(user._id)
      }
    }

    if (!user) {
      const params = new URLSearchParams({
        discord_id: discordUser.id,
        discord_username: discordUser.username,
        email: discordUser.email ?? '',
      })
      return res.redirect(`${config.clientOrigin}/register?${params}`)
    }

    const jti = crypto.randomUUID()
    const authToken = jwt.sign({ sub: user._id.toString(), role: user.role, jti }, config.jwt.secret, { expiresIn: config.jwt.expiresIn })

    await Session.create({
      userId: user._id,
      jti,
      userAgent: req.headers['user-agent'] ?? '',
      ip: req.ip ?? '',
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    })

    setAuthCookie(res, authToken)
    res.redirect(`${config.clientOrigin}/app`)
  } catch (err) { next(err) }
}

/**
 * POST /api/auth/discord/link/confirm — confirma la vinculación iniciada
 * desde el comando /vincular del bot (requiere sesión web activa).
 * body: { token } — JWT de un solo uso emitido por POST /api/bots/link/start.
 */
export async function discordLinkConfirm(req, res, next) {
  try {
    const { token } = req.body || {}
    if (!token) return res.status(400).json({ message: 'Missing token' })

    let payload
    try {
      payload = jwt.verify(token, config.jwt.secret)
    } catch {
      return res.status(400).json({ message: 'Link expired or invalid' })
    }
    if (payload.purpose !== 'discord-link' || !payload.discordId) {
      return res.status(400).json({ message: 'Invalid link token' })
    }

    const taken = await User.findOne({ 'discord.id': payload.discordId, _id: { $ne: req.user._id } })
    if (taken) {
      const hint = ownerHint(taken)
      return res.status(409).json({
        message: hint
          ? `Esa cuenta de Discord ya esta vinculada a otra cuenta de GlitchGang (${hint}).`
          : 'Esa cuenta de Discord ya esta vinculada a otra cuenta de GlitchGang.',
      })
    }

    await User.updateOne({ _id: req.user._id }, {
      $set: {
        'discord.id': payload.discordId,
        'discord.username': payload.discordUsername || '',
      },
    })

    syncUserToCrm(
      { ...req.user, discord: { id: payload.discordId, username: payload.discordUsername || '' } },
      'discord-bot'
    )

    res.json({
      message: 'Discord account linked successfully',
      discord: { id: payload.discordId, username: payload.discordUsername || '' },
    })
  } catch (err) { next(err) }
}

/** DELETE /api/auth/discord/link — desvincula la cuenta de Discord. */
export async function discordUnlink(req, res, next) {
  try {
    await User.updateOne({ _id: req.user._id }, { $set: { 'discord.id': null, 'discord.username': null } })
    res.json({ message: 'Discord account unlinked' })
  } catch (err) { next(err) }
}

/**
 * POST /api/auth/whatsapp/link/start
 * Body: { phone }  — the user's WhatsApp number. Generates a 6-digit code,
 * stores it (pending) and sends it to that number over WhatsApp. The user
 * then confirms it on /api/auth/whatsapp/link/confirm.
 * (Legacy: with no body it keeps the old "send the code to the bot" behaviour.)
 */
export async function whatsappLinkStart(req, res, next) {
  try {
    const rawPhone = req.body?.phone
    const code = createWhatsappLinkCode()
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000)

    // Legacy path: no phone given -> code goes to the bot as before.
    if (!rawPhone) {
      await User.updateOne({ _id: req.user._id }, {
        'whatsapp.linkCodeHash': hashWhatsappCode(code),
        'whatsapp.linkCodeExpiresAt': expiresAt,
      })
      return res.json({
        code, expiresAt,
        command: `!vincular ${code}`,
        message: 'Codigo generado. Envialo al bot para completar la vinculacion.',
      })
    }

    if (!isValidPhone(rawPhone)) {
      return res.status(400).json({ message: 'Numero de WhatsApp invalido. Incluye el codigo de pais.' })
    }
    const phone = normalizePhone(rawPhone)

    const taken = await User.findOne({
      'whatsapp.phone': phone, 'whatsapp.verified': true, _id: { $ne: req.user._id },
    }).lean()
    if (taken) return res.status(409).json({ message: 'Ese numero ya esta vinculado a otra cuenta.' })

    await User.updateOne({ _id: req.user._id }, {
      'whatsapp.phone': phone,
      'whatsapp.verified': false,
      'whatsapp.linkCodeHash': hashWhatsappCode(code),
      'whatsapp.linkCodeExpiresAt': expiresAt,
    })

    let delivery = 'sent'
    try {
      const r = await sendWhatsappCode(phone, code)
      if (!r.sent) delivery = 'not-configured'
    } catch (err) {
      console.error('[whatsapp] OTP send failed:', err.message)
      delivery = 'error'
    }

    res.json({
      phone,
      expiresAt,
      delivery,
      // Local/dev only: expose the code so the flow is testable without a real send.
      ...(config.whatsapp.devReturnCode && delivery !== 'sent' ? { devCode: code } : {}),
      message: delivery === 'sent'
        ? 'Te enviamos un codigo por WhatsApp.'
        : 'Codigo generado (envio de WhatsApp no configurado en este entorno).',
    })
  } catch (err) { next(err) }
}

/** POST /api/auth/whatsapp/link/confirm — Body: { code } */
export async function whatsappLinkConfirm(req, res, next) {
  try {
    const code = String(req.body?.code || '').trim()
    if (!code) return res.status(400).json({ message: 'Falta el codigo.' })

    const user = await User.findById(req.user._id).select('+whatsapp.linkCodeHash +whatsapp.linkCodeExpiresAt')
    if (!user?.whatsapp?.linkCodeHash) {
      return res.status(400).json({ message: 'No hay una verificacion pendiente. Pide un codigo nuevo.' })
    }
    if (user.whatsapp.linkCodeExpiresAt && user.whatsapp.linkCodeExpiresAt.getTime() < Date.now()) {
      return res.status(400).json({ message: 'El codigo vencio. Pide uno nuevo.' })
    }
    if (hashWhatsappCode(code) !== user.whatsapp.linkCodeHash) {
      return res.status(400).json({ message: 'Codigo incorrecto.' })
    }

    await User.updateOne({ _id: user._id }, {
      'whatsapp.verified': true,
      'whatsapp.linkedAt': new Date(),
      'whatsapp.linkCodeHash': '',
      'whatsapp.linkCodeExpiresAt': null,
      'social.whatsapp': user.whatsapp.phone || '',
    })

    res.json({ message: 'WhatsApp verificado.', phone: user.whatsapp.phone, verified: true })
  } catch (err) { next(err) }
}

/** DELETE /api/auth/whatsapp/link — desvincula el numero de WhatsApp. */
export async function whatsappUnlink(req, res, next) {
  try {
    await User.updateOne({ _id: req.user._id }, {
      'whatsapp.phone': '',
      'whatsapp.verified': false,
      'whatsapp.linkedAt': null,
      'whatsapp.linkCodeHash': '',
      'whatsapp.linkCodeExpiresAt': null,
      'social.whatsapp': '',
    })
    res.json({ message: 'WhatsApp account unlinked' })
  } catch (err) { next(err) }
}
