import { useEffect, useMemo, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Icon } from '../../../components/icons/Icons.jsx'
import { api } from '../../../lib/api.js'
import { useAuth } from '../../../context/AuthContext.jsx'
import { CRM_BASE } from '../../../lib/crmApi.js'
import './BotIntegrations.css'

const BOTS = [
  {
    key: 'web',
    name: 'Bot Web',
    tag: 'Plataforma GlitchGang',
    icon: Icon.globe,
    color: '#3b82f6',
    statusLabel: 'Activo',
    statusDot: '#22c55e',
    blurb: 'El panel que estás viendo ahora. Todo lo que gestionas en Discord también vive acá, centralizado.',
    advantages: [
      'No requiere instalar nada: funciona en cualquier navegador, PC o celular.',
      'Panel en tiempo real con métricas, brackets y estado de cada torneo.',
      'Perfiles, pagos y verificación de jugadores centralizados en un solo lugar.',
      'Es el respaldo cuando un organizador no usa Discord a diario.',
    ],
    cta: 'Ya estás en este panel',
  },
]

const DISCORD_BOT = {
  name: 'Bot de Discord',
  tag: 'Un servidor = tu organización',
  icon: Icon.discord,
  color: '#5865F2',
  blurb: 'El bot vive dentro de tu propio servidor: comandos, roles y anuncios sin salir de Discord.',
  advantages: [
    'Comandos slash para check-in, reportar resultados y ver brackets al instante.',
    'Roles automáticos por equipo/torneo — sin asignarlos uno por uno a mano.',
    'Tus torneos quedan aislados de los de cualquier otro cliente de GlitchGang.',
    'Grabación de audio en partidas para resolver disputas con evidencia real.',
  ],
}

function hoursManual(teams) { return 0.15 * teams + 0.5 + 0.4 + 0.5 }
function hoursPro(teams) { return 0.02 * teams + 0.05 + 0.15 + 0.05 }

const RATE_PER_HOUR = 10
const NORMAL_INFRA_FIXED = 40
const PRO_FIXED = 49

function money(n) {
  return n.toLocaleString('es-DO', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })
}

const MAX_COST_SCALE = NORMAL_INFRA_FIXED + 20 * hoursManual(32) * RATE_PER_HOUR
const RING_R = 52
const RING_C = 2 * Math.PI * RING_R

// Animacion de conteo suave para los numeros — si el usuario mueve el
// slider a mitad de una animacion, arranca desde el valor real ya
// renderizado (no desde el ultimo valor "objetivo") para que nunca salte.
function useCountUp(value, duration = 450) {
  const [display, setDisplay] = useState(value)
  const displayRef = useRef(value)
  useEffect(() => {
    const from = displayRef.current
    const to = value
    if (Math.abs(from - to) < 0.005) { displayRef.current = to; setDisplay(to); return }
    const start = performance.now()
    let raf
    const step = (now) => {
      const t = Math.min((now - start) / duration, 1)
      const eased = 1 - Math.pow(1 - t, 3)
      const current = from + (to - from) * eased
      displayRef.current = current
      setDisplay(current)
      if (t < 1) raf = requestAnimationFrame(step)
    }
    raf = requestAnimationFrame(step)
    return () => cancelAnimationFrame(raf)
  }, [value, duration])
  return display
}

function BotCard({ bot, open, onToggle }) {
  return (
    <div className={`bint__card ${open ? 'is-open' : ''}`}>
      <div className="bint__card-top">
        <span className="bint__card-icon" style={{ background: `${bot.color}1a`, color: bot.color }}>{bot.icon}</span>
        <div className="bint__card-head">
          <b>{bot.name}</b>
          <span className="bint__card-tag">{bot.tag}</span>
        </div>
        <span className="bint__status">
          <span className="bint__status-dot" style={{ background: bot.statusDot }} />
          {bot.statusLabel}
        </span>
      </div>

      <p className="bint__card-blurb">{bot.blurb}</p>

      <button className="bint__toggle" onClick={onToggle}>
        {Icon.chevronRight}
        {open ? 'Ocultar ventajas' : 'Ver ventajas'}
      </button>

      <AnimatePresence initial={false}>
        {open && (
          <motion.ul
            className="bint__list"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.22 }}
          >
            {bot.advantages.map((a, i) => (
              <li key={i}>{Icon.check}<span>{a}</span></li>
            ))}
          </motion.ul>
        )}
      </AnimatePresence>

      <span className="bint__cta bint__cta--disabled">{bot.cta}</span>
    </div>
  )
}

function DiscordCard({ open, onToggle }) {
  const { user } = useAuth()
  const isStaff = user?.role === 'admin'
  const [loading, setLoading] = useState(true)
  const [org, setOrg] = useState(null)
  const [request, setRequest] = useState(null)
  const [formOpen, setFormOpen] = useState(false)
  const [form, setForm] = useState({ name: '', discordGuildId: '', message: '' })
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  const load = () => {
    setLoading(true)
    Promise.all([
      api('/organizations/mine').catch(() => ({ organization: null })),
      api('/organizations/mine/request').catch(() => ({ request: null })),
    ]).then(([o, r]) => {
      setOrg(o.organization || null)
      setRequest(r.request || null)
    }).finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [])

  const submit = async (e) => {
    e.preventDefault()
    setError('')
    if (!form.name.trim() || !form.discordGuildId.trim()) {
      setError('Nombre e ID del servidor son obligatorios.')
      return
    }
    setSubmitting(true)
    try {
      await api('/organizations/requests', { method: 'POST', body: form })
      setFormOpen(false)
      load()
    } catch (err) {
      setError(err.message || 'No se pudo enviar la solicitud.')
    } finally {
      setSubmitting(false)
    }
  }

  const status = org
    ? { label: 'Conectado', dot: '#22c55e' }
    : request?.status === 'pending'
      ? { label: 'Solicitud pendiente', dot: '#f59e0b' }
      : { label: 'Sin conectar', dot: '#9ca3af' }

  return (
    <div className={`bint__card ${open ? 'is-open' : ''}`}>
      <div className="bint__card-top">
        <span className="bint__card-icon" style={{ background: `${DISCORD_BOT.color}1a`, color: DISCORD_BOT.color }}>{DISCORD_BOT.icon}</span>
        <div className="bint__card-head">
          <b>{DISCORD_BOT.name}</b>
          <span className="bint__card-tag">{DISCORD_BOT.tag}</span>
        </div>
        <span className="bint__status">
          <span className="bint__status-dot" style={{ background: status.dot }} />
          {status.label}
        </span>
      </div>

      <p className="bint__card-blurb">{DISCORD_BOT.blurb}</p>

      <button className="bint__toggle" onClick={onToggle}>
        {Icon.chevronRight}
        {open ? 'Ocultar ventajas' : 'Ver ventajas'}
      </button>

      <AnimatePresence initial={false}>
        {open && (
          <motion.ul
            className="bint__list"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.22 }}
          >
            {DISCORD_BOT.advantages.map((a, i) => (
              <li key={i}>{Icon.check}<span>{a}</span></li>
            ))}
          </motion.ul>
        )}
      </AnimatePresence>

      {loading && <span className="bint__cta bint__cta--disabled">Cargando estado...</span>}

      {!loading && org && (
        <div className="bint__org-info">
          <div><span>Organización</span><b>{org.name}</b></div>
          <div><span>Servidor de Discord</span><b>{org.discordGuildId}</b></div>
        </div>
      )}

      {!loading && org && isStaff && (
        <a className="bint__cta" href={`${CRM_BASE}/app`} target="_blank" rel="noreferrer">
          Abrir CRM de Discord {Icon.chevronRight}
        </a>
      )}

      {!loading && !org && request?.status === 'pending' && (
        <div className="bint__pending-note">
          {Icon.clock} Solicitud enviada para <b>{request.name}</b> — GlitchGang la está revisando.
        </div>
      )}

      {!loading && !org && (!request || request.status !== 'pending') && !formOpen && (
        <button className="bint__cta" onClick={() => setFormOpen(true)}>
          {request?.status === 'rejected' ? 'Volver a solicitar' : 'Solicitar activación'} {Icon.chevronRight}
        </button>
      )}

      {!loading && !org && request?.status === 'rejected' && !formOpen && (
        <p className="bint__rejected-note">
          Tu solicitud anterior fue rechazada{request.rejectionReason ? `: ${request.rejectionReason}` : '.'}
        </p>
      )}

      {formOpen && (
        <form className="bint__discord-form" onSubmit={submit}>
          <label className="bint__field">
            <span>Nombre de tu organización</span>
            <input
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="Ej. Titanes Esports"
              maxLength={120}
            />
          </label>
          <label className="bint__field">
            <span>ID de tu servidor de Discord</span>
            <input
              value={form.discordGuildId}
              onChange={(e) => setForm({ ...form, discordGuildId: e.target.value })}
              placeholder="Ej. 1462652759466577932"
            />
            <small>Activa el modo desarrollador en Discord → clic derecho en tu servidor → "Copiar ID".</small>
          </label>
          <label className="bint__field">
            <span>Mensaje (opcional)</span>
            <textarea
              value={form.message}
              onChange={(e) => setForm({ ...form, message: e.target.value })}
              maxLength={500}
              rows={2}
            />
          </label>
          {error && <p className="bint__form-error">{error}</p>}
          <div className="bint__form-actions">
            <button type="button" className="bint__cta bint__cta--disabled" onClick={() => setFormOpen(false)} disabled={submitting}>
              Cancelar
            </button>
            <button type="submit" className="bint__cta" disabled={submitting}>
              {submitting ? 'Enviando...' : 'Enviar solicitud'}
            </button>
          </div>
        </form>
      )}
    </div>
  )
}

export default function BotIntegrations() {
  const [openCard, setOpenCard] = useState(null)
  const [monthly, setMonthly] = useState(4)
  const [teams, setTeams] = useState(8)

  const calc = useMemo(() => {
    const hManual = hoursManual(teams)
    const hPro = hoursPro(teams)
    const normal = NORMAL_INFRA_FIXED + monthly * hManual * RATE_PER_HOUR
    const pro = PRO_FIXED + monthly * hPro * RATE_PER_HOUR
    const savings = Math.max(normal - pro, 0)
    const pct = normal > 0 ? (savings / normal) * 100 : 0
    const hoursSaved = Math.max(monthly * (hManual - hPro), 0)
    return { normal, pro, savings, pct, hoursSaved, hManual: monthly * hManual, hPro: monthly * hPro }
  }, [monthly, teams])

  const normalD = useCountUp(calc.normal)
  const proD = useCountUp(calc.pro)
  const savingsD = useCountUp(calc.savings)
  const pctD = useCountUp(calc.pct)
  const hoursSavedD = useCountUp(calc.hoursSaved)
  const ringOffset = RING_C * (1 - pctD / 100)

  return (
    <div className="ocrm__panel bint">
      <div className="bint__intro">
        <h2>Dos canales, un solo motor de torneos</h2>
        <p>GlitchGang no depende de un único punto de entrada. Web y Discord leen y escriben sobre los mismos datos — el jugador entra por donde ya está acostumbrado a estar.</p>
      </div>

      <div className="bint__cards">
        <BotCard bot={BOTS[0]} open={openCard === 'web'} onToggle={() => setOpenCard(openCard === 'web' ? null : 'web')} />
        <DiscordCard open={openCard === 'discord'} onToggle={() => setOpenCard(openCard === 'discord' ? null : 'discord')} />
      </div>

      <div className="bint__cost">
        <div className="bint__cost-head">
          <h3>{Icon.chartBar} Costo por torneo, en vivo</h3>
          <p className="ocrm__muted">Mueve los controles — el cálculo se actualiza al instante.</p>
        </div>

        <div className="bint__cost-inputs">
          <label>
            <span>{Icon.calendar} Torneos / mes <b>{monthly}</b></span>
            <input type="range" min="1" max="20" value={monthly} onChange={(e) => setMonthly(Number(e.target.value))} />
          </label>
          <label>
            <span>{Icon.users} Equipos / torneo <b>{teams}</b></span>
            <input type="range" min="2" max="32" value={teams} onChange={(e) => setTeams(Number(e.target.value))} />
          </label>
        </div>

        <div className="bint__bars">
          <div className="bint__bar-row">
            <div className="bint__bar-label"><span className="bint__bar-dot bint__bar-dot--normal" />Plan normal</div>
            <div className="bint__bar-track">
              <div className="bint__bar-fill bint__bar-fill--normal" style={{ width: `${Math.min((calc.normal / MAX_COST_SCALE) * 100, 100)}%` }} />
            </div>
            <b className="bint__bar-value">{money(normalD)}</b>
          </div>
          <div className="bint__bar-row">
            <div className="bint__bar-label"><span className="bint__bar-dot bint__bar-dot--pro" />GlitchGang Pro</div>
            <div className="bint__bar-track">
              <div className="bint__bar-fill bint__bar-fill--pro" style={{ width: `${Math.min((calc.pro / MAX_COST_SCALE) * 100, 100)}%` }} />
            </div>
            <b className="bint__bar-value">{money(proD)}</b>
          </div>
        </div>

        <div className="bint__chips">
          <span className="bint__chip">{Icon.gear} Infra 24/7 · {money(NORMAL_INFRA_FIXED)}</span>
          <span className="bint__chip">{Icon.clock} {calc.hManual.toFixed(1)}h staff manual</span>
          <span className="bint__chip bint__chip--pro">{Icon.bolt} Todo incluido · {money(PRO_FIXED)}</span>
          <span className="bint__chip bint__chip--pro">{Icon.clock} {calc.hPro.toFixed(1)}h de supervisión</span>
        </div>

        <div className="bint__savings-hero">
          <div className="bint__ring">
            <svg viewBox="0 0 120 120">
              <circle className="bint__ring-track" cx="60" cy="60" r={RING_R} />
              <circle
                className="bint__ring-fill"
                cx="60" cy="60" r={RING_R}
                style={{ strokeDasharray: RING_C, strokeDashoffset: ringOffset }}
              />
            </svg>
            <div className="bint__ring-label">
              <b>{Math.round(pctD)}%</b>
              <span>ahorro</span>
            </div>
          </div>
          <div className="bint__savings-stats">
            <div>
              <b>{money(savingsD)}</b>
              <span>ahorro estimado /mes</span>
            </div>
            <div>
              <b>{hoursSavedD.toFixed(1)}h</b>
              <span>staff liberadas /mes</span>
            </div>
          </div>
        </div>

        <p className="bint__disclaimer">
          * Tarifa de staff asumida en {money(RATE_PER_HOUR)}/hora. El plan de pago de GlitchGang Pro aún no está activo —
          comparación referencial mientras terminamos de definir precios finales.
        </p>
      </div>
    </div>
  )
}

