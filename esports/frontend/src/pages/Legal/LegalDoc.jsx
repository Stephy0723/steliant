import { useEffect, useRef, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { Icon } from '../../components/icons/Icons.jsx'
import './Legal.css'

// Layout reutilizable para páginas legales (Términos, Privacidad, Pagos, Organizador).
// Props: title, updated, intro, sections[{id,title,body[],tldr?}], tag
// tldr es opcional: si falta, se usa la primera frase del primer párrafo.
export const LEGAL_DOCS = [
  { to: '/terminos', file: 'terminos.md', label: 'Términos' },
  { to: '/privacidad', file: 'privacidad.md', label: 'Privacidad' },
  { to: '/politica-pagos', file: 'pagos.md', label: 'Pagos' },
  { to: '/terminos-organizador', file: 'organizador.md', label: 'Organizador' },
]

const pad = (n) => String(n).padStart(2, '0')
const stripNum = (t = '') => t.replace(/^\d+\.\s*/, '')
const firstSentence = (t = '') => { const m = t.match(/^.*?[.!?](?=\s|$)/); return (m ? m[0] : t).trim() }
const readKey = (path, updated) => `gg-legal-read:${path}:${updated || ''}`
const calm = () => typeof window !== 'undefined' && (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches || document.documentElement.classList.contains('gg-perf'))

// Escribe el título una vez, como en consola. Se salta con movimiento reducido.
function useTyped(text) {
  const [n, setN] = useState(() => (calm() ? text.length : 0))
  useEffect(() => {
    if (calm()) { setN(text.length); return undefined }
    setN(0)
    let i = 0
    const t = setInterval(() => { i += 1; setN(i); if (i >= text.length) clearInterval(t) }, Math.max(16, Math.round(640 / text.length)))
    return () => clearInterval(t)
  }, [text])
  return [text.slice(0, n), n < text.length]
}

export default function LegalDoc({ title, updated, intro, sections = [], tag = 'Legal' }) {
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const doc = LEGAL_DOCS.find(d => d.to === pathname) || { to: pathname, file: 'documento.md' }
  const [typed, typing] = useTyped(title)
  const [active, setActive] = useState(sections[0]?.id)
  const [pct, setPct] = useState(0)
  const [tldrOnly, setTldrOnly] = useState(false)
  const [copied, setCopied] = useState(null)
  const [readAt, setReadAt] = useState(null)
  const barRef = useRef(null)

  useEffect(() => {
    window.scrollTo(0, 0)
    setActive(sections[0]?.id)
    try { setReadAt(localStorage.getItem(readKey(pathname, updated))) } catch { setReadAt(null) }
  }, [pathname, updated, sections])

  // Progreso de lectura: una transform por frame, sin re-render salvo al cambiar el %.
  useEffect(() => {
    let raf = 0
    const tick = () => {
      cancelAnimationFrame(raf)
      raf = requestAnimationFrame(() => {
        const max = document.documentElement.scrollHeight - window.innerHeight
        const p = max > 0 ? Math.min(1, Math.max(0, window.scrollY / max)) : 1
        if (barRef.current) barRef.current.style.transform = `scaleX(${p})`
        setPct(Math.round(p * 100))
      })
    }
    tick()
    window.addEventListener('scroll', tick, { passive: true })
    window.addEventListener('resize', tick)
    return () => { cancelAnimationFrame(raf); window.removeEventListener('scroll', tick); window.removeEventListener('resize', tick) }
  }, [pathname, tldrOnly])

  // Sección que estás leyendo → índice y barra de estado.
  useEffect(() => {
    if (!('IntersectionObserver' in window)) return undefined
    const els = sections.map(s => document.getElementById(s.id)).filter(Boolean)
    const io = new IntersectionObserver((entries) => {
      const hit = entries.filter(e => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0]
      if (hit) setActive(hit.target.id)
    }, { rootMargin: '-18% 0px -70% 0px' })
    els.forEach(el => io.observe(el))
    return () => io.disconnect()
  }, [sections, tldrOnly])

  const copyLink = async (id) => {
    const url = `${window.location.origin}${window.location.pathname}#${id}`
    try { await navigator.clipboard.writeText(url) } catch { /* noop */ }
    setCopied(id)
    setTimeout(() => setCopied(c => (c === id ? null : c)), 1600)
  }
  const markRead = () => {
    const d = new Date().toLocaleDateString('es', { day: 'numeric', month: 'short', year: 'numeric' })
    try { localStorage.setItem(readKey(pathname, updated), d) } catch { /* noop */ }
    setReadAt(d)
  }
  const unmark = () => { try { localStorage.removeItem(readKey(pathname, updated)) } catch { /* noop */ } setReadAt(null) }

  const words = sections.reduce((n, s) => n + s.body.join(' ').split(/\s+/).length, 0)
  const mins = Math.max(1, Math.round(words / 200))
  const idx = Math.max(0, sections.findIndex(s => s.id === active))

  return (
    <div className="ggt">
      <header className="ggt-bar">
        <button className="ggt-back" onClick={() => (window.history.length > 1 ? navigate(-1) : navigate('/'))}>
          {Icon.chevronRight}<span>Back</span>
        </button>
        <span className="ggt-path">~/legal/<b>{doc.file}</b></span>
        <span className="ggt-brand">GLITCH<b>GANG</b></span>
        <span className="ggt-progress" aria-hidden="true"><i ref={barRef} /></span>
      </header>

      <nav className="ggt-tabs" aria-label="Documentos legales">
        {LEGAL_DOCS.map(d => (
          <Link key={d.to} to={d.to} className={`ggt-tab${d.to === pathname ? ' is-on' : ''}`} aria-current={d.to === pathname ? 'page' : undefined}>
            <span>{d.file}</span><small>{d.label}</small>
          </Link>
        ))}
      </nav>

      <div className="ggt-shell">
        <aside className="ggt-side" aria-label="Índice">
          <div className="ggt-side__lab">índice <span>{sections.length}</span></div>
          <ol>
            {sections.map((s, i) => (
              <li key={s.id}>
                <a href={`#${s.id}`} className={active === s.id ? 'is-on' : ''} aria-current={active === s.id ? 'true' : undefined}>
                  <span>{pad(i + 1)}</span>{stripNum(s.title)}
                </a>
              </li>
            ))}
          </ol>
        </aside>

        <main className="ggt-main">
          <header className="ggt-head">
            <p className="ggt-cmd"><span className="ggt-ps">gg@glitchgang:~/legal$</span> cat {doc.file}</p>
            <span className="ggt-tag">{Icon.shield} {tag}</span>
            <h1 aria-label={title}><span aria-hidden="true">{typed}</span>{typing && <i className="ggt-caret" aria-hidden="true" />}</h1>
            <p className="ggt-meta">// última actualización: {updated} · {sections.length} secciones · ~{mins} min de lectura</p>
            {intro && <p className="ggt-intro">{intro}</p>}
            <div className="ggt-tools">
              <button type="button" role="switch" aria-checked={tldrOnly} className={`ggt-switch${tldrOnly ? ' is-on' : ''}`} onClick={() => setTldrOnly(v => !v)}>
                <i aria-hidden="true" />--tldr
              </button>
              <span>{tldrOnly ? 'Mostrando solo los resúmenes' : 'Ver solo el resumen de cada sección'}</span>
            </div>
          </header>

          <div className={`ggt-doc${tldrOnly ? ' is-tldr' : ''}`}>
            {sections.map((s, i) => (
              <section key={s.id} id={s.id} className={`ggt-sec${active === s.id ? ' is-on' : ''}`}>
                <h2>
                  <span className="ggt-sec__n">## {pad(i + 1)}</span>
                  <span className="ggt-sec__t">{stripNum(s.title)}</span>
                  <button type="button" className={`ggt-copy${copied === s.id ? ' is-done' : ''}`} onClick={() => copyLink(s.id)} aria-label={`Copiar enlace a ${stripNum(s.title)}`}>
                    {copied === s.id ? <>{Icon.check}copiado</> : '#'}
                  </button>
                </h2>
                <p className="ggt-tldr"><b>tl;dr</b><span>{s.tldr || firstSentence(s.body[0])}</span></p>
                {!tldrOnly && <div className="ggt-lines">{s.body.map((p, j) => <p key={j}>{p}</p>)}</div>}
              </section>
            ))}

            <section className="ggt-sec ggt-eof">
              <h2><span className="ggt-sec__n">## EOF</span><span className="ggt-sec__t">Contacto</span></h2>
              <p>Soporte y reclamos: <b>soporte@glitchgang.com</b> · Discord oficial de STELIANT ESPORTS.</p>
              <div className={`ggt-ack${readAt ? ' is-read' : ''}`}>
                {readAt ? (
                  <>
                    <span>{Icon.check} Marcaste este documento como leído el {readAt}.</span>
                    <button type="button" onClick={unmark}>Desmarcar</button>
                  </>
                ) : (
                  <button type="button" className="ggt-ack__btn" onClick={markRead}>{Icon.check} Marcar como leído</button>
                )}
              </div>
            </section>
          </div>
        </main>
      </div>

      <footer className="ggt-status" aria-live="polite">
        <span className={`ggt-mode${readAt ? ' is-read' : ''}`}>{readAt ? 'LEÍDO' : 'LEYENDO'}</span>
        <span className="ggt-status__file">{doc.file}</span>
        <span className="ggt-status__sec">§{pad(idx + 1)} {stripNum(sections[idx]?.title)}</span>
        <span className="ggt-status__pct">{pct}%</span>
        {!readAt && pct >= 90 && <button type="button" onClick={markRead}>:marcar leído</button>}
      </footer>
    </div>
  )
}

