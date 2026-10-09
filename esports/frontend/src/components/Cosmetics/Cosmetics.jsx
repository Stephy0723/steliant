import { useEffect, useRef } from 'react'
import { PLATE_BY_ID, STATUS_BY_ID } from '../../data/cosmetics.js'
import './Cosmetics.css'
import './CosmeticViews.css'

// Piezas visuales de los cosmeticos (portadas de la "Vitrina de logros").
// El marcado se arma como HTML porque cada diseno tiene decenas de piezas
// con posiciones calculadas; TODO dato del usuario (nick, url del avatar o
// de la imagen) pasa por esc() antes de entrar al HTML.

const AV_FALLBACK = '/demos/steliant-esports/avatar-default.svg'
const esc = value => String(value ?? '').replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]))
const rep = (n, f) => Array.from({ length: n }, (_, i) => f(i)).join('')
const circ = (n, r, f) => rep(n, k => { const a = k / n * Math.PI * 2 - Math.PI / 2; return f(90 + Math.cos(a) * r, 90 + Math.sin(a) * r, k) })

const STAR = '<svg viewBox="0 0 24 24"><path d="m12 2 2.2 5.8L20 10l-5.8 2.2L12 18l-2.2-5.8L4 10l5.8-2.2z"/></svg>'
const HEART = '<svg viewBox="0 0 24 24"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78Z"/></svg>'
const GLOBE = '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><path d="M2 12h20M12 2a15 15 0 0 1 0 20a15 15 0 0 1 0-20"/></svg>'
const TROPHY = '<svg viewBox="0 0 24 24"><path d="M6 9V4h12v5a6 6 0 0 1-12 0Z"/><path d="M6 5H3v2a3 3 0 0 0 3 3M18 5h3v2a3 3 0 0 1-3 3M9 18h6M12 14v4M8 21h8"/></svg>'
const CROWN = '<svg viewBox="0 0 24 24"><path d="M3 20h18M3 10l4 5 5-9 5 9 4-5v9H3z"/></svg>'
const BOLT = '<svg viewBox="0 0 24 24"><path d="M13 2 3 14h7l-1 8 10-12h-7z"/></svg>'

// ── Estados ──
const STATUS_EXTRA = {
  's-play': () => '<i class="ind"></i><span class="eq"><i></i><i></i><i></i><i></i></span>',
  's-cup': () => `<i class="ind cupi">${TROPHY}</i>`,
  's-live': () => '<i class="ind"></i><span class="live">EN VIVO</span>',
  's-afk': () => '<i class="ind"></i><span class="zz"><i>z</i><i>z</i><i>z</i></span>',
  's-king': () => `<span class="crown">${CROWN}</span>`,
  's-fire': () => '<span class="streak">x5</span>',
  's-virus': () => '<span class="pxs"><i style="left:-6px;top:6px"></i><i style="right:-5px;top:-3px;animation-delay:.4s"></i><i style="left:8px;bottom:-6px;animation-delay:.8s"></i></span><i class="ind"></i>',
  's-404': () => '<span class="e404">404</span>',
  's-hack': () => '<span class="rain"><span style="left:8%">10110</span><span style="left:30%;animation-delay:-.6s">01101</span><span style="left:52%;animation-delay:-1.1s">11010</span><span style="left:74%;animation-delay:-.3s">00111</span></span><i class="ind"></i>',
  's-surge': () => `<i class="ind">${BOLT}</i>`,
  's-bday': () => '<span class="cf"><i></i><i></i><i></i><i></i><i></i><i></i></span><span class="bday">CUMPLE</span>',
}

export function StatusAvatar({ statusId, avatar, large = false, className = '' }) {
  const status = STATUS_BY_ID[statusId] || STATUS_BY_ID.online
  const extra = (STATUS_EXTRA[status.fx] || (() => '<i class="ind"></i>'))()
  const html = `<div class="av ${status.fx}${large ? ' lg' : ''}"><img src="${esc(avatar || AV_FALLBACK)}" alt="">${extra}</div>`
  return <span className={`gx gx-status ${large ? 'gx-status--lg' : ''} ${className}`} dangerouslySetInnerHTML={{ __html: html }} />
}

// ── Marcos ── (caja de 180px con avatar de 116px; se escala a `size`)
const avImg = src => `<img class="av" src="${esc(src || AV_FALLBACK)}" alt="">`
const FRAME_HTML = {
  none: av => `<div class="fd">${av}</div>`,
  virus: av => `<div class="fd f-virus"><i class="rg"></i>${circ(16, 68, (x, y, k) => { const s = 4 + (k * 7) % 6; return `<i class="px" style="left:${x - s / 2 + ((k * 13) % 9 - 4)}px;top:${y - s / 2 + ((k * 7) % 9 - 4)}px;width:${s}px;height:${s}px;--d:${1 + (k % 4) * 0.35}s;--dl:${(k % 5) * 0.2}s"></i>` })}<i class="dr" style="left:66px;--h:30px"></i><i class="dr" style="left:86px;--h:42px;animation-delay:.6s"></i><i class="dr" style="left:108px;--h:24px;animation-delay:1.2s"></i>${av}<span class="tg">INFECTADO</span></div>`,
  rgb: av => `<div class="fd f-rgb"><i class="rg r"></i><i class="rg c"></i><i class="rg g"></i>${[[30, 60, '#ff2e63', 40], [62, 90, '#00f0ff', -50], [100, 40, 'var(--accent)', 60], [128, 70, '#ff2e63', -40], [150, 50, '#00f0ff', 30]].map(([y, w, c, x], k) => `<i class="sl" style="--y:${y}px;--w:${w}px;--x:${x}px;background:${c};--dl:${k * 0.02}s"></i>`).join('')}${av}<span class="tg">ERR_0x3F</span></div>`,
  error404: av => `<div class="fd f-404"><i class="rg"></i>${av}<div class="w" style="left:-18px;top:10px;--dl:0s"><span>404</span></div><div class="w" style="right:-22px;top:72px;--dl:1.6s"><span>0x3F</span></div><div class="w" style="left:14px;bottom:-8px;--dl:3.2s"><span>NO SIGNAL</span></div><i class="cur"></i></div>`,
  crown: av => `<div class="fd f-crown"><i class="rays"></i><i class="rg"></i>${av}<span class="cr"><svg viewBox="0 0 24 20"><defs><linearGradient id="gxCrownGrad" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff4c4"/><stop offset=".5" stop-color="#ffd76a"/><stop offset="1" stop-color="#a86b10"/></linearGradient></defs><path d="M2 18h20v1.5H2zM2 16.5 3 6l5 4.5L12 2l4 8.5L21 6l1 10.5z" fill="url(#gxCrownGrad)" stroke="#7a4d08" stroke-width=".6"/><circle cx="12" cy="2" r="1.4" fill="#fff4c4"/><circle cx="3" cy="6" r="1.2" fill="#fff4c4"/><circle cx="21" cy="6" r="1.2" fill="#fff4c4"/></svg></span>${[[14, 40, 0], [150, 30, 0.6], [156, 120, 1.2], [20, 130, 1.8], [120, 8, 0.9]].map(([x, y, d]) => `<i class="sp" style="left:${x}px;top:${y}px;--dl:${d}s">${STAR}</i>`).join('')}</div>`,
  flames: av => `<div class="fd f-fire"><i class="gw"></i>${rep(12, k => `<i class="fl" style="transform:rotate(${k * 30}deg)"><b style="--d:${0.5 + (k % 4) * 0.15}s;animation-delay:-${(k % 3) * 0.2}s"></b></i>`)}<i class="rg"></i>${av}${[[70, -8, 0], [100, 10, 0.8], [86, -14, 1.6]].map(([l, x, d]) => `<i class="em" style="left:${l}px;--x:${x}px;--dl:${d}s"></i>`).join('')}</div>`,
  neko: av => `<div class="fd f-neko"><i class="ear l"></i><i class="ear r"></i><i class="rg"></i>${av}<i class="wh" style="left:2px;transform:rotate(-8deg)"></i><i class="wh" style="right:2px;transform:rotate(8deg)"></i>${[[12, 90, 0], [156, 80, 0.9], [140, 130, 1.8]].map(([x, y, d]) => `<i class="ht" style="left:${x}px;top:${y}px;--dl:${d}s">${HEART}</i>`).join('')}</div>`,
  crystal: av => `<div class="fd f-crystal"><i class="gw"></i><div class="sh-w">${rep(10, k => `<i style="transform:rotate(${k * 36}deg)"><b style="--h:${30 + (k % 3) * 10}px;--dl:${k * 0.25}s"></b></i>`)}</div><i class="rg"></i>${av}${[[10, 30, 0], [160, 60, 0.7], [30, 150, 1.4]].map(([x, y, d]) => `<i class="sp" style="left:${x}px;top:${y}px;--dl:${d}s">${STAR}</i>`).join('')}</div>`,
  portal: av => `<div class="fd f-portal"><i class="gw"></i><i class="r1"></i><div class="rn">${rep(6, k => `<i style="--r:${k * 60}deg"></i>`)}</div><i class="r2"></i><i class="r3"></i>${av}<div class="orb-w" style="--t:3s;--y:4px;--s:9px;--c:#a07cff;z-index:4"><i></i></div><div class="orb-w" style="--t:5s;--y:16px;--s:6px;--c:#4fb4ff;animation-direction:reverse;z-index:4"><i></i></div><div class="orb-w" style="--t:2.2s;--y:-2px;--s:5px;--c:#ff9bd2;z-index:4"><i></i></div></div>`,
  hud: av => `<div class="fd f-hud"><i class="tk"></i><i class="sw"></i><div class="bx"><i style="left:0;top:0;border-right:0;border-bottom:0"></i><i style="right:0;top:0;border-left:0;border-bottom:0"></i><i style="left:0;bottom:0;border-right:0;border-top:0"></i><i style="right:0;bottom:0;border-left:0;border-top:0"></i></div><i class="ch" style="left:89px;top:0;width:2px;height:14px"></i><i class="ch" style="left:89px;bottom:0;width:2px;height:14px"></i><i class="ch" style="top:89px;left:0;width:14px;height:2px"></i><i class="ch" style="top:89px;right:0;width:14px;height:2px"></i>${av}<span class="tg">LOCK</span></div>`,
  storm: av => `<div class="fd f-storm"><i class="gw"></i><i class="rg"></i>${av}<svg class="bolts" viewBox="0 0 180 180"><path d="M30 18 L48 40 L40 44 L58 64"/><path d="M168 54 L146 70 L154 76 L130 92"/><path d="M110 178 L100 154 L110 150 L96 128"/><path d="M4 120 L28 108 L22 100 L46 90"/></svg></div>`,
}

// `size` = diametro del avatar. La decoracion ocupa ~1.55 veces eso.
export function CosmeticFrame({ id, avatar, size = 116, className = '' }) {
  const scale = size / 116
  const box = 180 * scale
  const html = (FRAME_HTML[id] || FRAME_HTML.none)(avImg(avatar))
  return (
    <span className={`gx gx-frame ${className}`} style={{ width: box, height: box }}>
      <span className="gx-frame__in" style={{ transform: `scale(${scale})` }} dangerouslySetInnerHTML={{ __html: html }} />
    </span>
  )
}

// ── Placas ── (380x76; se escalan a `width`)
const PLATE_HTML = {
  inf: (nk, sub) => `<div class="np p-inf"><span class="stp"></span><div class="tx"><span class="nk">${nk}</span><span class="sb">${sub}</span></div><div class="r"><b>2026<br>GG/LILA</b><span class="gl">${GLOBE}</span></div><i class="sw"></i></div>`,
  sak: (nk, sub) => `<div class="np p-sak"><span class="st6">${rep(6, k => `<i style="--k:${k}">${STAR}</i>`)}</span><div class="tx"><span class="nk">${nk}</span><span class="sb">${sub}</span></div><span class="r">GG</span><div class="mq"><span>${'SIN MIEDO · SIN PAUSA · '.repeat(8)}</span></div></div>`,
  reb: (nk, sub) => `<div class="np p-reb"><span class="chk"></span><div class="tx"><span class="nk">${nk}</span><span class="sb">${sub}</span></div><span class="ar"></span><span class="vn">026</span></div>`,
  haz: (nk, sub) => `<div class="np p-haz"><i class="pn"></i><span class="wr"></span><div class="tx"><span class="nk">${nk}</span><span class="sb">${sub}</span></div><span class="ch">CLASE A</span></div>`,
  data: (nk, sub) => `<div class="np p-data"><span class="lgb"></span><div class="tx"><span class="nk">${nk}</span><span class="sb">${sub}</span></div><div class="r"><span class="bc"></span><span>S/N 48-1508F</span></div><i class="sw"></i></div>`,
  sig: (nk, sub) => `<div class="np p-sig"><div class="tx"><span class="nk">${nk}</span><span class="sb">${sub}</span></div><div class="r"><span class="on">ONLINE</span><span class="wave">${'<i></i>'.repeat(7)}</span></div></div>`,
  arc: (nk, sub) => `<div class="np p-arc"><span class="hf">${[[16, 0], [30, 8], [30, 24], [16, 32], [2, 24], [2, 8], [16, 16]].map(([x, y], k) => `<i style="left:${x}px;top:${y}px;--k:${k}"></i>`).join('')}</span><div class="tx"><span class="nk">${nk}</span><span class="sb">${sub}</span></div><span class="r">NV-7<br>ACTIVO</span></div>`,
  ecl: (nk, sub) => `<div class="np p-ecl"><span class="sbx"></span><div class="tx"><span class="nk">${nk}</span><span class="sb">${sub}</span></div><span class="cc"><i></i><i></i></span></div>`,
  hck: (nk, sub) => `<div class="np p-hck"><div class="tx"><span class="nk scr">${nk}</span><span class="sb">${sub}</span></div><div class="r">CHECK IN +<br>STATUS - ON <i></i></div><i class="al"></i></div>`,
  fnd: (nk, sub) => `<div class="np p-fnd"><div class="tx"><span class="nk">${nk}</span><span class="sb">${sub}</span></div><div class="r"><span class="bc"></span><b>N.º 007 / 100</b></div></div>`,
}

const SCRAMBLE = '#$%&@!?/\\<>01ΣΔ█▓▒░'

function motionAllowed() {
  if (typeof window === 'undefined') return false
  if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return false
  return !document.documentElement.classList.contains('gg-perf')
}

export function CosmeticPlate({ id, nick = 'Jugador', width = 380, className = '' }) {
  const ref = useRef(null)
  const plate = PLATE_BY_ID[Number(id)]
  const scale = width / 380
  const text = String(nick || 'Jugador')

  // Placa Hacked: cada 3.6 s el nick se corrompe y se reconstruye.
  useEffect(() => {
    if (plate?.key !== 'hck' || !motionAllowed()) return undefined
    const target = text.toUpperCase()
    let inner = 0
    const outer = setInterval(() => {
      const el = ref.current?.querySelector('.scr')
      if (!el) return
      let n = 0
      clearInterval(inner)
      inner = setInterval(() => {
        n++
        el.textContent = target.split('').map((ch, i) => (i < n - 3 ? ch : SCRAMBLE[Math.random() * SCRAMBLE.length | 0])).join('')
        if (n > target.length + 3) { clearInterval(inner); el.textContent = target }
      }, 45)
    }, 3600)
    return () => { clearInterval(outer); clearInterval(inner) }
  }, [plate?.key, text])

  if (!plate) return null
  const html = PLATE_HTML[plate.key](esc(plate.key === 'hck' ? text.toUpperCase() : text), esc(plate.sub))
  return (
    <span ref={ref} className={`gx gx-plate ${className}`} style={{ width, height: 76 * scale }} data-no-translate>
      <span className="gx-plate__in" style={{ transform: `scale(${scale})` }} dangerouslySetInnerHTML={{ __html: html }} />
    </span>
  )
}

// ── Cartas de logro ── (300x464; la ventana .art lleva la imagen del jugador)
const EMPTY_ART = '<div class="emp">+ Tu imagen</div>'
const CARD_HTML = {
  gold: (ph, nk, up) => `<div class="gc c-gold"><div class="sh"></div><div class="art">${ph()}<i class="tint"></i><i class="sw"></i></div><div class="rail"><span class="no">01</span><span class="vt">CAMPEÓN</span><span class="vs">STELIANT ESPORTS · 2026</span><span class="seal"></span></div><div class="nm"><b>${nk}</b><span>1.er lugar · Torneo oficial</span></div></div>`,
  silver: (ph, nk, up) => `<div class="gc c-silver"><div class="sh"></div><div class="in"></div><div class="tp"><span class="wm">FINAL</span><span class="nb">N.º 02</span></div><div class="lr"><span class="tk"><i></i><i></i><i></i><i></i></span><span class="vt">SUBCAMPEÓN · 2026</span><span class="tk"><i></i><i></i><i></i><i></i></span></div><div class="art">${ph()}<i class="brush"></i><i class="sw"></i></div><div class="nm"><b>${nk}</b><span>FINALISTA · STELIANT ESPORTS</span></div><div class="bt"><span class="bc"></span><span>FINALISTA N.º 02</span></div></div>`,
  bronze: (ph, nk, up) => `<div class="gc c-bronze"><div class="sh"></div><span class="rk">03</span><span class="big">PODIO</span><div class="art">${ph()}<i class="glow"></i>${[22, 40, 58, 74, 32, 66].map((l, k) => `<i class="em" style="left:${l}%;animation-delay:${k * 0.55}s"></i>`).join('')}</div><div class="nm">${nk}</div><div class="st"><div><b>3.º</b><span>PUESTO</span></div><div><b>GG</b><span>PODIO</span></div><div><b>26</b><span>TEMPORADA</span></div></div><span class="lg">GG/26</span></div>`,
  mvp: (ph, nk, up) => `<div class="gc c-mvp"><div class="sh"></div><div class="in"></div><div class="tp">&gt; MVP.EXE <span class="cur"></span><em>PID 0001</em></div><div class="art">${ph('ch r')}${ph('ch g')}${ph('ch b')}${ph('sl')}${ph('sl s2')}<i class="scn"></i><i class="brk" style="left:8px;top:8px;border-right:0;border-bottom:0"></i><i class="brk" style="right:8px;top:8px;border-left:0;border-bottom:0"></i><i class="brk" style="left:8px;bottom:8px;border-right:0;border-top:0"></i><i class="brk" style="right:8px;bottom:8px;border-left:0;border-top:0"></i></div><div class="bt"><span class="glt" data-t="MVP">MVP</span><span class="who"><b>${up}</b>STELIANT_ESPORTS_26</span></div></div>`,
  goat: (ph, nk, up) => `<div class="gc c-goat"><div class="sh"></div><div class="in"></div><div class="tp">GOAT<em>1 / 1</em></div><div class="art">${ph()}<i class="holo"></i><i class="glit"></i></div><div class="bt"><b>${nk}</b><span>El mejor de todos los tiempos</span><span class="hx"><i></i><i></i><i></i></span></div></div>`,
  rookie: (ph, nk, up) => `<div class="gc c-rookie"><div class="sh"></div><div class="tp"><span class="rad"></span>RK-000001<span class="pill">NUEVO TALENTO</span></div><div class="art">${ph()}<i class="ht"></i><i class="head"></i></div><div class="meta"><span>${up}</span><span>T1 · 2026</span></div><div class="wm"><b>ROOKIE</b><span class="chv"><i></i><i></i><i></i></span></div></div>`,
  clutch: (ph, nk, up) => `<div class="gc c-clutch"><div class="sh"></div><div class="in"></div><div class="hz"></div><div class="tp"><b>CLUTCH</b><span>1v4</span></div><div class="art">${ph()}<i class="beat"></i><i class="vig"></i><svg class="ekg" viewBox="0 0 280 60" preserveAspectRatio="none"><path d="M0 36 H90 L102 36 L110 10 L120 56 L132 4 L144 46 L152 36 H280"/></svg></div><div class="bt"><div><b>${nk}</b><span>1 CONTRA 4 · RONDA 24</span></div><span class="bpm">188 BPM</span></div></div>`,
  wall: (ph, nk, up) => `<div class="gc c-wall"><div class="sh"></div><div class="in"></div><i class="rv" style="left:12px;top:30px"></i><i class="rv" style="right:12px;top:30px"></i><i class="rv" style="left:12px;bottom:30px"></i><i class="rv" style="right:12px;bottom:30px"></i><div class="tp"><span class="chip">DEF-01</span><b>LA MURALLA</b></div><div class="art">${ph()}<i class="hex"></i><i class="imp"></i><i class="tint"></i></div><div class="nm">${nk}</div><div class="bt"><span><em>INTEGRIDAD</em><em>100%</em></span><div class="seg">${rep(10, k => `<i style="--p:${k}"></i>`)}</div></div></div>`,
  hawk: (ph, nk, up) => `<div class="gc c-hawk"><div class="sh"></div><div class="tp"><span class="lg"></span><b>HALCÓN</b><span class="hxs"><i></i><i></i><i></i></span></div><i class="ln"></i><div class="art">${ph()}${ph('cl')}<i class="dg"></i><div class="xb"><i style="left:0;top:0;border-right:0;border-bottom:0"></i><i style="right:0;top:0;border-left:0;border-bottom:0"></i><i style="left:0;bottom:0;border-right:0;border-top:0"></i><i style="right:0;bottom:0;border-left:0;border-top:0"></i></div></div><div class="bt"><b>${up}</b><span class="tag">TIRADOR</span><br>PRECISIÓN · TEMPORADA 2026<div class="rl"><span>0</span><span>1</span><span>2</span><span>3</span><span>4</span><span>5</span><span>6</span><span>7</span><span>8</span></div></div></div>`,
  cap: (ph, nk, up) => `<div class="gc c-cap"><div class="sh"></div><div class="in"></div><div class="tp"><b>CAPITÁN</b><span>glitch gang / 2026</span></div><div class="rr"><span class="arr"><i></i><i></i><i></i></span><span class="vt">LÍDER DE ESCUADRA</span></div><div class="art">${ph()}<i class="lk"></i><i class="wd"></i></div><div class="nm">${nk}</div><div class="bt"><span>C-01</span><span class="bc"></span><span>///</span></div></div>`,
  fire: (ph, nk, up) => `<div class="gc c-fire"><div class="sh"></div><div class="in"></div><div class="rl"><span class="vt">INVICTO</span><span class="pips">${rep(10, k => `<i style="--p:${9 - k}"></i>`)}</span></div><div class="art">${ph('heat')}<i class="fg"></i><i class="hl"></i></div><div class="ten"><b>10</b><span>VICTORIAS SEGUIDAS</span></div><div class="bt"><b>${nk}</b><span>RACHA ACTIVA</span></div></div>`,
  month: (ph, nk, up) => `<div class="gc c-month"><div class="sh"></div><div class="in"></div><div class="tp"><b>DEL MES</b><div class="xs"><i></i><i></i><i></i><i></i><em>STELIANT ESPORTS</em></div></div><div class="art">${ph()}<i class="pk"></i><i class="trk"></i><i class="trk t2"></i></div><div class="sb"><i></i><i></i><i></i></div><div class="nm">${nk}</div><div class="bt"><span class="bc"></span><span>Votado por la comunidad</span></div></div>`,
}

export function AchievementCard({ id, nick = 'Jugador', image, width = 300, className = '' }) {
  const build = CARD_HTML[id]
  if (!build) return null
  const scale = width / 300
  const src = image ? esc(image) : ''
  // Sin imagen: una sola ventana vacia (no se repite en las capas RGB del MVP).
  let emptied = false
  const ph = (cls = '') => {
    if (src) return `<img class="ph ${cls}" src="${src}" alt="">`
    if (emptied) return ''
    emptied = true
    return EMPTY_ART
  }
  const html = build(ph, esc(nick || 'Jugador'), esc(String(nick || 'Jugador').toUpperCase()))
  return (
    <span className={`gx gx-card ${className}`} style={{ width, height: 464 * scale }} data-no-translate>
      <span className="gx-card__in" style={{ transform: `scale(${scale})` }} dangerouslySetInnerHTML={{ __html: html }} />
    </span>
  )
}

// Filtros SVG que usan las cartas MVP (canales RGB) e Invicto (calor).
// Se monta una vez en la pagina que muestre cartas de logro.
export function CosmeticDefs() {
  return (
    <svg width="0" height="0" style={{ position: 'absolute' }} aria-hidden="true" focusable="false">
      <defs>
        <filter id="gxChR" colorInterpolationFilters="sRGB"><feColorMatrix values="1 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 1 0" /></filter>
        <filter id="gxChG" colorInterpolationFilters="sRGB"><feColorMatrix values="0 0 0 0 0 0 1 0 0 0 0 0 0 0 0 0 0 0 1 0" /></filter>
        <filter id="gxChB" colorInterpolationFilters="sRGB"><feColorMatrix values="0 0 0 0 0 0 0 0 0 0 0 0 1 0 0 0 0 0 1 0" /></filter>
        <filter id="gxHeat">
          <feTurbulence type="fractalNoise" baseFrequency="0.012 0.06" numOctaves="2" seed="3">
            <animate attributeName="baseFrequency" values="0.012 0.06;0.016 0.09;0.012 0.06" dur="2.4s" repeatCount="indefinite" />
          </feTurbulence>
          <feDisplacementMap in="SourceGraphic" scale="12" />
        </filter>
      </defs>
    </svg>
  )
}

