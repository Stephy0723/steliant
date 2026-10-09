export const POINT_LEVELS = [
  { id:'rookie', name:'Rookie', min:0, color:'#f5f5f5', accent:'#202020', glow:'rgba(255,255,255,.18)', intensity:1 },
  { id:'aspirant', name:'Aspirante', min:200, color:'#ffe600', accent:'#3a2400', glow:'rgba(255,230,0,.38)', intensity:2 },
  { id:'competitor', name:'Competidor', min:500, color:'#c026ff', accent:'#2a003b', glow:'rgba(192,38,255,.48)', intensity:3 },
  { id:'elite', name:'Elite Carmesi', min:1000, color:'#ff2438', accent:'#360007', glow:'rgba(255,36,56,.56)', intensity:4 },
  { id:'legend', name:'Leyenda Obsidiana', min:2500, color:'#ffe600', accent:'#090909', glow:'rgba(255,230,0,.68)', intensity:5 },
]

const ECLIPSE_STEP = 2500

export function getProfileLevel(points) {
  const lastBaseLevel = POINT_LEVELS.at(-1)
  if (points < lastBaseLevel.min) {
    const index = POINT_LEVELS.findIndex((item, itemIndex) => points >= item.min && points < POINT_LEVELS[itemIndex + 1]?.min)
    return { level:POINT_LEVELS[index], nextLevel:POINT_LEVELS[index + 1] }
  }

  const eclipseRank = Math.floor((points - lastBaseLevel.min) / ECLIPSE_STEP) + 1
  const min = lastBaseLevel.min + (eclipseRank - 1) * ECLIPSE_STEP
  const createEclipseLevel = (rank, rankMin) => ({
    id:`eclipse-${rank}`,
    name:`Eclipse ${rank}`,
    min:rankMin,
    color:rank % 2 ? '#ffe600' : '#ff2438',
    accent:'#050505',
    glow:rank % 2 ? 'rgba(255,230,0,.82)' : 'rgba(255,36,56,.82)',
    intensity:6 + rank,
  })
  return { level:createEclipseLevel(eclipseRank, min), nextLevel:createEclipseLevel(eclipseRank + 1, min + ECLIPSE_STEP) }
}

