export function requireAdmin(req, res, next) {
  if (req.user?.role !== 'admin') {
    const error = new Error('Admin access required')
    error.status = 403
    return next(error)
  }
  next()
}
