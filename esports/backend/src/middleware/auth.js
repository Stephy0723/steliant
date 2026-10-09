// Compatibility bridge for routes that still import the legacy middleware name.
// All authentication now goes through the canonical implementation so JWT
// secrets, cookies, revoked sessions and banned users behave consistently.
export { requireAuth as authenticateToken } from './auth.middleware.js'
