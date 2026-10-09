// Configuracion estatica del panel admin (tipos, etiquetas, plantillas).
// Los datos del panel salen del backend; aqui no hay registros de ejemplo.

// Plantillas pre-escritas para respuestas de reportes/soporte.
// {tema} se reemplaza por el asunto que escriba el admin.
export const REPORT_TONES = {
  positivo: { label: 'Positivo', color: '#22c55e' },
  neutro:   { label: 'Neutro',   color: '#f59e0b' },
  negativo: { label: 'Negativo', color: '#f87171' },
}

export const REPORT_TEMPLATES = {
  positivo: [
    'estamos trabajando en "{tema}".',
    'aprobamos la solicitud relacionada con "{tema}".',
    'ya aplicamos el ajuste solicitado sobre "{tema}".',
    'confirmamos que "{tema}" queda activo y listo para usarse.',
    'gracias por reportar "{tema}"; el equipo ya lo dejo corregido.',
    'validamos la informacion de "{tema}" y no requiere mas accion de tu parte.',
    'el seguimiento de "{tema}" queda completado con resultado favorable.',
    'ya solucionamos "{tema}". ¡Gracias por avisar!',
    'tu caso "{tema}" se resolvió correctamente.',
    'aplicamos la sanción correspondiente por "{tema}".',
  ],
  neutro: [
    'recibimos tu reporte sobre "{tema}" y lo estamos revisando.',
    'dejamos "{tema}" en seguimiento mientras verificamos los datos.',
    'estamos comparando la evidencia disponible sobre "{tema}".',
    'un representante revisara "{tema}" y te dara respuesta en este mismo hilo.',
    'para continuar con "{tema}", responde con capturas, enlaces o IDs relacionados.',
    'marcamos "{tema}" como pendiente de confirmacion interna.',
    'vamos a mantener "{tema}" abierto hasta tener una conclusion clara.',
    'tu caso "{tema}" está en cola de revisión.',
    'necesitamos más información sobre "{tema}".',
    'derivamos "{tema}" al equipo correspondiente.',
  ],
  negativo: [
    'no pudimos reproducir "{tema}"; se cierra por ahora.',
    'descartamos "{tema}" por falta de evidencia.',
    'no encontramos informacion suficiente para aprobar "{tema}".',
    'cerramos "{tema}" porque no cumple los criterios actuales de la plataforma.',
    'rechazamos "{tema}" por inconsistencias en los datos enviados.',
    'no podemos continuar con "{tema}" hasta que se envie evidencia verificable.',
    'por ahora "{tema}" queda archivado, pero puedes reabrirlo si tienes nuevos datos.',
    'la acción solicitada sobre "{tema}" no procede.',
  ],
}

export const NEWS_CATEGORIES = ['Torneos', 'Plataforma', 'Comunidad', 'Resultados', 'Anuncios']

// Changelog / anuncios internos de la web
export const CHANGELOG_TYPES = {
  feature:     { label: 'Novedad',       color: '#22c55e', icon: 'plus' },
  fix:         { label: 'Corrección',    color: '#7c3aed', icon: 'check' },
  maintenance: { label: 'Mantenimiento', color: '#f59e0b', icon: 'gear' },
}

// Anuncios de la web — 3 tipos con imagen/icono y programación controlable
export const ANNOUNCEMENT_TYPES = {
  evento:       { label: 'Evento',       icon: 'calendar', color: '#00E676' },
  recordatorio: { label: 'Recordatorio', icon: 'bell',     color: '#f59e0b' },
  aviso:        { label: 'Aviso',        icon: 'star',     color: '#7c3aed' },
}
export const ANNOUNCEMENT_PERIODS = { manana: 'Mañana', tarde: 'Tarde', todo: 'Todo el día' }

// Tipos de acción de moderación (con color e icono del set)
export const MODERATION_TYPES = {
  ban:     { label: 'Baneo',         color: '#f87171', icon: 'lock'  },
  warning: { label: 'Advertencia',   color: '#f59e0b', icon: 'alert' },
  mute:    { label: 'Restricción',   color: '#7c3aed', icon: 'chat'  },
  unban:   { label: 'Reactivación',  color: '#22c55e', icon: 'check' },
}


