const gg = require("../services/glitchgangApi");

module.exports = {
  async execute({ phone, reply }) {
    const match = await gg.getUpcomingMatch(phone);

    if (!match?.bracketUrl) {
      return reply(
        [
          "❌ *BRACKET NO DISPONIBLE*",
          "",
          "El bracket todavía no está disponible.",
          "Vuelve más tarde: !partida"
        ].join("\n")
      );
    }

    await reply(
      [
        "═════════════════════════════════════",
        `🏆 *BRACKET - ${match.tournamentName.toUpperCase()}*`,
        "═════════════════════════════════════",
        "",
        `🔗 ${match.bracketUrl}`,
        "",
        "═════════════════════════════════════",
        "💡 Abre el link para ver el bracket completo"
      ].join("\n")
    );
  }
};
