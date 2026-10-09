function formatDate(date) {
  try {
    return new Intl.DateTimeFormat("es-DO", {
      dateStyle: "medium",
      timeStyle: "short",
      timeZone: "America/Santo_Domingo"
    }).format(new Date(date));
  } catch {
    return date;
  }
}

function formatMatch(match) {
  return [
    `⚔️ *${match.teamA} vs ${match.teamB}*`,
    `🏆 ${match.tournamentName}`,
    `🕗 Partido: ${formatDate(match.scheduledAt)}`,
    `✅ Check-in: ${formatDate(match.checkinAt)}`,
    match.discordUrl ? `🎙 Discord: ${match.discordUrl}` : null,
    match.bracketUrl ? `🔗 Bracket: ${match.bracketUrl}` : null
  ].filter(Boolean).join("\n");
}

module.exports = { formatDate, formatMatch };
