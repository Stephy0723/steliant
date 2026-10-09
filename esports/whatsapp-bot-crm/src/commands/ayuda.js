module.exports = {
  async execute({ reply }) {
    await reply(
      [
        "═══════════════════════════════════",
        "🎮 *GLITCHGANG BOT ESPORTS* 🎮",
        "═══════════════════════════════════",
        "",
        "*📋 COMANDOS DISPONIBLES:*",
        "",
        "*🏆 Torneos*",
        "  !torneos — Ver torneos abiertos",
        "  !torneo <id> — Detalle de torneo",
        "  !reglas — Reglas del torneo",
        "",
        "*⚽ Equipos*",
        "  !equipos — Equipos registrados",
        "  !equipo <nombre> — Info del equipo",
        "",
        "*👤 Perfil*",
        "  !perfil — Tu perfil y estadísticas",
        "  !ranking — Ranking de equipos",
        "",
        "*🎮 Partidas*",
        "  !partida — Tu próxima partida",
        "  !partidas — Todas tus partidas",
        "  !checkin — Hacer check-in",
        "  !bracket — Ver bracket",
        "  !discord — Link del Discord",
        "",
        "*❓ Soporte*",
        "  !soporte — Contactar al staff",
        "",
        "═══════════════════════════════════"
      ].join("\n")
    );
  }
};
