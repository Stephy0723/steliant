# Plan: sincronización de torneos con Discord (Web → Backend → CRM → Bot → Discord)

Este documento valida, archivo por archivo, si el flujo que se pidió funciona:

```
Web crea torneo → Backend guarda torneo y crea evento pendiente → Bot lee evento
→ Bot crea roles/canales/voice en Discord → Bot informa resultado
→ Backend actualiza estado → Web/Admin muestra listo o fallido
```

**Resultado de la validación: el flujo ya está construido (commit `8c4781a`,
"sincroniza torneos discord via crm", 17/sep), pero hoy no funciona de punta a
punta.** Faltan 3 cosas para que funcione: configuración (nadie la puso todavía),
un puente roto entre backend y frontend (el dato nunca llega a la pantalla que
lo muestra), y dos huecos de "cuándo se dispara" el aprovisionamiento.

Nota sobre "el CRM": no es `whatsapp-bot-crm/` (ese es otro sistema, para
WhatsApp). El "CRM" de este flujo es el panel interno de `discord-bot/api/server.js`
— corre como un proceso Express separado del bot de Discord, en el mismo repo
`discord-bot/`.

> **Decisión de arquitectura (confirmada 18/sep): el bot de Discord nunca debe
> hablar directo con el backend/la web, en ningún sentido — ni el bot llama al
> backend, ni el backend llama al bot.** Solo existen 2 conexiones permitidas:
> **Web (backend) ↔ CRM** y **CRM ↔ Bot**. El CRM es el único intermediario.
> Esto es más estricto que lo que hay hoy: como se ve en la sección 2, hoy el
> bot le pega directo al backend en más de 15 archivos (comandos, eventos, y
> todo el mecanismo de eventos nuevo). La Fase 1 de este plan es justamente
> cerrar eso.

---

## 1. Cómo funciona hoy (arquitectura real, ya escrita)

Son **3 procesos** que tienen que estar corriendo y hablando entre sí:

| Proceso | Dónde | Puerto | Rol |
|---|---|---|---|
| **Backend** | `backend/` (`npm run dev`) | 4000 | Mongo real, dueño de la verdad (`Tournament`, `Team`) |
| **CRM** | `discord-bot/api/server.js` (`npm run api`) | 3000 (código) / 3010 (`.env.example`) | Recibe el "sync" desde la web, guarda su propia copia en SQLite, genera códigos de equipo |
| **Bot** | `discord-bot/index.js` (`npm run bot` / `npm start`) | interno 3055 | Tiene el `Client` real de discord.js — el único que puede crear canales/roles de verdad |

Camino de un torneo nuevo (`discordEnabled: true`, publicado):

1. `POST /api/tournaments` → `createTournament` (`backend/src/controllers/tournament.controller.js:405-419`) marca `tournament.discordProvision.status = 'pending'` y llama **síncrono** `syncTournamentCreatedToCrm(tournament, organizer)`.
2. `crmSync.service.js` hace `POST {CRM_BASE_URL}/portal/tournaments/sync` con header `x-glitchgang-site-key`.
3. El CRM (`discord-bot/api/server.js:774`) valida el token (`requirePortalToken`), guarda su copia local, genera códigos de equipo, y si `botEnabled` llama `botBridge.provisionTournament(tournamentId)`.
4. `botBridge.js` hace `POST http://127.0.0.1:3055/provision/tournaments` (el "puente" HTTP hacia el proceso del bot, porque CRM y bot son procesos distintos).
5. `internalBotApi.js` (corriendo DENTRO del proceso del bot) recibe eso y llama `provisionWorker.provisionTournamentFromCrm()`.
6. `provisionWorker.js` pide el torneo real al backend (`GET /api/bots/provision/tournaments/:id`), crea categoría + 3 roles + 7 canales + voz con `discordGuildService.js` (discord.js real), y devuelve el resultado. **⚠️ esta llamada del bot al backend es directa — viola la regla nueva.**
7. `provisionTournamentFromCrm` llama de vuelta `POST /api/bots/provision/tournaments/:id/done` en el backend → `completeTournamentProvisionDirect` pone `tournament.discordProvision.status = 'ready'` con los IDs reales. **⚠️ también directa, mismo problema.**
8. La respuesta burbujea de vuelta: bot → CRM → backend (la misma llamada síncrona del paso 2, que sigue esperando).

Cuando un **equipo se inscribe** (`registerTeamForUser`, línea 1146), el camino es distinto: no pasa por el CRM en absoluto. El backend crea un `IntegrationEvent` (`discord.team.provision`) en Mongo, y el bot lo levanta solo, cada 8s, con un **polling** propio (`provisionWorker.tick()` → `GET /api/bots/events/pending`, `POST /api/bots/events/:id/start`, `/done`, `/fail`). **⚠️ Las 4 llamadas son bot → backend directo, sin pasar por el CRM — el caso más flagrante de la regla nueva.**

**Dos mecanismos distintos para la misma feature, y los dos rompen la regla nueva:** el torneo usa "push" síncrono vía CRM (pero con un tramo final directo bot→backend, pasos 6-7); el equipo usa "poll" asíncrono 100% directo al backend, sin CRM de por medio. Ambos terminan escribiendo en el mismo lugar (`discordProvision`), pero son dos arquitecturas separadas y ninguna respeta "el bot solo habla con el CRM".

---

## 2. Hallazgos verificados (por qué no funciona hoy)

### 🔴 Urgente — nada de esto corre en este entorno tal como está

1. **`discord-bot/.env` no existe.** Sin `TOKEN`/`CLIENT_ID`/`GUILD_ID`, el bot ni siquiera puede loguearse a Discord. Nada de lo de abajo puede pasar sin este archivo.
2. **`backend/.env` no tiene `BOT_API_KEY`.** `requireBotAuth` (`backend/src/middleware/requireBotAuth.js:8`) rechaza con 401 **cualquier** llamada a `/api/bots/*` si la clave esperada está vacía — esto no es solo el feature nuevo, es **todo** lo que el bot ya hacía (`/torneo`, `/checkin`, `/start-match`, etc.). Confirmado: `backend/.env` actual no tiene esta variable seteada (aunque sí está en `.env.example`).
3. **`backend/.env` no tiene `GLITCHGANG_SITE_TOKEN` ni `CRM_PORTAL_URL` ni `DISCORD_GUILD_ID`, y ninguna de las tres está siquiera documentada en `backend/.env.example`.** Sin `GLITCHGANG_SITE_TOKEN`, `syncTournamentCreatedToCrm` (`crmSync.service.js:58`) lanza el error `Falta GLITCHGANG_SITE_TOKEN/INTERNAL_API_TOKEN...` en el instante en que se publica un torneo con Discord — el torneo queda en `discordProvision.status: 'failed'` desde el segundo cero, siempre, hasta que alguien la configure.
4. **Descalce de puerto del CRM.** `discord-bot/.env.example` documenta `CRM_PORT=3010`, pero `crmSync.service.js` en el backend apunta por default a `http://localhost:3000` si no se define `CRM_PORTAL_URL`/`DISCORD_CRM_URL`/`CRM_URL` — variable que, otra vez, `backend/.env.example` nunca menciona. Si alguien sigue las plantillas tal cual, el backend le habla al puerto equivocado.
5. **El frontend nunca lee el campo que el backend llena — esta es la brecha más importante.** El backend (commit `8c4781a`) guarda todo en `Tournament.discordProvision` / `Team.discordProvision`. Pero:
   - La pestaña **Check-in** del organizador (`frontend/src/pages/organizer/OrganizerTournamentManage/OrganizerTournamentManage.jsx:590`) lee `t.discordSpace` — campo que **no existe en ningún lado del backend actual** (`grep discordSpace backend/` → 0 resultados). El adapter (`frontend/src/lib/tournamentAdapter.js:212`) tiene incluso el comentario explícito: *"null hasta que el backend implemente el servicio de provisioning"* — se escribió anticipando un contrato (`discordSpace` con `channels: [{key,name,type,status}]`, documentado en `BACKEND-PENDIENTE.md` bajo "Discord: sistema completo del torneo") que el backend real terminó implementando con OTRO shape (`discordProvision`, canales como mapa plano de IDs, sin nombre/descripción/estado por canal).
   - Lo mismo con la sala de cada equipo: la UI lee `reg.discordRoom` (línea 601/788), pero eso tampoco se escribe nunca — el equipo se guarda en `Team.discordProvision`, y **`mapRegistration()`** (`tournament.controller.js:257`) nunca lo incluye al armar la respuesta de `listRegistrations`/`getTournament`.
   - **Consecuencia real:** aunque los 3 procesos estén perfectamente configurados y el bot cree la categoría, los 7 canales, la voz y los 3 roles de verdad en Discord — el organizador va a seguir viendo "Pendiente" en su propio panel para siempre. El pipeline backend↔bot quedó completo, pero desconectado de la única pantalla que se pidió que mostrara "listo o fallido".

6. **El bot le habla directo al backend en prácticamente todo lo que hace hoy — viola la regla de arquitectura nueva ("el bot solo habla con el CRM"), y es más grande de lo que parecía a primera vista.** Releí a fondo los ~18 comandos, los 6 eventos y los 22 servicios de `discord-bot/` (no solo el feature de sync) para no proponer algo que ya existe o dejar huecos. Confirmado:
   - **~30 puntos de llamada bot→backend directo**, repartidos en 16 archivos: comandos `config.js`, `equipo.js`, `perfil.js`, `referir.js`, `registrar.js`, `rol.js`, `soporte.js`, `torneo.js`, `vincular.js`; eventos `guildMemberAdd.js`, `guildMemberRemove.js`, `interactionCreate.js` (este es el gate central — pasa el perfil del usuario a 11 comandos distintos); servicios `tournamentService.js`, `roleSyncService.js`, `liveMatchService.js` (9 funciones — todo el ciclo real de check-in/match/report), `provisionWorker.js`.
   - **Pero casi todos esos ~30 puntos pasan por UN SOLO cliente HTTP**: `discord-bot/services/backendApi.js`. La excepción es **`services/aiService.js`**, que tiene su **propio** `fetch` separado hacia `PLATFORM_API_URL` (usado por `/preguntar` y por las respuestas de IA en DM, `events/messageCreate.js`) — hay que redirigir los 2 clientes, no solo `backendApi.js`.
   - `api/server.js` (el CRM) también importa `backendApi.js`, pero esa llamada SÍ está permitida: es CRM↔backend, no bot↔backend.
   - **No existe hoy ningún proxy/relay bot→CRM que se pueda reusar** (confirmado por búsqueda exhaustiva) — el único canal bot↔CRM que ya existe es el inverso (`botBridge.js`/`internalBotApi.js`, CRM llamando AL bot para acciones de guild), más un acoplamiento de bajo nivel no relacionado con HTTP: ambos procesos comparten el mismo archivo SQLite (`data/glitchgang.db` vía `services/db.js`) para tablas legacy (`matches`, `reports`, `activity`, etc.) — no es una violación de la regla nueva (no es "hablar" por red), pero es coupling preexistente que vale la pena tener en cuenta.
   - Dato aparte, no bloqueante: `matchService.js`/`reportService.js` (SQLite, alimentan el panel legacy del CRM) y `liveMatchService.js` (backend real) son dos sistemas de "partidas" paralelos y ya coexisten a propósito (comentario explícito en el código) — no hace falta tocarlos para este plan.
   - Ya era así antes del feature de sync — es la arquitectura completa del bot, no algo exclusivo de esto. Es una **reescritura de arquitectura**, no una limpieza incremental — pero con el diseño de "proxy transparente" de la Fase 1, el cambio de código real queda contenido en 2 archivos del lado del bot + 1 ruta nueva en el CRM (ver Fase 1); ninguno de los 16 archivos de arriba necesita cambiar una línea.

### 🟡 Necesario — funciona a medias, con huecos reales

7. **Todo el aprovisionamiento del torneo es síncrono** dentro del mismo `POST /tournaments` que usa el organizador para publicar: backend → CRM → bot → Discord API → callback a backend, todo bajo un único `await` con timeout de 45s (`crmSync.service.js`). Si Discord tarda (8 canales + 3 roles + 1 voz, uno por uno), la request de "publicar torneo" del organizador queda colgada ese tiempo.
8. **El aprovisionamiento solo se dispara una vez, en `createTournament`, y solo si el torneo ya nace publicado con Discord activado** (`tournament.controller.js:405`, condición `status !== 'draft'`). Dos casos reales que NO disparan nada:
   - Un torneo creado como borrador (`status: 'draft'`, "Crear sin publicar" — flujo que ya existe y se usa) y publicado después.
   - Un torneo ya publicado donde el organizador prende Discord más tarde desde la pestaña Discord (`updateTournament`, línea 583-591 — el código SÍ permite este toggle, pero solo cambia el booleano, nunca llama a `syncTournamentCreatedToCrm`).
9. **No hay botón de reintento para un torneo fallido.** `/admin/discord-sync` (`AdminDiscordSync.jsx`) solo lista y reintenta documentos de la colección `IntegrationEvent` — y la creación de torneo **nunca** crea uno (solo lo hace el registro de equipos). Un fallo como el del punto 3 queda invisible en esa pantalla; solo se ve mirando el documento del torneo directo en Mongo, o en `DiscordProvisionLog` (que ninguna pantalla de admin muestra hoy).
10. **Nombres de variable de entorno inconsistentes entre los 2 repos:** backend usa `DISCORD_GUILD_ID`; el bot/CRM usan `GUILD_ID` (con fallback interno a `DISCORD_GUILD_ID` solo en `provisionWorker.js`, no en el resto del CRM). Fácil de configurar con servidores distintos por error.

### 🟢 Mejora — no bloquea, vale la pena más adelante

11. Unificar los dos mecanismos (push síncrono para torneo vs. poll asíncrono para equipo) en uno solo — probablemente migrar el torneo también a la cola `IntegrationEvent`, que ya tiene reintentos y no bloquea la request original. (Con el proxy de la Fase 1, ambos ya pasan por el CRM de todas formas — esto pasa a ser puramente una limpieza de mantenibilidad, ya no un problema de arquitectura.)
12. Completar `backend/.env.example` con las 3 variables del punto 3, y agregar a `discord-bot/.env.example` la variable de token del portal que `server.js` ya usa (`GLITCHGANG_SITE_TOKEN`/`INTERNAL_API_TOKEN`) pero que la plantilla nunca documenta.
13. `discord-bot/api/routes/*.js` (match, player, reports, stats, team, tournament) y `discord-bot/api/middleware/errorHandler.js` son código muerto — confirmado que nada los `require` en ningún lado. Candidatos a borrar cuando alguien confirme que no son de otra rama en progreso.

---

## 3. Plan de implementación

### Fase 0 — Configuración (sin código, bloqueante para probar cualquier cosa)

- [ ] Crear `discord-bot/.env` desde `discord-bot/.env.example`: `TOKEN` (token real del bot), `CLIENT_ID`, `GUILD_ID` = ID del servidor real de GlitchGang.
- [ ] Generar un secreto y ponerlo **igual** en `backend/.env` (`BOT_API_KEY=...`) y `discord-bot/.env` (`BOT_API_KEY=...`) — reautoriza TODO `/api/bots/*`, no solo lo nuevo.
- [ ] Generar otro secreto (puede ser el mismo) y ponerlo en `backend/.env` como `GLITCHGANG_SITE_TOKEN=...`, y el mismo valor en `discord-bot/.env` (agregar la variable ahí, hoy no existe en la plantilla).
- [ ] En `backend/.env`: `CRM_PORTAL_URL=http://localhost:3010` (o el puerto que uses) y `DISCORD_GUILD_ID=` (mismo servidor que `GUILD_ID` del bot).
- [ ] Confirmar `discord-bot/.env`: `CRM_PORT=3010`.
- [ ] Agregar en `discord-bot/.env`: `CRM_INTERNAL_URL=http://localhost:3010` (la usa el bot en la Fase 1 para dejar de hablarle directo al backend y hablarle al CRM en su lugar).
- [ ] Levantar `backend` (`npm run dev`, dentro de `backend/`) y **`discord-bot` con `npm run dev`** (dentro de `discord-bot/`, NO `npm run bot` + `npm run api` por separado) — **`discord-bot/scripts/dev.js` ya existe y ya levanta bot + CRM juntos** (`child_process.spawn` de los dos, con `stdio: 'inherit'` y reenvío de `SIGINT`/`SIGTERM` a ambos); no hace falta inventar un orquestador nuevo, solo usar el que ya está. Confirmar en consola: backend arriba en :4000, bot con `[InternalBotApi] Escuchando en 127.0.0.1:3055` y `[Provision] Worker iniciado...` (esto solo aparece cuando el bot hace `ready`), CRM con `CRM interno en http://localhost:3010`.

### Fase 1 — El bot deja de hablar directo con el backend (🔴 bloqueante, requisito de arquitectura)

**Diseño elegido: proxy transparente en el CRM.** Confirmado por lectura completa de `discord-bot/` (comandos, eventos, servicios): todo el tráfico bot→backend real pasa por **solo 2 archivos cliente** — `backendApi.js` (~30 puntos de llamada, ver hallazgo #6) y `aiService.js` (aparte, propio `fetch`, usado por `/preguntar` y las respuestas de IA en DM). Redirigiendo esos 2, **ninguno de los 16+ archivos que los llaman necesita cambiar una línea**:

- [ ] En `discord-bot/services/backendApi.js`: cambiar el `fetch` de `${PLATFORM_API_URL}/api/bots${path}` a `${CRM_INTERNAL_URL}/bot-proxy${path}` (nueva env var, el bot y el CRM corren en el mismo host). Mismo header `x-glitchgang-bot-key` que ya manda hoy — no hace falta un secreto nuevo (`BOT_API_KEY` ya se usa para dos propósitos distintos hoy — bot→backend y CRM↔bot interno — reusarlo para este tercer tramo bot→CRM es consistente, no un choque).
- [ ] En `discord-bot/services/aiService.js`: mismo cambio — su `fetch` a `${PLATFORM_API_URL}/api/bots/ai/ask` pasa a `${CRM_INTERNAL_URL}/bot-proxy/ai/ask`. Es un cliente separado, no lo arregla el punto anterior.
- [ ] En `discord-bot/api/server.js` (el CRM): agregar una ruta genérica `app.all('/bot-proxy/*', requireBotProxyKey, async (req, res) => {...})` que reenvíe la request 1:1 a `${PLATFORM_API_URL}/api/bots${req.path.replace('/bot-proxy', '')}` con el mismo método/body, usando el `BOT_API_KEY` que el CRM YA necesita para sus propias llamadas a `backendApi.js` (`fetchRealActiveTournamentData`, etc. — el CRM ya habla con el backend hoy, así que no es una conexión nueva). `requireBotProxyKey` valida que quien le pega al CRM sea el bot (mismo `BOT_API_KEY`, header `x-glitchgang-bot-key`), igual que ya hace `internalBotApi.js` en la otra dirección.
- [ ] Mismo tratamiento para el tramo que hoy es directo dentro de `provisionWorker.js` (`getTournamentProvisionState`, `completeTournamentProvision`, `failTournamentProvision`, y las 4 llamadas de `getPendingEvents/startEvent/completeEvent/failEvent`) — como usan el mismo `backendApi.js`, quedan arregladas gratis en cuanto el primer punto esté hecho.
- [ ] **Backend: cero cambios de código.** `requireBotAuth` sigue esperando el mismo header `x-glitchgang-bot-key` — antes lo mandaba el bot, ahora lo manda el CRM en su nombre, pero el contrato es idéntico.
- [ ] **No hay que tocar el arranque de procesos** (`discord-bot/scripts/dev.js` ya levanta bot + CRM juntos, ver Fase 0) — este cambio es solo de a qué URL apuntan 2 archivos.
- [ ] Nota aparte, no bloqueante: el bot y el CRM también comparten el archivo SQLite `data/glitchgang.db` (tablas legacy: `matches`, `reports`, `activity`, `join_codes`, `event_channels`, `voice_sessions`, `match_recordings`). No es una llamada de red, así que no viola la regla nueva, pero es un acoplamiento por almacenamiento compartido que solo funciona porque ambos procesos corren en la misma máquina — queda fuera del alcance de este plan, solo para que quede documentado.
- [ ] Confirmar con un smoke test manual: apagar el bot, dejar CRM + backend arriba, y verificar que **ninguna** conexión de red sale del proceso del bot hacia el puerto del backend (solo hacia el CRM) — se puede verificar rápido revisando que `PLATFORM_API_URL` deje de usarse en `discord-bot/` fuera de `api/server.js` (`grep -r PLATFORM_API_URL discord-bot/ --include=*.js | grep -v api/server.js` debería devolver solo `backendApi.js` y `aiService.js`, y esos 2 archivos deberían dejar de usarlo también tras el cambio).

### Fase 2 — Conectar el pipe a la pantalla (🔴 urgente, cierra el hallazgo #5)

Recomendado: traducir en el backend, sin tocar el shape que el frontend ya espera (el frontend ya está construido y probado visualmente; no hay motivo para tocarlo).

- [ ] **Backend** (va a `BACKEND-PENDIENTE.md` para el compañero de backend):
  - En `listRegistrations` (`tournament.controller.js:929`) y en el populate de `getTournament` (línea 544), agregar `discordProvision` al `select` de `'registrations.team'`.
  - En `mapRegistration()` (línea 257), incluir `discordRoom: team?.discordProvision ? { status: team.discordProvision.status, textName: ..., bracketName: ..., voiceName: ..., roleName: ... } : null` (o devolver `discordProvision` crudo y que el frontend lo traduzca — a decidir con quien lo implemente).
  - En `getTournament`, agregar al payload un `discordSpace` derivado de `tournament.discordProvision`: `{ status, categoryName: tournament.title, url: 'https://discord.com/channels/<guildId>/<categoryId>', channels: [ {key:'anuncios', channelId: channels.newsId, status: channels.newsId ? 'created' : 'pending'}, ... mismo mapeo para los otros 6 ], staffRole: { status: staffRoleId ? 'created' : 'pending' } }`.
- [ ] Avisar cuando esté — el frontend no necesita cambios si el backend devuelve exactamente el shape que `tournamentAdapter.js`/`OrganizerTournamentManage.jsx` ya consumen.

### Fase 3 — Cerrar los huecos de "cuándo se dispara" (🟡 necesario)

- [ ] `updateTournament`: cuando `discordEnabled` pasa de `false` a `true` en un torneo ya publicado (línea 583-591), llamar la misma lógica de `syncTournamentCreatedToCrm` que usa `createTournament`.
- [ ] Cuando un torneo en `draft` con `discordEnabled: true` pasa a publicado, disparar el mismo aprovisionamiento (mismo punto del código que ya maneja el cambio de estado).
- [ ] Agregar un botón "Reintentar" para torneos con `discordProvision.status === 'failed'` — ya sea en la propia pestaña Discord del organizador, o agregando los torneos fallidos a la lista de `/admin/discord-sync` (hoy solo muestra `IntegrationEvent`, no torneos).
- [ ] Completar `backend/.env.example` con `GLITCHGANG_SITE_TOKEN`, `CRM_PORTAL_URL`, `DISCORD_GUILD_ID` (con el mismo estilo de comentario que ya tiene `BOT_API_KEY`, aclarando que debe coincidir con el otro `.env`).
- [ ] Completar `discord-bot/.env.example` con la variable de token del portal (`GLITCHGANG_SITE_TOKEN`) que `api/server.js` ya usa pero la plantilla nunca menciona, y con la `CRM_INTERNAL_URL` nueva de la Fase 1.

### Fase 4 — Consolidar arquitectura (🟢 mejora, no bloqueante)

- [ ] Evaluar migrar el aprovisionamiento de torneo al mismo mecanismo de cola (`IntegrationEvent`) que ya usa el de equipo — reintentos automáticos gratis, visibilidad en `/admin/discord-sync`, y la request de "publicar torneo" deja de esperar 3 saltos de red síncronos.
- [ ] Si no se migra del todo, al menos loguear un `DiscordProvisionLog`/`IntegrationEvent` "informativo" en la creación del torneo para que quede trazado en el mismo panel de admin donde ya se ve el resto.

---

## 4. Cómo probar de punta a punta (checklist)

1. Completar Fase 0.
2. Completar Fase 1 y confirmar que el bot ya no tiene ninguna conexión directa al backend (todo pasa por el CRM).
3. Con un organizador que ya tenga Discord habilitado por un admin, crear un torneo con Discord activado y publicarlo directo (no como borrador, hasta que la Fase 3 esté hecha).
4. Confirmar en Mongo que `tournament.discordProvision.status` pasa de `pending` a `ready` en segundos, con `categoryId`/`channels.*` llenos.
5. Confirmar en el servidor de Discord real que aparecieron: 1 categoría, 7 canales de texto, 1 canal de voz, 3 roles (`org-`, `staff-`, `torneo-`).
6. Inscribir un equipo con al menos un jugador con Discord ya vinculado; confirmar `team.discordProvision.status` (`ready` o `partial`) y que se creó el canal de texto + bracket + voz + rol del equipo en Discord.
7. **Solo después de la Fase 2:** abrir la pestaña Check-in del organizador y confirmar que ya NO dice "Pendiente" para nada que sí se creó.
8. Apagar el bot a propósito, crear otro torneo con Discord activado, y confirmar que `discordProvision.status` pasa a `failed` con un mensaje de error legible (hoy: sí pasa a `failed`, pero no hay botón de reintento — punto 9 / Fase 3).

---

## 5. Auditoría de comandos y contenido del CRM (¿coincide con lo esperado?)

El usuario pidió leer TODOS los comandos del bot y todo el contenido del panel CRM (no solo lo tocado por el feature de sync) para juzgar si hace falta agregar o quitar algo. Leí los ~18 comandos completos y el frontend React del CRM (`discord-bot/frontend/src/components/crm/*`, servido dentro de `api/server.js` vía `renderDashboard.js`). Resultado: la mayoría está bien — hay 2 hallazgos de contenido menores (texto desactualizado) y 2 decisiones de producto reales que solo Stephanie puede tomar.

### ✅ Alineado, no tocar

- **`LeaderboardPage.jsx`, `DisputesPage.jsx`**: usan endpoints reales (`GET /leaderboard`, `GET/PATCH /reports[/:id/dispute]`), con buenos estados vacíos que explican de dónde salen los datos (`/report` del bot). Nada mock.
- **`ApiHubPage.jsx`**: el más completo de los tres grandes — crear/editar/pausar/rotar key de partners, todo contra `apiPartnerService.js` real, sin datos de ejemplo hardcodeados ni botones inertes. Coherente con el modelo de negocio de `BillingPage.jsx`.
- **`BillingPage.jsx`, `PrizesPage.jsx`**: son placeholders, pero **honestos** — dicen explícitamente "todavía no conectado, nada aquí mueve dinero real" en vez de fingir datos reales. Coherente con que el pago real (PayPal) ya existe del lado de la web (`payment.controller.js`) pero es un sistema distinto — estas 2 páginas del CRM son para el modelo de negocio de terceros (fee/comisión), no para los premios de torneos propios de GlitchGang.
- **`TournamentOverview.jsx`**: ya distingue visualmente `tournament.source?.type === 'backend'` ("Plataforma GlitchGang") de uno creado local en el CRM ("Prueba local del CRM") — mitiga parcialmente el hallazgo de abajo.

### 🟡 Contenido desactualizado (texto, bajo riesgo, fácil de corregir)

- **4 mensajes de error dicen "en el CRM" cuando en realidad hoy consultan el backend directo**: `commands/checkin.js:84`, `cancelar.js:35`, `report.js:116`, `start-match.js:46` — todos "No se encontró un torneo activo en el CRM. [Verifica que la API esté corriendo.]". Esto quedó de una versión vieja de `tournamentService.js` (antes leía la SQLite del CRM; hoy lee el backend real vía `backendApi.getActiveDiscordTournament`). **Con la Fase 1 hecha (bot habla solo con el CRM), esta frase se vuelve literalmente cierta** — así que lo más simple es dejarla como está y no tocarla hasta que la Fase 1 esté lista (en vez de corregirla dos veces).
- **`ControlPanel.jsx:448-451`** (footer del formulario de crear torneo) menciona `/portal/tournaments/sync` y `/api/v1/tournaments/sync` como si fueran las rutas "reales" que usa ese mismo formulario — pero el botón en realidad pega a `POST /tournament` (el JSON local del CRM, `crmStore.js`), no a esas rutas. Mensaje confuso, vale la pena alinearlo con lo que el botón hace de verdad.

### 🔴 Decisiones de producto — respondidas 18/sep, aplicadas

1. **`ControlPanel.jsx:309-457` — "Crear torneo" desde el CRM compite con la web real.** El formulario tenía `organizerType: 'glitchgang'` por default, `organizerName: 'GlitchGang'` fijo, y activaba el torneo de inmediato (`makeActive: true`) sin ninguna advertencia de "esto no es un torneo real de la plataforma". **Decisión:** este camino es solo para terceros sin web propia (el modelo "Fee por Torneo"/"Comisión"). **Pendiente de aplicar** (no hecho todavía en este plan): forzar `organizerType: 'partner'` y quitar el default `'glitchgang'` en `ControlPanel.jsx`, para que no se pueda crear ahí nada que aparente ser un torneo oficial de GlitchGang.
2. **`DiscordMonitorPage.jsx` (roles/canales/miembros/voz/grabaciones, 831 líneas, gestión 100% genérica del guild sin ningún concepto de torneo) — decisión: no se usa, se eliminó por completo (18/sep).** Hecho en esta sesión:
   - Frontend: borrados `discord-bot/frontend/src/components/crm/DiscordMonitorPage.jsx` y `DiscordMonitor.module.css`; quitada la entrada de nav "Discord Monitor" (`lib/content.js`) y los 2 `case` + el botón "Gestionar roles" en `App.jsx`.
   - Backend (CRM, `discord-bot/api/server.js`): borrada toda la sección "Discord Management API" (`/discord/guild`, `/discord/members*`, `/discord/channels*`, `/discord/roles*`, `/discord/voice*`, `/discord/recordings*`, `/discord/event-channels*`) y la función `requirePrimaryAdmin` (y el env var `CRM_PRIMARY_ADMIN_DISCORD_IDS` que solo ella usaba — quitado también de `.env.example`).
   - `services/botBridge.js` / `services/internalBotApi.js`: quitadas las 13 funciones/rutas que solo servían a esa página (`getGuildOverview`, `getMembers`, `add/removeMemberRole`, `get/create/edit/deleteChannel`, `get/create/edit/deleteRole`, `getVoiceStates`). **Se conservaron a propósito** `announce`/`/announce` (lo usan `/tournament`, `/team`, `/tournament/activate` para publicar en Discord) y `provisionTournament`/`/provision/tournaments` (el corazón de este plan de sync — no tocar).
   - **Efecto secundario a tener en cuenta:** la sub-función "Automatizaciones" (mapear qué canal de Discord recibe cada tipo de evento, `eventChannels.setEventChannel`) vivía dentro de esta misma página (`EventChannelsCard`) y se fue con ella — ya no hay UI para configurar esos canales. La lectura (`eventChannels.getEventChannelId`, usada por `announceEvent` y por el comando `/report` para postear una copia en el canal de "Resultados") sigue funcionando con lo que ya estuviera configurado en la SQLite; solo se perdió la forma de cambiarlo desde el panel. Si esto hace falta, avisar para reconstruirlo como su propio panel chico, sin el resto de Discord Monitor.
   - `matchRecorder.js` (grabación real de audio/screen-share durante partidas, usada por `/start-match`, `/report`, `/cancelar`) y `voiceMonitor.js` (tracking de sesiones de voz) **no se tocaron** — son servicios usados por los comandos reales, no por la página eliminada; solo se quitó la vista admin que los listaba.
3. **Grabaciones de partida sin control de consentimiento/privacidad visible** — quedó resuelto de hecho al borrar la página que las mostraba en el CRM; la grabación en sí (`matchRecorder.js`) sigue activa para `/start-match`/`/report`/`/cancelar` y no tenía ningún control de consentimiento tampoco — si esto importa, es una revisión aparte de ese servicio, no de una UI que ya no existe.
