const router = require("express").Router();
const gg = require("../services/glitchgangApi");
const whatsappAuthRouter = require("./routes/whatsappAuth.routes");

// Rutas de autenticación por WhatsApp
router.use("/whatsapp", whatsappAuthRouter);

router.get("/health", (_req, res) => {
  res.json({
    ok: true,
    service: "glitchgang-whatsapp-bot",
    timestamp: new Date().toISOString()
  });
});

router.get("/tournaments", async (req, res, next) => {
  try {
    res.json(await gg.getTournaments(req.query.status));
  } catch (error) {
    next(error);
  }
});

router.get("/tournaments/:id", async (req, res, next) => {
  try {
    const item = await gg.getTournament(req.params.id);
    if (!item) return res.status(404).json({ message: "Torneo no encontrado" });
    res.json(item);
  } catch (error) {
    next(error);
  }
});

router.get("/teams", async (_req, res, next) => {
  try {
    res.json(await gg.getTeams());
  } catch (error) {
    next(error);
  }
});

router.get("/teams/:name", async (req, res, next) => {
  try {
    const item = await gg.getTeam(req.params.name);
    if (!item) return res.status(404).json({ message: "Equipo no encontrado" });
    res.json(item);
  } catch (error) {
    next(error);
  }
});

router.get("/users/by-phone/:phone", async (req, res, next) => {
  try {
    const user = await gg.getUserByPhone(req.params.phone);
    if (!user) return res.status(404).json({ message: "Usuario no vinculado" });
    res.json(user);
  } catch (error) {
    next(error);
  }
});

router.get("/users/by-phone/:phone/upcoming-match", async (req, res, next) => {
  try {
    const match = await gg.getUpcomingMatch(req.params.phone);
    if (!match) return res.status(404).json({ message: "No hay próxima partida" });
    res.json(match);
  } catch (error) {
    next(error);
  }
});

router.get("/users/by-phone/:phone/matches", async (req, res, next) => {
  try {
    res.json(await gg.getMatches(req.params.phone));
  } catch (error) {
    next(error);
  }
});

router.post("/checkins", async (req, res, next) => {
  try {
    const { phone, matchId } = req.body;

    if (!phone || !matchId) {
      return res.status(400).json({
        message: "phone y matchId son requeridos"
      });
    }

    res.status(201).json(await gg.checkIn(phone, matchId));
  } catch (error) {
    next(error);
  }
});

module.exports = router;
