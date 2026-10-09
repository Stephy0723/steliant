import { Router } from 'express'
import {
  register, login, logout, me, getCsrfToken,
  sendVerification, confirmEmail,
  forgotPassword, updatePassword,
  twoFactorSetup, twoFactorEnable, twoFactorVerify, twoFactorDisable,
  listSessions, deleteSession,
  discordRedirect, discordCallback, discordLinkUrl, discordLinkConfirm, discordUnlink,
  whatsappLinkStart, whatsappLinkConfirm, whatsappUnlink, changeMyPassword
} from '../controllers/auth.controller.js'
import { requireAuth } from '../middleware/auth.middleware.js'
import { authLimiter, passwordLimiter } from '../middleware/rateLimit.js'

const router = Router()

// Public
router.get('/csrf-token', getCsrfToken)
router.post('/register', authLimiter, register)
router.post('/login', authLimiter, login)
router.post('/forgot-password', passwordLimiter, forgotPassword)
router.post('/reset-password', passwordLimiter, updatePassword)
router.post('/verify-email', confirmEmail)
router.post('/2fa/verify', authLimiter, twoFactorVerify)

// Discord OAuth
router.get('/discord', discordRedirect)
router.get('/discord/callback', discordCallback)
router.post('/discord/link-url', requireAuth, discordLinkUrl)
router.post('/discord/link/confirm', requireAuth, discordLinkConfirm)
router.delete('/discord/link', requireAuth, discordUnlink)
router.post('/whatsapp/link/start', requireAuth, whatsappLinkStart)
router.post('/whatsapp/link/confirm', requireAuth, whatsappLinkConfirm)
router.delete('/whatsapp/link', requireAuth, whatsappUnlink)

// Authenticated
router.post('/logout', requireAuth, logout)
router.get('/me', requireAuth, me)
router.post('/change-password', requireAuth, passwordLimiter, changeMyPassword)
router.post('/send-verification-email', requireAuth, sendVerification)

// 2FA setup (requires auth)
router.post('/2fa/setup', requireAuth, twoFactorSetup)
router.post('/2fa/enable', requireAuth, twoFactorEnable)
router.post('/2fa/disable', requireAuth, twoFactorDisable)

// Sessions
router.get('/sessions', requireAuth, listSessions)
router.delete('/sessions/:id', requireAuth, deleteSession)

export default router
