# Backend pendiente

## [x] Borrador de estadísticas desde capturas (Mobile Legends)

Implementado (4/oct): backend Gemini, borradores versionados, editor web, importación
de evidencia de `/report`, confirmación humana e historial por jugador. La subida
del modal de resultados también utiliza `uploadsApi.upload` en lugar de URLs `blob:`.
Detalles, configuración y límites: [docs/match-stats.md](docs/match-stats.md).

### Contrato implementado

- Identificar cada **partida de la serie** con torneo, match del bracket e índice
  de juego. El marcador de kills de una captura no es el marcador BO3/BO5.
- Crear un borrador independiente del resultado publicado, con versión, autor,
  equipo remitente, evidencias, estado y fecha. Extraer/reintentar nunca confirma
  resultados, avanza el bracket ni escribe `PlayerMatch`.
- Gemini se llama exclusivamente desde backend con la imagen y el esquema de
  extracción, sin herramientas ni acceso a base de datos. Usar `null` para datos
  ausentes/ilegibles; conservar nombre leído, lado, ganador visible, marcador de
  kills, K/D/A, daño infligido, daño recibido, daño a torres, participación en
  peleas (porcentaje), oro y MVP. No convertir porcentajes de daño en cantidades.
- El servidor resuelve jugadores exclusivamente contra los titulares inscritos
  de ambos equipos (`registrations[].rosterSnapshot`), nunca buscando en todos
  los usuarios. Si falta roster, hay homónimos o coincidencia aproximada, exigir
  selección manual. No confundir suplentes/staff con los diez participantes.
- Editor: mostrar captura y datos extraídos; marcar nombres ambiguos, números
  dudosos, duplicados y sumas de kills inconsistentes. Permitir corregir y llenar
  a mano, con reintento explícito ante límites/503. Los datos desconocidos siguen
  vacíos; cero solo significa cero observado o introducido por la persona.
- Confirmación por capitán rival u organizador autorizado sobre una versión
  concreta. El remitente no se autoconfirma como rival. Cada edición cambia la
  versión revisable y las estadísticas confirmadas son inmutables; conflictos bloquean la confirmación
  del rival y requieren resolución explícita del organizador con motivo.
- Comparar capturas de ambos equipos para la misma partida y orientación de
  equipos; una segunda captura o la coincidencia de IA no son confirmación humana.
- Persistir por partida/jugador de forma idempotente, con índice único y auditoría
  de quién confirmó qué versión. Añadir estadísticas opcionales a `PlayerMatch`
  con `null` para desconocido; no fabricar ceros ni duplicar historial al reintentar.
- Integrar `/report` con el mismo borrador y revisión web. **Corrección del
  diagnóstico previo:** Discord ya llama al pipeline compartido
  `onResultsConfirmed`; lo pendiente son estadísticas detalladas, no el historial
  básico. Para nuevas confirmaciones de Mobile Legends, `playerMatchesFor` deja
  de crear filas de serie con ceros: las filas se crean al confirmar las estadísticas
  de cada partida, usando los diez titulares congelados. Otros juegos no cambian.
- Validar permisos y pertenencia en servidor, esquema/números/unidades, límites
  de tamaño y cuota por usuario. No descargar URLs arbitrarias suministradas por
  el cliente; usar uploads controlados y un mecanismo validado para Discord.
- Antes del envío externo mostrar aviso de que la captura se enviará a Google
  y explicar el tratamiento aplicable al servicio configurado. No enviar la
  imagen automáticamente al subirla como evidencia.

### Verificación

Pruebas automatizadas con MongoDB local aislado y pruebas de validación:
permisos, autoconfirmación, roster ajeno, valores ausentes, nombres Unicode,
sumas, conflictos, versiones, escrituras concurrentes/idempotentes y fallo de Gemini.
**Pendiente de validación de calidad:** 5–10 capturas reales y prueba con Gemini
real; todavía no se han proporcionado capturas ni se ha medido esa precisión.

Notas para el compañero de backend. Cada tarea nace de algo que el frontend
del panel de torneos ya construyó y necesita para funcionar de verdad — el
front mientras tanto lo deja con un estado vacío/"pendiente" en vez de
inventar datos falsos, así que nada se rompe visualmente por no estar hecho.

**Cómo leer esto:** cada tarea tiene una etiqueta de urgencia y un resumen de
una línea arriba de todo. Si vas apurado, con eso alcanza para saber si te
toca ahora o puede esperar. Abajo está el detalle completo (Qué · Dónde · Por
qué · Cómo) para cuando te sientes a hacerla.

- 🔴 **Rompe algo ahora mismo** — un endpoint tira error o pierde datos.
- 🟡 **Bloquea una función ya construida en el frontend** — no rompe nada, pero el organizador ve "Pendiente" donde debería ver algo real.
- 🟢 **Mejora / limpieza** — no bloquea, se puede hacer cuando haya espacio.

Marca `[x]` en el título cuando termines una tarea y avisa para que el
frontend deje de mostrarla como pendiente.

## Índice rápido

| | Tarea | En una frase |
|---|---|---|
| ✅ | [Bracket no persiste](#bracket-no-persiste) | **Arreglado** (commit `6b68bba`) — verificado en código + servidor arrancando real. |
| ✅ | [Reportes rotos](#reportes-rotos) | **Arreglado** (commit `6b68bba`). |
| ✅ | [El bot de Discord no ve ningún torneo](#bot-sin-organizacion) | **Arreglado** (commit `6b68bba`) — falta correr la migración en prod si no se hizo. |
| 🟡 | [Discord: auto-unirse al servidor al vincular](#discord-oauth) | Vincular Discord ya funciona (solo falta cargar credenciales reales); falta que además una automáticamente al servidor de GlitchGang. |
| 🟡 | [Discord: sistema completo del torneo](#discord-sistema-completo) | **Casi todo existe** (verificado 3/oct): espacio del torneo vía CRM, sala por equipo, deprovision, prender Discord en un torneo publicado. **Falta el punto 3:** avisar en Discord cuando cambian reglas/fechas/cupos y archivar la categoría al terminar. |
| 🟡 | [CRM Discord: evidencias de voice hacia panel organizador](#crm-discord-voice-evidencia-organizador) | El bot guarda `voice_sessions` y `match_recordings`, pero el CRM todavia no se lo pasa al panel del organizador por torneo/match. |
| 🟡 | [Discord general: Control Center del servidor](#discord-control-center-general) | **Fase 1 + Publicaciones hechas (27/sep)**: estado/canales en vivo, canal→funcion, cola de publicaciones web→CRM→bot, noticias publicadas entran solas a la cola. Falta: `BOT_API_KEY`/`CRM_PORTAL_URL`/`DISCORD_GUILD_ID` en `backend/.env`, Versiones, Foros, #reglas fijo, auto-cola de banners/marcas. |
| ✅ | [Discord: log de mensajes automáticos (visibilidad para el organizador)](#discord-log-mensajes) | **Arreglado (21/sep)** — `GET /tournaments/:id/discord-log` ya lee `DiscordProvisionLog`. |
| ✅ | [Sync de registro (web + bot) hacia el CRM](#sync-usuarios-crm) | **Arreglado (18/sep)** — `syncUserToCrm` conectado en `register()` y `discordLinkConfirm()`. |
| ✅ | [Check-in: guardar configuración](#check-in-guardar-configuracion) | **Arreglado** (commit `6b68bba`). |
| ✅ | [Endpoint: torneos de un equipo](#torneos-de-un-equipo) | **Arreglado** (commit `6b68bba`). |
| ✅ | [Staff: avisar al agregar](#staff-avisar-al-agregar) | **Arreglado** (commit `6b68bba`). |
| ✅ | [Notificación de solicitud de equipo sin id](#join-request-sin-id) | **Arreglado** (15/sep) — `requestId` ya viaja en el `meta` y la notificación se puede resolver desde ahí. |
| ✅ | [`gamerProfile` no existe en el schema](#gamerprofile-no-persiste) | **Arreglado** (commit `3a464b3`) — Ficha de Jugador ya persiste; Rango y Personajes ahora son por juego. |
| ✅ | [Permisos del staff: la UI ya limita, el backend no](#permisos-staff-backend) | **Arreglado** (commit `6b68bba`). |
| ✅ | [Calendario: validación post-publicación](#calendario-validacion-post-publicacion) | **Arreglado** (commit `6b68bba`). |
| ✅ | [Migración de torneos viejos](#migracion-de-torneos-viejos) | **Verificado (18/sep)** — dry-run contra la DB local: `toUpdate=0`, ya está todo. Falta correr contra producción si aún no se hizo ahí (no tengo acceso desde este entorno). |
| ✅ | [`POST /uploads` devuelve URL absoluta](#uploads-url-absoluta) | **Arreglado** (15/sep) — ahora devuelve `/uploads/<archivo>` igual que los otros 4 endpoints de subida. |
| ✅ | [Token de Meta filtrado](#token-de-meta-filtrado) | **Cerrado (5/oct)** — el del historial estaba truncado e inválido; no hay nada que revocar. |
| ✅ | [Ajustes de cuenta](#ajustes-cuenta-mejoras) | **Contraseña hecho (3/oct)** — `POST /auth/change-password` (cierra las otras sesiones) + formulario en Ajustes. `allowTeamInvite` sigue sin invitación directa que aplicar. |
| ✅ | [Editar Perfil: no se puede cambiar nombre/apellido](#editar-nombre-apellido) | **Arreglado** (15/sep) — `firstName`/`lastName` en la whitelist del backend + campos nuevos en la pestaña Identidad del frontend. |
| ✅ | [Publicación programada (cron)](#publicacion-programada) | **Arreglado (18/sep)** — `scheduledPublishAt` en el schema, job cada 2 min (`scheduledPublish.service.js`), control de fecha en `TorneoCrear.jsx` paso 5. |
| 🟡 | [Pagos: no hay pasarela real ni cartera de organizador — no debe permitirse cobrar](#pagos-no-hay-pasarela-real) | **Actualizado (15/sep)** — se encontró y restauró una regresión: todo el backend real de PayPal (Order, billingPlans, rutas) se había perdido en un merge de agosto. Ya está reconstruido y montado, más `entryFee>0` bloqueado y las 3 páginas de comprobantes reconectadas. Queda: decidir Transferencia, y Wallet/Finanzas para más adelante. |
| ✅ | [Rol aprobado (organizador, etc.) nunca recibía el código real](#rol-aprobado-sin-codigo) | **Arreglado (16/sep)** — `roleProfiles.<rol>.<código>` es `immutable` en el schema; Mongoose bloquea en silencio cualquier `$set` sobre un path immutable vía `updateOne`, incluso la primera vez. Faltaba `overwriteImmutable: true`. La solicitud quedaba "Autorizada" pero `createTournament` seguía rechazando por falta de `organizerCode`. 3 cuentas ya afectadas reparadas con un script de backfill. |
| ✅ | [Equipos universitarios: nadie valida la universidad al unirse](#equipos-universitarios-sin-validacion-join) | **Arreglado (18/sep)** — resultó ser una regresión más grande: `createTeamForUser` tampoco marcaba nunca `team.university` (ningún equipo podía llegar a ser universitario), y `joinTeamForUser` tenía una recursión infinita real (crash) al unirse por código. Los 3 se repararon y se verificaron contra Mongo real. |
| ✅ | [Registro de actividad del staff por torneo](#registro-actividad-staff) | **Arreglado (18/sep)** — `TournamentAuditLog` + `GET /tournaments/:id/audit-log` (solo owner/admin) + `logTournamentActivity` llamado desde updateTournament/bracket/reportes/staff/check-in. Pestaña "Actividad" ya lee datos reales. |
| ✅ | [Stats del jugador: nada llena esos datos solo](#jugador-stats-sin-pipeline) | **Arreglado (23/sep, commit `ffefcbc`)** — confirmar una partida de bracket crea un PlayerMatch real por cada jugador del roster de ambos equipos; Rendimiento/Historial ya tienen de donde sacar datos reales para torneos jugados. |
| ✅ | ["Equipos anteriores" — filtro muerto](#jugador-equipos-anteriores) | **Arreglado (23/sep, commit `6c20471`)** — nuevo `TeamMembershipHistory` + `GET /teams/mine/history`; `PlayerTeams.jsx` ya muestra equipos reales de los que el jugador salió. |
| ✅ | [Logros del jugador](#jugador-achievements-mock) | **Arreglado (3/oct)** — son las 12 cartas de logro, desbloqueadas por `user.cosmeticUnlocks` del servidor. |
| ✅ | [Mapas y Radar](#jugador-mapas-radar) | **Arreglado (3/oct)** — `GET /players/:id/stats/maps?game=` real; radar con estado vacío honesto; también se quitaron los números de ejemplo de la página. |
| ✅ | [Evolución de Rating — gráfica inventada, pero fácil de resolver](#jugador-rating-timeline) | **Arreglado (23/sep, commit `c43d7cb`)** — nuevo `GET /players/:playerId/rating/timeline`, `PlayerDashboard.jsx` ya usa datos reales. |
| ✅ | [Notificaciones: `meta`](#notificaciones-sin-meta-rica) | **Hecho (3/oct)** — las 13 llamadas que quedaban sin `meta` ya lo mandan (roles, moderación, comunidad, organizaciones, sorteos, universidad). |
| ✅ | [Admin: banear/verificar/cambiar rol/eliminar jugador no persisten](#admin-users-acciones-sin-backend) | **Arreglado (24/sep)** — `PATCH /admin/users/:id/status\|verify\|role`, `DELETE /admin/users/:id` reales; banear toca `isBanned` (lo que bloquea login) + deja registro en `/admin/moderacion`. |
| ✅ | [Admin: Moderación, Pagos y Sorteos son 100% mock](#admin-paginas-100-mock) | **Arreglado (24/sep)** — Moderación (`Sanction`), Sorteos (`Raffle`) con modelos propios; Pagos ahora lee `Order` real (PayPal) en vez de datos de prueba. |
| ✅ | [Admin: dos sistemas de "publicidad/marcas" en paralelo](#admin-banners-vs-marcas) | **Revisado (24/sep)** — resultó que Anuncios/Promos de AdminBanners ya eran reales (migrados 19/sep) y no duplican AdminMarcas; solo "Solicitudes" seguía en localStorage (por navegador, invisible entre admin y quien publicaba) — ahora es `PublicationRequest` real. Las dos páginas se quedan, no se duplican. |
| ✅ | [Asistente de creación de equipo: posible mismo bug de avatar/logo en base64](#team-wizard-base64-sin-confirmar) | **Arreglado (24/sep)** — `PhotoUpload` del wizard ya sube a `/uploads` y guarda URL real; el guard universal queda como protección extra. |
| ✅ | [`GET /admin/census` tira 500: falta un import](#admin-census-500) | **Arreglado (18/sep)** — agregado `import { getCountryNumber } from '../config/countries.js'` en `admin.controller.js`. |
| ✅ | [Admin: "Marcar como Eliminado" de equipos no persistía nada](#admin-teams-status-fake) | **Arreglado (18/sep)** — encontrado de paso: el botón solo cambiaba estado local en el navegador, sin llamar a la API, y `Team.status` ni existía en el schema. |
| ✅ | [Torneos "solo universidad": no hay restricción de elegibilidad](#equipos-universitarios-torneo-scope) | **Arreglado (24/sep)** — `eligibility.universityOnly` ahora bloquea inscripciones de equipos no universitarios verificados. |
| ✅ | [Publicaciones guardadas: no hay endpoint para listarlas](#posts-guardados) | **Arreglado (28/sep)** — `GET /posts/saved` (`listSavedPosts`), mismo formato y filtros de bloqueo que el feed. |
| ✅ | [Sala de staff por torneo](#sala-staff-torneo) | **Hecho (3/oct)** — `GET /tournaments/:id/staff-room`, membresía sincronizada en los 7 puntos de staff, `staff_report` validado, el cliente no puede crearla. |
| ✅ | [Perfil profesional de jugador + Buscar equipo + Reclutar](#perfil-jugador-reclutamiento) | **Hecho (24/sep), falta desplegar el backend** (`gamerProfile.pro`, `Team.recruitment`, postulaciones con tarjeta). |
| ✅ | [`staff/mine` da por aceptados torneos por coincidencia de nick](#staff-mine-acepta-por-nick) | **Arreglado (28/sep)** — nick → `unconfirmed`, casters quitados fuera, `?role=` en servidor. |
| ✅ | [Postulación a staff: validar perfil completo en el servidor](#staff-apply-perfil) | **Arreglado (28/sep)** — misma regla que el front (`shared/roleProfileCompleteness.mjs`) + carta de presentación en el `staffMember`. |
| ✅ | [Roster: un miembro no puede editar su propio perfil](#roster-miembro-edita-su-slot) | **Arreglado (19/sep)** — `PATCH /teams/:teamId/roster/mine` implementado; `PlayerTeams.jsx` ya tiene el modal para reclamar/editar el puesto propio y `TeamRoute`/`Sidebar`/`TeamPanelLayout` ya limitan `/mi-equipo` a lideres (y admin). |
| ✅ | [Eliminar/salir del equipo: bloqueado por un miembro fantasma](#eliminar-equipo-miembro-fantasma) | **Arreglado (19/sep)** — `leaveTeam` ya valida que los "otros miembros" existan de verdad antes de bloquear, y limpia referencias huerfanas. Falta correr `cleanup-stale-team-members.js` contra el entorno donde se vio el bug para limpiar el dato ya dañado. |
| 🟡 | [Solicitud de unirse a equipo: un caso sin ningun aviso](#solicitud-unirse-sin-aviso) | Reportado por Stephanie: desde una cuenta, enviar una solicitud de union no disparo ni un toast de exito/error ni una notificacion al lider. Revise los 3 puntos del frontend que llaman a este endpoint y los 3 muestran toast siempre (exito y error) — necesita revisarse del lado del servidor (logs de esa cuenta/equipo). |
| ✅ | [`user.role` se pisa al aprobar brand: pierde acceso a su propio panel de jugador](#role-pisado-por-brand) | **Arreglado (23/sep, commit `2098c5f`)** — brands.controller.js ya no pisa `role` sin condicion; suma `'brand'` a `roles[]` (que Sidebar ya lee) y solo toca `role` si todavia era el default neutral `'player'`. |
| ✅ | [Torneos individuales (1v1/solo): inscripción sin equipo ni Discord vinculado](#solo-sin-equipo-ni-discord) | **Arreglado (20/sep)** — quitado el bypass de `registerTeamForUser`/`cancelRegistration`; de paso corregido un bug real en `requiredPlayersForTournament` (no reconocía la modalidad "Individual"). Falta probar en runtime contra Mongo real. |
| ✅ | [Discord: sistema de tickets real en #soporte](#discord-tickets-reales) | **Arreglado (24/sep)** — `#soporte` ahora publica menu de categorias; al elegir, el bot abre un hilo/mensaje de ticket y menciona al staff/organizador del torneo. |
| ✅ | [Comandos duplicados](#discord-comandos-duplicados) | **Arreglado en el script (3/oct)** — el deploy global borra los de `GUILD_ID`; `--clear-guild` para solo limpiar. Falta correrlo una vez con el `.env` real. |
| ✅ | [Discord: #reglas nunca muestra el PDF real del reglamento](#discord-reglas-pdf) | **Arreglado (24/sep)** — el embed de `#reglas` ya enlaza `rulesDocument`/`rulesName` cuando el torneo trae PDF. |
| ✅ | [Staff de torneo: `GET` no filtra campos por permiso, solo la pestaña se esconde](#staff-get-sin-redaccion) | **Arreglado (23/sep, commit `382a93e`)** — getTournament redacta `staffMembers` (a solo la propia entrada, no el array entero) y `reports` segun el acceso real del staff que pide el torneo. |
| ✅ | [Coach no puede ser staff de un torneo — ni el rol existe](#staff-roles-coach-analista) | **Arreglado (23/sep, commit `5a73239`)** — Coach/Analista ya son roles de staff reales (`STAFF_ROLES`/enum/matriz de permisos); Analista ya no se guarda en silencio como Arbitro. |
| ✅ | [Postularse como staff de un torneo (hoy solo existe invitar)](#staff-autopostulacion) | **Arreglado (23/sep, commit `9ae12f8`)** — `POST /tournaments/:id/staff/apply` + status `'requested'`, con UI en los 5 paneles de rol y aprobar/rechazar desde Colaboradores. |
| ✅ | [No hay forma de editar el propio perfil de rol después de aprobado](#role-profile-sin-editar) | **Arreglado (23/sep, commit `caee597`)** — `PATCH /profile/me` con `professionalProfile` ya cubre los 7 roles y acepta `role` explicito; CoachDashboard ya guarda de verdad (Caster/Analyst/Moderator/Creator quedan sin editor propio todavia). |
| ✅ | [Buscador de staff no muestra historial real de torneos](#staff-search-historial) | **Arreglado (23/sep, commit `5ff062c`)** — `GET /profile/staff` ya devuelve `acceptedTournamentsCount` por persona. |
| ✅ | [Avisar cuando un rol nuevo queda aprobado: falta el empujón a completar perfil](#role-aprobado-completar-perfil) | **Arreglado (23/sep, commit `9623589`)** — segunda notificación (`role_profile_complete_reminder`) al aprobarse un rol. |
| ✅ | [`listPosts` inventa publicaciones y se las atribuye a usuarios reales](#posts-auto-siembra-falsa) | **Arreglado (23/sep, commit `b6d7280`)** — se quito el bloque de auto-siembra; 210 posts falsos ya plantados se borraron en local (falta correr el script de limpieza contra produccion). |
| ✅ | [Panel de Analista pide una ruta que no existe (`/teams/staff/mine`)](#teams-staff-mine-inexistente) | **Arreglado del lado del backend (visto 22/sep)** — `GET /teams/staff/mine?role=` ya existe (`getMyStaffTeams`, busca por `rosterSlots`, soporta coach/analyst/caster). Falta sumar la llamada en `CoachDashboard.jsx` (Caster/Analyst ya la usan). |
| ✅ | [Centro de Marcas: falta reputación/calificación de organizadores](#brand-organizador-reputacion) | **Arreglado (23/sep, commit `14dee3e`)** — sistema de reseñas real (alcance básico acordado: rating 1-5 + comentario, solo equipos que de verdad jugaron, sin moderación todavía). |
| ✅ | [Dos servidores socket.io en el mismo puerto tumban la API](#socketio-doble-servidor) | **Ya estaba arreglado** (commit `c3873d2`): `server.js` solo inicializa `messagesRealtime`. Marcado el 28/sep. |
| ✅ | [Cookie CSRF: peticiones simultaneas generan tokens distintos](#csrf-carrera-primera-visita) | **Arreglado (28/sep)** — la cookie solo nace en `GET /csrf-token` y no rota. |
| 🟡 | [Ganar un partido / el torneo: nadie se entera en la web](#ganador-avisos) | **Casi hecho (28/sep)** — `onResultsConfirmed` común a web y Discord: `tournament_match_won`, `tournament_podium`, Discord al cerrar a mano, stats en Discord, `wins/losses`. **Falta solo `rankPts`** (decisión de producto: escala de puntos). |
| 🟢 | [Póster de campeón](#poster-campeon) | **`seriesChampion` hecho (3/oct)**, contando por equipo. Falta el marcador desde `/report` de Discord. |
| ✅ | [Notificaciones: tarjetas de acción](#notificaciones-tarjetas-accion) | **Hecho (28/sep)** — los 4 tipos existentes con `meta` completo y los 4 emisores nuevos. Siguen sin endpoint: confirmar/disputar desde la tarjeta, check-in web, cerrar ticket. |
| ✅ | [Roster congelado al check-in](#roster-congelado-checkin) | **Arreglado (28/sep)** — `rosterLock.service.js`: los 6 puntos responden `409 ROSTER_LOCKED` y el primer check-in guarda `rosterSnapshot`. Verificado contra Mongo real (20/20). |
| ✅ | [Check-in: cierre automático](#checkin-cierre-automatico) | **Arreglado (28/sep)** — job `checkinClose.service.js` cada 2 min: al pasar `checkinDeadline` + tolerancia descalifica ausentes, arma el bracket y avisa rival. Verificado contra Mongo real (19/19). |
| ✅ | [Roles: `PATCH /admin/users/:id/role` saltaba la aprobación](#admin-role-bypass) | **Arreglado (28/sep)** — ruta eliminada; nadie la usaba. |
| ✅ | [Horario por partida + aviso previo](#avisos-por-partida) | **Hecho (28/sep)** — `matchSchedule` se guarda; job `matchReminders.service.js` avisa `tournament_match_soon` antes de cada partida (eliminación simple). Falta: Discord, otros formatos, correr horarios. |
| ✅ | [Inscripción: aprobación manual](#inscripcion-aprobacion) | **Descartado (3/oct)** — la inscripción es automática: entra el equipo que cumple las condiciones (incluida la verificación universitaria por Microsoft). |
| ✅ | [Coach HQ: perfil profesional y planes de trabajo](#coach-hq-backend) | **Hecho (4/oct)** — `CoachWorkPlan` + `/api/coach/work-plans` + vista del capitán en `/mi-equipo/planes`. |
| ✅ | [Staff invitations: motivo](#staff-invitations-reason) | **Hecho (3/oct)** — `staffMembers[].responseReason` se guarda y se ve en Colaboradores. |
| ✅ | [Presencia real](#presencia-online) | **Arreglado (3/oct)** — el socket de notificaciones enciende/apaga `User.status`, respeta Invisible y `ban`, `lastSeenAt`, reset al arrancar; `team.controller` ya no cuenta `activo`/`ban` como en línea. |
| ✅ | [Competencia: avisar cada cambio](#competencia-aviso-cambios) | **Hecho (3/oct)** — `changeNotice` avisa a equipos + staff, Discord (`discord.tournament.changed`), `Tournament.announcements`, candados `BRACKET_LOCKED` en servidor, permisos `competencia`. |
| 🟡 | [Títulos + rankPts](#titulos-equipo-jugador) | **Puntos 1, 2, 3, 5 y parte del 6 hechos (3/oct)**: títulos y rankPts, la web ya los usa, script de relleno, avisos `tournament_eliminated`/`finished`/`prizes_pending`. Faltan `circuitLevel`, `qualified`, `prize_delivered`, publicación automática y podio de formatos no simples. |
| 🟡 | [Inventario de cosméticos](#inventario-cosmeticos) | **Motor hecho** (3/oct) + referidos ("Invita 3") y torneos ya con datos reales. Faltan MVP, racha, ranking, eventos y votación. |
| ✅ | [Coach y staff del equipo: de la invitación al plantel](#staff-equipo-roles) | **Hecho (7/oct)** — invitar/postularse "como coach/analista/manager", cupo de staff propio, expulsar de verdad, cambiar rol, sello verificado. Quedan 3 detalles (ver sección). |
| ✅ | [Seguridad pre-lanzamiento (auditoría 4/oct)](#seguridad-pre-lanzamiento) | **Hecho (4/oct)** — 2FA saltable, secreto JWT por defecto, teléfono/edad públicos, enlaces `javascript:`, spam sin límite, `/uploads` abierto, inscripciones de borradores visibles, borrar cuenta sin anonimizar, 500 con mensaje interno, correo verificado para inscribir. 18/18 pruebas contra Mongo real. |
| 🔴 | [Antes de abrir al público (despliegue)](#lanzamiento-checklist) | **Casi todo hecho (5/oct)**. Falta: desplegar master (VPS en `1914f89`) con resultados/grabaciones, `RCLONE_REMOTE` y que los capitanes verifiquen el correo. Pagos quedan fuera del lanzamiento. |

---

<a id="staff-equipo-roles"></a>
## [x] 🟡 Coach y staff del equipo: de la invitación al plantel (7/oct)

**En una frase:** el coach entraba por la puerta de los jugadores (quedaba de suplente hasta que el líder lo movía a mano), ocupaba cupo de jugador, le aplicaban "un equipo por juego", femenino/universidad y país/edad del torneo, y el líder no podía sacar a nadie de verdad.

Reglas (`shared/teamRoles.mjs`, mismo archivo en backend y web), siguiendo MPL / VCT / FACEIT / NACE:
- Roles: `player`, `coach` (principal + asistente), `analyst` (2), `manager` (1). `Team.maxStaff` (por defecto 4) es aparte de `maxMembers` (que ahora cuenta solo jugadores).
- Invitación (`TeamInvitation.role`) y solicitud (`joinRequests[].role`) llevan el rol; al aceptar va directo a su puesto (`coach`, `coach-2`, `analyst`, `manager`).
- El staff no tiene las reglas de entrada de jugadores (femenino, país/región, universidad) ni "un equipo por juego", ni país/edad del torneo (`participantRestrictions`). Sí el Roster Lock: nadie en dos equipos del mismo torneo, y el plantel se congela con el check-in.
- Ser staff de otro equipo no impide crear el propio. Los puestos de staff solo los da el líder (`PATCH /roster/mine` ya no deja nombrarse coach).
- `roleVerified`: sello si tiene el rol aprobado en GlitchGang (`roleProfiles.coach|analyst.approvedAt`), recalculado al leer el equipo. No es requisito para entrar; el Coach HQ lo sigue pidiendo.
- Nuevos: `DELETE /teams/:teamId/members/:userId` (sacar del equipo: miembros + plantel + `User.team` + historial `removed` + aviso) y `PATCH /teams/:teamId/members/:userId/role`. Salir por cuenta propia ahora avisa al líder.
- De paso: el plantel escrito a mano ya no puede apuntar a la cuenta de alguien que no es miembro (aparecía en el plantel público y recibía stats del roster congelado sin haber aceptado); se borró el viejo `Team.staff` de texto (lo usaba solo el admin y el seed con nombres inventados).
- **El plantel solo lo ocupan cuentas miembro** (patrocinadores aparte, son marcas). Antes "Asignar", el asistente de crear equipo y el "agregar jugador" viejo guardaban cualquier nick escrito a mano, sin cuenta, sin aceptar y sin reglas. Ahora el servidor responde `NOT_A_MEMBER`; al crear solo queda el puesto del líder; "Asignar" (`SlotAssignPanel.jsx`) ofrece mover a un miembro o invitar con el rol del puesto; la inscripción a torneos exige titulares miembros (`ROSTER_NOT_MEMBERS`).
- **Bug grave corregido:** `syncRosterSlotsWithUsers` asignaba el líder a `titular-1` "por posición": un nick inventado en ese puesto quedaba con el `userId` y el Discord del líder, pasaba la validación de Discord del torneo y sus stats iban a la cuenta del líder (y la inscripción lo guardaba en la base).
- **Datos personales:** el asistente pedía cédula y WhatsApp de cada jugador y `rosterSlots` sale en la página pública y en el directorio (`listTeams` además ignoraba ocultar plantel/correos). Ya no se guardan ni se devuelven.
- **En el VPS:** `npm run migrate:strip-roster-private-data` (dry-run) y luego `-- --apply`: borra cédula/WhatsApp guardados y desvincula los puestos que quedaron con la cuenta de otra persona por el bug de arriba.
- **Presencia (7/oct)**: `shared/presence.mjs` es el único criterio. `status` = conectado (socket), `activeStatus` = lo que elige el usuario. Los demás ven el estado elegido si está conectado y "Desconectado" si no o si eligió Invisible; el backend manda `presence`/`online` resueltos y nunca el `activeStatus` de otro. Cambiar de estado con la web abierta se aplica al momento (`refreshPresence`) y avisa a los amigos por socket (`presence`). Amigos, Mensajes, página de equipo, Coach HQ y perfil ajeno lo usan. Comunidad: se quitó el filtro "En línea" (sus miembros no son cuentas).
- **Perfil ajeno mostraba el equipo de quien miraba** (carrera: mientras cargaba se creía el perfil propio y pedía `/teams/mine`). Ahora `GET /teams/of/:userId` (respeta "Equipos" privado y planteles ocultos) y el perfil decide propio/ajeno por la URL.
- **Historial de partidas**: confirmar una partida del bracket creaba `PlayerMatch` para todos los miembros, staff incluido (el coach sumaba winrate). Ahora usa el roster congelado sin puestos de staff.
- **Discord (7/oct, decidido "aparte")**: cada torneo tiene un rol `coach-<torneo>` (`discordProvision.teamStaffRoleId`, morado) para coach/analista/manager de los equipos: ve y escribe en los canales compartidos, no en `#staff` (que es del organizador, `staffRoleId`), y sigue entrando a la sala de su equipo. El backend manda `staffUserIds` en `/bots/provision/teams/:id`. Torneos ya armados: al re-sincronizar el torneo se crea el rol y se le da acceso a los canales existentes. Si el staff cambia después de armada la sala, hace falta re-sincronizar el equipo.
- Test intermitente de Stephanie: `matchResults.integration.test.js` caso 2 a veces da `analyzing` en vez de `arbitration` con la máquina cargada (pasa solo 3/3).
- Código muerto: el panel de gestión viejo de `Teams.jsx` (`panelMode="team"`, sin ruta) tiene invitar/aceptar falsos (solo toasts); borrarlo.
- Prueba: `TEAM_TEST_MONGO=1 node --test src/controllers/teamRoles.integration.test.js` (contra Mongo real).

**Quedan:**
- [ ] `GGTeamCard` (directorio) marca "Lleno" contando a todos los miembros: un equipo con jugadores completos igual acepta staff, pero desde la tarjeta no se puede postular (sí desde su página).
- [ ] El líder no tiene dónde cambiar `maxMembers` / `maxStaff` en el panel (quedan los valores por defecto).
- [ ] Límite de staff por torneo configurable por el organizador (hoy manda el del equipo).

<a id="seguridad-pre-lanzamiento"></a>
## [x] 🔴 Seguridad pre-lanzamiento (auditoría 4/oct)

**En una frase:** revisión "como atacante" de los módulos activos antes de abrir al público y hacer eventos; todo lo encontrado quedó arreglado y probado contra Mongo real (18/18 + limitador).

| # | Qué estaba mal | Arreglo |
|---|---|---|
| 1 | `requireAuth`, `optionalAuth` y los 2 sockets aceptaban **cualquier JWT** firmado con el secreto; la sesión solo se comprobaba si había `jti`. El token temporal del 2FA (`{ require2fa }`) y el de vincular Discord (`{ purpose }`, viaja en URL) servían como sesión → **con la contraseña se entraba sin el código 2FA**. `buildLinkState` además convertía cualquier token en permiso para vincular Discord. | `verifySessionToken()` en `auth.middleware.js`, único punto para API, sockets y vínculo de Discord: exige `jti` con `Session` activa, rechaza `purpose`/`require2fa`, usuario no `deleted` ni baneado. |
| 2 | `JWT_SECRET` con valor por defecto visible en el repo → cualquiera firma sesión de admin si falta en prod. | `config/index.js`: fuera de local (prod o `CLIENT_ORIGIN` público) el servidor no arranca con secreto ausente, < 32 caracteres o de ejemplo; tampoco con `UNIVERSITY_DEV_BYPASS`. |
| 3 | Con visibilidad por defecto `public`, el perfil público (incluso sin sesión) devolvía **teléfono y fecha de nacimiento** → recolectables por bots, menores incluidos. | `applyProfilePrivacy`: teléfono y nacimiento solo para el dueño y admin, siempre. |
| 4 | Enlaces escritos por usuarios (`documentUrl` de solicitudes de rol, `proofUrl` de comprobantes, enlaces de publicaciones/comunidades...) iban a `href` sin validar → `javascript:` = robo de sesión del **admin** que revisa. | `frontend/src/lib/safeUrl.js` (`safeHref`) en 20 enlaces; enlaces de comunidad solo `http(s)` al guardar. |
| 5 | La mayoría de escrituras sin límite (posts, DMs, solicitudes, tickets, equipos, torneos). Los límites eran por IP (en un evento presencial todos comparten IP) y en Redis todos los limitadores compartían clave y ventana. | `writeLimiter` global (120 escrituras / 5 min **por usuario**; excluye `/bots` y webhooks), login por IP+cuenta, prefijo y ventana propios por limitador. |
| 6 | `POST /uploads` aceptaba cualquier tipo (lo guardaba `.bin`) y sin límite → alojamiento gratis / llenar disco. | Solo PNG/JPG/WEBP/GIF/PDF/MP4/WEBM, firma (magic bytes) verificada, `uploadLimiter`. |
| 7 | `GET /tournaments/:id/registrations` mostraba a cualquier usuario las inscripciones de torneos **borrador/privados** con `teamInternalCode`; `discord-log` sin permisos. | Staff (cualquier pestaña con lectura) ve todo; el resto solo torneos publicados y sin código interno. `discord-log` exige pestaña Discord. |
| 8 | `DELETE /admin/users/:id` solo marcaba `deleted`: email/nick/teléfono/Discord quedaban tomados y guardados; las sesiones abiertas seguían vivas. | Anonimiza (libera email y nick, borra teléfono, redes, WhatsApp, Discord), revoca sesiones; conserva `_id`/`playerCode` para el historial. |
| 9 | Los 500 devolvían el mensaje interno al cliente. | En producción, mensaje genérico (el detalle queda en el log). |
| 10 | Sin freno a cuentas múltiples en torneos con premio. | `registerTeamForUser` (web y bot) exige `emailVerified`; la pantalla de inscripción lleva a Ajustes → Cuenta. **Ojo:** nadie tenía el correo verificado (la página `/verify-email` no existía hasta el 4/oct), cada capitán debe verificarlo antes del primer evento. |

**Pendiente fuera del código:** ver [checklist de lanzamiento](#lanzamiento-checklist). **Antes de activar pagos** (no entra en el lanzamiento): el método `transfer` queda `demo_paid` al instante → Pro gratis; hay que darle flujo de comprobante + aprobación manual.

<a id="lanzamiento-checklist"></a>
## [ ] 🔴 Antes de abrir al público (despliegue)

- [x] VPS: `NODE_ENV=production` y `JWT_SECRET` aleatorio rotado (5/oct). Ojo: si el secreto queda vacío el sitio da 502 aunque PM2 diga "online" — revisar `/api/health`.
- [ ] Desplegar master: el VPS está en `1914f89` (5/oct); master ya va 31 commits adelante. Migración nueva: `npm run migrate:university-team-slots` (dry-run, luego `--apply`). `migrate:referral-codes` y `migrate:tournament-titles` ya se corrieron el 5/oct; volver a correr `migrate:tournament-titles` para que los torneos viejos ganen 2.º/3.º en todos los formatos (`4c90e7b`).
- [x] Token de Meta (5/oct): el único que quedó en git estaba truncado (54 caracteres + `>`), el debugger de Meta lo da por mal formado. No hay nada que revocar.
- [x] Índice único `whatsapp.phone` de `User`: `$ne` → `$gt: ''` (Mongo no admite `$ne` en índices parciales).
- [x] WhatsApp fuera del lanzamiento: `glitchgang-whatsapp-bot` y `glitchgang-whatsapp-real` apagados en PM2 (5/oct).
- [x] Correo: Resend con el dominio `glitchgang.net` verificado (DKIM/DMARC en Hostinger, 5/oct). Verificación y recuperar contraseña llegan a la bandeja de entrada.
- [ ] Pedir a los capitanes que verifiquen su correo antes del primer evento.
- [x] Inscripción MLBB por Discord (7/oct): `/torneo inscribir` siempre fallaba con "Debes aceptar el envío de capturas…" sin forma de aceptar. Ahora responde con el enlace a `/torneos/<código>/inscripcion` de la web.
- [x] Verificación MLBB (7/oct): el `alternative_endpoint` de un 503 de Rone Arena solo se sigue si es `*.rone.dev` o está en `GAME_ACCOUNT_VERIFY_ALT_HOSTS`; antes cualquier host https recibía el ID y el código del jugador.
- [x] Aviso de cookies (`components/CookieNotice`, 5/oct): solo informativo porque solo hay cookies esenciales (sesión HttpOnly + CSRF). Si algún día se agrega analítica o píxeles, tiene que pedir consentimiento **antes** de cargarlos. Privacidad §6 corregida (decía "analítica" y "Stripe").
- [x] `robots.txt`, `manifest.webmanifest` y etiquetas `og:`/`twitter:` en `index.html` (5/oct). Las imágenes `og:` apuntan a `https://glitchgang.net`: si cambia el dominio, actualizarlas.
- [ ] Resultados y grabaciones de voz (6/oct, `ca16ee2`..`67d0ed1`), al desplegar master:
  1. Reiniciar los tres procesos: backend (`glitchgang-api`), bot (`discord-bot`) y CRM (`discord-bot/api/server.js`). El CRM es el que deja pasar el audio de las grabaciones (`/bot-proxy` con `audio/ogg`).
  2. En `discord-bot/`: `npm run deploy` (sin `--dev`). `/report` cambió de opciones y sin esto Discord muestra las viejas.
  3. `.env` del backend y del bot/CRM: el mismo `BOT_API_KEY` en los dos, y en el bot `CRM_INTERNAL_URL` (o `CRM_PORT`) apuntando al CRM. `MATCH_RESULTS_*` y `MATCH_RECORDINGS_*` son opcionales.
  4. Grabaciones: por defecto quedan en `backend/data/recordings` (privada, fuera de `/uploads`) y el respaldo de abajo ya las incluye. Al arrancar, el backend escribe en el log `[match-recordings] Grabaciones de voz en <carpeta>` o un ERROR si no puede escribir ahí. Revisarlo una vez.
  5. Las grabaciones viejas del bot (`.pcm`, de antes del 6/oct) no se pueden recuperar: eran paquetes de voz pegados sin separación ni tiempos. El bot las borra solo al cumplir 30 días, como promete el aviso de la sala.
- [~] Respaldos: `backend/scripts/backup.sh` corre en el VPS (cron root `15 4 * * *`, `mongodb-database-tools` instalado, 5/oct). **Falta `RCLONE_REMOTE`** (hoy la copia vive en el mismo disco del VPS). 7/oct: los respaldos de grabaciones se guardan solo `REC_KEEP_DAYS` (1 día por defecto) para cumplir el "se elimina a los 30 días" del bot, y la limpieza ahora también borra en el remoto de rclone (antes la copia remota crecía para siempre).

---

<a id="bracket-no-persiste"></a>
## [x] 🔴 Bracket: persistencia real (schema + store)

**Confirmado arreglado (13/sep):** commit `6b68bba` en `master`. Verifiqué en el código real: `Tournament.js` tiene `bracketDoc` (published/status/format/teams/seedOrder/results/champion), `saveBracket`/`getBracket` lo leen y escriben correctamente, y `GET /tournaments/:id/bracket` (que faltaba registrar) ya está en las rutas. Arranqué el servidor completo contra Mongo real sin errores.

**En una frase:** el bracket que arma el organizador (formato, equipos,
resultados, campeón) no sobrevive un recargue de página ni se ve en otro
dispositivo, porque el modelo de Mongo no tiene dónde guardarlo.

**Qué:** que el bracket sobreviva recarga y otro dispositivo.

**Dónde:**
- `backend/src/models/Tournament.js`: el schema NO define `bracket`, `bracketResults`, `bracketState` ni `winner`, pero `saveBracket` en `tournament.controller.js` los asigna y hace `.save()` → Mongoose (strict) los descarta en silencio. La API devuelve 200 pero `getBracket` siempre da `{ bracket: [], published: false }`.
- `frontend/src/lib/bracketStore.js`: además guarda en un objeto `const memory = {}` en memoria de proceso (no localStorage), así que se pierde al recargar incluso antes de llegar al backend.
- Endpoints ya existentes: `PUT /tournaments/:id/bracket` (`saveBracket`) y `GET /tournaments/:id/bracket` (`getBracket`).

**Por qué:** la pestaña **Bracket** del panel ya guarda con `saveBracket(t.id, { published, status, format, results, teams })` en cada cambio. `results` es un mapa `matchId -> { a, b, scoreA, scoreB, winner, series, message, imgA, imgB, confirmed, time }`. `teams` es el array de nombres de equipo en orden de seed. La vista pública del torneo lee ese mismo store. Todo está listo del lado del front; falta que el backend lo acepte y lo devuelva igual.

**Esquema a agregar (`Tournament`):**
```js
bracketDoc: {
  published: { type: Boolean, default: false },
  status:    { type: String, enum: ['idle', 'running', 'finished'], default: 'idle' },
  format:    { type: String, default: '' },          // 'single'|'double'|'roundrobin'|'swiss'|'groups'
  teams:     [{ type: String }],                     // nombres en orden de seed
  seedOrder: [{ type: String }],                     // opcional, si el organizador/ruleta lo fija
  results:   { type: mongoose.Schema.Types.Mixed, default: {} },  // matchId -> objeto de resultado
  champion:  { type: String, default: '' },
  updatedAt: { type: Date, default: Date.now },
},
```
(Se llama `bracketDoc` para no chocar con el `bracket` que el controller viejo intenta escribir; también se puede limpiar ese código muerto y usar `bracket` directamente.)

**Cómo:**
1. `saveBracket`: validar que el usuario puede gestionar el torneo, hacer merge de `req.body` dentro de `tournament.bracketDoc`, `markModified('bracketDoc.results')`, `.save()`. Devolver `bracketDoc`.
2. `getBracket`: devolver `tournament.bracketDoc || { published: false }` con la MISMA forma que espera el front.
3. Cuando llegue un `results[id].confirmed === true` que antes no estaba: notificar a los equipos de esa partida (usar el shape correcto `{ type, title, message, link, meta }`) y, si el torneo usa ELO/ranking, actualizarlo ahí.
4. Cuando `status: 'finished'` con `champion`: setear `tournament.winner` y `tournament.status = 'finished'`.
5. Seeding manual / desde la ruleta: el front ya manda `seedOrder` (ver tarea de Ruleta abajo) — solo hay que aceptarlo, ya está en el esquema de arriba.

**Nota:** el front ya NO fabrica equipos falsos — si no hay inscripciones (con check-in o al menos inscritos), el bracket muestra un estado vacío. Los equipos salen de `GET /tournaments/:id/registrations`.

**Nota 2:** cada entrada de `results[matchId]` ahora puede traer también `scheduledAt` (fecha/hora ISO del enfrentamiento, se puede cargar antes de que exista un marcador) — como `results` ya es `Mixed`, no hace falta tocar el esquema para esto, solo tenerlo en cuenta si en algún momento se migra `results` a un sub-schema tipado en vez de `Mixed`.

**Ruleta:** `TabRuleta` ya usa equipos reales. El modo "Sorteo del bracket" hace `saveBracket(t.id, { seedOrder })` — se persiste con esta misma tarea. El modo "Premios" guarda los ganadores sorteados solo en memoria de sesión; un historial persistente de sorteos (MVP, giveaways) es un subdoc `draws: [{ kind, name, at, by }]` aparte, pero es baja prioridad.

---

<a id="reportes-rotos"></a>
## [x] 🔴 Reportes de torneo: falta el campo en el modelo

**Confirmado arreglado (13/sep):** commit `6b68bba` en `master`. `Tournament.reports[]` ya está en el schema con `severity`/`evidence`/`reportedBy`/`ticketId`, `createReport` los guarda y liga el ticket, y se agregó `PATCH /tournaments/:id/reports/:rid` para resolver (notifica al que reportó).

**En una frase:** crear un reporte desde el panel siempre falla porque el
código intenta guardar en un campo (`reports`) que no existe en el modelo.

**Qué:** hacer que `POST /tournaments/:id/reports` funcione y persista.

**Dónde:**
- `backend/src/models/Tournament.js`: **no existe** el campo `reports` (mismo caso que el bracket). `createReport` en `tournament.controller.js` hace `tournament.reports.push(report)` → `tournament.reports` es `undefined` → **TypeError → 500**. El ticket de soporte (`createSystemTicketRecord`) nunca se llega a crear porque el error pasa antes.
- `GET /tournaments/:id/reports` devuelve `tournament.reports || []` → siempre vacío.

**Por qué:** la pestaña **Reportar** ya manda `{ team, type, severity, detail, evidence: [urls] }` y espera `{ report, ticket, reports }`. Hoy siempre recibe error y lo muestra tal cual ("No se pudo enviar"). El flujo pensado: el organizador reporta una incidencia → se abre un ticket para el equipo de soporte de GlitchGang, que lo revisa y resuelve.

**Esquema a agregar (`Tournament.reports`):**
```js
reports: [{
  type:      { type: String, required: true },
  team:      { type: String, default: '' },
  severity:  { type: String, enum: ['baja', 'media', 'alta', 'urgente'], default: 'media' },
  detail:    { type: String, default: '', maxlength: 4000 },
  evidence:  [{ type: String }],   // URLs de uploadsApi
  status:    { type: String, enum: ['open', 'in_review', 'resolved'], default: 'open' },
  reportedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  ticketId:  { type: mongoose.Schema.Types.ObjectId, ref: 'Ticket', default: null },
  createdAt: { type: Date, default: Date.now },
  resolvedAt:{ type: Date, default: null },
  resolution:{ type: String, default: '' },
}],
```

**Cómo:**
1. Agregar el campo al schema. En `createReport`: guardar también `severity` y `evidence` (hoy solo lee `type/team/detail/status`), setear `reportedBy = req.user._id`, mapear `severity` → `priority` del ticket (`urgente→urgent`, `alta→high`, el resto `medium`), guardar `ticketId` con el `_id` del ticket creado.
2. Nuevo endpoint `PATCH /tournaments/:id/reports/:rid` `{ status, resolution }` → para que soporte/admin cambie el estado (y el organizador pueda cerrar los suyos). Al pasar a `resolved`: setear `resolvedAt` y notificar al organizador. El front ya tiene los 3 estados (`open`/`in_review`/`resolved`) en la UI, solo falta el endpoint (agregar `reportsApi.updateStatus` en `serverApi.js` cuando exista).
3. Si el ticket de soporte se resuelve por su cuenta, reflejarlo en `report.status` para que no queden desincronizados.

---

<a id="bot-sin-organizacion"></a>
## [x] 🔴 El bot de Discord ya está construido, pero no ve ningún torneo

**Confirmado arreglado (13/sep):** commit `6b68bba` en `master`, opción 1 (Organization única "GlitchGang"). `createTournament` ahora llama `getGlitchGangOrganizationId` y asigna `tournament.organization`; incluye `backend/src/scripts/backfill-tournament-organization.js` para los torneos ya existentes (falta correrlo en producción si no se hizo).

**En una frase:** el bot de Discord (`discord-bot/`) ya tiene comandos y
servicios completos y funcionando (`/vincular`, `/torneo`, `/checkin`,
`/rol`, `/report`, `/start-match`, `/calendario`, más el modelo
`TournamentMatch` para check-in/partidas en vivo), pero **ningún torneo
creado desde el asistente actual les llega**, porque falta una sola línea:
`createTournament` nunca escribe `tournament.organization`.

**Qué:** que los torneos que se crean hoy desde `/torneos/crear` queden
"visibles" para el bot.

**Dónde:**
- `backend/src/controllers/tournament.controller.js` — `createTournament`: en todo el archivo, `tournament.organization` **solo se lee** (líneas ~644, ~664-665), nunca se asigna al crear.
- `backend/src/controllers/bots.controller.js` y `backend/src/controllers/tournamentMatches.controller.js`: todos los endpoints que usa el bot filtran con `Tournament.find({ organization: org._id, ... })` (vía `resolveOrganizationByGuild`, que resuelve la `Organization` a partir del `guildId` de Discord). Si `organization` es `null` en el torneo, esa consulta nunca lo trae.
- El único lugar que sí escribe ese campo es un endpoint de admin manual: `PATCH /api/admin/tournaments/:id/organization` (`admin.controller.js` → `setTournamentOrganization`) — hay que entrar a mano, torneo por torneo, para que el bot lo vea. Nadie del equipo lo está haciendo hoy.

**Por qué importa:** esto no es una tarea chica — es la única razón por la que todo el trabajo ya hecho del lado del bot (comandos, `checkinMonitor.js`, `liveMatchService.js`, `tournamentService.js`, el modelo `TournamentMatch` con estados `checking_in/ready/in_progress/completed/disqualified/cancelled` y reporte con evidencia) no hace nada hoy. No hay que construir nada nuevo de este lado, solo conectar el cable que falta.

**Confirmado con más investigación (13/sep):** probé el camino completo del comando `/torneo lista` para saber exactamente qué ve un organizador hoy si lo prueba en el Discord real:
- `discord-bot/commands/torneo.js` → `backendApi.listTournaments(guildId)` → `GET /api/bots/tournaments?guildId=...` → `bots.controller.js` → `listDiscordTournaments`.
- Esa función primero hace `Organization.findOne({ discordGuildId: guildId, status: 'active' })`. Como no existe ningún `Organization` para el servidor de GlitchGang (por el diseño original que los excluye a propósito, ver abajo), esto devuelve **404 con el mensaje literal "Este servidor de Discord no está registrado como cliente de GlitchGang."** — ni siquiera llega a la parte de `tournament.organization`.
- `/torneo inscribir` (mismo comando) SÍ funciona hoy si alguien ya tiene el código exacto del torneo — usa `registerTeamForUser`, la misma función que la inscripción web, y esa no filtra por `organization`. El problema es que sin `/torneo lista` funcionando, nadie tiene de dónde sacar ese código desde Discord.

**Ojo con esto aparte (no es parte de este bug, pero es del mismo tema):** existe un mecanismo totalmente distinto y manual en `discord-bot/services/tournamentImport.js` — importar un Excel/CSV con columnas `torneo, equipo, jugador, discordId, discordUsername, lider` para cargar torneos "a mano" dentro del mundo del bot. Es un camino paralelo, no lee la base de datos real de `Tournament`/`Team`. Vale la pena que alguien confirme si todavía se usa o es código viejo de una versión anterior del bot — si ya no se usa, se puede borrar para no confundir a quien toque este código después.

**El punto que hay que decidir antes de programar (no es solo código):**
`Organization` fue pensado como "un cliente que alquila el servicio con su
propio servidor de Discord, aislado de cualquier otro cliente **incluido
GlitchGang mismo**" (comentario textual en `backend/src/models/Organization.js`).
Pero la decisión de producto ya tomada (ver `tournament-discord-model`) es un
**servidor único y compartido de GlitchGang** para todos los torneos propios.
Eso choca con el diseño original de `Organization`: bajo el modelo actual, los
torneos de GlitchGang **no deberían tener** una `Organization` porque el
comentario los excluye a propósito.

Dos salidas, a elegir con Stephanie antes de tocar código:
1. **Más simple:** crear una `Organization` única "GlitchGang" (con `discordGuildId` = el servidor compartido) una sola vez (seed/migración), e ignorar esa restricción del comentario para el caso del servidor propio — `createTournament` le asigna esa `Organization` a todo torneo nuevo automáticamente. El bot sigue funcionando exactamente igual que hoy, sin tocarle una línea.
2. **Más prolijo pero más trabajo:** que `resolveOrganizationByGuild` (donde sea que esté) trate el guildId del servidor compartido como caso especial ("sin organización = buscar por `discordEnabled` directo, sin filtrar por `organization`"), dejando `Organization` reservado de verdad solo para clientes externos.

Cualquiera de las dos resuelve el bug; la (1) es una migración de 10 minutos, la (2) es más consistente con el comentario original pero toca más archivos del bot.

**Cómo (para la opción 1, la recomendada):**
1. Script una sola vez: crear el doc `Organization` "GlitchGang" con `discordGuildId = process.env.DISCORD_GUILD_ID`, `owner` = alguna cuenta admin.
2. En `createTournament`, después de `tournament.save()` (o antes, seteándolo en el objeto): `tournament.organization = await getGlitchGangOrgId()` (con caché simple, no una query por torneo).
3. Migración aparte para los torneos ya existentes que quedaron con `organization: null` (mismo `$set` que usa `setTournamentOrganization`, corrido en bulk).
4. Avisar cuando esté hecho — a partir de ahí, probar en Discord real `/torneo`, `/checkin`, `/start-match` contra un torneo creado desde el asistente actual, porque nunca se probaron juntos.

**Relación con la tarea de abajo ("Discord: sistema completo del torneo"):** esa tarea describe un servicio NUEVO (`discordProvision.service.js`) para crear canales/roles cuando se publica un torneo — es candidata a **reusar las funciones que el bot YA tiene** en `discord-bot/services/discordGuildService.js` (`createChannel`/`editChannel`/`deleteChannel`/`createRole`/`editRole`/`deleteRole`/`addMemberRole`/`removeMemberRole`/`sendChannelMessage`) en vez de reimplementarlas desde cero contra la API de Discord. Antes de escribir ese servicio nuevo, vale la pena que quien lo haga revise `discord-bot/services/` completo — hay más resuelto ahí de lo que parece a primera vista.

---

<a id="permisos-staff-backend"></a>
## [x] 🔴 Permisos del staff por pestaña: el frontend ya limita, el backend no aplica nada

**Confirmado arreglado (13/sep):** commit `6b68bba` en `master`. Se agregó `staffMembers[].permissions` al schema, `assertTabAccess` + la misma matriz `ROLE_DEFAULT_ACCESS` del frontend, y `updateTournament` ahora filtra campo por campo según la pestaña (`FIELD_TAB_MAP`) en vez de todo-o-nada — incluso dejó `staffMembers` fuera de esa lista a propósito, como se recomendaba, para forzar el uso de los 3 endpoints nuevos.

**En una frase:** el panel de gestión ya tiene un sistema de permisos por
pestaña para el staff (rol → acceso por defecto, ajustable persona por
persona desde Colaboradores → "Permisos"), pero es **solo una capa de UI**
— el backend hoy ni siquiera deja pasar a los invitados, y si el día de
mañana se los deja pasar sin más, cualquiera de ellos podría llamar la API
directo y saltarse el límite que ve en pantalla.

**Qué:** que la autorización real del backend refleje lo mismo que ya decide el frontend.

**Dónde:**
- `backend/src/controllers/tournament.controller.js` → `assertCanManageTournament(tournament, user)` (línea ~32): hoy **solo** deja pasar a `isTournamentOwner` (el organizador) o a un admin de GlitchGang. Ningún `staffMembers` — ni siquiera uno con `status: 'accepted'` — puede llamar `updateTournament`, `saveBracket`, `createReport`, ni ningún otro endpoint que pase por esta función. Esto es asi HOY, antes de que exista el sistema de permisos: el staff invitado (Director, Administrador, Árbitro, Moderador, Caster, Producción) es puramente informativo, no puede operar nada todavía.
- `frontend/src/lib/staffPermissions.js`: tiene la matriz completa rol → pestaña → nivel (`none`/`view`/`edit`), más los ajustes puntuales por persona. Hoy esos ajustes se guardan en `localStorage` (`gg-staff-perms`) porque `Tournament.staffMembers` tampoco tiene un campo `permissions` — mismo patrón de "se pierde en silencio" que el bracket/reportes/checkinConfig si se llegara a mandar tal cual.
- `frontend/src/pages/organizer/OrganizerTournamentManage/OrganizerTournamentManage.jsx` y `frontend/src/layouts/OrganizerLayout.jsx` ya esconden pestañas y bloquean el contenido (`readOnly`) según esa matriz — pero es nada más una UI amigable, no una barrera real.

**Por qué importa (esto es de seguridad, no solo de UX):** el día que se implemente la tarea de arriba ("Staff: avisar al agregar", que sí necesita que el staff pueda operar) hay que tener cuidado de NO simplemente cambiar `assertCanManageTournament` a "cualquier `staffMembers` con `status: accepted` puede todo" — eso dejaría a un Caster editar sponsors o borrar staff con una llamada directa a la API, exactamente lo que el frontend está tratando de evitar mostrando la pestaña bloqueada.

**Esquema a agregar (`Tournament.staffMembers[].permissions`):**
```js
// dentro de cada entrada de staffMembers:
permissions: { type: Map, of: String, default: {} }, // { [tabKey]: 'none'|'view'|'edit' }, solo los que se customizaron
```

**Cómo (resumen):**
1. Agregar `permissions` al subschema de `staffMembers` (arriba) y aceptarlo en el `PUT /tournaments/:id` actual (o en los 3 endpoints nuevos de staff si ya se hicieron esa tarea) — así lo que hoy vive en `localStorage` del lado del front puede migrar a guardarse de verdad y verse igual en cualquier dispositivo.
2. Portar la MISMA matriz de default por rol que hay en `frontend/src/lib/staffPermissions.js` (`ROLE_DEFAULT_ACCESS`) a algún lado compartido del backend (o duplicarla ahí, documentando que tienen que mantenerse iguales) — la necesita el paso 3.
3. Escribir un resolver de acceso equivalente a `resolveMemberAccess` (rol + override) y usarlo en un middleware/helper nuevo, algo como `assertTabAccess(tournament, user, tabKey, 'edit'|'view')`, que:
   - deja pasar siempre a `isTournamentOwner` y a admin,
   - si no, busca al `staffMember` correspondiente (`status: 'accepted'`), resuelve su acceso a esa pestaña, y solo continúa si el nivel requerido está cubierto.
4. Mapear cada endpoint de escritura a la pestaña que le corresponde (ej. `saveBracket`→`bracket`, `createReport`→`reportar`, los campos de `updateTournament` relacionados a check-in→`checkin`, sponsors→`marca`, staffMembers→`colaboradores`, discordEnabled→`discord`, etc.) y reemplazar el `assertCanManageTournament` genérico por `assertTabAccess(..., 'edit')` en cada uno. Los endpoints de solo lectura (`getTournament`, `getBracket`, etc.) pueden quedar abiertos si ya son públicos, o pedir `'view'` si en algún momento dejan de serlo.
5. Avisar para que el frontend deje de usar el `localStorage` como fuente de verdad (`staffPermissions.js` ya está preparado para leer `member.permissions` del propio torneo primero — con que el backend empiece a devolverlo, el resto no cambia).

**Actualización (15/sep) — el frontend ya abre estos paneles a staff, pero forzado a solo lectura:** `/organizador/torneo/:id/gestionar/:tab` ahora deja entrar a cualquier staff aceptado del torneo (antes solo dueño/admin podían llegar ahí — ver `TournamentStaffRoute.jsx`), y el sidebar/pestañas ya filtran por `resolveMemberAccess` como estaba pensado. Pero como `assertCanManageTournament` (punto 4 de arriba) sigue rechazando a cualquiera que no sea dueño/admin, **todo el contenido queda en modo solo lectura para staff sin importar si su acceso resuelto dice "editar"** — es un candado temporal en `OrganizerTournamentManage.jsx` (`const readOnly = !hasFullAccess`, con comentario en el código) para no mostrar botones de guardar que van a devolver 403. Cuando implementes el punto 4, avisa para cambiar esa línea por `activeAccess !== ACCESS_EDIT` y que el "editar" real empiece a funcionar para staff.

---

<a id="discord-oauth"></a>
## [ ] 🟡 Discord: auto-unirse al servidor de GlitchGang al vincular cuenta

**Corrección:** en la versión anterior de este documento decía que el login/link
de Discord era un stub sin implementar (`501`). Eso estaba mal — revisé el
archivo equivocado (`oauth.controller.js`, que es scaffolding genérico sin
usar). El de verdad es `auth.controller.js` (`discordRedirect` /
`discordCallback` / `discordLinkConfirm` / `discordUnlink`, rutas `/auth/discord*`)
y **está completo**: intercambia el código, trae el usuario de Discord, lo
guarda en `User.discord.id/username`, y funciona tanto para login-con-Discord
como para vincular desde Ajustes. Lo único que falta para que funcione en
producción es cargar credenciales reales de una app de Discord en el `.env`
(`DISCORD_CLIENT_ID`, `DISCORD_CLIENT_SECRET`, `DISCORD_REDIRECT_URI`) — eso
es una tarea de configuración, no de código.

**Confirmado en vivo (13/sep) — por qué el botón "Conectar" no hace nada
hoy:** `backend/.env` tiene `DISCORD_CLIENT_ID` vacío. `discordRedirect`
(`auth.controller.js` línea ~195) chequea eso primero y devuelve
`501 { message: 'Discord OAuth is not configured' }` en vez de redirigir a
Discord — por eso el botón "no funciona", no es un bug de frontend. Esto es
config pura, se puede hacer sin tocar código (lo puede hacer cualquiera con
acceso a la cuenta de Discord del equipo, no hace falta ser el de backend):
1. Entrar a https://discord.com/developers/applications con la cuenta de
   Discord de GlitchGang → "New Application" → nombrarla (ej. "GlitchGang").
2. Pestaña **OAuth2** → copiar el **Client ID** y darle a "Reset Secret"
   para generar el **Client Secret**.
3. En la misma pestaña, en "Redirects", agregar exactamente:
   `http://localhost:4000/api/auth/discord/callback` (en producción, la
   misma ruta pero con el dominio real del backend).
4. Pegar ambos valores en `backend/.env`: `DISCORD_CLIENT_ID=...` y
   `DISCORD_CLIENT_SECRET=...`. Reiniciar el backend.
5. De paso: `DISCORD_REDIRECT_URI` en `.env`/`.env.example` apuntaba al
   puerto del FRONTEND (`:5173`) en vez del backend (`:4000`) — ya lo corregí
   en ambos archivos (el `.env` real de este entorno y la plantilla
   `.env.example` que usa todo el equipo), pero si alguien más ya tiene su
   propio `.env` copiado de antes, tiene que corregirlo a mano también.

**En una frase:** vincular Discord ya funciona; lo que falta es que ese mismo paso también una a la persona al servidor de GlitchGang automáticamente (hoy solo guarda su Discord ID).

**Qué:** agregar el scope `guilds.join` al login de Discord y, apenas se vincula la cuenta, meter a la persona al servidor de GlitchGang por API (sin que tenga que buscar un link de invitación aparte).

**Dónde:** `backend/src/services/discord.service.js` — `getDiscordAuthUrl` (línea del `scope`) y `exchangeDiscordCode`/`discordCallback` en `auth.controller.js`.

**Por qué:** el modelo de Discord de los torneos (ver `tournament-discord-model`) dice que estar en el servidor de GlitchGang es obligatorio para participar. Ahora mismo, vincular la cuenta solo guarda el ID; la persona tiene que además encontrar y usar un link de invitación por su cuenta. La tarea de abajo (sistema completo de Discord del torneo) asume que cualquiera con `user.discord.id` lleno ya está en el servidor y se le puede asignar un rol directamente — para que eso sea cierto siempre, hace falta este paso.

**Cómo:**
1. En `getDiscordAuthUrl`, cambiar `scope: 'identify email'` por `scope: 'identify email guilds.join'`.
2. En `discordCallback` (ambas ramas, login y link), después de guardar `discord.id`/`discord.username`: llamar `PUT https://discord.com/api/v10/guilds/{DISCORD_GUILD_ID}/members/{discordUser.id}` con el **token del bot** (`Authorization: Bot <token>`) y `access_token: tokens.access_token` en el body — este es el endpoint que usa el `access_token` del usuario (con scope `guilds.join`) para añadirlo al server sin que la persona haga nada más. Si ya es miembro, Discord devuelve 204 y no pasa nada.
3. Con eso, la tarea de abajo puede asumir sin peros que "tiene `discord.id`" implica "está en el servidor".

---

<a id="sync-usuarios-crm"></a>
## [x] ✅ Registro (web + bot) visible en el CRM

**Arreglado (18/sep), en 2 pasos:**

1. Primero se conectó `syncUserToCrm(user, source)` (`crmSync.service.js`)
   en `register()` y `discordLinkConfirm()` para avisarle al CRM cuando
   alguien se registra o vincula Discord, guardando una copia propia en un
   JSON local (`discord-bot/services/userStore.js`).
2. **Ese diseño se reemplazó (commit `f3ae1d3`)** por uno mejor: en vez de
   mantener una segunda copia de los usuarios (que se puede desactualizar),
   el CRM ahora **lee usuarios reales directo de Mongo** en cada carga de la
   pestaña "Usuarios":
   - `GET /api/bots/crm/users` (`bots.controller.js` → `listCrmUsers`,
     protegida por `requireBotAuth` igual que el resto de `/api/bots/*`) —
     consulta `User.find({})` y devuelve el mismo shape que ya esperaba el
     frontend.
   - `discord-bot/api/server.js`: `GET /users` ahora llama a
     `backendApi.listCrmUsers()` en vez de leer el JSON local.
   - `discord-bot/services/userStore.js` se borró (ya no hace falta).
   - `POST /portal/users/sync` se mantiene, pero ahora solo deja un renglón
     en el activity log del CRM — Mongo sigue siendo la única fuente real.

Con esto Mongo queda como única fuente de verdad para usuarios (evita el
mismo tipo de bug que "Bracket no persiste": dos copias del mismo dato que
se desincronizan). Sin tareas pendientes de este punto.

---

<a id="discord-sistema-completo"></a>
## [ ] 🟡 Discord: sistema completo del torneo (espacio, sala por equipo, todo sincronizado)

**En una frase:** falta el servicio de bot que (1) crea el espacio del
torneo al publicarlo, (2) crea la sala del equipo al inscribirse, (3) actualiza
ambos solos cuando algo cambia, y (4) solo deja entrar a los jugadores que
están en el roster registrado. Hoy nada de esto existe — es un solo servicio
con cuatro responsabilidades relacionadas, por eso va junto.

**Confirmado con más investigación (13/sep):** busqué en todo `discord-bot/`
quién llama a `createChannel`/`createRole` (las funciones que ya existen en
`discordGuildService.js` y que sí crean canales/roles reales en Discord).
Los únicos que las usan son `internalBotApi.js` y `api/server.js` — una API
interna que solo se puede llamar a mano (por ejemplo desde el CRM propio del
bot). **No hay ningún punto del código que las dispare solo** cuando se
publica un torneo o se inscribe un equipo. Y del otro lado, `checkinMonitor.js`
manda sus recordatorios a `match.channelId` — es decir, el sistema YA asume
que cada partida tiene un canal de Discord asociado, pero hoy alguien tiene
que crear ese canal a mano y cargar su ID en algún lado para que el bot lo
use. Esta tarea es exactamente lo que falta para que ese "a mano" se vuelva
automático.

Necesita que el login de Discord ya esté configurado con credenciales reales
(`DISCORD_CLIENT_ID`/`SECRET` en `.env` — el código de vinculación ya funciona,
ver tarea de arriba) para que `user.discord.id` empiece a llenarse. La parte
de auto-unirse al servidor (tarea de arriba) es recomendable pero no
bloqueante: mientras tanto, la persona puede unirse al servidor por invitación
normal y el bot igual le asigna el rol en cuanto detecte `discord.id` + roster.

### 1. Espacio del torneo (se crea al publicar)

Cuando un torneo se publica **con Discord activado** (`discordEnabled === true` + `discordConsent.acceptedAt`), el bot crea en el servidor de GlitchGang:
- una **categoría** con el nombre del torneo (o su `publicId` si el nombre es muy largo),
- canales de texto: `#anuncios` (solo lectura — avisos automáticos, ver punto 3), `#reglas` (el reglamento fijado/pineado), `#inscripcion` (cupos disponibles y cómo inscribirse), `#chat-general` (chat abierto para todos los inscritos + staff), `#check-in`, `#soporte`, `#resultados`, `#staff` (privado, solo el rol de staff),
- dos canales de voz: `General` (lobby/check-in previo, para todos los inscritos) y `Staff` (privado, solo el rol de staff),
- un **rol exclusivo del staff** de ese torneo: `staff-<publicId en minúscula>`, asignado a cada `staffMembers[].user` con `status: 'accepted'` (que ya tenga Discord vinculado),
- un **rol de organizador scoped a este torneo**: `organizador-<publicId en minúscula>`, asignado únicamente al creador del torneo (`tournament.owner`/`createdBy`). Ver "Rol de organizador (scoped por código)" más abajo.

Permisos: `@everyone` no ve la categoría. La ven los roles de equipo (punto 2) + el rol de staff + el rol de organizador. `#staff` y la voz `Staff` solo los ve el rol de staff + el rol de organizador. `#anuncios`, `#reglas` e `#inscripcion` son de solo lectura para todos menos staff/organizador (el bot escribe ahí, la gente no).

### 1.1 Rol de organizador (scoped por código de torneo)

Pedido explícito de Stephanie (20/sep): el organizador que crea el torneo debe poder administrar SOLO el espacio de Discord de SU torneo (identificado por `publicId`), nunca el servidor entero ni el de otro organizador. Nada de darle el permiso `Administrator` de Discord — eso es a nivel servidor y vería/tocaría todos los torneos.

Implementación: al aprovisionar la categoría (punto 1), crear un rol `organizador-<publicId>` y asignarlo por Discord API al usuario `tournament.owner`/`createdBy` (si ya tiene `user.discord.id`; si no, encolar como con el resto de roles pendientes). Ese rol NO lleva ningún permiso a nivel servidor — se le agrega un **permission overwrite a nivel de categoría** (se hereda a todos los canales/voces hijos) con: `Manage Channels`, `Manage Roles` (solo dentro de esa categoría — Discord permite scoping por canal/categoría), `Manage Messages`, `Move Members` (para mover gente en las voces), `Mute Members`. Al archivarse/borrarse el torneo, borrar también este rol.

Con esto "el código del torneo" = la categoría de Discord: todo lo que el bot crea (canales, roles de equipo, rol de staff) vive bajo esa categoría, y el rol de organizador solo tiene permisos ahí — no puede tocar nada fuera de su propia categoría aunque técnicamente comparta servidor con los demás torneos.

### 2. Sala del equipo (se crea al inscribirse)

Cuando un equipo se inscribe y queda confirmado, el bot crea dentro de la categoría del torneo:
- un **canal de texto** `#<slug-del-equipo>` (chat privado del equipo),
- un **canal de texto** `#<slug-del-equipo>-bracket` (el bot posta ahí el rival, horario y resultado de cada partida de ESE equipo — se actualiza solo cuando el bracket avanza),
- un **canal de voz** `<slug-del-equipo>`,
- un **rol exclusivo** `@<slug-del-equipo>`.

`slug` = nombre o tag del equipo en minúscula, sin acentos, `[^a-z0-9]+` → `-`. El equipo NO necesita su propio canal de reglas: su rol se agrega también a los permisos de `#reglas` y `#anuncios` del torneo (así ve el reglamento y los avisos generales sin duplicar contenido). Solo ese rol de equipo + el rol de staff ven/hablan en sus 3 canales privados.

**Control de acceso — "solo se acepta a los que se registraron":** el rol `@<slug-del-equipo>` se asigna directamente por la API de Discord (`PUT /guilds/{guild}/members/{user}/roles/{role}` con el bot token) a cada jugador del roster de esa inscripción que **ya tenga `user.discord.id`** (Discord vinculado). No es un flujo de "solicitud y aceptación" — como el servidor es obligatorio y el login con Discord ya mete a la persona al servidor (ver tarea de OAuth, punto 2), el bot simplemente le da el rol apenas hay match entre el roster registrado y una cuenta de Discord vinculada. Un jugador que **no** vinculó Discord queda fuera del canal hasta que lo haga — cuando lo vincule (tarea de arriba), revisar si está en algún roster pendiente y asignarle los roles que le faltan en ese momento. Si un jugador sale del equipo o la inscripción se cancela/rechaza, quitarle el rol (y si el equipo entero se retira, borrar sus 3 canales y el rol).

**Actualización (20/sep) — hecho, con una pieza que faltaba:** confirmé que `provisionTeam` (`discord-bot/services/provisionWorker.js`) ya implementa exactamente esto — se dispara vía `IntegrationEvent` (`discord.team.provision`) apenas `registerTeamForUser` confirma la inscripción con `tournament.discordEnabled`, y ya crea los 3 canales + rol, asigna el rol a cada jugador con Discord vinculado, y guarda `missingDiscordUsers`/`status: 'partial'|'ready'` en `Team.discordProvision`. La validación de datos (roster completo, identidad, Discord vinculado) también ya existe y bloquea la inscripción antes de llegar aquí (`validateTeamTournamentEligibility` en `tournament.controller.js`, 400 si falta algo). Lo único que faltaba y agregué hoy: el canal de texto del equipo se creaba mudo, sin ningún mensaje — ahora al crearse por primera vez (`text.created`, no en un re-sync) el bot publica un embed de bienvenida (`teamWelcomeEmbed` en `discord-bot/utils/tournamentAnnounceEmbeds.js`) que enlaza el canal `#reglas` del torneo, explica en 3 líneas los comandos relevantes (`/checkin`, `/report`, `/vincular`) y avisa si quedan jugadores del roster sin Discord vinculado (con cuántos y qué hacer). No se probó en un Discord real todavía — falta correr `npm run dev` en `discord-bot/` contra un torneo con `discordEnabled` y una inscripción real para confirmar que el embed llega bien formateado.

**Actualización (20/sep, probando en vivo) — categoría propia por equipo:** al probar contra un torneo real (`TOR-STRE-ORG900-002-01`, 4 equipos) salieron dos cosas:
1. Los 4 equipos habían fallado antes con `RangeError [ColorConvert]: Unable to convert "NaN" to a number.` al crear el rol del equipo — error de una versión anterior a la guarda de color ya arreglada (commit `39ff4e0`). Los eventos fallidos no reintentan solos (`getPendingIntegrationEvents` excluye `status: 'failed'` a propósito); el botón **"Reintentar Discord"** que ya existía por equipo (`retryTeamDiscordProvision`, `frontend` `OrganizerTournamentManage.jsx` ~línea 2096) es el camino correcto para forzarlo con el código ya corregido.
2. Reportado por Stephanie: con varios equipos colgando de la MISMA categoría del torneo, Discord agrupa TODO el texto de la categoría arriba y TODA la voz abajo (comportamiento nativo de Discord, no depende del orden de creación) — así que la voz de un equipo terminaba lejos de su propio canal de texto, mezclada con la de los demás equipos. Arreglado: `provisionTeam` ahora crea primero una **categoría propia por equipo** (`Equipo - <nombre>`, mismos permisos que sus canales) y cuelga ahí sus 3 canales (`#team-<slug>`, `#team-<slug>-bracket`, voz) — quedan agrupados y separados visualmente de los demás equipos. Se agregó `Team.discordProvision.categoryId` al schema. La categoría del equipo no queda anidada bajo la del torneo (Discord no soporta categorías anidadas) ni se le fija una posición explícita — aparece al final de la lista de canales del servidor; si se quiere que quede pegada justo debajo de la categoría del torneo hay que fijar `position` al crearla (no hecho todavía, es cosmético).
3. Probando `/checkin` en vivo salió otro gap real: el comando pedía escribir el código del torneo (`torneo`) y/o el nombre del equipo cuando había ambigüedad — pero el jugador ya está parado dentro de la sala EXCLUSIVA de su equipo (la categoría del punto 2), así que no debería hacer falta escribir nada. Arreglado: nuevo endpoint `GET /api/bots/tournaments/team-by-channel?guildId=&channelId=` (`tournamentMatches.controller.js` → `getTeamByDiscordChannel`) que busca directo en `Team.discordProvision.{voiceChannelId,textChannelId,bracketChannelId}` cuál equipo es dueño de ese canal, y de ahí resuelve el torneo (`Tournament.findOne({organization, 'registrations.team': team._id})`) — sin ambigüedad posible, un canal es como mucho de un equipo. `discord-bot/services/tournamentService.js` (`getTeamAndTournamentByChannel`) y `checkin.js` lo intentan PRIMERO (con el `voiceChannel.id` del jugador, y si no con `interaction.channelId`); solo si ninguno matchea (ej. corrido desde un canal general del torneo) cae al camino viejo por nombre/código con las opciones `torneo`/`equipo` como respaldo manual. No necesita re-deploy de comandos (no cambié el schema del slash command, solo la lógica interna) — alcanza con reiniciar `discord-bot` y `glitchgang-api`.

### 3. Todo se actualiza solo cuando cambia el torneo

Después de un `updateTournament` exitoso, según qué campo cambió:
- `rules` / `rulesDocument` / `rulesName` → editar/re-pinear el mensaje en `#reglas`.
- `date`, `endDate`, `registrationStart`, `registrationEnd`, `checkinDeadline`, `maxSlots`, `prizePool`, `status` → publicar un mensaje (embed) en `#anuncios` resumiendo qué cambió.
- inscripciones nuevas o canceladas → actualizar el mensaje fijado de `#inscripcion` (cupos usados / disponibles).
- `discordEnabled` pasa de `false` a `true` en un torneo ya existente → correr el aprovisionamiento del punto 1 (no hace falta esperar a un torneo nuevo).
- `status` pasa a `finished`/`cancelled` → anuncio final en `#anuncios` + archivar la categoría (renombrar a `✔ <nombre>`, quitar permisos de escritura) — **no borrar** hasta 30 días después (cron aparte).

### Dónde enganchar todo esto

- Servicio nuevo: `backend/src/services/discordProvision.service.js` (o dentro de la carpeta del bot si ya existe una).
- `createTournament`, después de `tournament.save()`, si `discordOn === true` → `discordProvision.ensureTournamentSpace(tournament)` (fire-and-forget, no bloquear la respuesta; loguear errores).
- `updateTournament`, al final si hay cambios relevantes → `discordProvision.syncTournamentSpace(tournament, camposQueCambiaron)`.
- Controller de inscripciones, cuando una queda confirmada → `discordProvision.ensureTeamRoom(tournament, registration)`; al cancelar/rechazar → `discordProvision.removeTeamRoom(...)`.
- `oauthCallback` (tarea de arriba), cuando alguien vincula Discord → `discordProvision.syncPendingRolesFor(user)`.

### Por qué (lo que ya existe en el frontend)

La pestaña **Check-in** del panel ya pinta todo esto en vivo, hoy con estado "Pendiente" porque el backend no llena nada:
- lee `t.discordSpace` (vía el adapter: `discordSpace: t.discordSpace || null`) para el espacio del torneo, con los 10 canales de arriba (`anuncios`, `reglas`, `inscripcion`, `chat-general`, `checkin`, `soporte`, `resultados`, `staff`, `lobby-voz`, `staff-voz`), el rol de staff y el rol de organizador (`discordSpace.organizerRole`, con un botón "Ir al Discord de este torneo" que usa `discordSpace.url`),
- lee `registrations[].discordRoom` para la sala de cada equipo (texto, bracket, voz, rol),
- el texto de la pestaña ya avisa al organizador que "los cambios se publican solos en #anuncios y #reglas" y que un jugador sin Discord vinculado "queda pendiente hasta que vincule su cuenta".

### Esquemas a agregar

`Tournament.discordSpace`:
```js
discordSpace: {
  status:       { type: String, enum: ['pending', 'ready', 'error'], default: 'pending' },
  guildId:      { type: String, default: '' },
  categoryId:   { type: String, default: '' },
  categoryName: { type: String, default: '' },
  url:          { type: String, default: '' },   // https://discord.com/channels/<guild>/<categoryId>
  channels: [{
    key:    { type: String },   // 'anuncios' | 'reglas' | 'inscripcion' | 'chat-general' | 'checkin' | 'soporte' | 'resultados' | 'staff' | 'lobby-voz' | 'staff-voz'
    name:   { type: String },
    type:   { type: String, enum: ['text', 'voice'] },
    channelId: { type: String },
    pinnedMessageId: { type: String, default: '' },   // para reglas/inscripcion, el mensaje que se edita en vez de duplicar
    status: { type: String, enum: ['pending', 'created', 'error'], default: 'pending' },
    desc:   { type: String, default: '' },
  }],
  staffRole: {
    roleId: { type: String, default: '' },
    name:   { type: String, default: '' },
    status: { type: String, enum: ['pending', 'created', 'error'], default: 'pending' },
  },
  organizerRole: {
    roleId: { type: String, default: '' },
    name:   { type: String, default: '' },   // 'organizador-<publicId>'
    status: { type: String, enum: ['pending', 'created', 'error'], default: 'pending' },
  },
  provisionedAt: { type: Date, default: null },
  lastError:     { type: String, default: '' },
}
```

`registrationSchema.discordRoom` (dentro de `Tournament.js`):
```js
discordRoom: {
  status:    { type: String, enum: ['pending', 'created', 'error'], default: 'pending' },
  roleId:    { type: String, default: '' },
  roleName:  { type: String, default: '' },       // slug
  textChannelId:    { type: String, default: '' },
  textName:         { type: String, default: '' },
  bracketChannelId: { type: String, default: '' },
  bracketName:      { type: String, default: '' },
  voiceChannelId:   { type: String, default: '' },
  voiceName:        { type: String, default: '' },
  createdAt: { type: Date, default: null },
  lastError: { type: String, default: '' },
}
```
El front ya consume exactamente estos campos (`status`, `categoryName`, `url`, `channels[].name/type/desc/status`, `staffRole.status`, y del lado de la sala: `status`, `textName`, `bracketName`, `voiceName`, `roleName`) — no hace falta coordinar nombres, solo llenarlos.

### Cómo (resumen técnico)

1. Todo idempotente: si ya existe el id guardado y el canal/rol sigue vivo en Discord, no recrear. Guardar cada id apenas se crea, para poder reanudar si algo falla a mitad.
2. Si la categoría del torneo aún no existe cuando se inscribe un equipo, encolar `ensureTeamRoom` y reintentar después de que `ensureTournamentSpace` termine.
3. El servidor de GlitchGang (guildId) va en env: `DISCORD_GUILD_ID`. El bot necesita permisos `MANAGE_CHANNELS`, `MANAGE_ROLES` y (para el auto-join del punto de OAuth) el scope de bot correspondiente.
4. `mapRegistration` (en `tournament.controller.js`) debe incluir `discordRoom: reg.discordRoom` en lo que devuelve `listRegistrations` — si no, el front nunca ve el resultado aunque el bot ya haya creado todo (tarea chica, un campo).
5. Cuando un resultado de partida se confirma en el bracket, publicar el marcador en el `#<slug>-bracket` del equipo (además de la notificación que ya dispara la tarea del bracket).

**Ruleta:** `TabRuleta` ya usa equipos reales. El modo "Sorteo del bracket" hace `saveBracket(t.id, { seedOrder })` — se persiste con la tarea del bracket (no con esta). No tiene relación con Discord.

---

<a id="check-in-guardar-configuracion"></a>
## [x] 🟡 `updateTournament`: aceptar `checkinConfig`

**Confirmado arreglado (13/sep):** commit `6b68bba` en `master`. `Tournament.checkinConfig` está en el schema y `checkinConfig` quedó mapeado a la pestaña `checkin` en `FIELD_TAB_MAP`, así que ya se guarda.

**En una frase:** falta un campo en el modelo + la lista de campos
permitidos para que la configuración del check-in previo se guarde.

**Qué:** agregar `checkinConfig` como subdoc del modelo y a la lista `allowed` de `updateTournament`.

**Dónde:**
- `backend/src/controllers/tournament.controller.js` → array `allowed` en `updateTournament` (hoy tiene `overcup`, `checkinDeadline`; falta `checkinConfig`).
- `backend/src/models/Tournament.js` → nuevo subdoc.

**Por qué:** la pestaña **Check-in** ya guarda la config del check-in previo con `onSave({ checkinConfig: {...} })`. Sin la entrada en `allowed`, Mongoose lo ignora en silencio (ni error ni guardado) y el organizador cree que guardó cuando no pasó nada.

**Esquema (`Tournament.checkinConfig`):**
```js
checkinConfig: {
  prematchMins:  { type: Number, default: 30, min: 5, max: 180 },
  toleranceMins: { type: Number, default: 10, min: 0, max: 60 },
  autoWalkover:  { type: Boolean, default: true },
  botReminders:  { type: Boolean, default: true },
  dmCaptains:    { type: Boolean, default: true },
},
```

**Cómo:** agregarlo a `allowed`. De paso: cuando cambie `checkinConfig`, `checkinDeadline` o `overcup.secondCheckinDeadline`, disparar la notificación a participantes que ya existe para cambios de calendario (el front ya avisa al organizador que "se notifica a los participantes"). Si el bot de Discord está activo, que reprograme sus recordatorios con los nuevos valores.

---

<a id="torneos-de-un-equipo"></a>
## [x] 🟡 Endpoint nuevo: torneos donde juega un equipo

**Confirmado arreglado (13/sep):** commit `6b68bba` en `master`. `GET /tournaments/by-team/:teamId` existe y está registrado antes de cualquier ruta genérica `/:id`, como hacía falta.

**En una frase:** no existe ninguna forma de preguntarle al backend "¿en qué torneos está inscrito el equipo X?" — hace falta para la pestaña nueva **Enfrentamiento** en `/jugador` y `/mi-equipo`.

**Qué:** `GET /tournaments/by-team/:teamId` → lista de torneos donde ese equipo tiene una inscripción activa.

**Dónde:**
- `backend/src/controllers/tournament.controller.js`: agregar una función nueva, misma forma que `listTournaments`/`getMyTournaments` (usan `sanitizeTournamentIdentityPayload(applyTournamentDefaults(tournament))` sobre cada resultado — reusar eso para no inventar un shape nuevo).
- Query: `Tournament.find({ 'registrations.team': teamId, status: { $in: ['open', 'ongoing'] } }).sort({ date: 1 })`. No hace falta filtrar por `visibility` acá — si el equipo está inscrito, sus jugadores pueden ver el torneo aunque sea privado.
- `backend/src/routes/tournament.routes.js`: `router.get('/by-team/:teamId', requireAuth, getTournamentsByTeam)` — poner ANTES de `router.get('/:id', ...)` si existe una ruta genérica por id, para que Express no intente matchear `by-team` como un `:id`.
- `frontend/src/lib/serverApi.js` ya tiene el cliente listo: `tournamentsApi.byTeam(teamId)` → `GET /tournaments/by-team/:teamId`. Solo falta que el backend responda.

**Por qué:** hoy el `Team` no guarda ninguna referencia a los torneos en los que participa (la relación solo existe del lado del `Tournament`, en `registrations[].team`) y no hay ningún endpoint que la recorra al revés. La pestaña **Enfrentamiento** (`frontend/src/components/TeamMatchups/TeamMatchups.jsx`, usada desde `/jugador/partidas` y `/mi-equipo/enfrentamiento`) necesita justo eso para saber en qué torneo(s) buscar el bracket del equipo — sin este endpoint, la pestaña siempre muestra el estado vacío ("Sin enfrentamientos activos"), nunca puede mostrar el rival real.

**Cómo (forma de respuesta esperada por el frontend):**
```json
{ "tournaments": [ { "_id": "...", "publicId": "...", "title": "...", "game": "...", "format": "single_elimination", "competition": {...}, "status": "ongoing", ... } ] }
```
Mismo shape que ya devuelven `listTournaments`/`getMyTournaments` — no hace falta inventar campos nuevos, el frontend ya sabe leer `format`/`competition`/`title`/`game`/`publicId` de ese shape para resolver el bracket con `bracketStore.matchesForTeam`.

**Nota:** una vez que este endpoint exista, el resto de la pestaña ya funciona sin más cambios de backend — el rival, la ronda y el resultado salen del bracket que ya persiste la tarea de arriba ("Bracket no persiste"), y el horario sale de `results[matchId].scheduledAt` que el organizador ya puede cargar desde el panel (pestaña Bracket → reportar/programar un partido).

---

<a id="staff-avisar-al-agregar"></a>
## [x] 🟡 Staff del torneo: avisar al agregar/quitar después de publicar

**Confirmado arreglado (13/sep):** commit `6b68bba` en `master`. Los 3 endpoints (`POST`/`PATCH`/`DELETE /tournaments/:id/staff`) existen, notifican al agregar y al remover si ya estaba aceptado, y `staffMembers` se sacó de la whitelist del PUT genérico.

**En una frase:** hoy se puede agregar o quitar staff de un torneo ya
publicado, pero a la persona agregada no le llega ningún aviso.

**Qué:** cuando el organizador agrega o quita staff después de publicar (pestaña Colaboradores → "Staff del torneo"), avisar a la persona.

**Dónde:**
- Hoy el front hace `PUT /tournaments/:id` mandando el **array `staffMembers` completo** (ya está permitido en `updateTournament`). Esto persiste bien, pero tiene 3 problemas:
  1. **No notifica** a los nuevos (a diferencia de `createTournament`, que sí manda `type: 'tournament_staff_invite'`).
  2. Sobreescribe el array entero → si dos pestañas guardan a la vez, una pisa a la otra.
  3. No pasa por la validación (`sanitizeStaffMembers`) que sí usa la creación del torneo.

**Por qué:** el frontend ya deja agregar (con el buscador de perfiles reales), cambiar rol y quitar. La persona agregada SÍ aparece en su página de invitaciones (porque ya se busca por `staffMembers.user`), pero sin notificación no se entera a menos que entre a revisar solo.

**Cómo (opción recomendada):** 3 endpoints nuevos en `tournament.controller.js` + `tournament.routes.js`:
- `POST /tournaments/:id/staff` `{ userId, role }` → agrega al miembro con `status: 'pending'`, manda notificación (mismo formato `{ type, title, message, link, meta }` que ya se usa en `createTournament`).
- `PATCH /tournaments/:id/staff/:userId` `{ role }` → cambia solo el rol de ese miembro.
- `DELETE /tournaments/:id/staff/:userId` → quita al miembro; si ya había confirmado, avisarle que fue removido.

Con esos 3 endpoints, sacar `staffMembers` de la lista `allowed` de `updateTournament` (para que no se pueda pisar el array completo) y avisar para actualizar el frontend a usarlos.

Mientras tanto el PUT completo sirve para no bloquear — el único hueco real de cara al usuario es que no llega la notificación.

---

<a id="join-request-sin-id"></a>
## [x] 🟡 Notificación `join_request`: falta el id de la solicitud

**Confirmado arreglado (15/sep):** `team.controller.js` ya guarda `requestId: created._id` en el `meta` de la notificación. Del lado del frontend, `NotificationsContext.jsx` pasó `join_request.respond` a `true` y `Notifications.jsx` (`respondInvite`) ya llama `PATCH /teams/:teamId/requests/:reqId` con `{ accept }` cuando `meta.teamId`/`meta.requestId` están presentes — los botones Aceptar/Declinar del modal de notificación ya funcionan para este tipo.

**En una frase:** el capitán puede recibir la notificación de "fulano quiere unirse al equipo" pero no puede aceptarla/rechazarla desde ahí porque el `meta` no trae el id que pide el endpoint que ya existe.

**Qué:** agregar el id de la solicitud al `meta` de la notificación `join_request`.

**Dónde:**
- `backend/src/controllers/team.controller.js`, función que crea la solicitud (donde hace `team.joinRequests.push({ user: req.user._id, message })` y después `Notification.create({ type: 'join_request', ..., meta: { teamId: team._id, userId: req.user._id } })`).
- El endpoint que ya existe para resolverla es `PATCH /teams/:teamId/requests/:reqId` con body `{ accept: true|false }` (`respondJoinRequest`), y `reqId` es el `_id` del subdocumento dentro de `team.joinRequests` — pero ese `_id` recién se genera al hacer `push`, así que hay que leerlo DESPUÉS del `.save()` (o del `push`, Mongoose ya le asigna `_id` al subdoc en memoria antes de guardar).

**Por qué:** el frontend (`NotificationsContext.jsx` → `INVITE_TYPES.join_request`) ya está listo para mostrar botones reales de "Aceptar"/"Declinar" en esta notificación en cuanto tenga con qué armar la llamada — hoy está marcado `respond: false` justamente por este hueco, así que la notificación sigue cayendo en el estado genérico ("Ver más" / abrir el equipo a mano) en vez de resolverse ahí mismo, aunque visualmente ya tiene categoría e ícono de "equipos".

**Cómo:**
```js
team.joinRequests.push({ user: req.user._id, message: req.body.message || '' })
await team.save()
const created = team.joinRequests[team.joinRequests.length - 1] // ya tiene _id

await Notification.create({
  userId: team.leader,
  type: 'join_request',
  title: 'Solicitud de equipo',
  message: `${req.user.nick} quiere unirse a ${team.name}`,
  link: `/app/teams/${team._id}`,
  meta: { teamId: team._id, userId: req.user._id, requestId: created._id },
})
```
Avisar para que el frontend cambie `join_request.respond` a `true` y arme la llamada `PATCH /teams/${meta.teamId}/requests/${meta.requestId}` con `{ accept }`.

---

<a id="gamerprofile-no-persiste"></a>
## [x] 🟡 `gamerProfile`: no existe en el schema de `User` — se pierde en silencio

**Confirmado arreglado (15/sep):** commit `3a464b3` en `Angel-Gonzalez`. Se
agregó el subdoc completo a `userSchema` (`mainGame`, `secondGame`,
`mainRole`, `rank`, `ranks`, `sensitivity`, `dpi`, `mainCharacters`,
`charactersByGame`, `gameId`) — probado contra Mongo real que el update
sobrevive tanto en `.lean()` como en el shape que devuelve `res.json()`.
De paso, "Rango actual" y "Personajes/agentes principales" pasaron de texto
libre a selección por juego (`ranks`/`charactersByGame` son mapas por
juego; `rank`/`mainCharacters` se mantienen derivados para no romper las
5+ lecturas que ya esperaban un string/array plano).

**En una frase:** el mismo patrón que el bracket y los reportes de torneo
(campo usado por el código pero ausente del modelo → Mongoose strict lo
descarta sin avisar), pero acá afecta a un campo que se lee desde **5
archivos del backend distintos** y se muestra en al menos 6 páginas del
frontend (Perfil, Equipos, Ficha de equipo, Mi Equipo, Dashboard y
Rendimiento del jugador).

**Qué:** que `gamerProfile` (juego principal/secundario, rol, rango,
sensibilidad, DPI, personajes/agentes) sobreviva al guardar y se pueda leer
después.

**Dónde:**
- `backend/src/models/User.js`: el schema **no define `gamerProfile` en ningún lado** — ni como subdoc ni como `Mixed`. Sin `strict: false` en las opciones del schema (no está), Mongoose descarta cualquier campo no declarado antes de escribir a MongoDB.
- `backend/src/services/auth.service.js` línea 71: `gamerProfile: user.gamerProfile,` — lo devuelve en la respuesta de `/auth/login` y `/auth/me` como si existiera (siempre `undefined`).
- `backend/src/controllers/profile.controller.js`: lo incluye en `PUBLIC_FIELDS` (línea 5, para el `select()` de las consultas), lo sanea si viene en el body (líneas 91-95, dedup de `mainCharacters`) y lo tiene en la whitelist de campos editables (línea 233) — es decir, el endpoint `PATCH /profile/me` lo acepta y "guarda" sin error, pero no pasa nada.
- `backend/src/controllers/player.controller.js` línea 154 y 185-187: lee `gamerProfile.rank`/`mainCharacters` con `.select('gamerProfile games')` para armar el rendimiento del jugador — siempre vacío.
- `backend/src/controllers/team.controller.js` líneas 156/189/213/228-230: puebla `gamerProfile` en cada miembro del roster de un equipo (`.populate('members', '... gamerProfile')`) para mostrar el rango/personajes de cada jugador en la ficha del equipo — siempre vacío.
- `backend/src/controllers/bots.controller.js` líneas 213/241: usa `user.gamerProfile?.mainGame` como fallback para el bot de Discord.

**Por qué:** `frontend/src/pages/EditProfile/EditProfile.jsx` (línea ~549) ya tiene el formulario completo — juego principal, juego secundario, rol principal, personajes/agentes, rango, sensibilidad, DPI — y arma exactamente `{ gamerProfile: { mainGame, secondGame, mainRole, mainCharacters, rank, sensitivity, dpi } }` al guardar. El usuario llena el formulario, ve "Guardado" (porque el `PATCH` responde 200), pero al recargar todo vuelve a estar vacío. Esto deja permanentemente en "—" la sección **Ficha de Jugador** de `/perfil`, el rango/personajes de cada jugador en la ficha pública del equipo, y las stats de `PlayerPerformance`/`PlayerDashboard` — no por falta de datos del usuario, sino porque no hay dónde guardarlos.

**Esquema a agregar (`User.gamerProfile`):**
```js
gamerProfile: {
  mainGame:       { type: String, default: '', trim: true },
  secondGame:     { type: String, default: '', trim: true },
  mainRole:       { type: String, default: '', trim: true },
  rank:           { type: String, default: '', trim: true },
  sensitivity:    { type: String, default: '', trim: true },
  dpi:            { type: String, default: '', trim: true },
  mainCharacters: [{ type: String, trim: true }],
  gameId:         { type: String, default: '', trim: true }, // usado por Teams/MyTeamPanel como ID/tag in-game
},
```

**Cómo:**
1. Agregar el subdoc de arriba a `userSchema` en `backend/src/models/User.js`.
2. No hace falta tocar nada más — `auth.service.js`, `profile.controller.js`, `player.controller.js`, `team.controller.js` y `bots.controller.js` ya leen/escriben el shape correcto, solo estaban escribiendo a un campo que Mongoose tiraba a la basura.
3. Los usuarios que ya guardaron su ficha antes de este fix simplemente no tienen esos datos — no hace falta migración, solo que vuelvan a guardar desde Editar Perfil una vez que el campo exista.

---

<a id="calendario-validacion-post-publicacion"></a>
## [x] 🟢 `updateTournament`: validación de calendario demasiado estricta

**Confirmado arreglado (13/sep):** commit `6b68bba` en `master`. La validación de fechas ahora se saltea cuando `tournament.status` es `ongoing`/`finished`/`cancelled`.

**En una frase:** editar la fecha de un torneo que ya empezó o terminó puede
tirar un error de validación que solo tiene sentido para torneos futuros.

**Qué:** que un organizador pueda editar fechas de un torneo ya iniciado/pasado sin quedar bloqueado por reglas pensadas para un torneo que todavía no arrancó.

**Dónde:** `backend/src/controllers/tournament.controller.js` — bloque `if (scheduleChanged && tournament.setupVersion === 1)`.

**Por qué:** la pestaña Config manda las fechas como instante ISO y solo las que cambiaron (correcto). Pero si un torneo `ongoing`/`finished` tiene su `date` en el pasado y el organizador toca `registrationEnd` u otra fecha, la validación puede tirar errores tipo "el cierre debe ser anterior al inicio" que ya no aplican a esa altura del torneo.

**Cómo:** cuando `tournament.status` sea `ongoing`/`finished`/`cancelled`, saltear las validaciones de orden entre fechas (o validar solo el campo que cambió contra sus vecinos, no todo el set). El frontend ya no manda campos sin cambios, así que alcanza con validar puntualmente lo que llegó en `req.body`.

---

<a id="migracion-de-torneos-viejos"></a>
## [x] 🟢 Migración: `gameId` / `seriesId` / `competition` en torneos viejos

**Estado (28/sep):** verificado en local el 18/sep (`toUpdate=0`). Solo queda
correrla contra producción si no se hizo (ver fila del índice).


**En una frase:** el script ya está escrito, solo falta correrlo (con
respaldo antes).

**Qué:** correr la migración que rellena los campos nuevos del asistente de torneos en los documentos `Tournament` existentes.

**Dónde:** `backend/src/scripts/backfill-tournament-identity.js` — ya está escrita. Script npm: `npm run migrate:tournament-identity` (en `backend/`).

**Por qué:** los torneos creados antes del asistente v2 no tienen `gameId`, `seriesId` ni `competition`. Sin eso, el panel del organizador y la vista pública muestran datos vacíos o caen a valores por defecto.

**Cómo:**
1. Respaldo primero: `mongodump --uri "$MONGO_URI" --collection tournaments --out ./backups/pre-identity-$(date +%F)`
2. Dry-run (no escribe nada): `cd backend && node src/scripts/backfill-tournament-identity.js` — lista qué haría y qué torneos tienen un `game` que no matchea el catálogo.
3. Aplicar: `npm run migrate:tournament-identity -- --apply`
4. Revisar a mano los torneos que el dry-run marcó como "sin gameId resuelto".

Es idempotente (no re-escribe lo que ya tiene los campos), así que no pasa nada si se corre dos veces.

---

<a id="uploads-url-absoluta"></a>
## [x] 🟢 `POST /uploads`: devuelve URL absoluta en vez de relativa (rompía las fotos de un post)

**Confirmado arreglado (15/sep):** `upload.controller.js` línea 40 ahora devuelve `/uploads/${name}`, igual que los otros 4 controllers.

**En una frase:** todos los endpoints de subida devuelven una ruta relativa
(`/uploads/avatars/...`, `/uploads/teams/...`, etc.) menos uno — el que usa
el Composer para adjuntar fotos/archivos a un post — que arma una URL
absoluta con el host del propio backend, y esa inconsistencia rompía la
imagen adjunta en el feed.

**Qué:** que `POST /uploads` devuelva `/uploads/<archivo>` como todos los demás, no una URL completa.

**Dónde:**
- `backend/src/controllers/upload.controller.js` línea 40: `const url = \`${req.protocol}://${req.get('host')}/uploads/${name}\`` — es el ÚNICO lugar del backend que arma la URL así. Comparar con `profile.controller.js` (`/uploads/avatars/${req.file.filename}`), `team.controller.js` (`/uploads/teams/...`), `tournament.controller.js` (`/uploads/tournaments/...`) y `messages.controller.js` (`/uploads/messages/...`) — los 4 devuelven solo la ruta, sin protocolo ni host.
- Este endpoint es el que usa `Composer.jsx` (`uploadFileToBase64`) para fotos y archivos adjuntos a un post (`payload.photoUrl` / `payload.fileUrl`).

**Por qué importa:** una URL absoluta autoreferenciada con `req.protocol`/`req.get('host')` asume que el navegador puede llegar directo a como el backend se ve a sí mismo — se rompe apenas hay un proxy/balanceador delante, un dominio distinto para frontend y backend, o simplemente un puerto de dev distinto. El resultado real: al publicar un post con foto, la imagen no cargaba (icono roto + alt "Attachment"), aunque el archivo sí se había guardado bien en el servidor.

**Cómo:** cambiar la línea 40 a `const url = \`/uploads/${name}\`` (mismo patrón que los otros 4 controllers). El frontend ya arma la URL completa donde hace falta con `resolveUploadUrl()` (normaliza cualquier URL de `/uploads/` a ruta relativa al origen actual) — con el backend devolviendo relativa desde el inicio, ese parche pasa a ser puramente defensivo en vez de necesario.

**Nota:** mientras tanto ya agregué `resolveUploadUrl()` en `PostCard.jsx` (no lo tenía, a diferencia de Profile/EditProfile/Sidebar/Topbar/Messages que sí) — las fotos de los posts ya cargan bien aunque este endpoint siga devolviendo la URL absoluta. Esta tarea es para corregirlo en la fuente, no es bloqueante.

---

<a id="token-de-meta-filtrado"></a>
## [~] 🟢 Rotar el token de Meta filtrado

> **3/oct:** `whatsapp-bot-crm/.env.example` ya tiene placeholders (token, verify token y el `curl` de prueba quitado). **Falta (manual):** invalidar el token en Meta — sigue en el historial de git.

**En una frase:** hay una credencial real de Meta commiteada en el repo, hay que invalidarla y reemplazarla por un placeholder.

**Qué:** rotar el token real de la API de Meta que quedó commiteado.

**Dónde:** `whatsapp-bot-crm/.env.example` (rama `whatsapp-bot-crm`).

**Por qué:** es una credencial real en el repo, cualquiera con acceso al código puede usarla.

**Cómo:** invalidar en developers.facebook.com → generar uno nuevo → ponerlo solo en `.env` local (nunca en `.env.example`) → dejar `.env.example` con `META_TOKEN=tu-token-aqui`.

---

<a id="ajustes-cuenta-mejoras"></a>
## [x] 🟢 Ajustes de cuenta: 2 mejoras opcionales

> **1 hecho (3/oct):** `POST /auth/change-password { currentPassword, newPassword }` (mín. 8, distinta de la actual, cierra las demás sesiones y deja viva la actual). Ajustes → Seguridad tiene el formulario; el enlace por correo queda para quien no recuerda la actual. **2:** `allowDMs` ya se aplica; `allowTeamInvite` no tiene a qué aplicarse (no hay invitación directa por líder).

**En una frase:** repasé Ajustes → Cuenta/Seguridad/Privacidad; casi todo lo
que estaba fingiendo funcionar (contraseña, 2FA, sesiones, soporte) ya lo
conecté a endpoints reales que **ya existían** en el backend y no se estaban
usando (`/auth/2fa/*`, `/auth/sessions`, `/system-tickets`, `PATCH /profile/me`).
No hay nada roto que arreglar aquí — estas dos son mejoras si hay tiempo.

**1. Cambiar contraseña sin salir de la sesión.** Hoy "Cambiar contraseña" en Ajustes manda un enlace por correo (`POST /auth/forgot-password`) porque no existe un endpoint de "contraseña actual + nueva" para un usuario ya logueado — solo está el flujo de reseteo por token. Si se quiere el flujo instantáneo típico, agregar `POST /auth/change-password` `{ currentPassword, newPassword }` (verifica el hash actual, actualiza, opcionalmente revoca otras sesiones) y el frontend lo cambia por el enlace.

**2. Más campos de privacidad.** `User.privacy` ya tiene `publicProfile`, `showStats`, `showGames`, `allowFriends` (los conecté en Ajustes → Privacidad). Pero el frontend también tenía toggles para "mensajes directos" y "invitaciones a equipos" que no tienen campo real — quedaron como preferencia local (`localStorage`) con una nota visible al usuario. Si se quiere que de verdad afecten quién puede escribirte o invitarte, agregar `allowDMs`/`allowTeamInvite` (o similares) a `User.privacy` y que los controllers de mensajes/invitaciones los respeten.

---

<a id="editar-nombre-apellido"></a>
## [x] 🟢 Editar Perfil: no hay forma de cambiar nombre y apellido

**Confirmado arreglado (15/sep):** `firstName`/`lastName` ya están en el array `allowed` de `updateProfile` (con `trim()`), y `EditProfile.jsx` agregó los 2 campos de texto en la pestaña Identidad (`form.firstName`/`form.lastName`, `maxLength` 60/80 igual que el schema), enviados en el payload de `saveProfile`.

**En una frase:** `User.firstName`/`lastName` son obligatorios y se cargan
una sola vez en el registro, pero después no hay ningún lado (ni frontend
ni backend) donde la persona pueda corregirlos si se equivocó o quiere
actualizarlos.

**Qué:** agregar `firstName` y `lastName` a los campos editables de `PATCH /profile/me`.

**Dónde:**
- `backend/src/controllers/profile.controller.js` → array `allowed` en `updateProfile` (línea ~228): no incluye `firstName` ni `lastName`, así que aunque el frontend los mandara, Mongoose los ignoraría en silencio (`req.body[key] !== undefined` nunca se evalúa para esas claves).
- `frontend/src/pages/EditProfile/EditProfile.jsx`: revisé la pestaña **Identidad** a fondo — no tiene ningún campo para nombre/apellido. El nombre "legal" que se ve en la tarjeta ID (`playerCardPreview.legalName`) sale directo de `user.firstName`/`user.lastName`, fijos desde el registro.

**Por qué:** no es urgente (nada se rompe), pero es una limitación rara para el usuario — no hay forma de arreglar un typo en su propio nombre real sin pedirle a alguien que edite la base de datos a mano.

**Cómo:**
1. Agregar `'firstName', 'lastName'` al array `allowed` en `updateProfile` (con `trim()` igual que `nick`/`countryCode` en `normalizeProfileUpdates`, y quizás un `maxlength` acorde al schema: 60/80).
2. Avisar para que el frontend agregue los 2 campos de texto en la pestaña Identidad (`form.firstName`/`form.lastName`, ya hay espacio en `ep-form-grid`) y los mande en el payload de `saveProfile`.

---

<a id="publicacion-programada"></a>
## [x] ✅ Publicación programada de torneos (cron)

**Arreglado (18/sep):** `scheduledPublishAt` ya existe en el schema, el job
de publicación programada corre cada 2 min (`scheduledPublish.service.js`) y
el paso 5 de `TorneoCrear.jsx` ya permite elegir la fecha.

**En una frase:** ya se puede crear un torneo sin publicarlo (queda como
`status: 'draft'`); falta la otra mitad, que es elegir una fecha/hora y que
se publique solo, sin que nadie tenga que entrar a apretar el botón.

**Qué:** que un torneo en borrador se pueda programar para publicarse solo en una fecha/hora elegida.

**Dónde:**
- `frontend/src/pages/TorneoCrear/TorneoCrear.jsx`: hoy el paso 5 tiene "Publicar torneo" (inmediato) y "Crear sin publicar" (`status: 'draft'`, `visibility: 'private'`). No hay todavía un tercer botón/campo de "programar para tal fecha" — eso también es trabajo de frontend cuando se retome.
- Backend: no existe ningún cron/job que revise torneos en `draft` y los publique.

**Por qué:** pensado sobre todo para organizadores con torneos semanales recurrentes — armar la plantilla una vez y que salga publicada sola cada semana sin tener que volver a entrar.

**Cómo (propuesta):**
1. Agregar `Tournament.scheduledPublishAt: { type: Date, default: null }`.
2. Cron (node-cron o agenda, lo que ya se use en el proyecto si hay algo) corriendo cada 1-5 min: `Tournament.updateMany({ status: 'draft', scheduledPublishAt: { $lte: new Date() } }, { $set: { status: 'open', visibility: 'public' } })` — o, si hace falta más lógica al publicar (notificar, avisar a Discord), iterar uno por uno y reusar lo que ya hace `createTournament`/`updateTournament` al pasar a `open`.
3. Notificar al organizador cuando se publica solo (mismo formato `{ type, title, message, link, meta }`).
4. Si se quiere de verdad "recurrente" (que se vuelva a crear cada semana, no solo publicarse una vez), es una tarea más grande — de momento con programar una sola fecha ya cubre el caso pedido ("tenerlo pre hecho y que se publique solo").

---

<a id="coach-hq-backend"></a>
## [x] Coach HQ: persistencia real de perfil profesional y planes de trabajo

> **Hecho (4/oct):** perfil (`PATCH /profile/me`, role coach) y equipos (`/teams/staff/mine?role=coach`) ya existían. Nuevo `CoachWorkPlan` + `/api/coach/work-plans` (listar, crear, editar/archivar, `/:id/send` avisa al capitán, `/team/:teamId` para el equipo sin notas privadas y marca "visto" si lo abre el líder, `/:id/approve` del capitán avisa al coach). Editar el contenido de un plan enviado lo vuelve a borrador. `CoachDashboard.jsx` ya guarda/envía al servidor con selector de equipo. Verificado contra Mongo real (20/20). Vista del capitán hecha (4/oct): `/mi-equipo/planes` (`components/TeamCoachPlans`), con aprobar y los avisos `coach_work_plan`/`coach_work_plan_approved` con plantilla propia.

**En una frase:** el panel de coach ya permite editar perfil profesional, preparar un plan de trabajo y marcarlo como enviado, pero por ahora se guarda localmente en el navegador; falta backend para que sea colaborativo y visible para equipos.

**Que debe persistir:**
- Perfil profesional del coach: nombre publico, juego principal, disponibilidad, tarifa, portafolio, enfoque y metodologia.
- Asignaciones de coach a equipos: cuando un equipo selecciona un coach aprobado, ese coach debe ver el equipo en `/coach/jugadores`.
- Planes de trabajo: equipo, juego, roster, torneo, proximo enfrentamiento, rival, objetivo semanal, plan de estudio, sesion/practica, tareas y notas.
- Estado del plan: borrador, enviado, recibido/visto por capitan, aprobado, archivado.
- Historial de envios por equipo y por torneo.

**Endpoints sugeridos:**
- `GET /api/coach/profile`
- `PATCH /api/coach/profile`
- `GET /api/coach/teams`
- `GET /api/coach/work-plans?teamId=&status=`
- `POST /api/coach/work-plans`
- `PATCH /api/coach/work-plans/:id`
- `POST /api/coach/work-plans/:id/send`

**Modelo sugerido:** `CoachWorkPlan`
- `coach`: ObjectId User
- `team`: ObjectId Team
- `tournament`: ObjectId Tournament opcional
- `game`, `rosterSnapshot`, `nextMatch`, `opponent`
- `weekGoal`, `studyPlan`, `sessionPlan`, `homework`, `notes`
- `status`: `draft | sent | seen | approved | archived`
- `sentAt`, `seenAt`, `approvedAt`

**Nota de frontend:** mientras esto no exista, `frontend/src/pages/coach/CoachDashboard/CoachDashboard.jsx` usa `localStorage` por usuario para que el coach si pueda trabajar ahora mismo sin fingir backend.

---

<a id="staff-invitations-reason"></a>
## [x] Staff invitations: persistir motivo/respuesta opcional

> **Hecho (3/oct):** `responseReason` (≤600) se guarda en `respondStaffInvitation` y se muestra bajo el estado en Colaboradores.

**En una frase:** el frontend ya muestra invitaciones profesionales con aceptar/rechazar y un mensaje opcional; el backend ya recibe `reason` y lo incluye en la notificacion al organizador, pero falta persistirlo formalmente en el modelo.

**Que falta:**
- Agregar campos a `Tournament.staffMembers`: `responseReason`, `invitedAt`, `respondedAt` ya existe.
- Guardar `responseReason` al responder `PATCH /api/tournaments/:id/staff/response`.
- Mostrar ese mensaje en la vista de staff del organizador y en el historial de respuestas.
- Permitir filtrar/resolver invitaciones por rol/panel si se quiere separar caster, produccion, moderacion, analista y coach.

---

<a id="pagos-no-hay-pasarela-real"></a>
## [~] 🔴 Pagos: no hay pasarela real ni cartera de organizador — no debe permitirse cobrar

**Actualizado (15/sep):** esto resultó ser dos problemas distintos que se investigaron juntos.

**1. El candado puntual que pedía este item — hecho.** `createTournament` y `updateTournament` rechazan con 400 cualquier `entryFee > 0` (backend, no solo UI). Sigue pendiente el punto 2 de "Cómo" (decidir Transferencia) y los puntos 3-4 (Wallet, Finanzas) — ver más abajo.

**2. Regresión más grande que esto — encontrada y restaurada.** Mientras investigaba el candado, encontré que **todo el sistema de pagos real (PayPal) que se había construido en el commit `b26791b` ("conecta PayPal como pasarela real") se perdió** en el merge `837df36` ("Merge remote-tracking branch 'origin/main' into Angel-Gonzalez", 30/ago) — el conflicto en `payment.controller.js` se resolvió a favor del lado viejo (demo con JSON plano), `backend/src/models/Order.js` y `backend/src/config/billingPlans.js` se borraron, y `payment.routes.js` quedó desmontado de `routes/index.js`. El frontend (`PayPalCheckoutButton.jsx`, `PaymentMethods.jsx`, `TournamentCheckout.jsx`, `Checkout.jsx`) nunca se tocó y seguía esperando exactamente la forma de respuesta del sistema real (`{ order, paypalOrderId }`, `providers.paypal.configured`, etc.) — quedó huérfano, no roto por diseño.

**Restaurado hoy** (`backend/src/services/paypal.service.js` ya existía intacto, no se tocó):
- `backend/src/config/billingPlans.js` — catálogo de precios, único origen de verdad para cuánto cuesta cada plan (nunca se confía en `req.body.amount`).
- `backend/src/models/Order.js` — modelo real de Mongo para órdenes.
- `backend/src/controllers/payment.controller.js` — reconstruido completo: `paymentConfig` (shape `providers.{stripe,paypal,transfer}` que el frontend espera), `createOrder` (calcula el monto SIEMPRE en el servidor — de `Tournament.entryFee` o de `billingPlans.js`, nunca del cliente), `capturePaypalOrder` (captura server-to-server, única fuente de verdad del cobro), `listOrders`, `verifyOrder` (público, para el QR del comprobante), `cancelSubscription`, webhooks de Stripe/PayPal.
- `backend/src/routes/payment.routes.js` — restaurado con los 8 endpoints reales, y **montado en `routes/index.js`** (`/payments/*` ya no da 404).
- `.env.example` — documentadas `PAYPAL_CLIENT_ID/SECRET/ENV/WEBHOOK_ID` y las de Stripe (quedan vacías; sin ellas todo corre en modo DEMO, no bloquea nada).

**De paso, conecté las 3 páginas cuyo ÚNICO propósito es mostrar/verificar estos pagos reales** (estaban deshabilitadas a propósito desde antes — `paymentsStore.js` → `loadPayments()` devuelve `[]` y `getPaymentByCode()` devuelve `null` siempre, con un `console.warn` diciendo "Usa /payments/checkout" — esperaban este mismo backend):
- `MyPayments.jsx` ("Mis comprobantes") — ahora trae `paymentsApi.orders()` real en vez de la lista local vacía.
- `TicketView.jsx` (`/comprobante/:code`) — ahora busca la orden real por id en vez de `getPaymentByCode()` (siempre `null`).
- `PaymentVerify.jsx` (`/verificar`) — antes validaba con un checksum armado en el propio navegador ("sin conexión a servidor", literal en el texto de la página — cualquiera podía fabricar un código con el checksum correcto); ahora llama `GET /payments/orders/:id/verify` de verdad. Se agregó `paymentsApi.verify()` en `serverApi.js`.

**Quedó pendiente, no tocado (mismo dominio, menor prioridad):**
- Decidir qué hacer con el método "Transferencia" en `PaymentMethods.jsx` — hoy es un panel demo con QR decorativo y cuenta bancaria inventada, nota explícita "Demo: se valida al instante". No hay ningún flujo de "subir comprobante + admin lo marca pagado" en el código actual (la descripción original de este item lo daba por existente; no existe).
- `AdminValidacion.jsx` (`verifyCode` de `paymentsStore.js`, rama `GG-` del escáner) — sigue en el formato de checksum viejo, incompatible con los ids reales (`ord_...`). Es una pieza chica de un escáner admin mucho más grande (también valida jugadores y facturas con datos estáticos) — no lo toqué para no abrir ese frente aparte.
- `TorneoDetalle.jsx` / `TournamentCheckout.jsx` (`getPaymentByTournament`) — sigue devolviendo siempre "no pagado" (falla seguro, nunca falso-positivo). Bajísima prioridad ahora mismo porque con el candado de arriba `entryFee` siempre es 0, así que ningún torneo real tiene nada que pagar todavía.
- `Settings.jsx` (tab Facturación), `AdminUsers.jsx` (historial de pagos del jugador en `PlayerDetail`), `systemExport.js` (exportación admin) — todavía llaman `loadPayments()` (vacío). Son vistas de solo lectura, no mueven dinero; quedan para cuando se retome este dominio.
- Puntos 3-4 de "Cómo" abajo (Wallet del organizador, reconstruir la página Finanzas) — siguen "más adelante", sin cambios.

Con las rutas montadas y el flujo de Plan Pro/Team funcionando de punta a punta contra PayPal real (en cuanto se configuren las credenciales), lo que faltaba de "conectar cables" en este dominio quedó resuelto — lo que queda es trabajo de producto (Wallet, decisión sobre Transferencia), no más regresión.

**En una frase:** hoy se puede crear un torneo con cuota de inscripción y "cobrar" por transferencia bancaria (comprobante + marcar pagado a mano) sin ninguna pasarela real de por medio, y el premio en dinero que promete un organizador no está respaldado por ningún saldo — dos cosas que pueden meternos en problemas legales/financieros si un jugador paga y algo sale mal, o un organizador promete un premio que no tiene. Mientras tanto el frontend ya deja el costo de inscripción fijo en $0, pero eso no evita que alguien le pegue directo a la API.

**Qué:**
1. **No permitir cobrar inscripción** a ningún torneo hasta tener pasarela real (Stripe/PayPal configurados y probados) para AMBOS lados: el jugador que paga y el organizador que recibe (hoy no hay ni una cosa ni la otra).
2. **Cartera del organizador para financiar premios:** si un organizador anuncia $200 en premio, eso debería salir de un saldo propio que él cargó de antemano (y puede aumentar si quiere ofrecer más), no de un campo de texto libre sin respaldo. Hoy `prizePool` es un número que el organizador escribe y nada lo verifica.

**Dónde:**
- `backend/src/controllers/payment.controller.js`: `createOrder` ya bloquea tarjeta/PayPal cuando no hay `STRIPE_SECRET_KEY` (devuelve 503 "Pagos reales no configurados") — eso está bien. Pero también hay un método **"Transferencia"** (`frontend/src/components/PaymentMethods/PaymentMethods.jsx`) que no pasa por Stripe/PayPal en absoluto: el jugador sube un comprobante y alguien lo marca "pagado" a mano — ahí sí puede circular dinero real hoy mismo sin ninguna pasarela ni forma de disputar/reembolsar. Revisar `TournamentCheckout.jsx` y el flujo de comprobantes para confirmar el alcance exacto.
- `backend/src/controllers/tournament.controller.js` (`createTournament` / `updateTournament`): no valida `entryFee` en absoluto — acepta cualquier número. Falta rechazar o forzar a 0 cuando `entryFee > 0` y no haya pasarela real, igual que ya hace `createOrder` con las tarjetas.
- `frontend/src/pages/TorneoCrear/TorneoCrear.jsx` (paso 3, "Costo de inscripción"): ya lo dejé deshabilitado y fijo en $0 con una nota explicando por qué, y el payload de creación fuerza `entryFee: 0` sin importar lo que tenga el formulario. Esto es solo un candado de UI — cualquiera que le pegue directo a `POST /api/tournaments` todavía puede mandar `entryFee` positivo porque el backend no lo rechaza.
- No existe ningún modelo de "cartera"/saldo de organizador (ni `Wallet`, ni `User.roleProfiles.organizer.balance`, nada). `prizePool` en `TorneoCrear.jsx` (paso 3, "Total en dinero") es un número libre que no se compara contra nada.
- Borré `frontend/src/pages/organizer/OrganizerFinances/` (la página "Finanzas" del panel de organizador) porque mostraba montos 100% inventados (`TEAM_NAMES` hardcodeado, torneos de `data/organizerTournaments.js` en vez de los reales) simulando que ya se estaban cobrando inscripciones — no estaba conectada a ningún dato real y ni siquiera estaba enlazada en el sidebar, así que confundía más de lo que ayudaba. Cuando exista pasarela real + cartera, esta página se puede reconstruir contra endpoints reales (registros pagados de `GET /tournaments/:id/registrations`, órdenes de `GET /payments/orders`, etc.).

**Por qué:** aceptar dinero de un jugador (aunque sea "solo" por transferencia con comprobante) sin pasarela real significa que GlitchGang no tiene forma de procesar reembolsos, disputar un cobro, ni demostrar que el dinero efectivamente llegó — si un torneo se cancela o un comprobante es falso, es un problema legal/financiero directo para la plataforma, no solo un bug. Del otro lado, dejar que un organizador prometa un `prizePool` sin respaldo es la misma clase de riesgo pero al revés (la plataforma queda mal si el organizador no paga lo prometido).

**Cómo (propuesta):**
1. Backend, ya: en `createTournament`/`updateTournament`, si `entryFee > 0` responder 400 ("Cobro de inscripción no disponible todavía") o forzar el valor a 0 — igual de estricto que `createOrder`. Aplica también a `registerTeam`/checkout: que no se pueda avanzar un registro "pagado" por transferencia sin pasar por una pasarela real.
2. Backend, ya: decidir qué hacer con el método "Transferencia" en `PaymentMethods.jsx` / el flujo de comprobantes — lo más simple es ocultarlo del todo hasta que haya pasarela real, ya que hoy es la única vía por la que puede circular dinero real sin control.
3. Backend, más adelante (cuando se resuelva pasarela real): diseñar `Wallet` (o campo en `User.roleProfiles.organizer`) con saldo + historial de cargas; al crear/editar un torneo, validar `prizePool <= walletBalance` y reservar ese monto; liberar si el torneo se cancela.
4. Cuando esto exista de verdad, reconstruir la página "Finanzas" del organizador (borrada en este cambio) contra datos reales en vez de simulados.

---

<a id="registro-actividad-staff"></a>
## [x] ✅ Registro de actividad del staff por torneo (quién hizo qué)

**Arreglado (18/sep):** `TournamentAuditLog` + `GET
/tournaments/:id/audit-log` ya existen, y el panel de Actividad lee datos
reales. Los endpoints principales de escritura registran acciones con
`logTournamentActivity`.

**En una frase:** un torneo puede tener varias personas de staff (Director, Administrador, Árbitro, Moderador, Caster, Producción) con acceso a distintas partes del panel, pero el organizador no tiene forma de ver qué hizo cada uno — no existe ningún registro de auditoría, ni en el modelo ni en ningún endpoint.

**Qué:** un log de actividad por torneo que el organizador pueda ver: quién (qué usuario/rol), qué acción, en qué pestaña/recurso, y cuándo.

**Dónde:**
- No existe nada parecido a esto hoy. Lo más cercano en el repo es `frontend/src/lib/exportLog.js`, pero es un log **en memoria del navegador** (`memoryLogs`, se pierde al recargar) para exportaciones del panel de admin — ni siquiera es del organizador ni persiste, así que no sirve de base, solo de referencia de formato (`{ id, user, role, action, entity, recordId, date, time, ip }`).
- Agregué una pestaña propia "Actividad" (`frontend/src/data/organizerManageTabs.js`, clave `actividad`, grupo "Soporte") con su componente `TabActividad` en `OrganizerTournamentManage.jsx` — vista previa "fantasma" (columnas + filas con `—`, sin datos inventados) explicando que es pendiente de backend. No la agregué a `ROLE_DEFAULT_ACCESS` en `staffPermissions.js` a propósito, así que por defecto solo la ve dueño/admin (el fallback de `roleDefaults()` la deja en `'none'` para todo el staff) — tiene sentido, es visibilidad para quien organiza, no algo que cada Caster/Árbitro necesite ver de los demás.

**Por qué:** en cuanto un torneo tiene más de una persona con acceso de edición (lo cual ya es posible hoy vía el sistema de permisos por pestaña — ver [#permisos-staff-backend](#permisos-staff-backend)), el organizador pierde visibilidad de quién cambió qué. Si un Árbitro reporta mal un resultado o un Administrador borra un sponsor, hoy no hay forma de saber quién fue. Esto también es la base para que el registro de permisos (arriba) sea auditable: no solo "qué puede ver/editar cada quién" sino "qué editó cada quién, de verdad".

**Modelo sugerido:** `TournamentAuditLog` (colección aparte, no embebida en `Tournament` para no inflar el documento)
- `tournament`: ObjectId Tournament
- `user`: ObjectId User
- `role`: string (rol de staff en ese torneo al momento de la acción — copiarlo, no solo referenciarlo, porque el rol puede cambiar después)
- `action`: string (`update`, `create`, `delete`, `respond`, etc.)
- `tabKey`: string (una de `MANAGE_TAB_KEYS` — bracket, checkin, marca, colaboradores, etc., o `null` si no aplica)
- `summary`: string corto para mostrar en la lista (ej. "Actualizó el prize pool de $500 a $750")
- `meta`: Mixed, opcional, para el detalle específico de la acción
- `createdAt`: Date

**Endpoints sugeridos:**
- `GET /api/tournaments/:id/audit-log?tabKey=&userId=&limit=&cursor=` — paginado, solo owner/admin/staff con acceso `edit` en la pestaña correspondiente pueden verlo (mismo `assertTabAccess` de la tarea de permisos, con `'view'` como mínimo).
- Cada endpoint de escritura que ya pasa por `assertTabAccess`/`assertCanManageTournament` (`updateTournament`, `saveBracket`, `createReport`, etc.) debería, al final de un guardado exitoso, escribir una entrada — lo más simple es un helper `logTournamentActivity(tournament, user, { action, tabKey, summary })` que se llama una vez por endpoint relevante, no un middleware genérico (cada endpoint sabe mejor que nadie cuál es el resumen legible de lo que cambió).

**Cómo (propuesta):**
1. Crear el modelo/colección de arriba.
2. Escribir el helper `logTournamentActivity(...)` y llamarlo desde los endpoints de escritura del torneo, empezando por los que ya tienen `assertTabAccess` (así se reusa el mismo mapeo endpoint→tabKey de esa tarea).
3. Agregar el endpoint `GET /api/tournaments/:id/audit-log`.
4. Avisar para que el frontend reemplace el estado "pendiente" en `TabColaboradores` (sección "Actividad reciente") por la lista real.

---

<a id="jugador-stats-sin-pipeline"></a>
## [x] 🟡 Panel de jugador: los endpoints de stats existen, pero nada los llena solo

**Arreglado (23/sep, commit `ffefcbc`):** `saveBracket` detecta partidas que pasan a `confirmed:true` por primera vez y crea un `PlayerMatch` (source:`'tournament'`) por cada jugador del roster de ambos equipos, resolviendo win/loss/draw por nombre/tag de equipo. Marca `statsProcessed` para no duplicar en re-guardados. Deliberadamente NO toca `Team.rankPts`/`User.gp` (sistema de ranking/ELO aparte, no existe todavia). Probado con script contra Mongo real.

**En una frase:** `PlayerMatch` y `PlayerTournamentResult` ya tienen modelo,
endpoints de lectura (`stats/games`, `activity/weekly`, `stats/daily`,
`characters/top`, `tournaments`, `matches`) y hasta agregaciones armadas —
pero la ÚNICA forma de crear un registro es un `POST` manual que **ningún
lugar del frontend llama todavía**. No hay formulario de "cargar mi
partida" en ningún panel, y tampoco hay nada que tome el resultado real de
un torneo (bracket ya jugado) y genere esos registros solo. Para cualquier
jugador real hoy, esos endpoints van a devolver vacío para siempre, y todo
lo que el frontend de Rendimiento/Historial/Dashboard ya sabe mostrar
cuando hay datos reales, va a caer siempre al mock.

**Qué:** que el resultado real de un torneo (o una carga manual) termine
generando estadísticas de carrera del jugador.

**Dónde:**
- `backend/src/controllers/player.controller.js` → `createMyMatch` /
  `createMyTournamentResult`: son los ÚNICOS lugares de todo el backend
  donde se crea un `PlayerMatch`/`PlayerTournamentResult`.
  `PlayerMatch.source` incluso tiene un enum `['manual', 'tournament',
  'import']` pensando en esto — pero nada usa `'tournament'` ni
  `'import'`, solo existe el camino `'manual'`, y nada lo dispara.
- No hay ningún hook en `tournament.controller.js` que, al confirmarse un
  resultado del bracket (`saveBracket` con `results[matchId].confirmed
  === true`) o al terminar el torneo (`status: 'finished'` + `champion`),
  cree/actualice `PlayerMatch` por cada jugador del roster ni
  `PlayerTournamentResult` por equipo.
- Del lado del frontend: revisé y ningún componente llama `POST
  /players/me/matches` ni `POST /players/me/tournaments` — no existe
  ningún formulario de "cargar partida/resultado" en ningún panel de
  jugador.

**Por qué:** hoy mejoré `PlayerDashboard.jsx` para mostrar más métricas
reales (racha, ganancias de carrera, resultados en torneos, actividad de
14 días) y ya piden estos endpoints correctamente — pero sin este
pipeline, NINGÚN jugador real va a tener nunca datos reales ahí, sin
importar cuántos torneos juegue de verdad en la plataforma. Todo el
sistema de "rendimiento" queda cosmético (mock silencioso, nunca se nota
que está vacío porque el mock lo tapa) hasta que esto exista.

**Cómo (dos caminos, no excluyentes):**
1. **Automático (el que de verdad resuelve el problema):** cuando se
   confirma un resultado en el bracket (ver tarea del bracket, punto 3)
   o el torneo pasa a `finished`, generar `PlayerMatch` (uno por jugador
   del roster de cada equipo, `source: 'tournament'`, con `tournament`,
   `team`, `result`, `game`, y lo que se pueda inferir del marcador) y
   `PlayerTournamentResult` (uno por jugador, `placement` sacado del
   bracket/standings finales). Es lo único que hace que las stats
   reflejen la actividad real de la plataforma sin pedirle nada a nadie.
2. **Manual (complementario, más rápido de construir):** un formulario
   simple en `/jugador/partidas` o `/jugador/rendimiento` para que el
   jugador cargue sus propias partidas/resultados sueltos (scrims,
   torneos externos) — usa los `POST` que ya existen, solo falta la UI.

La opción 1 es la que resuelve el problema de fondo para torneos jugados
en GlitchGang; la 2 sirve de complemento para lo que pasa fuera de la
plataforma. Sin al menos una de las dos, todo lo demás de esta lista
(logros, radar, rating) tampoco tiene con qué llenarse.

---

<a id="jugador-equipos-anteriores"></a>
## [x] 🟡 "Equipos anteriores": filtro muerto, no hay historial de membresía

**Arreglado (23/sep, commit `6c20471`):** nuevo modelo `TeamMembershipHistory` (snapshot de nombre/tag/logo/color/juego + rol + motivo `left`/`disbanded` + fecha, el `team` ref queda null si el equipo se disolvió). `leaveTeam` registra tanto un self-leave como un disband; `deleteTeam` (que a diferencia de `leaveTeam` no exigía el roster vacío) ahora registra a todos los afectados, no solo a quien llama. Nuevo `GET /teams/mine/history`. `PlayerTeams.jsx` (`mapFormerTeam`) muestra estos equipos sin inventar roster/winrate (el equipo puede ya no existir) y sin ofrecer "Ver página pública"/"Panel" (no hay nada real que gestionar ahí). Probado con script contra Mongo real (4 escenarios), usando usuarios sin equipo previo para no tocar datos reales por accidente.

**En una frase:** `/jugador/equipos` tiene un filtro "Anteriores" en la UI,
pero el backend no tiene ningún concepto de "ex miembro de un equipo" — el
frontend fuerza `status: 'active'` a TODOS los equipos que trae
`/teams/mine`, así que ese filtro nunca puede mostrar nada, sin importar
cuántos equipos haya dejado el jugador.

**Dónde:**
- `frontend/src/pages/player/PlayerTeams/PlayerTeams.jsx` (`mapTeam`):
  `status: 'active'` está hardcodeado, no viene de ningún campo del
  backend.
- `backend/src/models/Team.js`: el único `status` que existe es el de
  invitaciones (`pending/accepted/rejected`), no hay ningún registro de
  cuándo un jugador salió de un equipo ni de equipos "anteriores".

**Por qué:** el filtro visualmente ya está construido — cualquier jugador
que lo toque esperando ver un equipo viejo no va a ver nada, sin ningún
aviso de que es porque falta backend.

**Cómo (propuesta):**
1. Guardar historial cuando alguien sale de un equipo (o lo expulsan):
   subdoc `Team.formerMembers: [{ user, role, joinedAt, leftAt, reason }]`
   (se mueve ahí desde `members` al salir, en vez de solo hacer `$pull`).
2. `GET /teams/mine` devuelve también los equipos donde el usuario
   aparece en `formerMembers` de alguien, con `status: 'former'` y las
   fechas — el frontend ya sabe pintar eso, solo necesita el campo real.

---

<a id="jugador-achievements-mock"></a>
## [x] 🟢 Logros del jugador — 100% inventado, no hay modelo

> **Hecho (3/oct):** la sección Logros de `/jugador` usa `ACHIEVEMENT_CARDS` (`data/cosmetics.js`) y las marca desbloqueadas según `user.cosmeticUnlocks` (títulos oficiales, etc.). `PLAYER_ACHIEVEMENTS` ya no se usa.

**En una frase:** la sección "Logros" de `/jugador` (y el badge "Trofeos"
del hero) es un array fijo en el frontend (`PLAYER_ACHIEVEMENTS`), igual
para cualquier jugador que abra la página — no existe ningún modelo ni
lógica de desbloqueo en el backend.

**Dónde:**
- `frontend/src/data/playerStats.js` → `PLAYER_ACHIEVEMENTS`: 7 logros
  hardcodeados, los mismos para cualquier usuario.
- No existe ningún modelo `Achievement` ni `UserAchievement` en
  `backend/src/models/`.

**Por qué:** ahora mismo cualquier jugador nuevo ve "Campeón GG Winter
Cup", "Inmortal", "Racha de 10" ya desbloqueados sin haber jugado nada —
no es un estado vacío/pendiente honesto, es un dato falso mostrado como
si fuera del usuario.

**Cómo (propuesta):**
1. Modelo `Achievement` (catálogo fijo: id, nombre, descripción, ícono,
   condición) + `User.unlockedAchievements: [{ achievementId,
   unlockedAt }]`.
2. Un evaluador que corra cuando cambian los datos relevantes (nueva
   racha, nuevo `PlayerMatch`, nuevo `PlayerTournamentResult`) y
   desbloquee lo que corresponda — depende de que primero exista el
   pipeline de stats reales ([#jugador-stats-sin-pipeline](#jugador-stats-sin-pipeline)), si no no hay con qué evaluar las condiciones.
3. Mientras tanto, si se prefiere un estado honesto sin esperar todo
   esto, el frontend puede mostrar la sección vacía/"Próximamente" en vez
   de datos inventados — es un cambio chico del lado del front cuando se
   decida.

---

<a id="jugador-mapas-radar"></a>
## [x] 🟢 Rendimiento por mapa y Radar de habilidades — sin backend

> **Hecho (3/oct):** `getMapStats` agrupa `PlayerMatch` por `map` (filtra por juego). `/jugador/rendimiento` lo pide por juego. El radar no tiene fuente de datos: muestra un estado vacío honesto. De paso: sin partidas, la página rellenaba winrate/KDA/rango/personajes con `GAME_STATS`/`TOP_PICKS` de ejemplo; ahora todo sale en cero o vacío.

**En una frase:** en `/jugador/rendimiento`, la sección de mapas y el
radar de habilidades muestran siempre los mismos 5 mapas de Valorant y
las mismas 6 métricas de habilidad, sin importar el juego seleccionado ni
quién sea el jugador — son arrays fijos (`MAP_STATS`, `SKILL_RADAR`) en
el frontend.

**Dónde:**
- `frontend/src/pages/player/PlayerPerformance/PlayerPerformance.jsx`:
  usa `MAP_STATS`/`SKILL_RADAR` de `playerStats.js` directo, sin pedir
  nada a la API, y no cambian al cambiar de juego arriba.
- `backend/src/models/PlayerMatch.js` SÍ tiene el campo `map` por
  partida — el rendimiento por mapa es calculable con lo que ya existe
  (misma idea que `getGameStats`, pero agrupando por `map` en vez de por
  `game`), solo falta el endpoint.
- El radar de habilidades es distinto: no existe NINGÚN campo en ningún
  modelo para "puntería", "game sense", "clutch", "comunicación", etc. —
  no hay de dónde sacarlo hoy, ni siquiera con el pipeline de stats
  resuelto.

**Por qué:** rendimiento por mapa es una mejora chica y barata una vez
que exista el pipeline de partidas reales
([#jugador-stats-sin-pipeline](#jugador-stats-sin-pipeline)). El radar de
habilidades es una decisión de producto antes que de código: o se inventa
una fórmula que lo derive de las stats existentes (ej. KDA alto →
"mecánica"), o se pide auto-evaluación al jugador, o se saca de la vista
hasta tener con qué llenarlo de verdad — hoy es el único bloque de toda
la app de jugador que ni siquiera tiene un plan de datos detrás.

**Cómo:**
1. `GET /players/:playerId/stats/maps` — mismo patrón que
   `getGameStats`, agrupar `PlayerMatch` por `map` (y opcionalmente por
   `game`).
2. Para el radar: definir primero qué mide cada eje y de dónde sale,
   antes de tocar código.

---

<a id="jugador-rating-timeline"></a>
## [x] 🟢 Evolución de Rating — gráfica inventada, pero fácil de resolver

**Arreglado (23/sep, commit `c43d7cb`):** `GET /players/:playerId/rating/timeline?days=90` agrega `ratingChange` por día y reconstruye el rating acumulado hacia atrás desde el `gp` real actual del jugador (el último punto de la serie siempre coincide exacto con su rating de hoy, no se inventa un punto de partida). `PlayerDashboard.jsx` ya no usa el mock `RATING_TIMELINE` -- consume el endpoint real, con un downsample a 1 punto por semana en el cliente (90 puntos diarios eran demasiado densos para el gráfico). Probado con script contra Mongo real.

**En una frase:** la gráfica "Evolución de Rating" en `/jugador` es una
lista fija de 9 puntos (`RATING_TIMELINE`) igual para cualquier usuario —
pero a diferencia del radar de habilidades, esta SÍ es fácil de resolver
con lo que ya existe.

**Dónde:** `frontend/src/pages/player/PlayerDashboard/PlayerDashboard.jsx`
→ `RatingChart` consume `RATING_TIMELINE.rating`/`.labels` de
`playerStats.js` directo.

**Por qué:** `PlayerMatch.ratingChange` ya se suma a `User.gp` en cada
partida creada (`createMyMatch`) — el dato para reconstruir una curva
real de progreso YA se está guardando, solo falta un endpoint que lo
devuelva agrupado por día/semana (variación de `getDailyStats`, sumando
`ratingChange` acumulado en vez de solo wins/losses).

**Cómo:** `GET /players/:playerId/stats/rating-timeline?days=90` — mismo
`dateRange`/agregación que `getDailyStats`, devolviendo el `gp`
acumulado (o el `ratingChange` diario) día por día. Depende igual de
[#jugador-stats-sin-pipeline](#jugador-stats-sin-pipeline) para tener
datos que agregar — sin partidas reales, la curva sale plana en 0 en vez
de inventada, que ya es mejor que lo de ahora.

---

<a id="notificaciones-sin-meta-rica"></a>
## [x] 🟢 Notificaciones: ningún tipo trae imagen/color en `meta`, y varios no mandan `meta` en absoluto

> **3/oct (tarde):** las plantillas de `NotificationsContext` ya usan el `meta` nuevo (motivo de rechazo, organización, actor, sanción, equipo del traspaso, likes/comentarios) y hay plantilla para `raffle_won` y `role_change`.

> **3/oct:** las 13 `sendNotif` que quedaban sin `meta` ya lo mandan: `role_change`, `admin_notice` (post retirado / sanción), likes y comentarios de comunidad (actor + avatar + post), `organizer_discord_request/reviewed`, `organization_request_approved/rejected`, `raffle_won` (premio + imagen), `role_application_rejected` y `university` (traspaso de liderazgo). Falta que el front las use en las plantillas.

**En una frase:** rediseñé `/notificaciones` para que cada tipo se vea
distinto (monograma de color con las iniciales del equipo/torneo cuando
hay nombre real, si no un ícono de color) — pero revisé los ~20 tipos que
existen hoy y **ninguno** manda un campo de imagen/logo/avatar/color en su
`meta`, y varios ni siquiera mandan un nombre legible.

**Qué:** que el `meta` de cada notificación traiga lo mínimo para armar una
tarjeta visual sin que el frontend tenga que adivinar o parchear con regex.

**Dónde (inventario completo, `Notification.create`/`sendNotif`):**
- `join_request`/`join_request_result` (`team.controller.js`): `meta` solo
  trae `teamId`/`userId`/`requestId` (IDs, ningún nombre). El nombre del
  equipo y el nick sí están en el texto de `message`, así que el frontend
  hoy los saca con una regex sobre ese texto (`joinRequestActor`/
  `joinResultTeamName` en `NotificationsContext.jsx`) — funciona, pero es
  frágil: si el texto del mensaje cambia de redacción algún día, se rompe
  en silencio. Lo correcto es mandar `teamName`/`nick` explícitos en `meta`.
- `role_application_approved`/`rejected` (`roleApplications.controller.js`),
  `organization_request`/`_approved`/`_rejected`
  (`organizationRequests.controller.js`), `organizer_discord_request`/
  `_reviewed` (`organization.controller.js`), y los `community`/`university`
  de like/comentario (`communityPost.controller.js`): **no mandan `meta` en
  absoluto**, solo `title`/`message`/`link`. El frontend ya tiene templates
  esperando `raw.meta?.roleLabel`, `raw.meta?.name`, `raw.meta?.organizationName`,
  etc. — hoy siempre caen al texto genérico de respaldo.
- `tournament_staff_invite`/`_response`/`_added`/`_removed`,
  `tournament_roster_lock` (`tournament.controller.js`): estos sí traen
  nombres legibles (`tournamentTitle`, `role`, `actorNick`, `teamName` en
  el caso de roster lock) — son los mejor servidos hoy, pero tampoco tienen
  imagen/color.
- `admin_notice`/`admin_ticket_reply`/`system_ticket_new`/`system_ticket_reply`
  (`admin.controller.js`, `systemTickets.service.js`): traen nombres/IDs de
  ticket, sin imagen (no la necesitan, ya tienen su propio tratamiento visual
  fijo tipo "aviso prioritario").
- `message` (`messages.controller.js`, `realtime/messagesRealtime.js`): solo
  IDs (`conversationId`, `messageId`), el nombre de quien escribió está en
  el documento del mensaje pero no se copia a `meta`.

**Por qué:** sin esto, la variedad visual del rediseño de notificaciones
tiene un techo — el monograma de color solo puede aparecer donde ya hay un
nombre real (equipos, torneos), y los tipos sin `meta` (aprobación de rol,
solicitud de organización, Discord, comunidad) se van a quedar siempre con
el ícono genérico de respaldo, nunca con algo personalizado, aunque
visualmente ya no se vean rotos ni vacíos.

**Cómo (propuesta, no urgente — nada se ve roto hoy):**
1. Agregar `teamName`/`nick` al `meta` de `join_request`/`join_request_result`
   en `team.controller.js` (ya se tienen esos datos en la función, es solo
   copiarlos al objeto `meta`) — permite borrar la regex del frontend.
2. Para los tipos sin `meta` en absoluto: agregar como mínimo un nombre
   legible (`roleLabel`, `organizationName`, `guildName`) — no hace falta
   imagen todavía, con el nombre ya se puede armar un monograma de color en
   el frontend.
3. Si en algún momento se quiere una imagen de verdad (logo de equipo,
   portada de torneo, avatar de quien reportó), el campo lógico es algo como
   `meta.image`/`meta.color` — el frontend ya sabe priorizar imagen real
   sobre monograma generado si ese campo llega a existir.

---

<a id="admin-users-acciones-sin-backend"></a>
## [x] 🔴 Admin: banear/verificar/cambiar rol/eliminar jugador no persisten

**Arreglado (24/sep):** `PATCH /admin/users/:id/status|verify|role` y
`DELETE /admin/users/:id` reales en `admin.controller.js`/`admin.routes.js`.
Banear pone `status:'ban'` (lo que pinta el censo) **y** `isBanned:true` (lo
que `auth.service.js` ya revisaba en el login) — antes de esto banear desde
`/admin/usuarios` no habría bloqueado el login aunque hubiera persistido.
"Eliminar" es soft-delete (`User.deleted`/`deletedAt`, login bloqueado,
fuera del censo por defecto) porque un borrado real dejaría huérfanos en
equipos/torneos/partidas. Banear/desbanear también deja fila real en
`/admin/moderacion` (`Sanction`, ver item de abajo). `setPlayerRole` no deja
asignar `'admin'` desde el `<select>` (a propósito, ver `ASSIGNABLE_ROLES`
en `admin.controller.js`). `AdminMockWarning` en `AdminUsers.jsx` ahora solo
aparece si el censo sigue en modo demo (`source !== 'backend'`).

**En una frase (contexto original):** en `/admin/usuarios`, los botones "Banear", "Verificar",
cambiar rol y "Eliminar" muestran un toast de éxito y cambian la fila en
pantalla, pero solo tocan el estado de React del admin que los apretó — no
hay ningún `PATCH`/`DELETE` al backend. Si el admin recarga la página, la
persona sigue exactamente igual que antes.

**Qué:** que esas 4 acciones persistan de verdad contra el usuario real.

**Dónde:**
- `frontend/src/pages/admin/AdminUsers/AdminUsers.jsx`: `toggleBan`,
  `toggleVerify`, `setPlayerRole` y `remove` — todas usan `patch(id, {...})`
  que solo hace `setPlayers(prev => prev.map(...))`. La única acción real de
  esta página es `notify` (línea ~211), que si `source === 'backend'` sí
  llama `POST /admin/users/:id/notice` (que existe en `admin.routes.js`).
- `backend/src/routes/admin.routes.js` / `admin.controller.js`: no existe
  ningún endpoint de moderación de usuario — ni ban, ni verify, ni cambio de
  rol, ni borrado. El único endpoint relacionado a un usuario puntual es el
  de aviso (`POST /users/:id/notice`).
- Mientras tanto agregué un aviso rojo (`AdminMockWarning`, componente
  nuevo en `frontend/src/components/AdminMockWarning/`) justo debajo del
  header de la página, para que quien la use sepa que estas 4 acciones no
  hacen nada real todavía — antes no había ninguna señal de esto.

**Por qué:** de las 5 páginas mock del panel admin, esta es la más
delicada porque NO se ve como una página de prueba — el censo de arriba es
real (`/admin/census`), tiene el badge "datos reales", y las acciones están
mezcladas con el resto de la UI real. Un admin que banea a alguien hoy cree
genuinamente que lo baneó.

**Cómo (propuesta):**
1. `PATCH /admin/users/:id/status` `{ status: 'active'|'banned' }` — banear/desbanear de verdad (`User.status` o campo similar; revisar si ya existe algo parecido en el modelo de `User` antes de inventar uno nuevo).
2. `PATCH /admin/users/:id/verify` `{ verified: true|false }`.
3. `PATCH /admin/users/:id/role` `{ role }` — con cuidado de qué roles puede asignar un admin (no debería poder crear otro super-admin sin una capa extra de permiso).
4. Decidir qué significa "eliminar" acá — ¿soft-delete (desactivar cuenta) o borrado real? Borrado real de un usuario con equipos/partidas/torneos asociados es delicado (referencias huérfanas) — probablemente conviene que sea un soft-delete/ban permanente en vez de un `deleteOne` literal.
5. Cuando el backend exista, sacar el aviso rojo de `AdminUsers.jsx` (o dejarlo condicionado a que el endpoint falle).

---

<a id="admin-paginas-100-mock"></a>
## [x] 🟡 Admin: Moderación, Pagos y Sorteos son 100% mock (sin backend en absoluto)

**Arreglado (24/sep):**
- **Moderación**: modelo `Sanction` nuevo (`backend/src/models/Sanction.js`) +
  `GET/POST /admin/moderation`, `DELETE /admin/moderation/:id`. Banear o
  desbanear desde `/admin/usuarios` crea una fila acá automáticamente
  (`recordSanction`, reusado desde `admin.controller.js`) — quedó compartido
  como sugería este mismo item.
- **Pagos**: `AdminPayments.jsx` ahora lee `GET /admin/payments`, que devuelve
  `Order` real (planes + entradas de torneo vía PayPal) en vez de datos de
  prueba. `PATCH /admin/payments/:id/status` corrige el registro para
  conciliación/soporte — deja claro en el aviso que **no** dispara un cobro o
  reembolso real contra PayPal (eso sigue sin existir, ver
  [#pagos-no-hay-pasarela-real](#pagos-no-hay-pasarela-real)). `lib/invoiceDoc.js`
  no se tocó, solo lo que le da de comer.
- **Sorteos**: modelo `Raffle` nuevo + `GET/POST /admin/raffles`,
  `PATCH /admin/raffles/:id`. Sigue sin QR/validación real de participantes
  (fuera de alcance, "Participantes" es un contador manual) — el aviso ahora
  lo dice explícito.

**En una frase (contexto original):** 3 páginas completas del panel admin (`/admin/moderacion`,
`/admin/pagos`, `/admin/sorteos`) no tienen ningún backend detrás — todo
vive en `AdminContext`/estado local, se pierde al recargar. Agregué un
aviso rojo (`AdminMockWarning`) en las 3 para que se note en vez de que
parezcan páginas terminadas.

**Dónde:**
- **AdminModeration** (`frontend/src/pages/admin/AdminModeration/AdminModeration.jsx`): usa `useAdmin()` → `data/admin.js` (`MODERATION_TYPES`, seed inicial). Registrar/borrar una sanción no persiste. Esta es la contraparte natural del ban/verify de [#admin-users-acciones-sin-backend](#admin-users-acciones-sin-backend) — si se construye un backend de moderación, probablemente conviene que ambas páginas compartan el mismo modelo/endpoint en vez de resolverse por separado.
- **AdminPayments** (`frontend/src/pages/admin/AdminPayments/AdminPayments.jsx`): mismo `useAdmin()`. La generación de facturas/recibos en PDF (`lib/invoiceDoc.js`) es una herramienta bien hecha y reutilizable, pero los "pagos" que factura son de prueba — no toca `payment.routes.js` (el sistema de pagos real que sí existe, ver [#pagos-no-hay-pasarela-real](#pagos-no-hay-pasarela-real)) en absoluto. Cambiar el estado de un pago acá es cosmético.
- **AdminRaffles** (`frontend/src/pages/admin/AdminRaffles/AdminRaffles.jsx`): estado 100% local (`useState(INITIAL_RAFFLES)`), ni siquiera pasa por `useAdmin()`. El propio texto de la UI ya lo admitía ("antes de conectar QR/backend definitivo") — le sumé el aviso rojo para que sea más visible que solo una frase en el copy.

**Por qué:** no es que estén rotas — son herramientas reales y bien construidas del lado del frontend (sobre todo Pagos, con generación de PDF fiscal completa) — pero ninguna de las 3 tiene con qué sobrevivir un recargo de página ni ser vista por otro admin desde otro dispositivo.

**Cómo (propuesta, a priorizar con Stephanie/Angel — no todas valen lo mismo):**
1. **Moderación** probablemente sí vale la pena pronto, porque desbloquea que [#admin-users-acciones-sin-backend](#admin-users-acciones-sin-backend) (ban/verify) sea real también — mismo modelo, dos pantallas.
2. **Pagos**: depende de qué tan urgente sea tener panel de facturación real vs. que siga siendo una herramienta de preview/plantilla hasta que haya más volumen de pagos reales.
3. **Sorteos**: la más fácil de posponer — es la única de las 3 que ya se auto-declaraba "no conectada" en su propio texto antes de este cambio.

---

<a id="admin-banners-vs-marcas"></a>
## [x] 🟢 Admin: dos sistemas de "publicidad/marcas" en paralelo (uno mock, uno real)

**Revisado (24/sep) — la premisa de este item estaba desactualizada:**
Anuncios y Promos de `AdminBanners` ya eran reales desde el 19/sep
(`site-ads`/`site-promos`, `siteAds.controller.js`) y no duplican nada de
`AdminMarcas` (que gestiona el negocio con marcas patrocinadoras: apps,
campañas, creatividades — no espacios de anuncio del sitio). Las dos
páginas se quedan, no hacen lo mismo.

Lo único que sí seguía mock era la pestaña **Solicitudes**: `pubStore.js`
guardaba cada solicitud en el `localStorage` de quien la enviaba
(`PublishModal.jsx`, botón "Publicar", disponible para cualquier usuario) —
un admin en otro dispositivo/navegador **nunca** podía verla, y el límite de
"3 publicaciones gratis al mes" se reseteaba con solo cambiar de navegador.
Arreglado: modelo `PublicationRequest` real, `POST /publication-requests` +
`GET /publication-requests/me/count` (público/autenticado, cuenta el mes
real desde Mongo) y `GET/PATCH /admin/publication-requests` (admin, la
pestaña Solicitudes de `AdminBanners.jsx`). De paso, `PublishModal.jsx`
subía las imágenes con `URL.createObjectURL` (una blob: URL que muere al
recargar la página, ni siquiera sobrevivía en el mismo navegador) — ahora
usa `uploadFile()` real (`POST /uploads`).

**En una frase (contexto original):** `AdminBanners` (`/admin/banners`, "Publicidad y
Patrocinios") es una herramienta elaborada (editor de anuncios,
analíticas, solicitudes) pero 100% mock contra `lib/pubStore.js`
(local). `AdminMarcas` (`/admin/marcas`, "Centro de Marcas") hace
prácticamente lo mismo — solicitudes, campañas, creatividades, reportes —
pero está conectado de verdad a `brands.routes.js`/`brands.controller.js`.
Son dos pantallas distintas resolviendo el mismo problema de negocio.

**Qué:** decidir si se fusionan, o si una absorbe casos de uso de la otra,
antes de invertir más tiempo puliendo cualquiera de las dos.

**Dónde:** `frontend/src/pages/admin/AdminBanners/` vs
`frontend/src/pages/admin/AdminMarcas/`. `ads.routes.js` (backend) solo
expone lectura pública + tracking de impresión/click, no hay endpoints
admin — por eso `AdminBanners` cayó en `pubStore.js` local en vez de una
API real.

**Por qué:** mientras convivan las dos, cualquiera que entre a "Publicidad
y Patrocinios" ve un panel funcional (con datos falsos) sin ninguna pista
de que "Centro de Marcas" es el que de verdad pega al backend — confuso
para cualquiera nuevo en el equipo, y doble trabajo de mantenimiento si
las dos siguen evolucionando por separado. Ya dejé un aviso rojo en
`AdminBanners` señalando esto mientras se decide.

**Cómo (propuesta):** si el modelo de datos de `AdminMarcas`
(`brands.controller.js`) ya cubre lo que hace `AdminBanners` (slots,
creatividades, analíticas, aprobación de solicitudes), lo más simple es
retirar `AdminBanners` del sidebar y, si hace falta algo puntual que
`AdminMarcas` no cubre (ej. los "promos modales" de `AdminBanners`),
portarlo como una pestaña más de `AdminMarcas` en vez de mantener dos
paneles.

---

<a id="admin-census-500"></a>
## [x] 🔴 `GET /admin/census` tira 500 siempre: falta un import

**Confirmado arreglado (18/sep):** agregado `import { getCountryNumber } from '../config/countries.js'` a `admin.controller.js`. Verificado con `node -e "import('./src/app.js')"` sin errores.

**En una frase:** probé `/admin/operaciones`, `/admin/tickets` y
`/admin/admins` con Playwright (login real con `admin@gg.gg`) para revisar
el CSS a ojo, y encontré que el censo de usuarios está roto para
cualquier admin: `{"message":"getCountryNumber is not defined"}`.

**Qué:** que `GET /api/admin/census` responda 200 en vez de 500.

**Dónde:**
- `backend/src/controllers/admin.controller.js` línea 243: usa
  `getCountryNumber(u.countryCode)` pero el archivo nunca la importa.
- La función sí existe y está exportada en `backend/src/config/countries.js`
  (`export function getCountryNumber(...)`, ya usada correctamente en
  `backend/src/services/countries.service.js`) — es puramente un import
  que falta, no hay que escribir nada nuevo.

**Por qué importa:** esto no es un caso raro — es el endpoint que arma
TODO el censo de jugadores, y por eso rompe `/admin/usuarios` (censo
completo) y `/admin/admins` (que filtra el censo por rol) para cualquier
admin, siempre, no solo en un caso límite. Confirmado con `curl` directo
contra el backend corriendo local, no es un problema de sesión/frontend.

**Cómo:** agregar en `admin.controller.js`:
```js
import { getCountryNumber } from '../config/countries.js'
```
Con eso solo, el endpoint debería volver a responder 200 — no toqué el
archivo porque es lógica de backend, pero es literalmente una línea.

---

<a id="rol-aprobado-sin-codigo"></a>
## [x] ✅ Rol aprobado (organizador y demás) nunca recibía el código real

**Confirmado y arreglado (16/sep).** Diagnóstico exacto aportado por el usuario, verificado empíricamente contra Mongo real antes de tocar nada.

**En una frase:** un admin aprueba una `RoleApplication` (ej. organizador), la solicitud queda `approved` y hasta se le agrega el rol al usuario, pero `roleProfiles.organizer.organizerCode` nunca se guarda — así que `createTournament` sigue rechazando con "An approved organizerCode is required" aunque la tabla de admin diga "Autorizado".

**Causa real:** en `backend/src/models/User.js`, los campos del subdocumento especializado (`organizerCode`, `organizerInternalCode`, `approvedAt`, `applicationId` — y sus equivalentes para creator/coach/caster/analyst/moderator/sponsor) están marcados `immutable: true`. Mongoose bloquea en silencio **cualquier** `$set` sobre un path `immutable` hecho vía `updateOne`/`findOneAndUpdate`, **incluso la primera vez que se escribe** (el campo viene `undefined`, no hay nada que "proteger" todavía, pero Mongoose igual lo descarta a menos que se pase `overwriteImmutable: true`). `adminReviewApplication` hacía:
```js
await User.updateOne({ _id: app.userId }, update, { runValidators: true })
```
sin ese flag. El `updateOne` devolvía `modifiedCount: 1` (por el `$addToSet: { roles: app.roleId }`, que sí aplica), dando la falsa impresión de que todo se guardó — pero `roleProfiles.organizer.*` se quedaba vacío.

**Verificado con un script aislado contra Mongo real** (mismo patrón immutable, mismo `updateOne`): sin `overwriteImmutable`, el subdocumento queda `undefined` después del update pese a `modifiedCount: 1`; con `overwriteImmutable: true`, se guarda correcto. Confirmado con Mongoose 8.7 (la versión real del proyecto).

**Segundo hallazgo del usuario, también real:** la tabla de `AdminApprovals.jsx` mostraba `app.publicCode` (código de la *solicitud*, formato `RAP-...`) bajo la columna genérica "Código" — fácil de confundir con el código real del rol (`ORG-...`). El panel de detalle ya lo etiquetaba bien ("Código Solicitud"), pero la tabla no.

**Arreglado:**
1. `roleApplications.controller.js` → `adminReviewApplication`: agregado `overwriteImmutable: true` al `updateOne`.
2. `adminListApplications`: ahora popula `roleProfiles` del usuario y adjunta `roleCode`/`roleInternalCode` a cada solicitud (el código real, no el de la solicitud).
3. `AdminApprovals.jsx`: la tabla y el panel de detalle muestran el código real cuando la solicitud está aprobada — y si falta (el bug), lo marcan en rojo ("Falta código real") en vez de mostrar silenciosamente el código equivocado.
4. `backend/src/scripts/backfill-role-application-codes.js` (nuevo, `npm run migrate:role-application-codes -- --apply`): repara solicitudes ya aprobadas cuyo usuario nunca recibió el código. Corrido contra la base de datos real de este entorno: **3 cuentas afectadas, las 3 reparadas** (2 organizador, 1 coach, 1 caster — un usuario tenía dos roles pendientes de reparar).

**Ojo para quien lea esto en producción:** si la base de producción tiene el mismo historial de aprobaciones rotas, correr `npm run migrate:role-application-codes` (sin `--apply`) primero para ver el diagnóstico, y con `--apply` para reparar. Es idempotente — correrlo de nuevo no toca las cuentas que ya tienen código.

---

<a id="equipos-universitarios-sin-validacion-join"></a>
## [x] 🔴 Equipos universitarios: nadie valida la universidad al unirse

**Confirmado arreglado (18/sep):** era más grande de lo que parecía. Investigando encontré que `team.controller.js` había perdido ~500 líneas en el merge `8e9b1cf` (6-sep) que reseteó el archivo a una versión vieja de `main` — se llevó la validación universitaria completa (`requestToJoin`/`respondJoinRequest`/`joinTeam`), pero también el auto-flag de `createTeamForUser` (ningún equipo nuevo podía llegar a marcarse `university.isUniversityTeam` porque nadie lo asignaba) y dejó un bug de crash real: `joinTeamForUser` llamaba a `invokeAsUser(joinTeam, ...)`, que a su vez llamaba a `joinTeamForUser` — recursión infinita en cualquier "unirse por código de invitación".

Reparado (no se restauró el resto de la regresión de ese merge — roster por slot, delegados, seguidores — porque el frontend actual ya no llama a ninguno de esos endpoints, sería código muerto):
- `createTeamForUser`: auto-detecta universidad verificada del fundador y marca `team.university` (con chequeo de "cupo oficial" por universidad+juego para no duplicar el standings).
- `requestToJoin`/`respondJoinRequest`: `universityEligibilityError()` restaurado (verificado + misma universidad).
- `joinTeamForUser`: recursión eliminada (lógica real, ya no delega en `joinTeam`), y bloquea entrada por código a equipos universitarios (deben pasar por invitación/solicitud del líder).

Verificado con un script desechable contra Mongo real: 10/10 casos (auto-flag, cupo tomado, rechazo no-verificado, rechazo otra-universidad, aceptación misma-universidad, bloqueo de código de invitación, join normal sin crash).

**Encontrado (16/sep)** mientras se construía `unlinkUniversityVerification` (`university.controller.js` — feature nueva de autoservicio para "cerrar sesión" de la universidad, `DELETE /university/me`). Al diseñar qué hacer con el roster de alguien que se desvincula, revisé cómo se aplica hoy la regla "para estar en un equipo universitario tenés que estar verificado con esa misma universidad" — y no se aplica en ningún lado.

**En una frase:** `requestToJoin`/`respondJoinRequest` (`team.controller.js`) no tienen ningún chequeo de `university` — cualquiera puede pedir unirse y ser aceptado en un equipo con `university.isUniversityTeam: true`, verificado o no, de cualquier universidad.

**Por qué importa:** el catálogo universitario (`getUniversityCatalogDetail`, standings, etc.) asume que un equipo universitario representa de verdad a esa universidad — cuenta sus miembros verificados, sus puntos, sus torneos. Si cualquiera puede unirse sin verificación, esos números y esa exclusividad son una ficción. También afecta directamente al unlink nuevo: hoy remueve del equipo a quien se desvincula porque asumí que la regla de entrada existía — sin ella, alguien pudo haberse unido sin haber estado nunca verificado, y el unlink lo saca igual (lo cual sigue siendo correcto, solo que la causa raíz de "cómo entró sin calificar" sigue abierta).

**Dónde:** `backend/src/controllers/team.controller.js` → `requestToJoin` (línea ~366) y `respondJoinRequest` (línea ~396). Ninguna de las dos consulta `team.university` ni el `req.user.university`/`request.user`'s verification status. Tampoco hay chequeo en el frontend (`MyTeamPanel.jsx`, `Teams.jsx`) — no es solo un candado de UI faltante, no existe ni ahí.

**Cómo (propuesta):**
1. En `requestToJoin`: si `team.university?.isUniversityTeam`, exigir `req.user.university?.verificationStatus === 'verified' && req.user.university.universityId === team.university.universityId` antes de crear la solicitud — devolver 403 con mensaje claro si no.
2. En `respondJoinRequest`: repetir la misma validación antes de aceptar (por si el estado de verificación del solicitante cambió entre que pidió unirse y que lo aceptaron) — no confiar solo en el chequeo de la creación.
3. Frontend: ocultar o deshabilitar el botón "Unirse" en la ficha de un equipo universitario si el usuario no está verificado con esa universidad, con un mensaje explicando por qué (en vez de dejar que falle recién en el backend).

---

<a id="admin-teams-status-fake"></a>
## [x] 🔴 Admin: "Marcar como Eliminado" de equipos no persistía nada

**Confirmado arreglado (18/sep).** Encontrado de paso mientras se investigaba el bug de equipos universitarios (mismo archivo, `team.controller.js`/`AdminTeams.jsx`).

**En una frase:** el botón de moderación "Marcar como Eliminado"/"Marcar como Activo" en `/admin/equipos` mostraba el toast de éxito y cambiaba el badge, pero solo tocaba el `useState` local del navegador — nunca llamaba a la API. Y aunque hubiera llamado, `Team.status` ni existía en el schema (Mongoose lo habría descartado en silencio, mismo patrón que el bracket/reportes en su momento).

**Arreglado:**
- `backend/src/models/Team.js`: agregado `status: { type: String, enum: ['Activo', 'Eliminado'], default: 'Activo' }` (ya lo leía `admin.controller.js#mapTeam`, pero nadie lo escribía).
- `backend/src/controllers/admin.controller.js` → `updateTeamAdmin`: acepta `status` en el patch (mismo patrón que `partnerBadge`), valida el enum.
- `frontend/src/pages/admin/AdminTeams/AdminTeams.jsx`: `onToggleStatus` ahora llama `PATCH /admin/teams/:id` de verdad (antes era 100% local), con el mismo patrón optimista+rollback que `togglePartnerBadge`.
- `backend/src/controllers/tournament.controller.js` → `registerTeamForUser`: un equipo `Eliminado` ya no puede inscribirse a torneos nuevos (la razón original de tener este campo, según el comentario que ya estaba en el schema de una sesión vieja).

Verificado con un script desechable contra Mongo real: crear equipo, marcarlo Eliminado vía `updateTeamAdmin`, rechazo de un enum inválido.

---

<a id="equipos-universitarios-torneo-scope"></a>
## [x] ✅ Torneos "solo universidad": no hay ninguna restricción de elegibilidad al inscribirse

**Arreglado (24/sep):** `registerTeamForUser` ahora revisa
`tournament.eligibility.universityOnly` y rechaza equipos que no estén
marcados como universitarios verificados.

**Encontrado (18/sep), no arreglado —** fuera de alcance de la sesión que reparó la validación de equipos universitarios de arriba.

**En una frase:** `tournament.controller.js` (`registerTeamForUser`) no tiene ningún concepto de "torneo universitario" — cualquier equipo (universitario o no, de cualquier universidad) puede inscribirse a cualquier torneo. Si existe la intención de producto de tener torneos exclusivos para equipos universitarios (o de una universidad específica), no está implementada en ningún lado del backend actual.

**Por qué importa:** el ranking/standings universitario (`universityStandings.js`) sí agrega resultados por universidad asumiendo que "torneo universitario" es un concepto real — pero no hay forma de que un torneo declare esa restricción, así que cualquier resultado que la alimente depende de que el organizador arme el torneo "a mano" solo con equipos universitarios, sin que el sistema lo garantice.

**Cómo (propuesta, a decidir si es prioridad):** agregar un campo tipo `Tournament.participationScope` (ya existe para el alcance geográfico — revisar si conviene extenderlo o agregar uno nuevo, ej. `universityOnly: Boolean` + `universityIds: [String]` para limitar a universidades específicas) y validarlo en `registerTeamForUser` igual que se valida el resto de elegibilidad hoy.

---

<a id="roster-miembro-edita-su-slot"></a>
## [x] ✅ Roster: un miembro no puede editar su propio perfil (falta userId por slot + endpoint)

**Arreglado (19/sep):** implementado tal cual lo describe esta tarea. `updateMyRosterSlot` (`team.controller.js`) + `PATCH /teams/:teamId/roster/mine` (`team.routes.js`) ya guardan `userId`/`discordId` dentro de cada entrada de `rosterSlots` y dejan reclamar/editar solo el puesto propio (409 si el puesto pedido ya es de otro). Del lado del frontend: `PlayerTeams.jsx` agrega un modal ("Mi perfil en el equipo") para que cualquier miembro reclame o edite su slot desde `/jugador/equipos`; `TeamRoute.jsx`, `Sidebar.jsx` y `TeamPanelLayout.jsx` ahora limitan el acceso a `/mi-equipo` (el panel completo) a quien sea líder de al menos un equipo (o admin) — un miembro no-líder ya no ve esos controles porque no llega a esa pantalla. Verificado con `vite build` (compila sin errores) y lectura completa del endpoint nuevo contra el schema (`rosterSlots: Mixed`, sin migración necesaria).

**Encontrado (18/sep)** mientras Stephanie revisaba `MyTeamPanel.jsx`: el panel de "Mi equipo" no distinguía líder de miembro en el frontend — cualquier miembro veía los mismos botones de editar equipo/roster ajeno/invitaciones/privacidad que el líder. Al revisar el backend para confirmar el alcance real del problema, resultó que `updateMyTeam` (`PATCH/PUT /teams/:teamId/manage` y `/teams/my`) **ya exige `leader: req.user._id`** — así que un miembro no-líder que tocara "Guardar" ya recibía 404 ("Team not found or you are not the leader"). No era un agujero de seguridad; era una UI que mostraba controles que iban a fallar, y **cero forma de que un miembro edite ni siquiera su propio puesto**.

**En una frase:** un miembro del equipo (no líder) no tiene ningún endpoint para editar su propia fila del roster (nick, rol, bio, redes, etc.), y `rosterSlots` no guarda qué usuario real es dueño de cada slot.

**Decisión de producto (confirmada con Stephanie, 18/sep):** un miembro no-líder **no debe ver el panel completo** (nada de config del equipo, roster ajeno, invitaciones, privacidad). Solo ve la identidad básica del equipo (nombre/logo/tag) + puede editar/reclamar su propio puesto en el roster. Ya implementado en el frontend (`MyTeamPanel.jsx`): si `!isCurrentLeader`, se renderiza una vista simplificada en vez del panel del líder.

**Qué falta del lado del backend:**
1. **Guardar `userId` (y de paso `discordId`) dentro de cada entrada de `rosterSlots`.** El campo ya es `Mixed` en el schema (`Team.js`), así que no hace falta tocar el schema — solo empezar a escribir esas claves. Hoy `rosterSlots[slot]` solo tiene `{ nick, role, gameId, email, avatar, bio, rank, availability, mainCharacters, socials, status }`; ninguna de esas identifica a un usuario real de la plataforma.
2. **Endpoint nuevo: `PATCH /teams/:teamId/roster/mine`** (`requireAuth`, cualquier miembro — no solo el líder). Body: `{ slot, nick, role, gameId, email, avatar, bio, rank, availability, mainCharacters, socials }` (mismo shape que ya manda `saveRoster` en el frontend). Lógica:
   - Buscar el team donde `req.user._id` esté en `members` (o sea `leader`).
   - Buscar si ya existe una entrada en `rosterSlots` con `userId === req.user._id` (ese es "su slot" actual, sin importar el nombre de la clave).
   - Si existe: actualizar SOLO esa entrada con los campos del body (ignorar `slot` del body, no dejar que se mueva de puesto por esta vía).
   - Si no existe: el `slot` del body debe estar vacío (`!rosterSlots[slot]` o sin `userId`) — si está ocupado por otro `userId`, rechazar con 409. Si está libre, crear `rosterSlots[slot] = { ...camposDelBody, userId: req.user._id, discordId: req.user.discord?.id || '' }`.
   - Nunca tocar campos fuera de `rosterSlots` (nombre del equipo, privacidad, invite code, etc.) — a propósito, para que este endpoint no pueda usarse para lo que ya bloquea `updateMyTeam`.
3. **(Opcional, mejora de UX)** — hoy `POST /teams/join` (`joinTeamForUser`) no asocia al que se une con ningún slot; simplemente entra a `members`. Si se quiere, podría aceptar un `slot` opcional en el body y hacer el mismo "crear entrada si está libre" del punto 2, para que alguien que entra por el link de invitación (`/equipos/unirse/:code`) pueda elegir su puesto en el mismo paso en vez de tener que ir después a "Mi equipo" a reclamarlo. No es necesario para que el frontend actual funcione — el flujo de reclamar el slot después ya cubre el caso.

**Dónde:**
- `backend/src/models/Team.js` — sin cambios de schema (`rosterSlots: Mixed`).
- `backend/src/controllers/team.controller.js` — nueva función `updateMyRosterSlot` (o similar) + export.
- `backend/src/routes/team.routes.js` — agregar `router.patch('/:teamId/roster/mine', requireAuth, updateMyRosterSlot)`.

---

<a id="eliminar-equipo-miembro-fantasma"></a>
## [x] ✅ Eliminar/salir del equipo: bloqueado por un miembro fantasma en `Team.members`

**Arreglado (19/sep):** `leaveTeam` ahora valida contra `User` que los "otros miembros" existan de verdad antes de bloquear, y de paso limpia (`$pull`) cualquier id huérfano que encuentre en ese equipo. Verificado con un script ad-hoc contra Mongo real (no commiteado): (1) un líder solo con un id fantasma en `members` ya puede disolver su equipo (200, `Team disbanded`), (2) un líder con un miembro real sigue bloqueado como corresponde (400, pide transferir liderazgo). También corrí `cleanup-stale-team-members.js` (nuevo, ver abajo) contra la base local: 0 referencias huérfanas encontradas en los 6 equipos existentes ahí — probablemente porque el dato roto vive en otro entorno (staging/producción) o ya no existe en este Mongo local. **Falta correr ese mismo script contra el entorno donde Stephanie vio el bug** (no tengo acceso desde acá) para limpiar el dato ya dañado — el fix de código previene que vuelva a pasar, pero no borra por sí solo lo que ya quedó mal.

**Reportado (19/sep) por Stephanie:** "si no hay nadie [más] y quiero eliminar equipo debería dejarme... no decirme Transfer leadership before leaving."

**En una frase:** un líder que —según lo que el frontend le muestra— es el único integrante de su equipo, no puede disolverlo: `POST /teams/leave` responde 400 con `"Transfer leadership before leaving the team"` (texto crudo en inglés, sin traducir).

**Por qué pasa (leído en código, no solo reproducido a ojo):**
- `MyTeamPanel.jsx` decide si hace falta transferir liderazgo mirando `leadershipCandidates`, que sale de mapear `team.members` (populado desde el backend) y **descartar cualquier entrada sin `id` resuelto** (línea ~688: `if (!member.id || member.id === teamLeaderId || seen.has(member.id)) return false`). Si `team.members` tiene el ObjectId de un usuario que ya no existe en `User` (cuenta de prueba borrada a mano de Mongo, por ejemplo), `.populate('members', ...)` devuelve `null` para esa entrada y el frontend, correctamente, no puede armar un nick ni un id — así que la descarta y termina viendo el equipo como "solo yo".
- `leaveTeam` (`team.controller.js` línea ~644) hace la cuenta contraria **sin poblar nada**: `team.members.filter(memberId => String(memberId) !== String(req.user._id))`. Un ObjectId que apunta a un usuario borrado sigue contando como "otro miembro", así que `otherMembers.length > 0` da `true` y bloquea con el mensaje de transferir liderazgo — aunque no haya a quién transferírselo.
- Mismo patrón en `deleteTeam` (línea 526) — ahí no hay ni siquiera este chequeo, pero si en algún momento se le agrega uno parecido, va a tener el mismo bug.
- No existe ningún endpoint para "expulsar miembro" en todo `team.controller.js` (confirmado con grep) — la única forma de que alguien salga de `members` hoy es `leaveTeam` (self-service) o que nunca haya entrado. Así que la vía más probable para un ObjectId huérfano es una cuenta de prueba borrada directo de la base de datos mientras el equipo seguía apuntándole, no un flujo real de la app — pero el bug de fondo (no validar que el otro "miembro" siga existiendo) puede pasar por cualquier otra razón futura también, incluida la feature nueva de `rosterSlots` (ver tarea de arriba, "Roster: un miembro no puede editar su propio perfil") que ya vive completamente separada de `Team.members` — nada mantiene ambas cosas sincronizadas.

**Mitigado por ahora del lado del frontend (no arregla la causa):** `MyTeamPanel.jsx` (`handleLeaveTeam`) ya no muestra el texto en inglés tal cual — si detecta ese mensaje específico, avisa en español que el servidor todavía registra otro integrante y sugiere recargar/contactar soporte. También se agregó una segunda confirmación explícita antes de disolver un equipo (acción irreversible). Pero el líder real sigue sin poder eliminar su equipo hasta que esto se arregle acá.

**Cómo arreglarlo de raíz (elegir una, la primera es más simple):**
1. **Defensivo, recomendado:** en `leaveTeam` (y en cualquier chequeo parecido que se agregue a `deleteTeam`), antes de contar `otherMembers`, filtrar por usuarios que realmente existan: `const validOtherMembers = otherMembers.length ? await User.find({ _id: { $in: otherMembers } }).distinct('_id') : []` y usar `validOtherMembers.length > 0` en vez de `otherMembers.length > 0`. Aprovechar el mismo paso para limpiar `Team.members` de los ids que ya no resuelven (`$pull: { members: { $in: otherMembers.filter(id => !validOtherMembers.includes(id)) } }`), así el problema no vuelve a aparecer para ese equipo.
2. **Migración one-off:** correr un script que recorra todos los `Team.members` y saque cualquier ObjectId que no exista en `User`, para limpiar el estado actual de una vez (complementa al punto 1, no lo reemplaza).
3. Cuando se implemente algún endpoint real de "expulsar miembro" (no existe hoy), asegurarse de que también actualice `rosterSlots` si esa entrada le pertenecía a ese usuario, para que ambas estructuras no se desincronicen de nuevo.

**Dónde:**
- `backend/src/controllers/team.controller.js` — `leaveTeam` (línea ~627), `deleteTeam` (línea ~526).
- `frontend/src/pages/team/MyTeamPanel/MyTeamPanel.jsx` — `handleLeaveTeam` ya tiene el mensaje traducido y la doble confirmación; no hace falta tocarlo de nuevo salvo que cambie el texto exacto del error en el backend.

---

<a id="solicitud-unirse-sin-aviso"></a>
## [ ] 🟡 Solicitud de unirse a equipo: un caso reportado sin ningún toast ni notificación

**Reportado (19/sep) por Stephanie:** "de una cuenta envié solicitud a equipo y no llegó notificación ni salió advertencia, simplemente no hizo nada."

**En una frase:** al menos una vez, enviar una solicitud de unión a un equipo no produjo ningún feedback visible para quien la mandó (ni éxito ni error) y el líder tampoco recibió la notificación esperada.

**Lo que ya revisé en el código (los 3 lugares del frontend que llaman a este endpoint):**
- `frontend/src/pages/Teams/TeamPage/TeamPage.jsx` (`handleRequestToJoin`, línea ~568) — perfil público de un equipo.
- `frontend/src/pages/Teams/Teams.jsx` (`handleRequestTeamJoin`, línea ~2744) — usado desde el directorio de equipos (tarjetas) y desde el modal de detalle de equipo.

Los 3 llaman a `POST /teams/:teamId/requests` dentro de un `try/catch` que **siempre** termina en un `toast(...)`, tanto en éxito como en error (incluido un mensaje especial para 409 "ya estaba pendiente"). De paso, encontré y arreglé un bug relacionado pero distinto en `GGTeamCard.jsx`: el botón "Unirse" marcaba el estado visual "Solicitud enviada" **antes** de que la petición terminara (optimista sin rollback), así que si la petición fallaba, el botón igual quedaba mostrando éxito — ya corregido para que solo quede en "enviado" si el pedido realmente funcionó (o si el servidor dice 409 porque ya estaba pendiente).

**Por qué esto no explica el reporte de Stephanie:** ninguno de los 3 casos tiene un camino de código donde no se muestre ningún toast — así que "no hizo nada" no encaja con lo que hace el frontend hoy, salvo que:
1. La petición real nunca haya llegado al backend (ej. `getCsrfToken()` colgado o el `fetch` inicial fallando de una forma que no cae en el `catch` esperado — revisar `frontend/src/lib/api.js`), o
2. La petición sí llegó y el backend respondió 200, pero algo entre `requestToJoin` (`team.controller.js` línea ~553) y la notificación falló en silencio del lado del servidor — por ejemplo si `Notification.create({ type: 'join_request', ... })` lanzara una validación que quedara atrapada en algún middleware que no reenvía el error como se espera.

**Qué pido revisar del lado del servidor (no lo puedo ver desde acá):** logs del backend alrededor del momento del reporte — filtrar por `POST /teams/:teamId/requests` — para confirmar si la petición llegó, qué status devolvió, y si `Notification.create` se ejecutó. Si Stephanie puede decir qué equipo y aproximadamente a qué hora probó esto, ayuda mucho a encontrar la request exacta en los logs.

**Dónde:**
- `backend/src/controllers/team.controller.js` — `requestToJoin` (línea ~553).
- `frontend/src/lib/api.js` — wrapper de `fetch` + CSRF, por si el problema es previo a que la petición real salga.
- `frontend/src/components/GGTeamCard/GGTeamCard.jsx` — bug de UI optimista ya corregido de paso (no es la causa, pero era real).
- `frontend/src/pages/team/MyTeamPanel/MyTeamPanel.jsx` — ya llama a este endpoint (`saveMySlot`, busca `mySlotKey` comparando `rosterSlots[x].userId` con el usuario actual) y ya tiene la vista de "elegí tu puesto" para cuando todavía no hay slot asignado. Nada que tocar ahí una vez que el endpoint exista — hoy el guardado falla con 404 (ruta inexistente) hasta que se implemente esto.

---

<a id="role-pisado-por-brand"></a>
## [x] 🔴 `user.role` se pisa al aprobar/vincular una marca: la cuenta pierde acceso a `/jugador`

**Arreglado (23/sep, commit `2098c5f`):** los 2 lugares de `brands.controller.js` que hacian `user.role = 'brand'` sin condicion ahora suman `'brand'` a `roles[]` (que `Sidebar.jsx` ya lee) y solo tocan `role` si todavia tenia el default neutral `'player'` -- cualquier rol ya aprobado (organizer, coach...) se conserva. Probado con script contra Mongo real: cuenta con `organizer` ya aprobado conserva su `role` y suma `brand` a `roles[]`; cuenta player default si pasa a brand como antes.

**Reportado (20/sep) por Stephanie:** entraba a `/jugador` o `/jugador/equipos` y la mandaba directo a `/dashboard`, sin aviso. La ruta está protegida por `RoleRoute roles={['player','admin']}` (`frontend/src/routes/AppRoutes.jsx`), así que eso pasa cuando `user.role` no es ni `'player'` ni `'admin'`.

**Causa encontrada:** `role` en el schema (`backend/src/models/User.js:115`) tiene `default: 'player'`, pero es un campo único (no una lista), y `brands.controller.js` lo **reemplaza** en vez de sumarlo:
- Línea ~525 (`reviewBrandApplication` o similar, al aprobar una solicitud de marca): `if (existingUser.role !== 'admin') existingUser.role = 'brand'`.
- Línea ~792 (vincular un usuario a una marca a mano desde admin): `if (user.role !== 'admin') user.role = 'brand'`.

Cualquier cuenta que no sea `'admin'` y quede vinculada a una marca pierde el `'player'` para siempre — no hay forma de recuperarlo desde el frontend. El mismo patrón puede estar en otros controllers que asignen `role` directamente (no alcancé a revisar todos, solo `brands.controller.js` porque fue el único que encontré con `grep` de `\.role\s*=`).

**Por qué importa:** este proyecto trata "player" como el estado base de cualquier cuenta (roles como organizer/creator/coach/caster/analyst se guardan aparte, en `roleProfiles`, sin tocar `role` — ver `Sidebar.jsx`) — pero `brand` no sigue ese patrón y en cambio pisa el campo único, dejando a la cuenta sin acceso a su propio panel de jugador ni a sus equipos.

**Parche de frontend que ya apliqué mientras tanto:** en `AppRoutes.jsx` saqué el `RoleRoute roles={['player','admin']}` que envolvía el grupo `/jugador/*` — ahora cualquier usuario autenticado (ya pasó por `ProtectedRoute`) puede entrar, sin depender de este campo. Esto destraba a cualquier cuenta ya afectada, pero no arregla la causa ni evita que se repita con la próxima aprobación de marca.

**Qué pido:**
1. Cambiar `brands.controller.js` (las 2 líneas de arriba) para que sumar el rol `brand` no borre `player` — por ejemplo guardar `brand` en `roleProfiles.brand` (mismo patrón que organizer/creator) o en un array `roles` en vez de pisar el campo único `role`.
2. Revisar si hay otros controllers con el mismo patrón (`grep -rn "\.role\s*=\s*['\"]" backend/src/controllers`).
3. Backfill: buscar cuentas con `role: 'brand'` que deberían seguir siendo `'player'` también, y restaurarlas (similar al backfill que ya se hizo para `roleProfiles.<rol>.<código>` — ver la tarea de arriba "Rol aprobado... nunca recibía el código real").
4. La cuenta de Stephanie en particular probablemente necesita revisión manual — no tengo acceso a la base de datos real para confirmar cuál es su `role` actual.

**Dónde:**
- `backend/src/controllers/brands.controller.js` — líneas ~525 y ~792.
- `backend/src/models/User.js:115` — definición del campo `role`.

---

<a id="solo-sin-equipo-ni-discord"></a>
## [x] 🔴 Torneos individuales (1v1/solo): inscripción sin equipo ni Discord vinculado

**Arreglado (20/sep):** quité la rama `isSoloModality` de `registerTeamForUser`
y de `cancelRegistration` (ver commit). Ahora **todo** torneo, sin importar
la modalidad, pasa por el camino de equipo (`participantRestrictions` +
`validateTeamTournamentEligibility`, que ya exige Discord vinculado por
titular). De paso encontré y arreglé un bug real que esto habría expuesto:
`requiredPlayersForTournament` (aquí y su copia en
`frontend/src/pages/TournamentRegistration/TournamentRegistration.jsx`)
reconocía "solo" y "1v1" pero no la palabra **"Individual"** (que es una
modalidad real, ver `GENERIC_MODALITIES` en `shared/games.mjs`) — sin el
fix, un torneo con modalidad "Individual" habría exigido 5 titulares en vez
de 1. Ya corregido en ambos archivos.

**Pendiente de verificar en runtime** (no tengo Mongo real desde este
entorno): probar con una cuenta sin equipo contra un torneo 1v1/Individual
real y confirmar que pide crear/elegir equipo antes de dejar inscribirse, y
que `cancelRegistration` sigue pudiendo cancelar una inscripción vieja
(`registrations[].user`, de antes de este cambio) igual que una nueva
(`.team`).

---

**Contexto original del pedido (20/sep):** todos los torneos, incluso los
1v1 o "casuales", debían exigir que el jugador tenga un equipo (aunque sea
de un solo titular) con Discord vinculado, igual que los torneos de
equipo — no debía existir un camino de inscripción que se saltara esa
validación.

**Qué:** en `registerTeamForUser` (`backend/src/controllers/tournament.controller.js:1158`),
quitar por completo la rama:

```js
if (isSoloModality(tournament.modality)) {
  // ... push directo a registrations sin ningun chequeo
}
```

(líneas 1170-1179 tal como está hoy) y dejar que **todos** los torneos, sin
importar la modalidad, caigan en el mismo camino que ya usan los torneos de
equipo (línea 1181 en adelante): buscar el equipo del líder, correr
`participantRestrictions` + `validateTeamTournamentEligibility`, y recién ahí
hacer `tournament.registrations.push({ team: team._id, ... })`.

**Por qué:** `requiredPlayersForTournament` (mismo archivo, línea ~180, con
un espejo en `shared/games.mjs` → `parseRequiredRosterSize`/`isSoloModality`)
ya calcula `required = 1` para modalidades solo/1v1 — así que el mismo camino
de equipo, **sin ningún cambio adicional en esa función**, va a pedir
exactamente 1 titular (el propio líder) con Discord vinculado
(`validateTeamTournamentEligibility` ya revisa `missingDiscord` por
titular). No hace falta inventar un camino especial para "solo": un equipo
de 1 persona ya cumple el requisito y usa la misma infraestructura de
roster/Discord que el resto de los torneos.

**Cómo:**
1. Borrar el bloque `if (isSoloModality(...)) { ... return {...} }` (líneas
   1170-1179 de `registerTeamForUser`).
2. Confirmar que `teamQuery` (línea 1182, `{ leader: user._id, game: tournament.game }`)
   sigue resolviendo bien un equipo de 1 solo miembro — no filtra por tamaño
   de roster, así que no debería necesitar cambios.
3. Revisar si `isSoloModality` sigue usándose en otro punto de este archivo
   antes de dejar el import huérfano (`grep -n isSoloModality backend/src/controllers/tournament.controller.js`).
4. **El frontend ya está listo para este cambio** — `TorneoDetalle.jsx` y
   `TournamentRegistration.jsx` (20/sep) ya no distinguen `isSolo`: siempre
   muestran el flujo de "elegir/crear equipo" y siempre mandan
   `POST /tournaments/:id/register` con `{ teamId }` en el body, para
   cualquier modalidad. Con el bypass del backend eliminado, el requisito
   queda enforced en los dos lados (hoy solo lo aplica el frontend, que es
   fácil de saltar pegándole directo a la API).
5. **Ojo con quien ya se inscribió por el camino viejo** — torneos 1v1
   activos van a tener `registrations[].user` en vez de `.team`. Decidir si
   se migran o se dejan como excepción histórica; `mapRegistration` (línea
   289) ya maneja el caso `reg.user` para mostrarlos, así que no rompen la
   UI, pero van a ser los únicos inscritos sin equipo/Discord verificado.
- `frontend/src/routes/AppRoutes.jsx` — grupo `/jugador/*` (parche ya aplicado, se puede revertir a `RoleRoute` una vez que el backend deje de pisar `role`).

---

## [x] ✅ Discord: log de mensajes automáticos (visibilidad para el organizador) <a id="discord-log-mensajes"></a>

**Arreglado (21/sep):** `getTournamentDiscordLog` en `tournament.controller.js`
(antes de `retryTeamDiscordProvision`) + `GET /:id/discord-log` en
`tournament.routes.js`, montada junto a `/:id/discord-summary`. Devuelve
exactamente el shape de abajo, con `team` populado a `{ name }` para armar
`teamName`. **Corrección al "Dónde" de más abajo:** terminé sin agregar
`assertTabAccess` — releí `getTournamentDiscordSummary` (su vecina, la que ya
usa el frontend) y esa tampoco lo tiene, solo hereda el `requireAuth` de
`router.use()` en la línea 33. Meterle un chequeo más estricto acá habría
dejado la pestaña Mensajes con 403 mientras Resumen/Equipos (que sí usan
`discord-summary`) siguen andando para el mismo usuario — inconsistente. Si
se quiere `assertTabAccess` de verdad, hay que agregarlo a las dos rutas
juntas, no a esta sola.

**Contexto (21/sep):** rediseñé la pestaña Discord del panel de organizador
(`frontend/.../OrganizerTournamentManage.jsx`, componente `TabDiscord`) con
una sub-navegación (Resumen / Equipos / Torneo / Mensajes) porque hoy, si el
bot falla, el organizador no tiene forma de ver qué pasó ni de confirmar si
los mensajes automáticos (bienvenida del equipo, anuncios) realmente
salieron. La pestaña **Mensajes** ya está construida y llamando a
`tournamentsApi.getDiscordLog(id)` — pero el endpoint no existe todavía, así
que hoy muestra el estado "función no disponible" (detecta el 404 y no lo
trata como error real). Con el endpoint, esto queda visible solo.

**Qué:** un endpoint que devuelva `DiscordProvisionLog` (el modelo ya existe
en `backend/src/models/DiscordProvisionLog.js` y ya se escribe hoy —
`logDiscordProvision`, llamado desde `completeIntegrationEvent`/
`failIntegrationEvent` en `integrationEvents.controller.js` — solo que nadie
lo lee todavía).

**Dónde:**
- Nueva ruta `GET /api/tournaments/:id/discord-log` en
  `backend/src/routes/tournament.routes.js` (mismo lugar que
  `/:id/discord-summary`, línea 40).
- Nuevo controller en `tournament.controller.js` (o
  `integrationEvents.controller.js`, donde tenga más sentido): buscar
  `DiscordProvisionLog.find({ tournament: tournament._id }).sort({ createdAt: -1 }).limit(req.query.limit || 40)`.
  Aplicar el mismo `assertTabAccess(tournament, req.user, 'discord', 'view')`
  que ya usa `getTournamentDiscordSummary` para no abrir esto a cualquiera.

**Por qué:** ahora mismo, si el bot no logra mandar la bienvenida de un
equipo o un anuncio, esa falla queda solo en un `console.warn` del proceso
del bot (ver `discord-bot/services/provisionWorker.js`, el `.catch` de
`sendEmbed` en `provisionTeam`) o en este log de Mongo que nadie muestra —
el organizador no tiene ninguna pantalla donde enterarse, tiene que
adivinar o pedirle a alguien que revise los logs del servidor.

**Cómo:** shape esperado por el frontend (`log.map(entry => ...)` en
`TabDiscord`, sección Mensajes):
```json
{
  "entries": [
    {
      "id": "...",
      "createdAt": "2026-09-21T02:48:15.260Z",
      "action": "discord.team.provision",
      "status": "success",
      "message": "Evento procesado por el bot.",
      "teamName": "prueba"
    }
  ]
}
```
`status` es uno de `info|success|warning|error` (mismo enum que ya tiene el
modelo). `teamName` no está en `DiscordProvisionLog` (solo guarda `team` como
ObjectId) — hay que popular `team` con `select('name')` y armar `teamName`
en la respuesta, o el frontend simplemente no muestra el nombre. Si no hay
tiempo para el populate, devolver igual `team`/`tournament` como ids crudos
sin romper — el frontend ya tolera que `teamName` venga vacío.

**Nota aparte, no bloqueante:** en `discord-bot/services/provisionWorker.js`,
función `provisionTeam` (línea ~239), `[team.leader, ...team.members]`
duplica al líder si ya está en `team.members` (que sí lo está, ver
`team.controller.js:328`) — por eso `syncedPlayerDiscordIds` de equipos de 1
sola persona guarda el mismo id dos veces. No rompe nada, pero vale la pena
un `[...new Set(...)]` cuando alguien toque ese archivo.

---

<a id="discord-tickets-reales"></a>
## [x] ✅ Discord: sistema de tickets real en #soporte (categorias + notifica de verdad)

**Arreglado inicial (24/sep):** `#soporte` ya no queda pasivo: el mensaje inicial trae un menu de categorias, el bot abre un hilo/mensaje de ticket y menciona los roles de staff/organizador del torneo para que Discord si dispare notificacion. Queda como mejora futura guardar historial en Mongo/panel web y boton de cerrar ticket.

**Completado (6/oct):** modelo `TournamentSupportTicket` + `supportTickets.controller.js`. Al elegir categoria el bot pide un detalle (modal; obligatorio en "Otro problema"), el backend resuelve el equipo inscrito de quien reporta (por su Discord vinculado) y avisa en la web al organizador y al staff con acceso a la pestaña Discord (`tournament_support_ticket`). El hilo suma al jugador (antes no le llegaban las respuestas) y trae boton **Marcar resuelto** (solo roles de staff/organizador del torneo o `ManageGuild`). Panel web: pestaña Discord → **Tickets** (lista, enlace al hilo, cerrar). Cerrar desde la web encola `discord.support.resolved` y el bot archiva el hilo; al jugador le llega `tournament_support_resolved`. Rutas: bot `POST/GET /api/bots/support-tickets[/:id]`, `PATCH .../discord`, `POST .../resolve`; web `GET /tournaments/:id/support-tickets`, `POST .../:ticketId/resolve`. **Sigue abierto:** el hilo es publico (decision de visibilidad pendiente con Stephanie); torneos aprovisionados antes del 24/sep no tienen el menu en su `#soporte`.

**Reportado por Stephanie (22/sep):** "El bot en el canal de ayuda no le manda
ninguna notificación al usuario, ni al admin — no una conexión, realmente no
le llega a nadie." Pide que sea un flujo tipo ticket: el jugador elige de una
lista de problemas comunes, y eso le llega a la organizadora y a quien esté
moderando ese torneo en Discord, para que vayan directo al equipo con el
problema.

**No confundir con `/soporte`:** ese comando ya existe pero es otra cosa —
la línea de soporte prioritaria de GlitchGang HQ para organizadores con plan
de pago (`discord-bot/commands/soporte.js`), y además llama a
`backendApi.createSupportTicket` → `POST /support-ticket`, endpoint que
**no existe en el backend** (confirmado, no hay ninguna ruta `support-ticket`
en `backend/src/`) — así que hoy ni siquiera ese camino pagado funciona, tira
error si alguien con plan pago lo prueba. Esta tarea es sobre el canal
`#soporte` que el bot ya crea gratis para CADA torneo (`provisionWorker.js`,
`supportId` → `'soporte'`), donde el que ayuda es el staff/organizador de
ESE torneo puntual, no el equipo de GlitchGang.

**Confirmado en código (22/sep):** `tournamentSupportEmbed`
(`discord-bot/utils/tournamentAnnounceEmbeds.js:170-180`) es el único mensaje
que se postea ahí, una sola vez, y le dice al jugador "escribe aquí
explicando el equipo y el problema" — un canal de texto normal, sin botones
ni menú. Escribir un mensaje en un canal de Discord **no genera ninguna
notificación** salva que se mencione (`@rol`/`@persona`) explícitamente, así
que el staff solo se entera si está mirando el canal en ese momento. De ahí
el reclamo de que "no le llega a nadie".

**Qué:** reemplazar ese mensaje pasivo por un flujo de ticket con categorías
que sí mencione (y por lo tanto notifique) al rol de staff y al rol de
organizador de ese torneo específico.

**Dónde:**
- `discord-bot/utils/tournamentAnnounceEmbeds.js` — `tournamentSupportEmbed` (el mensaje inicial del canal).
- `discord-bot/services/provisionWorker.js` — ya tiene a mano `roles.staffRoleId` y `roles.organizerRoleId` de ESE torneo (línea ~151-155) al momento de crear el canal `#soporte`, y también sabe cuál es el canal `#staff` (`staffId`).
- `discord-bot/events/interactionCreate.js` — hoy solo despacha `ChatInputCommand` (slash commands); hay que agregar el manejo de `StringSelectMenu`/`Button`/`Modal` para este flujo (discord.js los distingue por `interaction.isStringSelectMenu()` / `isButton()` / `isModalSubmit()`, todo llega al mismo evento `interactionCreate`).
- `discord-bot/commands/ayuda.js` — mencionar el nuevo flujo en la sección `general`/`comandos` en vez de solo remitir a `/soporte` (que es el pago).

**Cómo (propuesta):**
1. Cambiar `tournamentSupportEmbed` para que el mensaje venga acompañado de un `StringSelectMenu` con placeholder **"¿Con qué necesitas ayuda?"** y opciones (las más comunes en un torneo, según Stephanie): "Mi sala no carga", "El voice no funciona", "El bot no entra a mi canal", "A un compañero se le fue la luz", "Otro problema" (con un campo libre corto).
2. Al elegir una opción: resolver automáticamente el equipo de quien reporta (mismo mecanismo que ya usa `/checkin` — `getTeamAndTournamentByChannel`/`team-by-channel` por canal de voz o roster con `discord.id`, ver la tarea de arriba "sistema completo del torneo", punto 3 de la actualización del 20/sep) para no tener que preguntarlo a mano.
3. Publicar el ticket como mensaje en `#soporte` (o mejor, como un **hilo** nuevo dentro de ese canal, uno por ticket, para no mezclar conversaciones) mencionando `<@&{staffRoleId}>` y `<@&{organizerRoleId}>` — la mención real es lo que dispara la notificación de Discord, no alcanza con que el rol tenga acceso al canal. Incluir: equipo, categoría elegida, quién lo abrió, hora.
4. Botón "Marcar resuelto" (visible solo para quien tenga el rol de staff/organizador) que cierra/archiva el hilo.
5. Opcional, no bloqueante: guardar el ticket también en Mongo (`Tournament.supportTickets[]` o un modelo aparte) para que se vea desde el panel web además de Discord — la pestaña Discord del organizador (`TabDiscord`) ya tiene espacio pensado para este tipo de cosas. Sin esto igual funciona (la mención en Discord ya resuelve "que le llegue a alguien"), solo que no queda historial fuera de Discord.
6. Actualizar el texto de `/ayuda` para que describa este flujo nuevo ("¿Tienes un problema? Entra a `#soporte` y elegí tu categoría — le llega directo al staff del torneo") en vez de remitir solo a `/soporte`.

**Decisión de producto a confirmar con Stephanie antes de programar:** ¿el
hilo de soporte debe verlo solo el staff de ese torneo, o también otros
jugadores del mismo equipo que reportó (para que puedan sumar contexto)? Y
si un jugador todavía no tiene equipo/roster confirmado (ej. antes de
inscribirse), ¿igual puede abrir un ticket sin que el bot sepa a qué equipo
pertenece? — con eso resuelto, el punto 2 de arriba puede simplificarse o
necesitar un campo manual de respaldo.

---

<a id="discord-comandos-duplicados"></a>
## [x] 🟢 Discord: comandos duplicados en el servidor

> **Hecho (3/oct):** `deploy-commands.js` sin `--dev` registra global y borra los comandos de servidor de `GUILD_ID` (PUT `[]`); `--clear-guild` solo limpia; `--dev` avisa que no se use en el servidor de producción. **Falta:** correr `npm run deploy` en el bot con el `.env` real.

**Reportado por Stephanie (22/sep):** los comandos del bot aparecen dobles
al escribir `/` en Discord.

**Causa encontrada (22/sep), leyendo `discord-bot/deploy-commands.js`:** el
script registra los slash commands en uno de dos "scopes" mutuamente
excluyentes de la API de Discord, según si se lo corre con `--dev` o sin
nada:
- **Sin `--dev`:** `PUT /applications/{CLIENT_ID}/commands` — registro
  **global**, visible en cualquier servidor donde esté el bot.
- **Con `--dev`:** `PUT /applications/{CLIENT_ID}/guilds/{GUILD_ID}/commands`
  — registro **solo en ese servidor** (`GUILD_ID` del `.env`), pensado para
  iterar más rápido mientras se prueba un comando (los guild-scoped se
  propagan al instante; los globales tardan hasta 1 hora).

El problema: estos dos registros son independientes entre sí para Discord —
**no se pisan ni se fusionan**. Si en algún momento se corrió el deploy una
vez SIN `--dev` (global) y otra vez CON `--dev` apuntando al mismo servidor
(lo normal si `GUILD_ID` en `.env` es el servidor real de GlitchGang, no uno
de pruebas aparte), ese servidor termina viendo **cada comando dos veces**:
una copia global + una copia propia del servidor, ambas con el mismo
nombre. Esto explica exactamente "los comandos salen dobles" sin que haya
ningún bug en el código de los comandos en sí.

**Qué:** dejar un solo registro vivo por servidor.

**Dónde:** `discord-bot/deploy-commands.js`. No hace falta tocar ningún
comando individual (`commands/*.js`) — es puramente un tema de cómo se
publican.

**Cómo:**
1. Confirmar el duplicado antes de tocar nada: `GET
   https://discord.com/api/v10/applications/{CLIENT_ID}/guilds/{GUILD_ID}/commands`
   y `GET https://discord.com/api/v10/applications/{CLIENT_ID}/commands` (con
   `Authorization: Bot {TOKEN}`) — si los dos devuelven la lista completa de
   comandos (no vacía), ahí está el duplicado confirmado.
2. Decidir cuál scope se queda. Para un bot que ya sirve a más de un
   servidor de torneo (el modelo actual es un solo servidor compartido de
   GlitchGang, pero a futuro podría no serlo), el registro **global** es el
   correcto para producción; el guild-scoped debería quedar solo para
   pruebas en un servidor de desarrollo aparte, nunca en el mismo `GUILD_ID`
   de producción.
3. Borrar los comandos de guild sobrantes con un PUT vacío: `PUT
   https://discord.com/api/v10/applications/{CLIENT_ID}/guilds/{GUILD_ID}/commands`
   con body `[]` — borra de una sola vez todos los guild-scoped de ese
   servidor sin tocar los globales.
4. Volver a correr `node deploy-commands.js` (sin `--dev`) una vez para
   asegurar que el registro global esté al día. Ese debería ser el único
   vivo en el servidor de producción a partir de ahí.
5. Se puede dejar agregado un flag nuevo como `--dev --clear` en el mismo
   script que automatice el paso 3, para que la próxima vez que alguien
   pruebe con `--dev` en el servidor equivocado sea fácil deshacerlo.

**Nota:** esto necesita `discord-bot/.env` con `TOKEN`/`CLIENT_ID`/`GUILD_ID`
reales para poder ejecutarse — hoy ese archivo no existe en este entorno
(ver memoria `discord-bot-config-not-set-up`), así que no lo pude correr yo
mismo para confirmarlo en vivo, solo por lectura de código.

---

<a id="discord-reglas-pdf"></a>
## [x] ✅ Discord: #reglas nunca muestra el PDF real del reglamento

**Arreglado (24/sep):** `tournamentRulesEmbed` ya convierte
`rulesDocument` en URL absoluta y agrega un campo "PDF del reglamento" con
`rulesName`. La resincronización automática de mensajes existentes sigue
cubierta por la tarea general de sincronización de Discord.

**Reportado por Stephanie (22/sep):** el canal de reglas está vacío/con una
sola línea, aunque ya existe un PDF real del reglamento que el equipo
preparó y subió desde el asistente de creación del torneo.

**Confirmado en código (22/sep):**
- `backend/src/models/Tournament.js:106-107` ya tiene `rulesDocument` (URL
  del PDF subido) y `rulesName` (nombre del archivo) — es un campo real,
  editable desde el paso "Reglas" del asistente (`rules`/`rulesDocument`/
  `rulesName` están mapeados al tab `reglas` en `tournament.controller.js:122`).
- Pero `rulesDocument`/`rulesName` **no aparecen en ningún archivo dentro de
  `discord-bot/`** (busqué en todo el directorio, cero resultados) — o sea
  que ni siquiera le llegan al bot en el payload que arma el backend cuando
  provisiona/sincroniza el torneo, mucho antes de que el bot decida qué
  mostrar con eso.
- `tournamentRulesEmbed` (`discord-bot/utils/tournamentAnnounceEmbeds.js:92-100`)
  es lo único que postea el bot en `#reglas`, y usa **solo** `tournament.rules`
  (el campo de texto corto): `rules || 'El organizador aun no publico el
  reglamento...'`. Si `rules` tiene una sola línea, eso es literalmente todo
  lo que ve el equipo en `#reglas`, sin importar que el PDF real ya esté
  subido y accesible por URL.

**Qué:** que si el torneo tiene un PDF de reglamento subido, ese sea el que
se vea en `#reglas` (no solo el resumen corto de texto).

**Dónde:**
- Backend: dondequiera que se arma el payload del torneo para el bot/CRM
  (mismo lugar que hoy ya manda `title`/`rules`/etc. — revisar `bots.controller.js`
  y el flujo de sync a CRM mencionado en `tournament-discord-model`) — agregar
  `rulesDocument`/`rulesName` a ese payload.
- `discord-bot/utils/tournamentAnnounceEmbeds.js` → `tournamentRulesEmbed`.
- `discord-bot/services/provisionWorker.js` → donde se llama a
  `tournamentRulesEmbed` para postear/editar el mensaje de `#reglas`.

**Cómo:**
1. Backend: incluir `rulesDocument` (URL) y `rulesName` en el objeto
   `tournament` que le llega al bot.
2. `tournamentRulesEmbed`: si `tournament.rulesDocument` existe, agregar un
   link directo al PDF en el embed (ej. un campo "📄 Reglamento completo
   (PDF)" con el link, ya que `rulesDocument` es una URL de `/uploads/...`,
   no un archivo local para adjuntar de nuevo) además del resumen de texto
   si lo hay. Si `rules` está vacío pero `rulesDocument` sí existe, no
   mostrar el mensaje de "el organizador aún no publicó el reglamento" —
   ese aviso debería aparecer solo si NINGUNO de los dos existe.
3. Esto conecta directo con lo que ya estaba anotado en la tarea de arriba
   ("Discord: sistema completo del torneo", sección 3): cuando cambian
   `rules`/`rulesDocument`/`rulesName` en `updateTournament`, re-editar el
   mensaje fijado de `#reglas` — ese re-sync sigue sin existir, pero antes
   hace falta esto (el posteo inicial tampoco usa el PDF todavía, no es solo
   un problema de "no se actualiza", es que nunca se usó ni la primera vez).

---

<a id="staff-get-sin-redaccion"></a>
## [x] 🟡 Staff de torneo: `GET` no filtra campos por permiso, solo la pestaña se esconde

**Arreglado (23/sep, commit `382a93e`):** `getTournament` redacta segun el acceso resuelto del staff que pide el torneo (dueño/admin sin cambios). `staffMembers` se filtra a solo la propia entrada si `colaboradores` es `'none'` (no se borra el array entero -- el frontend usa `staffMembers.find(m => m.user === miId)` para resolver su propio acceso, borrarlo del todo lo hubiera dejado bloqueado). `reports` se quita del todo si `reportar` es `'none'` (tiene su propio endpoint protegido, el frontend nunca lee `reports` de este payload). Deliberadamente NO se reuso `FIELD_TAB_MAP` completo -- varios de esos campos (title/status/visibility) los lee tambien Resumen, que todo staff ve por defecto; confirmado leyendo `TabResumen` antes de aplicar el cambio. Probado con script contra Mongo real.

**Contexto (22/sep):** revisando el pedido de Stephanie de que un caster
"solo vea lo que el organizador quiere que vea", confirmé que el sistema de
permisos por pestaña (`Tournament.staffMembers[].permissions`, matriz de
default en `frontend/src/lib/staffPermissions.js`, aplicado en
`tournament.controller.js` vía `assertTabAccess`/`canWriteField`) ya existe
de punta a punta para **escritura** — de hecho arreglé de paso un bug de
frontend donde a CUALQUIER staff se lo forzaba a modo solo-lectura aunque
tuviera "editar" resuelto (`OrganizerTournamentManage.jsx`, comentario
desactualizado que decía "el backend todavía no soporta guardar cambios de
staff" — eso ya no es cierto, era código defensivo viejo).

Pero la **lectura** es otra historia: `getTournament`
(`tournament.controller.js:649-659`) devuelve el documento completo del
torneo a cualquiera que pueda verlo en absoluto (`canViewTournament`), sin
filtrar campos según la matriz de permisos de quien pregunta.
`sanitizeTournamentIdentityPayload` (`backend/src/services/identityPayload.service.js:35-45`)
solo saca `tournamentCode` y los códigos internos del organizador — nada
más. El frontend esconde la pestaña "Staff y permisos" para un Caster
(`colaboradores: 'none'` en la matriz default), pero la respuesta HTTP
igual trae el array `staffMembers` completo (nombres, emails si vienen
poblados, roles de todo el staff) — cualquiera que abra las devtools de su
navegador lo ve. Lo mismo aplicaría a cualquier otro campo marcado `'none'`
para un rol.

**Qué:** que la API devuelva, para un staff no-owner/no-admin, solo los
campos que su matriz de permisos resuelta (`resolveMemberAccess`) marca como
`'view'` o `'edit'` — no el documento completo con la pestaña simplemente
escondida del lado del cliente.

**Dónde:**
- `backend/src/controllers/tournament.controller.js` → `getTournament`
  (649-659), que ya tiene a mano `ROLE_DEFAULT_ACCESS`/`staffTabAccess` (52-90)
  usados en el camino de escritura — falta usarlos también en el de lectura.
- `backend/src/services/identityPayload.service.js` → `sanitizeTournamentIdentityPayload`,
  el lugar natural para sumar esta redacción (ya redacta `tournamentCode` ahí).

**Cómo (propuesta):** mapear cada tab de `FIELD_TAB_MAP` (tournament.controller.js:109-132)
a los campos reales del documento y, si `staffTabAccess(member, tab) === 'none'`
para quien pide, omitir esos campos de la respuesta (no solo del render). Ojo:
el owner/admin y cualquier request público (sin ese nivel de detalle) no
cambian — esto es específico para "soy staff aceptado pero no dueño/admin".

---

<a id="staff-roles-coach-analista"></a>
## [x] 🔴 Coach no puede ser staff de un torneo — ni el rol existe en el sistema

**Arreglado (23/sep, commit `5a73239`):** se agrego `'Coach'`/`'Analista'` a `STAFF_ROLES` y al enum de `Tournament.staffMembers.role`, `'coach'` a `PLATFORM_STAFF_ROLES`, y se corrigio `STAFF_ROLE_BY_PLATFORM` (`analyst -> 'Analista'` en vez de `'Arbitro'`, `coach -> 'Coach'`). Matriz de permisos por pestaña agregada para ambos roles nuevos en backend y frontend, mas el embed de Discord (`tournamentAnnounceEmbeds.js`). Probado con script contra Mongo real: `sanitizeStaffMembers` acepta los 2 roles, el enum de Mongoose valida un `staffMember` con `role:'Coach'` sin error.

**Reportado por Stephanie (22/sep):** "si yo soy coach y acepto un torneo
necesito ver los equipos, los brackets, quién está ganando, quién está
perdiendo, información del torneo, las marcas... y lo mismo con analista."
Confirmé en código que hoy eso es imposible para Coach y está roto a medias
para Analista — no es un problema de permisos finos, es que el rol ni
siquiera existe donde tendría que existir.

**Confirmado en código (22/sep):**
- `shared/tournamentSetup.mjs:10` — `STAFF_ROLES` (los únicos valores válidos
  para `Tournament.staffMembers.role`) es exactamente
  `['Director', 'Administrador', 'Arbitro', 'Moderador', 'Caster', 'Produccion']`.
  Ni "Coach"/"Entrenador" ni "Analista" están ahí.
- `backend/src/models/Tournament.js:128` repite ese mismo enum a mano en el
  schema de Mongoose (`role: { type: String, enum: [...], required: true }`)
  — dos fuentes separadas que hay que mantener sincronizadas.
- `shared/tournamentSetup.mjs:14` — `PLATFORM_STAFF_ROLES` (los roles de
  plataforma que aparecen como pestaña de búsqueda en "Staff y permisos") es
  `['organizer', 'caster', 'moderator', 'analyst', 'creator']`. **`coach` no
  está en esta lista** — por eso un perfil de Coach ni siquiera aparece en el
  buscador de `RoleStaffSearch` dentro de `TabColaboradores`. `analyst` sí
  está.
- `shared/tournamentSetup.mjs:15-17` — `STAFF_ROLE_BY_PLATFORM` mapea cada rol
  de plataforma al rol de torneo que le toca al agregarlo:
  `{ organizer: 'Administrador', caster: 'Caster', moderator: 'Moderador', analyst: 'Arbitro', creator: 'Produccion' }`.
  **Un Analista se guarda como `'Arbitro'`** — pierde su identidad de rol y
  hereda los permisos por defecto de árbitro (checkin/bracket/reportar en
  "editar"), no algo pensado para lo que un analista realmente necesita ver.
  No hay entrada para `coach` en este mapa tampoco.
- `frontend/src/lib/staffPermissions.js:34-58` — `ROLE_DEFAULT_ACCESS` tiene
  las mismas 6 claves nada más; `roleDefaults()` cae a `Moderador` para
  cualquier rol no reconocido (línea 62).
- Confirmado que "Coach" y "Analista" sí son roles reales de **plataforma**
  (aprobables vía solicitud de rol, `frontend/src/data/roleApplications.js:74-98,125-149`)
  — el problema es solo que nunca se conectaron con el sistema de staff de
  torneos.

**Qué:** que "Entrenador" (Coach) y "Analista" sean valores válidos de
`Tournament.staffMembers.role`, buscables y agregables como cualquier otro
rol de staff, cada uno con su propia fila en la matriz de permisos por
defecto — no una copia disfrazada de otro rol.

**Decisión de producto ya tomada con Stephanie (22/sep):** el punto de
partida de permisos de Coach puede ser conservador (calcado del de Caster:
solo "ver" en resumen/equipos/reglas/bracket/prizepool, nada de editar) —
**lo importante es que el organizador pueda ajustarlo libremente por pestaña
y por persona** desde "Staff y permisos" (`StaffPermissionsEditor`, ya
existe y ya funciona para cualquier rol — ver tarea de arriba sobre el
bug de solo-lectura que ya se arregló). O sea: el default es solo un punto de
partida razonable, no un límite — el admin decide caso por caso, como ya
pasa con los otros 6 roles.

**Dónde:**
- `backend/src/models/Tournament.js:128` — agregar `'Entrenador'` y
  `'Analista'` al enum de `staffMembers.role`.
- `shared/tournamentSetup.mjs`:
  - `STAFF_ROLES` (línea 10): agregar los 2 valores nuevos.
  - `PLATFORM_STAFF_ROLES` (línea 14): agregar `'coach'` (falta hoy).
  - `STAFF_ROLE_BY_PLATFORM` (líneas 15-17): agregar `coach: 'Entrenador'`, y
    cambiar `analyst: 'Arbitro'` por `analyst: 'Analista'`.
- `backend/src/controllers/tournament.controller.js` — `updateStaffMember`
  (línea 935, `STAFF_ROLES.includes(req.body.role)`) ya va a aceptar los
  nuevos valores solo con el cambio de arriba, no necesita tocarse aparte.
- `frontend/src/lib/staffPermissions.js` — sumar `Entrenador` y `Analista` a
  `ROLE_DEFAULT_ACCESS` (línea 34). Propuesta concreta para `Entrenador`
  (calcada de `Caster`):
  ```
  Entrenador: {
    resumen: 'view', config: 'none', equipos: 'view', reglas: 'view', checkin: 'none', prizepool: 'view',
    bracket: 'view', ruleta: 'none', marca: 'view', colaboradores: 'none', discord: 'none', reportar: 'none',
  },
  ```
  y para `Analista` lo mismo que `Caster` pero sin necesidad de `prizepool`
  si Stephanie prefiere — a definir con ella al implementar, no es una
  decisión técnica.
- `frontend/src/pages/coach/CoachDashboard/CoachDashboard.jsx` — **ya
  actualizado (22/sep)**: ahora llama a `tournamentsApi.staffMine('accepted')`
  igual que Caster/Analyst y muestra una tarjeta "Torneos donde soy staff"
  con equipos/check-in/staff/reglas y un botón directo al panel del torneo.
  Hoy siempre sale vacío porque el rol todavía no existe — en cuanto se haga
  este cambio de backend, funciona solo, sin tocar más este archivo.

---

<a id="staff-autopostulacion"></a>
## [x] 🟡 Postularse como staff de un torneo (hoy solo existe invitar)

**Arreglado (23/sep, commit `9ae12f8`):** nuevo status `'requested'` en `Tournament.staffMembers` (postulacion propia, distinto de `'pending'` = invitacion del organizador -- direcciones opuestas, cada una la resuelve quien no la inicio). `POST /tournaments/:id/staff/apply` valida rol aprobado, elegibilidad y duplicados; `updateStaffMember` acepta `status` para que el organizador apruebe/rechace una postulacion (nunca una invitacion `'pending'`, esa sigue solo por `respondStaffInvitation`). `StaffApply.jsx` (nuevo componente) embebido junto a `StaffInvitations` en los 5 paneles de rol (Coach/Caster/Analyst/Moderator/Creator); `OrganizerTournamentManage.jsx` (Colaboradores) muestra Aceptar/Rechazar para postulaciones. Probado con script contra Mongo real.

**Reportado por Stephanie (22/sep):** "si yo soy, por ejemplo, analista y
quiero participar y ser staff de un torneo, poder hacerlo — actualmente no
veo intención de eso." Confirmé que es así: busqué en todo el repo
(frontend y backend) cualquier flujo de "postularme"/"solicitar staff"/"join
staff" y no existe nada — el único "Postularme" que hay en el código es para
unirse al roster de un equipo (`Teams.jsx:4499`), nada relacionado a staff de
torneo. Hoy el 100% del flujo es: el organizador busca y agrega
(`TabColaboradores` → `RoleStaffSearch` → `addStaffMember`), la otra persona
solo puede aceptar/rechazar después. Nunca puede iniciarlo ella.

**Decisiones de producto ya tomadas con Stephanie (22/sep):**
1. No es automático para todos los torneos — **el organizador tiene que
   activarlo por torneo** (algo tipo "Buscando staff" en el torneo, apagado
   por defecto).
2. Postularse no entra directo — **queda pendiente y el organizador la
   aprueba o rechaza**, mismo control que ya tiene hoy al agregar staff a
   mano.

**Qué:** un botón "Postularme como staff" visible para un usuario logueado
con un rol de plataforma elegible (organizer/caster/moderator/analyst/
creator/coach — mismo universo que `PLATFORM_STAFF_ROLES`, una vez sumado
`coach` ahí, ver tarea de arriba) en un torneo que el organizador marcó como
"Buscando staff". Al postularse, crea una entrada en `staffMembers` con
`status: 'pending'` igual que si el organizador la hubiera agregado a mano —
aparece en "Staff y permisos" para que la apruebe o la rechace ahí mismo, sin
pantalla nueva para el organizador.

**Dónde (propuesta, a confirmar con Stephanie el detalle fino al implementar):**
- `backend/src/models/Tournament.js` — nuevo campo booleano, ej.
  `staffApplicationsOpen` (default `false`).
- Backend: nuevo endpoint tipo `POST /tournaments/:id/staff/apply` — valida
  que `staffApplicationsOpen === true`, que quien pide tiene un rol de
  plataforma elegible y que todavía no está en `staffMembers`, y crea la
  entrada con `role: STAFF_ROLE_BY_PLATFORM[user.role]` y
  `status: 'pending'`. A diferencia de `addStaffMember` (que exige
  `colaboradores: 'edit'` de quien llama), este endpoint el `user` sale del
  propio `req.user`, no de un `userId` que mande alguien con permiso — es la
  única vía donde el "staff" se agrega a sí mismo.
- Frontend: el toggle "Buscando staff" en algún lado de
  `OrganizerTournamentManage.jsx` (¿pestaña "Staff y permisos" o "Config"? —
  a decidir con Stephanie). El botón "Postularme como staff" en
  `frontend/src/pages/TorneoDetalle/TorneoDetalle.jsx` (que ya tiene una
  pestaña pública de staff, líneas ~595-612, hoy solo de lectura) o en las
  tarjetas de torneo del dashboard de cada rol (Caster/Analyst/Coach) — a
  decidir cuál da más visibilidad real sin saturar la página del torneo.
- El aviso automático al organizador cuando alguien se postula tiene el
  mismo hueco que ya está anotado arriba para las invitaciones manuales
  ("El aviso automatico por notificacion todavia no esta") — no es un
  problema nuevo de esta tarea, es el mismo de siempre.

---

<a id="role-profile-sin-editar"></a>
## [x] 🟡 No hay forma de editar el propio perfil de rol después de aprobado

**Arreglado (23/sep, commit `caee597`):** `PATCH /profile/me` con `professionalProfile` ya soportaba `moderator`/`caster` -- se completa para los 7 roles especializados y ahora acepta un `role` explicito en el body en vez de asumir siempre `req.user.role` (que no refleja bien una cuenta con varios roles aprobados a la vez -- mismo problema de fondo que `#role-pisado-por-brand`). Se valida que el rol pedido este realmente aprobado antes de escribir. `CoachDashboard.jsx` ya llama al endpoint real (antes solo guardaba en localStorage); Caster/Analyst/Moderator/Creator quedan con el backend listo pero sin editor propio en su dashboard todavia. Probado con script contra Mongo real: cuenta con `user.role:'player'` pero `'coach'` en `roles[]` guarda su professionalProfile de coach correctamente.

**Ver también:** [`IDEA-PERFIL-PROFESIONAL.md`](../IDEA-PERFIL-PROFESIONAL.md)
(raíz del repo) — esta tarea es el prerequisito directo de una idea más
grande que Stephanie pidió anotar (22/sep): un "perfil profesional" por
persona que se ve como tarjeta pública y expande a una página completa al
pedir más detalle. No implementar esa idea sin retomarla con ella primero.

**Contexto (22/sep):** Stephanie reportó que "Staff y permisos" en el panel
del organizador se ve mal y no tiene sentido — al usar "Buscar caster"/
"Buscar staff" salían fichas casi vacías. Investigando la causa real:
**no es un problema de diseño nada más, es que no hay dato que mostrar.**

`User.roleProfiles.<rol>.details` (`backend/src/models/User.js`, `details`
es `Mixed`, sin schema fijo) se llena **una sola vez**, en el momento de
aprobar la solicitud de rol: `adminReviewApplication`
(`backend/src/controllers/roleApplications.controller.js:264`) copia
literal lo que la persona escribió en `formData` al aplicar (tarifa,
disponibilidad, idiomas, años de experiencia, etc. — los campos exactos
están en `frontend/src/data/roleApplications.js`, `profileFields`/
`experienceFields` por rol). Después de eso, **no existe ningún endpoint
para que esa persona actualice su propio perfil** — ni para corregir un
error, ni para subir la tarifa, ni para agregar algo que no puso al
aplicar.

De hecho ya existe un editor de perfil en el frontend
(`frontend/src/pages/coach/CoachDashboard/CoachDashboard.jsx`,
`CoachProfile`) con campos de nombre/juego/disponibilidad/tarifa/sitio web
— pero `saveProfile` (línea ~81) solo hace `writeLocal(profileKey, profile)`
(`localStorage` del navegador de esa persona). Nunca llega al servidor, así
que ni el organizador ni el buscador de staff ven nada de lo que edite ahí.
Coach es el único rol que tiene siquiera este editor a medias — Caster y
Analista no tienen ningún formulario de edición.

**Ya mejoré mientras tanto (22/sep, frontend, sin esperar esto):**
- `frontend/src/components/RoleStaffSearch/RoleStaffSearch.jsx` ahora
  muestra TODO lo que ya está en `details` (tarifa, disponibilidad, idiomas,
  especialidad, años de experiencia, herramientas, y un extracto de la
  respuesta larga como bio) en vez de 3 chips genéricos sin etiqueta — y
  oculta del buscador cualquier perfil al que le falte un campo básico.
- `frontend/src/components/ProfileCompletionBanner/ProfileCompletionBanner.jsx`
  — aviso persistente ya agregado en los paneles de Coach/Caster/Analista
  que le dice a la persona exactamente qué le falta para aparecer en el
  buscador.
- Esto ya deja el buscador mucho mejor **para cualquiera que haya llenado
  bien la solicitud original** — pero sigue sin resolver "no puedo corregir
  ni actualizar mi perfil después".

**Qué:** un endpoint para que el usuario autenticado actualice su propio
`roleProfiles.<rol>.details`, limitado a los campos que ese rol declara en
`profileFields`/`experienceFields` (nunca a `<rol>Code`/`approvedAt`/
`applicationId`, que son immutable a propósito).

**Dónde:**
- `backend/src/routes/profile.routes.js` — nueva ruta, ej.
  `PATCH /me/role-profile/:role`.
- `backend/src/controllers/profile.controller.js` — nuevo handler: valida
  que `req.user.roleProfiles?.[role]?.approvedAt` exista (solo edita lo que
  ya tiene aprobado), whitelist de campos contra
  `PLATFORM_ROLES.find(r => r.id === role)` (mismo archivo de config que ya
  usa el frontend, `frontend/src/data/roleApplications.js` — si hace falta
  una copia/versión backend de esa lista de campos por rol, este es el
  lugar), y hace `$set` solo sobre `roleProfiles.<role>.details.<campo>`.
- `frontend/src/pages/coach/CoachDashboard/CoachDashboard.jsx` — cuando este
  endpoint exista, cambiar `saveProfile` para que además llame a este PATCH
  (hoy solo guarda local). Extender el mismo patrón de formulario a
  Caster/Analyst/Moderator, que hoy no tienen ningún editor.

---

<a id="staff-search-historial"></a>
## [x] 🟡 Buscador de staff no muestra historial real de torneos

**Arreglado (23/sep, commit `5ff062c`):** `searchStaffByRole` suma una agregacion (una sola consulta para toda la pagina de resultados) que cuenta `Tournament.staffMembers` con `status:'accepted'` por usuario y la expone como `acceptedTournamentsCount` -- `RoleStaffSearch.jsx` ya estaba preparado para mostrarlo, solo faltaba el dato. Probado con script contra Mongo real: cuenta solo entradas `accepted`, sube al aceptar una segunda.

**Contexto (22/sep):** Stephanie pidió que el historial de torneos en el
perfil de un caster/staff sea **automático, calculado por el sistema** (no
un campo que la persona escribe) — para que no se pueda inflar. El dato
existe (torneos donde esa persona quedó como staff aceptado), pero hoy solo
se puede consultar **para uno mismo**: `GET /tournaments/staff/mine`
(`tournament.controller.js`, `getMyStaffTournaments`, línea 565) resuelve
esto vía `req.user`, no sirve para que el organizador vea el historial de
OTRA persona mientras la busca.

**Qué:** que `GET /profile/staff` (`profile.controller.js`,
`searchStaffByRole`, línea 134 — el endpoint que ya usa `RoleStaffSearch`)
devuelva también, por cada persona encontrada, algo como
`acceptedTournamentsCount` (cantidad de torneos donde esa persona figura en
`staffMembers` con `status: 'accepted'`, mismo criterio que
`getMyStaffTournaments` ya usa para "los míos").

**Dónde:** `backend/src/controllers/profile.controller.js`,
`searchStaffByRole` (líneas 134-179) — sumar un `Tournament.countDocuments`
(o un `$lookup`/aggregate si se quiere evitar N+1) por cada `user.id` de los
resultados, mismo filtro que `getMyStaffTournaments`
(`tournament.controller.js:565-592`): `staffMembers.user` = ese id y
`status: 'accepted'`.

**Ya está listo del lado del frontend (22/sep):** `RoleStaffSearch.jsx`
ya renderiza `member.acceptedTournamentsCount` como "N torneos como staff"
si el campo viene en la respuesta — no hace falta tocar el frontend de
nuevo, con que el backend empiece a mandarlo alcanza.

---

<a id="role-aprobado-completar-perfil"></a>
## [x] 🟢 Avisar cuando un rol nuevo queda aprobado: falta el empujón a completar perfil

**Arreglado (23/sep, commit `9623589`):** `adminReviewApplication` (aprobar) manda un segundo `sendNotif` (`role_profile_complete_reminder`) ademas del ya existente `role_application_approved`, con el mismo link al panel del rol. Probado con script contra Mongo real: aprobar una solicitud de Caster crea las 2 notificaciones con el link correcto.

**Contexto (22/sep):** decidido con Stephanie — cuando se aprueba un rol
(caster, analista, coach, etc.), además del aviso de "¡ya tenés tu panel!"
que ya existe, mandar **una** notificación puntual invitando a completar el
perfil profesional (tarifa, disponibilidad, bio) — sin insistir después con
más notificaciones; el recordatorio permanente ya vive en el panel mismo
(ver banner agregado en la tarea de arriba, `ProfileCompletionBanner`).

**Dónde:** `backend/src/controllers/roleApplications.controller.js`,
`adminReviewApplication`, rama de aprobación (líneas 214-299) — justo
después del `sendNotif(...)` que ya existe en las líneas 287-292 (el de
"¡Rol de X aprobado!"), agregar un segundo `sendNotif(app.userId, { type:
'role_profile_pending', title: 'Completá tu perfil de <rol>', message:
'Agregá tu tarifa, disponibilidad y bio para que los organizadores te
encuentren.', link: '/<panel-del-rol>' })`. Nada más — el resto (el aviso
persistente, y qué campos exactamente le faltan a cada quien) ya lo resuelve
el frontend con `ProfileCompletionBanner` una vez que exista el endpoint de
edición (tarea de arriba, `#role-profile-sin-editar`).

---

<a id="posts-auto-siembra-falsa"></a>
## [x] 🔴 `listPosts` inventa publicaciones y se las atribuye a usuarios reales

**Arreglado (23/sep, commit `b6d7280`):** se quito el bloque de auto-siembra -- si no hay posts, el feed responde vacio (Comunidad ya maneja ese estado). Se agrego `backend/src/scripts/cleanup-fake-seeded-posts.js` (con `--dry-run`) y se corrio contra Mongo local: encontro y borro 210 posts falsos ya plantados en 3 cuentas (Angek, uxauditor4, avatarrepro1). **Pendiente:** correr el mismo script contra produccion si tiene el mismo problema (no se corrio desde este entorno).

**Encontrado (22/sep)** mientras revisaba de dónde iba a sacar datos reales
para el "alcance de publicaciones" del Estudio de Creador (que sí pude
construir con datos reales, ver `GET /posts?authorId=`).

`backend/src/controllers/post.controller.js`, `listPosts` (líneas 5-73): si
`Post.find(filter)` devuelve 0 resultados **y** no se pidió un `author`/
`community` específico (o sea, en el feed general vacío), el código:

```js
const users = await User.find().limit(5)
if (users.length >= 3) {
  const initial = [
    { author: users[0]._id, authorNick: users[0].nick, text: 'Inscripciones abiertas...', likes: 142, ... },
    { author: users[1]._id, authorNick: users[1].nick, text: 'Clutch 1v5 en la final...', likes: 318, ... },
    { author: users[2]._id, authorNick: users[2].nick, text: 'Nueva guía de setups...', likes: 96, ... },
  ]
  await Post.insertMany(initial)
  ...
}
```

Esto **escribe en Mongo de verdad** — no es un mock de UI como los que ya
limpiamos en Mensajería. Toma a los primeros 3 usuarios que existan en la
base (podrían ser cuentas de prueba, de administración, o la cuenta
personal de Stephanie si fue de las primeras en crearse) y les inserta
publicaciones con texto y likes inventados, sin que ellos las hayan escrito
ni aprobado. Si esto corrió alguna vez contra la base de producción, hay que
buscar y borrar esos 3 posts (`text` empieza con "Inscripciones abiertas
para el GG Summer Open", "Clutch 1v5 en la final de la liga interna", o
"Nueva guía de setups de humo") antes de que alguien los vea y piense que
esa persona los escribió.

**Qué:** sacar el auto-sembrado por completo. Un feed vacío debe mostrarse
vacío (con el estado "todavía no hay publicaciones", como ya se hace en
otros lados de la app), nunca inventar contenido a nombre de alguien.

**Dónde:** `backend/src/controllers/post.controller.js`, líneas 30-72 (todo
el bloque `if (posts.length === 0 && !author && !community)`).

**Antes de borrar el código:** revisar si esos 3 posts ya existen en la
base de producción (buscar por el texto exacto de arriba) y decidir con
Stephanie si se borran o se dejan (quedaron atribuidos a cuentas reales).

---

<a id="teams-staff-mine-inexistente"></a>
## [x] ✅ Panel de Analista pide una ruta que no existe (`/teams/staff/mine`)

**Arreglado del lado del backend (visto 22/sep):** `GET
/teams/staff/mine?role=` ya existe (`getMyStaffTeams`) y soporta
`coach`/`analyst`/`caster` buscando en `rosterSlots`. Caster/Analyst ya lo
usan; CoachDashboard queda anotado como integración de frontend si se quiere
mostrar esos equipos ahí también.

**Encontrado (22/sep)**, en el mismo repaso de paneles de rol.
`frontend/src/pages/analyst/AnalystDashboard/AnalystDashboard.jsx` llama a
`api('/teams/staff/mine?role=analyst')` esperando la lista de equipos donde
el usuario es el analista — pero `backend/src/routes/team.routes.js` no
tiene ninguna ruta `/staff/mine`. La llamada falla, el `Promise.allSettled`
lo atrapa, y el panel muestra "0 equipos analizados" siempre, sin ningún
aviso de error.

**Confirmado en el modelo:** `backend/src/models/Team.js` sí tiene el dato
que hace falta — `staff: { coach, coachId, manager, managerId, analyst,
analystId }` (un coach y un analista por equipo, por id) — el problema es
que no existe el endpoint que responda "dame todos los equipos donde
`staff.coachId` o `staff.analystId` soy yo".

**Qué:** un endpoint real, ej. `GET /teams/staff/mine?role=coach|analyst` →
`Team.find({ [`staff.${role}Id`]: req.user._id })`. Un mismo coach/analista
puede estar en varios equipos de categorías distintas a la vez (ej. Mobile
Legends y Call of Duty) — eso ya lo soporta el modelo tal cual está, no
hace falta cambiar el schema, solo agregar la ruta que lo consulte.

**Dónde:** `backend/src/routes/team.routes.js` (agregar la ruta) +
`backend/src/controllers/team.controller.js` (nuevo handler). Una vez que
exista, `CoachDashboard.jsx` y `AnalystDashboard.jsx` pueden mostrar sus
equipos reales (hoy Coach ni siquiera lo intenta pedir — hace falta sumarlo
ahí también cuando se implemente esto).

**Nota, para cuando se construya el detalle de cada equipo (pedido de
Stephanie, 22/sep):** ella quiere, al abrir un equipo desde este panel, el
roster completo Y un horario de clases/entrenamientos específico por
equipo — ese horario **no existe en ningún modelo hoy** (no hay
`TrainingSession`/calendario por equipo en el backend), es una pieza nueva
aparte de este endpoint, no alcanza con esta tarea sola.

---

<a id="brand-organizador-reputacion"></a>
## [x] 🟢 Centro de Marcas: falta reputación/calificación de organizadores

**Arreglado (23/sep, commit `14dee3e`), alcance basico acordado con Stephanie:** nuevo modelo `OrganizerReview` (rating 1-5 + comentario) + 4 endpoints (crear/editar upsert, listar+promedio, resumen bulk, mi reseña). Solo puede calificar un equipo que de verdad jugo un torneo `finished` de ese organizador (validado en backend, no solo en la UI). `OrganizerStatCard` muestra estrellas+promedio; `OrganizerReviewCard` (nuevo widget en `TorneoDetalle.jsx`) para calificar cuando el torneo esta finalizado y el equipo del usuario jugo. Sin moderacion todavia -- queda para una iteracion aparte si hace falta. Probado con script contra Mongo real (7 escenarios).

**Contexto (22/sep):** al construir el directorio de organizadores del
Centro de Marcas (`frontend/src/pages/brand/BrandOrganizers/`), Stephanie
pidió 4 cosas para comparar organizadores: torneos organizados, prize pool
manejado, equipos/jugadores alcanzados, y reputación/calificación. Las
primeras 3 ya están — se calculan en el frontend a partir de
`GET /tournaments?limit=200` (los torneos públicos ya traen `organizer`
poblado, `prizePool`, y `currentSlots`/`registrations` por torneo), sin
tocar el backend.

La reputación/calificación **no existe en absoluto** — no hay modelo de
reseña, ni de rating, ni de quién puede calificar a quién. Es un feature
nuevo de cero (¿quién puede calificar: solo staff que trabajó con ese
organizador? ¿marcas que ya patrocinaron? ¿es una nota 1-5, o un
comentario?) — necesita definirse con Stephanie antes de spec-earlo, no es
solo un campo que falta agregar.

---

<a id="team-wizard-base64-sin-confirmar"></a>
## [x] ✅ Asistente de creación de equipo: posible mismo bug de avatar/logo en base64

**Arreglado (24/sep):** el `PhotoUpload` del asistente de equipos ya usa
`uploadFile()` (`POST /uploads`) y guarda la URL devuelta, no el data URL.
Si la subida falla, muestra toast de error y no intenta persistir base64.

**En una frase:** el mismo anti-patrón que rompía fotos del roster y logos de sponsor en `MyTeamPanel.jsx` (ver abajo, `#team-wizard-base64-sin-confirmar` es el hallazgo hermano) puede estar presente también en el asistente de creación de equipo (`Teams.jsx`), sin confirmar todavía.

**Contexto (23/sep):** investigando un reporte real en consola ("Data URL decoding failed" + 404 de "fortnite") en la página de perfil de equipo, encontré y arreglé 2 bugs reales en `MyTeamPanel.jsx` (commit `0abbb06`): el logo de un sponsor y la foto de un jugador del roster se guardaban como `data:` URI crudo en vez de subirse primero a `/uploads` y guardar la URL real. Uno de los dos casos reales encontrados en Mongo (equipo "5 Furiosos") se migró a un archivo real.

De paso, agregué un **guard universal a nivel de Mongoose** (`backend/src/models/plugins/rejectDataUrlFields.js`, registrado globalmente en `database/mongo.js`) que rechaza CUALQUIER intento de guardar un `data:` URI en cualquier campo, de cualquier modelo, vía `.save()`/`.create()`/`.insertMany()` o `updateOne()`/`updateMany()`/`findOneAndUpdate()` — así que aunque exista el mismo bug en otro lado del código, ya no puede corromper datos en la base. Pero eso no arregla la experiencia: si `Teams.jsx` (el asistente de creación, `PhotoUpload`/`fileToDataUrl`, 5+ usos: roster inicial, coach, manager, analyst...) tiene el mismo problema, el usuario vería el guardado fallar con un error (en vez de una imagen rota en silencio como antes) pero seguiría sin poder subir esa foto.

**Qué:** confirmar si alguno de los 5+ puntos de `PhotoUpload` en `Teams.jsx` (buscar `fileToDataUrl`) termina mandando el `dataUrl` crudo a `POST /teams` (u otro endpoint) sin pasar primero por `/uploads`, igual que pasaba en `MyTeamPanel.jsx`. Si es así, aplicar el mismo fix: subir de verdad, guardar solo la URL real.

---

<a id="posts-guardados"></a>
## [x] 🟡 Publicaciones guardadas: no hay endpoint para listarlas

**Hecho (28/sep):** `GET /posts/saved?limit=` (default 50, máx 100) →
`listSavedPosts`. Comparte `mapPost` y `excludedAuthorIds` con `listPosts`
(sin posts ocultos ni de autores bloqueados en ningún sentido). Índice
`{ savedBy: 1, createdAt: -1 }` en `Post`.


**Reportado por Stephanie (24/sep):** en el Perfil, el botón "Guardar" de una
publicación dice "Guardado", pero no hay ningún lugar donde ver lo guardado.

**Confirmado en código:**
- `POST /posts/:id/save` (`savePost` en `post.controller.js`) agrega/quita el
  userId en `Post.savedBy` y devuelve `{ id, savedBy }`. Eso ya funciona.
- Ningún endpoint devuelve los posts guardados de un usuario.

**Qué:** `GET /posts/saved` (requiere auth) que devuelva `{ posts: [...] }`
con los posts donde `savedBy` incluye al usuario autenticado, más recientes
primero, con el mismo formato que `listPosts` (mismo mapeo de autor,
`savedBy`, likes, etc., para que `PostCard` los pinte igual).

**Dónde:** `backend/src/routes/post.routes.js`, registrada después de
`router.use(requireAuth)`. Controlador nuevo `listSavedPosts` en
`post.controller.js`; puede reutilizar el mapeo de `listPosts` (línea ~42).

**Cómo:** `Post.find({ savedBy: userId }).sort({ createdAt: -1 })`; excluir
posts bloqueados/ocultos igual que `listPosts`. Paginar con `limit` si se
quiere. Considerar un índice en `savedBy`.

**Frontend (ya hecho):** `Profile.jsx` tiene la pestaña "Guardados" (solo para
el dueño del perfil) que llama a `/posts/saved`; mientras el endpoint no
exista muestra "aún no está disponible". Al implementarlo funciona sola.

---

<a id="sala-staff-torneo"></a>
## [x] 🟡 Sala de staff por torneo (chat del organizador + staff)

> **Hecho (3/oct), puntos 1–6:** `Conversation.type` `tournament_staff` y `Message.kind` `staff_report`. `services/tournamentStaffRoom.service.js` decide los miembros (dueño + staff aceptado + casters activos + admins) y se sincroniza al aceptar/postular/aprobar/quitar staff y casters. `GET /tournaments/:id/staff-room` (404 a quien no es del staff). `POST /messages/conversations` rechaza `tournament_staff`. `staff_report` solo para Director/Administrador/Árbitro/Moderador/dueño/admin (403 si no). Probado (13/13). Pendiente opcional: que un `staff_report` cree el registro en `Tournament.reports`.

**Pedido por Stephanie (24/sep):** que el staff de un torneo pueda hablar
entre sí y con el admin (ej. un árbitro pide acceso a una sala, avisa que va a
bloquear a un jugador problemático). Una sala **por torneo**, no un grupo global.

**Frontend (ya hecho):** pestaña "Sala de staff" en el panel del torneo
(`TabSalaStaff.jsx`). Pide `GET /tournaments/:id/staff-room`; mientras eso no
exista muestra "aún no está disponible". Los mensajes usan los endpoints de
`/messages` que ya existen (leer: `GET /messages/conversations/:id`, enviar:
`POST /messages/conversations/:id/messages`, leído: `PATCH .../read`). Refresca
cada 8 s (no hay websocket).

**Qué falta en el backend:**
1. `Conversation.type`: agregar `'tournament_staff'` al enum
   (`backend/src/models/Conversation.js`). `context.kind = 'tournament_staff'`,
   `context.targetId = <tournament._id>`.
2. **`GET /api/tournaments/:id/staff-room`** (requireAuth): busca o crea la
   conversación del torneo y devuelve `{ conversation }` con el mismo mapeo que
   `mapConversation` (`id`, `title`, `participants`, …). Solo responde si quien
   pregunta es dueño, admin de GlitchGang o staff **aceptado** del torneo; si no,
   404. **El cliente nunca manda la lista de participantes** — la decide el servidor.
3. **Membresía sincronizada** (lo importante): `participants` = owner + `staffMembers`
   con `status: 'accepted'` + `staff.casters` activos + admins de GlitchGang.
   Sincronizar al aceptar invitación / aprobar postulación
   (`respondStaffInvitation`, `updateStaffMember`), al quitar staff
   (`removeStaffMember`, `removeTournamentCaster`) y al rechazar/abandonar.
   Título sugerido: `Staff · <tournament.title>`.
4. **Bloquear** que `POST /messages/conversations` con `type: 'tournament_staff'`
   cree o modifique estas salas desde el cliente (solo el servidor las crea).
5. **Mensajes con `kind: 'staff_report'`** (el front los manda cuando alguien marca
   "Marcar como reporte"): validar en `sendMessage` que solo Director /
   Administrador / Árbitro / Moderador / owner / admin puedan usar ese `kind`
   (el front solo esconde el checkbox, no es una barrera). Opcional a futuro:
   que un `staff_report` cree además el registro en `Tournament.reports`
   (hoy el front solo enlaza a la pestaña Reportar para hacerlo a mano).
6. Historial legible siempre por owner y admin (sirve de constancia si se acusa
   a alguien en el chat). Notificar (`sendNotif`) a los demás miembros ya lo hace
   `notifyRecipients` en `messages.controller.js`.

---

<a id="staff-apply-perfil"></a>
## [x] 🟢 Postulación a staff: exigir perfil profesional completo también en el servidor

**Hecho (28/sep):** `applyForStaff` responde `400 { code: 'PROFILE_INCOMPLETE',
missing, message }` con la **misma** regla que el botón del front: la lista de
campos (`roleApplications`, `roleFieldOptions`) y `roleProfileCompleteness` se
movieron a `shared/*.mjs`; los archivos de `frontend/src` quedaron como
reexportación (ningún import cambió). Al postularse se guarda
`staffMembers[].applicationCard` (snapshot de `details`, máx. 8 KB).
**Falta (frontend):** mostrar `applicationCard` en Colaboradores.


**Contexto (24/sep):** el frontend ahora bloquea el botón "Postularme" hasta que
el perfil profesional del rol esté completo (`missingProfileFields`), y cada
panel de rol (Caster, Analista) tiene su propia página "Perfil profesional"
(`/caster/perfil`, `/analista/perfil`) que guarda con `PATCH /profile/me`
(`role` + `professionalProfile`).

**Falta:** `applyForStaff` (`tournament.controller.js`) solo exige
`roleProfiles.<rol>.approvedAt`; no valida que `details` tenga los campos
básicos. Un cliente que llame la API directo se salta el bloqueo. Además, al
postularse conviene guardar un snapshot de `details` en el `staffMember` para
que el organizador vea la "carta de presentación" de esa persona en
Colaboradores sin ir al buscador.

---

<a id="staff-mine-acepta-por-nick"></a>
## [x] 🟡 `GET /tournaments/staff/mine` da por "aceptados" torneos que nunca se aceptaron

**Hecho (28/sep):** coincidencias por nick (`staff.arbitros`/`collaborators`)
→ `staffStatus: 'unconfirmed'` (no entran en `?status=accepted`, que es lo que
piden los 4 paneles de rol). Además había un tercer bug: un caster **quitado**
(`removedAt`) seguía entrando en la consulta y salía como staff aceptado;
ahora la consulta usa `$elemMatch { user, removedAt: null }`. Nuevo
`?role=` (sin distinguir acentos: `arbitro` = `Árbitro`).


**Reportado por Stephanie (24/sep):** en su panel de Caster y en el de Analista
salían los mismos torneos (incluidos algunos que no recuerda haber aceptado).

**Confirmado en código (`getMyStaffTournaments`, `tournament.controller.js` ~574):**
- Devuelve TODOS los torneos donde la persona es staff, sin distinguir rol; cada
  panel de rol pedía `staffMine('accepted')` y mostraba todo. **Frontend ya
  arreglado (24/sep):** cada panel filtra por `staffRole` (`lib/staffPanelRoles.js`).
- Además el filtro incluye coincidencias **por nick** en `staff.arbitros` y
  `collaborators` (texto libre, sin invitación ni aceptación), y a esas filas les
  asigna `staffStatus = 'accepted'` y `staffRole = 'staff'`. Cualquiera cuyo nick
  coincida con el texto escrito por un organizador "aparece" como staff aceptado
  sin haber respondido nada.

**Qué:** que `staff/mine` solo cuente `staffMembers` con su `status` real (y
`staff.casters` activos); las coincidencias por nick, o se eliminan o se marcan
`staffStatus: 'unconfirmed'` y no entran en `?status=accepted`. Opcional: aceptar
`?role=caster|analyst|...` para filtrar en servidor.

---

<a id="perfil-jugador-reclutamiento"></a>
## [x] 🟡 Perfil profesional de jugador + Buscar equipo + Reclutar (hecho 24/sep — falta desplegar)

**Pedido por Stephanie (24/sep):** todos ya tienen su perfil de jugador al registrarse (eso
no cambia). Se agrega un **perfil profesional de jugador** con tarjeta (como los roles),
cuyo único fin es llamar la atención de los equipos. Flujo:

1. **Jugador:** `/jugador/perfil` (tarjeta "Jugador Pro", se puede mostrar en el perfil principal)
   → `/jugador/buscar-equipo`: elige juegos/categoría, nivel, femenino, rango, y ve los
   equipos (reclutando o no) y **se postula con su tarjeta**. Ahí mismo ve "Mis postulaciones".
   El dashboard del jugador tiene el acceso "Buscando equipo".
2. **Equipo:** botón **Reclutar** (`/mi-equipo/reclutar`, solo el líder): define vacantes
   (roles, rango mín/máx, nivel, solo jugadoras, horario, idioma, descripción), abre/cierra el
   reclutamiento y **comparte** (copiar mensaje / enlace / compartir del dispositivo). El líder
   ve la **tarjeta y el contacto** del jugador en Solicitudes ("Ver tarjeta").

**Backend hecho (necesita desplegarse; sin eso la web avisa y guarda un borrador local):**
- `User.gamerProfile.pro` (Mixed, tope 8000 caracteres). El rango también se copia a
  `gamerProfile.ranks`. **El contacto (`pro.contact`) se quita del perfil público**
  (`applyProfilePrivacy`): solo lo ve el dueño y el equipo que recibe la solicitud.
- `showcaseCards` acepta `'proplayer'` (solo si tiene perfil profesional con juegos).
- `Team.recruitment { open, vacancies[] }` + `PUT /teams/:teamId/recruitment` (solo líder;
  máx. 5 vacantes, textos acotados, `open` exige al menos una vacante).
- `GET /teams?recruiting=true` (el listado ya devuelve `recruitment` y `gender/level`).
- `POST /teams/:teamId/requests` acepta `vacancyId` y `withCard`: guarda una **copia de
  `gamerProfile.pro`** en la solicitud (`joinRequests[].card`) y el líder la recibe en el
  panel de Solicitudes. Con `withCard: true` exige perfil profesional completo (400 si no).
- `GET /teams/requests/mine`: equipos a los que me postulé + estado.

**Pendiente / mejoras (no bloquean):**
1. **Coincidencia automática** (si algún día se quiere): al abrir un equipo su reclutamiento,
   avisar (notificación) a jugadores cuyo perfil encaja. Hoy el jugador busca y se postula él.
2. **Notificar al jugador** cuando el líder acepta/rechaza su postulación (hoy solo lo ve en
   "Mis postulaciones").
3. Filtros de rango/nivel/femenino hoy se aplican en el navegador sobre `GET /teams?limit=100`;
   si hay más de 100 equipos, moverlos al servidor.
4. Reactivar (o retirar) los tabs "Buscar Equipo / Buscar Jugadores" de `/equipos`
   (hoy "Próximamente", `section:teams-find`): esta pantalla del panel de jugador los reemplaza.
---

<a id="tarjetas-perfil-principal"></a>
## [x] 🟢 Tarjetas profesionales en el perfil principal (`showcaseCards`)

**Pedido por Stephanie (24/sep):** cada rol tiene una tarjeta (la misma tarjeta 3D
del perfil de jugador, con el perfil profesional) y la persona elige cuáles
mostrar en `/perfil`: la de jugador y/o la de cada rol que tenga aprobado.

**Hecho (frontend + backend):**
- `User.showcaseCards` (array de strings) en el schema; `PATCH /profile/me` lo
  acepta y lo filtra a `'player'` o roles con tarjeta **aprobados** (sin
  duplicados, nunca vacío). Se agregó a `PUBLIC_FIELDS` para que los visitantes
  vean las mismas tarjetas.
- Sin el backend desplegado, el dueño conserva la selección en su navegador y se
  le avisa; los visitantes solo verían la tarjeta de jugador.
- El rol `sponsor` tiene tarjeta pero no hay panel donde editar su perfil
  profesional todavía.

---

<a id="discord-control-center-general"></a>
## [ ] Discord general: Control Center del servidor GlitchGang

**Pedido por Stephanie (24/sep):** `/admin/discord-sync` debe dejar de ser solo
un panel informativo y convertirse en el CRM/Control Center del servidor general
de Discord (`discord.glitchgang.net`). Esto NO reemplaza el sistema de Discord
por torneo; es para manejar el servidor principal: noticias, sponsors, marcas,
versiones, reglas, soporte, sugerencias, bugs, foros y publicaciones
automaticas desde el admin.

**Frontend hecho (24/sep):**
- `/admin/discord-sync` ya tiene una pantalla nueva con tabs: Servidor, Canales,
  Publicaciones, Versiones, Foros e Historial bot.
- El historial del bot sigue leyendo la API real existente:
  `GET /admin/discord/events`.
- Lo nuevo esta preparado visualmente con datos mock/locales hasta que exista el
  backend.

**Hecho (27/sep) — Fase 1 + Publicaciones, de punta a punta (web → CRM → bot):**
- Bot (`internalBotApi.js`): `GET /status`, `GET /guild/channels`, `POST /publish`
  (embed con titulo/texto/enlace/imagen + boton de enlace; devuelve id del mensaje).
- CRM (`api/server.js` + `botBridge.js`): `GET /portal/discord/server`,
  `GET /portal/discord/channels`, `POST /portal/discord/publish` (mismo
  `GLITCHGANG_SITE_TOKEN` que torneos).
- Backend: modelos `DiscordServerConfig` (canal ↔ funcion: anuncios, noticias,
  versiones, reglas, patrocinadores, inscripciones, soporte) y
  `DiscordPublication` (`PUB-2026-0001`, estados `ready/published/failed/archived`);
  `discordPublications.service.js`; `discordControl.controller.js`; rutas
  `GET /admin/discord/server|channels|config|publications`, `PATCH /admin/discord/config`,
  `POST/PATCH /admin/discord/publications[/:id]`, `POST .../:id/publish|archive`.
- Noticia con estado `publicado` (crear o editar) → entra sola a la cola (idempotente
  por noticia). Nada sale a Discord sin que el admin le de **Publicar**.
- Probado con Mongo local + CRM real + bot simulado (canal faltante → `failed`
  con motivo; publicar → `published` con id de mensaje; no se re-encola).

**Para que funcione en local/prod:** la clave web↔CRM cae a `BOT_API_KEY` si
`GLITCHGANG_SITE_TOKEN` esta vacio (en ambos lados). Hoy `discord-bot/.env` la
tiene pero `backend/.env` no, y el CRM escucha en `CRM_PORT=3001` mientras el
backend apunta por defecto a `:3000`. En `backend/.env`: `BOT_API_KEY` (mismo
valor que el bot), `CRM_PORTAL_URL=http://127.0.0.1:3001`, `DISCORD_GUILD_ID`
(= `GUILD_ID` del bot). Luego reiniciar backend y `npm run dev` en `discord-bot/`.

**Hecho (28/sep) — administrar el servidor desde el panel:**
- Canales: crear (texto/voz/foro/categoria), editar (nombre, tema, modo lento,
  categoria) y borrar desde la pestaña Canales (las rutas ya existian, faltaba la UI).
- Automatizaciones (pestaña nueva): bienvenida y despedida configurables (canal,
  titulo, mensaje con `{usuario} {nombre} {nick} {servidor} {miembros}`, imagen,
  color, "Enviar prueba"), DM de vincular cuenta on/off, noticias que salen solas.
  Se guardan en `DiscordServerConfig.automations`; `GET /api/bots/organizations/:guildId`
  las devuelve cuando el guild es `DISCORD_GUILD_ID`, y `guildMemberAdd/Remove` las usan.
- Publicaciones ya enviadas: editar en Discord (mismo mensaje) y retirar de
  Discord (vuelve a la cola). `DiscordPublication` guarda `discordChannelId`/`discordThreadId`.
- Foros: salen los foros reales del servidor (antes buscaba `#foro-*`, que no
  existen); ver temas, crear tema con etiquetas, editarlo y borrarlo.
- Probado de punta a punta contra el servidor real (web → CRM → bot); todo lo de
  prueba se borro. `backend/.env` local ya tiene `BOT_API_KEY`, `CRM_PORTAL_URL`,
  `DISCORD_GUILD_ID`; **produccion necesita esas 3 tambien**.
- Nota: para el servidor principal, `/config bienvenida` del bot ya no manda — manda el panel.

**Sigue pendiente de la lista de abajo:** 3 (auto-cola desde Banners/Marcas/Sponsors),
4 (Versiones), 5 (#reglas fijo), 6 (Foros), programar publicaciones (cron).

**Que falta en backend:**
1. Crear una configuracion persistente del servidor general.
   - Modelo sugerido: `DiscordServerConfig`.
   - Campos: `guildId`, `serverName`, `inviteUrl`, `health`, `channels`,
     `automationToggles`, `lastSyncAt`, `updatedBy`.
   - Debe guardar IDs reales de canales como `#noticias`, `#reglas`,
     `#soporte`, `#sugerencias`, `#bugs`, `#versiones`, `#partners`,
     `#inscripciones`, etc.

2. Crear publicaciones administrables para Discord.
   - Modelo sugerido: `DiscordPublication`.
   - Campos: `publicId`, `type`, `sourceType`, `sourceId`, `title`, `body`,
     `ctaLabel`, `ctaUrl`, `targetChannelId`, `targetThreadId`, `status`,
     `scheduledAt`, `publishedAt`, `discordMessageId`, `discordThreadId`,
     `previewPayload`, `createdBy`, `publishedBy`, `error`.
   - Tipos minimos: `news`, `banner`, `brand`, `sponsor`, `version`,
     `rules`, `support`, `suggestion`, `bug`, `announcement`.
   - Estados minimos: `draft`, `ready`, `scheduled`, `published`, `failed`,
     `archived`.

3. Agregar IDs visibles para publicar desde otros paneles admin.
   - Noticias: ejemplo `NEWS-2026-0008`.
   - Banners/promos: ejemplo `BANNER-2026-0031`.
   - Marcas: ejemplo `BRAND-2026-0012`.
   - Sponsors: ejemplo `SPONSOR-2026-0005`.
   - Versiones: ejemplo `VERSION-BETA-0.4.0`.
   - El admin debe poder copiar ese ID o elegirlo desde el Control Center para
     crear una publicacion hacia Discord.

4. Crear modulo de versiones de plataforma.
   - Modelo sugerido: `PlatformVersion`.
   - Campos: `version`, `phase` (`alpha`, `beta`, `rc`, `stable`), `title`,
     `summary`, `changes[]`, `knownIssues[]`, `releaseDate`, `status`,
     `discordPublicationId`, `createdBy`, `publishedBy`.
   - Endpoints para crear, editar, listar, publicar y enviar changelog a
     Discord.

5. Conectar reglas de comunidad/empresa con Discord.
   - Guardar version actual de reglas y/o documento real.
   - Publicar embed/mensaje fijo en `#reglas` con enlace al documento vigente.
   - Registrar quien lo actualizo y que mensaje de Discord fue reemplazado.

6. Conectar foros de Discord con items internos.
   - Modelo sugerido: `DiscordForumItem`.
   - Foros minimos:
     - `foro-sugerencias`: post -> votos -> estado -> mejora aceptada/rechazada.
     - `foro-soporte`: post -> ticket -> asignado -> resuelto.
     - `foro-bugs`: post -> prioridad -> fix -> version.
     - `foro-versiones`: version publicada -> feedback -> ajustes.
   - Campos: `forumChannelId`, `threadId`, `authorDiscordId`, `authorUserId`,
     `title`, `body`, `tags`, `status`, `votes`, `linkedTicketId`,
     `linkedVersionId`, `assignedTo`, `lastDiscordActivityAt`.

7. Crear servicio unico para publicar en Discord.
   - Reusar/extraer lo que ya exista en `discord-bot/services`.
   - Servicio sugerido: `discordControlCenter.service.js`.
   - Responsabilidades: resolver canal, crear preview, publicar embed/mensaje,
     programar publicacion, actualizar mensaje existente, archivar, registrar
     logs y errores.

8. Logs/auditoria.
   - Cada accion debe guardar: admin, tipo de origen, ID de origen, publicId,
     canal destino, status, IDs de Discord, payload resumido y error si falla.
   - Puede reutilizar `DiscordProvisionLog` si encaja, o crear
     `DiscordControlLog` para no mezclarlo con torneos.

**Endpoints sugeridos:**
- `GET /admin/discord/control-center`: resumen completo del panel.
- `PATCH /admin/discord/config`: editar guild/canales/toggles.
- `GET /admin/discord/channels`: listar canales detectados del servidor.
- `POST /admin/discord/publications`: crear publicacion.
- `GET /admin/discord/publications`: listar publicaciones.
- `POST /admin/discord/publications/:id/preview`: generar preview.
- `POST /admin/discord/publications/:id/publish`: publicar ahora.
- `POST /admin/discord/publications/:id/schedule`: programar.
- `PATCH /admin/discord/publications/:id`: editar draft/scheduled.
- `POST /admin/discord/publications/:id/archive`: archivar.
- `GET /admin/discord/forum-items`: listar sugerencias/soporte/bugs/versiones.
- `PATCH /admin/discord/forum-items/:id`: cambiar estado/asignacion.
- `GET /admin/versions`: listar versiones.
- `POST /admin/versions`: crear version.
- `PATCH /admin/versions/:id`: editar version.
- `POST /admin/versions/:id/publish-discord`: publicar changelog en Discord.

**Integraciones que deben disparar publicacion o dejar lista una publicacion:**
- Admin Noticias -> crea `DiscordPublication` tipo `news`.
- Admin Banners/Promos -> crea `DiscordPublication` tipo `banner`.
- Admin Marcas -> crea `DiscordPublication` tipo `brand`.
- Admin Sponsors -> crea `DiscordPublication` tipo `sponsor`.
- Admin Versiones -> crea changelog y puede publicar en `#versiones`.
- Reglas comunidad/empresa -> actualiza `#reglas`.
- Soporte/sugerencias/bugs de Discord -> se sincronizan hacia el admin como
  items internos revisables.

**Orden recomendado de implementacion:**
1. Modelos `DiscordServerConfig`, `DiscordPublication`, `PlatformVersion` y
   `DiscordForumItem`.
2. Endpoints de lectura/escritura para que el frontend deje de usar mock.
3. Servicio de preview/publicacion hacia Discord.
4. Cron/worker para publicaciones programadas.
5. Webhooks/listeners del bot para foros, sugerencias, soporte y bugs.
6. Auditoria, retries y mensajes de error legibles en el panel.

---

<a id="crm-discord-voice-evidencia-organizador"></a>
## [ ] CRM Discord: evidencias de voice hacia panel organizador

**Correccion de enfoque (24/sep):** la evidencia de voice NO pertenece al
Control Center admin del Discord general. Pertenece al flujo operativo del
torneo: el bot/CRM registra la voz durante una partida y el panel del
organizador debe verla dentro de su torneo para revisar reclamos, incidentes y
reportes.

**Lo que ya existe en el bot/CRM:**
- SQLite del bot: `discord-bot/data/glitchgang.db`.
- Tabla `voice_sessions`: entradas, salidas, movimientos, canal, usuario y
  duracion.
- Tabla `match_recordings`: match, guild, canal, estado, participantes,
  screen share log, duracion, file path y size.
- Archivos locales: `discord-bot/data/recordings/<matchId>/`, con un `.pcm`
  por usuario y `metadata.json` al finalizar.
- Servicios existentes: `discord-bot/services/voiceMonitor.js` y
  `discord-bot/services/matchRecorder.js`.

**Que falta:**
1. Exponer una API interna del CRM/bot para entregar evidencia por torneo y por
   match, protegida con token interno.
2. El backend principal debe consumir esa API o sincronizar esos registros a
   Mongo para no depender de leer SQLite directo desde la web.
3. El panel del organizador debe recibir solo evidencia del torneo que le
   pertenece, nunca evidencia global de otros torneos.
4. Cada acceso/descarga debe dejar auditoria: quien entro, torneo, match,
   archivo o metadata consultada, fecha y motivo.
5. Definir politica de retencion: por ejemplo 30 dias si no hay reclamo, o
   conservar mientras exista disputa abierta.

**Endpoints sugeridos del backend principal hacia la web:**
- `GET /tournaments/:id/discord-voice/evidence`: resumen de sesiones y
  grabaciones del torneo.
- `GET /tournaments/:id/discord-voice/matches/:matchId`: detalle de una
  grabacion/match.
- `GET /tournaments/:id/discord-voice/matches/:matchId/download`: descarga
  protegida o enlace firmado, solo si el usuario tiene permiso.

**Endpoints sugeridos del CRM/bot hacia backend:**
- `GET /crm/voice/sessions?tournamentId=&matchId=`
- `GET /crm/voice/recordings?tournamentId=&matchId=`
- `GET /crm/voice/recordings/:matchId`
- `GET /crm/voice/recordings/:matchId/files/:fileName`

**Frontend preparado:**
- En el resumen del panel de torneo del organizador se agrego el bloque
  "Evidencia de voz y grabaciones" como lugar correcto para esta data.
- Hoy muestra que el backend esta pendiente; no inventa grabaciones ni datos.


<a id="socketio-doble-servidor"></a>
## [x] 🔴 Dos servidores socket.io sobre el mismo servidor HTTP tumban la API

**Ya arreglado (revisado 28/sep):** en `c3873d2` ("Fix realtime notifications
delivery") `server.js` dejó de llamar a `initializeRealtime`; solo queda
`initializeMessagesRealtime(server)`. `src/realtime/socket.js` sigue en el repo
sin uso (se puede borrar si nadie lo importa más adelante).


**Qué pasa:** `server.js` llama a `initializeRealtime(server)` (`src/realtime/socket.js`) y a
`initializeMessagesRealtime(server)` (`src/realtime/messagesRealtime.js`). Los dos crean un
`new Server(server, …)` en la misma ruta `/socket.io`. Cuando un navegador abre un websocket
(la pagina /mensajes lo hace siempre), ambos intentan hacer el upgrade del mismo socket y el
proceso se cae con:

```
Error: server.handleUpgrade() was called more than once with the same socket
```

Mientras el proceso reinicia, toda la API responde 500 (login, torneos, notificaciones…).
Verificado en local el 27/sep: cada visita a /mensajes tira el backend.

**Cómo:** un solo `Server` de socket.io compartido (crearlo una vez y pasarlo a los dos
modulos), o darle al de mensajes su propio `path` (p. ej. `/socket.io-messages`) y usar ese
mismo `path` en `frontend/src/lib/messagesSocket.js`.

<a id="csrf-carrera-primera-visita"></a>
## [x] 🟢 Cookie CSRF: la primera visita genera varios tokens a la vez

**Hecho (28/sep):** la cookie solo se emite desde `GET /api/csrf-token` (y
`/api/auth/csrf-token`); si ya hay cookie devuelve el mismo token, sin rotar.
Un POST protegido sin cookie → 403 (el reintento de `lib/api.js` pide el token
y repite). De paso: se usaba `setHeader('Set-Cookie')` (pisaba otras cookies
de la misma respuesta) → ahora `res.append`; y el atributo `HttpOnly=false`
no existe (su sola presencia activaba HttpOnly) → quitado. Verificado con la
app real por HTTP (8/8).


**Qué pasa:** `csrf.middleware.js` crea un token nuevo en *cada* respuesta si la peticion no
trae cookie. En la primera carga la app lanza varias peticiones GET en paralelo; cada una
devuelve un `Set-Cookie` distinto y el token que guardo el cliente puede no coincidir con la
cookie final → el primer POST responde 403 "Invalid CSRF token" (visto al abrir un chat nuevo
desde /amigos).

**Ya mitigado en el frontend:** `lib/api.js` pide el token otra vez y reintenta una vez ante
ese 403.

**Cómo arreglar el origen:** emitir la cookie solo desde `GET /api/csrf-token` (y no rotarla
en cada respuesta sin cookie), o derivar el token de la sesion.

---

<a id="notificaciones-tarjetas-accion"></a>
## [x] 🟡 Notificaciones: tarjetas de acción (8 tipos) — faltan 4 emisores y datos en `meta`

**Hecho (28/sep):**
- `join_request`: `vacancyRole` sale de la vacante real (`vacancyId` →
  `recruitment.vacancies[].roles`); el resto ya venía de `playerApplicationMeta`.
- `tournament_registration_next_steps`: `modality`, `startsAt`,
  `tournamentBanner`, `rosterCount`, `rosterRequired`, `missingDiscord`,
  `checkinOpensMinutesBefore`; ahora llega a **todo el equipo** (mensaje
  distinto para líder y miembros).
- `role_application_approved`: `roleId`, `roleLabel`, `profilePublic`
  (= el rol ya está en `showcaseCards`). **Se quitó** el segundo aviso
  `role_profile_complete_reminder`.
- `admin_ticket_reply`: `subject`, `adminNick`.
- Nuevos (`services/matchNotifications.service.js` + `onResultsConfirmed`):
  - `tournament_checkin_open` — al crear el check-in desde el bot, a todo el
    equipo, con `voiceChannelUrl` y `checkinDeadlineAt`. Refrescarlo no re-avisa.
  - `tournament_result_reported` — `/report` de un capitán con el rival sin
    reportar → al **líder** rival, con `reportedResult` desde su punto de vista.
    Sin marcador todavía (ver #poster-campeon: el bot no manda `marcador`).
  - `discord_sync_failed` — falla `discord.team.provision` → al líder, **solo
    la primera vez** (el evento se reintenta solo). `reason` se deduce del
    error del bot (`missing_permissions`/`not_in_guild`/`token_expired`/`not_linked`).
  - `tournament_match_ready` — un resultado deja definida una partida de
    ronda 2+ → a ambos equipos, con `matchChannelUrl` de su sala. La 1.ª ronda
    la cubre `tournament_bracket_ready`. Una vez por partida (ledger).


**Frontend hecho (27/sep):** las notificaciones que piden hacer algo ahora se
abren como "tarjeta de acción" (cabecera con visual, estado, datos clave,
próximos pasos, botón principal + secundarios). Plantillas en
`frontend/src/context/NotificationsContext.jsx` (`layout: 'action'`), vista en
`components/NotificationDetailModal/NotificationActionCard.jsx`. Todo sale de
`notification.meta`: **si un campo no viene, esa fila simplemente no se pinta**
(no se inventa nada). En dev, `/notificaciones` → botón **Vista previa** carga las
8 con el `meta` completo de ejemplo (`frontend/src/data/notificationPreviews.js`
— es la referencia exacta de qué mandar).

Los 4 tipos que **ya existen** funcionan hoy, pero con menos datos. Los 4
**nuevos** no los emite nadie todavía. Todos se crean con `sendNotif()` como
siempre; los `tournament_*` ya caen en la preferencia "Torneos" por el prefijo.

### Ya existen — añadir campos a `meta`

| `type` | Dónde se emite | Añadir a `meta` |
|---|---|---|
| `join_request` | `team.controller.js` ~934 | `nick`, `teamName`, `avatar` (del postulante), `vacancyRole` (etiqueta de la vacante de `vacancyId`), `game`, `rank`, `hasCard` (`!!card?.entries?.length`) |
| `tournament_registration_next_steps` | `tournament.controller.js` `notifyTournamentRegistrationNextSteps` | `modality`, `startsAt` (ISO), `tournamentBanner`, `rosterCount`, `rosterRequired`, `missingDiscord` (array de nicks — ya lo calcula `validateTeamTournamentEligibility`), `checkinOpensMinutesBefore`, `announcementsUrl` opcional. **Y** mandarla también a los miembros del equipo, no solo al líder (el diseño es "Capitán y Miembros"). Con `rosterRequired` presente el front cambia la lista genérica `nextSteps` por un checklist ✓/!/pendiente. |
| `role_application_approved` | `roleApplications.controller.js` ~288 | `roleId`, `roleLabel`, `profilePublic` (boolean). Con esto se puede **quitar** el segundo aviso `role_profile_complete_reminder`: la tarjeta ya lleva "Configurar tarjeta profesional" como botón principal. |
| `admin_ticket_reply` | `systemTickets.service.js` `appendAdminTicketReply` | `subject` (`ticket.subject`), `adminNick` (`adminUser.nick`) |

### Nuevos — hay que emitirlos

| `type` | Cuándo | A quién | `meta` |
|---|---|---|---|
| `tournament_checkin_open` | Se abre la ventana de check-in (`tournamentMatches.controller.js` `checkinMatch`, o donde el bot/worker la abra) | Líder + titulares del equipo | `tournamentId`, `tournamentTitle`, `teamName`, `voiceChannelName`, `voiceChannelUrl` (`https://discord.com/channels/<guild>/<channel>`), `checkinDeadlineAt` (ISO, ya existe en `TournamentMatch`), `matchPath` opcional |
| `tournament_match_ready` | Se publica/avanza una ronda y el match tiene sala creada | Líder + titulares de ambos equipos | `tournamentId`, `tournamentPublicId`, `tournamentTitle`, `teamName`, `opponentName`, `round` o `roundLabel`, `bestOf`, `matchChannelUrl` |
| `tournament_result_reported` | Un capitán reporta marcador (`/report` del bot → backend) | Capitán **rival** | `teamName`, `reporterTeamName`, `teamScore`, `reporterScore` (desde el punto de vista del que recibe), `evidenceCount` o `evidenceUrls`, `autoApproveAt` (ISO) si existe aprobación por defecto, `matchPath` |
| `discord_sync_failed` | Falla asignar roles de Discord (provisionTournament / sync de roles en el bot → relay CRM → backend) | El usuario afectado | `reason`: `not_linked` \| `token_expired` \| `not_in_guild` \| `missing_permissions`, `errorDetail` (texto técnico corto, se muestra en "Ver motivo del error"), `impact` opcional |

Los 3 `tournament_*` nuevos y `discord_sync_failed` además sacan un toast en
vivo al llegar por socket (`URGENT_TOAST_TYPES` en el context).

### Lo que la tarjeta NO puede hacer todavía (no hay endpoint)

- **Confirmar marcador / abrir disputa** desde la notificación: hoy el reporte del
  bot va a un log aparte y no avanza la llave (ver memoria "match report doesn't
  advance bracket"). Los botones llevan a `/mi-equipo/enfrentamiento`. Falta
  `POST /tournaments/:id/matches/:matchId/confirm` y `/dispute`, y la regla de
  "10 min y se aprueba por defecto" (el front ya muestra la cuenta atrás si
  llega `autoApproveAt`).
- **Hacer check-in desde la web**: el botón lleva a `/mi-equipo/enfrentamiento`;
  el check-in real hoy es `/checkin` en Discord.
- **"Marcar ticket como resuelto"** por el usuario: solo existe
  `PATCH /system-tickets/admin/:id`. Se quitó el botón hasta que haya un
  endpoint de usuario.

<a id="ganador-avisos"></a>
## [~] 🟡 Ganar un partido / el torneo: nadie se entera en la web

**Hecho (28/sep), puntos 1–4 y W/L del 5:** `onResultsConfirmed(tournament,
prevResults, { source })` en `bracketSync.service.js`, llamado desde
`saveBracket` y `tryAutoSyncMatchReport` (los dos caminos hacen lo mismo).
- Lo ya procesado vive en `bracketDoc.processedResults` (por partida), **no**
  en flags dentro de `results`: el panel reenvía `results` entero desde el
  navegador y los pisaría. Guardar N veces no repite; desconfirmar revierte
  W/L; reconfirmar igual no re-avisa; corregir el ganador revierte W/L del
  viejo, suma al nuevo y avisa al nuevo.
- Torneos con resultados de antes de este cambio: la primera vez se siembra
  el registro como `legacy` (sin avisos, sin W/L, sin stats duplicadas).
- `tournament_podium` una vez (`bracketDoc.podiumNotifiedAt`); `prize` sale
  de `prizes[]` (`place` que empiece por 1/2/3). En formatos que no son
  eliminación simple, solo al campeón.
- Discord (`bracket.updated` / `tournament.finished`) solo si
  `discordEnabled` o si el resultado vino de `/report` (el bot falla con
  torneos sin guild).
- `recordPlayerStatsForNewlyConfirmedMatches` se movió al servicio; ahora
  también corre en el camino Discord.

**Falta:** `rankPts` (escala por decidir con Stephanie). Si se corrige un
ganador, el `PlayerMatch` ya creado no se reescribe (queda el resultado viejo).


**Qué pasa hoy (revisado 28/sep).** Un resultado se confirma por dos caminos y
cada uno hace cosas distintas:

| | `/report` en Discord (ambos coinciden) | Organizador en la llave web (`saveBracket`) |
|---|---|---|
| Avanza la llave | ✅ (solo eliminación simple) | ✅ |
| Anuncio en Discord de ronda / podio | ✅ `discord.bracket.updated` / `discord.tournament.finished` | ❌ no encola nada |
| `PlayerMatch` (historial del jugador) | ❌ no llama `recordPlayerStatsForNewlyConfirmedMatches` | ✅ |
| Notificación en la web al ganador | ❌ | ❌ |
| `Team.wins/losses/rankPts` | ❌ | ❌ (no se suman en ningún lado del backend) |

La idea es que **los dos caminos hagan lo mismo**. Conviene un único helper,
por ejemplo `onResultsConfirmed(tournament, prevDoc)` en
`backend/src/services/bracketSync.service.js`, llamado desde
`tryAutoSyncMatchReport` (después de `tournament.save()`) y desde `saveBracket`
(en `tournament.controller.js`, justo donde hoy se llama
`recordPlayerStatsForNewlyConfirmedMatches`). Mover esa función al servicio
evita el import circular.

"Recién confirmado" = `results[id].confirmed && !prevResults[id]?.confirmed`,
el mismo criterio que ya usan las stats. Así, guardar la llave 5 veces no
manda 5 avisos.

### 1. Notificación `tournament_match_won` (frontend listo)

- **A quién:** líder + `members` del equipo ganador (el equipo se resuelve por
  `name`/`tag`, igual que en `recordPlayerStatsForNewlyConfirmedMatches`).
- **Cuándo:** por cada partido recién confirmado que **no** es la final (la
  final la cubre el punto 2).
- **`meta`:** `tournamentId`, `tournamentPublicId`, `tournamentTitle`,
  `teamName`, `opponentName`, `teamScore`/`opponentScore` (si hay marcador; si
  no, se omiten y la tarjeta muestra "VS"), `roundLabel` ("Cuartos de final"),
  `nextRoundLabel`, `nextOpponentName` (si el otro partido de esa llave ya
  terminó; si no, se omite y el frontend muestra "Por definir"), `source`
  (`'discord-report'` | `'organizer'`).
  `buildSingleBracket(teams, results)` ya da las rondas para calcular la
  siguiente ronda y el rival.

### 2. Notificación `tournament_podium` (frontend listo)

- **Cuándo:** una sola vez, cuando el torneo pasa a `finished` con campeón
  (`!prevDoc.champion && doc.champion`).
- **A quién:** líder + miembros de campeón (`placement: 1`), subcampeón (`2`)
  y los dos terceros (`3`). `computePodium` ya existe en `bracketSync.service.js`,
  solo hay que exportarlo.
- **`meta`:** `tournamentId`, `tournamentPublicId`, `tournamentTitle`,
  `teamName`, `placement` (1|2|3), `finalOpponentName` (para 1 y 2), `prize`
  opcional (texto del premio del torneo si existe).

Las dos notificaciones salen como toast en vivo (ya están en
`URGENT_TOAST_TYPES`) y caen en la preferencia "Torneos" por el prefijo
`tournament_`. Vista previa en dev: `/notificaciones` → **Vista previa**
(`frontend/src/data/notificationPreviews.js`, ids `won` y `champion`).

### 3. Discord cuando el organizador cierra a mano

En `saveBracket`, para los resultados recién confirmados, encolar lo mismo
que ya encola `tryAutoSyncMatchReport`:
`discord.bracket.updated` por partido, y `discord.tournament.finished` con
`computePodium(...)` cuando se decide el campeón. Hoy, si el organizador
termina el torneo desde la web, **el campeón nunca se anuncia en Discord**.

### 4. Stats también en el camino Discord

`tryAutoSyncMatchReport` escribe `bracketDoc.results` pero no crea
`PlayerMatch`, así que esas partidas no aparecen en el historial ni en el
rendimiento del jugador. Se arregla solo con el helper común.

### 5. Sumar al equipo: `wins`, `losses`, `rankPts`

`Team.wins/losses/rankPts` existen en el schema y el ranking de equipos
(`team.controller.js` ~1109) los muestra, pero **nada los incrementa**. Por
partido recién confirmado: `$inc wins: 1` al ganador y `losses: 1` al
perdedor. Para `rankPts` falta decidir la escala (sugerencia: +10 por partido
ganado, bonus por podio 50/30/15). **Esto es decisión de producto**: preguntar
a Stephanie antes de fijar números.

### Casos borde

- Empate: `tryAutoSyncMatchReport` ya no lo lleva a la llave; no notificar.
- BYE / "Por definir": no notificar a nadie.
- Organizador **desconfirma** un resultado: no hay que "des-notificar", pero
  tampoco volver a notificar si lo reconfirma igual (usar un flag
  `winNotified` en el result, como `statsProcessed`).
- Formatos que no son eliminación simple: los puntos 1, 3 y 5 funcionan
  igual (solo usan `a`/`b`/`winner`). El 2 necesita `computePodium`, que hoy
  solo sirve para eliminación simple; en los demás, notificar solo al campeón.

<a id="poster-campeon"></a>
## [~] 🟢 Póster de campeón: títulos por serie y marcador desde Discord

> **Punto 1 hecho (3/oct):** `getTournament` devuelve `seriesChampion { titles, editions }` (ediciones de la serie hasta esta, por fecha). Cuenta por equipo con `Team.titles`, así que un cambio de nombre no rompe la cuenta; por nombre si no hay títulos. Índice `{ seriesId, status, date }`. **Falta el punto 2** (marcador en `/report`).

**Frontend hecho (28/sep):** cuando un torneo termina, la pestaña Resumen de
`/torneos/:id` muestra un póster de campeón (titular, camino a la final,
marcador de la final, subcampeón, 3.er lugar, patrocinadores) con botones de
**Descargar imagen** y **Compartir**. Se puede enlazar directo con `#campeon`.
Código: `frontend/src/lib/championPoster.js` (cálculo) y
`frontend/src/components/ChampionPoster/` (vista). Todo sale de la llave
publicada, de `sponsors[]` y de `registrations.team` (logo y color ya vienen
en el populate). Faltan 2 datos que solo tiene el backend:

### 1. `seriesChampion` en `GET /tournaments/:id`

**Por qué:** el titular dice "Bicampeón / Tricampeón…" y la etiqueta
"2 de 2 ediciones ganadas". Sin este campo el póster dice "Campeón" a secas
(no se inventa).

**Dónde:** `getTournament` en `tournament.controller.js`, solo si
`status === 'finished' && winner && seriesId`.

**Cómo:**
```js
// Ediciones terminadas de la misma serie HASTA esta (incluida), para que el
// poster de la edición 1 no pase a decir "Bicampeón" cuando gane la 2.
const editions = await Tournament.find({
  seriesId: t.seriesId, status: 'finished',
  seasonNumber: { $lte: t.seasonNumber || 1 },
}).select('winner').lean()
t.seriesChampion = {
  titles: editions.filter(e => norm(e.winner) === norm(t.winner)).length,  // >= 1
  editions: editions.length,
}
```
Hay un índice útil: `{ seriesId: 1, status: 1, seasonNumber: 1 }`.
Ojo: `winner` es el **nombre** del equipo (así lo guarda `bracketDoc.champion`);
si el equipo se renombró entre ediciones no va a contar. Si se quiere
robusto, guardar también `winnerTeam: ObjectId` al finalizar (en
`saveBracket` y `applyConfirmedResult`) y contar por ese id.

### 2. Guardar el marcador del `/report` de Discord

**Por qué:** si el resultado llega por Discord, el póster (y la llave pública)
solo pueden decir "Ganó", sin "2-1", y la línea "6-2 en juegos" desaparece.
Con el organizador sí hay marcador (`scoreA`/`scoreB`).

**Cómo:**
- Bot: añadir una opción opcional `marcador` a `/report` (texto `2-1`, desde
  el punto de vista del que reporta) y mandarla en el relay.
- `reportMatch` (`tournamentMatches.controller.js`): validar `^\d{1,2}-\d{1,2}$`
  y guardar `TournamentMatch.score = { mine, rival }`.
- `tryAutoSyncMatchReport`: si los dos reportes traen marcador y **coinciden
  en espejo** (el mío 2-1 = el suyo 1-2), pasarlo a `applyConfirmedResult`,
  que escribe `scoreA`/`scoreB` orientados a `match.a`/`match.b`, y también
  `series` (BO) si se conoce. Si no coinciden, se confirma igual el
  ganador, pero sin marcador (no marcar disputa solo por el marcador).

### Relacionado (ya en #ganador-avisos)

La notificación `tournament_podium` ya trae el botón **"Ver póster y
compartir"** (`/torneos/:id?tab=resumen#campeon`).

<a id="admin-role-bypass"></a>
## [x] 🟡 Roles: `PATCH /admin/users/:id/role` permite saltarse la aprobación

**Hecho (28/sep):** ruta y `setUserRole` eliminados (más las constantes que
solo usaba). Confirmado antes que ningún cliente la llamaba: ni frontend, ni
`discord-bot/`, ni `whatsapp-bot-crm/`. Si algún día hace falta quitar un rol
por soporte, hacerlo como endpoint aparte, solo para quitar, con registro.


En el panel admin → Usuarios había un select que cambiaba el rol directo con
`PATCH /admin/users/:id/role` (`setUserRole`, `backend/src/routes/admin.routes.js:78`).
Los roles deben pasar por la solicitud/aprobación (etiquetería) y activarse ahí.
El frontend ya **no** usa ese endpoint (ahora el rol se muestra solo de lectura).

- Quitar la ruta, o restringirla a quitar roles / casos de soporte con registro en logs.
- Confirmar que ningún otro cliente (CRM, bot) la llama antes de borrarla.

---

<a id="roster-congelado-checkin"></a>
## [x] 🔴 Roster congelado al check-in (urgente)

**Hecho (28/sep):** helper `assertRosterNotLocked(teamId)` en
`backend/src/services/rosterLock.service.js`, llamado desde `joinTeamForUser`,
`respondJoinRequest` (solo al aceptar), `leaveTeam`, `deleteTeam`,
`updateMyTeam` (solo si cambia quien ocupa un slot: slot nuevo/borrado o
nick/gameId distinto) y `updateMyRosterSlot` (reclamar slot vacio o cambiar
`gameId`). Respuesta: `409 { code: 'ROSTER_LOCKED', message, tournaments }`
(`errorHandler` ahora reenvia `err.payload`). El primer check-in (panel del
organizador y bot de Discord) guarda `registrations[].rosterSnapshot` +
`rosterSnapshotAt`; volver a marcar check-in no lo reescribe.
Pendiente aparte: `removeFromUniversityTeam` (`university.controller.js`, al
desvincular la universidad) todavia saca al usuario del equipo sin mirar el
bloqueo -- decidir si debe respetarlo. Las stats/PlayerMatch aun no leen el
snapshot.


**Qué:** desde que un equipo hace check-in en un torneo activo, nadie puede
entrar, salir ni cambiar de cuenta en ese equipo hasta que el torneo termine.
Hoy no hay ningún bloqueo: un equipo puede hacer check-in con 5 jugadores y
cambiar a 3 de ellos a mitad del torneo.

**Regla:** el equipo está "congelado" si tiene alguna inscripción con
`status: 'checked_in'` en un torneo con `status` en
`['open', 'registration_closed', 'ongoing']`. Se descongela sola cuando el
torneo pasa a `finished`/`cancelled`, o cuando esa inscripción pasa a
`withdrawn`/`disqualified`.

**Dónde bloquear** (`backend/src/controllers/team.controller.js`). Responder
`409` con `{ code: 'ROSTER_LOCKED', message, tournaments: [{ id, title }] }`:
1. `joinTeam` / `joinTeamForUser` (entrar con código).
2. `respondJoinRequest`, solo cuando `accept === true`.
3. `leaveTeam`.
4. `deleteTeam`.
5. `updateMyTeam`, solo si el patch trae `rosterSlots` y cambia **quién** ocupa
   un slot: un slot nuevo, uno borrado, o un `nick`/`gameId` distinto. Bio,
   avatar, redes, rango y disponibilidad se pueden seguir editando.
6. `updateMyRosterSlot`: bloquear reclamar un slot vacío y cambiar `gameId`.
7. Rutas admin que muevan miembros: quedan **exentas** a propósito (soporte).

Conviene un helper único `assertRosterNotLocked(teamId)` que usen los 6.

**Snapshot:** en el check-in (`tournament.controller.js` ~1455 y
`tournamentMatches.controller.js:408`), guardar en la inscripción
`rosterSnapshot: [{ userId, nick, gameId, slot }]`. Es la lista oficial de
quién juega ese torneo: sirve para disputas y para que las stats/PlayerMatch
usen a los jugadores que de verdad jugaron.

**Frontend (ya hecho):** `frontend/src/lib/useRosterLock.js` detecta el
check-in activo y `MyTeamPanel.jsx` muestra el aviso y frena salir, aceptar
solicitudes, quitar jugadores y cambiar nick/Game ID. `Teams.jsx`, `Profile.jsx`
y `JoinTeam.jsx` también llaman a `/teams/leave` y `/teams/join` y no tienen
el aviso: ahí lo único que los frena es el `409` del backend.

<a id="checkin-cierre-automatico"></a>
## [x] 🔴 Check-in: cierre automático con hora límite

**Hecho (28/sep):** `backend/src/services/checkinClose.service.js`, arrancado
en `server.js` junto a la publicación programada. Reglas:
- Cierre = `checkinDeadline` + `checkinConfig.toleranceMins`. Sin
  `checkinDeadline` no hay cierre automático (el organizador que no usa
  check-in no pierde a nadie).
- `autoWalkover: true` → las inscripciones en `registered` pasan a
  `disqualified` con `statusReason: 'no_checkin'` + notificación
  `tournament_checkin_missed` a todo el equipo; con 2+ equipos restantes se
  arma el bracket (`autoGenerateBracketIfReady`) y cada equipo recibe
  `tournament_bracket_ready` con su rival de primera ronda (o pase directo
  si le tocó BYE). El organizador recibe `tournament_checkin_closed`.
- `autoWalkover: false`, o **nadie** hizo check-in → no se descalifica a
  nadie; solo se avisa al organizador.
- Bracket ya armado a mano → no se toca nada.
- Cierre vencido hace >24h (torneos viejos) → se marca sin cambios.
- Se procesa una sola vez (`checkinClosedAt`); cambiar `checkinDeadline` o
  `checkinConfig` desde el panel lo reabre.
Sin hacer todavía: la hora de cada partida en el aviso ("juegas a las
HH:MM") depende de [#avisos-por-partida](#avisos-por-partida).


**Qué:** `autoGenerateBracketIfReady` (`bracketSync.service.js:52`) solo arma
el bracket si **todos** los equipos hicieron check-in. Si un equipo no se
presenta, el torneo se queda trabado. `checkinDeadline` y `checkinConfig`
(`prematchMins`, `toleranceMins`, `autoWalkover`, `botReminders`) ya se
guardan en el modelo, pero **ningún código los lee**.

**Cómo:**
1. Job cada 1–2 min (mismo patrón que `scheduledPublish.service.js`): torneos
   con `checkinDeadline <= now` y bracket sin generar.
2. Inscripciones que siguen en `registered` → `disqualified` (motivo
   `no_checkin`), con notificación al equipo.
3. Llamar a una variante de `autoGenerateBracketIfReady` con `force: true`
   que genere el bracket con los `checked_in` (mínimo 2) y le dé bye al que
   quede impar.
4. Notificar a cada equipo que quedó: "Tu rival es X, juegas a las HH:MM".

<a id="avisos-por-partida"></a>
## [x] 🟡 Horario por partida: duración + descanso + aviso previo

**Hecho (28/sep):**
- `Tournament.matchSchedule` (sub-schema **sin default**: si el organizador
  nunca lo guardó, no hay avisos) + `matchSchedule: ['checkin']` en
  `FIELD_TAB_MAP`. `PATCH` lo devuelve, así que el aviso "el servidor todavía
  no lo guarda" del panel desaparece solo. Fuera de rango → 400.
- Hora de cada partida = `results[id].scheduledAt` si el organizador la puso
  a mano; si no, `date` + ronda × (`durationMins` + `breakMins`). Se calcula
  al vuelo (no se escribe en `results`), así que cambiar el ritmo reprograma
  todo lo que falta.
- Job `matchReminders.service.js` cada 1 min: partidas sin resultado, con los
  dos equipos ya definidos (ni BYE ni "Por definir"), a `reminderMins` o
  menos de empezar → `tournament_match_soon` a los jugadores del
  `rosterSnapshot` (o a las cuentas del equipo si no hay). Una vez por
  partida (`bracketDoc.remindersSent`). Partidas atrasadas >24h no se avisan.
- Una ronda que se atrasa: la siguiente se avisa en cuanto se conocen sus
  equipos ("ya está lista para jugarse").

**Sigue pendiente:** solo eliminación simple (doble/round robin/suizo/grupos
no tienen hora por ronda todavía); aviso en la sala de Discord del equipo
(no existe evento del bot para eso); correr los horarios siguientes cuando una
partida se atrasa; mostrar la hora calculada al jugador (hoy el front solo
pinta `results[id].scheduledAt` manual).


**Qué:** el organizador define cuánto dura una partida y cuánto hay entre una
y otra. Eso se publica en el torneo ("cada partida dura ~30 min, hay 15 min
entre partidas") y en ese descanso se avisa a los que juegan la siguiente.

**Esquema** (`Tournament.js`):
```js
matchSchedule: {
  durationMins: { type: Number, default: 30, min: 5, max: 240 },
  breakMins:    { type: Number, default: 15, min: 0, max: 120 },
  reminderMins: { type: Number, default: 15, min: 5, max: 120 }, // aviso antes de cada partida
}
```
`updateTournament` debe aceptarlo, igual que `checkinConfig`: agregar
`matchSchedule: ['checkin']` a `FIELD_TAB_MAP` (`tournament.controller.js:131`)
y devolverlo en la respuesta.

**Frontend (ya hecho, 28/sep):** sección "3 - Ritmo de partidas" en el panel
del organizador → pestaña Check-in, editable, con vista previa de horas.
Guarda `PATCH { matchSchedule: { durationMins, breakMins, reminderMins } }`.
Si la respuesta no trae `matchSchedule`, avisa que el servidor todavía no lo
guarda.

**Cómo:**
1. Al generar el bracket, si una partida no tiene `scheduledAt`, calcularlo:
   inicio del torneo + ronda × (`durationMins` + `breakMins`).
2. Job: partidas con `scheduledAt - reminderMins <= now` que no se avisaron
   → notificación `tournament_match_soon` a los jugadores de ambos equipos
   (su `rosterSnapshot`) + mensaje en su sala de Discord si
   `checkinConfig.botReminders`. Marcar `reminderSentAt` en la partida para no
   repetir.
3. Si una partida se atrasa, las siguientes de ese equipo se corren (y se
   avisa). Primera versión: solo el aviso, sin correr horarios.

<a id="inscripcion-aprobacion"></a>
## [x] 🟢 Inscripción: automática (aprobación manual descartada)

> **Descartado (3/oct, Angel):** no habrá aprobación manual, ni en torneos
> universitarios ni en los demás. El sistema acepta solo al equipo que cumple
> las condiciones: roster completo, mismo juego, restricciones del torneo,
> identidad y Discord (`validateTeamTournamentEligibility`) y, si es solo
> universitario, equipo verificado por Microsoft (`eligibility.universityOnly`),
> todo en `registerTeamForUser`. Si falta algo, se rechaza con el motivo.

<a id="presencia-online"></a>
## [x] 🟡 Presencia real: amigos siempre salen "Desconectado"

> **Hecho (3/oct):** `realtime/messagesRealtime.js` cuenta sockets por usuario (varias pestañas): 0→1 `online`, 1→0 `offline` + `lastSeenAt`. Nunca pisa `ban`/`inactivo`; `activo` (lo que queda al desbanear) sí cuenta como presencia. Estado "Invisible" nunca sale en línea. Al arrancar el servidor se limpian los que quedaron `online`. De paso: `team.controller.js` y `PlayerTeams.jsx` marcaban en línea a cualquiera que no fuera `offline` (incluido `ban`). Probado con socket.io real (6/6).

**Síntoma (29/sep):** estás conectada, pero a tu amigo le sale tu círculo gris
y "Desconectado" en Amigos (y lo mismo en miembros de equipo).

**Por qué:** el frontend lee `User.status` (`'online'` → verde). Ese campo
nace en `'offline'` (`User.js:77`) y **ningún código lo cambia** al hacer
login ni al abrir el socket — solo el seed/dev lo pone en `online`
(`auth.service.js:465`). `getMyProfile` lo devuelve tal cual
(`profile.controller.js:395`, `.populate('friends', 'nick avatar status …')`),
igual `searchUsers` (`online: u.status === 'online'`) y `team.controller.js`
(`online: m.status !== 'offline'`).

**Cómo:** en `backend/src/realtime/socket.js`, dentro de `on('connection')`:
1. Contar sockets por usuario (un `Map userId → n`, porque puede tener varias
   pestañas). Al pasar de 0→1: `User.updateOne({_id}, { status: 'online' })`.
2. `socket.on('disconnect')`: al bajar a 0 → `status: 'offline'` (+ opcional
   `lastSeenAt: new Date()` para "visto hace X").
3. Al arrancar el servidor: `User.updateMany({ status: 'online' }, { status: 'offline' })`
   para limpiar los que quedaron pegados tras un reinicio.
4. Respetar `activeStatus: 'invisible'` → no marcar online.
5. Opcional: emitir `presence:update { userId, online }` a
   `user:<amigoId>` para que el punto cambie sin recargar.

**Frontend:** ya está listo — `Friends.jsx` (`presence()` en línea 14) muestra
verde/ausente/gris según `status`; no hace falta tocarlo para el paso 1–3.

---

## [x] 🟢 Perfil de universidad: `GET /university/catalog/:id` más completo

> **Hecho (4/oct):** tarjetas con logo/tag/color/publicCode/slogan/`memberCount`/`maxMembers`/roster (respeta `showRoster`/`publicProfile`; `members` ya es el conteo real), `achievements` con puesto, `rank`/`rankTotal`. `UniversidadPerfil.jsx` ya hace una sola llamada. **De paso, bug real del ranking universitario:** `calculateUniversityStandings` leía `tournament.bracket.rounds` (no existe en el schema) y solo contaba inscripciones `registered` (no `checked_in`) → partidas ganadas/campeonatos/finales salían siempre 0. Ahora lee `bracketDoc` con el mismo podio que los títulos (`titlesPodiumOf`). Verificado contra Mongo real (14/14).

**Contexto (30/sep):** ya existe la página `/universidad/:uniId`
(`frontend/src/pages/Universidad/UniversidadPerfil.jsx`) con pestañas Sobre /
Equipos / Juegos / Logros. Funciona con lo que hay hoy, pero para pintar las
tarjetas de equipo y los títulos hace **una llamada `/teams/:id` por equipo**
(máx. 12) y deduce títulos de `tournament.winner`. Funciona, pero es N+1 y los
logros no coinciden 100% con el ranking.

**Qué:** ampliar la respuesta de `getUniversityCatalogDetail`
(`backend/src/controllers/university.controller.js`):

1. **Equipos más ricos** — en `mapTeamCard` añadir: `logo`, `tag`, `color`,
   `publicCode`, `slogan`, `createdAt`, `memberCount` (= `members.length`),
   `maxMembers`, y `roster: [{ nick, avatar, role }]` (respetando
   `showRoster === false` y `publicProfile === false` como hace `getTeamById`).
   ⚠️ Bug actual: `members` devuelve `maxMembers` en vez de cuántos miembros hay.
2. **`achievements`** — lista de los torneos universitarios finalizados que ya
   calcula `calculateUniversityStandings`, con detalle:
   `[{ tournamentId, publicId, title, game, date, teamId, teamName, placement: 1|2|3|4 }]`,
   ordenada por fecha desc. Así "Títulos" sale de la misma fuente que los
   contadores `stats.championships/finals/semifinals`.
3. (Opcional) **`rank`** — posición en el ranking, para no pedir
   `/university/standings` entero solo para saber el puesto.

**Frontend:** cuando lleguen estos campos, `UniversidadPerfil.jsx` puede dejar
de llamar a `/teams/:id` y usar `achievements` directamente (avisar a Claude).

---

## [x] 🔴 Reglas de elegibilidad de equipos (femenino, país/región, universitario)

> **Hecho (4/oct):** reglas en `shared/teamEligibility.mjs` (las usa el back y `lib/teamEligibility.js` del front, una sola fuente). `Team.joinScope` en el schema + crear/editar. `teamEligibilityError` en solicitud, aprobación (vuelve a comprobar) y código de invitación (web y bot). `createTeam`: femenino solo lo crea una jugadora; universitario solo si `tiers` incluye `'universitario'` (403 si no está verificado). `updateProfile` no deja cambiar `gender` estando en un equipo femenino. Verificado contra Mongo real (23/23).

**Contexto (30/sep, decidido por Stephanie):** el wizard de Crear equipo ya
manda y muestra estas reglas, y el frontend avisa antes de unirse
(`frontend/src/lib/teamEligibility.js` → `joinBlockers`). **Pero solo el
backend las puede hacer cumplir**: hoy cualquiera entra con un link de
invitación o una solicitud directa.

**Qué — `backend/src/models/Team.js`:**
- Nuevo campo `joinScope: { type: String, enum: ['open', 'country', 'region'], default: 'open' }`.
- Añadir `'joinScope'` a las listas `allowed` de `updateMyTeam`
  (`team.controller.js` ~719 y ~730) y leerlo en `createTeam` (~330).

**Qué — una función `teamEligibilityError(user, team)` en `team.controller.js`**
(junto a `universityEligibilityError`, que ya existe) con las mismas reglas que
el frontend:
1. **Femenino**: si `normalizeGender(team.gender) === 'female'` (acepta
   "Femenino", "Female"…) y `user.gender !== 'female'` → 403
   `"Este equipo es solo para jugadoras."`. Non-binary NO entra (decisión).
2. **País**: `joinScope === 'country'` y `user.countryCode` ≠ `team.country`
   (ojo: "RD" es el código de plataforma; "DO" también es RD) → 403.
3. **Región**: `joinScope === 'region'` y la región del usuario (su
   `user.region` o la que sale de su país, mismo mapa que `REGION_BY_COUNTRY`
   en `teamEligibility.js`: CAR, CAM, LAN, LAS, NA, EU) ≠ `team.region` → 403.
4. "Masculino" e idioma **no bloquean** (decisión).

**Dónde se llama** (los tres caminos de entrada):
- `createTeam`: el creador tiene que cumplir la regla 1 (un equipo femenino
  solo lo crea una mujer).
- Enviar solicitud (`POST /teams/:id/requests`) y **aprobarla** (~1002, donde
  ya se llama `universityEligibilityError`).
- Aceptar invitación / unirse por link (`/teams/invite/:code` + join, ~944).

**Universitario — arreglar la lógica actual:** hoy `createTeam` convierte en
universitario **cualquier** equipo creado por un estudiante verificado, aunque
no marque "Universitario" (~365). Debe ser: solo si `tiers` incluye
`'universitario'`; y si lo incluye y el creador no está verificado → 403
`"Verifica tu universidad para crear un equipo universitario."`.

**Cambiar género del perfil estando en un equipo femenino:** en el endpoint de
editar perfil, si el usuario está en un equipo femenino, no permitir cambiar
`gender` (400 con mensaje claro) — si no, cualquiera entra y luego se cambia.

**Frontend:** ya listo. Wizard (`Teams.jsx`, sección Identidad y Universidad),
tarjeta (`GGTeamCard`), página de equipo e invitación (`JoinTeam.jsx`).

---

## [x] 🟡 Salir de un equipo concreto: `POST /teams/leave` ignora cuál

> **Hecho (4/oct):** con `teamId` (`_id` o `publicCode`) sale solo de ese equipo (404 si no pertenece); el líder sigue la regla de siempre (transferir o disolver si está solo). Sin `teamId`, igual que antes.

**Qué:** `leaveTeam` (`team.controller.js` ~1063) hace
`Team.findOne({ $or: [{ leader }, { members }] })` y sale del **primer**
equipo que encuentra. El frontend ya manda `{ teamId }` en el cuerpo
(`components/LeaveTeamModal`, usado en la página del equipo y en Panel
jugador → Mis equipos). Si alguien es líder de un equipo y miembro de otro
(organizadores), puede salir del equipo equivocado.

**Cómo:** si llega `req.body.teamId`, buscar ese equipo (por `_id` o
`publicCode`), comprobar que el usuario es miembro y que no es el líder
(400 "El líder debe delegar o disolver el equipo"), y sacarlo solo de ese.
Sin `teamId`, mantener el comportamiento actual.

---

<a id="competencia-aviso-cambios"></a>
## [x] 🟡 Competencia: avisar a jugadores y staff cada cambio confirmado

> **3/oct (tarde):** la web ya muestra "Comunicados del torneo" (`components/TournamentAnnouncements`) en la página pública del torneo y en `/mi-equipo/enfrentamiento` por cada torneo activo.

> **Hecho (3/oct), puntos 1–7 + candados + permisos:**
> - `services/tournamentAnnouncements.service.js`: valida `changeNotice`, avisa (`tournament_changed`) a inscritos no retirados + staff aceptado (sin el autor), encola `discord.tournament.changed` si hay canal de noticias, guarda en `Tournament.announcements` (últimos 50, salen en `GET /tournaments/:id`) y responde `changeNotice: { recipients, discord }`.
> - Bot: `announceTournamentChanged` publica el embed antes → después en `#noticias` del torneo.
> - Candados: `bracketLock` se movió a `shared/competitionLock.mjs` (el front lo reexporta). `updateTournament` responde `409 BRACKET_LOCKED` (sistema/grupos/puntuación/cupos con bracket generado; serie de ronda jugada; serie por defecto con resultados) y normaliza + valida `competition`. `saveBracket` no deja regenerar con resultados confirmados.
> - Permisos: `competencia` en `ROLE_DEFAULT_ACCESS` (Director/Administrador `edit`, resto `view`); `competition`/`maxSlots`/`format` → `['competencia','config']`. Ayuda del asistente GG agregada.
> - Probado contra Mongo real (16/16). **Falta (front):** pintar "Comunicados del torneo" con `announcements`.

**Contexto (1/oct, decidido por Stephanie):** nueva pestaña **Competencia** en el
panel del organizador (`frontend/src/pages/organizer/OrganizerTournamentManage/TabCompetencia.jsx`).
Arriba lleva una nota en rojo: *"Todo cambio que guardes y confirmes se
notificará a los jugadores y al staff del torneo"*. Guardar abre un modal con el
antes → después ("Semifinal: BO1 → BO3") y un mensaje opcional del organizador.
Al confirmar, el front manda en el mismo `PATCH /tournaments/:id`:

```json
{
  "competition": { ...ya normalizada... },
  "maxSlots": 16,
  "format": "custom",
  "changeNotice": {
    "section": "competencia",
    "sectionLabel": "Competencia",
    "title": "Cambios en la competencia de LIGA DE EL BARRIO 2",
    "message": "Por la cantidad de inscritos pasamos a grupos.",
    "changes": [{ "label": "Semifinal", "before": "BO1", "after": "BO3" }]
  }
}
```

**Hoy `updateTournament` ignora `changeNotice`** (no está en `FIELD_TAB_MAP`):
el cambio se guarda, pero nadie recibe nada. El front lo detecta porque la
respuesta no trae `changeNotice` y le muestra al organizador "el comunicado
todavía no se envía".

**Qué — en `updateTournament` (`tournament.controller.js`), si llega `changeNotice` y se guardó algo:**
1. **Validar**: `section` string corta, `title` ≤ 140, `message` ≤ 500,
   `changes` array ≤ 30 con `label/before/after` string ≤ 140. Si no es válido,
   ignorarlo (el cambio se guarda igual).
2. **Destinatarios**: todos los usuarios de los equipos inscritos con
   `status !== 'withdrawn'` (`teamUserIds` de `services/tournamentTeams.service.js`)
   + `staffMembers` con `status: 'accepted'` y `user`. Sin duplicados, sin el
   que hizo el cambio.
3. **Notificación** a cada uno con `notifyUsers`:
   `type: 'tournament_changed'`, `title`, `message` (el mensaje del organizador
   o las primeras 3 líneas de `changes`), `link: tournamentLink(t)`,
   `meta: { tournamentId, publicId, tournamentTitle, game, sectionLabel, changes, note: message, actorNick }`.
   El front ya tiene la plantilla (`NotificationsContext.jsx` → `tournament_changed`).
4. **Discord**: si `discordEnabled` y el espacio del torneo existe,
   `enqueueIntegrationEvent({ type: 'discord.tournament.changed', entityType: 'tournament', entityId, payload: { tournamentId, title, message, changes } })`
   y que el bot lo publique en el canal de anuncios/noticias del torneo (embed
   con la lista antes → después). Mismo camino que `discord.bracket.updated`.
5. **Historial para el panel del equipo**: guardar en
   `Tournament.announcements[]` `{ at, by, section, title, message, changes }`
   (máx. los últimos 50) y devolverlo en `GET /tournaments/:id`. Con eso el
   front pinta "Comunicados del torneo" en el panel del equipo y en la página
   pública (avisar a Claude cuando esté).
6. **Respuesta**: sumar `changeNotice: { recipients: <n>, discord: 'posted' | 'queued' | 'skipped' | 'failed' }`
   al JSON (`res.json({ ...tournament.toObject(), changeNotice })`). El front
   ya lo lee y muestra "Aviso enviado a N personas".
7. `logTournamentActivity` con un resumen legible ("Cambió Semifinal BO1 → BO3").

**Candados del lado del servidor** (hoy solo los aplica la UI; decisión 1/oct):
- Si `bracketDoc.published` o `bracketDoc.status` es `running`/`finished`:
  rechazar con `409 BRACKET_LOCKED` cualquier cambio de `competition.system`,
  `groups`, `advancePerGroup`, `groupsPhaseSystem`, `playoffsSystem`,
  `swissRounds`, `legs`, `thirdPlace`, `grandFinalReset`, `scoring` y `maxSlots`.
  El BO (`defaultSeries`/`seriesByRound`) sí se puede cambiar.
- No dejar cambiar la serie de una ronda con resultados confirmados (ni
  `defaultSeries` si hay alguna). La misma lógica del front está en
  `frontend/src/lib/competitionChanges.js` → `bracketLock()`: conviene moverla a
  `shared/` y usarla en los dos lados.
- "Regenerar bracket" (botón de la pestaña) hace
  `PUT /tournaments/:id/bracket { published: false, status: 'idle', results: {}, format: '' }`
  y solo se ofrece si no hay resultados confirmados. El servidor debería
  rechazarlo igual si los hay.
- Hoy `competition` se guarda tal cual llega: pasarla por
  `normalizeCompetition` + `validateCompetition` (de `shared/tournamentSetup.mjs`)
  también en `updateTournament`, como en `createTournament`.

**Permisos del staff:** la pestaña nueva es `competencia`.
- `FIELD_TAB_MAP`: `competition`, `maxSlots` y `format` → `['competencia', 'config']`.
- Copiar a `ROLE_DEFAULT_ACCESS` del controller la columna nueva que ya tiene
  `frontend/src/lib/staffPermissions.js`: Director y Administrador `edit`, el
  resto `view`.
- `assistantKnowledge.js` → `MANAGE_TAB_HELP.competencia` (texto de ayuda del asistente GG).

**Después (mismo patrón):** Stephanie quiere que el aviso rojo y el comunicado
también salgan con los cambios de calendario, requisitos, premios y reglamento.
El front reusará el mismo `changeNotice` con otro `section`; el servidor no
debería necesitar nada nuevo si esto se hace genérico.

---

<a id="titulos-equipo-jugador"></a>
## [~] 🟡 Títulos del equipo y del jugador + puntos de ranking + avisos de victoria

> **3/oct (tarde):** la web usa los títulos guardados (`GET /teams/:id` siempre trae `titles`; `GET /teams` y `/teams/mine` traen `titlesSummary` con `latestChampionship` y `latestSeriesTitles`); `lib/teamTitles.js` solo recalcula desde los torneos si el backend no los manda. Script `npm run migrate:tournament-titles` (dry-run; `--apply`) para torneos terminados antes de esto (también usa `winner` si es un nombre). Avisos nuevos con plantilla: `tournament_eliminated` (eliminación simple, con ronda y marcador), `tournament_finished` (equipos fuera del podio) y `tournament_prizes_pending` (organizador, qué premio a quién). `listTournaments` ya no expone el bracket sin publicar ni los registros internos. Probado (6/6 y 5/5).

> **Hecho (3/oct):** `services/tournamentTitles.service.js`, llamado desde `onResultsConfirmed` cada vez que cambia el podio (`bracketDoc.titlesKey`): revierte lo anterior y otorga `Team.titles` + `User.titles` (roster del check-in o, sin check-in, miembros) + `rankPts` (100/60/40 + 10 por serie ganada, ×1). Campeón vigente por `seriesId`. `GET /teams/:id` y el perfil traen `titles`; `GET /teams` trae `titlesSummary { count, championships, current, latest }`. Los cosméticos por torneo ahora salen de estos títulos (antes leían `PlayerTournamentResult` oficiales que **nada creaba**). Probado (13/13).
> **Falta:** (4) `circuitLevel` con su UI en el asistente; (6) `tournament_eliminated`/`finished`/`qualified`/`prizes_pending`/`prize_delivered` y la publicación automática; podio 2.º/3.º en doble/liga/suizo/grupos (hoy solo campeón); que la web use `titles` en vez de pedir todos los torneos (avisar al front).

**Decidido por Stephanie (1/oct):**
- Los títulos son **del equipo y de cada jugador que jugó** ese torneo (el
  `rosterSnapshot` que se congela en el check-in). Si el jugador cambia de
  equipo, sus títulos se van con él.
- **Nada de nombres fijos** para los niveles del circuito (semanal / mensual /
  trimestral): el organizador tiene que poder elegir cómo se llama cada nivel.
  Mientras tanto, el título es solo el puesto + el nombre del torneo.
- **Escala de `rankPts` aprobada**: Campeón +100, Subcampeón +60, 3º +40,
  +10 por cada serie ganada; multiplicado por el nivel (semanal ×1,
  mensual ×2, trimestral ×4). Hasta que exista el nivel, ×1.

**Qué hace hoy la web (frontend, 1/oct):** `frontend/src/lib/teamTitles.js`
pide `GET /tournaments?status=finished&limit=200` una vez por sesión y saca
el podio de `bracketDoc` con `computePodium` (movido a
`shared/bracketEngine.mjs`, el backend lo re-exporta igual). Con eso pinta la
vitrina en `/equipos/:id` (`components/TeamTitles/TeamTitleShowcase.jsx`) y la
cinta dorada de la tarjeta en `/equipos`. Funciona, pero:
- trae **todos** los torneos terminados con inscripciones y bracket completos
  (pesado a medida que crezca);
- `listTournaments` devuelve `bracketDoc` entero **aunque no esté publicado**
  (`getBracket` sí lo oculta): conviene no mandarlo en la lista, o solo
  `{ champion, format, teams, results }` cuando `published`;
- solo sabe 2º y 3º en eliminación simple; en doble, liga, suizo y grupos
  solo se conoce al campeón.

**Arreglado de paso en el front:** al culminar desde la llave web nunca se
mandaba `champion` en `PUT /bracket`, así que `winner` quedaba vacío y no
salían ni el aviso de podio ni el anuncio de Discord (solo funcionaba por
`/report`). Ahora se manda, calculado según el formato.

**Qué — backend:**
1. **Guardar los títulos** cuando `onResultsConfirmed` fija el podio (el mismo
   punto que hoy manda `tournament_podium`):
   - `Team.titles[]`: `{ tournament, publicId, tournamentTitle, game, seriesId, level, placement: 1|2|3, date }`.
   - `User.titles[]`: lo mismo + `team`, `teamName`, para cada `userId` del
     `rosterSnapshot` de esa inscripción (titulares y suplentes que estaban al
     check-in).
   - Idempotente (clave `tournament`): re-confirmar no duplica. Si el
     organizador corrige la final, reemplazar.
   - Podio también para otros formatos: doble (perdedor de la gran final = 2º,
     perdedor de la final del cuadro inferior = 3º), liga/suizo (tabla final),
     grupos (podio de los playoffs).
2. **Exponerlos:** `titles` en `GET /teams/:id`, en la lista `GET /teams`
   (solo `{ count, latest }` para la tarjeta) y en el perfil del jugador. La web
   usa esos campos si vienen y deja de pedir la lista de torneos (avisar a
   Claude).
3. **`rankPts`** con la escala de arriba, en el mismo punto (`Team.rankPts`).
4. **Nivel elegido por el organizador:** campo `circuitLevel`
   (`{ key, label, multiplier }`) en el torneo o en la serie, editable en el
   asistente. De ahí sale el nombre del título y el multiplicador.
5. **"Campeón vigente":** el último campeón de un `seriesId` lo es hasta que
   termine la siguiente edición. Devolver `current: true` en ese título.
6. **Avisos nuevos** (tipos para `NotificationsContext`; el front hará las
   plantillas cuando existan):
   - `tournament_eliminated`: al equipo que pierde una serie de eliminación
     (ronda, rival, marcador, próximo torneo de la serie si hay).
   - `tournament_finished`: al resto de participantes al terminar (campeón +
     su puesto final).
   - `tournament_qualified`: a los finalistas cuando clasifican al siguiente
     nivel del circuito (va con las invitaciones con plazo, ver
     [circuito](#competencia-aviso-cambios) y la memoria del plan).
   - `tournament_prizes_pending`: al organizador al terminar, checklist de
     premios por entregar (`prizes` + `prizeDelivery`).
   - `tournament_prize_delivered`: al equipo cuando el organizador marca el
     premio como entregado.
   - Publicación automática en Noticias + `#torneos` general de Discord con el
     campeón (cola de `DiscordPublication`, como los torneos publicados).

<a id="inventario-cosmeticos"></a>
## [ ] 🟡 Inventario de cosméticos: desbloqueos, regalos temporales y estados nuevos

> **3/oct (noche): Recompensas restaurada** desde `ff166bc^2` (última versión de `aaec89b`): `GET /rewards` (`rewards.controller.js` + rutas), `PointsContext` y `Rewards.jsx` reales. Adaptado: código con `getOrCreateReferralCode`, títulos desde `User.titles` (antes comparaba `winner`, un nombre, contra ids de equipo y nunca coincidía), redes desde `user.social`, amigos desde `User.friends`. Probado (4/4).

> **Actualización (3/oct, tarde):** los desbloqueos por torneo ahora salen de `User.titles` + haber jugado un torneo terminado. **Referidos arreglado:** el registro guardaba el código del invitador como propio; ahora va a `User.referredBy` y "Invita 3" cuenta esas cuentas. Script `npm run migrate:referral-codes` (dry-run; `--apply`) para cuentas que comparten código. **Regresión encontrada:** `aaec89b` (23/ago) tenía Recompensas real (`rewards.controller.js`, rutas, `PointsContext`); se perdió en un merge y la página volvió a la simulación con `localStorage`.

> **Hecho el 3/oct (Angel):** puntos 1, 2, 4, 5 y 6 + la parte deducible del 3.
> - `services/cosmetics.service.js` calcula los desbloqueos en el servidor:
>   bienvenida, Premium (`plan !== 'Free'`), perfil completo (mismo cálculo
>   que `completionScore` de Editar perfil), semana del cumpleaños (hora RD),
>   fundador (primeros 100 por `createdAt`) y torneos **solo oficiales**
>   (`source: 'tournament'`): primer torneo, podio, final, campeón y la
>   Corona/«Campeón reinante» por 7 días desde la fecha del 1.er lugar. No se
>   guardan: se deducen al vuelo, así que no hace falta un hook al cerrar el torneo.
> - `User.cosmeticGrants` existe para lo que no se puede deducir (con
>   `expiresAt`); hoy nada lo escribe.
> - `/auth/me`, login/registro y `PATCH /profile/me` mandan la lista en
>   `user.cosmeticUnlocks` (otro nombre que el campo guardado para que las
>   rutas que devuelven el usuario crudo, como avatar/fondo, no la pisen). El
>   frontend confía en ella y ya no cuenta los resultados cargados a mano.
> - `updateProfile` responde 403 si el marco/placa/estado está bloqueado y 400
>   si el id no existe (`config/cosmetics.js` tiene el catálogo nuevo).
> - Lo equipado que se venció (o ids viejos `pixel-rush`/`101`) vuelve a
>   `rgb`/`201`/`online` y se guarda al leer `/auth/me`, al iniciar sesión y
>   al ver el perfil público, así que no hace falta un job diario.
> - Enum de `activeStatus` ampliado; defaults de cuentas nuevas `rgb`/`201`.
>
> **Sigue pendiente:** quien otorgue MVP (no hay dato de MVP), racha de 5,
> top 10 de temporada, eventos de temporada (admin), votación del mes y logros
> de partida. **Referidos está roto antes de esto:** al registrarse, el código
> de invitación se guarda como `referralCode` del propio usuario nuevo
> (`auth.service.js`, `registerUser`), así que no hay forma de contar a quién
> invitó cada uno. El punto 7 (`activeAchievementCard`) tampoco está hecho.

**En una frase:** Editar perfil → Visual ya tiene los cosméticos nuevos
(16 estados, 10 marcos, 10 placas, 12 cartas de logro y 3 combos) con
bloqueo/desbloqueo por propósito, pero hoy el desbloqueo lo calcula el
navegador y nada lo valida ni lo otorga en el servidor.

**Pedido por Stephanie (2/oct):** cada cosmético tiene un propósito. Ejemplos:
regalo de bienvenida al crear la cuenta (permanente); ganar un torneo regala
la Corona y el estado "Campeón reinante" **por una semana**; MVP regala
Infección/Hacked/Sobrecarga por una semana; cumpleaños regala la placa Sakura
esa semana y pone solo el estado "Cumpleaños" ese día; Premium da Tormenta y
"Señal glitch" mientras el plan esté activo; etc. La lista completa de
propósitos está en `frontend/src/data/cosmetics.js` (`UNLOCK_SOURCES`) y cada
ítem tiene su `source`.

**Qué hace hoy la web:** `frontend/src/lib/cosmeticUnlocks.js` calcula lo que
puede con datos reales: cuenta creada, `plan !== 'Free'`, `birthDate`, perfil
al 100% y `GET /players/me/tournaments` (primer torneo, podio, final,
campeón y los 7 días de la Corona desde la fecha del 1.er lugar). Lo demás
(MVP, racha, ranking, referidos, eventos, fundador, logros de partida) queda
bloqueado hasta que el backend mande grants. Si el usuario tiene equipado
algo que se le venció, la web lo cambia al regalo de bienvenida al guardar.

**Qué falta:**

1. 🔴 **`User.activeStatus` tiene un enum viejo.** Agregar
   `'hack', 'king', 'surge', 'streak', 'glitch', 'virus', 'e404'` en
   `backend/src/models/User.js`. Hoy, si alguien elige uno de esos, el PATCH
   falla con `` `king` is not a valid enum value for path `activeStatus` `` — la
   web reintenta sin el estado y avisa "Ese estado todavía no se puede
   guardar", así que no rompe, pero no se guarda. (`bday` NO va: es
   automático, nunca se guarda.)
2. **Inventario con vencimiento** en `User`:
   `cosmeticGrants: [{ kind: 'status'|'frame'|'plate'|'card', item: String,
   source: String, grantedAt: Date, expiresAt: Date|null, ref: ObjectId|null }]`
   (`item` de las placas es el número como string, ej. `'210'`). Devolverlo en
   `/auth/me`, en `GET /profile/me` y en `PUBLIC_FIELDS` no hace falta. El
   frontend ya lo lee: si llega un grant vigente, manda sobre lo calculado.
3. **Quién otorga cada grant:**
   - Al registrarse: `welcome` → estado `hack`, marco `rgb`, placa `201`.
   - Al cerrar un torneo (donde ya se calcula el podio, ver
     [Títulos del equipo y del jugador](#titulos-equipo-jugador)):
     al campeón `champion` → estado `king` + marco `crown` con
     `expiresAt = cierre + 7 días`, y carta `gold` permanente; al finalista
     carta `silver`; al podio carta `bronze` y placa `205`; a todos los que
     jugaron marco `hud` y placa `202`. **Solo con resultados oficiales**
     (`PlayerTournamentResult.source === 'tournament'`); hoy la web cuenta
     también los que el jugador carga a mano.
   - MVP del torneo: `mvp` → estado `surge`, marco `virus`, placa `209`
     por 7 días + carta `mvp` permanente.
   - Racha de 5 victorias: `streak` → estado `streak`, marco `flames`,
     placa `206`; se quitan al perder.
   - Ranking top 10 de temporada: marco `portal`, placa `207`.
   - Referidos (3 registrados): estado `e404`, marco `crystal`.
   - Eventos de temporada (admin): estado `virus`, marco `error404`,
     placa `208`, con `expiresAt` = fin del evento.
   - Fundadores (primeros 100 usuarios por `createdAt`): placa `210`.
   - Votación jugador del mes: carta `month`.
4. **Validar en `updateProfile`** (`profile.controller.js`) que
   `activeFrame`/`activeBadge`/`activeStatus` estén desbloqueados para ese
   usuario; si no, 403 o caer al de bienvenida. Hoy acepta cualquier valor.
   `backend/src/config/cosmetics.js` tiene los ids viejos y no lo usa nadie:
   reemplazarlo con los ids nuevos (`frontend/src/data/cosmetics.js`).
5. **Vencimientos:** un job diario (o al leer el perfil) que, si el
   cosmético equipado venció, lo cambie a `rgb` / `201` / `online`. El perfil
   público de otros jugadores muestra lo guardado tal cual.
6. Default de cuentas nuevas: `activeFrame: 'rgb'`, `activeBadge: 201` (hoy
   `'pixel-rush'` y `101`; la web ya los traduce al regalo de bienvenida).
7. Opcional: `activeAchievementCard` para destacar una carta de logro en el
   perfil. Hoy las cartas solo se ven como colección en Editar perfil.

## [ ] 🟢 TEMPORAL: quitar el laboratorio de capturas cuando se termine de probar

Añadido el 5/oct para que Stephanie pruebe la lectura con IA con capturas sueltas
(sin torneo ni roster). No guarda nada: recibe la imagen, llama a la misma
`extractMatchStats` y devuelve el JSON.

- **Qué:** `POST /api/admin/match-stats-lab` (solo admin, mismo límite por minuto
  que `/extract`). Body `{ dataUrl }` → `{ raw, model, ms }`.
- **Dónde:** `backend/src/controllers/matchStatsLab.controller.js` y 3 líneas
  marcadas `TEMPORAL` en `backend/src/routes/admin.routes.js`.
- **Cómo quitarlo:** borrar ese controller y esas líneas. En el frontend se borra
  a la vez `pages/admin/AdminStatsLab/` y las líneas `TEMPORAL` de
  `AppRoutes.jsx` y `AdminLayout.jsx`.

## [ ] 🟢 CRM de Discord: mandar los datos completos de cada torneo y de cada inscripción

Añadido el 6/oct. El CRM (discord.glitchgang.net) ya tiene páginas para Torneos (ficha
completa), Equipos y Grabaciones. Lo que el backend ya manda se ve. Faltan campos que
el CRM ya sabe mostrar y que hoy llegan vacíos.

- **Qué 1:** en `GET /api/bots/tournaments?guildId=` agregar al `.select(...)`:
  `format modality platform region prizePool currency entryFee winner lateRegistration timezone discordProvision.status`.
  Hoy solo manda `tournamentCode publicId title game date status maxSlots currentSlots registrationWindow`.
- **Qué 2:** en `GET /api/bots/tournaments/:id/teams` agregar a cada equipo los datos de
  su inscripción en ese torneo: `registrationStatus` (`registered | checked_in | disqualified | withdrawn`),
  `statusReason` y `registeredAt`. Usar `teamMeta.name/tag` cuando el equipo ya no exista
  o se haya renombrado, igual que `mapRegistration`.
- **Dónde:** `backend/src/controllers/bots.controller.js` (`listDiscordTournaments`) y
  `backend/src/controllers/tournamentMatches.controller.js` (`getTournamentTeamsForBot`).
- **Por qué:** el CRM pasa estos campos tal cual (`pickTournamentFields` en
  `discord-bot/api/server.js`). En la ficha salen formato, premio, campeón y el estado de
  Discord. En la pestaña Equipos sale si el equipo hizo check-in, se retiró o fue
  descalificado. Mientras no lleguen, esas fichas simplemente no aparecen; no se rompe nada.
- **Cómo:** solo lectura, sin cambios de modelo. Mantener `requireBotAuth`.
  Respuesta de teams:
  `{ teams: [{ id, name, tag, players, registrationStatus, statusReason, registeredAt }] }`.
