// OAuth (Discord / Google) — estructura lista. Sin client IDs responde "no configurado".
// Cuando agregues las credenciales se implementa el intercambio de código por token.
const providers = {
  discord: {
    configured: () => !!(process.env.DISCORD_CLIENT_ID && process.env.DISCORD_CLIENT_SECRET),
    authorizeUrl: (redirect) =>
      `https://discord.com/oauth2/authorize?client_id=${process.env.DISCORD_CLIENT_ID}` +
      `&response_type=code&scope=identify%20email&redirect_uri=${encodeURIComponent(redirect)}`,
  },
  google: {
    configured: () => !!(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET),
    authorizeUrl: (redirect) =>
      `https://accounts.google.com/o/oauth2/v2/auth?client_id=${process.env.GOOGLE_CLIENT_ID}` +
      `&response_type=code&scope=openid%20email%20profile&redirect_uri=${encodeURIComponent(redirect)}`,
  },
}

export function oauthStatus(_req, res) {
  res.json({
    discord: providers.discord.configured(),
    google: providers.google.configured(),
  })
}

export function oauthStart(req, res) {
  const provider = providers[req.params.provider]
  if (!provider) return res.status(404).json({ error: 'Proveedor desconocido' })
  if (!provider.configured()) {
    return res.status(501).json({ error: `OAuth de ${req.params.provider} no configurado (faltan CLIENT_ID/SECRET)` })
  }
  const redirect = `${req.protocol}://${req.get('host')}/api/oauth/${req.params.provider}/callback`
  res.json({ url: provider.authorizeUrl(redirect) })
}

export function oauthCallback(req, res) {
  // TODO: intercambiar req.query.code por token, crear/iniciar sesión y redirigir al front.
  res.status(501).json({ error: 'Callback OAuth pendiente de implementar (requiere credenciales)' })
}
