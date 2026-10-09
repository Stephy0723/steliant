# Spec: amigos, bloquear y reportar usuarios

Especificación para implementar las interacciones sociales entre usuarios de GlitchGang.
Léela completa antes de tocar código. Trabaja en este mismo repo y rama (`master` de
`Stephy0723/glitchgang`); no crees worktrees ni ramas aparte.

---

## 0. Qué ya existe (no lo rehagas)

**Backend**
- `backend/src/models/User.js:188-195`: campos `friends`, `friendRequests.sent`,
  `friendRequests.received`, `followers`, `following` y **`blockedUsers` (existe pero nada lo usa)**.
- `backend/src/controllers/profile.controller.js:440-532`: `sendFriendRequest`,
  `respondFriendRequest`, `removeFriend`. Ya respetan `privacy.allowFriends`, aceptan solicitudes
  cruzadas y mandan notificaciones con `sendNotif`.
- `backend/src/routes/profile.routes.js`:
  - `POST   /api/profile/me/friends/request/:userId`: enviar solicitud
  - `PATCH  /api/profile/me/friends/:userId` con body `{ action: 'accept' | 'reject' }`
  - `DELETE /api/profile/me/friends/:userId`: eliminar amigo
- Reporte de **posts/comentarios** ya existe (`POST /api/posts/:id/report`,
  `/api/posts/comments/:commentId/report`). **No existe reporte de usuarios.**
- Tickets de sistema: `backend/src/models/SystemTicket.js` (tiene `purpose: 'moderation'`,
  `sourceType`, `sourceId`, `metadata`) y `backend/src/services/systemTickets.service.js`
  (`createSystemTicketRecord`, `ensureSystemTicketForSource`). El admin ya los ve en
  `frontend/src/pages/admin/AdminReports/AdminReports.jsx` y `AdminTickets.jsx`.
- Sanciones (ban/warning/mute): `backend/src/models/Sanction.js`, página `/admin/moderacion`.

**Frontend**
- `frontend/src/pages/Friends/Friends.jsx` (`/amigos`): lista de amigos, solicitudes recibidas,
  buscador de jugadores con botón de enviar solicitud. Ya usa la API real.
- `frontend/src/pages/Profile/Profile.jsx:325-361` y `:812-835`: calcula `friendStatus`
  (`none | sent | received | friends`) y muestra "Agregar amigo" / "Aceptar" / "Ya son amigos".
- Helper HTTP: `frontend/src/lib/api.js` (`api(path, { method, body })`; serializa el body solo).
- Toasts: `frontend/src/lib/toast.js`. Usuario actual: `useAuth()` → `{ user, updateUser }`.
- Estilos/átomos sociales: `frontend/src/components/SocialKit/SocialKit.jsx` + `frontend/src/styles/social-kit.css`.
- `frontend/src/data/friends.js` es **mock**. No lo uses.

## 1. Qué falta

| Área | Falta |
|---|---|
| Amigos | Cancelar una solicitud enviada; ver solicitudes enviadas; "Eliminar amigo" desde el perfil; acciones sobre un usuario desde fuera del perfil (chat, posts, comunidad) |
| Bloquear | Todo: endpoints, que se aplique en el backend, la UI y la lista de bloqueados |
| Reportar usuario | Todo: endpoint, modal y que el reporte llegue al panel de admin |

---

## 2. Backend

Todo va en `profile.controller.js` / `profile.routes.js` salvo donde se indique otra cosa.

> **Ojo con el orden de rutas:** en `profile.routes.js`, `router.get('/:userId', ...)` está
> declarado **antes** de `router.use(requireAuth)`. Un `GET /me/blocked` añadido al final lo
> capturaría `/:userId` con `userId = "me"`. Declara las rutas GET nuevas **antes** de
> `router.get('/:userId')` (con `requireAuth` en la propia ruta).

### 2.1 Cancelar solicitud enviada
- `DELETE /api/profile/me/friends/request/:userId`
- `$pull` de `friendRequests.sent` en mí y de `friendRequests.received` en el otro. Si no había
  solicitud, responde 404. Sin notificación.

### 2.2 Bloquear / desbloquear
- `POST /api/profile/me/block/:userId`
  - No puedes bloquearte a ti mismo (400). Si el usuario no existe, 404.
  - `$addToSet: { blockedUsers: userId }` en mí.
  - Rompe toda relación **en ambos sentidos**: `friends`, `friendRequests.sent/received`,
    `followers/following`.
  - No se notifica al bloqueado.
- `DELETE /api/profile/me/block/:userId`: `$pull` de `blockedUsers`. No restaura la amistad.
- `GET /api/profile/me/blocked`: devuelve `{ users: [{ _id, nick, avatar }] }` (populate de `blockedUsers`).

Crea un helper reutilizable, por ejemplo en `backend/src/services/blocks.service.js`:
```js
// true si A bloqueó a B o B bloqueó a A
export async function isBlockedEitherWay(aId, bId) { ... }
```

### 2.3 Hacer cumplir el bloqueo (lo más importante)
Si bloquear solo oculta un botón, no sirve. Hay que aplicarlo en el backend:

1. **Solicitudes de amistad** (`sendFriendRequest`): si hay bloqueo en cualquier sentido,
   responde 403 con un mensaje genérico ("No puedes enviar solicitud a este usuario"). No
   reveles quién bloqueó a quién.
2. **Mensajes directos** (`backend/src/controllers/messages.controller.js`, cerca de la línea 184,
   donde ya se comprueba `privacy.allowDMs`): si hay bloqueo, no se crea la conversación ni se
   envía el mensaje (403). Revisa también el endpoint de envío en una conversación existente.
3. **Perfil público** (`getPublicProfile` y `getPublicProfileByIdentifier`):
   - Si el **perfil visto me bloqueó**: responde 404 "Usuario no encontrado".
   - Si **yo bloqueé** a ese perfil: devuelve el perfil mínimo (nick, avatar) con `blockedByMe: true`.
4. **Búsqueda de jugadores** (`searchPlayers`): excluye a quienes yo bloqueé y a quienes me bloquearon.
5. **Feed de posts** (`post.controller.js:20` ya oculta por `blockedBy`): añade que se excluyan
   los posts cuyo `author` esté en mi `blockedUsers` o que me tenga bloqueado.
6. **Notificaciones**: no generar notificaciones de un usuario hacia alguien que lo bloqueó
   (como mínimo en solicitudes de amistad y DMs).
7. `blockedUsers` **nunca** debe salir en la respuesta del perfil público de otro usuario
   (hoy no está en `PUBLIC_FIELDS`, así debe quedarse). Sí debe venir en el usuario propio (`/auth/me`).

### 2.4 Reportar usuario
- `POST /api/profile/:userId/report` (requireAuth + `generalLimiter` de `middleware/rateLimit.js`)
- Body:
  ```json
  {
    "reason": "spam | acoso | suplantacion | contenido_inapropiado | trampas | nombre_ofensivo | otro",
    "details": "texto libre, máx 1000",
    "context": { "type": "profile | message | post | comment | team", "id": "opcional" }
  }
  ```
- Validar `reason` contra la lista. `details` es obligatorio si `reason === 'otro'`.
- No puedes reportarte a ti mismo.
- **Reutiliza SystemTicket; no crees un modelo nuevo.** Llama a `createSystemTicketRecord` (lee su
  firma en `systemTickets.service.js:210`) con:
  - `purpose: 'moderation'`, `sourceType: 'user_report'`, `sourceId: <reportedUserId>`
  - `subject: "Reporte de usuario: @<nick> — <reason legible>"`
  - `metadata: { reportedUserId, reportedNick, reason, context }`
  - primer mensaje = `details`
  - `priority`: `high` si el motivo es `acoso`, si no `medium`
- Anti-spam: si el mismo reporter ya tiene un ticket `user_report` abierto sobre el mismo
  usuario, añade el mensaje a ese ticket en vez de crear otro (`appendUserTicketReply`).
- Respuesta: `{ message: 'Reporte enviado', ticketCode }`. No se notifica al reportado.
- Opcional: body `{ alsoBlock: true }` para bloquear en la misma llamada.

### 2.5 Admin
- En `AdminReports.jsx` / `AdminTickets.jsx`, los tickets con `sourceType === 'user_report'`
  deben mostrar la etiqueta "Reporte de usuario", el motivo y un enlace a `/perfil?user=<nick>`
  del reportado. La acción (ban/warning/mute) se sigue haciendo desde `/admin/moderacion` con el
  modelo `Sanction` que ya existe; si puedes, añade un botón "Sancionar" que lleve allí con el nick
  prellenado.

---

## 3. Frontend

Respeta el patrón del repo: textos bilingües con `const isEs = lang !== 'en'` (`useLang()`),
`api()` para llamadas, `toast()` para feedback y **nunca datos mock**.

### 3.1 Componente reutilizable `UserActions`
Crea `frontend/src/components/UserActions/` con:

- **`UserActionsMenu.jsx`**: botón "⋯" que abre un menú. Props: `{ user: { _id, nick, avatar }, context }`.
  Opciones según el estado (se calcula con `useAuth().user`):
  | Estado | Opciones |
  |---|---|
  | sin relación | Agregar amigo |
  | solicitud enviada | Cancelar solicitud |
  | solicitud recibida | Aceptar / Rechazar |
  | amigos | Enviar mensaje, Eliminar amigo (con confirmación) |
  | siempre | Ver perfil, Bloquear (o Desbloquear), Reportar |
  - No se muestra si `user._id` es el usuario actual.
- **`ReportUserModal.jsx`**: radio con los motivos del §2.4, textarea (obligatorio en "Otro"),
  checkbox "Bloquear también a este usuario", y botón Enviar. Al terminar: toast
  "Reporte enviado. El equipo de moderación lo revisará." con el código del ticket.
- **`ConfirmBlockModal.jsx`**: explica qué pasa al bloquear ("No podrá enviarte mensajes ni
  solicitudes, dejará de ver tu perfil y se eliminará de tus amigos"). Botones Bloquear / Cancelar.
- **`useRelationship.js`** (hook): expone `status` y las acciones `sendRequest`, `cancelRequest`,
  `accept`, `reject`, `removeFriend`, `block`, `unblock`, `report`. Después de cada acción
  actualiza el usuario global con `updateUser(...)` (`friends`, `friendRequests`, `blockedUsers`)
  para que todos los menús de la app se enteren sin recargar. Mira cómo lo hace hoy
  `Profile.jsx:334-361` y extrae esa lógica aquí.

### 3.2 Dónde se integra
1. **Perfil** (`Profile.jsx` ~línea 812): deja el botón principal que ya existe y añade
   `UserActionsMenu` al lado. Añade también "Cancelar solicitud" en el estado `sent` y
   "Eliminar amigo" en el menú cuando son amigos. Si la API devuelve `blockedByMe: true`, muestra
   un estado vacío ("Bloqueaste a este usuario") con botón Desbloquear en lugar del perfil.
   Si devuelve 404, muestra la pantalla normal de "usuario no encontrado".
2. **Amigos** (`Friends.jsx`):
   - Cada tarjeta de amigo lleva `UserActionsMenu`.
   - Pestaña nueva **"Enviadas"** con `friendRequests.sent` y botón Cancelar (el perfil propio
     ya trae `friendRequests.sent` populado).
   - En el buscador, marca como "Solicitud enviada" / "Amigos" a quien ya lo sea.
3. **Mensajes** (`Messages.jsx`): `UserActionsMenu` en la cabecera del chat directo. Si el
   backend responde 403 por bloqueo, sustituye el input por el aviso "No puedes enviar mensajes
   a este usuario".
4. **Posts** (`components/PostCard/PostCard.jsx`): en el menú del post, junto a "Reportar post",
   añade "Reportar usuario" y "Bloquear a @nick" (usa los modales de §3.1).
5. **Comunidad / Equipos** (opcional, en segunda pasada): menú en las listas de miembros
   (`CommunityPage.jsx`, roster de `Teams.jsx`).
6. **Ajustes → Privacidad** (`Settings.jsx`): sección "Usuarios bloqueados" que llama a
   `GET /api/profile/me/blocked`, con avatar, nick y botón Desbloquear. Muestra un estado vacío
   si no hay nadie.

### 3.3 UX
- Las acciones destructivas (eliminar amigo, bloquear) piden confirmación; el resto es inmediato
  con actualización optimista y rollback si la API falla.
- Desactiva el botón mientras la petición está en curso (evita dobles envíos).
- Muestra los errores del backend con `toast(err.message, 'error')`.
- El menú tiene que ser accesible: se abre con teclado, se cierra con Esc y con clic fuera, y el
  botón lleva `aria-label`.
- Tiene que funcionar a ancho de móvil.

---

## 4. Orden sugerido
1. Backend §2.1, §2.2 y el helper `isBlockedEitherWay`.
2. Backend §2.3 (aplicar el bloqueo en solicitudes, DMs, perfil, búsqueda y feed).
3. Backend §2.4 (reportes) y §2.5 (vista de admin).
4. Frontend: `useRelationship` + `UserActionsMenu` + modales.
5. Integraciones: Perfil → Amigos → Mensajes → PostCard → Ajustes.

> Si quien implementa solo hace frontend, los puntos 1-3 se apuntan en `BACKEND-PENDIENTE.md`
> y el frontend se construye contra estos contratos de API.

## 5. Criterios de aceptación (probar con dos cuentas, A y B)
- [ ] A envía una solicitud a B, la cancela y B ya no la ve en `/amigos`.
- [ ] A envía una solicitud, B la acepta desde la notificación o desde `/amigos`, y ambos se ven como amigos.
- [ ] A elimina a B desde el perfil de B y la amistad desaparece en ambos lados.
- [ ] A bloquea a B: dejan de ser amigos, B no puede enviarle solicitud ni DM (403), B recibe
      404 al abrir el perfil de A, A no aparece en la búsqueda de B y los posts de B
      desaparecen del feed de A.
- [ ] A ve a B en Ajustes → Usuarios bloqueados, lo desbloquea y B puede volver a enviarle solicitud.
- [ ] A reporta a B por "acoso": aparece un ticket de prioridad alta "Reporte de usuario" en
      `/admin/reportes` (o el panel de tickets) con enlace al perfil de B.
- [ ] Si A reporta dos veces a B, se añade al ticket abierto en vez de crear uno nuevo.
- [ ] Ningún menú de acciones aparece sobre el propio usuario.
- [ ] `blockedUsers` no aparece en la respuesta de `GET /api/profile/:id` de otro usuario.
