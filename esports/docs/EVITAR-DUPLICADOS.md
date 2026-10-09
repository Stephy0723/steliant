# Qué evitar para no seguir duplicando

Resumen de lo que se encontró en la auditoría del 2026-10-04 y las reglas para
que no vuelva a pasar. Cada punto viene de un bug real.

---

## 1. Archivos duplicados (`Archivo 2.jsx`, `Modelo 3.js`)

**Causa:** el repo vive dentro de `~/Documents`, que está sincronizado con
**iCloud Drive**. Cuando git cambia muchos archivos de golpe (checkout, merge,
pull), iCloud cree que hay un conflicto y crea una copia con " 2". Por eso los
duplicados aparecen justo después de un merge.

**Qué hacer:**
- Clona el repo **fuera** de `Documents`/`Desktop` (por ejemplo `~/dev/glitchgang`),
  o desactiva *Ajustes del Sistema → Apple ID → iCloud → iCloud Drive →
  "Carpetas Escritorio y Documentos"*.
- **Nunca** uses `git add -A` ni `git add .` sin revisar `git status` antes.
  Agrega archivos por nombre.
- El `.gitignore` ya bloquea `* [0-9].*`, así que no deberían entrar al repo,
  pero si ves uno en tu disco, **no lo edites ni lo importes**: es una copia
  vieja. Compáralo con `cmp -s "X 2.jsx" "X.jsx"` y bórralo.
- Si editaste por error la copia " 2", pasa tus cambios al archivo real a mano.

---

## 2. Merges que pierden código

Pasó dos veces en esta auditoría:
- `brands.controller.js` usaba `placement`, `linkUrl`, `targetUniversityId`,
  pero un merge borró la línea que los declaraba → **crear cualquier campaña
  daba error 500**.
- `Checkout.jsx` llamaba `updateUser` sin sacarlo de `useAuth()` → después de
  **pagar**, la página se rompía y no mostraba el comprobante.

**Qué hacer:**
- Al resolver conflictos, no aceptes "todo lo mío" o "todo lo suyo": lee las
  dos versiones y combina.
- Después de cada merge corre el build **y** un lint de variables no
  definidas. `vite build` **no** detecta una variable inexistente; solo falla
  cuando el usuario llega a esa línea.
  ```bash
  # ESLint con no-undef + rules-of-hooks sobre los archivos tocados
  npx eslint --rule 'no-undef: error' --rule 'react-hooks/rules-of-hooks: error' <archivos>
  ```

---

## 3. Funciones y helpers repetidos

- En `community.controller.js` ya existía `nextCommunityCode(user)`; crear otra
  con el mismo nombre rompe el módulo entero al arrancar el backend.
- **Antes de crear un helper, búscalo:** `grep -rn "function nombre" backend/src frontend/src shared`.
- Si dos archivos (frontend y backend) necesitan la misma lógica o la misma
  lista, va en **`shared/`** (como `shared/tournamentSetup.mjs`,
  `shared/roleApplications.mjs`), no copiada a mano en los dos lados.
  Ejemplo vivo: `PROFESSIONAL_PROFILE_FIELDS` en `profile.controller.js` se
  mantiene "a mano en paralelo" con `shared/roleApplications.mjs`; si agregas
  un campo a un rol y no lo agregas allí, el servidor lo descarta en silencio.

---

## 4. Dos implementaciones de la misma función

| Duplicado | Cuál es el real |
|---|---|
| Panel de equipo dentro de `Teams.jsx` vs `team/MyTeamPanel` | **MyTeamPanel** (`/mi-equipo`). El de Teams.jsx no tiene ruta. |
| Posts de comunidad: `/posts?community=slug` vs `/communities/:id/posts` | **`/posts`** (es lo que usan las pantallas). |
| `OrganizerSettings.jsx` vs `RoleProfessionalProfile` | **RoleProfessionalProfile** (OrganizerSettings no tiene ruta). |
| `Community.js` define `name`, `slug`, `members`... **dos veces** en el mismo schema | Gana la segunda; no agregues una tercera. |

**Regla:** antes de construir una pantalla o endpoint, busca si ya existe
(`grep` por la ruta o el nombre). Si existe uno viejo sin uso, bórralo en el
mismo PR en vez de dejar los dos.

---

## 5. Nombres que no coinciden entre frontend y backend

Los datos "se guardaban" pero el servidor los descartaba:
- El formulario manda `team`, el modelo se llama `staff`.
- El backend devuelve `_id`, el frontend buscaba por `id` → el panel nunca
  encontraba la comunidad seleccionada.
- El Composer mandaba `kind: 'event'` / `'tournament'`, pero el enum de `Post`
  solo acepta `'evento'` / `'torneo'` → **toda** publicación de evento fallaba.
- El backend devuelve `memberCount`; `members` es una lista de ids.

**Regla:** al conectar un formulario, abre el modelo de Mongoose y confirma
cada campo. Mongoose **descarta en silencio** lo que no está en el schema
(y los `allowed = [...]` de los controladores también).

---

## 6. Datos de ejemplo y éxitos falsos

- No uses `data/*.js` (mocks) como "fallback" cuando la API viene vacía: el
  usuario ve torneos, miembros o amigos inventados como si fueran reales.
  Si no hay datos, muestra un estado vacío.
- No muestres `toast('¡Enviado!')` / `'Guardado'` si no hubo llamada al
  servidor, ni **antes** de saber si la llamada salió bien.
- No dejes stubs que devuelven `[]` (`lib/communityStore.js`,
  `lib/eventsStore.js`) detrás de un formulario: el usuario llena todo y se
  pierde.
- Si algo todavía no tiene backend: `<ComingSoon />` o el mensaje
  **"Se habilitará en la próxima versión"**, y ocúltalo en
  `config/betaHidden.js`.

---

## Checklist antes de hacer push

- [ ] `git status` sin archivos " 2" / " 3"
- [ ] Archivos agregados por nombre (nada de `git add -A`)
- [ ] `npm run build` en frontend sin errores
- [ ] Lint `no-undef` + `rules-of-hooks` sobre lo que tocaste
- [ ] Cada campo nuevo del formulario existe en el modelo y en el `allowed` del controlador
- [ ] Ningún toast de éxito sin respuesta real del servidor
