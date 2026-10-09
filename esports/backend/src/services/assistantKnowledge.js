/**
 * Conocimiento del sitio para GG. Es la unica fuente de rutas y "recetas":
 * al agregar/quitar paginas en frontend/src/routes/AppRoutes.jsx, actualizar
 * aqui. Las paginas ocultas en la beta (frontend/src/config/betaHidden.js)
 * van con `soon: true`: GG debe decir que estan en construccion, no mandar ahi.
 */

// ── Tabla de paginas ─────────────────────────────────────────
// pattern se prueba contra la ruta sin query. `who` = quien la ve.
export const PAGES = [
  // Cuenta / publico
  { re: /^\/$/, title: 'Inicio publico', desc: 'Portada de GlitchGang.' },
  { re: /^\/(login|register|forgot|reset-password)$/, title: 'Acceso a la cuenta', desc: 'Iniciar sesion, crear cuenta o recuperar la contrasena.' },
  { re: /^\/ayuda(\/.*)?$/, title: 'Centro de ayuda', desc: 'Preguntas frecuentes y tickets de soporte. Aqui se abre un ticket para problemas que GG no puede resolver.' },
  { re: /^\/(terminos|privacidad|politica-pagos|terminos-organizador)$/, title: 'Documento legal', desc: 'Terminos, privacidad o politica de pagos.' },
  { re: /^\/(modo-retador|documentos\/modo-retador)$/, title: 'Guia del Modo Retador', desc: 'Explica el Modo Retador: desafios entre equipos.' },
  // Jugador
  { re: /^\/dashboard$/, title: 'Dashboard', desc: 'Inicio del jugador: resumen, partidas recientes, estadisticas por juego y torneos.' },
  { re: /^\/torneos$/, title: 'Torneos', desc: 'Lista de torneos con filtros. Desde aqui se abre el detalle de cada torneo.' },
  { re: /^\/torneos\/crear$/, title: 'Crear torneo', desc: 'Asistente de 6 pasos (Identidad, Competencia, Calendario, Premios, Organizacion, Revision). Solo organizadores con rol aprobado.' },
  { re: /^\/torneos\/invitaciones$/, title: 'Invitaciones de staff', desc: 'Invitaciones que organizadores te enviaron para ser staff de su torneo (caster, analista, moderador, coach...). Se aceptan o rechazan aqui.' },
  { re: /^\/torneos\/[^/]+$/, title: 'Detalle de torneo', desc: 'Informacion del torneo, cupos, premios, reglas, bracket, staff, inscripcion y boton para postularse como staff (si tienes ese rol).' },
  { re: /^\/torneos\/[^/]+\/inscripcion$/, title: 'Inscripcion a torneo', desc: 'Formulario para inscribir tu equipo o a ti (segun el formato del torneo).' },
  { re: /^\/torneos\/[^/]+\/bienvenida$/, title: 'Bienvenida al torneo', desc: 'Pantalla tras inscribirte con los siguientes pasos.' },
  { re: /^\/torneos\/[^/]+\/pago$/, title: 'Pago de inscripcion', desc: 'Pago de la cuota de entrada del torneo.' },
  { re: /^\/(mis-pagos|comprobante\/.*|verificar)$/, title: 'Pagos y comprobantes', desc: 'Historial de tus pagos y comprobantes con codigo verificable.' },
  { re: /^\/calendario$/, title: 'Calendario', desc: 'Calendario de torneos y eventos.' },
  { re: /^\/equipos$/, title: 'Equipos', desc: 'Directorio de equipos y creacion de equipo ("Crear equipo").' },
  { re: /^\/equipos\/unirse\/.+$/, title: 'Unirse a equipo', desc: 'Pagina de un link de invitacion para unirte a un equipo.' },
  { re: /^\/equipos\/[^/]+$/, title: 'Pagina de un equipo', desc: 'Perfil publico de un equipo: roster, resultados y solicitud para unirse.' },
  { re: /^\/jugador$/, title: 'Panel de jugador', desc: 'Resumen de tu actividad como jugador.' },
  { re: /^\/jugador\/equipos$/, title: 'Mis equipos (jugador)', desc: 'Equipos a los que perteneces.' },
  { re: /^\/jugador\/buscar-equipo$/, title: 'Buscar equipo', desc: 'Vacantes de equipos que reclutan; te postulas con tu tarjeta Jugador Pro.' },
  { re: /^\/jugador\/partidas$/, title: 'Mis partidas', desc: 'Partidas proximas y recientes.' },
  { re: /^\/jugador\/historial$/, title: 'Historial', desc: 'Historial de torneos y resultados.' },
  { re: /^\/jugador\/perfil$/, title: 'Perfil profesional de jugador', desc: 'Tarjeta Jugador Pro: juegos con rango y rol, horario, idiomas y contacto (el contacto solo lo ven los equipos a los que te postulas).' },
  { re: /^\/jugador\/rendimiento$/, title: 'Mi rendimiento', desc: 'En construccion.', soon: true },
  { re: /^\/perfil$/, title: 'Perfil', desc: 'Tu perfil o el de otro jugador (/perfil?user=NICK).' },
  { re: /^\/editar-perfil$/, title: 'Editar perfil', desc: 'Datos personales, juegos, rangos, redes y pestana de Privacidad (quien ve tu perfil, estadisticas, juegos, equipos y torneos).' },
  { re: /^\/ajustes$/, title: 'Ajustes', desc: 'Seguridad (contrasena, verificacion en dos pasos, sesiones), conexiones (Discord, WhatsApp) y soporte.' },
  { re: /^\/notificaciones$/, title: 'Notificaciones', desc: 'Avisos: invitaciones, solicitudes, cambios en torneos.' },
  { re: /^\/mensajes$/, title: 'Mensajes', desc: 'Chat directo con otros usuarios.' },
  { re: /^\/amigos$/, title: 'Amigos', desc: 'Lista de amigos y solicitudes.' },
  { re: /^\/ranking$/, title: 'Ranking', desc: 'Rankings de jugadores y equipos.' },
  { re: /^\/noticias(\/.*)?$/, title: 'Noticias', desc: 'Noticias de la plataforma y de organizadores.' },
  { re: /^\/comunidad(\/.*)?$/, title: 'Comunidades', desc: 'Comunidades de jugadores por juego.' },
  { re: /^\/universidad(\/registro)?$/, title: 'Universidad', desc: 'Modulo universitario: verificacion institucional y equipos de universidades.' },
  { re: /^\/marcas$/, title: 'Marcas', desc: 'Marcas y sponsors de la plataforma.' },
  { re: /^\/solicitar-rol$/, title: 'Solicitar rol', desc: 'Formulario para pedir un rol (organizador, coach, caster, analista, moderador, creador, sponsor). Requiere documento de identidad y datos del rol; el equipo de GlitchGang lo revisa.' },
  { re: /^\/conectar-discord$/, title: 'Conectar Discord', desc: 'Vincula tu cuenta de Discord (necesario para torneos que se gestionan por Discord).' },
  { re: /^\/(conectar-whatsapp|vincular-whatsapp)$/, title: 'Conectar WhatsApp', desc: 'Vincula y verifica tu numero de WhatsApp.' },
  { re: /^\/(planes|premium|premium\/checkout|tv|creadores|redes|recompensas)$/, title: 'Seccion en construccion', desc: 'Todavia no disponible en la beta.', soon: true },
  // Equipo (lider)
  { re: /^\/mi-equipo$/, title: 'Mi equipo: resumen', desc: 'Resumen de tu equipo (solo lideres/creadores).' },
  { re: /^\/mi-equipo\/roster$/, title: 'Mi equipo: roster', desc: 'Puestos del equipo: titulares, suplentes y staff (coach, manager, analista). Se llenan por invitacion o solicitud.' },
  { re: /^\/mi-equipo\/enfrentamiento$/, title: 'Mi equipo: enfrentamiento', desc: 'Proximo rival y partida del equipo.' },
  { re: /^\/mi-equipo\/web$/, title: 'Mi equipo: pagina web', desc: 'Configura la pagina publica del equipo.' },
  { re: /^\/mi-equipo\/patrocinadores$/, title: 'Mi equipo: patrocinadores', desc: 'Sponsors del equipo.' },
  { re: /^\/mi-equipo\/reclutar$/, title: 'Mi equipo: reclutar', desc: 'Publica vacantes (juego, rol, rango) y busca jugadores por su tarjeta Jugador Pro.' },
  { re: /^\/mi-equipo\/solicitudes$/, title: 'Mi equipo: solicitudes', desc: 'Solicitudes de jugadores que quieren unirse: aceptar o rechazar.' },
  { re: /^\/mi-equipo\/calendario$/, title: 'Mi equipo: calendario', desc: 'En construccion.', soon: true },
  { re: /^\/mi-equipo\/retador$/, title: 'Mi equipo: Modo Retador', desc: 'Activa y gestiona desafios contra otros equipos.' },
  { re: /^\/mi-equipo\/privacidad$/, title: 'Mi equipo: privacidad', desc: 'Que muestra publicamente el equipo (roster, staff, sponsors, contacto...).' },
  // Organizador / staff de torneo
  { re: /^\/organizador$/, title: 'Panel de organizador: Mis torneos', desc: 'Lista de tus torneos y acceso a gestionarlos. Boton para crear torneo.' },
  { re: /^\/organizador\/perfil$/, title: 'Perfil profesional (organizador)', desc: 'Datos profesionales que ven otros usuarios.' },
  { re: /^\/organizador\/(finanzas|crm|integraciones|configuracion)$/, title: 'Seccion en construccion', desc: 'Todavia no disponible en la beta.', soon: true },
  { re: /^\/organizador\/torneo\/[^/]+$/, title: 'Vista del torneo (gestion)', desc: 'Vista de un torneo desde el panel; de aqui se entra a Gestionar.' },
  { re: /^\/organizador\/torneo\/[^/]+\/gestionar(\/[^/]+)?$/, title: 'Gestionar torneo', desc: 'Pestanas: Resumen, Configuracion, Equipos, Reglas, Check-in, Prize Pool, Bracket, Ruleta de sorteo, Sponsors/Marca, Staff y permisos, Discord, Sala de staff, Reportar, Actividad. Cada persona ve/edita segun su rol de staff.' },
  // Roles
  { re: /^\/coach(\/.*)?$/, title: 'Coach HQ', desc: 'Panel del coach: sus equipos, torneos donde es staff, perfil profesional, trayectoria y plan de trabajo que envia a su equipo.' },
  { re: /^\/caster$/, title: 'Caster Studio', desc: 'Panel del caster: eventos asignados, equipos a narrar y briefing de emision.' },
  { re: /^\/caster\/(eventos|emisiones|stats)$/, title: 'Caster Studio', desc: 'Vistas del panel del caster: eventos, emisiones y estadisticas.' },
  { re: /^\/(caster|analista)\/perfil$/, title: 'Perfil profesional', desc: 'Datos con los que organizadores te encuentran y contratan (juego principal, tarifa, disponibilidad, experiencia).' },
  { re: /^\/analista(\/.*)?$/, title: 'Analyst Lab', desc: 'Panel del analista: equipos analizados, torneos cubiertos y reportes.' },
  { re: /^\/moderador(\/.*)?$/, title: 'Panel de moderador', desc: 'Eventos asignados, arbitraje y disputas, produccion, check-ins por vigilar.' },
  { re: /^\/creador\/perfil$/, title: 'Perfil profesional (creador)', desc: 'Perfil del creador de contenido.' },
  { re: /^\/creador(\/.*)?$/, title: 'Panel de creador', desc: 'En construccion (solo el perfil profesional funciona).', soon: true },
  { re: /^\/marca$/, title: 'Centro de marca', desc: 'Resumen del panel de marcas/sponsors.' },
  { re: /^\/marca\/(mi-marca|organizadores|campanas|contacto)$/, title: 'Panel de marca', desc: 'Perfil de la marca, organizadores, campanas y contacto con el equipo de GlitchGang.' },
  { re: /^\/marca\/.+$/, title: 'Seccion de marca en construccion', desc: 'Todavia no disponible en la beta.', soon: true },
  { re: /^\/mi-comunidad(\/.*)?$/, title: 'Panel de comunidad', desc: 'Gestion de tu comunidad: miembros, publicaciones y creacion.' },
  { re: /^\/admin(\/.*)?$/, title: 'Panel de administracion', desc: 'Administracion de GlitchGang (usuarios, torneos, roles, pagos, tickets...). Solo admins.' },
]

export function describePage(path = '/') {
  const clean = String(path).split(/[?#]/)[0].replace(/(.)\/+$/, '$1') || '/'
  return PAGES.find(p => p.re.test(clean)) || null
}

const soonList = PAGES.filter(p => p.soon).map(p => p.title)

// ── Guia narrativa (recetas y reglas de producto) ────────────
export const SITE_GUIDE = `
NAVEGACION (rutas reales; usa SOLO estas):
Jugador: /dashboard, /torneos, /torneos/:id, /torneos/:id/inscripcion, /calendario, /equipos, /equipos/:teamId, /jugador (panel), /jugador/equipos, /jugador/buscar-equipo, /jugador/partidas, /jugador/historial, /jugador/perfil (Jugador Pro), /perfil, /perfil?user=NICK, /editar-perfil, /notificaciones, /mensajes, /amigos, /ranking, /noticias, /comunidad, /universidad, /marcas, /ajustes, /ayuda, /mis-pagos.
Cuenta y roles: /solicitar-rol, /conectar-discord, /conectar-whatsapp.
Equipo (si lideras uno): /mi-equipo, /mi-equipo/roster, /mi-equipo/reclutar, /mi-equipo/solicitudes, /mi-equipo/enfrentamiento, /mi-equipo/web, /mi-equipo/patrocinadores, /mi-equipo/retador, /mi-equipo/privacidad.
Organizador: /organizador (mis torneos), /torneos/crear, /organizador/torneo/:id/gestionar/:tab, /organizador/perfil.
Staff/roles: /coach, /caster, /analista, /moderador, /caster/perfil, /analista/perfil, /torneos/invitaciones, /marca, /mi-comunidad.
EN CONSTRUCCION (no mandes al usuario ahi; dile que aun no esta disponible en la beta): ${soonList.join('; ')}.

QUE OFRECE CADA ROL (paneles):
- Jugador (todos): Dashboard, panel /jugador, tarjeta Jugador Pro para que equipos lo reclutan, buscar equipo, inscribirse a torneos.
- Lider de equipo: /mi-equipo (roster, reclutar, solicitudes, retador, privacidad).
- Organizador: crea y gestiona torneos, contrata staff, confirma resultados en la pestana Bracket.
- Coach: Coach HQ; guia a un equipo, envia planes de trabajo, puede ser staff de torneos.
- Caster: Caster Studio; eventos asignados, equipos a narrar, briefing de emision.
- Analista: Analyst Lab; equipos analizados, torneos cubiertos, reportes.
- Moderador/Arbitro: arbitraje, disputas, check-ins y produccion de sus eventos.
- Creador, Marca/Sponsor, Comunidad: paneles propios (varias secciones aun en construccion).

RECETAS:
- Crear equipo: /equipos -> "Crear equipo" -> nombre, tag, juego -> confirmar. Luego se gestiona en /mi-equipo. Solo un equipo por categoria.
- Unirme a equipo: /jugador/buscar-equipo o /equipos -> abrir el equipo -> solicitar unirse (o link/codigo de invitacion). Completar antes la tarjeta Jugador Pro en /jugador/perfil mejora las postulaciones.
- Reclutar: /mi-equipo/reclutar (vacantes) y aprobar en /mi-equipo/solicitudes.
- Inscribirme a un torneo: /torneos -> abrir -> "Inscribirme". Puede pedir equipo, Discord vinculado y aceptar el consentimiento; no se puede si cerro la inscripcion o no hay cupo.
- Crear torneo: requiere rol Organizador aprobado. Sin el rol: /solicitar-rol -> Organizador -> completar y esperar aprobacion. Con el rol: /torneos/crear.
- Obtener un rol (coach, caster, analista, moderador, creador, sponsor): /solicitar-rol -> elegir rol -> formulario (documento de identidad + datos y experiencia del rol) -> revision del equipo de GlitchGang. Al aprobarse aparece su panel en el menu lateral.
- Completar el perfil profesional del rol (para que organizadores te encuentren): /caster/perfil, /analista/perfil, /organizador/perfil, Coach HQ (seccion perfil profesional).
- Ser staff de un torneo, dos caminos: (1) el organizador te INVITA: llega notificacion y aparece en /torneos/invitaciones; aceptas o rechazas. Para ser invitado NO necesitas tener el rol en la plataforma. (2) TU te postulas: en el detalle del torneo /torneos/:id, boton "Postularme como <rol>"; para postularte SI necesitas tener ese rol aprobado y su perfil profesional con datos basicos. El organizador acepta o rechaza. Cuando ya eres staff aceptado, el torneo aparece en tu panel.
- Contratar staff (organizador): Gestionar torneo -> pestana "Staff y permisos" -> buscar perfiles por rol -> invitar; puede ajustar permisos por persona.
- Resultados: el reporte que hacen equipos por Discord NO avanza el bracket de la web. Quien avanza rondas es el organizador (o staff con permiso) confirmando el resultado en la pestana Bracket del torneo.
- Discord de un torneo: todos los torneos con Discord usan el servidor compartido de GlitchGang. El admin habilita una vez al organizador; luego cada torneo necesita el consentimiento del organizador. Para participar hay que vincular Discord (/conectar-discord) y estar en el servidor.
- Privacidad: /editar-perfil -> Privacidad decide quien ve tu perfil, estadisticas, juegos, equipos y torneos.
- Problemas o errores de la cuenta, pagos o algo que no funciona: /ayuda -> crear ticket.

PERMISOS DE STAFF DENTRO DE UN TORNEO (pestanas que ve/edita; el organizador puede ajustar por persona):
- Director: todo editable. Administrador: casi todo editable; prize pool y marca solo ver; sin "Staff y permisos".
- Arbitro: edita Check-in, Bracket y Reportar; ve resumen, equipos y reglas.
- Moderador: edita Check-in, Discord y Reportar; ve resumen, equipos, reglas y bracket.
- Caster: solo ve resumen, equipos, reglas, prize pool y bracket. Produccion: igual y ademas Sponsors/Marca.
- Coach: solo ve resumen, equipos, reglas y bracket. Analista: ve resumen, equipos, reglas, check-in, bracket y reportar.

REGLAS DEL FORMULARIO DE FECHAS DE TORNEO (paso Calendario):
- Campos: registrationStart (apertura de inscripciones), registrationEnd (cierre), date (inicio del torneo), endDate (fin), checkinDeadline (limite de check-in, opcional).
- Orden obligatorio: apertura < cierre <= inicio < fin. El check-in va entre el cierre y el inicio.
- Apertura e inicio al menos 2 horas despues de ahora. Se recomienda inscripcion abierta minimo 48 horas.
- Formato de fecha: "YYYY-MM-DDTHH:mm" en la zona horaria del formulario.
`.trim()

// ── Pestanas de "Gestionar torneo" ───────────────────────────
export const MANAGE_TAB_HELP = {
  resumen: 'Resumen general del torneo.', config: 'Configuracion del torneo (datos, fechas, formato).',
  competencia: 'Competencia: sistema, cupos, series (BO) por ronda y puntuacion. Cada cambio confirmado se avisa a los equipos inscritos y al staff; con el bracket generado el sistema, los cupos y los grupos quedan fijos.',
  equipos: 'Equipos inscritos.', reglas: 'Reglamento del torneo.', checkin: 'Check-in de equipos.',
  prizepool: 'Premios del torneo.', bracket: 'Bracket: aqui se confirman resultados y avanzan las rondas.',
  ruleta: 'Ruleta de sorteo.', marca: 'Sponsors y marca del torneo.', colaboradores: 'Staff y permisos: invitar personal y ajustar permisos.',
  discord: 'Integracion con Discord.', sala: 'Sala de staff (chat interno).', reportar: 'Reportar incidencias.', actividad: 'Registro de actividad.',
}
