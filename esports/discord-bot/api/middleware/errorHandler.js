// ============================================
// GlitchGang API - Error Handler Middleware
// ============================================

function notFoundHandler(req, res, next) {
  res.status(404).json({
    error: 'Not Found',
    message: `Ruta ${req.method} ${req.originalUrl} no existe`,
  });
}

function errorHandler(err, req, res, next) {
  console.error('[API Error]', err.message);
  res.status(err.status || 500).json({
    error: err.name || 'Internal Server Error',
    message: err.message || 'Error interno del servidor',
  });
}

module.exports = { notFoundHandler, errorHandler };
