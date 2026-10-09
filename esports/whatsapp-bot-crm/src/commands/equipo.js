const gg = require("../services/glitchgangApi");

module.exports = {
  async execute({ args, reply }) {
    if (!args.length) return reply("⚡ *USO*: !equipo <nombre>\n\nEjemplo: !equipo Team Nova");

    const team = await gg.getTeam(args.join(" "));

    if (!team) return reply("❌ *EQUIPO NO ENCONTRADO*\n\nRevisa: !equipos");

    const roster = Array.isArray(team.roster) && team.roster.length
      ? team.roster.map((m) => m.nick || m).filter(Boolean)
      : (team.members || []);
    const membersList = roster.length
      ? "\n*👥 Jugadores:*\n" + roster.map((m) => `  • ${m}`).join("\n")
      : "";

    const TIER_LABELS = { new: "Nueva", uni: "Universitaria", fem: "Femenina", pro: "Profesional" };
    const tiers = (team.tiers || []).map((id) => TIER_LABELS[id] || id).join(", ");
    const captainNick = team.captain && team.captain.nick ? team.captain.nick : null;

    await reply(
      [
        "═════════════════════════════════════",
        `🛡️ *${team.name.toUpperCase()}*${team.tag ? ` [${team.tag}]` : ""}`,
        "═════════════════════════════════════",
        "",
        `🎮 *Juego:* ${team.game || "—"}`,
        `📍 *Región:* ${team.region || "Sin región"}${team.language ? ` · ${team.language}` : ""}`,
        team.level ? `📊 *Nivel:* ${team.level}` : "",
        tiers ? `🏷️ *Divisiones:* ${tiers}` : "",
        captainNick ? `👑 *Capitán:* ${captainNick}${team.captain.role ? ` (${team.captain.role})` : ""}` : "",
        team.sponsor ? `🤝 *Patrocinador:* ${team.sponsor}` : "",
        `💪 *Estado:* ${team.status || "activo"}`,
        team.bio ? `\n📝 ${team.bio}` : "",
        membersList,
        "",
        "═════════════════════════════════════"
      ].filter((l) => l !== "").join("\n")
    );
  }
};
