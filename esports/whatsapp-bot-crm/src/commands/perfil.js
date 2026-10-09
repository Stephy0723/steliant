const gg = require("../services/glitchgangApi");
const userService = require("../services/userService");

module.exports = {
  async execute({ phone, reply }) {
    try {
      // Buscar usuario verificado
      const user = await userService.getUserByPhone(phone);

      if (!user) {
        return reply(
          [
            "👋 *AÚN NO ESTÁS VINCULADO*",
            "",
            "Este número no está vinculado a una cuenta GlitchGang.",
            "",
            "🔗 *Vincula tu cuenta:*",
            "https://glitchgang.net/conectar-whatsapp",
            "",
            "Después podrás usar todos los comandos:",
            "• !partidas",
            "• !checkin",
            "• !equipo",
            "• !ranking",
            "",
            "¿Preguntas? !soporte"
          ].join("\n")
        );
      }

      // Actualizar última actividad
      await userService.updateLastActivity(phone);

      // Obtener información adicional (equipo, partida próxima, etc.)
      const team = user.teamId ? await gg.getTeam(user.teamId) : null;
      const upcomingMatch = await gg.getUpcomingMatch(phone);

      const verifyBadge = user.verified ? "✅ Verificado" : "⏳ Pendiente verificación";
      const rolIcon = {
        "captain": "👑",
        "player": "🎮",
        "sub": "🔄",
        "staff": "🛡️"
      }[user.role] || "👤";

      const lines = [
        "═════════════════════════════════════",
        `👤 *PERFIL DE ${user.username.toUpperCase()}*`,
        "═════════════════════════════════════",
        "",
        `🆔 ID: GG-${user.id.substring(4, 9).toUpperCase()}`,
        `📍 Región: ${user.region || "No especificada"}`,
        "",
        `${rolIcon} Rol: ${user.role || "Jugador"}`,
        `🎮 Juego: ${user.game || "No especificado"}`,
        `🛡️ Equipo: ${team?.name || "Sin equipo"}`,
        "",
        "📊 *Estadísticas*",
        upcomingMatch ? `🎯 Próxima partida: ${upcomingMatch.tournamentName}` : "📭 Sin partidas",
        `✅ WhatsApp: ${verifyBadge}`,
        "",
        "═════════════════════════════════════",
        "💡 Usa !partida para ver más detalles"
      ];

      await reply(lines.filter(l => l).join("\n"));
    } catch (error) {
      console.error("Error in perfil command:", error);
      return reply("❌ Error al obtener tu perfil. Intenta de nuevo.");
    }
  }
};
