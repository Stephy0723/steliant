const db = require("../db/init");
const userService = require("./userService");

// Tipos de notificaciones
const NOTIFICATION_TYPES = {
  MATCH_REMINDER: "MATCH_REMINDER",
  CHECKIN_OPEN: "CHECKIN_OPEN",
  CHECKIN_CLOSING: "CHECKIN_CLOSING",
  CHECKIN_CLOSED: "CHECKIN_CLOSED",
  TOURNAMENT_START: "TOURNAMENT_START",
  RESULT_CONFIRMED: "RESULT_CONFIRMED",
  TEAM_INVITE: "TEAM_INVITE",
  VERIFICATION_COMPLETE: "VERIFICATION_COMPLETE"
};

/**
 * Envía una notificación a un usuario
 */
async function sendNotification(userId, type, data) {
  try {
    // Validar que el usuario existe
    const user = await userService.getUserById(userId);
    if (!user) {
      console.error(`Usuario ${userId} no encontrado`);
      return {
        success: false,
        error: "Usuario no encontrado"
      };
    }

    // Verificar preferencias de notificación
    const preferences = await getNotificationPreferences(userId);
    const shouldSend = preferences ? preferences[type] : true;

    if (!shouldSend) {
      console.log(`Notificación ${type} deshabilitada para ${userId}`);
      return {
        success: true,
        sent: false,
        reason: "Notificación deshabilitada"
      };
    }

    // Generar el mensaje según el tipo
    const message = buildNotificationMessage(type, data);

    // Guardar en base de datos
    const notificationId = `notif_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const now = new Date().toISOString();

    await db.run(
      `INSERT INTO notifications (id, user_id, type, title, message, data, status, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        notificationId,
        userId,
        type,
        message.title,
        message.body,
        JSON.stringify(data),
        "pending",
        now,
        now
      ]
    );

    // TODO: Aquí irá la integración con WhatsApp Cloud API
    // Para enviar el mensaje por WhatsApp
    // const accounts = await userService.getUserWhatsAppAccounts(userId);
    // for (const account of accounts) {
    //   if (account.verified) {
    //     await sendWhatsAppNotification(account.phone, message);
    //   }
    // }

    // Actualizar estado a enviado
    await db.run(
      `UPDATE notifications SET status = ?, updated_at = ? WHERE id = ?`,
      ["sent", now, notificationId]
    );

    console.log(`Notificación ${type} enviada a ${userId}`);

    return {
      success: true,
      sent: true,
      notificationId,
      message
    };
  } catch (error) {
    console.error("Error sending notification:", error);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Obtiene las preferencias de notificación de un usuario
 */
async function getNotificationPreferences(userId) {
  try {
    const preferences = await db.get(
      `SELECT * FROM notification_preferences WHERE user_id = ?`,
      [userId]
    );

    if (!preferences) {
      return null;
    }

    return {
      MATCH_REMINDER: preferences.match_reminder !== 0,
      CHECKIN_OPEN: preferences.checkin_open !== 0,
      CHECKIN_CLOSING: preferences.checkin_closing !== 0,
      CHECKIN_CLOSED: preferences.checkin_closed !== 0,
      TOURNAMENT_START: preferences.tournament_start !== 0,
      RESULT_CONFIRMED: preferences.result_confirmed !== 0,
      TEAM_INVITE: preferences.team_invite !== 0,
      VERIFICATION_COMPLETE: preferences.verification_complete !== 0
    };
  } catch (error) {
    console.error("Error getting notification preferences:", error);
    return null;
  }
}

/**
 * Actualiza las preferencias de notificación de un usuario
 */
async function updateNotificationPreferences(userId, preferences) {
  try {
    const now = new Date().toISOString();

    // Verificar si el usuario ya tiene preferencias
    const existing = await db.get(
      `SELECT * FROM notification_preferences WHERE user_id = ?`,
      [userId]
    );

    if (existing) {
      await db.run(
        `UPDATE notification_preferences 
         SET match_reminder = ?, checkin_open = ?, checkin_closing = ?, 
             checkin_closed = ?, tournament_start = ?, result_confirmed = ?,
             team_invite = ?, verification_complete = ?, updated_at = ?
         WHERE user_id = ?`,
        [
          preferences.matchReminder ? 1 : 0,
          preferences.checkinOpen ? 1 : 0,
          preferences.checkinClosing ? 1 : 0,
          preferences.checkinClosed ? 1 : 0,
          preferences.tournamentStart ? 1 : 0,
          preferences.resultConfirmed ? 1 : 0,
          preferences.teamInvite ? 1 : 0,
          preferences.verificationComplete ? 1 : 0,
          now,
          userId
        ]
      );
    } else {
      const prefId = `pref_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      await db.run(
        `INSERT INTO notification_preferences 
         (id, user_id, match_reminder, checkin_open, checkin_closing, checkin_closed,
          tournament_start, result_confirmed, team_invite, verification_complete, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          prefId,
          userId,
          preferences.matchReminder ? 1 : 0,
          preferences.checkinOpen ? 1 : 0,
          preferences.checkinClosing ? 1 : 0,
          preferences.checkinClosed ? 1 : 0,
          preferences.tournamentStart ? 1 : 0,
          preferences.resultConfirmed ? 1 : 0,
          preferences.teamInvite ? 1 : 0,
          preferences.verificationComplete ? 1 : 0,
          now,
          now
        ]
      );
    }

    return {
      success: true,
      preferences
    };
  } catch (error) {
    console.error("Error updating notification preferences:", error);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Obtiene el historial de notificaciones de un usuario
 */
async function getNotificationHistory(userId, limit = 20) {
  try {
    const notifications = await db.all(
      `SELECT * FROM notifications 
       WHERE user_id = ? 
       ORDER BY created_at DESC 
       LIMIT ?`,
      [userId, limit]
    );

    return notifications.map(n => ({
      ...n,
      data: n.data ? JSON.parse(n.data) : null
    }));
  } catch (error) {
    console.error("Error getting notification history:", error);
    return [];
  }
}

/**
 * Construye un mensaje de notificación según su tipo
 */
function buildNotificationMessage(type, data) {
  const messages = {
    MATCH_REMINDER: {
      title: "🎯 Próxima partida",
      body: `Tu equipo ${data.teamName} juega en ${data.timeRemaining}.
Torneo: ${data.tournamentName}
Hora: ${data.matchTime}

¡No olvides hacer check-in!`
    },
    CHECKIN_OPEN: {
      title: "✅ Check-in abierto",
      body: `Abierto el check-in para ${data.matchName}
Disponible hasta: ${data.closingTime}
Equipo: ${data.teamName}

Usa !checkin para confirmar tu asistencia`
    },
    CHECKIN_CLOSING: {
      title: "⏰ Check-in cerrando",
      body: `¡Falta poco para que cierre el check-in!
Cierra en: ${data.timeRemaining}
Partida: ${data.matchName}

Usa !checkin ahora si aún no lo has hecho`
    },
    CHECKIN_CLOSED: {
      title: "❌ Check-in cerrado",
      body: `El check-in de la partida ${data.matchName} ha cerrado.
Próximo torneo: ${data.nextTournament || "Pronto"}`
    },
    TOURNAMENT_START: {
      title: "🏆 Torneo iniciado",
      body: `Ha comenzado el torneo: ${data.tournamentName}
Equipo: ${data.teamName}
Primera partida: ${data.firstMatchTime}`
    },
    RESULT_CONFIRMED: {
      title: "📊 Resultado confirmado",
      body: `Resultado de ${data.matchName}
${data.team1Name} ${data.team1Score} - ${data.team2Score} ${data.team2Name}
Equipo: ${data.yourTeam}`
    },
    TEAM_INVITE: {
      title: "👥 Invitación de equipo",
      body: `${data.senderName} te invitó a ${data.teamName}
Posición: ${data.position}

Contáctate con el staff para aceptar`
    },
    VERIFICATION_COMPLETE: {
      title: "✅ Verificación completada",
      body: `¡Tu cuenta está verificada!
Ahora puedes usar todos los comandos de GlitchGang
Equipo: ${data.teamName || "Sin equipo"}
Rol: ${data.role || "Jugador"}`
    }
  };

  return messages[type] || {
    title: "Notificación",
    body: JSON.stringify(data)
  };
}

/**
 * Envía notificaciones masivas (para alertas programadas)
 */
async function broadcastNotification(type, data, filter = {}) {
  try {
    // Obtener usuarios que deben recibir la notificación
    let query = `SELECT id FROM users WHERE status = 'active'`;
    const params = [];

    // Aplicar filtros adicionales
    if (filter.teamId) {
      // Buscar usuarios en el equipo
      // Por ahora, pasamos el filtro como parámetro
    }

    const users = await db.all(query, params);

    const results = [];
    for (const user of users) {
      const result = await sendNotification(user.id, type, data);
      results.push(result);
    }

    return {
      success: true,
      totalSent: results.filter(r => r.sent).length,
      total: results.length,
      results
    };
  } catch (error) {
    console.error("Error broadcasting notification:", error);
    return {
      success: false,
      error: error.message
    };
  }
}

module.exports = {
  sendNotification,
  getNotificationPreferences,
  updateNotificationPreferences,
  getNotificationHistory,
  broadcastNotification,
  NOTIFICATION_TYPES
};
