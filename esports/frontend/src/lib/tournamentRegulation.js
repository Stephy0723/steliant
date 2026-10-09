// Reglamento OFICIAL del torneo — documento articulado (Articulo N -> clausulas
// N.M). Fuente unica para la vista previa del panel, el PDF y la impresion.
// Se arma desde los datos reales del torneo (formato del adaptador).

import { COMPETITION_SYSTEMS, roundLabel } from '../../../shared/tournamentSetup.mjs'
import { isMobileLegends } from '../../../shared/matchStats.mjs'
import { getGameArt } from '../data/organizerTournaments.js'

const COUNTRY_NAMES = (() => {
  try { return new Intl.DisplayNames(['es'], { type: 'region' }) } catch { return null }
})()
const countryName = code => {
  const c = String(code || '').toUpperCase()
  return (COUNTRY_NAMES?.of(c === 'RD' ? 'DO' : c)) || c
}

export function cleanText(value) {
  if (typeof value !== 'string') return value ?? ''
  return value
    .replace(/Ã¡|ÃƒÂ¡/g, 'a').replace(/Ã©|ÃƒÂ©/g, 'e').replace(/Ã­|ÃƒÂ­/g, 'i')
    .replace(/Ã³|ÃƒÂ³/g, 'o').replace(/Ãº|ÃƒÂº/g, 'u').replace(/Ã±|ÃƒÂ±/g, 'ñ')
    .replace(/Â·|Ã‚Â·/g, '·').replace(/Âº|Ã‚Âº/g, 'º').replace(/[Â¿Â¡]|Ã‚Â¿|Ã‚Â¡/g, '')
    .replace(/â€”|â€“|Ã¢â‚¬â€œ/g, '—').replace(/â€¦/g, '…').replace(/[�]/g, '')
    .replace(/\s+/g, ' ').trim()
}

const dt = (iso, tz) => {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return String(iso)
  const s = d.toLocaleString('es-DO', { day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false })
  return tz ? `${s} h (UTC${tz})` : `${s} h`
}
const money = (n, c = 'USD') => `${Number(n || 0).toLocaleString('es-DO')} ${c}`
const platformName = p => ({ pc: 'PC', console: 'consola', mobile: 'móvil', cross: 'multiplataforma' }[p] || p || 'la plataforma del juego')

function competitionClauses(c, teamword) {
  if (!c?.system) return ['El sistema de competición y la serie por encuentro se anunciarán antes del inicio del torneo.']
  const out = []
  const sysLabel = COMPETITION_SYSTEMS[c.system]?.label || c.system
  if (c.system === 'single_elim') {
    out.push(`El torneo se disputa por eliminación simple: ${teamword} que pierde un encuentro queda eliminado.`)
    if (c.thirdPlace) out.push('Se disputará un encuentro por el tercer puesto entre los perdedores de las semifinales.')
  } else if (c.system === 'double_elim') {
    out.push(`El torneo se disputa por eliminación doble: al perder un encuentro ${teamword} pasa al cuadro inferior; una segunda derrota implica la eliminación.`)
    out.push(c.grandFinalReset
      ? 'La gran final se juega con reinicio de llave: quien llega desde el cuadro inferior debe ganar dos series para consagrarse.'
      : 'La gran final se juega a una sola serie.')
  } else if (c.system === 'round_robin') {
    out.push(`El torneo se disputa por sistema de todos contra todos${c.legs === 2 ? ' a ida y vuelta' : ' a una sola vuelta'}.`)
  } else if (c.system === 'swiss') {
    out.push(`El torneo se disputa por sistema suizo a ${c.swissRounds} rondas; en cada ronda los emparejamientos se realizan entre participantes de récord similar, sin repetir rival.`)
  } else if (c.system === 'groups_playoffs') {
    const phaseSys = c.groupsPhaseSystem === 'swiss' ? 'sistema suizo' : 'todos contra todos'
    out.push(`El torneo consta de una fase de grupos (${c.groups} ${c.groups === 1 ? 'grupo' : 'grupos'}, ${phaseSys}) y una fase de playoffs por ${COMPETITION_SYSTEMS[c.playoffsSystem]?.label?.toLowerCase() || 'eliminación'}.`)
    out.push(`Avanzan a playoffs ${c.advancePerGroup} ${c.advancePerGroup === 1 ? 'participante' : 'participantes'} por grupo, con siembra cruzada (1º de un grupo contra 2º de otro).`)
  }
  const overrides = Object.entries(c.seriesByRound || {})
  out.push(overrides.length
    ? `La serie por encuentro es al mejor de ${c.defaultSeries.replace('BO', '')} por defecto; ${overrides.map(([k, v]) => `la ${roundLabel(k).toLowerCase()} se juega al mejor de ${String(v).replace('BO', '')}`).join(', ')}.`
    : `Todos los encuentros se juegan al mejor de ${c.defaultSeries.replace('BO', '')} (${c.defaultSeries}).`)
  if (c.scoring?.model === 'match_points') {
    out.push(`La clasificación se determina por puntos: victoria ${c.scoring.win}, empate ${c.scoring.draw}, derrota ${c.scoring.loss}.`)
    out.push('En caso de igualdad de puntos, los desempates se aplican en este orden: enfrentamiento directo, diferencia de mapas, diferencia de rondas, número de victorias y, en última instancia, sorteo del staff.')
  } else if (c.scoring?.model === 'placement') {
    out.push('La clasificación se determina por puntos de posición acumulados en las partidas disputadas, según la tabla publicada por el staff.')
  }
  out.push('La siembra inicial se determina por ranking o mediante sorteo público supervisado por el staff.')
  return out
}

export function buildTournamentRegulation(raw) {
  const t = raw || {}
  const art = getGameArt(t.game)
  const currency = t.currency || 'USD'
  const perSide = Number(String(t.modality || '').match(/^(\d+)\s*v/i)?.[1] || 0)
  const teamword = perSide > 1 ? 'el equipo' : 'el jugador'
  const teamwordPl = perSide > 1 ? 'equipos' : 'jugadores'
  const cap = t.capacity ? `${t.capacity} ${teamwordPl}` : 'un cupo definido por la organización'
  const countries = (t.allowedCountries || []).map(countryName)
  const c = t.competition || {}
  const game = cleanText(t.game) || 'el juego oficial'
  const organizer = cleanText(t.organizerBrandName || t.creator || t.organizer) || 'GlitchGang'
  const title = cleanText(t.title) || 'Torneo'
  const complaints = cleanText(t.complaintsChannel || t.contactEmail) || 'el canal de soporte oficial del torneo'
  const orgRules = String(t.rulesText || (Array.isArray(t.rules) ? t.rules.join('\n') : t.rules) || '')
    .split('\n').map(cleanText).filter(Boolean)
  const staff = (Array.isArray(t.staffMembers) ? t.staffMembers : []).filter(m => m.status !== 'declined')
  const prizes = (Array.isArray(t.prizes) ? t.prizes : []).map(p => ({
    place: cleanText(p.place), amount: Number(p.amount) || 0, currency: p.currency || currency,
    items: cleanText(p.items || p.extra || ''), kind: p.kind === 'award' ? 'award' : 'placement',
  })).filter(p => p.place)

  const A = []
  const push = (title, clauses) => A.push({ n: A.length + 1, title, clauses: clauses.filter(Boolean) })

  push('Disposiciones generales', [
    `El presente documento constituye el reglamento oficial del torneo «${title}» (${t.publicId || 's/n'}), organizado por ${organizer} en la plataforma GlitchGang.`,
    t.seasonName ? `Este torneo corresponde a ${cleanText(t.seasonName)}, edición ${t.seasonNumber || 1}.` : '',
    'La inscripción en el torneo implica la aceptación plena e incondicional de este reglamento por parte de todos los integrantes del equipo.',
    'El staff del torneo es la máxima autoridad durante el evento. Sus decisiones son de aplicación inmediata y de cumplimiento obligatorio.',
    'Lo no previsto en este reglamento será resuelto por el staff conforme a los principios del juego limpio y a las políticas generales de GlitchGang.',
  ])

  push('Elegibilidad y requisitos', [
    `Podrán participar ${teamwordPl} registrados en GlitchGang, con su perfil y su plantel (roster) completos, verificados y vinculados antes del check-in.`,
    t.participationScope === 'regional' && countries.length
      ? `La participación está limitada a residentes de los siguientes países: ${countries.join(', ')}. El staff podrá solicitar comprobación de residencia.`
      : 'La participación está abierta a nivel global.',
    t.minorsAllowed
      ? `Todos los jugadores deben tener al menos ${t.minAge || 13} años. Los menores de edad requieren autorización firmada del representante legal, presentada al staff antes del inicio del torneo.`
      : `Todos los jugadores deben tener al menos ${t.minAge || 18} años cumplidos al inicio del torneo. No se admite la participación de menores de edad.`,
    'Cada jugador puede competir con un único equipo por torneo. Quedan prohibidos el uso de cuentas prestadas, el smurfing y los cambios de plantel sin aprobación previa del staff.',
  ])

  push('Inscripción y cupos', [
    `Las inscripciones abren el ${dt(t.registrationStart, t.timezone)} y cierran el ${dt(t.registrationEnd, t.timezone)}.`,
    `El cupo del torneo es de ${cap}. Las inscripciones que superen el cupo formarán una lista de espera por orden de llegada.`,
    t.entryFee ? `La inscripción tiene un costo de ${money(t.entryFee, currency)} por ${perSide > 1 ? 'equipo' : 'jugador'}.` : 'La inscripción es gratuita.',
    t.overcup?.enabled
      ? `Si algún equipo no completa el check-in de presencia, se habilitará el ingreso de equipos de la lista de espera mediante un segundo check-in con una ventana de ${t.overcup.secondCheckinHours || 6} horas.`
      : '',
  ])

  push('Estructura de la competición', competitionClauses(c, teamword))

  push('Calendario, check-in y puntualidad', [
    `El torneo da inicio el ${dt(t.dateIso, t.timezone)}${t.endDateIso ? ` y su finalización está prevista para el ${dt(t.endDateIso, t.timezone)}` : ''}.`,
    `Check-in de presencia: cada equipo debe confirmar activamente su participación antes del ${t.checkinDeadlineIso ? dt(t.checkinDeadlineIso, t.timezone) : 'límite anunciado por el staff'}. El equipo que no complete este check-in no ingresa a la llave.`,
    'Check-in previo a la partida: la ventana abre aproximadamente 30 minutos antes de cada encuentro para verificar rosters, preparar salas y confirmar asistencia.',
    'Puntualidad: pasada la tolerancia definida por el staff, se aplica walkover (W.O.) a favor del equipo presente.',
    t.discordEnabled
      ? 'El check-in y toda la coordinación de partidas se realizan en el servidor de Discord de GlitchGang mediante el bot oficial, por comandos slash. Cada participante debe estar en el servidor y tener su cuenta de Discord vinculada a GlitchGang.'
      : 'El check-in y la coordinación de partidas se realizan a través de la plataforma de GlitchGang y los canales oficiales del torneo.',
  ])

  push('Reglas de juego', [
    `El torneo se disputa en ${game} sobre ${platformName(t.platform)}.`,
    `Servidor / región de juego: ${cleanText(t.server) || 'según convocatoria del staff'}.`,
    `Versión / parche: ${cleanText(t.patch) || 'la versión competitiva vigente al momento de cada partida'}.`,
    t.mapPool
      ? `Mapas: ${t.mapMode === 'random' ? `sorteo aleatorio entre ${t.mapPool}` : t.mapMode === 'veto' ? `selección y veto entre ${t.mapPool}` : `mapa fijo — ${t.mapPool}`}.`
      : 'La rotación de mapas y la configuración de la sala serán las indicadas por el staff antes de cada serie.',
    'La configuración de partida (modo, reglas de la sala, lado de inicio) será la definida por el staff y comunicada a los capitanes antes de cada encuentro.',
  ])

  if (orgRules.length) {
    push('Reglas específicas del organizador', [
      'Además de lo dispuesto en este reglamento, la organización establece las siguientes reglas particulares para este torneo:',
      ...orgRules.map(r => (/[.:;!?]$/.test(r) ? r : `${r}.`)),
    ])
  }

  push('Reporte de resultados y evidencias', [
    isMobileLegends(t.game) && 'Cada equipo debe enviar todas las capturas de estadísticas de cada partida dentro del plazo establecido. No hacerlo se considera violación del reglamento.',
    isMobileLegends(t.game) && 'Los resultados se validan automáticamente cuando las capturas de ambos equipos coinciden. Cualquier discrepancia la resuelve el árbitro del torneo; su decisión puede apelarse una vez.',
    'El capitán del equipo ganador reporta el marcador dentro de los 10 minutos posteriores a la finalización de cada partida.',
    'Ambos equipos deben conservar y subir capturas del marcador final de cada mapa. La evidencia debe permitir identificar el torneo, la ronda y los equipos.',
    'Ante discrepancias en el reporte, el staff resolverá con base en la evidencia presentada. La falta de evidencia podrá resolverse en contra del equipo que no la aporte.',
  ])

  push('Conducta y régimen de sanciones', [
    isMobileLegends(t.game) && 'Cada jugador debe tener verificada su propia cuenta de juego. Registrar un ID falso o ajeno puede causar la descalificación del equipo.',
    isMobileLegends(t.game) && 'Está prohibido cambiar el nickname del juego mientras el equipo participe en un torneo activo.',
    'Queda estrictamente prohibido el uso de cheats, exploits, scripts, bugs a propósito o cualquier software de terceros que altere el juego o dé ventaja indebida.',
    'Queda prohibido el lenguaje ofensivo, el acoso, las amenazas y toda conducta antideportiva, dentro y fuera del juego, en cualquier canal relacionado con el torneo.',
    'Escala de sanciones según gravedad y reincidencia: (a) advertencia; (b) pérdida de mapa; (c) pérdida de la partida por walkover; (d) descalificación del torneo sin derecho a reembolso ni premio; (e) veto de participación en futuros torneos de GlitchGang.',
    'El staff puede aplicar sanciones de oficio, incluso sin denuncia previa, cuando constate una infracción.',
  ])

  push('Disputas y apelaciones', [
    `Toda disputa debe plantearse al staff durante el evento a través de ${complaints}.`,
    'Las decisiones del staff son de aplicación inmediata. Una apelación no suspende la decisión ni el desarrollo del torneo.',
    'Las apelaciones fuera de plazo o sin fundamento nuevo no serán admitidas.',
  ])

  const prizeClauses = []
  if (prizes.filter(p => p.kind === 'placement').length) {
    prizeClauses.push(`Distribución por puesto: ${prizes.filter(p => p.kind === 'placement').map(p => `${p.place} — ${[p.amount ? money(p.amount, p.currency) : '', p.items].filter(Boolean).join(' y ') || 'a anunciar'}`).join('; ')}.`)
  }
  const awards = prizes.filter(p => p.kind === 'award')
  if (awards.length) prizeClauses.push(`Premios especiales: ${awards.map(p => `${p.place} — ${[p.amount ? money(p.amount, p.currency) : '', p.items].filter(Boolean).join(' y ') || 'a anunciar'}`).join('; ')}.`)
  if (!prizeClauses.length) prizeClauses.push('Los premios y su distribución serán anunciados por la organización.')
  prizeClauses.push('La entrega de premios se realiza previa verificación de identidad del beneficiario y en las condiciones que comunique la organización.')
  prizeClauses.push('La descalificación por conducta implica la pérdida automática del derecho a cualquier premio.')
  push('Premios y entrega', prizeClauses)

  push('Imagen, transmisión y contenido', [
    'Los encuentros podrán ser transmitidos, grabados y comentados por la organización y por los casters designados.',
    t.streamUrl ? `Transmisión oficial: ${cleanText(t.streamUrl)}${t.streamLang ? ` (${cleanText(t.streamLang)})` : ''}.` : '',
    'Al inscribirse, los equipos autorizan el uso de su nombre, etiqueta, logo y jugadas con fines de cobertura y promoción del torneo.',
    t.discordEnabled ? 'Las partidas que se disputen en canales de voz podrán ser grabadas y conservadas como evidencia para la resolución de disputas.' : '',
  ])

  if (staff.length) {
    push('Staff del torneo', [
      'El staff acreditado para este torneo es el siguiente:',
      ...staff.map(m => `• ${cleanText(m.nick || m.name)} — ${m.role}${m.status === 'pending' ? ' (confirmación pendiente)' : ''}.`),
      'El staff se identifica con su rol en la plataforma y en los canales oficiales del torneo.',
    ])
  }

  push('Modificaciones y aceptación', [
    'La organización podrá modificar este reglamento por causa justificada. Todo cambio se notificará a los equipos inscritos por los canales oficiales antes de su entrada en vigencia.',
    t.rulesDocument ? 'Forma parte de este reglamento el documento complementario adjunto por la organización.' : '',
    `Reglamento generado el ${new Date().toLocaleString('es-DO', { dateStyle: 'long', timeStyle: 'short' })}. Al inscribirse, el equipo y cada uno de sus integrantes declaran haber leído, comprendido y aceptado este reglamento en su totalidad.`,
  ])

  return {
    meta: {
      title,
      subtitle: [game, t.publicId, t.seasonName ? `${cleanText(t.seasonName)} · Temporada ${t.seasonNumber || 1}` : ''].filter(Boolean).join('   ·   '),
      publicId: t.publicId || t.id || '',
      organizer,
      primaryColor: /^#[0-9a-fA-F]{6}$/.test(t.primaryColor) ? t.primaryColor : (art.color || '#00E676'),
      generatedAt: new Date().toLocaleString('es-DO', { dateStyle: 'long', timeStyle: 'short' }),
      seasonLabel: t.seasonName ? `${cleanText(t.seasonName)} · Temporada ${t.seasonNumber || 1}` : '',
      game,
    },
    articles: A,
    organizerRuleCount: orgRules.length,
    attachedDoc: t.rulesDocument ? { url: t.rulesDocument, name: cleanText(t.rulesName) || 'Reglamento complementario' } : null,
  }
}

