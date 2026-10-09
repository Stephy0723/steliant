function notFound(req, res) {
  res.status(404).json({
    message: "Ruta no encontrada",
    path: req.originalUrl
  });
}

function errorHandler(error, _req, res, _next) {
  console.error(error);

  res.status(error.status || 500).json({
    message: error.message || "Error interno del servidor"
  });
}

module.exports = { notFound, errorHandler };
