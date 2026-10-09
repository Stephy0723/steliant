import { useEffect, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext.jsx'
import { Icon } from '../icons/Icons.jsx'
import { api } from '../../lib/api.js'
import { applyTournamentFields, getGGContext, TOURNAMENT_SCHEDULE_KEYS, ggWritableFields, applyGGField, hasGGField } from '../../lib/ggAssistant.js'
import { scheduleErrors } from '../../../../shared/tournamentSetup.mjs'
import { GGVisor, GGDock } from './GGVisor.jsx'
import { nudgeFor, HELLOS } from './ggNudges.js'
import { shortcutsFor } from './ggShortcuts.js'
import { useDockDrag } from './useDockDrag.js'

const STORAGE_KEY = 'gg-assistant-chat'
const PEEK_DISMISS_KEY = 'gg-assistant-peek-dismissed'
const MAX_STORED = 30
const NUDGED_KEY = 'gg-assistant-nudged'   // avisos por inactividad ya mostrados (por key)
const HELLO_KEY = 'gg-assistant-hello'     // { count, last } de los saludos
const IDLE_MS = 2 * 60 * 1000              // quieto este tiempo → GG pregunta
const HELLO_GAP_MS = 6 * 60 * 1000         // mínimo entre saludos
const HELLO_MAX = 3                        // saludos por sesión
const HELLO_SHOW_MS = 6500
const MAX_NO = 2                           // "Ahora no" dos veces → no más avisos esta sesión
const HOP_MS = 950

const readJSON = (k, fb) => { try { return JSON.parse(sessionStorage.getItem(k) || 'null') ?? fb } catch { return fb } }
const writeJSON = (k, v) => { try { sessionStorage.setItem(k, JSON.stringify(v)) } catch { /* sin almacenamiento */ } }

const FIELD_LABELS = {
  registrationStart: 'Apertura de inscripciones',
  registrationEnd: 'Cierre de inscripciones',
  checkinDeadline: 'Límite de check-in',
  date: 'Inicio del torneo',
  endDate: 'Fin del torneo',
}

const PEEK_CALL = { id: 'peek', text: '¿Te ayudo con las fechas del torneo?', options: [{ label: 'Sí, ayúdame', prompt: 'Ayúdame con las fechas de mi torneo' }] }

const MES = ['ENE', 'FEB', 'MAR', 'ABR', 'MAY', 'JUN', 'JUL', 'AGO', 'SEP', 'OCT', 'NOV', 'DIC']
const GLYPHS = '▓▒░█<>/\\#%01Ξ'

function readStored(userId) {
  try {
    const raw = JSON.parse(sessionStorage.getItem(STORAGE_KEY) || 'null')
    return raw?.userId === userId && Array.isArray(raw.messages) ? raw.messages : []
  } catch { return [] }
}

function writeStored(userId, messages) {
  try { sessionStorage.setItem(STORAGE_KEY, JSON.stringify({ userId, messages: messages.slice(-MAX_STORED) })) } catch { /* sin almacenamiento */ }
}

const nowHHMM = () => new Date().toTimeString().slice(0, 5)
const splitDT = s => String(s).replace('T', ' ').split(' ')
const fmtDate = s => { const [d, t = ''] = splitDT(s); const [, m, dd] = d.split('-'); return `${dd} ${MES[+m - 1] || m} · ${t.slice(0, 5)}` }
const toMs = s => +new Date(String(s).replace(' ', 'T'))

function scheduleText(fields) {
  return TOURNAMENT_SCHEDULE_KEYS.filter(k => fields[k]).map(k => `${FIELD_LABELS[k]}: ${fields[k].replace('T', ' ')}`).join('\n')
}

/* Ruido que cambia mientras GG "descifra" la respuesta. */
function Scramble() {
  const [text, setText] = useState('▓▒░▒▓░▒▓')
  useEffect(() => {
    const id = setInterval(() => setText(Array.from({ length: 8 }, () => GLYPHS[Math.random() * GLYPHS.length | 0]).join('')), 90)
    return () => clearInterval(id)
  }, [])
  return <span aria-hidden="true">{text}</span>
}

function PlanCard({ schedule, onForm, onApplied }) {
  const [applied, setApplied] = useState(false)
  const [copied, setCopied] = useState(false)
  const form = getGGContext().tournamentForm
  const merged = form ? { ...form, ...schedule.fields } : null
  const errors = merged ? scheduleErrors(merged, Date.now()) : {}
  const problems = Object.values(errors)
  const keys = TOURNAMENT_SCHEDULE_KEYS.filter(k => schedule.fields[k])
  const ts = keys.map(k => toMs(schedule.fields[k]))
  const valid = ts.filter(Number.isFinite)
  const min = Math.min(...valid), max = Math.max(...valid)
  const pct = t => ((t - min) / (max - min || 1) * 100)
  const seg = (a, b) => {
    const ia = keys.indexOf(a), ib = keys.indexOf(b)
    if (ia < 0 || ib < 0 || !Number.isFinite(ts[ia]) || !Number.isFinite(ts[ib])) return null
    return <span className="ggc-tl__seg" style={{ left: `${pct(Math.min(ts[ia], ts[ib])).toFixed(1)}%`, width: `${Math.abs(pct(ts[ib]) - pct(ts[ia])).toFixed(1)}%` }} />
  }

  const copy = async () => {
    try { await navigator.clipboard.writeText(scheduleText(schedule.fields)); setCopied(true); setTimeout(() => setCopied(false), 1800) } catch { /* portapapeles bloqueado */ }
  }
  const apply = () => { applyTournamentFields(schedule.fields); setApplied(true); onApplied?.() }

  return (
    <div className="ggc-plan">
      <div className="ggc-plan__h">PLAN DE FECHAS<span>{form?.timezone ? `UTC${form.timezone}` : ''}</span></div>
      {schedule.note && <p className="ggc-plan__note">{schedule.note}</p>}
      {valid.length > 1 && (
        <div className="ggc-tl" aria-hidden="true">
          {seg('registrationStart', 'registrationEnd')}{seg('date', 'endDate')}
          {keys.map((k, i) => Number.isFinite(ts[i]) && (
            <span key={k} className={`ggc-tl__p${i % 2 ? ' ggc-tl__p--low' : ''}${errors[k] ? ' is-bad' : ''}`} style={{ left: `${pct(ts[i]).toFixed(1)}%` }}>{i + 1}</span>
          ))}
        </div>
      )}
      <dl>
        {keys.map((k, i) => (
          <div key={k} className={errors[k] ? 'is-bad' : ''}><i>{i + 1}</i><dt>{FIELD_LABELS[k]}</dt><dd>{fmtDate(schedule.fields[k])}</dd></div>
        ))}
      </dl>
      {problems.length > 0 && (
        <div className="ggc-plan__warn" role="alert">
          <b>{problems.length === 1 ? '1 FECHA NO CUADRA' : `${problems.length} FECHAS NO CUADRAN`}</b>
          <ul>{problems.slice(0, 3).map(p => <li key={p}>{p}</li>)}</ul>
        </div>
      )}
      <div className="ggc-plan__act">
        {onForm && (
          <button type="button" className={`ggc-btn ggc-btn--go${applied ? ' is-done' : ''}`} disabled={applied || problems.length > 0} onClick={apply}>
            {applied ? <>{Icon.check} Aplicadas</> : 'Aplicar al formulario'}
          </button>
        )}
        <button type="button" className={`ggc-btn${copied ? ' is-done' : ''}`} onClick={copy}>{copied ? <>{Icon.check} Copiado</> : <>{Icon.copy} Copiar</>}</button>
      </div>
    </div>
  )
}

// Respuestas viejas (o del modelo si no respeta el formato) vienen como un
// bloque de texto: se separan en estado / pasos / siguiente jugada para
// pintarlas igual que las nuevas.
const STATUS_RE = /^(estado|falta|ruta recomendada)\s*:\s*/i
const NEXT_RE = /^siguiente jugada\s*:\s*/i
const STEP_RE = /^\s*\d+[.)]\s+/
function blocksOf(m) {
  if (m.steps?.length || m.status || m.next) {
    return { paras: splitParas(m.content), status: m.status || null, steps: m.steps || [], next: m.next || null }
  }
  const paras = [], steps = []
  let status = null, next = null
  for (const line of String(m.content || '').split('\n')) {
    const t = line.trim()
    if (!t) continue
    if (STATUS_RE.test(t) && !status) status = { tone: /^falta/i.test(t) ? 'warn' : 'info', text: t.replace(STATUS_RE, '').replace(/\.$/, '') }
    else if (NEXT_RE.test(t)) next = t.replace(NEXT_RE, '')
    else if (STEP_RE.test(t)) steps.push(t.replace(STEP_RE, ''))
    else paras.push(t)
  }
  return { paras, status, steps, next }
}
const splitParas = text => String(text || '').split(/\n+/).map(t => t.trim()).filter(Boolean)

// Lo que GG "recuerda" de su propia respuesta: el texto, los pasos y el
// borrador entero (para poder ajustarlo en el siguiente mensaje).
function historyContent(m) {
  if (m.role !== 'assistant') return m.content
  const parts = [m.content]
  if (m.steps?.length) parts.push(m.steps.map((x, i) => `${i + 1}. ${x}`).join('\n'))
  if (m.draft) parts.push(`[Borrador "${m.draft.title}" para ${m.draft.field}]\n${m.draft.text}`)
  if (m.schedule) parts.push(`[Fechas propuestas] ${scheduleText(m.schedule.fields).replace(/\n/g, ' · ')}`)
  return parts.join('\n\n')
}

const TONE_ICON = { ok: 'check', warn: 'alert', info: 'bolt' }

function ReplyBlocks({ m }) {
  const { paras, status, steps, next } = blocksOf(m)
  return (
    <>
      {status && <div className={`ggc-status ggc-status--${status.tone}`}>{Icon[TONE_ICON[status.tone]] || Icon.bolt}<span>{status.text}</span></div>}
      {paras.length > 0 && <div className="ggc-e__t" data-no-translate>{paras.map((p, i) => <p key={i}>{p}</p>)}</div>}
      {steps.length > 0 && (
        <ol className="ggc-steps" data-no-translate>
          {steps.map((x, i) => <li key={i}><span className="ggc-steps__n">{String(i + 1).padStart(2, '0')}</span><span>{x}</span></li>)}
        </ol>
      )}
      {next && <div className="ggc-next" data-no-translate><b>SIGUIENTE JUGADA</b><span>{next}</span></div>}
    </>
  )
}

function DraftCard({ draft, fieldLabel }) {
  const [applied, setApplied] = useState(false)
  const [copied, setCopied] = useState(false)
  const [missing, setMissing] = useState(false)
  const canApply = draft.field !== 'libre'
  const copy = async () => {
    try { await navigator.clipboard.writeText(draft.text); setCopied(true); setTimeout(() => setCopied(false), 1800) } catch { /* portapapeles bloqueado */ }
  }
  const apply = () => {
    if (!hasGGField(draft.field) || !applyGGField(draft.field, draft.text)) { setMissing(true); return }
    setApplied(true)
  }
  return (
    <div className="ggc-draft">
      <div className="ggc-draft__h">
        <span>{Icon.edit}{draft.title}</span>
        <small>{draft.text.length.toLocaleString('es-DO')} caracteres</small>
      </div>
      <div className="ggc-draft__body" data-no-translate tabIndex={0}>{draft.text}</div>
      {missing && <p className="ggc-draft__miss">Ese campo ya no está en pantalla. Vuelve a la página o cópialo.</p>}
      <div className="ggc-draft__act">
        {canApply && (
          <button type="button" className={`ggc-btn ggc-btn--go${applied ? ' is-done' : ''}`} disabled={applied} onClick={apply}>
            {applied ? <>{Icon.check} Aplicado</> : `Usar en ${fieldLabel || 'el campo'}`}
          </button>
        )}
        <button type="button" className={`ggc-btn${copied ? ' is-done' : ''}`} onClick={copy}>{copied ? <>{Icon.check} Copiado</> : <>{Icon.copy} Copiar</>}</button>
      </div>
    </div>
  )
}

export default function GGAssistant() {
  const { user } = useAuth()
  const userId = user?._id || user?.id
  const { pathname, search } = useLocation()
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const [closing, setClosing] = useState(false)
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [typing, setTyping] = useState(null) // { index, n } mientras GG "escribe" la última respuesta
  const [happy, setHappy] = useState(false)
  const [hover, setHover] = useState(false)
  const [peek, setPeek] = useState(false)
  const [warp, setWarp] = useState(false)
  const [toastLift, setToastLift] = useState(0)
  const [nudge, setNudge] = useState(null) // aviso por inactividad: { id, key, text, options }
  const [hello, setHello] = useState(null) // saludo corto: { id, text, heart }
  const [hop, setHop] = useState(false)
  const scrollRef = useRef(null)
  const inputRef = useRef(null)
  const dockRef = useRef(null)
  const dock = useDockDrag(dockRef)
  const onTournamentForm = pathname === '/torneos/crear'
  const onMessages = pathname.startsWith('/mensajes')
  const lastIsError = messages.length > 0 && messages[messages.length - 1].error

  // Tarjetas fijas que comparten la esquina inferior con GG: toasts (ToastHost),
  // aviso de "modo rendimiento" (PerfMonitor) y "torneo pendiente"
  // (TournamentDraftReminder). Se mide su altura real para que GG suba
  // mientras alguna este visible y vuelva a su lugar al retirarse. Pueden
  // montarse despues que GG, asi que se vigila el body y se enganchan solas.
  useEffect(() => {
    if (typeof ResizeObserver === 'undefined') return
    const CORNER = ['.gg-toasts', '.gg-perf-suggest', '.gg-draft-reminder']
    const watched = new Map() // selector -> { el, observer, h }
    const applyLift = () => setToastLift(Math.max(0, ...[...watched.values()].map(w => w.h)))
    const sync = () => {
      for (const sel of CORNER) {
        const el = document.querySelector(sel)
        const cur = watched.get(sel)
        if (cur && cur.el === el) continue
        cur?.observer.disconnect()
        watched.delete(sel)
        if (!el) continue
        const entry = { el, h: 0, observer: null }
        // Cuanto tiene que subir GG para quedar por encima de la tarjeta: se
        // mide su borde superior real (no todas estan pegadas al fondo).
        entry.observer = new ResizeObserver(() => {
          const r = el.getBoundingClientRect()
          const dockBottom = window.matchMedia('(max-width: 640px)').matches ? 14 : 22
          entry.h = r.height > 0 && r.top > window.innerHeight / 2 ? Math.max(0, window.innerHeight - r.top + 12 - dockBottom) : 0
          applyLift()
        })
        entry.observer.observe(el)
        watched.set(sel, entry)
      }
      applyLift()
    }
    sync()
    const bodyObserver = new MutationObserver(sync)
    bodyObserver.observe(document.body, { childList: true, subtree: true })
    return () => {
      bodyObserver.disconnect()
      watched.forEach(w => w.observer.disconnect())
    }
  }, [])

  useEffect(() => { setMessages(userId ? readStored(userId) : []) }, [userId])
  useEffect(() => { if (userId) writeStored(userId, messages) }, [userId, messages])
  useEffect(() => { if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight }, [messages, loading, open, typing])
  useEffect(() => { if (open) inputRef.current?.focus() }, [open])
  useEffect(() => { if (open && !loading) inputRef.current?.focus() }, [loading])

  // Efecto de "escribiendo": revela la respuesta de 3 en 3 caracteres.
  useEffect(() => {
    if (!typing) return
    const text = messages[typing.index]?.content || ''
    if (typing.n >= text.length) { setTyping(null); return }
    const id = setTimeout(() => setTyping(t => t && { ...t, n: Math.min(text.length, t.n + 3) }), 16)
    return () => clearTimeout(id)
  }, [typing, messages])

  // En /torneos/crear GG se asoma por el borde y ofrece ayuda con las fechas (una vez por sesión).
  useEffect(() => {
    if (!onTournamentForm || open) { setPeek(false); return }
    let dismissed = false
    try { dismissed = sessionStorage.getItem(PEEK_DISMISS_KEY) === '1' } catch { /* sin almacenamiento */ }
    if (dismissed || messages.length > 0) return
    const id = setTimeout(() => setPeek(true), 1200)
    return () => clearTimeout(id)
  }, [onTournamentForm, open])

  // Estado vivo para los temporizadores (no reinician su cuenta en cada render).
  const live = useRef({})
  live.current = { open, loading, peek, nudge, hello, pathname }

  const doHop = () => { setHop(true); setTimeout(() => setHop(false), HOP_MS) }

  // Si el usuario se queda quieto IDLE_MS, GG brinca y pregunta qué quiere hacer según la página.
  // Una vez por aviso y sesión; tras MAX_NO "Ahora no" deja de preguntar.
  useEffect(() => {
    if (!userId) return
    let last = Date.now()
    const bump = () => { last = Date.now() }
    const events = ['pointermove', 'pointerdown', 'keydown', 'wheel', 'touchstart']
    events.forEach(ev => window.addEventListener(ev, bump, { passive: true }))
    window.addEventListener('scroll', bump, { passive: true, capture: true })
    document.addEventListener('visibilitychange', bump)
    const id = setInterval(() => {
      const st = live.current
      if (document.hidden || Date.now() - last < IDLE_MS) return
      last = Date.now()
      if (st.open || st.loading || st.peek || st.nudge) return
      const seen = readJSON(NUDGED_KEY, { keys: [], no: 0 })
      if (seen.no >= MAX_NO) return
      const n = nudgeFor(st.pathname, getGGContext())
      if (!n || seen.keys.includes(n.key)) return
      writeJSON(NUDGED_KEY, { ...seen, keys: [...seen.keys, n.key] })
      setHello(null)
      setNudge({ ...n, id: Date.now() })
      doHop()
    }, 5000)
    return () => {
      clearInterval(id)
      events.forEach(ev => window.removeEventListener(ev, bump))
      window.removeEventListener('scroll', bump, { capture: true })
      document.removeEventListener('visibilitychange', bump)
    }
  }, [userId])

  // El aviso es de esa página: al cambiar de ruta se retira.
  useEffect(() => { setNudge(null) }, [pathname])

  // Saludo corto con brinquito al empezar la sesión y al cambiar de sección,
  // espaciado HELLO_GAP_MS y como mucho HELLO_MAX veces, para recordar que GG está ahí.
  const section = pathname.split('/')[1]
  useEffect(() => {
    if (!userId || nudgeFor(pathname) === null) return
    const h = readJSON(HELLO_KEY, { count: 0, last: 0 })
    if (h.count >= HELLO_MAX || (h.count > 0 && Date.now() - h.last < HELLO_GAP_MS)) return
    let hideId
    const showId = setTimeout(() => {
      const st = live.current
      if (st.open || st.loading || st.peek || st.nudge) return
      writeJSON(HELLO_KEY, { count: h.count + 1, last: Date.now() })
      setHello({ id: Date.now(), text: HELLOS[h.count % HELLOS.length], heart: true })
      doHop()
      hideId = setTimeout(() => setHello(null), HELLO_SHOW_MS)
    }, h.count === 0 ? 4000 : 2500)
    return () => { clearTimeout(showId); clearTimeout(hideId) }
  }, [userId, section])

  // Al entrar o salir de Mensajes la presencia "salta" con un glitch a su otra esquina.
  const prevMsg = useRef(onMessages)
  useEffect(() => {
    if (prevMsg.current === onMessages) return
    prevMsg.current = onMessages
    setWarp(true)
    const id = setTimeout(() => setWarp(false), 300)
    return () => clearTimeout(id)
  }, [onMessages])

  const close = () => {
    if (!open || closing) return
    setClosing(true)
    setTimeout(() => { setOpen(false); setClosing(false); dockRef.current?.focus() }, 250)
  }
  const toggle = () => { if (dock.consumeDrag()) return; if (open) close(); else { setPeek(false); setNudge(null); setHello(null); setOpen(true) } }

  const shortcuts = shortcutsFor(pathname)

  const send = async (text, base = messages) => {
    const message = (text ?? input).trim()
    if (!message || loading || typing) return
    const history = base.filter(m => !m.error).slice(-8).map(m => ({ role: m.role, content: historyContent(m) }))
    const fields = ggWritableFields()
    setInput('')
    setMessages([...base, { role: 'user', content: message, time: nowHHMM() }])
    setLoading(true)
    try {
      const res = await api('/assistant/chat', {
        method: 'POST',
        body: {
          message,
          history,
          page: { path: pathname + search, title: document.title, tournamentForm: getGGContext().tournamentForm, fields },
        },
      })
      setTyping({ index: base.length + 1, n: 0 })
      // "Torneo · Reglamento" -> "Reglamento" para el boton.
      const fieldLabel = res.draft ? (fields.find(f => f.key === res.draft.field)?.label || '').split('·').pop().trim() : ''
      setMessages(prev => [...prev, {
        role: 'assistant', content: res.reply, time: nowHHMM(),
        status: res.status || null, steps: res.steps || [], next: res.next || null, choices: res.choices || [],
        links: res.links || [], schedule: res.schedule || null, draft: res.draft || null, fieldLabel,
      }])
    } catch (err) {
      setMessages(prev => [...prev, { role: 'assistant', content: err.message || 'No pude conectar con el servidor. Tu mensaje no se perdió.', error: true, time: nowHHMM() }])
    } finally {
      setLoading(false)
    }
  }

  const retry = () => {
    const lastUser = [...messages].reverse().find(m => m.role === 'user')
    if (!lastUser) return
    // Reenvía desde antes de la pregunta original: send() la vuelve a añadir sin el error.
    send(lastUser.content, messages.slice(0, messages.lastIndexOf(lastUser)))
  }

  const clear = () => { setMessages([]); setTyping(null); setHappy(false) }

  const onApplied = () => { setHappy(true); setTimeout(() => setHappy(false), 1600) }

  // Esc cierra; 1–N lanza un atajo mientras la conversación esté vacía.
  useEffect(() => {
    if (!open) return
    const onKey = e => {
      if (e.key === 'Escape') { close(); return }
      if (messages.length || loading) return
      const n = Number(e.key)
      if (!Number.isInteger(n) || n < 1 || n > shortcuts.length) return
      if (e.target?.matches?.('input, textarea') && e.target.value) return
      e.preventDefault()
      send(shortcuts[n - 1].prompt)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  if (!userId) return null

  const go = path => { navigate(path); if (window.matchMedia('(max-width: 640px)').matches) close() }
  const dismissPeek = () => { setPeek(false); try { sessionStorage.setItem(PEEK_DISMISS_KEY, '1') } catch { /* sin almacenamiento */ } }
  const openWith = prompt => {
    setOpen(true)
    if (prompt) setTimeout(() => send(prompt), 450)
  }
  const dismissNudge = () => {
    setNudge(null)
    const seen = readJSON(NUDGED_KEY, { keys: [], no: 0 })
    writeJSON(NUDGED_KEY, { ...seen, no: seen.no + 1 })
  }
  // Un solo aviso a la vez: el de /torneos/crear (peek) manda sobre el de inactividad y este sobre el saludo.
  const call = peek && !open ? PEEK_CALL : nudge && !open ? nudge : hello && !open ? hello : null
  const onCallPick = i => {
    const opt = call?.options?.[i]
    if (call === PEEK_CALL) dismissPeek()
    else setNudge(null)
    openWith(opt?.prompt)
  }
  const onCallNo = () => { if (call === PEEK_CALL) dismissPeek(); else dismissNudge() }

  const codecMood = loading ? 'think' : typing ? 'talk' : lastIsError ? 'error' : happy ? 'happy' : 'idle'
  const dockMood = loading ? 'think' : lastIsError ? 'error' : typing ? 'talk' : peek ? 'peek' : hop || hello ? 'happy' : nudge ? 'talk' : hover ? 'hover' : 'idle'
  const signal = codecMood === 'error' ? 'SEÑAL INESTABLE' : codecMood === 'think' ? 'PROCESANDO' : 'CANAL ABIERTO'

  return (
    <>
      {open && (
        <section className={`ggc${codecMood === 'error' ? ' ggc--error' : ''}${onMessages ? ' ggc--msg' : ''}${dock.side === 'left' ? ' ggc--left' : ''}`} role="dialog" aria-label="GG, asistente"
          style={dock.panelStyle() || undefined} data-state={closing ? 'closing' : undefined}>
          <header className="ggc__head">
            <GGVisor mood={codecMood} size={64} />
            <div className="ggc__id">
              <h2>GG<span>ASISTENTE IA</span></h2>
              <div className="ggc__sig"><span className="ggc__bars" aria-hidden="true"><i /><i /><i /><i /><i /></span>{signal}</div>
            </div>
            <div className="ggc__tools">
              {messages.length > 0 && (
                <button type="button" className="ggc__tool" onClick={clear} aria-label="Nueva conversación" title="Nueva conversación">{Icon.trash}<span className="lbl">NUEVA</span></button>
              )}
              <button type="button" className="ggc__tool ggc__tool--x" onClick={close} aria-label="Cerrar GG" title="Cerrar · Esc">{Icon.x}</button>
            </div>
          </header>

          <div className="ggc__ctx"><span className="rec">EN LÍNEA</span><span>estás en <b>{pathname}</b></span></div>

          <div className="ggc__log" ref={scrollRef} aria-live="polite">
            {messages.length === 0 && !loading && (
              <div className="ggc-intro">
                <div className="ggc-intro__t">Hola, {user.nick || 'competidor'}. Soy <em>GG</em>.</div>
                <p>Tu copiloto en GlitchGang. Conozco cada rincón de la plataforma: te llevo a donde necesitas, armo el calendario de tu torneo, escribo descripciones y reglamentos contigo y te explico cualquier panel. Háblame como a un compañero de equipo.</p>
                <div className="ggc-keys">
                  <div className="ggc-keys__h">¿Por dónde empezamos?</div>
                  <div className="ggc-keys__grid">
                    {shortcuts.map((s, i) => (
                      <button key={s.title} type="button" className="ggc-key" onClick={() => send(s.prompt)} disabled={loading} title={`Atajo ${i + 1}`}>
                        <span className="ggc-key__ic" aria-hidden="true">{Icon[s.icon]}</span>
                        <span className="ggc-key__b"><b>{s.title}</b><small>{s.hint}</small></span>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {messages.map((m, i) => {
              if (m.role === 'user') return (
                <div key={i} className="ggc-e ggc-e--you">
                  <div className="ggc-e__h"><b>TÚ</b>{m.time && <time>{m.time}</time>}</div>
                  <div className="ggc-e__t" data-no-translate>{m.content}</div>
                </div>
              )
              if (m.error) return (
                <div key={i} className="ggc-e ggc-e--err">
                  <div className="ggc-e__h"><b>SEÑAL PERDIDA</b>{m.time && <time>{m.time}</time>}</div>
                  <div className="ggc-static" aria-hidden="true" />
                  <div className="ggc-e__t">{m.content}</div>
                  {i === messages.length - 1 && (
                    <button type="button" className="ggc-btn ggc-btn--err" onClick={retry} disabled={loading}>{Icon.refresh} Reintentar</button>
                  )}
                </div>
              )
              const isTyping = typing?.index === i
              const isLast = i === messages.length - 1
              return (
                <div key={i} className="ggc-e ggc-e--gg">
                  <div className="ggc-e__h"><b>GG</b>{m.time && <time>{m.time}</time>}</div>
                  {isTyping
                    ? <div className="ggc-e__t" data-no-translate>{m.content.slice(0, typing.n)}<span className="cur" /></div>
                    : <ReplyBlocks m={m} />}
                  {!isTyping && m.links?.length > 0 && (
                    <div className="ggc-dest">
                      <div className="ggc-dest__h"><span>DESTINOS</span><span>{m.links.length}</span></div>
                      {m.links.map((l, x) => (
                        <button key={l.path + l.label} type="button" className="ggc-go" onClick={() => go(l.path)}>
                          <span className="ggc-go__n">{String(x + 1).padStart(2, '0')}</span>
                          <span className="ggc-go__b"><strong>{l.label}</strong><span>{l.path}</span></span>
                          <span className="ggc-go__a" aria-hidden="true">IR →</span>
                        </button>
                      ))}
                    </div>
                  )}
                  {!isTyping && m.schedule && <PlanCard schedule={m.schedule} onForm={onTournamentForm} onApplied={onApplied} />}
                  {!isTyping && m.draft && <DraftCard draft={m.draft} fieldLabel={m.fieldLabel} />}
                  {!isTyping && isLast && !loading && m.choices?.length > 0 && (
                    <div className="ggc-choices" role="group" aria-label="Respuestas rápidas">
                      {m.choices.map(c => <button key={c} type="button" className="ggc-choice" onClick={() => send(c)}>{c}</button>)}
                    </div>
                  )}
                </div>
              )
            })}

            {loading && (
              <div className="ggc-e ggc-e--gg" role="status">
                <div className="ggc-e__h"><b>GG</b><time>{nowHHMM()}</time></div>
                <div className="ggc-think"><Scramble /><span>DESCIFRANDO</span></div>
              </div>
            )}
          </div>

          <form className="ggc__cmd" onSubmit={e => { e.preventDefault(); send() }}>
            <label htmlFor="ggc-input" aria-hidden="true">▸</label>
            <input id="ggc-input" ref={inputRef} type="text" maxLength={1000} autoComplete="off" placeholder="Pregúntale a GG..." value={input}
              onChange={e => setInput(e.target.value)} disabled={loading} aria-label="Mensaje para GG" />
            <button type="submit" className="ggc__send" disabled={loading || !!typing || !input.trim()} aria-label="Enviar">ENVIAR <kbd>↵</kbd></button>
          </form>
        </section>
      )}

      <GGDock dockRef={dockRef} mood={dockMood} open={open && !closing} peek={peek && !open} notify={!!nudge && !open} msg={onMessages && !dock.custom} warp={warp} hop={hop}
        lift={dock.dragging || !dock.avoidsToasts ? 0 : toastLift} side={dock.side} upper={dock.upper} dragging={dock.dragging}
        style={dock.dockStyle({ peek: peek && !open })} dragHandlers={dock.handlers}
        call={call} onCallPick={onCallPick} onCallNo={onCallNo} onClick={toggle}
        onPointerEnter={() => setHover(true)} onPointerLeave={() => setHover(false)} />
    </>
  )
}

