# Tareas para trabajar en paralelo

**Proyecto:** GlitchGang — `https://github.com/Stephy0723/glitchgang`, rama `master`
**Fecha:** 6 de octubre de 2026
**Para:** una segunda sesión de IA que trabaja al mismo tiempo que otra sesión en el mismo repositorio.

Lee este documento entero antes de tocar código. Al lado se está trabajando en otra parte del proyecto (reportes de partidas, capturas y árbitro), así que la sección 1 (reglas de coordinación) es obligatoria.

---

## 1. Reglas de coordinación (obligatorias)

1. **Carpeta propia, misma rama.** No uses `Downloads/glitchgang/_gg_merge_wt`: ahí trabaja la otra sesión. Haz un clon aparte en `master`:
   ```powershell
   git clone https://github.com/Stephy0723/glitchgang.git C:\Users\salyl\Downloads\glitchgang\gg-paralelo
   cd C:\Users\salyl\Downloads\glitchgang\gg-paralelo
   cd backend; npm install; cd ..\frontend; npm install
   ```
   Copia `backend/.env` desde `Downloads/glitchgang/_gg_merge_wt/backend/.env`. Usa la MongoDB local (`mongodb://127.0.0.1:27017/glitchgang`), nunca la de producción.
2. **No crees ramas nuevas.** Commits directos a `master`, pequeños, uno por tarea terminada.
3. **Antes de cada push:** `git pull --rebase origin master`, vuelve a correr build y pruebas, y después `git push`. Nunca `--force`.
4. **No toques estos archivos.** Son de la otra sesión. Si necesitas cambiarlos, para y avisa a la dueña del proyecto:
   - `discord-bot/**` (bot y CRM)
   - `backend/src/controllers/tournamentMatches.controller.js`, `backend/src/services/bracketSync.service.js`, `backend/src/controllers/matchReports.controller.js`
   - `backend/src/services/matchStatsVision.service.js`, `backend/src/services/matchStats.service.js`
   - `frontend/src/components/MatchStats/**`, `frontend/src/components/MatchReport/**`
   - En `frontend/src/pages/organizer/OrganizerTournamentManage/OrganizerTournamentManage.jsx`: la pestaña Bracket (`TabBracket`, `MatchCard2`, `JustifyModal`)
5. **Idioma:** todo texto visible en español. Los mensajes de commit también van en español y sin tildes, como el historial (`git log`).
6. **Estilo:** imita el código que rodea lo que cambias: densidad de comentarios, nombres y forma. Los colores salen de las variables CSS existentes (`--accent`, `--bg-card`, `--line`, `--text`, `--text-dim`, `--danger`).

## 2. Contexto mínimo

- **Stack:** web React + Vite (`frontend/`), API Node/Express + MongoDB (`backend/`), bot de Discord + CRM (`discord-bot/`, no tocar).
- **Especificación general:** `docs/spec-lector-resultados.md`. Las tareas de abajo corresponden a sus secciones 3, 6.5, 8 y 12.
- **Ya está hecho y funciona** (commits `32e403a` y `1c6c2af`): cuentas de Mobile Legends verificadas con el código que llega al correo del juego.
  - Modelo `backend/src/models/GameAccount.js`, con estados `pending_code`, `pending_confirm`, `verified` y `revoked`.
  - Servicio `backend/src/services/gameAccount.service.js` y sincronización en `backend/src/services/gameAccountSync.service.js`.
  - Rutas `/api/game-accounts/*` (`backend/src/routes/gameAccount.routes.js`). `GET /api/game-accounts/status?users=id1,id2` devuelve quién está verificado sin exponer el ID.
  - Frontend `frontend/src/components/GameAccountConnect/GameAccountConnect.jsx`: exporta `GameAccountBadge`, `GameAccountModal`, `GameIdVerify`, `GameAccountReminder` y `useMyGameAccount`.
- **Detectar Mobile Legends:** `isMobileLegends(game)` de `shared/matchStats.mjs`. Acepta tanto `mobile-legends-bang-bang` como `Mobile Legends: Bang Bang`.
- **Pruebas del backend:** las de integración usan una base temporal en la Mongo local y la borran al terminar. Copia ese patrón.
  ```powershell
  cd backend
  $env:GAME_ACCOUNT_TEST_MONGO='1'; $env:MATCH_STATS_TEST_MONGO='1'
  node --test (Get-ChildItem -Recurse -Filter *.test.js src | % FullName)
  ```
- **Build del frontend:** `cd frontend; npm run build`.

---

## 3. Tareas (en este orden)

### Tarea 1 — Arreglar la prueba que falla (rápida)

**Qué pasa:** `backend/src/controllers/matchStats.integration.test.js:44` espera un **409** al confirmar con una versión vieja del borrador (`revision: 0`). Pero `confirmMatchStats` en `backend/src/controllers/matchStats.controller.js` deja pasar el valor hasta Mongoose, que lanza `ValidationError: confirmation.revision ... less than minimum allowed value (1)`, y eso no es un 409.

**Qué hacer:** en `confirmMatchStats`, antes de guardar, compara `req.body.revision` con la versión actual del borrador. Si no coincide (o es menor que 1), lanza `statsError('El borrador cambió. Recarga antes de confirmar.', 409)`. No cambies la prueba.

*Este archivo es la única excepción a la regla 4: solo este cambio puntual en `confirmMatchStats`.*

**Listo cuando:** las 58 pruebas del backend pasan.

### Tarea 2 — Reglamento y consentimiento (spec, sección 8)

**2a. Cláusulas.** En `frontend/src/lib/tournamentRegulation.js` (`buildTournamentRegulation`), agrega estas cláusulas **solo si `isMobileLegends(t.game)`**, en el artículo que corresponda (resultados o conducta):
1. "Cada equipo debe enviar todas las capturas de estadísticas de cada partida dentro del plazo establecido. No hacerlo se considera violación del reglamento."
2. "Cada jugador debe tener verificada su propia cuenta de juego. Registrar un ID falso o ajeno puede causar la descalificación del equipo."
3. "Está prohibido cambiar el nickname del juego mientras el equipo participe en un torneo activo."
4. "Los resultados se validan automáticamente cuando las capturas de ambos equipos coinciden. Cualquier discrepancia la resuelve el árbitro del torneo; su decisión puede apelarse una vez."

**2b. Consentimiento al inscribirse.** La lectura automática enviará capturas y nicks a Google (Gemini).
- **Backend:** en `registerTeamForUser` (`backend/src/controllers/tournament.controller.js`), si el torneo es de Mobile Legends, exige `req.body.dataConsent === true`. Si no llega, responde 400 con `code: 'DATA_CONSENT_REQUIRED'`. Guarda `registrations[].dataConsent = { acceptedAt, acceptedBy }` (agrega el campo al subdocumento en `backend/src/models/Tournament.js`).
- **Frontend:** en `frontend/src/pages/TournamentRegistration/TournamentRegistration.jsx` y `frontend/src/pages/TournamentCheckout/TournamentCheckout.jsx` (los dos llaman a `POST /tournaments/:id/register`), una casilla obligatoria para torneos de MLBB: "Acepto que las capturas de las partidas de mi equipo, incluidos los nicks, se envíen a Google para leer los resultados automáticamente." Con enlace a `https://ai.google.dev/gemini-api/terms`. Envía `dataConsent: true`.

**Listo cuando:** sin la casilla no se puede inscribir un equipo en un torneo de MLBB (el backend lo rechaza, no solo el botón), y el reglamento en PDF muestra las 4 cláusulas. Agrega una prueba del backend.

### Tarea 3 — Plan B de cuentas de juego (spec, sección 6.5)

**Problema:** si la API del código (Rone Arena) se cae, el jugador no puede verificar su cuenta.

**Qué hacer:**
- **Backend** (archivos nuevos o funciones nuevas; no cambies las existentes de `gameAccount.controller.js`):
  - Agrega el estado `'review'` al enum de `GameAccount.status`, más los campos `reviewEvidenceUrl` y `reviewReason`.
  - `POST /api/game-accounts/mlbb/review`, con `{ roleId, zoneId, evidenceUrl }`. La captura del perfil del juego se sube antes con el upload existente (`uploadsApi`). Crea una cuenta en `review`, como máximo una por usuario.
  - Admin: `GET /api/admin/game-accounts/review` (lista) y `POST /api/admin/game-accounts/:id/review` con `{ approve: boolean, reason }`.
    - Aprobar deja la cuenta `verified` con `verifiedBy: 'admin'` y llama a `syncVerifiedAccountToProfile` y `syncVerifiedAccountToTeams` de `gameAccountSync.service.js`.
    - Rechazar deja la cuenta `revoked` con `revokedReason: 'admin'`.
    - Respeta el índice único: si ese ID ya está verificado en otro usuario, el admin lo ve y decide.
  - Avisa al jugador con `notifyUsers` (`backend/src/services/tournamentTeams.service.js`).
  - Las rutas de admin se montan en `backend/src/routes/admin.routes.js`, que ya tiene la auditoría de admin.
- **Frontend:**
  - En `GameAccountModal`, cuando el envío del código falla con `code === 'GAME_SERVICE_UNAVAILABLE'`, muestra el botón "Enviar a revisión manual" (subir captura del perfil, donde se vea el nick y el ID).
  - Nueva página admin "Cuentas por revisar", con entrada en `frontend/src/layouts/AdminLayout.jsx` y ruta en `frontend/src/routes/AppRoutes.jsx`. Tabla: jugador, ID / servidor, captura, motivo, Aprobar / Rechazar con motivo.
- **Listo cuando:** con la API caída se puede pedir revisión, el admin aprueba, y el ID aparece verificado en Ajustes, en el equipo y en el panel. Prueba de integración incluida.

*Coordinación:* `GameAccountConnect.jsx` es compartido. Haz cambios mínimos y aditivos, y `git pull --rebase` antes de empezar esta tarea.

### Tarea 4 — Sección "Equipo" en el panel de organizador (spec, sección 3)

**Menú:** en `frontend/src/layouts/OrganizerLayout.jsx` (`NAV_SECTIONS`), agrega "Equipo" con dos entradas: "Equipos participantes" (`/organizador/equipo`) y "Staff" (`/organizador/equipo/staff`). Las rutas se registran en `frontend/src/routes/AppRoutes.jsx`, junto a `/organizador` (cerca de la línea 266).

**Backend** (archivo nuevo, por ejemplo `backend/src/controllers/organizerTeams.controller.js`, bajo `requireAuth`). El organizador es `Tournament.organizer`:
- `GET /api/organizers/me/teams`: equipos inscritos en **al menos un torneo de este organizador**. Devuelve logo, nombre, tag, juego, número de integrantes, número de torneos con él y el último torneo.
- `GET /api/organizers/me/teams/:teamId`: 403 si el equipo nunca jugó con él. Devuelve los integrantes (nick, puesto titular/suplente/capitán, si la cuenta de MLBB está verificada; usa `GameAccount`) y los torneos con él.
- `GET /api/organizers/me/players/:userId`: 403 si el jugador nunca jugó en sus torneos (búscalo en `registrations[].rosterSnapshot.userId` o en los equipos inscritos).
  - **Datos generales:** nick, usuario de Discord, ID de juego verificado, equipo actual.
  - **Datos de partida:** filas de `PlayerMatch` con `tournament` en sus torneos, agrupadas por torneo y partida (`bracketMatchId`, `gameNumber`, `character`, `kills`/`deaths`/`assists`, `damageDealt`, `damageTaken`, `teamfightParticipation`, `gold`, `mvp`, `result`), más los totales (partidas, % de victorias, KDA promedio).
- **Privacidad (obligatorio):** **no** devuelvas correo, teléfono, cédula ni nombre legal. El organizador solo ve jugadores y equipos que jugaron con él. Prueba los dos 403.

**Frontend:** tres niveles: lista de equipos → integrantes (con `GameAccountBadge`) → ficha del jugador con dos pestañas, "Datos generales" y "Datos de partida". Debe funcionar a 390 px de ancho.

**Staff:**
- `GET /api/organizers/me/staff` junta `staffMembers` de todos sus torneos (nombre, nick, rol, estado y en qué torneos está).
- La vista es de **solo lectura**, con un enlace por torneo a su pestaña de staff, donde ya se edita: `/organizador/torneo/:id/gestionar/...`; busca la pestaña de staff/colaboradores en `frontend/src/data/organizerManageTabs.js`.
- Los permisos ya existen **por pestaña** (`frontend/src/lib/staffPermissions.js`, niveles `none`/`view`/`edit`). No inventes un sistema nuevo.

**Listo cuando:** un organizador con torneos ve sus equipos, entra a un equipo y a un jugador con sus estadísticas, y no puede abrir un equipo ajeno. Incluye pruebas de integración de los endpoints (sobre todo los 403 y que no salgan correo ni teléfono). Compila y se ve bien en teléfono.

---

## 4. Lo que NO debes hacer (lo hace la otra sesión)

- Fotos de `/report` en la web, varias capturas en `/report`, lectura automática con IA, avance del bracket, árbitro y "Resultados por revisar".
- Grabaciones de voz del bot.
- Cualquier cosa dentro de `discord-bot/`.

## 5. Al terminar cada tarea

Responde con:
- El hash del commit.
- Qué hiciste, en 3 a 5 líneas.
- Cómo verlo en la web: la ruta exacta y qué hacer para que aparezca.
- Qué probaste y qué **no** pudiste probar.
- Cualquier decisión que necesite la dueña del proyecto.
