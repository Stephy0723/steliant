// Configuracion de roster por juego, compartida entre el wizard de creacion
// de equipos (Teams.jsx) y el panel de gestion (MyTeamPanel.jsx) para que
// ambos muestren los mismos cupos y nombres de posicion por juego.

export const ROSTER_SLOTS = {
  'League of Legends': { players: 5, subs: 2, coach: true, analyst: true, rep: true },
  'Mobile Legends': { players: 5, subs: 2, coach: true, analyst: true, rep: true },
  'Dota 2': { players: 5, subs: 2, coach: true, analyst: true, rep: true },
  'Valorant': { players: 5, subs: 1, coach: true, analyst: true, rep: false },
  'CS2': { players: 5, subs: 1, coach: true, analyst: true, rep: false },
  'Apex Legends': { players: 3, subs: 1, coach: true, analyst: false, rep: false },
  'Fortnite': { players: 4, subs: 1, coach: false, analyst: false, rep: false },
  'Free Fire': { players: 4, subs: 1, coach: true, analyst: false, rep: false },
  'Rocket League': { players: 3, subs: 1, coach: true, analyst: false, rep: false },
  'Tekken 8': { players: 1, subs: 1, coach: true, analyst: false, rep: false },
  // Copa Universitaria Popular: ambos se juegan 1 contra 1.
  'Super Smash Bros. Ultimate': { players: 1, subs: 1, coach: true, analyst: false, rep: false },
  'NBA 2K': { players: 1, subs: 1, coach: true, analyst: false, rep: false },
}

export const GAME_ROSTER_SLOTS_LABELS = {
  'Mobile Legends': {
    titulares: ['EXP', 'Gold', 'Mid', 'Jungla', 'Roam'],
    suplentes: ['Suplente 1', 'Suplente 2', 'Suplente 3'],
    coach: ['Coach'],
  },
  'League of Legends': {
    titulares: ['Top', 'Jungla', 'Mid', 'ADC', 'Support'],
    suplentes: ['Suplente 1', 'Suplente 2'],
    coach: ['Coach', 'Analista'],
  },
  'Dota 2': {
    titulares: ['Pos 1 (Carry)', 'Pos 2 (Mid)', 'Pos 3 (Offlane)', 'Pos 4 (Soft Support)', 'Pos 5 (Hard Support)'],
    suplentes: ['Suplente 1', 'Suplente 2'],
    coach: ['Coach'],
  },
  'Valorant': {
    titulares: ['Duelista', 'Iniciador', 'Controlador', 'Centinela', 'Flex'],
    suplentes: ['Suplente 1'],
    coach: ['Coach'],
  },
  'CS2': {
    titulares: ['Titular 1', 'Titular 2', 'Titular 3', 'Titular 4', 'Titular 5'],
    suplentes: ['Suplente 1'],
    coach: ['Coach'],
  },
  'Apex Legends': {
    titulares: ['Titular 1', 'Titular 2', 'Titular 3'],
    suplentes: ['Suplente 1'],
    coach: ['Coach'],
  },
  'Fortnite': {
    titulares: ['Titular 1', 'Titular 2', 'Titular 3', 'Titular 4'],
    suplentes: ['Suplente 1'],
  },
  'Free Fire': {
    titulares: ['Titular 1', 'Titular 2', 'Titular 3', 'Titular 4'],
    suplentes: ['Suplente 1'],
    coach: ['Coach'],
  },
  'Rocket League': {
    titulares: ['Titular 1', 'Titular 2', 'Titular 3'],
    suplentes: ['Suplente 1'],
    coach: ['Coach'],
  },
  'Tekken 8': {
    titulares: ['Titular 1'],
    suplentes: ['Suplente 1'],
    coach: ['Coach'],
  },
  'Super Smash Bros. Ultimate': {
    titulares: ['Titular 1'],
    suplentes: ['Suplente 1'],
    coach: ['Coach'],
  },
  'NBA 2K': {
    titulares: ['Titular 1'],
    suplentes: ['Suplente 1'],
    coach: ['Coach'],
  },
}

// Devuelve el nombre de posicion especifico del juego para un slot
// (ej: 'titular-3' en Mobile Legends -> 'Mid'), con fallback generico
// si el juego no esta en el catalogo o el slot no tiene nombre asignado.
export function rosterSlotPositionLabel(slot = '', game = '') {
  const labels = GAME_ROSTER_SLOTS_LABELS[game]
  if (slot.startsWith('titular')) {
    const idx = parseInt(slot.split('-')[1], 10) - 1
    return labels?.titulares?.[idx] || `Titular ${idx + 1}`
  }
  if (slot.startsWith('sub')) {
    const idx = parseInt(slot.split('-')[1], 10) - 1
    return labels?.suplentes?.[idx] || `Suplente ${idx + 1}`
  }
  if (slot.startsWith('coach')) return slot === 'coach-2' ? 'Coach asistente' : 'Coach'
  if (slot.startsWith('analyst')) return slot === 'analyst-2' ? 'Analista 2' : 'Analista'
  if (slot.startsWith('manager')) return 'Manager'
  if (slot.startsWith('rep')) return 'Representante'
  if (slot.startsWith('patrocinador') || slot.startsWith('sponsor')) return 'Patrocinador'
  return 'Miembro'
}

