# Beta: lo que se ocultó (y cómo devolverlo)

Para la beta se **ocultaron** (no se borraron) los accesos a vistas que todavía no
tienen funcionalidad real: salen como "Próximamente", usan datos de ejemplo fijos, o
guardan solo en el navegador. El código, las rutas y las páginas siguen en el repo.

**Fecha del chequeo:** 24/sep/2026 · **Autoría del cambio:** frontend únicamente.

---

## Cómo funciona

Todo se controla desde **un solo archivo:** [`frontend/src/config/betaHidden.js`](frontend/src/config/betaHidden.js).

- **Mostrar una vista otra vez:** borra su línea de `HIDDEN_PATHS` en ese archivo. Listo:
  reaparece en el menú y en los botones que llevan a ella.
- **Mostrar todo de golpe:** pon `BETA_MODE = false`.
- Las entradas `section:...` son secciones internas de una página (no rutas).
- Los menús filtran con `hideInBeta()` / `hideInBetaSections()`; los botones sueltos con
  `isBetaHidden('/ruta')`. Al reactivar una vista, **primero** construye/conecta la página
  real (ver "Qué falta") y **después** borra la línea.
- Las rutas ocultas **siguen existiendo**: quien escriba la URL a mano ve la pantalla
  "Próximamente" (o la página, si ya estaba ruteada). No es un bloqueo de acceso, es solo
  quitar el acceso visible.

> Cuando reactives una, actualiza este documento (tacha la fila).

---

## 1. Navbar público (barra superior sin sesión)

| Se quitó | Ruta | Por qué | Para reactivar |
|---|---|---|---|
| **Planes** | `/planes` | La ruta muestra "Próximamente". La página `Pricing.jsx` existe (448 líneas) pero **no está ruteada** y usa `data/billing.js`. | Rutear `Pricing` en `AppRoutes.jsx`, conectar planes reales y pasarela de pago (ver `BACKEND-PENDIENTE.md` → *Pagos: no hay pasarela real*). |

## 2. Sidebar principal (menú lateral con sesión) — reorganizado

Se reordenó por **uso**: lo más frecuente arriba y menos ruido. Estructura actual:

| Bloque | Contenido |
|---|---|
| **Principal** (siempre visible) | Dashboard · Torneos · Equipos · Mensajes · Amigos |
| Botón **Publicar** | igual que antes |
| **Mis espacios** | Panel de jugador · Mi equipo (solo si lideras uno) |
| **Paneles de rol** | Organizador · Marca · Coach · Caster · Analista · **Moderador** · **Creador** · Admin (según los roles de la persona). *Moderador y Creador no estaban en el menú; ahora sí.* |
| **Explorar** (plegado por defecto) | Universidad |
| **Cuenta** (plegado por defecto) | Perfil · Editar perfil · Notificaciones · Ajustes |

**Se quitó del sidebar** (la página sigue viva y enlazada desde otros lados; se controla con `SIDEBAR_HIDDEN` en `betaHidden.js`):

| Se quitó | Ruta | Sigue accesible desde | Notas |
|---|---|---|---|
| **Noticias** | `/noticias` | Icono de noticias de la barra superior | Página real. |
| **Ranking** | `/ranking` | Icono de ranking de la barra superior | Página real. |
| **Comunidad** | `/comunidad` | Navbar público, URL | Página real. |
| **Marcas** | `/marcas` | URL | Parcial: si la API no trae marcas, cae a `SPONSORS` fijos. |
| **Mi comunidad** (panel) | `/mi-comunidad` | URL (solo se veía si tenías una comunidad o eras admin) | Panel real; solo se quitó del menú. |
| **Organizadores** | `/organizadores` | Nada (oculto también en toda la app) | **Decisión (24/sep): se queda quitado.** Directorio con organizaciones y cifras **inventadas** (`data/featuredOrganizers.js`, ej. "GlitchGang Official · 48 torneos · 12.4k jugadores", fotos de `pravatar.cc`). Necesita mucho pulido; requiere endpoint real de organizadores (la reputación ya existe en `OrganizerReview`). |
| Grupo **Social** | — | — | El grupo desapareció: Mensajes y Amigos subieron a Principal; Noticias y Organizadores se quitaron. |

Para devolver uno al sidebar: borra su línea de `SIDEBAR_HIDDEN` (y si hace falta, añádelo al bloque que corresponda en
`components/Sidebar/Sidebar.jsx`).

## 3. Topbar (barra superior con sesión)

| Se quitó | Qué era | Por qué | Para reactivar |
|---|---|---|---|
| **Botón de sonido ambiental** | Altavoz que activa/silencia el ambiente | Decisión de producto (24/sep): no se usa. Sin él montado el ambiente **no arranca**. | Borrar `section:topbar-sound` de `betaHidden.js`. |
| Chip de **puntos (PTS)** / **Progreso y logros** | Chip con puntos que llevaba a `/recompensas` | `/recompensas` es "Próximamente"; sin sistema de puntos real no aporta. | Reactivar `/recompensas` (esto y la tarjeta de progreso del Dashboard vuelven solos). |
| Buscador: **GLITCH GANG TV**, **Progreso y logros** | Atajos en el buscador rápido | `/tv` y `/recompensas` son "Próximamente". | Idem. |

## 4. Paneles de rol

### Jugador (`/jugador`)
| Se quitó | Ruta | Por qué | Para reactivar |
|---|---|---|---|
| **Mi Rendimiento** | `/jugador/rendimiento` | Ruta en "Próximamente". Existe `PlayerPerformance.jsx` (249 líneas). Parte del contenido (**Rendimiento por mapa y Radar de habilidades**) es siempre el mismo dato fijo. | `BACKEND-PENDIENTE.md` → *Rendimiento por mapa y Radar*. Rutear la página cuando esas secciones tengan datos reales (o esconderlas). El resto (stats, evolución de rating) ya tiene backend. |
| Botón **Plan Pro** (abajo del sidebar) | `/planes` | Lleva a "Próximamente". | Junto con Planes. |

### Organizador (`/organizador`)
| Se quitó | Ruta | Por qué | Para reactivar |
|---|---|---|---|
| **Discord y bots** | `/organizador/integraciones` | Ruta en "Próximamente". **Decisión (24/sep): se mejora, no se elimina.** Hoy lo real de Discord vive dentro de cada torneo (pestaña Discord); esta vista sería el resumen global del organizador. | Ver "Por mejorar" abajo. |
| **Mi Perfil** (Configuración) | `/organizador/configuracion` | Ruta en "Próximamente". **Decisión (24/sep): se mejora, no se elimina.** Existe `OrganizerSettings.jsx` (1484 líneas) sin rutear. El perfil profesional del organizador sí funciona en `/organizador/perfil`. | Ver "Por mejorar" abajo. |
| *(no estaban en el menú)* `/organizador/finanzas`, `/organizador/crm` | — | También "Próximamente". Existen `OrganizerPayments.jsx` (108 líneas, sin API), `OrganizerCRM.jsx` (271 líneas) y `OrganizerParticipants.jsx` (sin API). | Cartera del organizador + pasarela (BACKEND-PENDIENTE); CRM depende del bot. |

### Creador (`/creador`)
Todo el panel era "Próximamente"; solo funciona **Perfil profesional**.
| Se quitó | Ruta | Por qué | Para reactivar |
|---|---|---|---|
| **Resumen** | `/creador` | Ahora **redirige** a `/creador/perfil`. | Construir el resumen real. |
| **Contenido**, **Analíticas**, **Monetización** | `/creador/contenido`, `/analiticas`, `/monetizacion` | "Próximamente". Existen `CreatorContent/Analytics/Monetization.jsx` (~100–150 líneas, **sin API**, datos fijos). | Backend de contenido, métricas y monetización. |

### Marca (`/marca`)
| Se quitó | Ruta | Por qué | Para reactivar |
|---|---|---|---|
| **Inventario** | `/marca/inventario` | "Próximamente". Existe `BrandInventory.jsx` (264 líneas, 1 API, `data/brandStats.js`). | Inventario real de espacios con precios. |
| **Creatividades** | `/marca/creatividades` | "Próximamente". Existe `BrandCreatives.jsx` (299 líneas, 1 API). | Subida y aprobación de piezas. |
| **Naming Rights** | `/marca/naming-rights` | "Próximamente", sin página. | Definir el producto. |
| **Reportes** | `/marca/reportes` | "Próximamente". Existe `BrandReports.jsx` (197 líneas, 1 API). | Métricas reales de campañas. |

### Comunidad (`/mi-comunidad`)
| Se quitó | Ruta | Por qué | Para reactivar |
|---|---|---|---|
| **Operaciones** | `/mi-comunidad/operaciones` | "Próximamente". Existe `CommunityOperations.jsx` (150 líneas, 1 API). | Conectar checklist/estado. |
| **Presencia web** | `/mi-comunidad/web` | "Próximamente". Existe `CommunityWeb.jsx` (101 líneas, 1 API). | Conectar. |

### Equipo (`/mi-equipo`)
| Se quitó | Ruta | Por qué | Para reactivar |
|---|---|---|---|
| **Calendario** (del equipo) | `/mi-equipo/calendario` | Las actividades y scrims se guardan **solo en el navegador** (`localStorage`), no se comparten con el resto del equipo. **Decisión (24/sep): se mejora con backend.** | Ver "Por mejorar" abajo (calendario personal). |

Sí funcionan y se dejan: Resumen, Roster, Enfrentamiento, Página web, Patrocinadores, Solicitudes, Modo Retador, Privacidad.

## 5. Botones y secciones dentro de páginas

| Página | Se quitó | Por qué |
|---|---|---|
| **Dashboard** | Botón "Ver progreso" y la **tarjeta de Progreso** (puntos, nivel, barra) | Llevan a `/recompensas` (oculta) y no hay sistema de puntos real. *(El botón "Ver historial" ya se volvió a mostrar.)* |
| **Landing** | Botón "Ver transmisiones" | Lleva a `/tv` (Próximamente). |
| **WhatsNew** (novedades) | Pestaña **Creadores** | Su "Ver todos" lleva a `/creadores` (Próximamente). |
| **Ajustes → Suscripción** | "Próxima renovación: 1 Jul 2026" (fecha fija inventada), botones "Ver planes"/"Gestionar", y tarjeta **Historial de facturas** (lista fija `INVOICES`) | Datos de ejemplo. Se deja la tarjeta de **Referidos** (real). |
| **Panel de comunidad** | Botón "Ir a operaciones", accesos "Operaciones" y "Presencia web", atajo "Redes" | Llevan a vistas ocultas / `/redes` (Próximamente). |
| **Panel de marca (resumen)** | "Subir creatividad", "Ver todas" (creatividades), acciones rápidas "Ver inventario" y "Subir creatividad" | Llevan a vistas ocultas. |
| **Panel de jugador (resumen)** | Tarjeta **Logros**; KDA sin dato ya no muestra el `2.84` de ejemplo | Logros = lista fija inventada, sin modelo (`BACKEND-PENDIENTE.md` → *Logros del jugador 100% inventado*). *(Los botones "Ver historial completo" ya se volvieron a mostrar.)* |
| **Ajustes de organizador** | Botón "Directorio" | Lleva a `/organizadores` (datos de ejemplo). |
| **Marca → Organizadores** | Botón de contacto en cada tarjeta | Llevaba al perfil público de ejemplo `/organizadores/:id`. |
| **Panel de equipo** | "Ver Scrims / VS", "Ver en scrims", "Buscar jugadores" | Llevan a los tabs de `/equipos` que hoy son "Próximamente". |

## 6. Página `/equipos`: tabs en "Próximamente"

Los tres siguen visibles con la etiqueta **Próximamente** y muestran la pantalla **"Próximamente" que ya existía**
(`pages/ComingSoon`, clases `gg-soon`, con botones "Ir al inicio" y "Volver"); no hay un diseño aparte. El código
sigue ahí (se controla con `section:teams-find` y `section:teams-scrims`).

| Tab | Por qué | Para reactivar |
|---|---|---|
| **Scrims** | Lista local (`localStorage`), sin backend. | Backend de scrims + calendario de equipo. |
| **Buscar Equipo** | Tarjetas LFT de demostración + `localStorage`. | Reemplazado por **`/jugador/buscar-equipo`** (panel de jugador, datos reales). Decidir si este tab se retira o se reconecta. |
| **Buscar Jugadores** | Vacantes de demostración + `localStorage`. | Reemplazado por el botón **Reclutar** del panel de equipo (`/mi-equipo/reclutar`). Decidir si este tab se retira o se reconecta. |

También se ocultó el botón **"Buscar Scrims"** de la pantalla posterior a crear un equipo.

---

## 6b. Devuelto a la beta

| Vista | Qué se hizo |
|---|---|
| **Historial del jugador** (`/jugador/historial`) | Ya está en el sidebar y en los botones. Se quitaron las partidas y resultados **de ejemplo** de relleno: ahora solo muestra datos reales (`/players/me/matches`, `/players/me/tournaments`) y una nueva tarjeta **Trayectoria de equipos** (equipos actuales + anteriores, con fecha de salida, de `/teams/mine` y `/teams/mine/history`). Si no hay datos, lo dice claramente. |
| **Perfil profesional de jugador**, **Buscar equipo** y **Reclutar** | Nuevas pantallas reales: `/jugador/perfil` (tarjeta Jugador Pro), `/jugador/buscar-equipo` (buscar y postularse con la tarjeta) y `/mi-equipo/reclutar` (vacantes + compartir). Ver `BACKEND-PENDIENTE.md` → *Perfil profesional de jugador*. |

## 6c. Por mejorar (decidido: NO se eliminan)

- **Calendario personal.** Hoy `/calendario` no está en ningún menú, y si la API no devuelve torneos cae a torneos de
  ejemplo. La idea: que sea **mi calendario** — que aparezcan mis torneos (como jugador, con mi equipo o como staff) y que
  yo elija qué juegos quiero ver (Mobile Legends, MOBA en general, por categoría) y en qué rango de fechas.
  Necesita: `GET /tournaments/calendar?from&to&games&categories&mine` + guardar las preferencias del usuario
  (juegos/categorías seguidas). También reemplaza el calendario local del panel de equipo.
- **Discord y bots (organizador).** Resumen global del organizador: estado del bot/espacio de Discord de cada torneo
  (`discordProvision`), reintentar el aprovisionamiento y ver el registro de mensajes (`GET /tournaments/:id/discord-log`
  ya existe).
- **Configuración del organizador.** Rutear `OrganizerSettings.jsx` tras revisar qué guarda de verdad.

## 7. Rutas que siguen existiendo (por URL) mostrando "Próximamente"

`/planes`, `/premium`, `/tv`, `/creadores`, `/redes`, `/recompensas`,
`/jugador/rendimiento`, `/organizador/finanzas`,
`/organizador/crm`, `/organizador/integraciones`, `/organizador/configuracion`,
`/creador/contenido`, `/creador/analiticas`, `/creador/monetizacion`,
`/marca/inventario`, `/marca/naming-rights`, `/marca/creatividades`, `/marca/reportes`,
`/mi-comunidad/operaciones`, `/mi-comunidad/web`.

**Páginas ya construidas pero sin rutear** (la ruta apunta a `ComingSoon`; al reactivar
basta cambiar el `element` en `AppRoutes.jsx`): `Pricing` (`/planes`), `Premium`
(`/premium`), `TV` (`/tv`), `Socials` (`/redes`), `Rewards` (`/recompensas`, usa
`data/rewards.js` fijo), `CreatorsDirectory` (`/creadores`, 1 API), `PlayerPerformance`,
`PlayerHistory`, `OrganizerPayments`, `OrganizerCRM`, `OrganizerSettings`,
`BrandInventory`, `BrandCreatives`, `BrandReports`, `CommunityOperations`,
`CommunityWeb`, `CreatorContent`, `CreatorAnalytics`, `CreatorMonetization`.

`/creador` ya no es "Próximamente": redirige a `/creador/perfil`.

---

## 8. Revisado y se deja (funciona con backend real)

Dashboard, Torneos (lista, detalle, inscripción, pago, crear), Ranking, Comunidad
(y páginas por juego), Equipos (lista, detalle, unirse, crear), Universidad, Amigos,
Mensajes, Noticias, Perfil, Editar perfil, Notificaciones, Ajustes (salvo lo de
Suscripción), Ayuda/Tickets, paneles de **Organizador** (torneos y gestión completa),
**Caster, Analista, Coach, Moderador**, **Marca** (resumen, mi marca, organizadores,
campañas, contacto), **Comunidad** (resumen, crear, miembros, publicaciones), **Jugador**
(resumen, equipos, partidas, perfil de jugador) y el panel **Admin** (con las salvedades
de la sección 9).

---

## 9. Detectado y NO tocado (decidir después)

| Dónde | Qué pasa | Nota |
|---|---|---|
| **Landing** | Secciones con datos fijos (`data/games`, `tournaments`, `news`). | Es marketing; revisar que no muestre torneos/cifras falsas antes de la beta pública. |
| **/calendario** | Si la API no devuelve torneos, muestra torneos de ejemplo (`data/tournaments.js`). | No está en ningún menú, pero es accesible. |
| **/marcas** | Si la API no trae marcas, cae a `SPONSORS` fijos. | Funciona en parte. |
| **/organizadores/:id**, **/noticias/organizador/:slug** | Datos de ejemplo. | Ocultos de menús, accesibles por URL. |
| **Checkout / métodos de pago** | "Modo demo": PayPal sin credenciales; la transferencia "se valida al instante". | Ver `BACKEND-PENDIENTE.md` → *Pagos*. Nadie debería poder cobrar hasta cerrar eso. |
| **PublishModal** (límite de publicaciones) | Botones de mejora que llevan a `/premium` (Próximamente) y `/premium/checkout`. | Decidir si se muestra el límite en beta. |
| **PostCard** | Publicaciones "demo" no se pueden guardar/likear (avisa con un toast). | Solo afecta datos de ejemplo. |
| **Panel de equipo** | El bloque "Control competitivo" sigue mostrando el estado de scrims (vacío, viene de `localStorage`). | Ocultar el bloque entero cuando se decida. |
| **Admin** | Algunas pantallas muestran "demo" si no hay backend (`AdminUsers`, `AdminTeams`, `AdminTournaments`, `AdminAdmins`) y `AdminValidacion` no llama a la API. | El admin no es parte de la beta pública; no se tocó. |
| **Roles** | **Sponsor** tiene tarjeta pero no panel donde editar su perfil profesional. Rutas de WhatsApp (`/vincular-whatsapp`, `/conectar-whatsapp`) siguen en el router con `WHATSAPP_ENABLED = false`. | — |

---

## 10. Orden sugerido para ir devolviéndolas

1. ~~Historial del jugador~~ **(devuelto 24/sep)**. Sigue **Rendimiento** (sin mapas/radar): el backend de stats y de rating ya está.
2. **Recompensas / Progreso** (chip de puntos y Dashboard) cuando exista el sistema de puntos real.
3. **Calendario de equipo** + **Scrims** (mismo backend).
4. **Buscar Equipo / Buscar Jugadores** (directorio sobre `gamerProfile.lft`).
5. **Organizadores** (directorio real).
6. **Planes / Pro** + **Suscripción** (requiere pasarela real).
7. **Finanzas y CRM del organizador**, **paneles de Creador y de Marca**, **Comunidad → Operaciones/Web**.
8. **TV**, **Creadores**, **Redes** (contenido/producto por definir).
