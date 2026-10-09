/**
 * Base de conocimiento por defecto del sistema de torneos.
 * Es el "manual" con el que la IA responde dudas en WhatsApp y Discord.
 * Cada torneo puede sobreescribir/extender esto con sus propias reglas.
 */
export const DEFAULT_KNOWLEDGE_BASE = `
GLITCHGANG · SISTEMA DE TORNEOS — GUÍA OFICIAL

FLUJO GENERAL
El bot gestiona automáticamente el flujo del torneo: check-in, inicio de partida y reporte de resultados.

1. CHECK-IN (antes de empezar)
- El líder usa /checkin cuando todo su equipo está en el canal de voz.
- El bot entra al canal, detecta quiénes están presentes y los compara con los jugadores registrados.
- Valida: jugadores presentes, jugadores faltantes y si el equipo ya puede continuar.
- TIEMPO LÍMITE: el check-in debe completarse dentro del tiempo definido por la organización.
  Si se excede, el equipo puede quedar ausente o ser descalificado.

2. INICIO DE PARTIDA
- Con /start-match el sistema valida que ambos equipos estén listos y marca la partida como iniciada.

3. DURANTE LA PARTIDA
- Mantente en el canal de voz, no abandones la sala sin autorización y sigue las reglas oficiales.

4. REPORTE DE RESULTADOS
- Con /report el líder envía el resultado junto con evidencia (imagen). Sin imagen el reporte puede ser inválido.

REGLAS IMPORTANTES
- Todos los jugadores deben estar en voice.
- Usa tu cuenta o nombre registrado.
- No intentes engañar al sistema.
- Respeta horarios e instrucciones del bot.

COMANDOS DEL FLUJO
/checkin       → pasar lista en voice
/start-match   → iniciar partida
/report        → reportar resultado (con imagen)
/perfil        → ver tu perfil de jugador
/equipo info   → ver el roster de un equipo
/equipo codigo → generar/ver código de acceso del equipo
/registrar     → registrarte en un equipo con un código
/calendario    → check-ins activos, partidas en curso y resultados
/torneo        → equipos y participantes del torneo activo
/ayuda         → ver la guía (secciones: general, checkin, partida, resultados, reglas, comandos)
`.trim()

/** Construye el bloque de contexto del torneo para el prompt. */
export function tournamentContext(t = {}) {
  if (!t || !t.title) return 'No hay un torneo activo seleccionado.'
  const prizes = Array.isArray(t.prizes) && t.prizes.length
    ? t.prizes.map(p => `  - ${p.place}: $${p.amount}${p.extra ? ` (${p.extra})` : ''}`).join('\n')
    : '  - Sin premios definidos'
  return [
    `TORNEO ACTIVO: ${t.title} (${t.publicId || 'sin ID'})`,
    `Juego: ${t.game || '—'} · Formato: ${t.format || '—'} · Estado: ${t.status || '—'}`,
    `Inicio: ${t.startDate || '—'} ${t.startTime || ''} · Región: ${t.region || '—'}`,
    `Capacidad: ${t.registered ?? '?'}/${t.capacity ?? '?'} equipos · Cuota: ${t.entryFee ? '$' + t.entryFee : 'Gratis'}`,
    `Premios:\n${prizes}`,
    t.checkinMinutes ? `Tiempo límite de check-in: ${t.checkinMinutes} minutos.` : '',
    t.description ? `Descripción: ${t.description}` : '',
    t.rules ? `Reglas adicionales del torneo:\n${t.rules}` : '',
  ].filter(Boolean).join('\n')
}
