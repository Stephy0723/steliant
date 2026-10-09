function requireCrmAuth(req, res, next) {
  if (req.session?.crmUser) return next();

  if (req.path.startsWith("/api/")) {
    return res.status(401).json({ message: "No autenticado" });
  }

  return res.redirect("/crm/login");
}

function requirePermission(permission) {
  return (req, res, next) => {
    const user = req.session?.crmUser;
    const permissions = user?.permissions || [];

    if (user?.role === "admin" || permissions.includes("*") || permissions.includes(permission)) {
      return next();
    }

    return res.status(403).json({ message: "Permisos insuficientes" });
  };
}

module.exports = { requireCrmAuth, requirePermission };
