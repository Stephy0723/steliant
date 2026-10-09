const gg = require("../services/glitchgangApi");

module.exports = {
  async execute({ phone, reply }) {
    const match = await gg.getUpcomingMatch(phone);

    if (!match?.discordUrl) {
      return reply(
        [
          "❌ *DISCORD NO DISPONIBLE*",
          "",
          "El servidor Discord aún no está disponible.",
          "Estate atento: !partida"
        ].join("\n")
      );
    }

    await reply(
      [
        "═════════════════════════════════════",
        `🎬 *DISCORD - ${match.tournamentName.toUpperCase()}*`,
        "═════════════════════════════════════",
        "",
        `🔗 ${match.discordUrl}`,
        "",
        "*✅ Verificaciones:*",
        "  • Actualiza tu perfil en Discord",
        "  • Sube tu foto/avatar",
        "  • Lee las reglas del servidor",
        "",
        "═════════════════════════════════════",
        "💡 Úmate con !checkin antes de entrar"
      ].join("\n")
    );
  }
};
