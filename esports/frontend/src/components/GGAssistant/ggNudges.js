// Qué ofrece GG cuando el usuario lleva un rato quieto en una página.
// Cada aviso: key (se muestra una vez por sesión), text y options (cada opción abre
// GG y envía su prompt; sin prompt solo abre el panel). "Ahora no" lo añade el dock.
// Los prompts deben ser preguntas que SITE_GUIDE (assistant.service.js) ya sabe responder.

// Aquí quedarse quieto es normal (leer, ver un stream, chatear): GG no interrumpe.
const QUIET = [/^\/mensajes/, /^\/tv/, /^\/noticias\/.+/, /^\/admin/, /^\/(login|register|forgot|reset-password|verificar)/, /^\/(terminos|privacidad|politica-pagos)/]

const OPEN = { label: 'Otra cosa' }

// Pasos de TeamCreateDcWizard (Teams.jsx publica { step } en el contexto de GG).
const TEAM_STEPS = { 1: '"Identidad" (nombre, tag, juego, logo)', 2: '"Roster" (invitar jugadores)' }

export function nudgeFor(pathname, ctx = {}) {
  if (QUIET.some(re => re.test(pathname))) return null

  if (/^\/(equipos|mi-equipo|jugador\/(equipos|buscar-equipo))/.test(pathname)) {
    const step = TEAM_STEPS[ctx.teamWizard?.step]
    if (step) return {
      key: `team-wizard-${ctx.teamWizard.step}`,
      text: '¿Te atoraste creando tu equipo? Te explico este paso.',
      options: [{ label: 'Explícame este paso', prompt: `Estoy creando un equipo, en el paso ${step}. ¿Qué tengo que poner aquí?` }, OPEN],
    }
    if (ctx.teamWizard) return null // paso final (compartir): ya terminó
    return {
      key: 'teams',
      text: '¿Quieres crear un equipo o unirte a uno? ¿En qué te ayudo?',
      options: [{ label: 'Crear equipo', prompt: 'Quiero crear un equipo' }, { label: 'Unirme a uno', prompt: 'Quiero unirme a un equipo' }, OPEN],
    }
  }
  if (pathname === '/torneos/crear') return {
    key: 'tournament-create',
    text: '¿Te ayudo a terminar tu torneo?',
    options: [{ label: 'Las fechas', prompt: 'Ayúdame con las fechas de mi torneo' }, { label: '¿Qué va en cada campo?', prompt: '¿Cómo creo un torneo?' }, OPEN],
  }
  if (/^\/torneos\/[^/]+\/(inscripcion|pago)/.test(pathname)) return {
    key: 'tournament-signup',
    text: '¿Dudas con la inscripción? Pregúntame.',
    options: [{ label: '¿Cómo me inscribo?', prompt: '¿Cómo inscribo a mi equipo en un torneo?' }, OPEN],
  }
  if (/^\/torneos/.test(pathname)) return {
    key: 'tournaments',
    text: '¿Buscas un torneo para jugar o quieres organizar uno?',
    options: [{ label: 'Jugar', prompt: '¿Qué torneos hay abiertos?' }, { label: 'Organizar', prompt: '¿Cómo creo un torneo?' }, OPEN],
  }
  if (pathname === '/solicitar-rol') return {
    key: 'roles',
    text: '¿No sabes qué rol pedir? Te lo explico.',
    options: [{ label: '¿Qué roles hay?', prompt: '¿Qué roles puedo pedir y qué hace cada uno?' }, OPEN],
  }
  if (pathname === '/mi-comunidad/crear') return {
    key: 'community-create',
    text: '¿Te ayudo a montar tu comunidad?',
    options: [{ label: 'Sí, guíame', prompt: '¿Cómo creo una comunidad?' }, OPEN],
  }
  if (/^\/(perfil|editar-perfil)/.test(pathname)) return {
    key: 'profile',
    text: '¿Te ayudo a dejar tu perfil listo?',
    options: [{ label: 'Sí, ¿qué me falta?', prompt: '¿Qué me falta para completar mi perfil?' }, OPEN],
  }
  return {
    key: `page:${pathname.split('/')[1] || 'home'}`,
    text: '¿Qué quieres hacer? ¿En qué te ayudo?',
    options: [{ label: 'Pregúntale a GG' }],
  }
}

// Saludos cortos: recuerdan que GG existe sin pedir nada.
export const HELLOS = [
  'Estoy aquí para ayudarte',
  'Si necesitas ayuda, aquí estoy',
  '¿Perdido? Pregúntame lo que sea',
  'Tócame si te atoras',
]

