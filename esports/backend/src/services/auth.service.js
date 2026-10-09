import crypto from 'node:crypto'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import { generateSecret as totpGenerateSecret, generateToken as totpGenerate, verifyToken as totpVerify, generateUri as totpUri } from './totp.service.js'
import { config } from '../config/index.js'
import { User } from '../models/User.js'
import { Session } from '../models/Session.js'
import { PasswordResetToken } from '../models/PasswordResetToken.js'
import { createPlayerCodes, getFirstNameInitial, getLastNameInitials, formatYYMMDD } from './codes.service.js'
import { requireCountryNumber } from './countries.service.js'
import { sendPasswordResetEmail, sendVerificationEmail, sendWelcomeEmail } from './email.service.js'
import { notifyNewLogin } from './notifications.service.js'
import { syncCosmetics } from './cosmetics.service.js'

const SALT_ROUNDS = 12
const demoUsers = new Map()

// ─── helpers ────────────────────────────────────────────────────────────────

function normalizeEmail(value = '') {
  return String(value).trim().toLowerCase()
}

function hashToken(token = '') {
  return crypto.createHash('sha256').update(String(token)).digest('hex')
}

function validationError(message) {
  return Object.assign(new Error(message), { status: 400 })
}

function conflictError(message) {
  return Object.assign(new Error(message), { status: 409 })
}

// Lleva `_id` Y `id` (el mismo valor): el frontend usa las dos formas
// (~70 sitios user._id, ~60 user.id) y /auth/me devuelve el documento con
// `_id`. Antes aqui solo iba `id`, asi que justo despues de login/registro
// toda comparacion user._id === autor._id fallaba (editar/borrar mis posts,
// "soy el lider", etc.) hasta el siguiente refresco de sesion.
function publicUser(user) {
  const userId = user._id.toString()
  return {
    _id:           userId,
    id:            userId,
    playerCode:    user.playerCode,
    internalCode:  user.internalCode,
    nick:          user.nick,
    email:         user.email,
    firstName:     user.firstName,
    lastName:      user.lastName,
    countryCode:   user.countryCode,
    region:        user.region || user.countryCode,
    phoneCountryDial: user.phoneCountryDial,
    phoneNumber:   user.phoneNumber,
    birthDate:     user.birthDate,
    gender:        user.gender,
    languages:     user.languages,
    games:         user.games,
    experienceLevel: user.experienceLevel,
    mainPlatform:  user.mainPlatform,
    lookingFor:    user.lookingFor,
    role:          user.role,
    roles:         user.roles,
    roleProfiles:  user.roleProfiles,
    plan:          user.plan,
    gp:            user.gp,
    avatar:        user.avatar,
    bio:           user.bio,
    status:        user.status,
    activeFrame:   user.activeFrame,
    activeBg:      user.activeBg,
    activeStatus:  user.activeStatus,
    activeBadge:   user.activeBadge,
    activeCustomBg:user.activeCustomBg,
    activeCardDesign: user.activeCardDesign,
    activeCardBg: user.activeCardBg,
    activeCardCustomBg: user.activeCardCustomBg,
    social:        user.social,
    gamerProfile:  user.gamerProfile,
    privacy:       user.privacy,
    notificationPrefs: user.notificationPrefs,
    security:      user.security,
    emailVerified: user.emailVerified,
    twoFactorEnabled: user.twoFactorEnabled,
    discord:       user.discord,
    whatsapp:      {
      phone: user.whatsapp?.phone || '',
      verified: Boolean(user.whatsapp?.verified),
      linkedAt: user.whatsapp?.linkedAt || null,
    },
    referralCode:  user.referralCode,
    university:    user.university,
    team:          user.team,
    createdAt:     user.createdAt,
    updatedAt:     user.updatedAt,
  }
}

// alertOnNewDevice: solo true en logins explícitos (loginUser/verify2FA), no
// en registro (ya manda welcome email) ni en modo demo. Ajustes/Seguridad
// "Alertas de inicio de sesión" -- antes no existía ninguna detección de
// dispositivo nuevo en el backend, el toggle no hacía nada.
async function createSession(user, { req, rememberMe = false, alertOnNewDevice = false } = {}) {
  const jti = crypto.randomUUID()
  const expiresIn = rememberMe ? '30d' : config.jwt.expiresIn
  const token = jwt.sign({ sub: user._id.toString(), role: user.role, jti }, config.jwt.secret, { expiresIn })

  if (config.mongoEnabled) {
    const expiresAt = new Date(Date.now() + parseDuration(expiresIn))
    const userAgent = req?.headers?.['user-agent'] ?? ''
    const ip = req?.ip ?? ''

    let isKnownDevice = true
    if (alertOnNewDevice && userAgent) {
      isKnownDevice = Boolean(await Session.exists({ userId: user._id, userAgent }))
    }

    await Session.create({ userId: user._id, jti, userAgent, ip, expiresAt })

    if (alertOnNewDevice && !isKnownDevice) {
      notifyNewLogin(user, { ip, userAgent }).catch(() => {})
    }
  }

  const sessionUser = publicUser(user)
  if (config.mongoEnabled) {
    // Igual que /auth/me: grants calculados y lo equipado ya corregido.
    const view = { ...sessionUser, cosmeticGrants: user.cosmeticGrants }
    sessionUser.cosmeticUnlocks = await syncCosmetics(view)
    for (const field of ['activeFrame', 'activeStatus', 'activeBadge']) sessionUser[field] = view[field]
  }
  return { token, user: sessionUser }
}

function parseDuration(str) {
  const units = { s: 1000, m: 60_000, h: 3_600_000, d: 86_400_000 }
  const match = String(str).match(/^(\d+)([smhd])$/)
  if (!match) return 7 * 86_400_000
  return Number(match[1]) * units[match[2]]
}

// ─── register ───────────────────────────────────────────────────────────────

export async function registerUser(payload, opts = {}) {
  if (!config.mongoEnabled) return registerDemoUser(payload)

  const {
    nick, email, password,
    firstName, lastName, countryCode,
    phoneCountryDial, phoneNumber,
    birthDate, gender,
    games = [], experienceLevel, mainPlatform,
    lookingFor = [], referralCode = '', acceptedTerms,
    discordId = '', discordUsername = '',
  } = payload

  const cleanNick      = String(nick || '').trim()
  const cleanEmail     = normalizeEmail(email)
  const cleanFirstName = String(firstName || '').trim()
  const cleanLastName  = String(lastName || '').trim()
  const cleanPhoneDial = String(phoneCountryDial || '').trim()
  const cleanPhone     = String(phoneNumber || '').trim()
  const cleanGames     = [...new Set((games).map(String).map(v => v.trim()).filter(Boolean))]
  const cleanLookingFor= [...new Set((lookingFor).map(String).map(v => v.trim()).filter(Boolean))]
  const parsedBirthDate= new Date(birthDate)
  const { code }       = requireCountryNumber(countryCode)

  if (cleanFirstName.length < 2)    throw validationError('First name is required')
  if (cleanLastName.length < 2)     throw validationError('Last name is required')
  if (cleanNick.length < 3 || cleanNick.length > 32) throw validationError('Nick must be 3–32 characters')
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) throw validationError('Valid email is required')
  if (String(password || '').length < 8) throw validationError('Password must be at least 8 characters')
  if (!cleanPhoneDial || !cleanPhone) throw validationError('Phone number is required')
  if (cleanPhoneDial.length > 5) throw validationError('Dial code is too long')
  if (cleanPhone.replace(/\D/g, '').length > 15) throw validationError('Phone number is too long')
  if (Number.isNaN(parsedBirthDate.getTime())) throw validationError('Valid birth date is required')
  if (!gender)             throw validationError('Gender is required')
  if (!cleanGames.length)  throw validationError('Select at least one game')
  if (!experienceLevel)    throw validationError('Experience level is required')
  if (!mainPlatform)       throw validationError('Main platform is required')
  if (!cleanLookingFor.length) throw validationError('Select what you are looking for')
  if (!acceptedTerms)      throw validationError('You must accept the terms')

  const duplicate = await User.findOne({ $or: [{ email: cleanEmail }, { nick: cleanNick }] }).collation({ locale: 'en', strength: 2 }).lean()
  if (duplicate) throw conflictError(duplicate.email === cleanEmail ? 'Email is already registered' : 'Nick is already in use')

  const { publicCode, internalCode } = await createPlayerCodes(code, cleanFirstName, parsedBirthDate, cleanLastName)

  // Email verification token
  const verifyToken   = crypto.randomBytes(32).toString('hex')
  const verifyExpires = new Date(Date.now() + 24 * 60 * 60 * 1000)

  // El codigo que escribe al registrarse es el de QUIEN LO INVITO: se guarda
  // como referredBy. Antes se guardaba como su propio referralCode, asi que
  // invitado e invitador compartian codigo y no se podia contar a nadie.
  const inviteCode = String(referralCode || '').trim().toUpperCase()
  const inviter = inviteCode
    ? await User.findOne({ referralCode: inviteCode }).select('_id').lean()
    : null

  const user = await User.create({
    playerCode:    publicCode,
    internalCode,
    nick:          cleanNick,
    email:         cleanEmail,
    passwordHash:  await bcrypt.hash(password, SALT_ROUNDS),
    firstName:     cleanFirstName,
    lastName:      cleanLastName,
    countryCode:   code,
    region:        code,
    phoneCountryDial: cleanPhoneDial,
    phoneNumber:   cleanPhone,
    birthDate:     parsedBirthDate,
    gender,
    games:         cleanGames,
    experienceLevel,
    mainPlatform,
    lookingFor:    cleanLookingFor,
    referredBy:    inviter?._id || null,
    acceptedTermsAt: new Date(),
    emailVerificationToken:   hashToken(verifyToken),
    emailVerificationExpires: verifyExpires,
    ...(discordId ? { discord: { id: String(discordId), username: String(discordUsername || '') } } : {}),
  })

  const verifyUrl = `${config.clientOrigin}/verify-email?token=${verifyToken}`
  // Sin log, un cupo agotado en Resend o un SMTP caido pasaba inadvertido:
  // el registro sigue funcionando, pero el error queda en pm2 logs --err.
  sendVerificationEmail({ to: cleanEmail, verifyUrl })
    .catch(err => console.error(`[email] verificacion a ${cleanEmail} fallo:`, err.message))
  sendWelcomeEmail({ to: cleanEmail, nick: cleanNick })
    .catch(err => console.error(`[email] bienvenida a ${cleanEmail} fallo:`, err.message))

  return createSession(user, opts)
}

// ─── login ──────────────────────────────────────────────────────────────────

export async function loginUser({ identifier, password, rememberMe = false }, opts = {}) {
  if (!config.mongoEnabled) return loginDemoUser({ identifier, password })

  const clean = String(identifier || '').trim()
  const isEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(clean)
  const query = isEmail ? { email: clean.toLowerCase() } : { nick: clean }

  // El nick se busca exacto y, si no aparece, sin distinguir mayúsculas: el
  // teclado del celular pone "Kairo" donde la cuenta es "kairo". La exacta
  // gana por si quedan cuentas viejas con el mismo nick en otra capitalización.
  let user = await User.findOne(query).select('+passwordHash')
  if (!user && !isEmail) {
    user = await User.findOne(query).collation({ locale: 'en', strength: 2 }).select('+passwordHash')
  }
  if (!user || !(await bcrypt.compare(String(password || ''), user.passwordHash))) {
    throw Object.assign(new Error('Invalid credentials'), { status: 401 })
  }
  if (user.deleted) throw Object.assign(new Error('Account not found'), { status: 401 })
  if (user.isBanned) throw Object.assign(new Error('Account suspended'), { status: 403 })

  // If 2FA is enabled, return a partial token instead
  if (user.twoFactorEnabled) {
    const tempToken = jwt.sign(
      // rememberMe viaja en el token temporal para que verify2FA emita la
      // sesión con la misma duración que pidió el usuario.
      { sub: user._id.toString(), require2fa: true, rememberMe: Boolean(rememberMe) },
      config.jwt.secret,
      { expiresIn: '5m' }
    )
    return { requiresTwoFactor: true, tempToken }
  }

  return createSession(user, { ...opts, rememberMe, alertOnNewDevice: true })
}

// ─── logout ─────────────────────────────────────────────────────────────────

export async function logoutUser(jti) {
  if (!config.mongoEnabled || !jti) return
  await Session.updateOne({ jti }, { revokedAt: new Date() })
}

// ─── email verification ─────────────────────────────────────────────────────

export async function sendEmailVerification({ userId }) {
  const user = await User.findById(userId)
  if (!user || user.emailVerified) return

  const token   = crypto.randomBytes(32).toString('hex')
  const expires = new Date(Date.now() + 24 * 60 * 60 * 1000)

  await User.updateOne({ _id: userId }, {
    emailVerificationToken:   hashToken(token),
    emailVerificationExpires: expires,
  })

  const verifyUrl = `${config.clientOrigin}/verify-email?token=${token}`
  await sendVerificationEmail({ to: user.email, verifyUrl })
}

export async function verifyEmail({ token }) {
  const user = await User.findOne({
    emailVerificationToken:   hashToken(token),
    emailVerificationExpires: { $gt: new Date() },
  }).select('+emailVerificationToken +emailVerificationExpires')

  if (!user) throw Object.assign(new Error('Verification link is invalid or expired'), { status: 400 })

  await User.updateOne({ _id: user._id }, {
    emailVerified:            true,
    emailVerificationToken:   null,
    emailVerificationExpires: null,
  })
}

// ─── password reset ──────────────────────────────────────────────────────────

export async function requestPasswordReset({ email }) {
  if (!config.mongoEnabled) return {}

  const user = await User.findOne({ email: normalizeEmail(email) })
  if (!user) throw Object.assign(new Error('No existe una cuenta registrada con ese correo.'), { status: 404 })

  await PasswordResetToken.deleteMany({ userId: user._id })
  const token = crypto.randomBytes(32).toString('hex')
  await PasswordResetToken.create({
    userId:    user._id,
    tokenHash: hashToken(token),
    expiresAt: new Date(Date.now() + 30 * 60 * 1000),
  })

  const resetUrl = `${config.clientOrigin}/reset-password?token=${token}`
  sendPasswordResetEmail({ to: user.email, nick: user.nick, resetUrl })
    .catch(err => console.error(`[email] recuperacion de contrasena a ${user.email} fallo:`, err.message))

  return config.isProd ? {} : { resetToken: token }
}

export async function resetPassword({ token, password }) {
  if (!config.mongoEnabled) return

  if (String(password || '').length < 8) throw validationError('Password must be at least 8 characters')

  const reset = await PasswordResetToken.findOne({
    tokenHash: hashToken(token),
    expiresAt: { $gt: new Date() },
  })
  if (!reset) throw validationError('Reset token is invalid or expired')

  await User.updateOne({ _id: reset.userId }, {
    $set: {
      passwordHash:    await bcrypt.hash(password, SALT_ROUNDS),
      passwordChangedAt: new Date(),
    },
  })
  await PasswordResetToken.deleteMany({ userId: reset.userId })
  // Revoke all sessions for this user
  await Session.updateMany({ userId: reset.userId, revokedAt: null }, { revokedAt: new Date() })
}

// Cambiar contraseña con la sesion iniciada (Ajustes -> Seguridad): pide la
// actual, y cierra las DEMAS sesiones (la que hizo el cambio sigue viva).
export async function changePassword(userId, { currentPassword, newPassword }, { keepJti = null } = {}) {
  if (!config.mongoEnabled) return
  if (String(newPassword || '').length < 8) throw validationError('La nueva contraseña debe tener al menos 8 caracteres.')
  const user = await User.findById(userId).select('+passwordHash')
  if (!user) throw Object.assign(new Error('User not found'), { status: 404 })
  if (!(await bcrypt.compare(String(currentPassword || ''), user.passwordHash))) {
    throw Object.assign(new Error('La contraseña actual no es correcta.'), { status: 400 })
  }
  if (await bcrypt.compare(String(newPassword), user.passwordHash)) {
    throw validationError('La nueva contraseña tiene que ser distinta de la actual.')
  }
  await User.updateOne({ _id: user._id }, {
    $set: { passwordHash: await bcrypt.hash(String(newPassword), SALT_ROUNDS), passwordChangedAt: new Date() },
  })
  await PasswordResetToken.deleteMany({ userId: user._id })
  await Session.updateMany(
    { userId: user._id, revokedAt: null, ...(keepJti ? { jti: { $ne: keepJti } } : {}) },
    { revokedAt: new Date() },
  )
}

// ─── 2FA ────────────────────────────────────────────────────────────────────

export async function setup2FA(userId) {
  const secret = totpGenerateSecret()
  const user = await User.findById(userId)
  if (!user) throw Object.assign(new Error('User not found'), { status: 404 })

  await User.updateOne({ _id: userId }, { $set: { twoFactorSecret: secret } })

  const otpauth = totpUri(user.email, 'GlitchGang', secret)
  return { secret, otpauth }
}

export async function enable2FA(userId, code) {
  const user = await User.findById(userId).select('+twoFactorSecret +twoFactorBackupCodes')
  if (!user?.twoFactorSecret) throw validationError('2FA setup not started')

  const valid = totpVerify(code, user.twoFactorSecret)
  if (!valid) throw validationError('Invalid verification code')

  const backupCodes = Array.from({ length: 6 }, () => crypto.randomBytes(4).toString('hex'))
  const hashedBackups = await Promise.all(backupCodes.map(c => bcrypt.hash(c, 10)))

  await User.updateOne({ _id: userId }, {
    twoFactorEnabled:     true,
    twoFactorBackupCodes: hashedBackups,
  })

  return { backupCodes }
}

export async function verify2FA({ tempToken, code }, opts = {}) {
  let decoded
  try {
    decoded = jwt.verify(tempToken, config.jwt.secret)
  } catch {
    throw Object.assign(new Error('Invalid or expired token'), { status: 401 })
  }

  if (!decoded.require2fa) throw Object.assign(new Error('Invalid token type'), { status: 400 })

  const user = await User.findById(decoded.sub).select('+twoFactorSecret +twoFactorBackupCodes')
  if (!user) throw Object.assign(new Error('User not found'), { status: 404 })

  const isTotp = totpVerify(code, user.twoFactorSecret)
  const rememberMe = Boolean(decoded.rememberMe)
  if (isTotp) return createSession(user, { ...opts, rememberMe, alertOnNewDevice: true })

  // Try backup codes
  for (let i = 0; i < user.twoFactorBackupCodes.length; i++) {
    const match = await bcrypt.compare(code, user.twoFactorBackupCodes[i])
    if (match) {
      const remaining = [...user.twoFactorBackupCodes]
      remaining.splice(i, 1)
      await User.updateOne({ _id: user._id }, { twoFactorBackupCodes: remaining })
      return createSession(user, { ...opts, rememberMe, alertOnNewDevice: true })
    }
  }

  throw validationError('Invalid 2FA code')
}

export async function disable2FA(userId, password) {
  const user = await User.findById(userId).select('+passwordHash')
  if (!user) throw Object.assign(new Error('User not found'), { status: 404 })

  const valid = await bcrypt.compare(String(password || ''), user.passwordHash)
  if (!valid) throw validationError('Invalid password')

  await User.updateOne({ _id: userId }, {
    twoFactorEnabled:     false,
    twoFactorSecret:      null,
    twoFactorBackupCodes: [],
  })
}

// ─── sessions ───────────────────────────────────────────────────────────────

export async function getUserSessions(userId) {
  return Session.find({ userId, revokedAt: null, expiresAt: { $gt: new Date() } })
    .sort({ lastActiveAt: -1 })
    .lean()
}

export async function revokeSession(userId, sessionId) {
  const session = await Session.findOne({ _id: sessionId, userId })
  if (!session) throw Object.assign(new Error('Session not found'), { status: 404 })
  await Session.updateOne({ _id: sessionId }, { revokedAt: new Date() })
}

// ─── demo mode ──────────────────────────────────────────────────────────────

async function registerDemoUser(payload) {
  const { nick, email, password, firstName, lastName, countryCode, phoneCountryDial, phoneNumber, birthDate, gender, games = [], experienceLevel, mainPlatform, lookingFor = [], referralCode = '', acceptedTerms } = payload
  const cleanEmail = normalizeEmail(email)
  const { code, number } = requireCountryNumber(countryCode)

  if (String(password || '').length < 8) throw validationError('Password must be at least 8 characters')
  if (!acceptedTerms) throw validationError('You must accept the terms')
  if (demoUsers.has(cleanEmail)) throw conflictError('Email is already registered')

  const seq = String(demoUsers.size + 1).padStart(3, '0')
  const user = {
    _id: { toString: () => `demo-${Date.now()}` },
    playerCode: `${getFirstNameInitial(firstName)}${seq}-${number}`,
    internalCode: `${formatYYMMDD(birthDate)}-${getLastNameInitials(lastName)}-${seq}-${number}`,
    nick: String(nick || '').trim(),
    email: cleanEmail,
    firstName, lastName, countryCode: code, region: code,
    phoneCountryDial, phoneNumber, birthDate, gender,
    games, experienceLevel, mainPlatform, lookingFor,
    referralCode, role: 'player', roles: [], plan: 'Free', gp: 0,
    avatar: '', bio: '', status: 'offline',
    emailVerified: false, twoFactorEnabled: false,
    discord: { id: null, username: null }, team: null,
    passwordHash: await bcrypt.hash(String(password || ''), SALT_ROUNDS),
  }
  demoUsers.set(cleanEmail, user)
  return createSession(user)
}

async function loginDemoUser({ identifier, password }) {
  const clean = String(identifier || '').trim()
  const isEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(clean)
  const user = isEmail
    ? demoUsers.get(clean.toLowerCase())
    : [...demoUsers.values()].find(u => u.nick === clean)

  if (user && await bcrypt.compare(String(password || ''), user.passwordHash)) return createSession(user)

  if (clean && String(password || '').length >= 4) {
    return createSession({
      _id: { toString: () => 'demo-brooklyn' },
      playerCode: 'D001-01', internalCode: '000101-BP-001-01',
      nick: isEmail ? clean.split('@')[0] : clean,
      email: isEmail ? clean : `${clean}@demo.gg`,
      firstName: 'Demo', lastName: 'Player',
      countryCode: 'RD', phoneCountryDial: '+1', phoneNumber: '8090000000',
      birthDate: new Date('2000-01-01'), gender: 'prefer_not_to_say',
      games: ['val', 'ff'], experienceLevel: 'mid', mainPlatform: 'pc',
      lookingFor: ['tournaments'], referralCode: '',
      role: 'player', roles: [], plan: 'Free', gp: 2480,
      avatar: 'https://i.pravatar.cc/96?img=12', bio: '', status: 'online',
      emailVerified: true, twoFactorEnabled: false,
      discord: { id: null, username: null }, team: null,
    })
  }

  throw Object.assign(new Error('Invalid credentials'), { status: 401 })
}
