// Shared public contract: no provider credentials or server configuration here.
export const MATCH_STATS_LIMITS = Object.freeze({ images: 4, imageBytes: 5 * 1024 * 1024, players: 10, games: 9, revisions: 100 })
export function matchStatsApiPath(tournamentId, matchId, gameNumber = 1) {
  return `/tournaments/${encodeURIComponent(tournamentId)}/matches/${encodeURIComponent(matchId)}/stats/${encodeURIComponent(gameNumber)}`
}
export function matchStatsReviewPath(tournamentId, matchId, gameNumber = 1) {
  return `/torneos/${encodeURIComponent(tournamentId)}/partidas/${encodeURIComponent(matchId)}/estadisticas?partida=${encodeURIComponent(gameNumber)}`
}

