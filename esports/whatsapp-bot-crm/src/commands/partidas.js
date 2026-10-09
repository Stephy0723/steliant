const gg = require("../services/glitchgangApi");
const { formatMatch } = require("../utils/formatters");

module.exports = {
  async execute({ phone, reply }) {
    const matches = await gg.getMatches(phone);

    if (!matches.length) {
      return reply(
        [
          "❌ *NO HAY PARTIDAS*",
          "",
          "Aún no tienes partidas registradas.",
          "Ve los torneos abiertos con: !torneos"
        ].join("\n")
      );
    }

    const upcoming = matches.filter(m => m.status === "scheduled").slice(0, 5);
    const completed = matches.filter(m => m.status === "completed").slice(0, 3);

    const text = [
      "═════════════════════════════════════",
      "🎮 *TUS PARTIDAS* 🎮",
      "═════════════════════════════════════",
      ""
    ];

    if (upcoming.length) {
      text.push("📋 *PRÓXIMAS PARTIDAS*");
      upcoming.forEach((m, i) => {
        text.push(`${i + 1}. ⚡ ${m.tournamentName}`);
        text.push(`   ${m.teamA} vs ${m.teamB}`);
        text.push(`   📅 ${new Date(m.scheduledAt).toLocaleDateString("es-ES")}`);
      });
      text.push("");
    }

    if (completed.length) {
      text.push("✅ *PARTIDAS COMPLETADAS*");
      completed.forEach((m, i) => {
        const winner = m.winner === m.teamA ? m.teamA : m.teamB;
        text.push(`${i + 1}. ${m.teamA} vs ${m.teamB}`);
        text.push(`   🎉 Ganador: *${winner}*`);
      });
      text.push("");
    }

    text.push("═════════════════════════════════════");

    await reply(text.join("\n"));
  }
};
