// Titulos de los equipos (vitrina de la pagina del equipo y cinta dorada de la
// tarjeta). Fuente: lo que guarda el servidor (Team.titles en GET /teams/:id y
// titlesSummary en GET /teams, ver tournamentTitles.service.js). Solo si el
// backend no los manda (version vieja) se recalculan desde los torneos
// terminados: el podio sale del bracket guardado con computeFormatPodium
// (mismo calculo que el backend, en cualquier formato).
import { useEffect, useState } from 'react'
import { api } from './api.js'
import { computeFormatPodium, normalizeFormat } from '../../../shared/bracketEngine.mjs'
import { championWord } from './championPoster.js'

export const PLACEMENT_LABEL = { 1: 'Campeón', 2: 'Subcampeón', 3: 'Tercer lugar' }
export const PLACEMENT_COLOR = { 1: '#ffc700', 2: '#c9ccd1', 3: '#c98a5b' }

const norm = value => String(value || '').trim().toLowerCase()
const PLACEHOLDERS = new Set(['', 'bye', 'por definir'])

export function tournamentPodium(tournament) {
  const doc = tournament?.bracketDoc || {}
  const champion = doc.champion || tournament?.winner || ''
  if (!champion) return null
  const format = doc.format || normalizeFormat(tournament?.format)
  return computeFormatPodium(format, doc.teams, doc.results, champion, tournament?.competition || {})
}

// Nombre en la llave -> inscripcion. Misma numeracion de repetidos que
// resolveBracketTeams / registrationsByBracketName ("Equipo (2)").
function registrationsByName(registrations) {
  const seen = {}
  const map = new Map()
  for (const reg of registrations || []) {
    const base = String(reg.teamMeta?.name || reg.team?.name || reg.name || reg.teamMeta?.tag || reg.tag || 'Equipo').trim()
    seen[base] = (seen[base] || 0) + 1
    map.set(norm(seen[base] > 1 ? `${base} (${seen[base]})` : base), reg)
  }
  return map
}

const teamIdOf = reg => String(reg?.team?._id || reg?.team || '')

/**
 * Map clave -> titulos. Claves: `id:<teamId>` (cuando la inscripcion enlaza
 * el equipo) y `name:<nombre>` (respaldo para inscripciones viejas).
 */
export function titlesIndex(tournaments) {
  const index = new Map()
  const add = (key, title) => {
    if (!key) return
    const list = index.get(key) || []
    if (!list.some(item => item.tournamentId === title.tournamentId)) list.push(title)
    index.set(key, list)
  }
  for (const tournament of tournaments || []) {
    if (tournament?.status !== 'finished') continue
    const podium = tournamentPodium(tournament)
    if (!podium) continue
    const regs = registrationsByName(tournament.registrations)
    const places = [
      [podium.champion, 1],
      [podium.runnerUp, 2],
      ...(podium.thirdPlace || []).map(name => [name, 3]),
    ]
    for (const [name, placement] of places) {
      if (PLACEHOLDERS.has(norm(name))) continue
      const title = {
        placement,
        label: PLACEMENT_LABEL[placement],
        teamName: name,
        tournamentId: String(tournament._id || tournament.id || ''),
        publicId: tournament.publicId || '',
        tournamentTitle: tournament.title || 'Torneo',
        game: tournament.game || '',
        banner: tournament.banner || '',
        date: tournament.endDate || tournament.date || '',
        seriesId: tournament.seriesId || '',
      }
      add(teamIdOf(regs.get(norm(name))) ? `id:${teamIdOf(regs.get(norm(name)))}` : '', title)
      add(`name:${norm(name)}`, title)
    }
  }
  return index
}

const byDateThenPlacement = (a, b) =>
  (Date.parse(b.date) || 0) - (Date.parse(a.date) || 0) || a.placement - b.placement

/** Team.titles del servidor con la forma de la vitrina (null si no vino). */
export function serverTitles(team) {
  if (!Array.isArray(team?.titles)) return null
  return team.titles.map(title => ({
    placement: title.placement,
    label: PLACEMENT_LABEL[title.placement],
    teamName: team.name || '',
    tournamentId: String(title.tournament?._id || title.tournament || ''),
    publicId: title.publicId || '',
    tournamentTitle: title.tournamentTitle || 'Torneo',
    game: title.game || '',
    banner: '',
    date: title.date || '',
    seriesId: title.seriesId || '',
    current: Boolean(title.current),
  })).sort(byDateThenPlacement)
}

/** Titulos de un equipo, del mas reciente al mas viejo; campeonatos primero a igual fecha. */
export function titlesForTeam(team, index) {
  const stored = serverTitles(team)
  if (stored) return stored
  if (!team || !index) return []
  const byId = new Map()
  for (const key of [`id:${String(team._id || team.id || '')}`, `name:${norm(team.name)}`]) {
    for (const title of index.get(key) || []) byId.set(title.tournamentId, title)
  }
  return [...byId.values()].sort(byDateThenPlacement)
}

/**
 * Resumen para la vitrina y la tarjeta: contadores por puesto y el ultimo
 * campeonato, con "Bicampeon/Tricampeon..." si gano varias ediciones de la
 * misma serie (seriesId).
 */
export function titleSummary(titles) {
  const counts = { 1: 0, 2: 0, 3: 0 }
  for (const title of titles) counts[title.placement] += 1
  const championships = titles.filter(title => title.placement === 1)
  const bySeries = {}
  for (const title of championships) if (title.seriesId) bySeries[title.seriesId] = (bySeries[title.seriesId] || 0) + 1
  const latest = championships[0] || null
  return {
    counts,
    total: titles.length,
    latestChampionship: latest,
    latestHeadline: latest ? championWord(latest.seriesId ? bySeries[latest.seriesId] : 1) : '',
    seriesTitles: bySeries,
  }
}

// Una sola peticion por sesion: la lista publica de torneos terminados ya
// trae registrations + bracketDoc. Se comparte entre Equipos y la pagina del
// equipo.
let finishedCache = null
export function fetchFinishedTournaments() {
  if (!finishedCache) {
    finishedCache = api('/tournaments?status=finished&limit=200')
      .then(data => (Array.isArray(data?.tournaments) ? data.tournaments : []))
      .catch(error => { finishedCache = null; throw error })
  }
  return finishedCache
}

/**
 * Indice de titulos de todos los equipos, recalculado desde los torneos
 * terminados (null mientras carga, si falla o si `enabled` es false). Solo
 * hace falta cuando el servidor no mando los titulos guardados.
 */
export function useTitlesIndex(enabled = true) {
  const [index, setIndex] = useState(null)
  useEffect(() => {
    if (!enabled) return undefined
    let alive = true
    fetchFinishedTournaments()
      .then(list => { if (alive) setIndex(titlesIndex(list)) })
      .catch(() => { if (alive) setIndex(new Map()) })
    return () => { alive = false }
  }, [enabled])
  return index
}

