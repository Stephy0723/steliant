const cron = require("node-cron");
const db = require("../db/init");
const notificationService = require("../services/notificationService");

/**
 * Iniciador de todos los jobs programados
 */
async function initializeJobs() {
  console.log("Inicializando jobs programados...");

  // Job de reminders de partidas (cada 5 minutos)
  scheduleMatchReminders();

  // Job de reminders de check-in (cada 2 minutos)
  scheduleCheckInReminders();

  // Job de limpieza de códigos OTP expirados (cada 10 minutos)
  scheduleOTPCleanup();

  // Job de actualización de estadísticas (cada hora)
  scheduleStatsUpdate();

  console.log("✅ Jobs programados iniciados");
}

/**
 * Envía recordatorios 30 minutos antes de cada partida
 */
function scheduleMatchReminders() {
  cron.schedule("*/5 * * * *", async () => {
    try {
      const now = new Date();
      const thirtyMinutesFromNow = new Date(now.getTime() + 30 * 60000);
      const fiveMinutesAgo = new Date(now.getTime() - 5 * 60000);

      // Buscar partidas entre ahora y 30 minutos desde ahora
      const matches = await db.all(
        `SELECT m.*, t.name as tournament_name 
         FROM matches m
         JOIN tournaments t ON m.tournament_id = t.id
         WHERE datetime(m.scheduled_at) > datetime(?)
         AND datetime(m.scheduled_at) <= datetime(?)
         AND m.status IN ('scheduled', 'pending')`,
        [fiveMinutesAgo.toISOString(), thirtyMinutesFromNow.toISOString()]
      );

      for (const match of matches) {
        // Buscar usuarios en los equipos de esta partida
        const users = await db.all(
          `SELECT DISTINCT u.id, u.username, wa.phone, t.name as team_name
           FROM users u
           JOIN whatsapp_accounts wa ON u.id = wa.user_id
           JOIN teams t ON u.team_id = t.id
           WHERE t.id IN (?, ?)
           AND wa.verified = 1`,
          [match.team_1_id, match.team_2_id]
        );

        // Calcular tiempo restante
        const matchTime = new Date(match.scheduled_at);
        const minutesUntil = Math.round((matchTime - now) / 60000);

        for (const user of users) {
          await notificationService.sendNotification(
            user.id,
            "MATCH_REMINDER",
            {
              matchId: match.id,
              teamName: user.team_name,
              tournamentName: match.tournament_name,
              matchTime: matchTime.toLocaleTimeString("es-ES"),
              timeRemaining: `${minutesUntil} minutos`,
              phone: user.phone
            }
          );
        }
      }
    } catch (error) {
      console.error("Error in scheduleMatchReminders:", error);
    }
  });
}

/**
 * Envía recordatorios cuando el check-in está por cerrarse
 */
function scheduleCheckInReminders() {
  cron.schedule("*/2 * * * *", async () => {
    try {
      const now = new Date();
      const tenMinutesFromNow = new Date(now.getTime() + 10 * 60000);
      const twoMinutesAgo = new Date(now.getTime() - 2 * 60000);

      // Buscar partidas con check-in abierto
      const matches = await db.all(
        `SELECT m.*, t.name as tournament_name 
         FROM matches m
         JOIN tournaments t ON m.tournament_id = t.id
         WHERE m.status = 'checkin_open'
         AND datetime(m.checkin_at) > datetime(?)
         AND datetime(m.checkin_at) <= datetime(?)`,
        [twoMinutesAgo.toISOString(), tenMinutesFromNow.toISOString()]
      );

      for (const match of matches) {
        // Buscar usuarios que NO han hecho check-in
        const usersWithoutCheckin = await db.all(
          `SELECT u.id, u.username, wa.phone, t.name as team_name
           FROM users u
           JOIN whatsapp_accounts wa ON u.id = wa.user_id
           JOIN teams t ON u.team_id = t.id
           WHERE t.id IN (?, ?)
           AND wa.verified = 1
           AND u.id NOT IN (
             SELECT user_id FROM checkins 
             WHERE match_id = ? AND status = 'confirmed'
           )`,
          [match.team_1_id, match.team_2_id, match.id]
        );

        // Calcular tiempo restante
        const closingTime = new Date(match.checkin_at);
        const minutesUntil = Math.round((closingTime - now) / 60000);

        for (const user of usersWithoutCheckin) {
          await notificationService.sendNotification(
            user.id,
            "CHECKIN_CLOSING",
            {
              matchId: match.id,
              matchName: `${match.team_1_name} vs ${match.team_2_name}`,
              teamName: user.team_name,
              timeRemaining: `${minutesUntil} minutos`,
              phone: user.phone
            }
          );
        }
      }
    } catch (error) {
      console.error("Error in scheduleCheckInReminders:", error);
    }
  });
}

/**
 * Limpia códigos OTP expirados cada 10 minutos
 */
function scheduleOTPCleanup() {
  cron.schedule("*/10 * * * *", async () => {
    try {
      const now = new Date().toISOString();

      const result = await db.run(
        `DELETE FROM whatsapp_verification_codes 
         WHERE datetime(expires_at) < datetime(?)
         AND status = 'pending'`,
        [now]
      );

      if (result.changes > 0) {
        console.log(`🧹 Limpiados ${result.changes} códigos OTP expirados`);
      }
    } catch (error) {
      console.error("Error in scheduleOTPCleanup:", error);
    }
  });
}

/**
 * Actualiza estadísticas de usuarios cada hora
 */
function scheduleStatsUpdate() {
  cron.schedule("0 * * * *", async () => {
    try {
      console.log("📊 Actualizando estadísticas...");

      // Ejemplo: Actualizar racha de participación
      const users = await db.all(
        `SELECT DISTINCT u.id 
         FROM users u
         JOIN checkins c ON u.id = c.user_id
         WHERE c.created_at > datetime('now', '-1 day')`
      );

      console.log(`✅ Estadísticas actualizadas para ${users.length} usuarios`);
    } catch (error) {
      console.error("Error in scheduleStatsUpdate:", error);
    }
  });
}

/**
 * Detiene todos los jobs (útil para graceful shutdown)
 */
function stopAllJobs() {
  try {
    // Obtener todos los tasks programados
    const tasks = cron.getTasks();
    tasks.forEach(task => task.stop());
    console.log("⛔ Todos los jobs detenidos");
  } catch (error) {
    console.error("Error stopping jobs:", error);
  }
}

module.exports = {
  initializeJobs,
  stopAllJobs
};
