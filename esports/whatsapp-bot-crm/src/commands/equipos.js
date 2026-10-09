const gg = require("../services/glitchgangApi");

module.exports = {
  async execute({ reply }) {
    const teams = await gg.getTeams();

    if (!teams.length) {
      return reply("❌ No hay equipos registrados todavía.");
    }

    const teamList = teams
      .map((t, i) => {
        const icon = i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : `#${i + 1}`;
        const tag = t.tag ? ` [${t.tag}]` : "";
        const roster = Array.isArray(t.roster) ? t.roster.length : (t.members || []).length;
        return `${icon} *${t.name}*${tag}\n   🎮 ${t.game || "—"} | 📍 ${t.region || "Sin región"} | 👥 ${roster}/5 | Estado: ${t.status || "activo"}`;
      })
      .join("\n\n");

    await reply(
      [
        "═══════════════════════════════════",
        "⚽ *EQUIPOS GLITCHGANG* ⚽",
        "═══════════════════════════════════",
        "",
        teamList,
        "",
        "═══════════════════════════════════",
        `Total: ${teams.length} equipos registrados`
      ].join("\n")
    );
  }
};
