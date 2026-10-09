// Motor de bracket puro (sin dependencias de browser ni de backend) --
// formato, equipos, generacion de rondas y computo de standings. Se usa
// desde frontend/src/lib/bracketStore.js (panel del organizador, vista
// publica) y desde backend/src/services/bracketSync.service.js (auto-avance
// del bracket cuando /report de Discord confirma un resultado). Vivir en
// shared/ es lo que garantiza que las dos partes generen SIEMPRE los mismos
// IDs de partido para el mismo bracket -- si se duplicara esta logica en
// vez de compartirla, un cambio en un lado y no el otro rompe el auto-avance
// en silencio (el id que calcula el backend ya no matchea el que muestra
// la web).

export function normalizeFormat(f) {
  const s = String(f || '').toLowerCase()
  if (s.includes('double') || s.includes('doble')) return 'double'
  if (s.includes('robin') || s.includes('todos')) return 'roundrobin'
  if (s.includes('swiss') || s.includes('suizo')) return 'swiss'
  if (s.includes('grupo') || s.includes('group')) return 'groups'
  return 'single'
}

export function nearestPow2(n) { let p = 2; while (p * 2 <= Math.max(2, n)) p *= 2; return p }
export function ceilPow2(n) { let p = 1; while (p < Math.max(2, n)) p *= 2; return p }

// Rellena hasta la siguiente potencia de 2 con BYE (para llaves de eliminacion).
export function padToPow2(teams, fill = 'BYE') {
  const out = [...teams]
  const target = ceilPow2(out.length)
  while (out.length < target) out.push(fill)
  return out
}

// ── Equipos reales del bracket ──
// A partir de las inscripciones (registrationsApi.list / Tournament.registrations).
// Si hay equipos con check-in, esos mandan; si no, entran todos los que no se
// retiraron. El orden respeta un seedOrder guardado (lo puede fijar la ruleta
// o el organizador).
export function resolveBracketTeams(registrations, seedOrder) {
  const OUT = new Set(['withdrawn', 'rejected', 'disqualified', 'cancelled'])
  let regs = (registrations || []).filter(r => !OUT.has(r.status))
  const checked = regs.filter(r => r.status === 'checked_in')
  if (checked.length >= 2) regs = checked
  const seen = {}
  let names = regs.map(r => {
    const base = (r.name || r.tag || 'Equipo').trim()
    seen[base] = (seen[base] || 0) + 1
    return seen[base] > 1 ? `${base} (${seen[base]})` : base
  })
  if (Array.isArray(seedOrder) && seedOrder.length) {
    const pos = (n) => { const i = seedOrder.indexOf(n); return i === -1 ? 1e9 : i }
    names = [...names].sort((a, b) => pos(a) - pos(b))
  }
  return names
}

export function roundRobinMatches(teams) {
  const m = []
  for (let i = 0; i < teams.length; i++)
    for (let j = i + 1; j < teams.length; j++)
      m.push({ id: `rr-${i}-${j}`, a: teams[i], b: teams[j] })
  return m
}

// Reparte en grupos en modo serpiente (1,2,3,3,2,1...) para equilibrar seeds.
export function groupStage(teams, groupCount) {
  const gc = Math.max(1, Math.min(groupCount || 1, Math.ceil(teams.length / 2)))
  const groups = Array.from({ length: gc }, () => [])
  teams.forEach((tm, i) => {
    const cycle = Math.floor(i / gc)
    const idx = cycle % 2 === 0 ? i % gc : gc - 1 - (i % gc)
    groups[idx].push(tm)
  })
  return groups.map((gt, gi) => {
    const matches = []
    for (let i = 0; i < gt.length; i++)
      for (let j = i + 1; j < gt.length; j++)
        matches.push({ id: `grp${gi}-${i}-${j}`, a: gt[i], b: gt[j] })
    return { name: `Grupo ${String.fromCharCode(65 + gi)}`, teams: gt, matches }
  })
}

// Emparejamiento suizo por record (victorias). Evita revanchas cuando puede.
// Se recalcula ronda a ronda usando solo resultados confirmados.
export function swissPairings(teams, results, roundCount) {
  const rec = {}
  teams.forEach(t => { rec[t] = { name: t, w: 0, l: 0, e: 0 } })
  const played = new Set()
  const rounds = []
  for (let r = 0; r < Math.max(1, roundCount); r++) {
    const pool = [...teams].sort((a, b) => rec[b].w - rec[a].w || rec[a].l - rec[b].l || a.localeCompare(b))
    const used = new Set()
    const matches = []
    for (let i = 0; i < pool.length; i++) {
      if (used.has(pool[i])) continue
      let opp = null
      for (let j = i + 1; j < pool.length; j++) {
        if (used.has(pool[j])) continue
        const key = [pool[i], pool[j]].sort().join('|')
        if (!played.has(key)) { opp = pool[j]; break }
      }
      if (!opp) opp = pool.find((p, j) => j > i && !used.has(p)) || null
      if (!opp) { matches.push({ id: `sw-r${r}-m${matches.length}`, a: pool[i], b: 'BYE' }); used.add(pool[i]); continue }
      used.add(pool[i]); used.add(opp)
      played.add([pool[i], opp].sort().join('|'))
      matches.push({ id: `sw-r${r}-m${matches.length}`, a: pool[i], b: opp })
    }
    matches.forEach(m => {
      if (m.b === 'BYE') { rec[m.a].w++; return }
      const res = results[m.id]
      if (res && res.confirmed) {
        if (res.winner === m.a) { rec[m.a].w++; rec[m.b].l++ }
        else if (res.winner === m.b) { rec[m.b].w++; rec[m.a].l++ }
      }
    })
    rounds.push({ name: `Ronda ${r + 1}`, matches })
  }
  const standings = [...teams].sort((a, b) => rec[b].w - rec[a].w || rec[a].l - rec[b].l || a.localeCompare(b)).map(t => rec[t])
  return { rounds, standings }
}

export const roundLabel = (teamsIn) =>
  teamsIn >= 16 ? 'Octavos' : teamsIn === 8 ? 'Cuartos' : teamsIn === 4 ? 'Semifinal' : teamsIn === 2 ? 'Final' : `Ronda de ${teamsIn}`

// Un resultado solo "cuenta" (avanza/se publica) cuando está confirmado.
const confirmedWinner = (results, id) => (results[id]?.confirmed ? results[id].winner : null)
// Un BYE avanza solo al rival real.
const autoBye = (m) => (m.b === 'BYE' ? m.a : m.a === 'BYE' ? m.b : null)
const advance = (results, m) => confirmedWinner(results, m.id) || autoBye(m) || 'Por definir'

// Motor de eliminación simple: propaga ganadores confirmados ronda a ronda.
export function buildSingleBracket(teams, results, prefix) {
  // bracketDoc.teams se guarda sin BYE; sin rellenar aqui, con un numero de
  // equipos que no es potencia de 2 el ultimo quedaba contra `undefined`, no
  // avanzaba nunca y la final quedaba "Por definir" (vista publica, jugador y
  // resultados de Discord). Idempotente si ya viene rellenado.
  teams = padToPow2(teams || [])
  const rounds = []
  let current = []
  for (let i = 0; i < teams.length; i += 2) current.push({ a: teams[i], b: teams[i + 1] })
  let roundIdx = 0
  while (true) {
    const matches = current.map((m, mi) => ({ id: `${prefix}-r${roundIdx}-m${mi}`, a: m.a, b: m.b }))
    rounds.push({ name: roundLabel(matches.length * 2), matches })
    if (matches.length === 1) break
    const next = []
    for (let i = 0; i < matches.length; i += 2) {
      next.push({
        a: advance(results, matches[i]),
        b: advance(results, matches[i + 1]),
      })
    }
    current = next
    roundIdx++
  }
  const champion = confirmedWinner(results, rounds[rounds.length - 1].matches[0].id) || null
  return { rounds, champion }
}

// Campeon + subcampeon + tercer(es) lugar(es) a partir de las rondas de una
// llave de eliminacion ya resuelta. El "tercer lugar" es compartido entre los
// 2 perdedores de semifinal (convencion estandar cuando no hay partido de
// bronce aparte). Lo usan el backend (avisos de podio) y la web (titulos).
export function computePodium(rounds, champion) {
  if (!champion || !rounds.length) return null
  const finalMatch = rounds[rounds.length - 1].matches[0]
  const runnerUp = finalMatch.a === champion ? finalMatch.b : finalMatch.a
  const thirdPlace = []
  if (rounds.length >= 2) {
    const semiRound = rounds[rounds.length - 2]
    for (const m of semiRound.matches) {
      let loser = null
      if (m.a === champion || m.a === runnerUp) loser = m.b
      else if (m.b === champion || m.b === runnerUp) loser = m.a
      if (loser && loser !== 'BYE' && loser !== 'Por definir') thirdPlace.push(loser)
    }
  }
  return { champion, runnerUp, thirdPlace }
}

// Motor de doble eliminación: winner's bracket + loser's bracket + gran final.
export function buildDoubleBracket(teams, results) {
  const wbRounds = buildSingleBracket(teams, results, 'wb').rounds
  const conf = id => (results[id]?.confirmed ? results[id] : null)
  const loserOf = (m) => { const r = conf(m.id); return r ? (r.winner === m.a ? m.b : m.a) : 'Por definir' }
  const winnerOf = (id) => { const r = conf(id); return r ? r.winner : 'Por definir' }
  const wbLosers = wbRounds.map(rd => rd.matches.map(loserOf))

  const lbRounds = []
  let ri = 0
  const buildCol = (parts) => {
    const matches = []
    for (let i = 0; i < parts.length; i += 2) {
      matches.push({ id: `lb-r${ri}-m${i / 2}`, a: parts[i] ?? 'Por definir', b: parts[i + 1] ?? 'Por definir' })
    }
    lbRounds.push({ name: `LB Ronda ${ri + 1}`, matches })
    ri++
    return matches.map(m => winnerOf(m.id))
  }

  let carry = buildCol(wbLosers[0] || [])
  let wbIdx = 1
  while (wbIdx < wbRounds.length) {
    const incoming = wbLosers[wbIdx]; wbIdx++
    const mixed = []
    const len = Math.max(carry.length, incoming.length)
    for (let i = 0; i < len; i++) { if (i < carry.length) mixed.push(carry[i]); if (i < incoming.length) mixed.push(incoming[i]) }
    carry = buildCol(mixed)
    if (carry.length > 1) carry = buildCol(carry)
  }
  while (carry.length > 1) carry = buildCol(carry)

  const lbChampion = carry[0] || 'Por definir'
  const wbChampion = buildSingleBracket(teams, results, 'wb').champion || 'Por definir'
  const grandFinal = { id: 'gf', a: wbChampion, b: lbChampion }
  const champion = conf('gf') ? results['gf'].winner : null
  return { wbRounds, lbRounds, grandFinal, champion }
}

// ── Tabla de posiciones real (RR / grupos) ──
export function computeStandings(teamNames, results, matchIds, scoring = {}) {
  const win = Number.isFinite(scoring.win) ? scoring.win : 3
  const draw = Number.isFinite(scoring.draw) ? scoring.draw : 1
  const loss = Number.isFinite(scoring.loss) ? scoring.loss : 0
  const allowDraw = scoring.allowDraw !== false
  const row = {}
  teamNames.forEach(n => { row[n] = { name: n, pj: 0, g: 0, e: 0, p: 0, gf: 0, gc: 0, pts: 0 } })
  matchIds.forEach(id => {
    const r = results[id]
    if (!r || !r.confirmed) return
    const A = row[r.a], B = row[r.b]
    if (!A || !B) return
    const sa = Number(r.scoreA) || 0
    const sb = Number(r.scoreB) || 0
    A.pj++; B.pj++
    A.gf += sa; A.gc += sb; B.gf += sb; B.gc += sa
    if (sa === sb && allowDraw) { A.e++; B.e++; A.pts += draw; B.pts += draw }
    else if (sa > sb) { A.g++; B.p++; A.pts += win; B.pts += loss }
    else { B.g++; A.p++; B.pts += win; A.pts += loss }
  })
  return Object.values(row).sort((x, y) =>
    y.pts - x.pts || (y.gf - y.gc) - (x.gf - x.gc) || y.gf - x.gf || x.name.localeCompare(y.name))
}

// Todos los IDs de partido posibles de un bracket ya construido (para saber,
// dado un resultado confirmado nuevo, si el bracket completo -- 100% BYE/
// "Por definir" resueltos -- ya tiene campeon).
export function allMatchIds(format, teams, results, opts = {}) {
  if (format === 'roundrobin') return roundRobinMatches(teams).map(m => m.id)
  if (format === 'groups') return groupStage(teams, opts.groupCount || Math.max(1, Math.ceil(teams.length / 4))).flatMap(g => g.matches.map(m => m.id))
  if (format === 'swiss') return swissPairings(teams, results, opts.swissRounds || Math.max(3, Math.ceil(Math.log2(Math.max(2, teams.length))) + 1)).rounds.flatMap(rd => rd.matches.map(m => m.id))
  if (format === 'double') {
    const { wbRounds, lbRounds } = buildDoubleBracket(teams, results)
    return [...wbRounds.flatMap(rd => rd.matches.map(m => m.id)), ...lbRounds.flatMap(rd => rd.matches.map(m => m.id)), 'gf']
  }
  return buildSingleBracket(teams, results, 'se').rounds.flatMap(rd => rd.matches.map(m => m.id))
}

// ── Podio por formato ──
// `champion` es el que ya fijo el bracket (bracketDoc.champion): aqui solo se
// completan 2.º y 3.º con el mismo criterio que usa el panel del organizador
// para decidir ese campeon. `competition` = Tournament.competition (grupos,
// clasificados, rondas suizas, puntuacion). Sin datos suficientes devuelve
// solo el campeon, nunca inventa puestos.
const realTeam = (n) => Boolean(n) && n !== 'BYE' && n !== 'Por definir'
const loserOfMatch = (results, m) => {
  const r = results[m.id]
  if (!r?.confirmed || !r.winner) return null
  return r.winner === m.a ? m.b : m.a
}

export function computeFormatPodium(format, teams, results, champion, competition = {}) {
  if (!champion) return null
  const onlyChampion = { champion, runnerUp: '', thirdPlace: [] }
  teams = Array.isArray(teams) ? teams : []
  results = results || {}
  if (teams.length < 2) return onlyChampion
  const fromStandings = (rows) => {
    const names = rows.map(r => r.name).filter(n => realTeam(n) && n !== champion)
    return { champion, runnerUp: names[0] || '', thirdPlace: names[1] ? [names[1]] : [] }
  }

  if (format === 'single') return computePodium(buildSingleBracket(teams, results, 'se').rounds, champion) || onlyChampion
  if (format === 'double') {
    const { lbRounds, grandFinal } = buildDoubleBracket(teams, results)
    const runnerUp = loserOfMatch(results, grandFinal)
    const lbFinal = lbRounds[lbRounds.length - 1]?.matches[0]
    const third = lbFinal ? loserOfMatch(results, lbFinal) : null
    return {
      champion,
      runnerUp: realTeam(runnerUp) ? runnerUp : '',
      thirdPlace: realTeam(third) && third !== champion && third !== runnerUp ? [third] : [],
    }
  }
  if (format === 'roundrobin') {
    return fromStandings(computeStandings(teams, results, roundRobinMatches(teams).map(m => m.id), competition.scoring || {}))
  }
  if (format === 'swiss') {
    const roundCount = competition.swissRounds || Math.max(3, Math.ceil(Math.log2(Math.max(2, teams.length))) + 1)
    return fromStandings(swissPairings(teams, results, roundCount).standings)
  }
  if (format === 'groups') {
    const groups = groupStage(teams, competition.groups || Math.max(1, Math.round(teams.length / 4)))
    const standings = groups.map(g => computeStandings(g.teams, results, g.matches.map(m => m.id), competition.scoring || {}))
    const qualifiers = []
    for (let pos = 0; pos < Math.max(1, competition.advancePerGroup || 2); pos++) {
      standings.forEach(rows => { if (rows[pos]) qualifiers.push(rows[pos].name) })
    }
    if (qualifiers.length < 2) return onlyChampion
    return computePodium(buildSingleBracket(padToPow2(qualifiers), results, 'gpo').rounds, champion) || onlyChampion
  }
  return onlyChampion
}

