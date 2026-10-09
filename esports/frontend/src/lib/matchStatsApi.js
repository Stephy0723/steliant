import { api } from './api.js'
import { matchStatsApiPath } from '../../../shared/matchStatsContract.mjs'

export function matchStatsApi(tournamentId, matchId, gameNumber) {
  const base = matchStatsApiPath(tournamentId, matchId, gameNumber)
  const send = (suffix, body, method = 'POST') => api(`${base}${suffix}`, { method, body: JSON.stringify(body) })
  return {
    get: () => api(base),
    save: body => send('', body, 'PUT'),
    confirm: body => send('/confirm', body),
    extract: body => send('/extract', body),
    importEvidence: evidenceUrl => send('/evidence', { evidenceUrl }),
  }
}

