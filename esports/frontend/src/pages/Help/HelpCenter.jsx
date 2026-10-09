import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Icon } from '../../components/icons/Icons.jsx'
import { useAuth } from '../../context/AuthContext.jsx'
import { useLang } from '../../i18n/LangContext.jsx'
import { api } from '../../lib/api.js'
import { SYSTEM_TICKET_PURPOSES } from '../../lib/systemTicketsStore.js'
import { getSystemTicketLink, syncTicketToMessenger } from '../../lib/ticketMessengerBridge.js'
import { toast } from '../../lib/toast.js'
import './HelpCenter.css'

const CATEGORIES = [
  { id: 'inicio', icon: 'bolt', title: 'Primeros pasos', desc: 'Crea tu cuenta, arma tu perfil y únete a la comunidad.' },
  { id: 'jugadores', icon: 'gamepad', title: 'Jugadores', desc: 'Inscripciones, check-in, equipos y resultados.' },
  { id: 'organizadores', icon: 'trophy', title: 'Organizadores', desc: 'Crea torneos, brackets, premios y check-in por Discord.' },
  { id: 'pagos', icon: 'creditCard', title: 'Pagos y planes', desc: 'Plan Pro, cuotas de inscripción y reembolsos.' },
  { id: 'cuenta', icon: 'gear', title: 'Cuenta y seguridad', desc: 'Contraseña, datos personales y privacidad.' },
]

const GUIDES = [
  { id: 'g-registro', cat: 'inicio', icon: 'user', title: 'Crear tu cuenta', steps: ['Entra a Registro y completa perfil, juegos y nivel.', 'Acepta los Términos y Condiciones.', 'Verás tu dashboard con tu progreso y torneos.'] },
  { id: 'g-inscribirse', cat: 'jugadores', icon: 'trophy', title: 'Inscribirte en un torneo', steps: ['Abre Torneos y elige uno abierto.', 'Pulsa Inscribirse (o Lista de espera si está lleno).', 'Recibirás los detalles y las horas de check-in.'] },
  { id: 'g-checkin', cat: 'jugadores', icon: 'discord', title: 'Hacer el check-in (Discord + bot)', steps: ['El check-in es en Discord con el bot oficial.', 'Check-in de presencia: confirma con el botón del bot que tu equipo SÍ jugará.', 'Check-in previo: ~30 min antes del inicio para preparar el torneo.', 'Si no confirmas a tiempo, tu cupo puede pasar a la cola (sobre cupo).'] },
  { id: 'g-crear', cat: 'organizadores', icon: 'plus', title: 'Crear un torneo', steps: ['Necesitas el rol de Organizador (solicítalo y se aprueba).', 'Completa los pasos del formulario (juego, formato, fechas, premios).', 'Configura sobre cupo y segundo check-in si lo deseas.', 'Acepta los términos y publica.'] },
  { id: 'g-bracket', cat: 'organizadores', icon: 'award', title: 'Brackets y formatos', steps: ['Elige el formato: eliminación simple, doble, round robin, suizo o grupos.', 'Publica el bracket para que los equipos lo vean.', 'Inicia el torneo y reporta cada resultado.', 'El ganador avanza automáticamente; al final, culmina el torneo.'] },
  { id: 'g-justificacion', cat: 'organizadores', icon: 'shield', title: 'Reportar resultados con justificación', steps: ['En cada partida ingresa el marcador.', 'Sube la captura de la partida de AMBOS equipos.', 'Elige “Publicar directo” o “Enviar a confirmación” para evitar errores.', 'Queda guardado como evidencia antitrampa, auditable en cualquier momento.'] },
  { id: 'g-pro', cat: 'pagos', icon: 'gem', title: 'Plan Pro y pagos', steps: ['Abre Planes y elige Pro.', 'Completa el checkout seguro.', 'Gestiona o cancela tu plan desde Ajustes.'] },
  { id: 'g-rol', cat: 'organizadores', icon: 'crown', title: 'Solicitar rol de organizador', steps: ['Ve a Solicitar rol y elige Organizador.', 'Verifica tu identidad y completa el formulario.', 'La administración revisa y aprueba tu solicitud.'] },
]

const FAQ = [
  { q: '¿Necesito pagar para competir?', a: 'No. Hay torneos gratuitos. Algunos torneos cobran una cuota de inscripción definida por el organizador, y el Plan Pro es opcional.' },
  { q: '¿Por qué el check-in es en Discord?', a: 'El check-in oficial se hace con el bot de STELIANT ESPORTS en Discord para registrar la presencia de cada equipo de forma confiable. Es obligatorio en todos los torneos.' },
  { q: '¿Qué pasa si me registro pero falta gente en el check-in?', a: 'Si el torneo tiene “sobre cupo”, entran los equipos en cola y se les abre un segundo check-in con una ventana de 6 a 12 horas.' },
  { q: '¿Cómo sé que el ganador no hizo trampa?', a: 'Cada resultado se justifica con el marcador y capturas de ambos equipos, que quedan como evidencia auditable.' },
  { q: '¿Puedo recuperar mi cuota si no juego?', a: 'Depende de la política del organizador y de la Política de Pagos. Si el torneo se cancela, se reembolsa.' },
  { q: '¿Cómo elimino mis datos o mi cuenta?', a: 'Desde Ajustes o escribiendo a soporte@glitchgang.com. Consulta la Política de Privacidad.' },
]

const CATEGORIES_EN = [
  { id: 'inicio', icon: 'bolt', title: 'Getting started', desc: 'Create your account, build your profile and join the community.' },
  { id: 'jugadores', icon: 'gamepad', title: 'Players', desc: 'Registrations, check-in, teams and results.' },
  { id: 'organizadores', icon: 'trophy', title: 'Organizers', desc: 'Create tournaments, brackets, prizes and Discord check-in.' },
  { id: 'pagos', icon: 'creditCard', title: 'Payments and plans', desc: 'Pro plan, entry fees and refunds.' },
  { id: 'cuenta', icon: 'gear', title: 'Account and security', desc: 'Password, personal data and privacy.' },
]

const GUIDES_EN = [
  { id: 'g-registro', cat: 'inicio', icon: 'user', title: 'Create your account', steps: ['Go to Register and complete your profile, games and level.', 'Accept the Terms and Conditions.', 'Your dashboard will show your progress and tournaments.'] },
  { id: 'g-inscribirse', cat: 'jugadores', icon: 'trophy', title: 'Join a tournament', steps: ['Open Tournaments and choose an open event.', 'Tap Register, or Waitlist if it is full.', 'You will receive details and check-in times.'] },
  { id: 'g-checkin', cat: 'jugadores', icon: 'discord', title: 'Complete check-in', steps: ['Check-in happens on Discord with the official bot.', 'Presence check-in confirms your team will play.', 'Pre-match check-in happens about 30 minutes before start.', 'If you miss it, your slot may go to the overflow queue.'] },
  { id: 'g-crear', cat: 'organizadores', icon: 'plus', title: 'Create a tournament', steps: ['You need an approved Organizer role.', 'Complete the form: game, format, dates and prizes.', 'Configure overflow and second check-in if needed.', 'Accept the terms and publish.'] },
  { id: 'g-bracket', cat: 'organizadores', icon: 'award', title: 'Brackets and formats', steps: ['Choose single elimination, double elimination, round robin, swiss or groups.', 'Publish the bracket so teams can see it.', 'Start the tournament and report each result.', 'Winners advance automatically; finish the tournament at the end.'] },
  { id: 'g-justificacion', cat: 'organizadores', icon: 'shield', title: 'Report results with evidence', steps: ['Enter the score for each match.', 'Upload screenshots from both teams.', 'Publish directly or send to confirmation.', 'The evidence stays auditable.'] },
  { id: 'g-pro', cat: 'pagos', icon: 'gem', title: 'Pro plan and payments', steps: ['Open Plans and choose Pro.', 'Complete secure checkout.', 'Manage or cancel from Settings.'] },
  { id: 'g-rol', cat: 'organizadores', icon: 'crown', title: 'Request organizer role', steps: ['Go to Request role and choose Organizer.', 'Verify your identity and complete the form.', 'Admin reviews and approves your request.'] },
]

const FAQ_EN = [
  { q: 'Do I need to pay to compete?', a: 'No. There are free tournaments. Some tournaments charge an organizer-defined entry fee, and Pro is optional.' },
  { q: 'Why is check-in on Discord?', a: 'Official check-in uses the STELIANT ESPORTS Discord bot to reliably record each team presence.' },
  { q: 'What happens if my team misses check-in?', a: 'If overflow is enabled, queued teams can enter and receive a second check-in window set by the organizer.' },
  { q: 'How do I know the winner did not cheat?', a: 'Each result is backed by scores and screenshots that remain auditable by organizer and staff.' },
  { q: 'Can I get my fee back if I do not play?', a: 'It depends on the organizer policy and the Payment Policy. If the tournament is canceled, it is refunded.' },
  { q: 'How do I delete my data or account?', a: 'Use Settings or write to soporte@glitchgang.com. Review the Privacy Policy.' },
]

const HELP_COPY = {
  es: {
    page: 'ayuda',
    term: 'soporte - gg@ayuda',
    line: 'STELIANT ESPORTS · centro de ayuda - guias, respuestas y soporte para jugadores y organizadores.',
    title: '¿En qué te ayudamos?',
    search: 'buscar',
    clear: 'limpiar',
    placeholder: 'check-in, reembolso, bracket...',
    searchLabel: 'Buscar en el centro de ayuda',
    hint: 'escribe una palabra o elige una categoria',
    all: '--todo',
    guideOne: 'guia',
    guideMany: 'guias',
    questionOne: 'pregunta',
    questionMany: 'preguntas',
    matches: 'coinciden con',
    guidesTitle: 'Guias y tutoriales',
    faqTitle: 'Preguntas frecuentes',
    noGuides: 'sin guias para',
    noFaq: 'ninguna pregunta coincide.',
    ticketCmd: './ticket --nuevo',
    bugTitle: 'Reportar un bug',
    bugIntro: 'Cuatro pasos. Llega al panel de soporte como ticket de Bug tecnico con tu navegador y la pagina ya adjuntos.',
    ticketTitle: 'Abre un ticket con el proposito correcto',
    ticketDesc: 'Bot, representante, queja o ayuda general: todos llegan al mismo panel admin con ID propio y prioridad.',
    contact: 'Contacto',
    contactLine: 'Soporte:',
    contactRest: 'Unete al Discord oficial de STELIANT ESPORTS para soporte en vivo.',
    legal: [['/terminos', 'terminos.md'], ['/privacidad', 'privacidad.md'], ['/politica-pagos', 'pagos.md'], ['/terminos-organizador', 'organizador.md']],
    priorities: [['low', 'Baja'], ['medium', 'Media'], ['high', 'Alta'], ['urgent', 'Urgente']],
    jumps: [['guias', 'ls guias/'], ['faq', 'man faq'], ['reportar', './reportar-bug'], ['ticket', './ticket --nuevo'], ['contacto', 'cat contacto.txt']],
    bugAreas: ['Torneos', 'Equipos', 'Mensajes', 'Perfil', 'Pagos', 'Discord / bot', 'Otro'],
    bugSeverity: [['low', 'Molesta, pero sigo'], ['medium', 'Me frena'], ['high', 'No puedo usar algo'], ['urgent', 'Afecta un torneo en curso']],
    bugSteps: ['Area', 'Que paso', 'Detalles', 'Revisar'],
    voteQuestion: '¿Te sirvio?',
    voteYes: '> gracias. Nos alegra que te sirviera.',
    voteNo: '> gracias. Si no se resolvio, abre un ticket abajo.',
    thanks: 'Gracias. Te escribiremos por Mensajes si necesitamos mas detalles.',
    back: 'Atras',
    next: 'Siguiente',
    byEmail: 'Por correo',
    sendReport: 'Enviar reporte',
    sending: 'Enviando...',
    purpose: 'Proposito',
    priority: 'Prioridad',
    subject: 'Asunto',
    message: 'Mensaje',
    createTicket: 'Crear ticket',
    preview: 'vista previa',
    draft: 'borrador',
    noSubject: 'Sin asunto todavia',
    previewMessage: 'Tu mensaje aparecera aqui mientras escribes.',
    chars: 'caracteres',
    placeholders: { subject: 'Ej. Necesito hablar con un representante', message: 'Explica que paso, que necesitas y cualquier ID o enlace relacionado.' },
  },
  en: {
    page: 'help',
    term: 'support - gg@help',
    line: 'STELIANT ESPORTS · help center - guides, answers and support for players and organizers.',
    title: 'How can we help?',
    search: 'search',
    clear: 'clear',
    placeholder: 'check-in, refund, bracket...',
    searchLabel: 'Search the help center',
    hint: 'type a word or choose a category',
    all: '--all',
    guideOne: 'guide',
    guideMany: 'guides',
    questionOne: 'question',
    questionMany: 'questions',
    matches: 'match',
    guidesTitle: 'Guides and tutorials',
    faqTitle: 'Frequently asked questions',
    noGuides: 'no guides for',
    noFaq: 'no question matches.',
    ticketCmd: './ticket --new',
    bugTitle: 'Report a bug',
    bugIntro: 'Four steps. It reaches support as a Technical bug ticket with your browser and page attached.',
    ticketTitle: 'Open a ticket with the right purpose',
    ticketDesc: 'Bot, representative, complaint or general help: all reach the admin panel with their own ID and priority.',
    contact: 'Contact',
    contactLine: 'Support:',
    contactRest: 'Join the official STELIANT ESPORTS Discord for live support.',
    legal: [['/terminos', 'terms.md'], ['/privacidad', 'privacy.md'], ['/politica-pagos', 'payments.md'], ['/terminos-organizador', 'organizer.md']],
    priorities: [['low', 'Low'], ['medium', 'Medium'], ['high', 'High'], ['urgent', 'Urgent']],
    jumps: [['guias', 'ls guides/'], ['faq', 'man faq'], ['reportar', './report-bug'], ['ticket', './ticket --new'], ['contacto', 'cat contact.txt']],
    bugAreas: ['Tournaments', 'Teams', 'Messages', 'Profile', 'Payments', 'Discord / bot', 'Other'],
    bugSeverity: [['low', 'Annoying, but I can continue'], ['medium', 'Blocks me'], ['high', 'I cannot use a feature'], ['urgent', 'Affects a live tournament']],
    bugSteps: ['Area', 'What happened', 'Details', 'Review'],
    voteQuestion: 'Was this helpful?',
    voteYes: '> thanks. Glad it helped.',
    voteNo: '> thanks. If it is not solved, open a ticket below.',
    thanks: 'Thanks. We will message you if we need more details.',
    back: 'Back',
    next: 'Next',
    byEmail: 'By email',
    sendReport: 'Send report',
    sending: 'Sending...',
    purpose: 'Purpose',
    priority: 'Priority',
    subject: 'Subject',
    message: 'Message',
    createTicket: 'Create ticket',
    preview: 'preview',
    draft: 'draft',
    noSubject: 'No subject yet',
    previewMessage: 'Your message will appear here while you type.',
    chars: 'characters',
    placeholders: { subject: 'Ex. I need to speak with a representative', message: 'Explain what happened, what you need, and any related ID or link.' },
  },
}

const EMPTY_TICKET = { purpose: 'help', priority: 'medium', subject: '', message: '' }
const EMPTY_BUG = { area: '', doing: '', expected: '', happened: '', severity: 'medium', shot: '' }

const norm = (s = '') => s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
const pad = (n) => String(n).padStart(2, '0')
const local = {
  get: (k, d) => { try { return JSON.parse(localStorage.getItem(k)) ?? d } catch { return d } },
  set: (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)) } catch { /* noop */ } },
}
const device = () => {
  if (typeof navigator === 'undefined') return ''
  const b = navigator.userAgent.match(/(Edg|OPR|Chrome|Firefox|Version)\/[\d.]+/)?.[0]?.replace('Version', 'Safari') || 'Navegador'
  const os = /Android/.test(navigator.userAgent) ? 'Android' : /iPhone|iPad/.test(navigator.userAgent) ? 'iOS' : /Mac/.test(navigator.userAgent) ? 'macOS' : /Win/.test(navigator.userAgent) ? 'Windows' : 'Linux'
  return `${b} · ${os} · ${window.innerWidth}×${window.innerHeight}`
}

// Resalta la primera coincidencia (sin acentos) dentro del texto.
function Hl({ text, q }) {
  if (!q) return text
  const i = norm(text).indexOf(q)
  if (i < 0) return text
  return <>{text.slice(0, i)}<mark>{text.slice(i, i + q.length)}</mark>{text.slice(i + q.length)}</>
}

function Head({ id, cmd, title, count }) {
  return (
    <h2 className="ggh-h2" id={id}>
      <span className="ggh-h2__cmd">$ {cmd}</span>
      <span className="ggh-h2__t">{title}</span>
      {count !== undefined && <span className="ggh-h2__n">{count}</span>}
    </h2>
  )
}

function Guide({ g, q, done, onToggle }) {
  const n = g.steps.filter((_, i) => done[i]).length
  const complete = n === g.steps.length
  return (
    <article className={`ggh-guide${complete ? ' is-done' : ''}`}>
      <header>
        <span className="ggh-guide__ic">{Icon[g.icon]}</span>
        <h3><Hl text={g.title} q={q} /></h3>
        <span className="ggh-guide__st">{complete ? 'OK' : `${n}/${g.steps.length}`}</span>
      </header>
      <div className="ggh-meter" aria-hidden="true">{g.steps.map((_, i) => <i key={i} className={done[i] ? 'on' : ''} />)}</div>
      <ol>
        {g.steps.map((s, i) => (
          <li key={i}>
            <label className={done[i] ? 'is-on' : ''}>
              <input type="checkbox" checked={!!done[i]} onChange={() => onToggle(i)} />
              <span className="ggh-box" aria-hidden="true">{done[i] ? 'x' : ''}</span>
              <span><Hl text={s} q={q} /></span>
            </label>
          </li>
        ))}
      </ol>
    </article>
  )
}

export default function HelpCenter() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const { lang } = useLang()
  const isEn = lang === 'en'
  const L = HELP_COPY[isEn ? 'en' : 'es']
  const activeCategories = isEn ? CATEGORIES_EN : CATEGORIES
  const activeGuides = isEn ? GUIDES_EN : GUIDES
  const activeFaq = isEn ? FAQ_EN : FAQ
  const searchRef = useRef(null)
  const [query, setQuery] = useState('')
  const [cat, setCat] = useState('all')
  const [openFaq, setOpenFaq] = useState(null)
  const [progress, setProgress] = useState(() => local.get('gg-help-guides', {}))
  const [votes, setVotes] = useState(() => local.get('gg-help-faq-votes', {}))
  const [ticket, setTicket] = useState(EMPTY_TICKET)
  const [sendingTicket, setSendingTicket] = useState(false)
  const [bug, setBug] = useState(EMPTY_BUG)
  const [bugStep, setBugStep] = useState(0)
  const [sendingBug, setSendingBug] = useState(false)
  const [bugSent, setBugSent] = useState(null)

  const q = norm(query.trim())
  const guides = useMemo(() => activeGuides.filter(g => (cat === 'all' || g.cat === cat) && (!q || norm(g.title + ' ' + g.steps.join(' ')).includes(q))), [activeGuides, q, cat])
  const faqs = useMemo(() => activeFaq.map((f, i) => ({ ...f, i })).filter(f => !q || norm(f.q + ' ' + f.a).includes(q)), [activeFaq, q])
  const purpose = SYSTEM_TICKET_PURPOSES.find(p => p.id === ticket.purpose)
  const requester = user?.nick || user?.email?.split('@')[0] || (isEn ? 'Guest' : 'Invitado')

  // "/" enfoca el buscador; Esc lo limpia.
  useEffect(() => {
    const onKey = (e) => {
      const tag = e.target?.tagName
      if (e.key === '/' && !['INPUT', 'TEXTAREA', 'SELECT'].includes(tag) && !e.target?.isContentEditable) {
        e.preventDefault()
        searchRef.current?.focus()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  // Llegar con /ayuda#reportar (u otra ancla) después de renderizar.
  useEffect(() => {
    const id = window.location.hash.slice(1)
    if (!id) return
    const t = setTimeout(() => {
      const el = document.getElementById(id)
      if (el) window.scrollTo({ top: el.getBoundingClientRect().top + window.scrollY - 72 })
    }, 60)
    return () => clearTimeout(t)
  }, [])

  const toggleStep = (gid, i) => {
    setProgress(prev => {
      const next = { ...prev, [gid]: { ...(prev[gid] || {}), [i]: !prev[gid]?.[i] } }
      local.set('gg-help-guides', next)
      return next
    })
  }
  const vote = (key, v) => {
    setVotes(prev => { const next = { ...prev, [key]: v }; local.set('gg-help-faq-votes', next); return next })
  }
  const jump = (id) => {
    const el = document.getElementById(id)
    if (el) window.scrollTo({ top: el.getBoundingClientRect().top + window.scrollY - 72, behavior: 'smooth' })
  }

  const sendTicket = async (payload, onDone) => {
    const data = await api('/system-tickets', { method: 'POST', body: { ...payload, requesterName: requester, requesterEmail: user?.email || '' } })
    const t = data?.ticket
    if (!t) throw new Error('Ticket response missing')
    syncTicketToMessenger(t)
    toast(`Ticket ${t.publicCode || ''} enviado al admin`, 'success')
    onDone?.(t)
    navigate(getSystemTicketLink(t))
  }

  const submitTicket = async (e) => {
    e.preventDefault()
    if (!ticket.subject.trim() || !ticket.message.trim()) { toast('Completa el asunto y el mensaje del ticket', 'error'); return }
    setSendingTicket(true)
    try {
      await sendTicket({ ...ticket, subject: ticket.subject.trim(), message: ticket.message.trim() }, () => setTicket(EMPTY_TICKET))
    } catch {
      toast('No se pudo crear el ticket en backend. Intentalo de nuevo.', 'error')
    } finally { setSendingTicket(false) }
  }

  const bugMessage = [
    `Área: ${bug.area}`,
    bug.doing && `Qué hacía: ${bug.doing}`,
    bug.expected && `Qué esperaba: ${bug.expected}`,
    `Qué pasó: ${bug.happened}`,
    bug.shot && `Captura: ${bug.shot}`,
    `Página: ${typeof window !== 'undefined' ? window.location.origin + window.location.pathname : ''}`,
    `Dispositivo: ${device()}`,
  ].filter(Boolean).join('\n')
  const bugSubject = `[Bug] ${bug.area || 'General'}: ${bug.happened.trim().slice(0, 60)}`
  const bugCanNext = [bug.area, bug.happened.trim(), true, true][bugStep]
  const mailto = `mailto:demo@steliant.example`;

  const submitBug = async () => {
    setSendingBug(true)
    try {
      await sendTicket({ purpose: 'bug', priority: bug.severity, subject: bugSubject, message: bugMessage }, (t) => { setBugSent(t.publicCode || 'enviado'); setBug(EMPTY_BUG); setBugStep(0) })
    } catch {
      toast('No se pudo enviar. Puedes mandarlo por correo.', 'error')
    } finally { setSendingBug(false) }
  }

  return (
    <div className="ggh">
      <div className="ggh-bar">
        <button className="ggh-back" onClick={() => (window.history.length > 1 ? navigate(-1) : navigate('/'))}>{Icon.chevronRight}<span>{L.back}</span></button>
        <span className="ggh-path">~/<b>{L.page}</b></span>
        <span className="ggh-brand">GLITCH<b>GANG</b></span>
      </div>

      {/* Consola: buscador */}
      <section className="ggh-hero">
        <div className="ggh-term">
          <div className="ggh-term__bar">
            <span>{L.term}</span>
            <span className="ggh-keys"><kbd>/</kbd> {L.search} <kbd>Esc</kbd> {L.clear}</span>
          </div>
          <div className="ggh-term__body">
            <p className="ggh-line ggh-line--sys">{L.line}</p>
            <h1 className="ggh-title">{L.title}</h1>
            <label className="ggh-prompt">
              <span className="ggh-ps">gg@{L.page}:~$</span>
              <span className="ggh-cmd">{L.search}</span>
              <input
                ref={searchRef}
                type="search"
                value={query}
                onChange={e => setQuery(e.target.value)}
                onKeyDown={e => { if (e.key === 'Escape') { setQuery(''); e.currentTarget.blur() } }}
                placeholder={L.placeholder}
                aria-label={L.searchLabel}
                spellCheck="false"
              />
            </label>
            <p className="ggh-line ggh-line--out" aria-live="polite">
              {q
                ? <>&gt; <b>{guides.length}</b> {guides.length === 1 ? L.guideOne : L.guideMany} · <b>{faqs.length}</b> {faqs.length === 1 ? L.questionOne : L.questionMany} {L.matches} "{query.trim()}"</>
                : <>&gt; {L.hint}</>}
            </p>
            <div className="ggh-flags" role="group" aria-label={isEn ? 'Categories' : 'Categorias'}>
              <button type="button" className={cat === 'all' ? 'is-on' : ''} onClick={() => setCat('all')}>{L.all}</button>
              {activeCategories.map(c => (
                <button key={c.id} type="button" className={cat === c.id ? 'is-on' : ''} onClick={() => setCat(c.id)} title={c.desc}>--{c.id}</button>
              ))}
            </div>
          </div>
        </div>
        <nav className="ggh-jump" aria-label={isEn ? 'Jump to' : 'Ir a'}>
          {L.jumps.map(([id, label]) => <button key={id} type="button" onClick={() => jump(id)}>{label}</button>)}
        </nav>
      </section>

      <div className="ggh-wrap">
        {/* Guías */}
        <Head id="guias" cmd={`ls ${isEn ? 'guides' : 'guias'}/${cat === 'all' ? '' : cat + '/'}`} title={L.guidesTitle} count={guides.length} />
        {cat !== 'all' && <p className="ggh-catdesc">{activeCategories.find(c => c.id === cat)?.desc}</p>}
        {guides.length ? (
          <div className="ggh-guides">
            {guides.map(g => <Guide key={g.id} g={g} q={q} done={progress[g.id] || {}} onToggle={i => toggleStep(g.id, i)} />)}
          </div>
        ) : (
          <div className="ggh-empty">
            <p>&gt; {L.noGuides} "{query.trim()}".</p>
            <button type="button" onClick={() => jump('ticket')}>{L.ticketCmd}</button>
          </div>
        )}

        {/* FAQ */}
        <Head id="faq" cmd="man faq" title={L.faqTitle} count={faqs.length} />
        {faqs.length ? (
          <div className="ggh-faq">
            {faqs.map(f => {
              const open = openFaq === f.i || (!!q && faqs.length <= 2)
              const v = votes[f.q]
              return (
                <div key={f.i} className={`ggh-faq__item${open ? ' is-open' : ''}`}>
                  <button className="ggh-faq__q" aria-expanded={open} onClick={() => setOpenFaq(openFaq === f.i ? null : f.i)}>
                    <span className="ggh-faq__n">{pad(f.i + 1)}</span>
                    <span className="ggh-faq__t"><Hl text={f.q} q={q} /></span>
                    <i aria-hidden="true">{open ? '−' : '+'}</i>
                  </button>
                  {open && (
                    <div className="ggh-faq__a">
                      <p><Hl text={f.a} q={q} /></p>
                      <div className={`ggh-vote${v ? ' is-done' : ''}`}>
                        {v ? (
                          <span>{v === 'yes' ? L.voteYes : L.voteNo}</span>
                        ) : (
                          <>
                            <span>{L.voteQuestion}</span>
                            <button type="button" onClick={() => vote(f.q, 'yes')}>{isEn ? '[y] Yes' : '[s] Si'}</button>
                            <button type="button" onClick={() => vote(f.q, 'no')}>[n] No</button>
                          </>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        ) : <div className="ggh-empty"><p>&gt; {L.noFaq}</p></div>}

        {/* Reportar bug: paso a paso */}
        <section id="reportar" className="ggh-bug">
          <div className="ggh-bug__band" aria-hidden="true"><span>INCIDENCIA</span><span>./reportar-bug</span></div>
          <div className="ggh-bug__in">
            <div className="ggh-bug__intro">
              <h2>{Icon.alert} {L.bugTitle}</h2>
              <p>{L.bugIntro}</p>
              <ol className="ggh-steps" aria-label="Pasos">
                {L.bugSteps.map((s, i) => (
                  <li key={s} className={i === bugStep ? 'is-on' : i < bugStep ? 'is-done' : ''}>
                    <button type="button" disabled={i > bugStep} onClick={() => setBugStep(i)}><span>{i < bugStep ? '✓' : pad(i + 1)}</span>{s}</button>
                  </li>
                ))}
              </ol>
            </div>

            <div className="ggh-bug__panel">
              {bugSent ? (
                <div className="ggh-bug__done">
                  <p className="ggh-line ggh-line--ok">&gt; reporte enviado · {bugSent}</p>
                  <p>{L.thanks}</p>
                  <button type="button" className="ggh-btn ggh-btn--ghost" onClick={() => setBugSent(null)}>Reportar otro</button>
                </div>
              ) : (
                <>
                  <div className="ggh-bug__step" key={bugStep}>
                    {bugStep === 0 && (
                      <fieldset>
                        <legend>¿Dónde pasó?</legend>
                        <div className="ggh-chips">
                          {L.bugAreas.map(a => <button key={a} type="button" className={bug.area === a ? 'is-on' : ''} onClick={() => setBug({ ...bug, area: a })}>{a}</button>)}
                        </div>
                      </fieldset>
                    )}
                    {bugStep === 1 && (
                      <div className="ggh-fields">
                        <label>¿Qué hacías?<input value={bug.doing} onChange={e => setBug({ ...bug, doing: e.target.value })} placeholder="Ej. Hacía check-in desde el torneo" /></label>
                        <label>¿Qué esperabas?<input value={bug.expected} onChange={e => setBug({ ...bug, expected: e.target.value })} placeholder="Ej. Que mi equipo quedara confirmado" /></label>
                        <label>¿Qué pasó? <em>obligatorio</em><textarea rows={3} value={bug.happened} onChange={e => setBug({ ...bug, happened: e.target.value })} placeholder="Ej. El botón se quedó cargando y no cambió nada" /></label>
                      </div>
                    )}
                    {bugStep === 2 && (
                      <div className="ggh-fields">
                        <fieldset>
                          <legend>¿Qué tan grave es?</legend>
                          <div className="ggh-chips">
                            {L.bugSeverity.map(([id, label]) => <button key={id} type="button" data-sev={id} className={bug.severity === id ? 'is-on' : ''} onClick={() => setBug({ ...bug, severity: id })}>{label}</button>)}
                          </div>
                        </fieldset>
                        <label>Enlace a una captura <em>opcional</em><input value={bug.shot} onChange={e => setBug({ ...bug, shot: e.target.value })} placeholder="https://…" inputMode="url" /></label>
                        <p className="ggh-auto">Se adjunta solo: <code>{device()}</code></p>
                      </div>
                    )}
                    {bugStep === 3 && (
                      <div className="ggh-review">
                        <div className="ggh-log">
                          <p><span>asunto</span>{bugSubject}</p>
                          <p><span>{L.priority}</span><b data-sev={bug.severity}>{L.priorities.find(p => p[0] === bug.severity)?.[1]}</b></p>
                          <pre>{bugMessage}</pre>
                        </div>
                      </div>
                    )}
                  </div>
                  <div className="ggh-bug__nav">
                    {bugStep > 0 && <button type="button" className="ggh-btn ggh-btn--ghost" onClick={() => setBugStep(bugStep - 1)}>{L.back}</button>}
                    <span className="ggh-bug__count">{bugStep + 1}/{L.bugSteps.length}</span>
                    {bugStep < 3
                      ? <button type="button" className="ggh-btn" disabled={!bugCanNext} onClick={() => setBugStep(bugStep + 1)}>{L.next}</button>
                      : <>
                          <a className="ggh-btn ggh-btn--ghost" href={mailto}>{L.byEmail}</a>
                          <button type="button" className="ggh-btn ggh-btn--warn" disabled={sendingBug} onClick={submitBug}>{Icon.send}{sendingBug ? L.sending : L.sendReport}</button>
                        </>}
                  </div>
                </>
              )}
            </div>
          </div>
        </section>

        {/* Ticket con vista previa */}
        <Head id="ticket" cmd={L.ticketCmd} title={L.ticketTitle} />
        <p className="ggh-catdesc">{L.ticketDesc}</p>
        <section className="ggh-ticket">
          <form className="ggh-ticket__form" onSubmit={submitTicket}>
            <fieldset>
              <legend>{L.purpose}</legend>
              <div className="ggh-chips ggh-chips--purpose">
                {SYSTEM_TICKET_PURPOSES.map(p => (
                  <button key={p.id} type="button" className={ticket.purpose === p.id ? 'is-on' : ''} onClick={() => setTicket({ ...ticket, purpose: p.id })} title={p.desc}>{p.label}</button>
                ))}
              </div>
              {purpose && <p className="ggh-hint">&gt; {purpose.desc}</p>}
            </fieldset>
            <fieldset>
              <legend>{L.priority}</legend>
              <div className="ggh-seg">
                {L.priorities.map(([id, label]) => <button key={id} type="button" data-sev={id} className={ticket.priority === id ? 'is-on' : ''} onClick={() => setTicket({ ...ticket, priority: id })}>{label}</button>)}
              </div>
            </fieldset>
            <div className="ggh-fields">
              <label>{L.subject}<input value={ticket.subject} onChange={e => setTicket({ ...ticket, subject: e.target.value })} placeholder={L.placeholders.subject} maxLength={120} /></label>
              <label>{L.message}<textarea rows={5} value={ticket.message} onChange={e => setTicket({ ...ticket, message: e.target.value })} placeholder={L.placeholders.message} /></label>
            </div>
            <button className="ggh-btn ggh-btn--full" type="submit" disabled={sendingTicket}>{Icon.send} {sendingTicket ? L.sending : L.createTicket}</button>
          </form>

          <aside className="ggh-preview" aria-label="Vista previa del ticket">
            <div className="ggh-preview__bar"><span>{L.preview}</span><span className="ggh-preview__st">{L.draft}</span></div>
            <div className="ggh-preview__body">
              <p className="ggh-preview__code">TKT-····</p>
              <dl>
                <div><dt>{L.purpose}</dt><dd>{purpose?.label || '—'}</dd></div>
                <div><dt>{L.priority}</dt><dd><b data-sev={ticket.priority}>{L.priorities.find(p => p[0] === ticket.priority)?.[1]}</b></dd></div>
                <div><dt>{isEn ? 'from' : 'de'}</dt><dd>{requester}</dd></div>
              </dl>
              <p className={`ggh-preview__subj${ticket.subject ? '' : ' is-ph'}`}>{ticket.subject || L.noSubject}</p>
              <p className={`ggh-preview__msg${ticket.message ? '' : ' is-ph'}`}>{ticket.message || L.previewMessage}</p>
              <p className="ggh-preview__foot">{ticket.message.length} {L.chars}</p>
            </div>
          </aside>
        </section>

        {/* Contacto */}
        <section id="contacto" className="ggh-block">
          <Head cmd="cat contacto.txt" title={L.contact} />
          <p>{L.contactLine} <b>soporte@glitchgang.com</b> · {L.contactRest}</p>
        </section>

        <section id="riot" className="ggh-block ggh-riot">
          <p><span>aviso legal · riot games</span>STELIANT ESPORTS no está respaldado por Riot Games y no refleja las opiniones de Riot Games. Riot Games y sus propiedades son marcas de Riot Games, Inc.</p>
        </section>

        <nav className="ggh-legal" aria-label="Documentos legales">
          {L.legal.map(([to, label]) => <Link key={to} to={to}>{label}</Link>)}
        </nav>
      </div>
    </div>
  )
}

