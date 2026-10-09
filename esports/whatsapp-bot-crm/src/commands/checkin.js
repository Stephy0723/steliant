const gg = require("../services/glitchgangApi");

module.exports = {
  async execute({ phone, reply }) {
    const match = await gg.getUpcomingMatch(phone);

    if (!match) {
      return reply(
        [
          "❌ *SIN PARTIDA DISPONIBLE*",
          "",
          "No tienes una partida para hacer check-in.",
          "Revisa tus partidas: !partida"
        ].join("\n")
      );
    }

    const result = await gg.checkIn(phone, match.id);

    await reply(
      [
        "═════════════════════════════════════",
        "✅ *CHECK-IN CONFIRMADO*",
        "═════════════════════════════════════",
        "",
        `🌟 Torneo: *${match.tournamentName}*`,
        `⚡ Partida: *${match.teamA} vs ${match.teamB}*`,
        `🎯 ID Partida: ${result.matchId}`,
        "",
        match.discordUrl ? `🎬 Discord: ${match.discordUrl}` : "",
        "",
        "═════════════════════════════════════",
        "💡 ¡Estáte listo para la partida!"
      ].filter(l => l).join("\n")
    );
  }
};
