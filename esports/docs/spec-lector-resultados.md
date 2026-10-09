# Especificación: Lector de resultados con IA, sección "Equipo" y cuentas de juego conectadas

**Proyecto:** GlitchGang — plataforma de torneos de e-sports (web + bot de Discord + CRM)
**Repositorio:** `Stephy0723/glitchgang`, rama `master`
**Fecha:** Octubre 2026 · **Versión 2** (corrige la v1 contra el código que ya existe)
**Para:** la sesión de código que va a implementar esto

---

## 0. Cómo usar este documento

Este documento trae el **contexto completo**, las **decisiones ya tomadas** (y por qué), **ejemplos** y **criterios de aceptación**.

Antes de escribir código:
1. Lee el documento completo. Las secciones están conectadas: el lector de IA (sección 4) compara contra las cuentas de juego verificadas (sección 6), y la sección "Equipo" (sección 3) muestra datos que generan las dos.
2. Lee la **sección 1.1 "Lo que ya existe"**. Esta especificación **extiende** ese sistema; no lo reemplaza ni lo duplica.
3. Si algo de este documento choca con lo que ya existe, **no lo rompas**: adapta la propuesta y anótalo en tu resumen final.
4. Trabaja por fases (sección 10). Al terminar cada fase: build, prueba, commit a `master`.

Los nombres de campos, colecciones y rutas nuevos son **sugerencias**. Usa las convenciones del proyecto.

---

## 1. Contexto del producto

| Pieza | Qué es | Stack |
|---|---|---|
| Web | `glitchgang.net`. Jugadores se registran, crean equipos, se inscriben en torneos. | React + Node/Express + MongoDB |
| Bot de Discord | Corre en el **servidor compartido de GlitchGang** (un servidor para todos; el servidor propio del organizador es una función de pago que **no** está construida). Crea las salas de cada torneo y equipo, maneja `/start-match`, `/report`, roles. | Node.js, proceso separado |
| CRM | `discord.glitchgang.net` (`discord-bot/api/server.js` + `discord-bot/frontend`). Panel para manejar el bot. | Express + frontend propio |

**Regla de arquitectura (obligatoria):** el bot **nunca** habla con el backend directamente. Las únicas conexiones permitidas son **Web ↔ CRM** y **CRM ↔ Bot**. El bot llama al backend a través del relay `/bot-proxy/*` del CRM (ver `discord-bot/services/backendApi.js`). El CRM lee datos del backend en vivo (`/api/bots/*`), no los copia a su propia base.

**Roles:**
- **Administrador (GG):** ve todo, da soporte, resuelve cuentas de juego en disputa.
- **Organizador:** crea torneos; ve solo sus torneos, sus equipos y su staff.
- **Staff del organizador:** árbitros, moderadores. Ya existe un sistema de staff por torneo con permisos (`StaffPermissionsEditor`, `/tournaments/staff/mine`): **reúsalo**.

Juego principal: **Mobile Legends: Bang Bang (MLBB)**. El diseño debe soportar más juegos (configuración por juego).

### 1.1 Lo que ya existe (no reconstruir)

Commit `f2ff7cc` (5/oct/2026) — **Estadísticas desde capturas**. Documentación completa en `docs/match-stats.md`.

| Pieza existente | Dónde | Qué hace |
|---|---|---|
| Lector con Gemini | `backend/src/services/matchStatsVision.service.js` | Lee una captura de MLBB y devuelve ganador, kills y estadísticas por jugador. |
| Ficha por partida de la serie | `MatchStatsDraft` (torneo + match + `gameNumber`) | Borradores por equipo, revisiones (máx. 100), confirmación inmutable. **Ya soporta BO3/BO5** (una ficha por partida). |
| Historial por jugador | `PlayerMatch` | Se escribe al confirmar la ficha. **No crear otra colección de estadísticas.** |
| Editor | `frontend/src/components/MatchStats/MatchStats.jsx` | Sube hasta 4 capturas, lee con IA, resuelve nicks contra el roster, guarda y confirma. |
| Dónde se ve | Organizador → torneo → **Bracket** → botón **"Estadísticas por capturas"** en cada partida (y dentro del modal de resultado). Jugador → **Mi equipo → Enfrentamiento → Capturas y estadísticas**. Página directa: `/torneos/:id/partidas/:matchId/estadisticas`. | |
| Laboratorio temporal | `/admin/laboratorio-estadisticas` | Prueba de lectura sin guardar. **Se elimina** al terminar las pruebas. |
| Roster congelado | `registrations[].rosterSnapshot` (`userId`, `nick`, `gameId`, `slot`) + `rosterSnapshotAt` | Se crea en el **primer check-in**. Es el "nickname congelado" de esta especificación. |
| `/report` en Discord | `discord-bot/commands/report.js` → `reportMatch` → `tryAutoSyncMatchReport` (`bracketSync.service.js`) | Hoy: opciones `resultado`, `imagen` (un adjunto), `equipo`. Si **los dos equipos** reportan lo mismo, avanza el bracket (solo eliminación simple). Si no coinciden, marca `report.disputed`. |
| ID de juego | `User.profile.gameId` (un string) | Se copia al `rosterSnapshot`. Se extiende en la sección 6. |

**Cambios de regla respecto a lo que hay hoy** (decididos por la dueña del proyecto, 6/oct/2026):
- Hoy el texto de `docs/match-stats.md` y del editor dice *"La IA nunca confirma resultados / nunca avanza rondas"*. Esa regla se puso cuando solo se leía una captura. **Cambia:** la IA puede avanzar el bracket cuando las capturas de **los dos equipos** coinciden (sección 4). Actualiza esos textos.
- Hoy la lectura exige que el usuario marque un consentimiento de envío a Google en cada captura. Con lectura automática, el consentimiento pasa a darse **una vez, al inscribirse** (sección 6.6).

---

## 2. El lector en el panel de organizador

El lector **ya está** en el panel de organizador (sección 1.1). Lo que falta:

1. **Vista global "Resultados por revisar"** en el panel del organizador: todas las partidas que necesitan a un humano, de todos sus torneos, para no entrar torneo por torneo.
2. Que el detalle de cada partida muestre la **tarjeta de resultado** (sección 4) y los casos del árbitro.
3. Que el admin conserve acceso de **solo lectura** para soporte.
4. Quitar el laboratorio temporal de admin cuando terminen las pruebas.

### Ejemplo de "Resultados por revisar"

| Torneo | Partida | Equipos | Estado | Motivo | Árbitro | Hace |
|---|---|---|---|---|---|---|
| Legends of Titan | Cuartos #2 · P1 | Neoxis vs Red Wolves | ⚪ Por confirmar | Captura de daño borrosa | — | 12 min |
| Legends of Titan | Cuartos #3 · P2 | Kaos vs Fénix | 🟠 En arbitraje | Las capturas muestran ganadores distintos | Ana P. | 40 min |
| Copa Caribe | Grupo A #5 · P1 | Astra vs Titanes | ⚪ Por confirmar | Jugador no reconocido | — | 1 h |

Filtros: por torneo, por estado, "sin árbitro". Orden: lo más viejo primero.

---

## 3. Nueva sección "Equipo" en el panel de organizador

### Problema
El sidebar del organizador solo tiene **Torneos** y **Perfil**. No hay dónde ver equipos y jugadores fuera de un torneo, ni manejar el staff de forma global.

### Qué hacer
```
Sidebar organizador
├── Torneos
├── Equipo        ← NUEVO
│   ├── Equipos participantes
│   └── Staff
└── Perfil
```

### 3.a Equipos participantes

Equipos que han jugado **al menos un torneo de este organizador**.

1. **Lista de equipos** → logo, nombre, # jugadores, # torneos jugados, último torneo.
2. **Clic en un equipo** → integrantes: nickname, rol (capitán / jugador / suplente), cuenta de juego (icono del juego + estado, sección 6).
3. **Clic en un integrante** → ficha con dos pestañas:

**Pestaña "Datos generales":**
```
Usuario GG:            Carlos Martínez (perfil)
Discord:               carlosm
ID de juego:           123456789 (servidor 2045)
Nickname actual:       xX_Neo_Xx
Cuenta de juego:       [icono MLBB] ✅ Verificada (desde 02/10/2026)
Equipo actual:         Neoxis (Capitán)
Historial de faltas:   1 — Cambio de nickname (Copa Caribe, 28/09/2026)
```

**Correo y teléfono: NO se muestran en esta versión.** Solo se mostrarán cuando exista el consentimiento del jugador al inscribirse (Ley 172-13 de RD), y solo al organizador de torneos donde ese jugador participó. Para contactar se usa Discord.

**Pestaña "Datos de partida":** sale de `PlayerMatch` (ya existe). Agrupado por torneo y por partida.

| Torneo | Partida | Resultado | Héroe | KDA | Daño | Daño recibido | Part. % | Oro | MVP |
|---|---|---|---|---|---|---|---|---|---|
| Legends of Titan | Cuartos #2 · P1 | Victoria | Chou | 5/2/9 | 48,200 | 61,500 | 62% | 9,800 | Sí |

Arriba: partidas, % de victorias, KDA promedio. Las columnas dependen del juego (`shared/matchStats.mjs` → `STAT_FIELDS`).

### 3.b Staff

Reutiliza el sistema de staff por torneo que ya existe. Esta vista es el **resumen global** del organizador:

| Nombre | Discord | Rol | Permisos | Torneos | Activo |
|---|---|---|---|---|---|
| Ana P. | ana | Árbitro | Arbitrar resultados, ver capturas | 3 | ✅ |
| Luis R. | luis | Moderador | Ver resultados (solo lectura) | 1 | ✅ |

Permisos nuevos que hacen falta (agregar al sistema existente): `ver_resultados`, `arbitrar_resultados`, `editar_estadisticas`.

Nota: hoy `docs/match-stats.md` dice que *"ser staff con acceso genérico al bracket no autoriza confirmar estadísticas"*. Eso se mantiene: solo el permiso explícito `arbitrar_resultados` autoriza.

---

## 4. Lectura automática y avance del bracket

### Flujo nuevo
```
/start-match → se juega → cada equipo usa /report con sus capturas
   → las capturas llegan al backend (vía CRM)
   → la IA lee automáticamente las capturas de cada equipo (en segundo plano)
   → se cruzan las dos lecturas entre sí y con el roster congelado
   → 🟢 avanza el bracket   ó   ⚪/🟠 va al árbitro
```

### Por qué la IA ahora sí puede avanzar
La pantalla de fin de partida de MLBB muestra a **los dos equipos**: ganador, perdedor y las estadísticas de los 10 jugadores. Si **cada equipo** manda su captura y **las dos dicen lo mismo**, el resultado está confirmado por dos fuentes independientes. No hace falta un humano.

### Regla de 🟢 Validado (avance automático)
El bracket avanza solo si se cumplen **todas**:
1. **Reportaron los dos equipos**, cada uno con sus capturas requeridas.
2. La IA leyó el **mismo ganador** en las capturas de ambos equipos.
3. Eso coincide con lo que **cada equipo declaró** en `/report`.
4. Los jugadores leídos corresponden al **roster congelado** de cada equipo (ver sección 7).
5. La confianza general y la del resultado están **por encima del umbral** (sugerido 0.85, en configuración, no en el código).
6. No hay señales de manipulación (sección 4.3).

Si falla cualquiera → no avanza y se abre un **caso de arbitraje**.

El 🟢 escribe el resultado en `bracketDoc.results[matchId]` con `source: 'ai-validated'`, confirma la ficha de `MatchStatsDraft` (con `confirmation.role: 'system'`) y escribe `PlayerMatch`. Usa la lógica que ya existe en `tryAutoSyncMatchReport`; amplíala, no la dupliques. Hoy solo funciona en eliminación simple: **extiéndela a los demás formatos** o, si no da tiempo, que en los otros formatos el 🟢 quede como "listo para confirmar con un clic".

En series BO3/BO5 cada partida tiene su ficha (`gameNumber`); el ganador de la serie se calcula al completar las partidas necesarias.

### 4.1 Estados del resultado

| Estado | Cuándo | Qué pasa |
|---|---|---|
| ⏳ **Analizando** | La IA está leyendo. | Nada. |
| 🟢 **Validado** | Se cumplen las 6 condiciones. | Avanza el bracket solo. |
| ⚪ **Por confirmar** | Falta algo pero no hay contradicción: captura borrosa, campo ilegible, confianza baja, cambio de nickname, IA caída, solo reportó un equipo. | Caso de arbitraje de prioridad normal. |
| 🟠 **En arbitraje** | Contradicción: las capturas muestran ganadores distintos, los equipos declaran cosas distintas, posible suplantación o captura manipulada. | Caso de arbitraje de prioridad alta. |
| 🔴 **Rechazado** | El árbitro determina que el reporte no es válido. | Se pide nuevo reporte, se repite la partida o se sanciona. |

**Regla de oro:** nada avanza el bracket en ⏳, ⚪ o 🟠 sin que un árbitro decida.

### 4.2 Cómo entra el árbitro / staff

**Quién arbitra:** el organizador del torneo y su staff con permiso `arbitrar_resultados`. El admin de GG solo mira (soporte).

**Ciclo de un caso:**
```
Se abre el caso (⚪ o 🟠)
   │  aviso a los árbitros del torneo (web + canal #staff del torneo en Discord)
   ▼
"Tomar caso" → el caso queda asignado a esa persona
   │  (los demás lo ven como "Lo revisa Ana P."; evita que dos decidan a la vez;
   │   el organizador puede reasignarlo)
   ▼
El árbitro ve, lado a lado:
   - las capturas de los dos equipos
   - lo que leyó la IA de cada una y en qué difieren (resaltado)
   - lo que declaró cada equipo
   - el roster congelado y las cuentas verificadas
   ▼
Decisión (una de estas):
   ✅ Confirmar ganador (puede corregir campos antes)   → 🟢 avanza el bracket
   📸 Pedir nueva captura a un equipo (con plazo)       → vuelve a ⏳ al recibirla
   🔁 Ordenar repetir la partida                        → se reabre la partida
   🔴 Rechazar reporte / sancionar                      → 🔴 + falta registrada
   │
   ▼
Aviso a los dos equipos con la decisión y el motivo.
Todo queda en la auditoría.
```

**Escalado:** si nadie toma un caso en **10 minutos** (configurable), se avisa al organizador. Si es 🟠 y nadie lo toma en **20 minutos**, el aviso se repite y se marca en rojo en "Resultados por revisar".

**Motivo obligatorio** cuando el árbitro decide contra lo que leyó la IA o contra lo que declaró un equipo (mínimo 10 caracteres, como ya exige hoy el editor al resolver conflictos).

**Apelación de un equipo:** después de una decisión, cualquiera de los dos capitanes puede pulsar "Apelar" una sola vez, con un texto. El caso vuelve a 🟠 y **lo debe tomar otra persona** distinta del primer árbitro (si el organizador es el único árbitro, lo decide él y queda anotado).

**Decisión pendiente de la dueña del proyecto:** si **solo un equipo reporta** y vence el plazo del otro:
- Opción A: gana automáticamente el que reportó, si su captura se lee bien (🟢 con motivo "rival no reportó").
- Opción B: queda ⚪ y el árbitro confirma con un clic.
Implementa la opción como configuración por torneo, con **B por defecto** hasta que ella decida.

### 4.3 Señales de manipulación (marcan 🟠)
- Las capturas de los dos equipos no muestran los mismos números para los mismos jugadores (si es la misma partida, deben coincidir).
- La misma imagen (hash idéntico o casi idéntico) ya se usó en otra partida.
- Duración o fecha visible en la captura incompatible con la hora de `/start-match`.
- La IA detecta edición evidente (texto superpuesto, bordes recortados).

Las dos primeras son baratas y entran en esta versión. Las otras pueden quedar como "aviso" sin bloquear.

### 4.4 Tarjeta de resultado

```
🟢 VALIDADO — Cuartos #2 · Partida 1 · Legends of Titan
Victoria de NEOXIS · 14:32 min · confirmada por las capturas de los dos equipos

Neoxis                         Red Wolves
xX_Neo_Xx  Chou   5/2/9  MVP   Lobo_7    Tigreal  1/6/4
...                            ...

[Ver capturas de Neoxis] [Ver capturas de Red Wolves] [Editar] [Abrir caso]
```

Siempre se ven las **capturas originales al lado** de lo leído, y el árbitro puede **editar cualquier campo** antes de decidir.

### 4.5 Auditoría
Toda acción humana y automática se guarda (usa las `revisions` de `MatchStatsDraft` y amplíalas):
```
06/10/2026 15:10 — Sistema: lectura IA de Neoxis (confianza 0.95) y Red Wolves (0.93), coinciden → 🟢
06/10/2026 15:12 — Ana P. (Árbitro) tomó el caso
06/10/2026 15:12 — Ana P. cambió "daño recibido" de Lobo_7: vacío → 55,300
06/10/2026 15:13 — Ana P. confirmó ganador Neoxis (⚪ → 🟢). Motivo: "captura de daño borrosa, resultado claro en ambas"
```

### 4.6 Notas técnicas
- Reutiliza `matchStatsVision.service.js` (Gemini, `GEMINI_STATS_MODEL`, lista de modelos de respaldo). No agregues otro proveedor.
- Procesa en segundo plano (cola/job); no bloquees `/report`.
- Si la IA falla o no responde → ⚪ con motivo "Lectura automática no disponible". **El torneo nunca se bloquea por la IA.**
- Guarda la lectura cruda de la IA y la versión final aprobada.
- Respeta la cuota existente (4 lecturas por usuario por minuto); la lectura automática cuenta contra una cuota del sistema, no del jugador.

---

## 5. `/report` pide todas las capturas

### Problema
`/report` acepta **un** adjunto. MLBB reparte las estadísticas en varias pantallas.

### Qué hacer
Agregar opciones de adjunto a `/report` según la configuración del juego (Discord permite varias opciones de tipo archivo en un mismo comando). Es más simple y fiable que una conversación paso a paso.

```
/report resultado:Victoria equipo:Neoxis
        resumen:[imagen]  daño:[imagen]  recibido:[imagen]  participacion:[imagen]
```

- Las requeridas son obligatorias en el comando; las opcionales no.
- Si falta alguna requerida o una imagen no es una captura del juego (la IA lo detecta), el bot responde qué falta y el equipo puede usar `/report` de nuevo solo con esa.
- **Cada equipo** manda sus capturas: es lo que permite el 🟢 automático (sección 4).
- También se pueden subir desde la web (editor existente).

### Configuración por juego
```json
{
  "game": "mlbb",
  "requiredScreenshots": [
    { "key": "overview",     "label": "Resumen (Victoria/Derrota y marcador)", "required": true },
    { "key": "damage_dealt", "label": "Daño infligido",                         "required": true },
    { "key": "damage_taken", "label": "Daño recibido",                          "required": true },
    { "key": "teamfight",    "label": "Participación",                          "required": false }
  ],
  "reportDeadlineMinutes": 15,
  "accountVerification": "ingame-mail-code"
}
```
Confirmar con capturas reales qué pantallas da hoy MLBB. El límite actual del editor es 4 capturas (`MATCH_STATS_LIMITS.images`); si la configuración pide más, súbelo.

### Plazo
```
Minuto 0:   /start-match o fin estimado de la partida → empieza el plazo (ej. 15 min).
Minuto 10:  Bot → "⏰ Faltan 5 minutos. Te falta: Daño recibido."
Minuto 15:  Vence → reporte INCOMPLETO, falta "capturas incompletas" en el historial
            del equipo, aviso al organizador. Se aplica la regla de "solo un equipo
            reportó" (sección 4.2).
```
La sanción **no** es automática; la decide el organizador.

---

## 6. Cuenta de juego verificada (ID + servidor + código en el juego)

### 6.1 Por qué
En MLBB el **nickname es texto libre**: se repite entre jugadores y se cambia cuando uno quiere. Lo que identifica a una cuenta es el **ID + servidor (zone ID)**, que nunca cambia. Por eso:
- La cuenta de juego se identifica **solo por ID + servidor**. El nickname es un dato que se actualiza, no una llave.
- Un jugador puede cambiarse el nombre las veces que quiera **fuera de torneo**: seguimos sabiendo quién es por su ID.
- Que el usuario toque "Sí, es mi cuenta" **no prueba nada** (cualquiera puede escribir el ID de otro). La prueba real es un **código que Moonton envía al correo dentro del juego**: solo el dueño de la cuenta puede abrir ese correo.

### 6.2 Flujo para el jugador
Una sola vez, desde **Perfil → Cuentas de juego** (y se le ofrece al intentar inscribirse sin cuenta).

```
1. [ Conectar Mobile Legends ]

   ┌────────────────────────────────┐
   │ ID de juego:  [ 123456789  ]   │
   │ Servidor:     [ 2045       ]   │
   │   ¿Dónde lo veo? (ayuda)       │
   │        [ Buscar cuenta ]       │
   └────────────────────────────────┘
   (No se pide nickname: lo traemos nosotros.)

2. Panel flotante con lo que devuelve la consulta:

   ┌────────────────────────────────┐
   │ [avatar] xX_Neo_Xx             │
   │ ID 123456789 (2045)            │
   │ Nivel 87 · Mítico · 1,240 part.│  ← solo los datos que la API dé
   │                                │
   │ ¿Esta es tu cuenta?            │
   │   [ Sí, es mía ]  [ No ]       │
   └────────────────────────────────┘

3. "Sí, es mía" →
   ┌────────────────────────────────┐
   │ Te enviamos un código a tu     │
   │ CORREO dentro de Mobile Legends│
   │ (abre el juego → Correo).      │
   │ Código: [ ______ ]  vence 5 min│
   │ [ Verificar ]  Reenviar código │
   └────────────────────────────────┘

4. Código correcto →
   ┌────────────────────────────────┐
   │ [icono MLBB] Mobile Legends    │
   │ xX_Neo_Xx · 123456789 (2045)   │
   │ ✅ Verificada                   │
   └────────────────────────────────┘
```

- "No" → vuelve al paso 1.
- ID no encontrado → *"No encontramos esa cuenta. Revisa el ID y el servidor."*
- Código incorrecto → 3 intentos, luego esperar 10 minutos.
- La consulta no responde → *"No pudimos verificar tu cuenta ahora."* y se ofrece el Plan B (6.5).
- El panel del paso 2 muestra **lo que la API tenga disponible**. El nickname e ID son seguros; nivel, rango, partidas y victorias pueden no estar (ver 6.4). Nunca bloquees el flujo porque falte un dato de rango.

### 6.3 Estados de la cuenta de juego

| Estado | Cuándo | ¿Puede inscribirse? |
|---|---|---|
| ⚫ **Sin conectar** | No ha puesto su ID. | Según el torneo (6.6) |
| ⚪ **En revisión** | Pidió revisión manual (Plan B) o hay disputa de propiedad. | Según el torneo (6.6) |
| ✅ **Verificada** | Ingresó el código del correo del juego, o el admin la aprobó. | Sí |
| 🔴 **Rechazada** | El admin determinó que el ID no le corresponde. | No |

El indicador **icono del juego + estado** se ve en: perfil del jugador, lista de integrantes del equipo (web y CRM), ficha del jugador (sección 3) y pantalla de inscripción (cada jugador con ✅ o ❌).

### 6.4 Servicio de consulta (`gameAccountService`)
- Existe una API comunitaria **no oficial** (Rone Arena, `arena.rone.dev`) que implementa el flujo de Moonton: **ID + servidor → código al correo del juego (vence en 5 min) → inicio de sesión → datos del perfil**. No está afiliada a Moonton. Sus endpoints de estadísticas de ranked, temporada e historial están **marcados como obsoletos**: no dependas de ellos.
- Para la consulta simple de nickname por ID también existen librerías basadas en páginas de recarga (`aditamagf/check-ign`, `triyatna/php-valid-game`, en PHP): sirven como respaldo para el paso 2, **no** para verificar propiedad.
- Aísla todo en un servicio propio con: timeout corto, reintento limitado, caché del nickname, límite de consultas y de envíos de código por usuario, y manejo de errores. Si el proveedor deja de funcionar, se cambia sin tocar el resto.
- Las consultas se hacen **desde el backend**, nunca desde el navegador.
- **Privacidad:** el acceso que da el código se usa **una sola vez** para verificar y leer los datos del perfil. **No se guarda** el token de sesión del jugador.
- **Fase 1 (bloqueante):** probar el flujo completo con un ID real de la dueña del proyecto. Si el envío del código no funciona, **detente y avisa**: la verificación quedaría solo en Plan B.

#### Cómo funciona por dentro (Rone Arena, verificado el 6/oct/2026 en su OpenAPI `https://arena.rone.dev/api/openapi.json`)

| Paso | Llamada | Cuerpo | Respuesta |
|---|---|---|---|
| 1. Enviar código | `POST https://arena.rone.dev/api/user/auth/send-vc` | `{ "role_id": 123456789, "zone_id": 2045 }` (números) | `{ code: 0, msg, data }` — `code: 0` = enviado. Moonton manda un código de **4 dígitos** al correo del juego, válido 5 min. |
| 2. Validar código | `POST https://arena.rone.dev/api/user/auth/login` | `{ "role_id": 123456789, "zone_id": 2045, "vc": 4821 }` | `{ code: 0, data: { jwt, token, roleid, zoneid, time } }` — si `code: 0` y `roleid`/`zoneid` coinciden con lo pedido, **la cuenta es suya**. |
| 3. Leer perfil | `GET https://arena.rone.dev/api/user/info` con `Authorization: Bearer <jwt>` | — | Nickname, nivel, avatar, etc. en `data`. |
| 4. Cerrar | `POST https://arena.rone.dev/api/user/auth/logout` | — | Se descarta el JWT; **no se guarda**. |

Otros endpoints (`/user/stats`, `/user/season`, `/user/matches`) existen pero están marcados `deprecated`: pueden dejar de responder.

Condiciones del servicio (`HOSTED_API_TERMS.md` del repo `ridwaanhall/rone-arena-api`):
- Gratuito, **sin garantía de disponibilidad**. Un `503` puede traer `alternative_endpoint` con otro host: léelo en vez de reintentar a ciegas.
- Los endpoints de jugador solo se pueden usar con la **autenticación del propio jugador** (es justo nuestro caso).
- **Uso comercial "por acuerdo"**: GlitchGang cobra a organizadores, así que hay que **escribirles antes de producción**. Alternativa: el código es **BSD-3** (libre, con atribución), se puede replicar en Node la llamada que ellos hacen a Moonton y no depender de su servidor.
- Piden crédito visible: "Verificación con Rone Arena" con enlace a `https://arena.rone.dev`.

### 6.5 Plan B: revisión manual
Si la API no funciona o hay una disputa:
- El jugador envía ID + servidor + **captura de su perfil del juego** (donde se vea nickname e ID) → ⚪ En revisión.
- La IA lee la captura y prellena los datos para el admin.
- Panel de **administrador → "Cuentas por revisar"**:

| Jugador | ID / Servidor | Nickname (captura) | Motivo | Evidencia | Acción |
|---|---|---|---|---|---|
| Pedro G. | 998877 / 1020 | PedroMX | API no disponible | Captura perfil | ✅ ❌ |
| Ana R. | 112233 / 2045 | AnaPro | ID reclamado por otro usuario | Captura + código | ✅ ❌ |

- Cada decisión queda en la auditoría; se avisa al jugador por web y Discord.

### 6.6 Reglas
- **Un ID + servidor solo puede estar verificado en una cuenta de GlitchGang** (índice único sobre las cuentas en estado verificado).
- **Disputa de propiedad:** si alguien intenta conectar un ID ya verificado por otro, se le ofrece verificar con el código del juego. Si lo verifica, **gana quien tiene el código** (es el dueño real): la cuenta anterior pasa a 🔴 y se crea un caso para el admin, que puede revisar si hubo mala fe.
- **Cambio de nickname fuera de torneo:** libre. El servicio actualiza el nickname guardado al consultar de nuevo (al abrir el perfil, al inscribirse, o una vez al día como máximo).
- **Cambiar o desconectar la cuenta** (el ID) no está permitido mientras el jugador esté en un torneo activo.
- **Obligatoriedad, por etapas:**
  - Mientras la API no haya demostrado estabilidad: **recomendada**. La pantalla de inscripción muestra quién no ha verificado, con aviso, pero no bloquea.
  - Después: el organizador puede marcar en su torneo **"Cuenta de juego verificada obligatoria"** (por defecto activado en torneos de MLBB). Si está activo, el backend rechaza la inscripción si algún titular o suplente no está ✅ (validar en backend, web, CRM y bot), con el mensaje *"Faltan jugadores por verificar su cuenta de juego: Pedro, Luis."*
  - En juegos sin servicio de verificación, la opción no aparece.
- **Consentimiento al inscribirse** (entra en esta versión porque la lectura automática lo necesita): al inscribirse, cada jugador acepta que sus capturas y nicks se envíen a Google para leerlas, y ve el aviso de privacidad. Sin ese consentimiento, sus partidas se procesan a mano.
- El **capitán es responsable** de que los IDs de su equipo sean correctos.

---

## 7. Nickname durante el torneo

### Base
El **roster congelado** ya existe: `registrations[].rosterSnapshot` guarda `userId`, `nick` y `gameId` en el primer check-in. Úsalo como "nickname congelado". **No crees un campo nuevo.** Agrega a cada entrada el `zoneId` cuando exista la cuenta verificada.

### Regla
Prohibido cambiarse el nickname mientras el equipo participe en un torneo activo. El bot lo avisa al inscribirse y al iniciar el torneo.

### Cuando la IA lee un nickname distinto: no acusar de entrada
```
La IA lee "ShadowKing" en Astra, pero el congelado es "AstraKing".
                     │
                     ▼
Consultar el ID registrado de ese jugador (gameAccountService)
                     │
         ┌───────────┴───────────┐
         ▼                       ▼
Ese ID ahora se llama      Ese ID sigue llamándose
"ShadowKing"               "AstraKing"
         │                       │
         ▼                       ▼
CAMBIO DE NOMBRE           OTRA CUENTA JUGANDO
⚪ Por confirmar            🟠 En arbitraje
"Cambio de nickname"       "Posible suplantación"
         │                       │
         ▼                       ▼
Árbitro aprueba → se       Caso de arbitraje
actualiza el nick del      (sección 4.2)
snapshot; falta leve
```
API caída en ese momento → ⚪ con motivo "Nickname no coincide, no se pudo verificar".

---

## 8. Reglamento

Agregar a la **plantilla de reglas por defecto** (`frontend/src/lib/tournamentRegulation.js`); el organizador puede editarlas:

1. *"Cada equipo debe enviar todas las capturas de estadísticas de cada partida dentro del plazo establecido. No hacerlo se considera violación del reglamento."*
2. *"Cada jugador debe tener verificada su propia cuenta de juego. Registrar un ID falso o ajeno puede causar la descalificación del equipo."*
3. *"Está prohibido cambiar el nickname del juego mientras el equipo participe en un torneo activo."*
4. *"Los resultados se validan automáticamente cuando las capturas de ambos equipos coinciden. Cualquier discrepancia la resuelve el árbitro del torneo; su decisión puede apelarse una vez."*

Las faltas se registran en el historial del equipo/jugador. Las sanciones las decide el organizador.

---

## 9. Modelo de datos

**Extender, no duplicar.**

**`User` (extender; hoy existe `profile.gameId`):**
```js
gameAccounts: [{
  game: "mlbb",
  gameId: "123456789",
  zoneId: "2045",
  nickname: "xX_Neo_Xx",            // último conocido; NO es llave
  status: "not_connected" | "review" | "verified" | "rejected",
  verifiedAt: Date,
  verifiedBy: "ingame_code" | "admin",
  profileSnapshot: { level, rank, matches, winRate },  // lo que dé la API, opcional
  reviewReason: String,
  reviewEvidenceUrl: String,
  lastLookupAt: Date
}]
// índice único parcial: (game, gameId, zoneId) donde status = "verified"
// migración: copiar profile.gameId existente como status "not_connected" (sin zoneId)
```

**Inscripción:** `rosterSnapshot[]` ya existe; agregar `zoneId`.

**`MatchStatsDraft` (extender):**
```js
status: "analyzing" | "validated" | "pending_review" | "arbitration" | "rejected"  // además del estado actual
statusReasons: ["low_confidence_field", "nickname_changed", "winner_mismatch", ...],
aiReads: [{ source: teamId, raw, confidence, at }],   // una lectura por equipo
case: { assignedTo, assignedAt, decision, reason, appealedBy, appealedAt },
deadlineAt: Date
// confirmation.role admite "system" para el 🟢 automático
```

**`PlayerMatch`:** ya existe. No crear otra colección.

**Faltas (nuevo):**
```js
{ teamId, playerId?, tournamentId, matchId?, type: "missing_screenshots" | "nickname_change" | "fake_id",
  detail, createdAt, createdBy, sanction? }
```

**Configuración por juego (nuevo):** ejemplo en la sección 5. Puede vivir en `shared/` junto a `matchStats.mjs`.

---

## 10. Fases

1. **Fase 1 — Prueba de verificación.** Replicar en Node la consulta ID + servidor y el envío/validación del código al correo del juego. Probar con un ID real. Si el código no funciona, **detente y avisa**.
2. **Fase 2 — Cuenta de juego.** `gameAccounts`, migración de `profile.gameId`, flujo con panel flotante + código, indicador, Plan B y "Cuentas por revisar", disputa de propiedad, opción por torneo "verificación obligatoria" (por defecto en modo recomendado).
3. **Fase 3 — `/report` con varias capturas.** Configuración por juego, adjuntos múltiples (pasando por el CRM), plazo y faltas.
4. **Fase 4 — Lectura automática y avance.** Cola en segundo plano, lectura de las capturas de cada equipo, cruce entre ambas y con el roster, regla 🟢, extensión de `tryAutoSyncMatchReport`, actualizar los textos de "la IA nunca confirma".
5. **Fase 5 — Arbitraje.** Casos, "Tomar caso", decisiones, escalado, apelación, auditoría, vista global "Resultados por revisar", permiso `arbitrar_resultados`.
6. **Fase 6 — Nickname congelado.** `zoneId` en el snapshot y lógica cambio de nombre vs. suplantación.
7. **Fase 7 — Sección "Equipo".** Equipos participantes (3 niveles + ficha) y Staff global.
8. **Fase 8 — Reglamento y consentimiento.** Cláusulas en la plantilla y consentimiento al inscribirse.

Al final de cada fase: build, prueba manual del flujo, commit a `master` con mensaje claro.

---

## 11. Criterios de aceptación

- [ ] Existe la vista global "Resultados por revisar" en el panel de organizador.
- [ ] Si las capturas de los dos equipos coinciden y se cumplen las 6 condiciones, el bracket avanza solo y queda en la auditoría como "Sistema".
- [ ] Si las capturas o las declaraciones discrepan, se abre un caso 🟠 y no avanza nada.
- [ ] Un árbitro puede tomar el caso, ver las capturas de ambos equipos lado a lado, corregir, decidir con motivo, y los equipos reciben el aviso.
- [ ] Un caso sin tomar avisa al organizador a los 10 minutos.
- [ ] Un equipo puede apelar una vez y la apelación la revisa otra persona.
- [ ] Si la IA falla, el resultado queda ⚪ y el torneo no se bloquea.
- [ ] `/report` acepta todas las capturas configuradas; si vence el plazo, queda la falta y se avisa al organizador.
- [ ] El jugador pone ID + servidor (sin nickname), ve el panel con los datos de su cuenta, confirma, recibe el código en el correo del juego y queda ✅ Verificada.
- [ ] Un ID solo puede estar verificado en una cuenta; quien demuestra el código gana la disputa.
- [ ] El nickname se actualiza solo fuera de torneo; el ID no se puede cambiar con un torneo activo.
- [ ] Con "verificación obligatoria" activa, el backend rechaza inscripciones con jugadores sin verificar y la pantalla dice quién falta.
- [ ] Si la API falla, el jugador puede pedir revisión con captura; el admin tiene "Cuentas por revisar".
- [ ] La IA compara contra `rosterSnapshot`; un cambio de nombre se distingue de una suplantación.
- [ ] Sección "Equipo" con "Equipos participantes" (3 niveles, ficha con 2 pestañas, **sin** correo ni teléfono) y "Staff".
- [ ] Las 4 cláusulas están en la plantilla y el consentimiento se pide al inscribirse.
- [ ] El laboratorio temporal de admin se eliminó.

---

## 12. Fuera de alcance (segunda ronda)

No implementar ahora, pero no diseñar nada que lo impida:
- **Detección avanzada de edición de imágenes** (más allá del hash y del cruce entre equipos).
- **Sanciones escalonadas automáticas.**
- **Límite de lecturas de IA por plan de suscripción.**
- **Mostrar correo y teléfono al organizador** (requiere el consentimiento de la fase 8 y una decisión de producto).
- **Servidor de Discord propio del organizador** (función de pago).

---

## 13. Al terminar

Entrega un resumen con:
- Qué se hizo en cada fase y los hashes de los commits.
- Qué cambió respecto a este documento y por qué.
- Si la verificación por código del juego funcionó y con qué proveedor.
- La decisión pendiente de la sección 4.2 (solo un equipo reporta) y cualquier otra que necesite a la dueña del proyecto.
