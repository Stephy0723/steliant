// Cosmeticos de perfil: estados, marcos, placas, cartas de logro y combos.
// Reemplaza a data/frames.js y data/badges.js (los marcos y placas viejos).
//
// Cada cosmetico tiene un `source`: el proposito por el que se consigue. El
// motor que decide si esta desbloqueado vive en lib/cosmeticUnlocks.js.

const DAY = 24 * 60 * 60 * 1000

// Propositos de desbloqueo. `days` = regalo temporal con esa duracion;
// `while` = dura mientras se cumpla la condicion (plan activo, racha...).
export const UNLOCK_SOURCES = {
  base: { label: 'Incluido', short: 'Base', desc: 'Disponible para todos desde el primer día.' },
  welcome: { label: 'Regalo de bienvenida', short: 'Bienvenida', desc: 'Se entrega al crear tu cuenta. Es tuyo para siempre.' },
  profile: { label: 'Perfil completo', short: 'Perfil 100%', desc: 'Completa el 100% de tu perfil.' },
  firstTournament: { label: 'Primer torneo', short: 'Primer torneo', desc: 'Juega tu primer torneo oficial.' },
  podium: { label: 'Podio', short: 'Podio', desc: 'Termina entre los 3 primeros de un torneo.' },
  finalist: { label: 'Finalista', short: 'Final', desc: 'Llega a la gran final de un torneo.' },
  winner: { label: 'Campeón', short: 'Campeón', desc: 'Gana un torneo oficial.' },
  champion: { label: 'Campeón reinante', short: 'Gana un torneo', desc: 'Gana un torneo y es tuyo por 7 días.', days: 7 },
  mvp: { label: 'MVP del torneo', short: 'MVP', desc: 'Sé el MVP de un torneo y es tuyo por 7 días.', days: 7 },
  streak: { label: 'En racha', short: 'Racha', desc: '5 victorias seguidas. Dura mientras no pierdas.', while: true },
  premium: { label: 'Premium', short: 'Premium', desc: 'Incluido mientras tengas un plan de pago activo.', while: true },
  birthday: { label: 'Regalo de cumpleaños', short: 'Cumpleaños', desc: 'Es tuyo durante la semana de tu cumpleaños.', days: 7 },
  referral: { label: 'Invitaciones', short: 'Invita 3', desc: 'Invita a 3 amigos que se registren.' },
  ranking: { label: 'Ranking', short: 'Top 10', desc: 'Termina la temporada en el top 10 del ranking.' },
  season: { label: 'Evento de temporada', short: 'Evento', desc: 'Solo mientras dure el evento.', while: true },
  vote: { label: 'Votación', short: 'Del mes', desc: 'Elegido jugador del mes por la comunidad. Dura el mes.', while: true },
  founder: { label: 'Fundador', short: 'Fundador', desc: 'Reservado a los primeros 100 jugadores de GlitchGang.' },
  achievement: { label: 'Logro', short: 'Logro', desc: 'Se gana cumpliendo el logro.' },
}

export function sourceInfo(source) {
  return UNLOCK_SOURCES[source] || UNLOCK_SOURCES.achievement
}

export function sourceDurationMs(source) {
  const days = UNLOCK_SOURCES[source]?.days
  return days ? days * DAY : 0
}

// ── Estados ──
// `motion` y `tint` los siguen usando el Topbar (status-motion--*).
// `fx` es la clase de la animacion del avatar en Cosmetics.css.
export const STATUSES = [
  { id: 'online', label: 'En línea', desc: 'Disponible para jugar', color: '#22c55e', tint: '34,197,94', motion: 'pulse', fx: 's-online', source: 'base' },
  { id: 'playing', label: 'Jugando', desc: 'En partida ahora', color: '#3B82F6', tint: '59,130,246', motion: 'glitch', fx: 's-play', source: 'base' },
  { id: 'torneo', label: 'En torneo', desc: 'Compitiendo en torneo', color: '#FACC15', tint: '250,204,21', motion: 'scale', fx: 's-cup', source: 'base' },
  { id: 'live', label: 'En directo', desc: 'Transmitiendo en vivo', color: '#EF4444', tint: '239,68,68', motion: 'live', fx: 's-live', source: 'base' },
  { id: 'lfg', label: 'Buscando equipo', desc: 'Buscando compañeros', color: '#00E676', tint: '0,230,118', motion: 'search', fx: 's-lfg', source: 'base' },
  { id: 'afk', label: 'AFK', desc: 'Lejos del teclado', color: '#F59E0B', tint: '245,158,11', motion: 'fade', fx: 's-afk', source: 'base' },
  { id: 'dnd', label: 'No molestar', desc: 'Sin notificaciones', color: '#EF4444', tint: '239,68,68', motion: 'guard', fx: 's-dnd', source: 'base' },
  { id: 'invisible', label: 'Invisible', desc: 'Aparecer desconectado', color: '#6B7280', tint: '107,114,128', motion: 'vanish', fx: 's-hide', source: 'base' },
  { id: 'hack', label: 'Hackeando', desc: 'Modo concentración', color: '#00E676', tint: '0,230,118', motion: 'glitch', fx: 's-hack', source: 'welcome', exclusive: true },
  { id: 'king', label: 'Campeón reinante', desc: 'Ganaste el último torneo', color: '#ffd76a', tint: '255,215,106', motion: 'scale', fx: 's-king', source: 'champion', exclusive: true },
  { id: 'surge', label: 'Sobrecarga', desc: 'MVP del último torneo', color: '#7fdcff', tint: '127,220,255', motion: 'live', fx: 's-surge', source: 'mvp', exclusive: true },
  { id: 'streak', label: 'En racha', desc: '5 victorias seguidas o más', color: '#ff7a1a', tint: '255,122,26', motion: 'scale', fx: 's-fire', source: 'streak', exclusive: true },
  { id: 'glitch', label: 'Señal glitch', desc: 'Miembro Premium', color: '#00E676', tint: '0,230,118', motion: 'glitch', fx: 's-glitch', source: 'premium', exclusive: true },
  { id: 'virus', label: 'Infectado', desc: 'Virus de temporada', color: '#39ff6a', tint: '57,255,106', motion: 'glitch', fx: 's-virus', source: 'season', exclusive: true },
  { id: 'e404', label: 'Error 404', desc: 'Jugador no encontrado', color: '#1f4bff', tint: '31,75,255', motion: 'glitch', fx: 's-404', source: 'referral', exclusive: true },
  // Automatico: no se elige, se pone solo el dia del cumpleanos (ver
  // displayStatusId en lib/cosmeticUnlocks.js).
  { id: 'bday', label: 'Cumpleaños', desc: 'Se activa solo el día de tu cumpleaños', color: '#ff5fa2', tint: '255,95,162', motion: 'pulse', fx: 's-bday', source: 'birthday', exclusive: true, auto: true },
]
export const STATUS_BY_ID = Object.fromEntries(STATUSES.map(status => [status.id, status]))
export const DEFAULT_STATUS = 'online'

// ── Marcos ──
export const FRAMES = [
  { id: 'none', name: 'Sin marco', cat: '', desc: 'Avatar limpio, sin decoración.', color: 'transparent', source: 'base' },
  { id: 'rgb', name: 'Glitch RGB', cat: 'Unisex', desc: 'Canales separados y franjas que salen disparadas.', color: '#00E676', source: 'welcome' },
  { id: 'hud', name: 'Radar', cat: 'Unisex', desc: 'Mira que rota, fija y barre.', color: '#00E676', source: 'firstTournament' },
  { id: 'neko', name: 'Orejas neón', cat: 'Femenino', desc: 'Orejas que se mueven y corazones flotando.', color: '#ff5fd1', source: 'profile' },
  { id: 'crystal', name: 'Cristal', cat: 'Femenino', desc: 'Esquirlas de hielo girando alrededor.', color: '#a6d8ff', source: 'referral' },
  { id: 'storm', name: 'Tormenta', cat: 'Místico', desc: 'Rayos que golpean el aro.', color: '#7fdcff', source: 'premium' },
  { id: 'error404', name: 'Error 404', cat: 'Masculino', desc: 'Ventanas de error que saltan y un cursor perdido.', color: '#1f4bff', source: 'season' },
  { id: 'flames', name: 'Llamas', cat: 'Masculino', desc: 'Corona de fuego que no se apaga.', color: '#ff6a00', source: 'streak' },
  { id: 'portal', name: 'Portal arcano', cat: 'Místico', desc: 'Anillos de runas y orbes en órbita.', color: '#a07cff', source: 'ranking' },
  { id: 'virus', name: 'Infección', cat: 'Exclusivo', desc: 'Píxeles que infectan el aro y gotean.', color: '#39ff6a', source: 'mvp' },
  { id: 'crown', name: 'Corona', cat: 'Exclusivo', desc: 'Corona ladeada, aro de oro y destellos.', color: '#ffd76a', source: 'champion' },
]
export const FRAME_BY_ID = Object.fromEntries(FRAMES.map(frame => [frame.id, frame]))
export const WELCOME_FRAME = 'rgb'

// ── Placas ── (ids numericos: activeBadge en el backend es Number; 0 = sin placa)
export const PLATES = [
  { id: 201, key: 'sig', name: 'Señal', cat: 'Unisex', desc: 'La marca: scanlines, onda y glitch.', sub: 'señal://conectado', color: '#00E676', source: 'welcome' },
  { id: 202, key: 'data', name: 'Datacorp', cat: 'Unisex', desc: 'Etiqueta técnica con código en flujo.', sub: 'Datacorp · protocolo DS4', color: '#e3262f', source: 'firstTournament' },
  { id: 203, key: 'inf', name: 'Infinite', cat: 'Femenina', desc: 'Lila con franjas que avanzan y globo en giro.', sub: 'Más allá del juego', color: '#b49cff', source: 'profile' },
  { id: 204, key: 'sak', name: 'Sakura', cat: 'Femenina', desc: 'Estrellas que laten y cinta en movimiento.', sub: 'Sakura · edición rosa', color: '#ff2e93', source: 'birthday' },
  { id: 205, key: 'reb', name: 'Rebels', cat: 'Masculina', desc: 'Damero en marcha y flecha que empuja.', sub: 'Rebelde · sin reglas', color: '#ff5a5a', source: 'podium' },
  { id: 206, key: 'haz', name: 'Hazard', cat: 'Masculina', desc: 'Franja de peligro en movimiento y alerta.', sub: 'Zona restringida', color: '#ffd400', source: 'streak' },
  { id: 207, key: 'arc', name: 'Arcano', cat: 'Mística', desc: 'Panal de hexágonos que se enciende.', sub: 'Protocolo arcano', color: '#a07cff', source: 'ranking' },
  { id: 208, key: 'ecl', name: 'Eclipse', cat: 'Mística', desc: 'Sol de rayos girando y órbitas.', sub: 'En condiciones extremas', color: '#f3f5f8', source: 'season' },
  { id: 209, key: 'hck', name: 'Hacked', cat: 'Exclusiva', desc: 'El nick se corrompe y se reconstruye.', sub: 'Modificación — R53/a1', color: '#ff3b4d', source: 'mvp' },
  { id: 210, key: 'fnd', name: 'Fundador', cat: 'Exclusiva', desc: 'Numerada, oro que recorre el borde.', sub: 'Fundador · edición limitada', color: '#ffd76a', source: 'founder' },
]
export const PLATE_BY_ID = Object.fromEntries(PLATES.map(plate => [plate.id, plate]))
export const WELCOME_PLATE = 201

// ── Cartas de logro ── (coleccion; se ganan con el logro y son permanentes)
export const ACHIEVEMENT_CARDS = [
  { id: 'gold', name: 'Campeón', goal: 'Gana un torneo oficial.', source: 'winner' },
  { id: 'silver', name: 'Subcampeón', goal: 'Llega a la gran final.', source: 'finalist' },
  { id: 'bronze', name: 'Tercer lugar', goal: 'Termina en el podio.', source: 'podium' },
  { id: 'mvp', name: 'MVP', goal: 'Mejor rendimiento individual del torneo.', source: 'achievement' },
  { id: 'goat', name: 'G.O.A.T.', goal: 'Top 1 histórico de GlitchGang.', source: 'achievement' },
  { id: 'rookie', name: 'Mejor novato', goal: 'Mejor jugador en su primera temporada.', source: 'achievement' },
  { id: 'clutch', name: 'Clutch', goal: 'Gana una ronda en desventaja de 1 contra 3 o más.', source: 'achievement' },
  { id: 'wall', name: 'La Muralla', goal: 'Menos muertes en todo el torneo.', source: 'achievement' },
  { id: 'hawk', name: 'Ojo de halcón', goal: 'Mayor precisión de disparo del torneo.', source: 'achievement' },
  { id: 'cap', name: 'Capitán', goal: 'Lidera a tu escuadra hasta el título.', source: 'achievement' },
  { id: 'fire', name: 'Invicto', goal: '10 victorias seguidas sin perder un mapa.', source: 'achievement' },
  { id: 'month', name: 'Jugador del mes', goal: 'Elegido por votación de la comunidad.', source: 'vote' },
]
export const CARD_BY_ID = Object.fromEntries(ACHIEVEMENT_CARDS.map(card => [card.id, card]))

// ── Combos ── carta + marco + placa que se ven juntos.
export const COMBOS = [
  { id: 'royal', name: 'Rey del podio', rarity: 'Legendario', desc: 'Para quien ganó el torneo. Oro en las tres piezas: la carta de campeón, la corona ladeada y la placa numerada.', card: 'gold', frame: 'crown', plate: 210 },
  { id: 'virus', name: 'Virus MVP', rarity: 'Épico', desc: 'El MVP que rompe el sistema. Separación RGB en la carta, píxeles que infectan el avatar y un nick que se corrompe.', card: 'mvp', frame: 'virus', plate: 209 },
  { id: 'arcane', name: 'Leyenda arcana', rarity: 'Mítico', desc: 'Reservado al G.O.A.T. Lámina holográfica, portal de runas y el panal arcano bajo el nick.', card: 'goat', frame: 'portal', plate: 207 },
]

// ── Ids viejos ──
// Antes del rediseno habia 16 marcos y 37 placas con otros ids. El backend
// sigue poniendo 'pixel-rush' y 101 por defecto a las cuentas nuevas: esos
// (y cualquier id viejo) pasan al regalo de bienvenida.
export function resolveFrameId(id) {
  if (!id) return WELCOME_FRAME
  return FRAME_BY_ID[id] ? id : WELCOME_FRAME
}

export function resolvePlateId(id) {
  const n = Number(id)
  if (n === 0) return 0
  return PLATE_BY_ID[n] ? n : WELCOME_PLATE
}

export function resolveStatusId(id) {
  const status = STATUS_BY_ID[id]
  return status && !status.auto ? id : DEFAULT_STATUS
}

