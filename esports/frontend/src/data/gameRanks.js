// Rangos oficiales del ladder competitivo de cada juego, en español (LATAM)
// donde el juego los traduce así. Un juego que no está aquí no tiene un
// sistema de rango público conocido con el que estemos seguros -- el
// formulario cae a texto libre para ese juego en vez de inventar tiers que
// no existen. Mismo patron que GAME_MODALITIES en shared/games.mjs.
export const GAME_RANK_TIERS = {
  valorant: ['Hierro', 'Bronce', 'Plata', 'Oro', 'Platino', 'Diamante', 'Ascendente', 'Inmortal', 'Radiante'],
  'league-of-legends': ['Hierro', 'Bronce', 'Plata', 'Oro', 'Platino', 'Esmeralda', 'Diamante', 'Maestro', 'Gran Maestro', 'Retador'],
  'league-of-legends-wild-rift': ['Hierro', 'Bronce', 'Plata', 'Oro', 'Platino', 'Esmeralda', 'Diamante', 'Maestro', 'Gran Maestro', 'Retador'],
  'teamfight-tactics': ['Hierro', 'Bronce', 'Plata', 'Oro', 'Platino', 'Esmeralda', 'Diamante', 'Maestro', 'Gran Maestro', 'Retador'],
  'counter-strike-2': ['Plata', 'Nova de Oro', 'Guardián Maestro', 'Águila Legendaria', 'Supremo Maestro', 'Elite Global'],
  'dota-2': ['Heraldo', 'Guardián', 'Cruzado', 'Arconte', 'Leyenda', 'Antiguo', 'Divino', 'Inmortal'],
  'mobile-legends-bang-bang': ['Guerrero', 'Élite', 'Maestro', 'Gran Maestro', 'Épico', 'Leyenda', 'Mítico', 'Gloria Mítica'],
  'apex-legends': ['Bronce', 'Plata', 'Oro', 'Platino', 'Diamante', 'Maestro', 'Depredador Apex'],
  overwatch: ['Bronce', 'Plata', 'Oro', 'Platino', 'Diamante', 'Maestro', 'Gran Maestro', 'Campeón'],
  'overwatch-2': ['Bronce', 'Plata', 'Oro', 'Platino', 'Diamante', 'Maestro', 'Gran Maestro', 'Campeón'],
  'rainbow-six-siege': ['Cobre', 'Bronce', 'Plata', 'Oro', 'Platino', 'Esmeralda', 'Diamante', 'Campeón'],
  'pubg-mobile': ['Bronce', 'Plata', 'Oro', 'Platino', 'Diamante', 'Corona', 'As', 'As Maestro', 'As Dominador', 'Conquistador'],
  'free-fire': ['Bronce', 'Plata', 'Oro', 'Platino', 'Diamante', 'Heroico', 'Gran Maestro'],
  fortnite: ['Bronce', 'Plata', 'Oro', 'Platino', 'Diamante', 'Élite', 'Campeón', 'Irreal'],
  'rocket-league': ['Bronce', 'Plata', 'Oro', 'Platino', 'Diamante', 'Campeón', 'Gran Campeón', 'Leyenda Supersónica'],
  'rocket-league-sideswipe': ['Bronce', 'Plata', 'Oro', 'Platino', 'Diamante', 'Campeón', 'Gran Campeón', 'Leyenda Supersónica'],
  'starcraft-ii': ['Bronce', 'Plata', 'Oro', 'Platino', 'Diamante', 'Maestro', 'Gran Maestro'],
  hearthstone: ['Bronce', 'Plata', 'Oro', 'Platino', 'Diamante', 'Leyenda'],
}

export function ranksFor(gameId) {
  return GAME_RANK_TIERS[String(gameId || '')] || []
}

