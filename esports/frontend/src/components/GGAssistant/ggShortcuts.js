// Atajos de GG segun la pagina: lo primero que ve el usuario al abrirlo.
// icon = clave de Icon; prompt = lo que GG recibe al tocarlo. Los de texto
// ("Escribir la descripcion"...) disparan la redaccion con preguntas; los de
// fechas, el calendario que pregunta inicio y fin antes de proponer.

const GENERAL = [
  { icon: 'search', title: 'Llévame a…', hint: 'Dime qué buscas y te llevo', prompt: '¿Dónde encuentro lo que necesito en GlitchGang? Pregúntame qué busco.' },
  { icon: 'trophy', title: 'Torneos abiertos', hint: 'Los que puedes jugar ahora', prompt: '¿Qué torneos hay abiertos?' },
  { icon: 'users', title: 'Mi equipo', hint: 'Crear uno o unirme a uno', prompt: 'Quiero crear un equipo o unirme a uno, ¿qué me conviene?' },
  { icon: 'shield', title: 'Pedir un rol', hint: 'Organizador, coach, caster…', prompt: '¿Qué roles puedo pedir y qué hace cada uno?' },
]

const BY_PAGE = [
  {
    test: p => p === '/torneos/crear',
    items: [
      { icon: 'calendar', title: 'Armar las fechas', hint: 'Te pregunto y lo dejo listo', prompt: 'Ayúdame con las fechas de mi torneo' },
      { icon: 'edit', title: 'Escribir la descripción', hint: 'Dime de qué va y la redacto', prompt: 'Escríbeme la descripción del torneo' },
      { icon: 'fileText', title: 'Redactar el reglamento', hint: 'Juvenil, abierto, universitario…', prompt: 'Redáctame el reglamento del torneo' },
      { icon: 'helpCircle', title: '¿Qué va en cada paso?', hint: 'Identidad, competencia, calendario…', prompt: '¿Qué tengo que poner en cada paso de crear torneo?' },
    ],
  },
  {
    test: p => /^\/organizador\/torneo\/[^/]+\/gestionar/.test(p),
    items: [
      { icon: 'helpCircle', title: 'Explícame esta pestaña', hint: 'Qué hace y qué toca aquí', prompt: 'Explícame esta pestaña del panel del torneo' },
      { icon: 'fileText', title: 'Redactar el reglamento', hint: 'Lo escribo y lo ajustamos', prompt: 'Redáctame el reglamento del torneo' },
      { icon: 'bell', title: 'Escribir un anuncio', hint: 'Cambios, horarios, avisos', prompt: 'Escríbeme un anuncio para los equipos del torneo' },
      { icon: 'check', title: '¿Qué me falta?', hint: 'Revisión antes de arrancar', prompt: '¿Qué me falta revisar para que mi torneo arranque bien?' },
    ],
  },
  {
    test: p => p.startsWith('/organizador'),
    items: [
      { icon: 'plus', title: 'Crear un torneo', hint: 'Paso a paso, sin perderte', prompt: '¿Cómo creo un torneo?' },
      { icon: 'calendar', title: 'Planear un circuito', hint: 'Semanales, mensuales…', prompt: 'Quiero organizar torneos semanales y uno mensual con los finalistas, ayúdame a planearlo' },
      { icon: 'edit', title: 'Escribir un texto', hint: 'Descripción, reglas, anuncio', prompt: 'Ayúdame a escribir un texto para mi torneo' },
      { icon: 'helpCircle', title: 'Explícame el panel', hint: 'Para qué sirve cada parte', prompt: 'Explícame el panel de organizador' },
    ],
  },
  {
    test: p => p.startsWith('/admin'),
    items: [
      { icon: 'helpCircle', title: 'Explícame este panel', hint: 'Qué se gestiona aquí', prompt: 'Explícame este panel de administración' },
      { icon: 'news', title: 'Redactar una noticia', hint: 'Título y texto listos', prompt: 'Escríbeme una noticia para GlitchGang' },
      { icon: 'discord', title: 'Anuncio para Discord', hint: 'Corto y con energía', prompt: 'Escríbeme un anuncio para el Discord de GlitchGang' },
      { icon: 'check', title: '¿Qué reviso hoy?', hint: 'Lo pendiente de este panel', prompt: '¿Qué debería revisar en este panel?' },
    ],
  },
  {
    test: p => /^\/(mi-equipo|equipos)/.test(p),
    items: [
      { icon: 'users', title: 'Crear mi equipo', hint: 'Nombre, tag, juego, logo', prompt: 'Quiero crear un equipo' },
      { icon: 'edit', title: 'Bio del equipo', hint: 'Te la escribo con su estilo', prompt: 'Escríbeme la biografía de mi equipo' },
      { icon: 'target', title: 'Reclutar jugadores', hint: 'Vacantes y anuncio', prompt: '¿Cómo recluto jugadores para mi equipo?' },
      { icon: 'trophy', title: 'Inscribirnos a un torneo', hint: 'Requisitos y pasos', prompt: '¿Cómo inscribo a mi equipo en un torneo?' },
    ],
  },
  {
    test: p => /^\/(perfil|editar-perfil|jugador)/.test(p),
    items: [
      { icon: 'check', title: '¿Qué me falta?', hint: 'Para un perfil completo', prompt: '¿Qué me falta para completar mi perfil?' },
      { icon: 'edit', title: 'Escribir mi bio', hint: 'Corta y con personalidad', prompt: 'Escríbeme una bio para mi perfil de jugador' },
      { icon: 'users', title: 'Buscar equipo', hint: 'Que los equipos te encuentren', prompt: '¿Cómo encuentro un equipo que me reclute?' },
      { icon: 'trophy', title: 'Torneos abiertos', hint: 'Los que puedes jugar ahora', prompt: '¿Qué torneos hay abiertos?' },
    ],
  },
  {
    test: p => p.startsWith('/torneos'),
    items: [
      { icon: 'trophy', title: 'Torneos abiertos', hint: 'Los que puedes jugar ahora', prompt: '¿Qué torneos hay abiertos?' },
      { icon: 'check', title: '¿Cómo me inscribo?', hint: 'Requisitos y pasos', prompt: '¿Cómo inscribo a mi equipo en un torneo?' },
      { icon: 'plus', title: 'Organizar el mío', hint: 'Qué necesito para crearlo', prompt: '¿Cómo creo un torneo?' },
      { icon: 'calendar', title: 'Fechas y horarios', hint: 'Cuándo se juega cada cosa', prompt: '¿Cómo funcionan las fechas de un torneo: inscripción, check-in e inicio?' },
    ],
  },
]

export function shortcutsFor(pathname) {
  return BY_PAGE.find(s => s.test(pathname))?.items || GENERAL
}

