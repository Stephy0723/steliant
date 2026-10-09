// Bloquea crear contenido (posts, comentarios, mensajes) a una cuenta con una
// restriccion de moderacion vigente (User.mutedUntil, puesta desde
// /admin/moderacion). Va despues de requireAuth: req.user es el doc completo.
export function rejectIfMuted(req, res, next) {
  const until = req.user?.mutedUntil ? new Date(req.user.mutedUntil) : null
  if (until && until.getTime() > Date.now()) {
    return res.status(403).json({
      message: `Tu cuenta tiene una restriccion de moderacion hasta el ${until.toLocaleDateString('es-DO')}. No puedes publicar ni enviar mensajes por ahora.`,
      code: 'ACCOUNT_MUTED',
      mutedUntil: until.toISOString(),
    })
  }
  next()
}
