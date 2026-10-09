import { promises as fs } from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import { Team } from '../models/Team.js'
import { TournamentMatch } from '../models/TournamentMatch.js'
import { UPLOAD_DIR } from '../controllers/upload.controller.js'
import { readEvidence, isDiscordEvidence, isLocalEvidence } from './matchStatsVision.service.js'
import { statsMatches, statsSeries } from './matchStats.service.js'
import { siteUrl } from './discordPublications.service.js'
import { REPORT_DEADLINE } from '../../../shared/reportScreenshots.mjs'

// Reportes de /report (Discord) vistos desde la web. TournamentMatch es la
// partida "en vivo" del bot; aqui se la amarra a la partida del bracket web
// y sus capturas se copian a /uploads para que no venzan con el CDN de Discord.

const idOf = v => String(v?._id || v || '')
const norm = s => String(s || '').trim().toLowerCase()
const isRealTeam = name => Boolean(name) && name !== 'BYE' && name !== 'Por definir'
export const MAX_REPORT_EVIDENCE = 6

/**
 * Copia cada captura de Discord a /uploads. Una que no se pueda descargar
 * (vencida, muy grande, no es imagen) se guarda igual con su URL original y
 * archived:false, para que el reporte nunca se pierda por la copia.
 */
export async function archiveReportEvidence(items) {
  const out = []
  for (const item of (Array.isArray(items) ? items : []).slice(0, MAX_REPORT_EVIDENCE)) {
    const sourceUrl = String(item?.url || '').trim()
    if (!sourceUrl) continue
    const entry = { key: String(item.key || '').slice(0, 40), url: sourceUrl, sourceUrl, name: String(item.name || '').slice(0, 200), sha256: '', archived: false }
    if (isDiscordEvidence(sourceUrl)) {
      try {
        const image = await readEvidence(sourceUrl, [sourceUrl])
        const bytes = Buffer.from(image.data, 'base64')
        const ext = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp' }[image.mimeType]
        const name = `${Date.now()}-${crypto.randomBytes(6).toString('hex')}.${ext}`
        await fs.mkdir(UPLOAD_DIR, { recursive: true })
        await fs.writeFile(path.join(UPLOAD_DIR, name), bytes)
        Object.assign(entry, { url: `/uploads/${name}`, sha256: crypto.createHash('sha256').update(bytes).digest('hex'), archived: true })
      } catch (error) {
        console.warn('[report-evidence] No se pudo copiar la captura:', error.message)
      }
    }
    out.push(entry)
  }
  return out
}

// Todos los nombres con los que un equipo inscrito puede aparecer en el
// bracket o en lo que escribe un capitan (nombre, tag, nombre de inscripcion).
async function teamAliases(tournament) {
  const regs = (tournament.registrations || []).filter(r => r.team)
  const docs = await Team.find({ _id: { $in: regs.map(r => idOf(r.team)) } }).select('name tag').lean()
  const map = new Map()
  for (const team of docs) {
    const reg = regs.find(r => idOf(r.team) === idOf(team._id))
    map.set(idOf(team._id), new Set([team.name, team.tag, reg?.teamMeta?.name, reg?.teamMeta?.tag].filter(Boolean).map(norm)))
  }
  return map
}

/**
 * Partida pendiente del bracket que juega este equipo. Si el capitan nombro
 * al rival, se usa para elegir entre varias (liga, suizo); si no, solo se
 * acepta cuando hay exactamente una. Devuelve null si no se puede saber.
 */
export async function resolveBracketMatch(tournament, teamId, rivalName = '') {
  const aliases = await teamAliases(tournament)
  const mine = aliases.get(idOf(teamId))
  if (!mine) return null
  const results = tournament.bracketDoc?.results || {}
  const ownerOf = name => [...aliases.entries()].find(([, set]) => set.has(norm(name)))?.[0] || ''
  const pending = statsMatches(tournament).filter(m =>
    isRealTeam(m.a) && isRealTeam(m.b) && !results[m.id]?.confirmed && (mine.has(norm(m.a)) || mine.has(norm(m.b))))
  const withRival = pending.map(m => {
    const rivalBracketName = mine.has(norm(m.a)) ? m.b : m.a
    return { match: m, rivalBracketName, rivalTeamId: ownerOf(rivalBracketName) }
  })
  const rival = norm(rivalName)
  const named = rival ? withRival.filter(c => norm(c.rivalBracketName) === rival || aliases.get(c.rivalTeamId)?.has(rival)) : []
  // Un rival mal escrito no impide ubicarla si el equipo tiene una sola pendiente.
  const pick = named.length === 1 ? named[0] : withRival.length === 1 ? withRival[0] : null
  if (!pick) return null
  return {
    matchId: pick.match.id,
    rivalBracketName: pick.rivalBracketName,
    rivalTeamId: pick.rivalTeamId,
    series: statsSeries(tournament, pick.match),
  }
}

/** Siguiente juego de la serie para este equipo (1 en BO1). */
export async function nextGameNumber(doc, series = 'BO1') {
  const max = Number(String(series).replace(/\D/g, '')) || 1
  const done = await TournamentMatch.countDocuments({
    _id: { $ne: doc._id }, tournament: doc.tournament, team: doc.team,
    bracketMatchId: doc.bracketMatchId, 'report.createdAt': { $ne: null }, voidedAt: null,
  })
  return Math.min(max, done + 1)
}

/**
 * Plazo de la partida: el que ya fijo el primer /report de cualquiera de los
 * dos equipos para este bracketMatchId + gameNumber, o uno nuevo desde ahora.
 */
export async function gameDeadline(doc, now = new Date()) {
  if (doc.bracketMatchId && doc.gameNumber) {
    const first = await TournamentMatch.findOne({
      _id: { $ne: doc._id }, tournament: doc.tournament, bracketMatchId: doc.bracketMatchId,
      gameNumber: doc.gameNumber, 'report.deadlineAt': { $ne: null }, voidedAt: null,
    }).sort({ 'report.deadlineAt': 1 }).select('report.deadlineAt').lean()
    if (first) return first.report.deadlineAt
  }
  return new Date(now.getTime() + REPORT_DEADLINE.minutes * 60000)
}

/** Agrega capturas nuevas; una de la misma clave reemplaza a la anterior. */
export function mergeEvidence(previous = [], added = []) {
  const plain = e => (e?.toObject ? e.toObject() : e)
  const keys = new Set(added.map(e => e.key).filter(Boolean))
  return [...previous.map(plain).filter(e => !e.key || !keys.has(e.key)), ...added].slice(-MAX_REPORT_EVIDENCE)
}

/** URL absoluta para quien no esta en la web (CRM, embeds de Discord). */
export const absoluteEvidenceUrl = url => (isLocalEvidence(url) ? siteUrl(url) : url)

// Capturas de un reporte, incluidas las viejas que solo tenian evidenceUrl.
export function reportEvidence(report) {
  if (Array.isArray(report?.evidence) && report.evidence.length) {
    return report.evidence.map(e => ({ key: e.key || '', url: e.url, name: e.name || '', archived: Boolean(e.archived) }))
  }
  return report?.evidenceUrl ? [{ key: '', url: report.evidenceUrl, name: report.evidenceName || '', archived: false }] : []
}

export function publicDiscordReport(doc) {
  return {
    id: idOf(doc._id),
    team: idOf(doc.team),
    teamName: doc.teamNameSnapshot || doc.team?.name || '',
    rivalName: doc.rivalName || '',
    bracketMatchId: doc.bracketMatchId || '',
    gameNumber: doc.gameNumber || null,
    result: doc.result || '',
    reporter: doc.report?.reporterUsername || '',
    disputed: Boolean(doc.report?.disputed),
    reportedAt: doc.report?.createdAt || null,
    evidence: reportEvidence(doc.report),
    missing: doc.report?.missing || [],
    deadlineAt: doc.report?.deadlineAt || null,
    deadlineClosed: Boolean(doc.report?.deadlineClosedAt),
    voided: Boolean(doc.voidedAt),
  }
}

/**
 * Reportes de Discord del torneo agrupados por partida del bracket. Los
 * reportes anteriores a bracketMatchId se ubican por el par de equipos
 * (equipo + rival escrito), si ese par aparece una sola vez en el bracket.
 */
export async function discordReportsByMatch(tournament, { matchId = null } = {}) {
  const docs = await TournamentMatch.find({ tournament: tournament._id, 'report.createdAt': { $ne: null } })
    .sort({ 'report.createdAt': 1 }).limit(500).lean()
  if (!docs.length) return new Map()
  const needsLegacy = docs.some(d => !d.bracketMatchId)
  const aliases = needsLegacy ? await teamAliases(tournament) : null
  const matches = needsLegacy ? statsMatches(tournament) : []
  const byMatch = new Map()
  for (const doc of docs) {
    let id = doc.bracketMatchId
    if (!id && aliases) {
      const mine = aliases.get(idOf(doc.team))
      const rival = norm(doc.rivalName)
      const hits = mine && rival ? matches.filter(m => {
        const [own, other] = mine.has(norm(m.a)) ? [m.a, m.b] : mine.has(norm(m.b)) ? [m.b, m.a] : [null, null]
        if (!own) return false
        const otherId = [...aliases.entries()].find(([, set]) => set.has(norm(other)))?.[0]
        return norm(other) === rival || Boolean(otherId && aliases.get(otherId).has(rival))
      }) : []
      if (hits.length === 1) id = hits[0].id
    }
    if (!id || (matchId && id !== matchId)) continue
    byMatch.set(id, [...(byMatch.get(id) || []), publicDiscordReport({ ...doc, bracketMatchId: id })])
  }
  return byMatch
}

/**
 * Reportes de Discord de una partida repartidos por lado del bracket (A =
 * equipo de arriba). `teams` = salida de resolveMatchTeams (A primero).
 */
export function splitBySide(reports, teams) {
  const sideOf = r => (idOf(teams[0]?._id) === r.team ? 'A' : idOf(teams[1]?._id) === r.team ? 'B' : null)
  return {
    A: reports.filter(r => sideOf(r) === 'A'),
    B: reports.filter(r => sideOf(r) === 'B'),
  }
}
