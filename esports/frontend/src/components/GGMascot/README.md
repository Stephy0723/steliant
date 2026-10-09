# GG — la mascota de GlitchGang

GG es **el Visor**: una pantalla CRT pequeña con dos ojos de píxel. Es a la vez el
asistente IA (el códec flotante) y la mascota de la marca. Sigue el cursor, parpadea
y cambia de cara según lo que pasa. Pertenece a la identidad visual **"Señal"**.

Todo se importa desde un solo lugar:

```jsx
import { GGVisor, GGDock, GlitchText, GGAvatar, GGIcon, GG_AVATARS, ggAvatarUrl } from '../components/GGMascot'
```

| Archivo | Qué contiene |
|---|---|
| `../GGAssistant/GGVisor.jsx` | `GGVisor` (la cara), `GGDock` (presencia flotante), `GlitchText` (texto que se descifra) |
| `../GGAssistant/GGVisor.css` | Todo el CSS de la cara, el dock y el códec (prefijos `ggf-` y `ggc-`) |
| `../GGAssistant/GGAssistant.jsx` | El asistente completo (códec + lógica con Gemini) |
| `../GGAssistant/ggNudges.js` | Saludos y sugerencias proactivas por página |
| `GGAvatar.jsx` | Avatar por defecto inline y animado |
| `ggAvatars.js` | Generador de avatares SVG (`ggAvatarSvg`), lista `GG_AVATARS`, colores |
| `ggIcons.jsx` | Íconos del códec (`GGIcon`) |
| `/public/GG/avatars/gg-*.svg` | Los 5 avatares como archivo SVG animado (sirven para `<img>` y para descargar) |

> **Regla de diseño:** el diseño del Visor es el que Stephanie aprobó. No lo rediseñes;
> extiéndelo con las facetas y las piezas de aquí.

---

## 1. Anatomía del Visor

```
 ┌───────────────────────────┐  ← borde 1px acento al 50%, radio = 24% del ancho
 │ ▔▔▔▔                       │  ← reflejo del cristal (blanco al 7%)
 │     ██     ██              │  ← ojos: 2 bloques de píxel (5×8 en un viewBox 32×25.6)
 │     ██     ██              │
 │                            │
 │       ▁ ▃ ▅ ▃ ▁            │  ← onda (solo al hablar) / barra de carga (solo al pensar)
 └───────────────────────────┘
   scanlines + viñeta + halo del color de acento
```

- **Proporción:** ancho × 0.8 de alto. El tamaño se controla con `--s` (en `GGVisor`, prop `size`).
- **Color:** los ojos y el borde usan `currentColor` = `var(--accent)`. Si el usuario cambia el acento del sitio, GG cambia con él. En `error` pasa a rojo (`--loss`).
- **La pantalla nunca cambia.** Solo cambian los ojos y lo que hay debajo de ellos.

---

## 2. Facetas (emociones)

`<GGVisor mood="…" size={60} follow />`, donde `follow` hace que los ojos sigan el cursor.

| `mood` | Nombre | Ojos | Cuándo usarla | Animación |
|---|---|---|---|---|
| `idle` | **Reposo** | Dos bloques abiertos | Estado normal, esperando | Parpadea cada 4,6 s, mira a los lados cada 11 s y tiene un micro-glitch RGB cada ~9 s |
| `hover` | **Atento** | Bloques más grandes (×1.12/×1.18) | Cursor encima o foco de teclado | Borde encendido con `--shadow-signal` |
| `listen` | **Escuchando** | Dos rayas planas `— —` | Con el códec abierto, esperando que escribas | Ninguna |
| `think` | **Pensando** | Bloques entornados (mitad de alto) | Cargando o esperando la respuesta de la IA | Ojos que escanean de lado a lado y barra de carga abajo |
| `talk` | **Hablando** | Abiertos y onda de 5 barras | Mientras escribe la respuesta | Barras que suben y bajan a saltos |
| `happy` | **Feliz** | `^ ^` | Acción completada: fechas aplicadas, perfil guardado, avatar elegido | Pequeño salto |
| `peek` | **Asomado** | Miran a un lado | Se asoma por el borde de la pantalla con una sugerencia | Parpadeo |
| `error` | **Error** | `× ×` en rojo | Señal perdida, fallo de red o de la IA | Sacudida con separación RGB (una vez) |

**Cómo elegir la faceta:** hay una sola por momento. Tiene prioridad `think` > `error` > `talk` > `peek` > `hover` > la faceta de base, que es la misma lógica de `GGAssistant.jsx`. `happy` dura un instante (~1,6 s) y vuelve a `idle`.

---

## 3. Presencia flotante (`GGDock`)

El botón flotante de abajo a la derecha. Tiene estos estados, que se pueden combinar:

| Prop | Qué hace |
|---|---|
| `open` | El códec está abierto: GG pone cara `listen` y aparece la ✕ |
| `notify` | Punto con número arriba a la izquierda (hay algo nuevo) |
| `peek` | Se esconde a medias por el borde derecho, inclinado, con un aviso |
| `msg` | Sube a la parte de arriba (por ejemplo, en `/mensajes` para no tapar el input) |
| `warp` | Glitch de teletransporte al cambiar de posición |
| `hop` | Salto con glitch (saludos) |
| `lift` | Px que sube para no tapar un toast |
| `call` | Aviso HUD al lado: `{ id, text, heart?, options?: [{label}] }`. Sin opciones es un saludo |

El aviso **no es un globo de cómic**: es una etiqueta HUD con conector (`GG ▸`). Nunca pongas GG dentro de un globo de diálogo.

---

## 4. Avatares por defecto

Son el mismo Visor atrapado en cinco glitches distintos, con un color de acento para cada uno. Funcionan con recorte circular y se leen bien a 32 px.

| `id` | Nombre | Glitch | Color | Faceta | Descripción |
|---|---|---|---|---|---|
| `senal` | **Señal** | `rgb` | Verde `#00E676` | idle | Separación RGB: los canales rojo y cian tiemblan y se abren a saltos |
| `corte` | **Corte** | `corte` | Morado `#8B5CF6` | idle | Desgarro horizontal: la franja rota salta de altura y se desplaza |
| `estatica` | **Estática** | `estatica` | Azul `#3B82F6` | think | Ruido de señal en tres cuadros y una línea de estática que sube y baja |
| `entrelazado` | **Entrelazado** | `entrelazado` | Rosa `#FF4FD8` | idle | Las líneas impares vibran fuera de fase, como vídeo mal sincronizado |
| `bloques` | **Bloques** | `bloques` | Amarillo `#FACC15` | idle | Compresión rota: los bloques de píxel se recolocan y parpadean |

Los colores son los mismos de la paleta de acentos del sitio (`themeConfig.js`).

### Uso

```jsx
// Inline, animado (respeta prefers-reduced-motion)
<GGAvatar id="senal" size={48} round />

// Con otra faceta, por ejemplo feliz al elegirlo en el registro
<GGAvatar id="corte" mood="happy" size={160} round />

// Sin animación (listas largas, muchas miniaturas repetidas)
<GGAvatar id="bloques" size={32} round still />

// Como imagen (también animada, gracias a SMIL dentro del SVG)
<img src={ggAvatarUrl('estatica')} alt="Avatar GG Estática" />
```

- `ggAvatarUrl(id)` devuelve `/GG/avatars/gg-<id>.svg`, que se puede guardar tal cual como avatar del usuario.
- `randomGGAvatar()` devuelve uno al azar. En el registro se empieza con uno aleatorio.
- `ggAvatarSvg({ glitch, mood, color, size, bg, label, still })` genera el SVG como texto. Se puede combinar cualquier glitch con cualquier color o faceta, pero **los oficiales son solo los 5 de arriba**.
- Si cambias `ggAvatars.js`, regenera los archivos de `/public/GG/avatars/` para que coincidan.

### Flujo previsto en el registro (paso 3 de 4, «Tu avatar»)

Vista previa grande (160 px, circular, con borde del color del avatar) y cinco opciones en fila (`role="radiogroup"`). Al tocar una, el avatar pone `mood="happy"` unos 900 ms y vuelve a su faceta. Texto: *«Elige tu GG. Es tu foto hasta que subas una propia desde tu perfil.»*

---

## 5. Íconos del códec

`<GGIcon name="copy" />`: trazo de 24×24, sin relleno, con `currentColor`. El tamaño lo da el CSS (14–15 px en el códec).

| `name` | Uso |
|---|---|
| `x` | Cerrar el códec o un aviso |
| `trash` | Nueva conversación (borrar el historial) |
| `check` | Hecho: «Aplicadas», «Copiado» |
| `copy` | Copiar el plan o el texto |
| `refresh` | Reintentar tras un error |

Otros glifos que usa el códec como texto, no como SVG: `▸` (prompt o etiqueta HUD), `↵` (enviar o atajo), `→` (ir a un destino), `●` (EN LÍNEA) y `♥` (saludo). Para descifrar texto se usan `▓▒░█<>/\#%01Ξ`.

---

## 6. Tokens de la señal (`glitch.css` del kit)

| Token | Valor | Uso |
|---|---|---|
| `--accent` | `#00E676` (o el que elija el usuario) | Canal «verde»: siempre es la marca |
| `--glitch-r` | `#ff2e63` | Canal rojo |
| `--glitch-c` | `#00f0ff` | Canal cian |
| `--shadow-rgb` | `-1px 0 rojo .75, 1px 0 cian .75` | Separación RGB en texto (<48 px → 1 px máx.) |
| `--shadow-signal` | anillo + halo del acento | Foco o hover del Visor |
| `--scanline-strong` | líneas cada 3 px | Pantalla del Visor |
| `--ease-settle` | `cubic-bezier(.22,1.2,.36,1)` | Saltos y rebotes de GG |
| `--ease-crt` | `cubic-bezier(.7,0,.84,0)` | Apagado del códec (efecto CRT) |

El GGVisor.css ya define los que necesita, así que no depende de que estén en `index.css`.

---

## 7. Reglas de movimiento y accesibilidad

- **Nunca más de 3 destellos por segundo** (WCAG 2.3.1). Los glitches de reposo van separados al menos ~7 s.
- `prefers-reduced-motion: reduce` apaga todas las animaciones de la cara, el dock y los avatares. `GGAvatar` genera la versión quieta. Solo queda una barra de carga lenta en `think`.
- `html.gg-perf` (modo rendimiento) también congela a GG.
- La cara es decorativa (`aria-hidden`). El botón del dock lleva `aria-label` («Abrir GG, asistente» o «Cerrar GG»).
- Los avatares llevan `role="img"` y `aria-label="Avatar GG <Nombre>"`.
- En móvil (<640 px), el códec ocupa toda la pantalla y el dock se sube por encima de la barra inferior.

---

## 8. Dónde va GG (pendiente)

Los lugares concretos donde colocar la mascota los define Stephanie más adelante. Anótalos aquí cuando se decidan:

- [ ] …

Lo que ya está en uso: el asistente flotante (`GGAssistant`, montado en `App.jsx`).

**Correos:** los emails (`backend/src/services/email.service.js`) usan la plantilla de Stephanie con el logo «GG» en un cuadro verde, no el Visor. Si algún día se quiere el Visor en un correo, tiene que ir con celdas de tabla o como PNG alojado, porque los clientes de correo no muestran SVG.

