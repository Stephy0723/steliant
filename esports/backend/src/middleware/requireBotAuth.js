// Autentica llamadas del bot de Discord contra un secreto compartido.
// No hay sesión de usuario en estas llamadas: la identidad del jugador
// viaja como `discordId` en el payload y se resuelve dentro del controller.
export function requireBotAuth(req, res, next) {
  const expected = process.env.BOT_API_KEY || ''
  const provided = req.headers['x-glitchgang-bot-key'] || ''

  if (!expected || provided !== expected) {
    return res.status(401).json({ message: 'Invalid or missing bot API key' })
  }

  next()
}
