/* GG · avatares por defecto (kit "Señal", mascota.js).
   El Visor del asistente atrapado en cinco glitches. Cada SVG se anima con SMIL
   dentro del propio archivo, así que funciona inline Y como <img src>.
   Documentación completa: ./README.md

   ggAvatarSvg({ glitch, mood, color, size, bg, label, still }) → string SVG
   GG_AVATARS → los cinco avatares oficiales (id, name, glitch, mood, color, note) */

let uid = 0

export const GG_COLORS = {
  verde: '#00E676',
  morado: '#8B5CF6',
  azul: '#3B82F6',
  rosa: '#FF4FD8',
  amarillo: '#FACC15',
}
const GR = '#ff2e63' // canal rojo  (--glitch-r)
const GC = '#00f0ff' // canal cian  (--glitch-c)
const BG = '#060a0e' // pantalla del Visor

const R = (x, y, w, h, ex = '', inner = '') => inner
  ? `<rect x="${x}" y="${y}" width="${w}" height="${h}"${ex}>${inner}</rect>`
  : `<rect x="${x}" y="${y}" width="${w}" height="${h}"${ex}/>`
const P = (d, c) => `<path d="${d}" fill="none" stroke="${c}" stroke-width="2" stroke-linecap="square" stroke-linejoin="miter"/>`
const A = (attr, values, dur, ex = '') => `<animate attributeName="${attr}" values="${values}" dur="${dur}s" repeatCount="indefinite"${ex}/>`
const D = ' calcMode="discrete"'
const T = (values, dur, ex = '') => `<animateTransform attributeName="transform" type="translate" values="${values}" dur="${dur}s" repeatCount="indefinite"${ex}/>`

function blink(y, h, delay) {
  const m = y + h / 2
  return A('height', `${h};${h};.8;${h};${h}`, 4.6, ` keyTimes="0;.9;.93;.96;1" begin="${delay}s"`)
    + A('y', `${y};${y};${m - .4};${y};${y}`, 4.6, ` keyTimes="0;.9;.93;.96;1" begin="${delay}s"`)
}

// Ojos por faceta. Mismas coordenadas que GGVisor.jsx (viewBox 32×25.6).
function eyes(m, c, anim, delay) {
  const b = (x, y, w, h) => R(x, y, w, h, '', anim ? blink(y, h, delay) : '')
  if (m === 'think') return b(9, 7, 5, 4) + b(18, 7, 5, 4)
  if (m === 'happy') return P('M9 13 L11.5 9.5 L14 13 M18 13 L20.5 9.5 L23 13', c)
  if (m === 'listen') return R(9, 11, 5, 2) + R(18, 11, 5, 2)
  if (m === 'error') return P('M9.5 8 L13.5 13 M13.5 8 L9.5 13 M18.5 8 L22.5 13 M22.5 8 L18.5 13', c)
  return b(9, 7, 5, 8) + b(18, 7, 5, 8)
}

function rnd(seed) { let s = seed; return () => (s = (s * 16807) % 2147483647) / 2147483647 }
const LOOK = '0 0;0 0;-1.6 0;-1.6 0;0 0;0 0;1.6 -.4;1.6 -.4;0 0'

export function ggAvatarSvg({ glitch = 'rgb', mood = 'idle', color = GG_COLORS.verde, size = null, bg = true, label = 'GG', still = false } = {}) {
  const n = ++uid, c = color, id = k => k + n, box = 'x="0" y="0" width="32" height="25.6" rx="7.68"', an = !still
  const off = { rgb: 0, corte: 1.3, estatica: 2.1, entrelazado: .6, bloques: 3.2 }[glitch] || 0
  const look = an ? T(LOOK, 7.4, ` keyTimes="0;.18;.24;.42;.48;.66;.72;.9;1" begin="-${off}s"`) : ''
  const eyeG = col => `<g>${eyes(mood, col, an, -off)}${look}</g>`
  const sweep = an ? `<rect x="0" y="-6" width="32" height="5" fill="url(#${id('sw')})" clip-path="url(#${id('hc')})">${A('y', '-6;26', 3.4, ` begin="-${off}s"`)}</rect>` : ''
  const face = `<rect ${box} fill="${BG}"/><rect ${box} fill="url(#${id('hg')})"/><rect ${box} fill="url(#${id('vg')})"/><rect ${box} fill="url(#${id('sl')})"/>${sweep}<rect x="3.84" y="2.05" width="9.6" height="2.56" rx="1.28" fill="#fff" opacity=".07"/><g fill="${c}"${an ? '' : ` filter="url(#${id('gl')})"`}>${an ? A('opacity', '1;.86;1;1;.92;1', 1.7, D) : ''}${eyeG(c)}</g><rect x=".28" y=".28" width="31.44" height="25.04" rx="7.4" fill="none" stroke="${c}" stroke-opacity=".5" stroke-width=".55"/>`
  const U = (t = '') => `<use href="#${id('f')}"${t ? ` transform="${t}"` : ''}/>`
  const band = (k, y, h, ys) => `<clipPath id="${id(k)}"><rect x="-8" y="${y}" width="48" height="${h}">${an && ys ? A('y', ys, 2.6, D + ` begin="-${off}s"`) : ''}</rect></clipPath>`
  let defs = '', body = ''

  if (glitch === 'rgb') {
    const ghost = (col, xs) => `<g opacity=".85" fill="${col}">${an ? T(xs, 1.9, D) : ''}${eyeG(col)}<rect x=".28" y=".28" width="31.44" height="25.04" rx="7.4" fill="none" stroke="${col}" stroke-width=".55"/></g>`
    body = U() + ghost(GR, '-1.2 0;-.5 0;-1.4 0;-2.6 .4;-.8 0;-1.2 0;-.3 0;-1.2 0') + ghost(GC, '1.2 0;.5 0;1.4 0;2.6 -.4;.8 0;1.2 0;.3 0;1.2 0') + `<g fill="${c}">${eyeG(c)}</g>`
  }
  if (glitch === 'corte') {
    defs = band('b', 9, 4.6, '9;9;3;16;9;19;6;9') + band('c', 14, 1.8, '14;21;5;14;11;14;2;14')
    body = U() + `<g clip-path="url(#${id('b')})"><rect x="-8" y="-4" width="48" height="34" fill="${BG}"/><g>${U()}${an ? T('2.4 0;3.6 0;-2 0;2.4 0;4.4 0;1.2 0;-3 0;2.4 0', 2.6, D + ` begin="-${off}s"`) : ''}</g></g><g clip-path="url(#${id('c')})"><rect x="-8" y="-4" width="48" height="34" fill="${BG}"/><g>${U()}${an ? T('-1.2 0;-3 0;1.8 0;-1.2 0;-.4 0;-2.4 0;2 0;-1.2 0', 2.6, D + ` begin="-${off}s"`) : ''}</g></g>`
      + R(-3, 8.8, 40, .4, ` fill="${c}" opacity=".7"`, an ? A('y', '8.8;8.8;2.8;15.8;8.8;18.8;5.8;8.8', 2.6, D + ` begin="-${off}s"`) : '')
  }
  if (glitch === 'estatica') {
    const r = rnd(7), frame = () => { let d = ''; for (let i = 0; i < 60; i++) { const x = 2 + r() * 28, y = 1.6 + r() * 22.4; d += R(x.toFixed(2), y.toFixed(2), .55, .55, ` fill="${r() > .7 ? c : '#fff'}" opacity="${(.15 + r() * .4).toFixed(2)}"`) } return d }
    const frames = [0, 1, 2].map(i => `<g opacity="${i ? 0 : 1}">${frame()}${an ? A('opacity', [0, 1, 2].map(j => j === i ? 1 : 0).join(';'), .36, D) : ''}</g>`).join('')
    let bar = ''; for (let x = 1; x < 31;) { const w = .4 + r() * 1.6; bar += R(x.toFixed(2), 0, w.toFixed(2), 1.3, ` fill="#fff" opacity="${(.08 + r() * .35).toFixed(2)}"`); x += w + r() * 1.2 }
    body = U() + frames + `<g transform="translate(0 16.6)">${an ? T('0 16.6;0 16.6;0 4;0 20;0 11;0 16.6', 3, D + ` begin="-${off}s"`) : ''}${bar}</g>` + R(8, 9, 16, .7, ` fill="${BG}"`, an ? A('y', '9;9;9;7.5;9;10;9', 1.4, D) : '')
  }
  if (glitch === 'entrelazado') {
    let ev = '', od = ''; for (let i = 0, y = -1.6; y < 28; i++, y += 1.1) { const s = R(-8, y.toFixed(2), 48, 1.1); if (i % 2) od += s; else ev += s }
    defs = `<clipPath id="${id('e')}">${ev}</clipPath><clipPath id="${id('o')}">${od}</clipPath>`
    body = `<g clip-path="url(#${id('e')})"><g>${U()}${an ? T('0 0;0 0;0 0;-.5 0;0 0', 1.1, D) : ''}</g></g><g clip-path="url(#${id('o')})"><g transform="translate(1.1 0)">${U()}${an ? T('1.1 0;.4 0;1.8 0;.8 0;2.6 0;1.1 0', 1.1, D + ` begin="-${off}s"`) : ''}</g></g>`
  }
  if (glitch === 'bloques') {
    const blk = (k, x, y, w, h, moves) => { defs += `<clipPath id="${id(k)}"><rect x="${x}" y="${y}" width="${w}" height="${h}"/></clipPath>`; return `<g clip-path="url(#${id(k)})"><rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${BG}"/><g transform="translate(${moves.split(';')[0]})">${U()}${an ? T(moves, 2.2, D + ` begin="-${off}s"`) : ''}</g></g>` }
    body = U() + blk('k', 24, 15, 10, 7, '2.6 -1.8;2.6 -1.8;4 0;1 -2.6;2.6 -1.8;0 0;2.6 -1.8') + blk('j', -2, 3, 7, 6, '-1.4 1.6;-1.4 1.6;0 0;-2.4 .8;-1.4 1.6;-1.4 3;-1.4 1.6') + blk('m', 12, 17, 8, 4, '0 0;0 0;0 0;3 -1;0 0;-2 0;0 0')
      + R(10, 11.5, 4, 2, ` fill="${BG}"`, an ? A('x', '10;10;18;10;19;10', 2.2, D) : '')
      + `<g fill="${c}">${[[23.5, 4, 2.4, 1.6, '23.5;23.5;21;26;23.5'], [25, 16.2, 3.6, 1.4, '25;25;25;20;25'], [5.6, 15, 2.2, 2.2, '5.6;8;5.6;5.6;3'], [14.2, 12.4, 1.6, 1.6, '14.2;14.2;17;14.2;11']].map(([x, y, w, h, xs], i) => R(x, y, w, h, ` opacity="${[1, .8, .55, 1][i]}"`, an ? A('x', xs, 1.7 + i * .3, D) + A('opacity', `${[1, .8, .55, 1][i]};0;${[1, .8, .55, 1][i]};${[1, .8, .55, 1][i]}`, .9 + i * .4, D) : '')).join('')}</g>`
  }

  const dim = size ? ` width="${size}" height="${size}"` : ''
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"${dim} role="img" aria-label="${label}" data-glitch="${glitch}"><defs>
<radialGradient id="${id('bg')}" cx=".5" cy=".5" r=".6"><stop offset="0" stop-color="${c}" stop-opacity=".2">${an ? A('stop-opacity', '.2;.14;.22;.2', 3.4) : ''}</stop><stop offset="1" stop-color="${c}" stop-opacity="0"/></radialGradient>
<radialGradient id="${id('hg')}" cx=".5" cy=".15" r=".7"><stop offset="0" stop-color="${c}" stop-opacity=".2"/><stop offset="1" stop-color="${c}" stop-opacity="0"/></radialGradient>
<radialGradient id="${id('vg')}" cx=".5" cy=".5" r=".62"><stop offset=".6" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".7"/></radialGradient>
<linearGradient id="${id('sw')}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${c}" stop-opacity="0"/><stop offset=".7" stop-color="${c}" stop-opacity=".12"/><stop offset="1" stop-color="#fff" stop-opacity=".16"/></linearGradient>
<clipPath id="${id('hc')}"><rect ${box}/></clipPath>
<pattern id="${id('sl')}" width="1" height="1.6" patternUnits="userSpaceOnUse"><rect width="1" height=".55" fill="#000" opacity=".35"/></pattern>
<filter id="${id('gl')}" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation=".45" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
<g id="${id('f')}">${face}</g>${defs}</defs>${bg ? `<rect width="64" height="64" fill="#07090d"/><rect width="64" height="64" fill="url(#${id('bg')})"/>` : ''}
<g transform="translate(12 16) scale(1.25)">${body}</g></svg>`
}

// Los cinco avatares oficiales. `id` es también el nombre del archivo en /GG/avatars/gg-<id>.svg
export const GG_AVATARS = [
  { id: 'senal', name: 'Señal', glitch: 'rgb', mood: 'idle', color: GG_COLORS.verde, note: 'Separación RGB. Los canales rojo y cian tiemblan y se abren a saltos.' },
  { id: 'corte', name: 'Corte', glitch: 'corte', mood: 'idle', color: GG_COLORS.morado, note: 'Desgarro horizontal. La franja rota salta de altura y se desplaza.' },
  { id: 'estatica', name: 'Estática', glitch: 'estatica', mood: 'think', color: GG_COLORS.azul, note: 'Ruido de señal en tres cuadros y una línea de estática que sube y baja.' },
  { id: 'entrelazado', name: 'Entrelazado', glitch: 'entrelazado', mood: 'idle', color: GG_COLORS.rosa, note: 'Las líneas impares vibran fuera de fase, como vídeo mal sincronizado.' },
  { id: 'bloques', name: 'Bloques', glitch: 'bloques', mood: 'idle', color: GG_COLORS.amarillo, note: 'Compresión rota: los bloques de píxel se recolocan y parpadean.' },
]

// Ruta pública del SVG animado (para <img src> o para guardar como avatar del usuario).
export const ggAvatarUrl = id => `/demos/steliant-esports/GG/avatars/gg-${id}.svg`

// Elige uno al azar (el registro arranca con uno aleatorio).
export const randomGGAvatar = () => GG_AVATARS[Math.random() * GG_AVATARS.length | 0]

