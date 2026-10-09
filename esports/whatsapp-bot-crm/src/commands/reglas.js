const gg = require("../services/glitchgangApi");

module.exports = {
  async execute({ phone, reply }) {
    const match = await gg.getUpcomingMatch(phone);

    if (!match) {
      return reply(
        [
          "❌ *SIN TORNEO ACTIVO*",
          "",
          "No hay torneo activo en tu cuenta.",
          "Revisa los torneos: !torneos"
        ].join("\n")
      );
    }

    const tournament = await gg.getTournament(match.tournamentId);

    if (!tournament?.rulesUrl) {
      return reply(
        [
          "📖 *REGLAS NO DISPONIBLES*",
          "",
          "Las reglas del torneo todavía no han sido publicadas.",
          "Contacta al staff: !soporte"
        ].join("\n")
      );
    }

    await reply(
      [
        "═════════════════════════════════════",
        `📖 *REGLAMENTO ${tournament.name.toUpperCase()}*`,
        "═════════════════════════════════════",
        "",
        `🔗 ${tournament.rulesUrl}`,
        "",
        "═════════════════════════════════════",
        "💡 Léelo antes de tu partida"
      ].join("\n")
    );
  }
};
