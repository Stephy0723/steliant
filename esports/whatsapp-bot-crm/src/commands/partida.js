const gg = require("../services/glitchgangApi");

module.exports = {
  async execute({ phone, reply }) {
    const match = await gg.getUpcomingMatch(phone);

    if (!match) {
      return reply(
        [
          "❌ *SIN PRÓXIMA PARTIDA*",
          "",
          "No hay partidas programadas.",
          "Revisa !partidas para historial completo"
        ].join("\n")
      );
    }

    const matchTime = new Date(match.scheduledAt).toLocaleString("es-ES");

    const lines = [
      "═════════════════════════════════════",
      "🎯 *PRÓXIMA PARTIDA*",
      "═════════════════════════════════════",
      "",
      `🌟 *${match.tournamentName}*`,
      "",
      `⚡ ${match.teamA} vs ${match.teamB}`,
      "",
      `📅 Fecha: ${matchTime}`,
      `💪 Estado: ${match.status}`,
      ""
    ];

    if (match.discordUrl) {
      lines.push(`🎬 Discord: ${match.discordUrl}`);
    }
    if (match.bracketUrl) {
      lines.push(`🏆 Bracket: ${match.bracketUrl}`);
    }

    lines.push("");
    lines.push("═════════════════════════════════════");
    lines.push("💡 Úmate con !checkin");

    await reply(lines.join("\n"));
  }
};
