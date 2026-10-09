// Roles / lineas / posiciones por juego (id canonico de shared/games.mjs) para
// los selects del perfil de jugador. Un juego que no esta aqui cae a texto
// libre en el formulario, igual que gameRanks.js con los rangos: mejor no
// inventar posiciones que el juego no tiene.
export const GAME_ROLES = {
  'league-of-legends': ['Top', 'Jungla', 'Mid', 'ADC / Bot', 'Support'],
  'league-of-legends-wild-rift': ['Baron (Top)', 'Jungla', 'Mid', 'Dragón (Bot)', 'Support'],
  'mobile-legends-bang-bang': ['EXP', 'Gold', 'Mid', 'Jungla', 'Roam'],
  'honor-of-kings': ['Clash (Top)', 'Jungla', 'Mid', 'Farm (Bot)', 'Roam'],
  'dota-2': ['Pos 1 (Carry)', 'Pos 2 (Mid)', 'Pos 3 (Offlane)', 'Pos 4 (Soft Support)', 'Pos 5 (Hard Support)'],
  valorant: ['Duelista', 'Iniciador', 'Controlador', 'Centinela', 'Flex', 'IGL'],
  'counter-strike-2': ['Entry', 'AWPer', 'Lurker', 'Support', 'IGL'],
  overwatch: ['Tank', 'DPS', 'Support'],
  'overwatch-2': ['Tank', 'DPS', 'Support'],
  'apex-legends': ['Fragger', 'Support', 'Reconocimiento', 'IGL'],
  'rainbow-six-siege': ['Entry', 'Anchor', 'Roamer', 'Support', 'IGL'],
  'pubg-mobile': ['Fragger', 'Support', 'Scout', 'IGL'],
  'free-fire': ['Rusher', 'Support', 'Sniper', 'Capitán / IGL'],
  fortnite: ['Fragger', 'Builder', 'Support', 'IGL'],
  'rocket-league': ['Delantero', 'Medio', 'Defensa', 'Flex'],
}

export function rolesFor(gameId) {
  return GAME_ROLES[String(gameId || '')] || []
}

// Objetivo y nivel de equipo que se busca / ofrece.
export const PLAYER_OBJECTIVES = [
  'Jugar casual / con amigos', 'Scrims', 'Torneos amateur', 'Competitivo serio', 'Profesional',
]

