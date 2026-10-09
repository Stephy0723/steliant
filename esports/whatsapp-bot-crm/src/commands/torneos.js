const gg = require("../services/glitchgangApi");

module.exports = {
  async execute({ reply }) {
    const tournaments = await gg.getTournaments("open");

    if (!tournaments.length) {
      return reply(
        [
          "❌ *SIN TORNEOS ACTIVOS*",
          "",
          "No hay torneos abiertos en este momento.",
          "Vuelve más tarde: !soporte"
        ].join("\n")
      );
    }

    const text = tournaments.slice(0, 8).map((t, index) => {
      const filled = Math.round((t.registeredTeams / t.maxTeams) * 10);
      const bar = "🟦".repeat(filled) + "⬜".repeat(10 - filled);
      return [
        `${index + 1}. 🌟 *${t.name}*`,
        `   🎮 ${t.game}`,
        `   📅 ${t.startDate}`,
        `   👥 ${t.registeredTeams}/${t.maxTeams} equipos`,
        `   ${bar}`,
        `   🆔 ${t.id}`
      ].join("\n");
    }).join("\n\n");

    await reply(
      [
        "═════════════════════════════════════",
        "🏆 *TORNEOS GLITCHGANG* 🏆",
        "═════════════════════════════════════",
        "",
        text,
        "",
        "═════════════════════════════════════",
        "💡 Usa !torneo <ID> para más detalles"
      ].join("\n")
    );
  }
};
