const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");
const session = require("express-session");
const path = require("path");

const apiRouter = require("./api/routes");
const crmRouter = require("./crm/routes");
const crmStore = require("./crm/store");
const { verifyWebhook, receiveWebhook } = require("./whatsapp/cloudApi");
const { notFound, errorHandler } = require("./api/middleware/errors");
const db = require("./db/init");
const { initializeJobs } = require("./jobs/scheduler");

function startApi() {
  const app = express();
  crmStore.ensureDb();

  app.use(helmet({ contentSecurityPolicy: false }));
  app.use(cors());
  app.use(express.json({ limit: "1mb" }));
  app.use(express.urlencoded({ extended: true }));
  app.use(morgan("dev"));

  // WhatsApp Cloud API webhook
  app.get("/webhook", verifyWebhook);
  app.post("/webhook", receiveWebhook);

  app.use(session({
    secret: process.env.CRM_SESSION_SECRET || "dev-only-change-me",
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      maxAge: 1000 * 60 * 60 * 8
    }
  }));

  app.use("/crm/assets", express.static(path.join(process.cwd(), "src/crm/public/assets")));

  app.get("/", (_req, res) => {
    res.json({ name: "GlitchGang WhatsApp Bot API + CRM", status: "online", crm: "/crm", webhook: "/webhook" });
  });

  app.use("/api", apiRouter);
  app.use("/crm", crmRouter);
  app.use(notFound);
  app.use(errorHandler);

  const port = Number(process.env.PORT || 4100);

  app.listen(port, async () => {
    console.log(`API GlitchGang: http://localhost:${port}`);
    console.log(`CRM GlitchGang: http://localhost:${port}/crm`);
    console.log(`Webhook Meta: http://localhost:${port}/webhook`);
    console.log(`Linking WhatsApp: http://localhost:${port}/crm/linking`);
    
    // Inicializar base de datos
    try {
      await db.initializeTables();
      console.log("✅ Base de datos inicializada");
    } catch (error) {
      console.error("❌ Error inicializando base de datos:", error);
    }

    // Inicializar jobs programados
    try {
      initializeJobs();
    } catch (error) {
      console.error("❌ Error inicializando jobs:", error);
    }
  });

  return app;
}

module.exports = { startApi };
