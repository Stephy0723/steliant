const gg = require("../services/glitchgangApi");

module.exports = {
  async execute({ args, reply }) {
    const id = args[0];

    if (!id) {
      return reply(
        [
          "⚡ *USO*: !torneo <id>",
          "",
          "Obtén el ID con: !torneos"
        ].join("\n")
      );
    }

    const t = await gg.getTournament(id);

    if (!t) return reply("❌ Torneo no encontrado.");

    const lines = [
      "═════════════════════════════════════",
      `🌟 *${t.name}*`,
      "═════════════════════════════════════",
      "",
      `🎮 *Juego:* ${t.game}`,
      `📅 *Inicio:* ${t.startDate}`,
      `💪 *Estado:* ${t.status}`,
      `👥 *Equipos:* ${t.registeredTeams}/${t.maxTeams}`,
      ""
    ];

    if (t.bracketUrl) lines.push(`🏆 Bracket: ${t.bracketUrl}`);
    if (t.rulesUrl) lines.push(`📖 Reglas: ${t.rulesUrl}`);
    if (t.discordUrl) lines.push(`🎬 Discord: ${t.discordUrl}`);

    lines.push("");
    lines.push("═════════════════════════════════════");

    await reply(lines.join("\n"));
  }
};
