import { Team } from '../models/Team.js'
import { Season } from '../models/Season.js'
import { TeamCompetitiveProfile } from '../models/TeamCompetitiveProfile.js'
import { config } from '../config/index.js'

const DIVISION_LABELS = {
  academia: 'Academia',
  amateur: 'Amateur',
  semi_pro: 'Semi-Pro',
  pro: 'Profesional',
  elite: 'Elite',
}

function normalizeValue(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[\s-]+/g, '_')
}

function inferDivision(team = {}) {
  const values = [
    team.level,
    team.category,
    ...(Array.isArray(team.tiers) ? team.tiers : []),
  ].map(normalizeValue).filter(Boolean)

  if (values.some(value => ['elite', 'legendario', 'challenger', 'top'].includes(value))) return 'elite'
  if (values.some(value => ['pro', 'profesional', 'professional', 'sig_liga', 'liga_pro'].includes(value))) return 'pro'
  if (values.some(value => ['semi_pro', 'semipro', 'semi_profesional', 'semi_professional'].includes(value))) return 'semi_pro'
  if (values.some(value => ['amateur', 'diamante', 'mitico', 'platino'].includes(value))) return 'amateur'
  return 'academia'
}

function getEligibility(division, status = 'active') {
  if (status === 'vetoed') {
    return { canChallenge: false, canBeChallenged: false, reason: 'Equipo vetado competitivamente.' }
  }
  if (status === 'sanctioned') {
    return { canChallenge: false, canBeChallenged: false, reason: 'Equipo sancionado temporalmente.' }
  }

  const canChallenge = ['amateur', 'semi_pro', 'pro', 'elite'].includes(division)
  const canBeChallenged = ['pro', 'elite'].includes(division)

  return {
    canChallenge,
    canBeChallenged,
    reason: canBeChallenged
      ? 'Puede recibir retos del modo retador.'
      : canChallenge
        ? 'Puede retar equipos habilitados.'
        : 'Debe completar actividad competitiva para desbloquear retos.',
  }
}

async function getActiveSeasonForTeam(team = {}) {
  const now = new Date()
  const game = team.game || ''
  const region = team.region || ''
  const filters = [
    { status: 'active', game, region },
    { status: 'active', game, region: '' },
    { status: 'active', game: '', region },
    { status: 'active', game: '', region: '' },
    { startsAt: { $lte: now }, endsAt: { $gte: now } },
  ]

  for (const filter of filters) {
    const season = await Season.findOne(filter).sort({ startsAt: -1 }).lean()
    if (season) return season
  }

  return null
}

async function getLegacyRank(team = {}) {
  const points = Number(team.rankPts || 0)
  const filter = {}
  if (team.game) filter.game = team.game
  if (team.region) filter.region = team.region

  const [above, totalTeams] = await Promise.all([
    Team.countDocuments({ ...filter, rankPts: { $gt: points } }),
    Team.countDocuments(filter),
  ])

  return {
    rank: totalTeams ? above + 1 : null,
    totalTeams,
  }
}

export async function getTeamCompetitiveSnapshot(team = {}) {
  const fallbackPoints = Number(team.rankPts ?? 0)
  const fallbackDivision = inferDivision(team)

  if (!config.mongoEnabled || !team?._id) {
    return {
      season: { id: 'demo-season', name: 'Temporada actual', slug: 'temporada-actual', status: 'active' },
      division: fallbackDivision,
      divisionLabel: DIVISION_LABELS[fallbackDivision],
      points: fallbackPoints,
      rank: null,
      rankLabel: 'N/A',
      totalTeams: 0,
      status: 'active',
      eligibility: getEligibility(fallbackDivision),
      source: 'rankPts',
    }
  }

  const season = await getActiveSeasonForTeam(team)
  const profile = season
    ? await TeamCompetitiveProfile.findOne({ team: team._id, season: season._id }).lean()
    : null
  const legacyRank = await getLegacyRank(team)
  const division = profile?.division || fallbackDivision
  const rank = Number(profile?.rank || legacyRank.rank || 0) || null
  const points = Number(profile?.points ?? fallbackPoints)

  return {
    season: season
      ? {
          id: String(season._id),
          name: season.name,
          slug: season.slug,
          status: season.status,
          startsAt: season.startsAt,
          endsAt: season.endsAt,
        }
      : { id: 'legacy-rank', name: 'Ranking actual', slug: 'ranking-actual', status: 'active' },
    division,
    divisionLabel: DIVISION_LABELS[division] || division,
    points,
    rank,
    rankLabel: rank ? `#${rank}` : 'N/A',
    totalTeams: Number(legacyRank.totalTeams || 0),
    status: profile?.status || 'active',
    eligibility: profile?.eligibility || getEligibility(division, profile?.status || 'active'),
    source: profile ? 'season' : 'rankPts',
  }
}
