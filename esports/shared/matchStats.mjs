export const STAT_FIELDS = {
  kills: 'Kills', deaths: 'Muertes', assists: 'Asistencias',
  damageDealt: 'Daño infligido', damageTaken: 'Daño recibido', towerDamage: 'Daño a torres',
  teamfightParticipation: 'Participación (%)', gold: 'Oro',
}
export const isMobileLegends = game => /^(mobile legends(?::? bang bang)?|mobile-legends-bang-bang|mlbb)$/i.test(String(game || '').trim())
export const normalizeNick = value => String(value || '').normalize('NFKC').trim().toLocaleLowerCase().replace(/\s+/gu, ' ')
export function emptyStats(roster = []) {
  return { winnerTeamId: '', scoreA: null, scoreB: null, players: roster.map(p => ({
    playerId: p.playerId, teamId: p.teamId, rawName: p.nick, character: '', mvp: null,
    ...Object.fromEntries(Object.keys(STAT_FIELDS).map(key => [key, null])), uncertain: [],
  })) }
}
export function validateStats(input, roster, teamIds) {
  const errors = [], warnings = []
  const count = (value, key) => {
    if (value === '' || value == null) return null
    const max = key === 'teamfightParticipation' ? 100 : 100000000
    if (typeof value !== 'number' || !Number.isFinite(value) || value < 0 || value > max || (key !== 'teamfightParticipation' && !Number.isInteger(value))) {
      errors.push(`Valor inválido: ${STAT_FIELDS[key] || key}.`); return null
    }
    return value
  }
  const winnerTeamId = String(input?.winnerTeamId || '')
  if (!teamIds.includes(winnerTeamId)) errors.push('Selecciona el equipo ganador.')
  const source = Array.isArray(input?.players) ? input.players : []
  if (source.length !== 10) errors.push('Deben figurar los diez titulares, una sola vez cada uno.')
  const seen = new Set()
  const players = source.slice(0, 10).map((row, index) => {
    const playerId = String(row?.playerId || ''), teamId = String(row?.teamId || '')
    const player = roster.find(p => p.playerId === playerId && p.teamId === teamId)
    if (!player || seen.has(playerId)) errors.push(`Fila ${index + 1}: selecciona un titular válido sin repetir.`)
    seen.add(playerId)
    const result = { playerId, teamId, rawName: String(row?.rawName || '').slice(0, 100), character: String(row?.character || '').slice(0, 80), mvp: row?.mvp == null ? null : row.mvp }
    if (result.mvp !== null && typeof result.mvp !== 'boolean') errors.push(`Fila ${index + 1}: MVP inválido.`)
    for (const key of Object.keys(STAT_FIELDS)) result[key] = count(row?.[key], key)
    result.uncertain = Array.isArray(row?.uncertain) ? row.uncertain.filter(k => [...Object.keys(STAT_FIELDS), 'rawName', 'mvp', 'character'].includes(k)) : []
    if (result.uncertain.length) warnings.push(`Fila ${index + 1}: lectura dudosa (${result.uncertain.join(', ')}).`)
    if (['kills', 'deaths', 'assists'].some(k => result[k] === null)) warnings.push(`Fila ${index + 1}: K/D/A incompleto; los campos vacíos se guardan como desconocidos.`)
    return result
  })
  const scoreA = count(input?.scoreA, 'scoreA'), scoreB = count(input?.scoreB, 'scoreB')
  teamIds.forEach((id, i) => {
    const rows = players.filter(p => p.teamId === id)
    if (rows.length !== 5) errors.push(`El equipo ${i + 1} necesita cinco titulares.`)
    const score = i === 0 ? scoreA : scoreB
    if (score != null && rows.length === 5 && rows.every(p => p.kills != null) && rows.reduce((s, p) => s + p.kills, 0) !== score) errors.push(`Las kills del equipo ${i + 1} no suman su marcador.`)
  })
  return { data: { winnerTeamId, scoreA, scoreB, players }, errors: [...new Set(errors)], warnings: [...new Set(warnings)] }
}
export function compareStats(a, b) {
  const conflicts = []
  for (const key of ['winnerTeamId', 'scoreA', 'scoreB']) if (a?.[key] != null && a[key] !== '' && b?.[key] != null && b[key] !== '' && a[key] !== b[key]) conflicts.push(key)
  for (const p of a?.players || []) {
    const q = b?.players?.find(row => row.playerId && row.playerId === p.playerId)
    if (!q) continue
    for (const key of [...Object.keys(STAT_FIELDS), 'mvp']) if (p[key] != null && q[key] != null && p[key] !== q[key]) conflicts.push(`${p.rawName || p.playerId}: ${STAT_FIELDS[key] || key}`)
  }
  return conflicts
}
export function matchExtractedStats(raw, roster, teamIds, firstSideTeamId) {
  const otherTeam = teamIds.find(id => id !== firstSideTeamId)
  const sideTeam = side => side === 'A' ? firstSideTeamId : side === 'B' ? otherTeam : ''
  const players = (Array.isArray(raw?.players) ? raw.players : []).slice(0, 10).map(row => {
    const teamId = sideTeam(row.side)
    const hits = roster.filter(p => p.teamId === teamId && normalizeNick(p.nick) === normalizeNick(row.rawName) && normalizeNick(row.rawName))
    return { ...row, teamId, playerId: hits.length === 1 ? hits[0].playerId : '', uncertain: [...(Array.isArray(row.uncertain) ? row.uncertain : []), ...(hits.length !== 1 ? ['rawName'] : [])] }
  })
  const firstIsA = firstSideTeamId === teamIds[0]
  return { players, winnerTeamId: sideTeam(raw?.winnerSide), scoreA: (firstIsA ? raw?.scoreA : raw?.scoreB) ?? null, scoreB: (firstIsA ? raw?.scoreB : raw?.scoreA) ?? null }
}

