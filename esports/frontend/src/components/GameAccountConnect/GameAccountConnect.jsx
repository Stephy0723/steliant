// Conectar la cuenta de Mobile Legends con el codigo que llega al CORREO
// DENTRO DEL JUEGO. Pasos: ID + servidor -> codigo -> "¿Esta es tu cuenta?"
// -> Verificada. El nickname no se pide: lo devuelve el juego, y se puede
// cambiar las veces que quiera sin perder la cuenta (la llave es el ID).
import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { gameAccountsApi } from '../../lib/gameAccountsApi.js'
import { toast } from '../../lib/toast.js'
import './GameAccountConnect.css'

const MLBB_LOGO = '/demos/steliant-esports/Logo/mlbb.png'

// Estado compartido de "mi cuenta de MLBB": Ajustes, el editor del equipo, el
// asistente de crear equipo y el recordatorio leen lo mismo y se enteran
// cuando se verifica en cualquiera de ellos.
let shared = { loading: true, account: null, pending: null }
let inflight = null
const listeners = new Set()
function publish(next) {
  shared = { ...shared, ...next }
  listeners.forEach(fn => fn(shared))
}
export function reloadMyGameAccount() {
  if (!inflight) {
    inflight = gameAccountsApi.mine()
      .then(d => publish({ loading: false, account: d.mlbb?.account || null, pending: d.mlbb?.pending || null }))
      .catch(() => publish({ loading: false }))
      .finally(() => { inflight = null })
  }
  return inflight
}
export function useMyGameAccount({ enabled = true } = {}) {
  const [state, setState] = useState(shared)
  useEffect(() => {
    if (!enabled) return undefined
    listeners.add(setState)
    reloadMyGameAccount()
    return () => { listeners.delete(setState) }
  }, [enabled])
  return state
}
/** Ruta interna segura para el boton "Volver" (?volver=/equipos...). */
export function safeReturnPath(value) {
  const path = String(value || '')
  return /^\/(?![/\\])[^\\]*$/.test(path) ? path : ''
}

function useCountdown(until) {
  const [now, setNow] = useState(Date.now())
  useEffect(() => {
    if (!until) return undefined
    const timer = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(timer)
  }, [until])
  if (!until) return null
  // Tope de 5:00: el reloj del servidor y el del telefono no siempre coinciden.
  const left = Math.min(300, Math.max(0, Math.round((new Date(until).getTime() - now) / 1000)))
  return { left, label: `${Math.floor(left / 60)}:${String(left % 60).padStart(2, '0')}` }
}

export function GameAccountBadge({ account, compact = false }) {
  if (!account?.verified && account?.status !== 'verified') return null
  return (
    <span className={`gac-badge ${compact ? 'gac-badge--compact' : ''}`} title={`Cuenta de Mobile Legends verificada${account.nickname ? `: ${account.nickname}` : ''}`}>
      <img src={MLBB_LOGO} alt="" />
      {compact ? '✓' : 'Verificada'}
    </span>
  )
}

function AccountCard({ account }) {
  const facts = [
    account.level != null && ['Nivel', account.level],
    account.rank && ['Rango', account.rank],
    account.highestRank && account.highestRank !== account.rank && ['Rango máximo', account.highestRank],
    account.country && ['País', account.country],
  ].filter(Boolean)
  return (
    <div className="gac-account">
      {account.avatar ? <img className="gac-account__avatar" src={account.avatar} alt="" /> : <span className="gac-account__avatar gac-account__avatar--empty"><img src={MLBB_LOGO} alt="" /></span>}
      <div className="gac-account__body">
        <b>{account.nickname || 'Cuenta de Mobile Legends'}</b>
        <span>ID {account.roleId} ({account.zoneId})</span>
        {facts.length > 0 && <dl>{facts.map(([k, v]) => <div key={k}><dt>{k}</dt><dd>{v}</dd></div>)}</dl>}
      </div>
    </div>
  )
}

export function GameAccountModal({ initial, onClose, onVerified, returnTo = '', returnLabel = 'Volver a donde estaba' }) {
  const navigate = useNavigate()
  const [step, setStep] = useState(initial?.status === 'pending_confirm' ? 'confirm' : initial?.status === 'pending_code' ? 'code' : 'ids')
  const [roleId, setRoleId] = useState(initial?.roleId || '')
  const [zoneId, setZoneId] = useState(initial?.zoneId || '')
  const [code, setCode] = useState('')
  const [pending, setPending] = useState(initial || null)
  const [claimedByOther, setClaimedByOther] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const firstInput = useRef(null)
  const countdown = useCountdown(step === 'code' ? pending?.codeExpiresAt : null)

  useEffect(() => { firstInput.current?.focus() }, [step])
  useEffect(() => {
    const onKey = e => { if (e.key === 'Escape' && !busy) onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [busy, onClose])

  const run = async (action) => {
    setBusy(true); setError('')
    try { await action() } catch (e) { setError(e.message || 'Algo salió mal. Inténtalo de nuevo.') } finally { setBusy(false) }
  }
  const sendCode = () => run(async () => {
    const result = await gameAccountsApi.sendCode(roleId.trim(), zoneId.trim())
    setPending(result.pending); setClaimedByOther(Boolean(result.claimedByOther)); setCode(''); setStep('code')
  })
  const verify = () => run(async () => {
    const result = await gameAccountsApi.verify(code.trim())
    setPending(result.pending); setStep('confirm')
  })
  const confirm = accept => run(async () => {
    const result = await gameAccountsApi.confirm(accept)
    if (!accept) { setPending(null); setCode(''); setStep('ids'); return }
    setPending(result.account); setStep('done')
    publish({ account: result.account, pending: null })
    onVerified?.(result.account)
  })

  // Portal al body: las tarjetas de Ajustes recortan/transforman a sus hijos
  // y una ventana fija dentro de ellas quedaba tapada por la tarjeta siguiente.
  return createPortal(
    <div className="gac-modal" role="presentation" onClick={() => { if (!busy) onClose() }}>
      <div className="gac-modal__panel" role="dialog" aria-modal="true" aria-labelledby="gac-title" onClick={e => e.stopPropagation()}>
        <header className="gac-modal__head">
          <img src={MLBB_LOGO} alt="" />
          <div>
            <span className="gac-modal__eyebrow">Paso {{ ids: 1, code: 2, confirm: 3, done: 3 }[step]} de 3</span>
            <h2 id="gac-title">Conectar Mobile Legends</h2>
          </div>
          <button type="button" className="gac-modal__close" onClick={onClose} disabled={busy} aria-label="Cerrar">×</button>
        </header>

        {step === 'ids' && (
          <form className="gac-step" onSubmit={e => { e.preventDefault(); sendCode() }}>
            <p>Escribe tu ID y servidor. Te enviaremos un código al <b>correo dentro del juego</b> para comprobar que la cuenta es tuya.</p>
            <div className="gac-ids">
              <label>ID de juego<input ref={firstInput} inputMode="numeric" autoComplete="off" placeholder="123456789" value={roleId} onChange={e => setRoleId(e.target.value.replace(/\D/g, '').slice(0, 12))} required /></label>
              <label>Servidor<input inputMode="numeric" autoComplete="off" placeholder="2045" value={zoneId} onChange={e => setZoneId(e.target.value.replace(/\D/g, '').slice(0, 6))} required /></label>
            </div>
            <details className="gac-help">
              <summary>¿Dónde veo mi ID y servidor?</summary>
              <p>Abre Mobile Legends y toca tu foto de perfil (arriba a la izquierda). Debajo de tu nombre sale <b>ID: 123456789 (2045)</b>. El primer número es tu ID; el que está entre paréntesis es el servidor.</p>
            </details>
            {error && <p className="gac-error" role="alert">{error}</p>}
            <button type="submit" className="gac-btn gac-btn--primary" disabled={busy || !roleId || !zoneId}>{busy ? 'Enviando…' : 'Enviar código al juego'}</button>
          </form>
        )}

        {step === 'code' && (
          <form className="gac-step" onSubmit={e => { e.preventDefault(); verify() }}>
            <ol className="gac-steps">
              <li>Abre <b>Mobile Legends</b> con la cuenta <b>{pending?.roleId} ({pending?.zoneId})</b>.</li>
              <li>Entra al <b>Correo</b> (el sobre del menú principal).</li>
              <li>Copia el código de 4 números del mensaje nuevo.</li>
            </ol>
            {claimedByOther && <p className="gac-note">Este ID ya está conectado a otro perfil de GlitchGang. Si el código llega a tu juego, la cuenta es tuya y pasará a tu perfil.</p>}
            <label className="gac-code">Código
              <input ref={firstInput} inputMode="numeric" autoComplete="one-time-code" placeholder="0000" value={code} onChange={e => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))} required />
            </label>
            <p className="gac-muted" aria-live="polite">{countdown && countdown.left > 0 ? `El código vence en ${countdown.label}.` : 'El código venció. Pide uno nuevo.'}</p>
            {error && <p className="gac-error" role="alert">{error}</p>}
            <div className="gac-actions">
              <button type="submit" className="gac-btn gac-btn--primary" disabled={busy || code.length < 4 || (countdown && countdown.left === 0)}>{busy ? 'Comprobando…' : 'Verificar'}</button>
              <button type="button" className="gac-btn gac-btn--ghost" disabled={busy} onClick={sendCode}>Reenviar código</button>
              <button type="button" className="gac-link" disabled={busy} onClick={() => { setError(''); setStep('ids') }}>Cambiar ID</button>
            </div>
          </form>
        )}

        {step === 'confirm' && pending && (
          <div className="gac-step">
            <AccountCard account={pending} />
            <p className="gac-question">¿Esta es tu cuenta?</p>
            {error && <p className="gac-error" role="alert">{error}</p>}
            <div className="gac-actions">
              <button type="button" ref={firstInput} className="gac-btn gac-btn--primary" disabled={busy} onClick={() => confirm(true)}>Sí, es mía</button>
              <button type="button" className="gac-btn gac-btn--ghost" disabled={busy} onClick={() => confirm(false)}>No, es otra</button>
            </div>
          </div>
        )}

        {step === 'done' && pending && (
          <div className="gac-step gac-step--done">
            <AccountCard account={pending} />
            <div className="gac-done" role="status">
              <span className="gac-done__icon" aria-hidden="true">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m5 12 4 4L19 6" /></svg>
              </span>
              <div className="gac-done__body">
                <strong>Cuenta verificada</strong>
                <p>Puedes cambiarte el nombre en el juego cuando quieras: te seguimos por tu ID.</p>
                <p className="gac-done__note">Durante un torneo activo no puedes cambiar ni desconectar la cuenta.</p>
              </div>
            </div>
            <div className="gac-actions">
              {returnTo
                ? <button type="button" ref={firstInput} className="gac-btn gac-btn--primary" onClick={() => { onClose(); navigate(returnTo) }}>{returnLabel}</button>
                : <button type="button" ref={firstInput} className="gac-btn gac-btn--primary" onClick={onClose}>Listo</button>}
            </div>
          </div>
        )}
      </div>
    </div>,
    document.body,
  )
}

/** Fila de Ajustes -> Conexiones. */
export default function GameAccountConnect() {
  const state = useMyGameAccount()
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  // ?volver=/ruta: vino desde crear equipo, inscripcion, etc. Al terminar se le
  // ofrece regresar alli para completar lo que estaba haciendo.
  const [params] = useSearchParams()
  const returnTo = safeReturnPath(params.get('volver'))
  const load = reloadMyGameAccount

  const disconnect = async () => {
    if (!window.confirm('¿Desconectar tu cuenta de Mobile Legends? Tendrás que verificarla de nuevo para inscribirte en torneos.')) return
    setBusy(true)
    try { await gameAccountsApi.disconnect(); toast('Cuenta de Mobile Legends desconectada', 'warn'); await load() } catch (e) { toast(e.message, 'error') } finally { setBusy(false) }
  }

  const { account, pending } = state
  const resumable = pending && (pending.status === 'pending_confirm' || (pending.codeExpiresAt && new Date(pending.codeExpiresAt) > new Date()))
  const subtitle = state.loading ? 'Cargando…'
    : account ? `${account.nickname || 'Sin nombre'} · ID ${account.roleId} (${account.zoneId})`
      : resumable ? 'Verificación a medias: continúa donde la dejaste'
        : 'No conectada'

  return (
    <div className="gset-connect gac-row">
      <span className="gset-connect__icon gac-row__icon"><img src={MLBB_LOGO} alt="" /></span>
      <div className="gset-connect__info">
        <b>Mobile Legends {account && <GameAccountBadge account={account} />}</b>
        <small>{subtitle}</small>
      </div>
      {account ? (
        <>
          <button className="gg-btn gg-btn--ghost gg-btn--sm" disabled={busy} onClick={() => setOpen(true)}>Cambiar</button>
          <button className="gg-btn gg-btn--ghost gg-btn--sm" disabled={busy} onClick={disconnect}>Desconectar</button>
        </>
      ) : (
        <button className="gg-btn gg-btn--primary gg-btn--sm" disabled={state.loading} onClick={() => setOpen(true)}>{resumable ? 'Continuar' : 'Conectar'}</button>
      )}
      {account && returnTo && (
        <Link className="gg-btn gg-btn--primary gg-btn--sm" to={returnTo}>← Volver a donde estaba</Link>
      )}
      {open && (
        <GameAccountModal
          initial={!account && resumable ? pending : null}
          returnTo={returnTo}
          onClose={() => { setOpen(false); load() }}
        />
      )}
    </div>
  )
}

/**
 * Bloque para formularios donde se escribe el Game ID de MLBB (mi ficha del
 * equipo, crear equipo): si la cuenta esta verificada ofrece usarla; si no,
 * abre la ventana de verificacion ahi mismo, sin salir de la pagina. Al
 * terminar llama onUse(account) para llenar ID y nick.
 */
export function GameIdVerify({ onUse, value = '' }) {
  const { loading, account, pending } = useMyGameAccount()
  const [open, setOpen] = useState(false)
  if (loading) return null
  const accountId = account ? `${account.roleId} (${account.zoneId})` : ''
  const resumable = !account && pending && (pending.status === 'pending_confirm' || (pending.codeExpiresAt && new Date(pending.codeExpiresAt) > new Date()))
  return (
    <div className={`gac-inline ${account ? 'gac-inline--ok' : ''}`}>
      <img src={MLBB_LOGO} alt="" />
      {account ? (
        <>
          <p><b>Cuenta verificada</b> · {account.nickname || 'Sin nombre'} · ID {accountId}</p>
          {onUse && value !== accountId && <button type="button" className="gac-btn gac-btn--primary" onClick={() => onUse(account)}>Usar mi cuenta verificada</button>}
        </>
      ) : (
        <>
          <p><b>Verifica tu cuenta de Mobile Legends</b> con un código que llega al correo del juego. Tu ID y tu nick se llenan solos.</p>
          <button type="button" className="gac-btn gac-btn--primary" onClick={() => setOpen(true)}>{resumable ? 'Continuar verificación' : 'Verificar con el juego'}</button>
        </>
      )}
      {open && (
        <GameAccountModal
          initial={resumable ? pending : null}
          returnLabel="Listo"
          onClose={() => setOpen(false)}
          onVerified={verified => onUse?.(verified)}
        />
      )}
    </div>
  )
}

const REMINDER_KEY = 'gg-mlbb-verify-later'
function remindLaterUntil() {
  try { return Number(localStorage.getItem(REMINDER_KEY)) || 0 } catch { return 0 }
}

/** ¿El usuario juega Mobile Legends? Por sus juegos, su tarjeta o un equipo. */
export function playsMobileLegends(user, isMlbb, teamGames = []) {
  const entries = Array.isArray(user?.gamerProfile?.pro?.entries) ? user.gamerProfile.pro.entries.map(e => e?.gameId) : []
  return [...(user?.games || []), user?.gamerProfile?.mainGame, user?.gamerProfile?.secondGame, ...entries, ...teamGames].some(g => g && isMlbb(g))
}

/**
 * Aviso para quien ya tiene cuenta en GlitchGang, juega Mobile Legends y no
 * ha verificado su ID. "Ahora" abre la ventana aqui mismo; "Más tarde" lo
 * esconde 3 dias en este navegador.
 */
export function GameAccountReminder({ show }) {
  const { loading, account, pending } = useMyGameAccount({ enabled: Boolean(show) })
  const [hiddenUntil, setHiddenUntil] = useState(remindLaterUntil)
  const [open, setOpen] = useState(false)
  if (!show || loading || account || hiddenUntil > Date.now()) return null
  const resumable = pending && (pending.status === 'pending_confirm' || (pending.codeExpiresAt && new Date(pending.codeExpiresAt) > new Date()))
  const later = () => {
    const until = Date.now() + 3 * 24 * 60 * 60 * 1000
    try { localStorage.setItem(REMINDER_KEY, String(until)) } catch { /* sin almacenamiento: se oculta solo en esta visita */ }
    setHiddenUntil(until)
  }
  return (
    <div className="gac-reminder" role="region" aria-label="Verificar cuenta de Mobile Legends">
      <img src={MLBB_LOGO} alt="" />
      <div>
        <b>Verifica tu cuenta de Mobile Legends</b>
        <p>Te mandamos un código al correo dentro del juego. Así tus partidas, estadísticas e inscripciones quedan a tu nombre.</p>
      </div>
      <div className="gac-reminder__actions">
        <button type="button" className="gac-btn gac-btn--primary" onClick={() => setOpen(true)}>{resumable ? 'Continuar' : 'Verificar ahora'}</button>
        <button type="button" className="gac-btn gac-btn--ghost" onClick={later}>Más tarde</button>
      </div>
      {open && <GameAccountModal initial={resumable ? pending : null} onClose={() => setOpen(false)} />}
    </div>
  )
}

