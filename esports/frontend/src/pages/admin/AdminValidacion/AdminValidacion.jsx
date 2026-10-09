import { useMemo, useEffect, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Html5Qrcode } from 'html5-qrcode'
import { Icon } from '../../../components/icons/Icons.jsx'
import { api } from '../../../lib/api.js'
import { money } from '../../../lib/invoiceDoc.js'
import { toast } from '../../../lib/toast.js'
import './AdminValidacion.css'

const nowTime = () => new Date().toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
const nowDate = () => new Date().toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' })

// Cada codigo se verifica en el servidor (GET /admin/validate): comprobantes
// de pago reales (Order), facturas de marca, jugadores, equipos, torneos,
// universidades y comunidades. Antes se validaba contra datos de ejemplo y un
// checksum que cualquiera podia calcular en el navegador.
function labelOf(r) {
  const d = r.detail || {}
  if (r.kind === 'player') return d.nick
  if (r.kind === 'ticket') return d.tournament || d.concept
  if (r.kind === 'invoice') return `${d.concept || 'Factura'} · ${d.buyer || ''}`
  if (r.kind === 'team' || r.kind === 'tournament' || r.kind === 'university' || r.kind === 'community') return d.name
  return 'Desconocido'
}

export default function AdminValidacion() {
  const [payments, setPayments] = useState([])
  const [input, setInput] = useState('')
  const [result, setResult] = useState(null)
  const [checking, setChecking] = useState(false)
  const [scanning, setScanning] = useState(false)
  const [history, setHistory] = useState([])
  const [histQ, setHistQ] = useState('')
  const [invQ, setInvQ] = useState('')
  const qrRef = useRef(null)

  useEffect(() => {
    api('/admin/payments')
      .then(res => setPayments(Array.isArray(res.payments) ? res.payments : []))
      .catch(() => toast('No se pudo cargar los pagos emitidos', 'error'))
  }, [])

  const register = async (raw) => {
    const code = String(raw || '').trim()
    if (!code) return
    setChecking(true)
    try {
      const r = await api(`/admin/validate?code=${encodeURIComponent(code)}`)
      setResult(r)
      setHistory(h => [{ id: Date.now(), at: nowTime(), date: nowDate(), valid: r.valid, kind: r.kind, code: r.code, label: labelOf(r) }, ...h].slice(0, 50))
    } catch (err) {
      toast(err.message || 'No se pudo validar el código', 'error')
    } finally {
      setChecking(false)
    }
  }

  const submit = (e) => { e?.preventDefault(); if (input.trim()) register(input) }
  const validatePayment = (p) => { setInput(p.orderCode); register(p.orderCode) }

  const handleDecoded = (decoded) => { setInput(decoded); register(decoded); setScanning(false); toast('Código capturado', 'success') }

  useEffect(() => {
    if (!scanning) return
    let stopped = false
    const qr = new Html5Qrcode('gg-qr-reader'); qrRef.current = qr
    qr.start({ facingMode: 'environment' }, { fps: 10, qrbox: { width: 230, height: 230 } },
      (d) => { if (!stopped) { stopped = true; handleDecoded(d) } }, () => {})
      .catch(() => { toast('No se pudo abrir la cámara. Revisa los permisos.', 'error'); setScanning(false) })
    return () => { stopped = true; qr.stop().then(() => qr.clear()).catch(() => {}) }
  }, [scanning]) // eslint-disable-line react-hooks/exhaustive-deps

  const stats = { total: history.length, ok: history.filter(h => h.valid).length, bad: history.filter(h => !h.valid).length }

  const invoices = useMemo(() => payments
    .filter(p => !invQ || [p.user, p.orderCode, p.concept, p.date, String(p.amount)].some(v => String(v).toLowerCase().includes(invQ.toLowerCase()))),
    [payments, invQ])

  const histShown = history.filter(h => !histQ || [h.label, h.code, h.date].some(v => String(v).toLowerCase().includes(histQ.toLowerCase())))

  return (
    <div className="gg-admin-page gg-valid">
      <div className="gg-admin-page__header">
        <div>
          <h2>Validar pagos, facturas y tickets</h2>
          <p>Verifica facturas emitidas por la web, tickets de torneos/eventos e IDs de jugador, equipo o universidad.</p>
        </div>
        <div className="gg-valid__kpis">
          <div className="gg-valid__kpi"><b>{stats.total}</b><span>Validaciones</span></div>
          <div className="gg-valid__kpi ok"><b>{stats.ok}</b><span>Válidos</span></div>
          <div className="gg-valid__kpi bad"><b>{stats.bad}</b><span>Rechazados</span></div>
        </div>
      </div>

      <div className="gg-valid__grid">
        {/* Escáner */}
        <div className="gg-valid__scan-card">
          <div className="gg-valid__scan-head">
            <span className="gg-valid__logo">{Icon.bolt}</span>
            <div><b>STELIANT ESPORTS</b><small>Verificación oficial</small></div>
            <span className="gg-valid__secure">{Icon.shield} Seguro</span>
          </div>
          <div className={`gg-valid__viewport ${scanning ? 'live' : ''}`}>
            {scanning ? (
              <><div id="gg-qr-reader" className="gg-valid__reader" /><div className="gg-valid__frame"><i /><i /><i /><i /><span className="gg-valid__laser" /></div></>
            ) : (
              <div className="gg-valid__viewport-idle"><span className="gg-valid__qr-icon">{Icon.camera}</span><p>Pulsa <b>Escanear QR</b> o escribe el código abajo</p></div>
            )}
          </div>
          <form className="gg-valid__form" onSubmit={submit}>
            <div className="gg-valid__inputwrap">
              <span className="gg-valid__inputicon">{Icon.search}</span>
              <input value={input} onChange={e => setInput(e.target.value)} placeholder="Comprobante (ord_…), ID de jugador, equipo, torneo o universidad" autoFocus />
              {input && <button type="button" className="gg-valid__clear" onClick={() => setInput('')}>{Icon.x}</button>}
            </div>
            <div className="gg-valid__buttons">
              <button type="submit" className="gg-valid__btn primary" disabled={checking}>{Icon.check} {checking ? 'Validando…' : 'Validar'}</button>
              <button type="button" className={`gg-valid__btn ${scanning ? 'danger' : 'ghost'}`} onClick={() => setScanning(s => !s)}>{Icon.camera} {scanning ? 'Cerrar cámara' : 'Escanear QR'}</button>
            </div>
          </form>
          <p className="gg-valid__foot">{Icon.lock} Cada código se verifica contra la base de datos de GlitchGang en el servidor.</p>
        </div>

        {/* Resultado */}
        <div className="gg-valid__side">
          <AnimatePresence mode="wait">
            {!result ? (
              <motion.div key="empty" className="gg-valid__result-card empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                <span className="gg-valid__empty-icon">{Icon.fileText}</span>
                <h3>Esperando código</h3>
                <p>Valida una factura emitida abajo o escanea un código.</p>
              </motion.div>
            ) : (
              <motion.div key={result.code + history.length} className={`gg-valid__result-card ${result.valid ? 'ok' : 'bad'}`}
                initial={{ opacity: 0, y: 14, scale: .98 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0 }} transition={{ type: 'spring', stiffness: 260, damping: 24 }}>
                <div className="gg-valid__stamp">{result.valid ? 'VÁLIDO' : 'NO VÁLIDO'}</div>
                <div className="gg-valid__result-head">
                  <div className="gg-valid__badge">{result.valid ? Icon.check : Icon.x}</div>
                  <div><h3>{resultTitle(result)}</h3><p className="gg-valid__reason">{result.reason}</p></div>
                </div>
                <span className="gg-valid__kindtag">{kindLabel(result.kind)}</span>
                {result.kind === 'player' ? <PlayerDetails r={result} /> : <ResultDetails r={result} />}
                <button className="gg-valid__btn ghost full" onClick={() => { setResult(null); setInput('') }}>Validar otro</button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Facturas y pagos emitidos por la web */}
      <div className="gg-valid__panelblock">
        <div className="gg-valid__block-head">
          <h3>{Icon.creditCard} Facturas y pagos emitidos</h3>
          <div className="gg-admin-search">
            <span className="gg-admin-search__icon">{Icon.search}</span>
            <input value={invQ} onChange={e => setInvQ(e.target.value)} placeholder="Buscar nº, cliente, fecha o monto…" />
            {invQ && <button className="gg-admin-search__clear" onClick={() => setInvQ('')}>{Icon.x}</button>}
          </div>
        </div>
        <div className="gg-valid__inv-wrap">
          <table className="gg-valid__inv-table">
            <thead><tr><th>Comprobante</th><th>Cliente</th><th>Concepto</th><th>Total</th><th>Fecha</th><th>Estado</th><th></th></tr></thead>
            <tbody>
              {invoices.map(p => (
                <tr key={p.id}>
                  <td><code>{p.orderCode}</code>{p.mode === 'demo' && <small>modo demo</small>}</td>
                  <td>{p.user}</td>
                  <td>{p.concept}</td>
                  <td><b>{money(p.amount)}</b></td>
                  <td>{p.date}</td>
                  <td><span className={`gg-valid__pst ${p.status}`}>{p.status}</span></td>
                  <td><button className="gg-valid__vbtn" onClick={() => validatePayment(p)}>{Icon.check} Validar</button></td>
                </tr>
              ))}
              {invoices.length === 0 && <tr><td colSpan={7} className="gg-valid__inv-empty">Sin facturas con ese criterio.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      {/* Historial con buscador */}
      {history.length > 0 && (
        <div className="gg-valid__panelblock">
          <div className="gg-valid__block-head">
            <h3>{Icon.clock} Historial de validaciones (esta sesión)</h3>
            <div className="gg-admin-search">
              <span className="gg-admin-search__icon">{Icon.search}</span>
              <input value={histQ} onChange={e => setHistQ(e.target.value)} placeholder="Buscar en el historial…" />
              {histQ && <button className="gg-admin-search__clear" onClick={() => setHistQ('')}>{Icon.x}</button>}
            </div>
            <button className="gg-valid__clearhist" onClick={() => setHistory([])}>Limpiar</button>
          </div>
          <table className="gg-valid__inv-table">
            <thead><tr><th>Resultado</th><th>Tipo</th><th>Detalle</th><th>Código</th><th>Fecha</th><th>Hora</th></tr></thead>
            <tbody>
              {histShown.map(h => (
                <tr key={h.id} className={h.valid ? 'ok' : 'bad'}>
                  <td><span className={`gg-valid__hres ${h.valid ? 'ok' : 'bad'}`}>{h.valid ? Icon.check : Icon.x} {h.valid ? 'Válido' : 'Rechazado'}</span></td>
                  <td>{kindLabel(h.kind)}</td>
                  <td>{h.label}</td>
                  <td><code>{h.code}</code></td>
                  <td>{h.date}</td>
                  <td>{h.at}</td>
                </tr>
              ))}
              {histShown.length === 0 && <tr><td colSpan={6} className="gg-valid__inv-empty">Sin coincidencias en el historial.</td></tr>}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

const KIND = {
  ticket: ['Ticket de torneo', 'Ticket auténtico', 'Ticket no válido'],
  invoice: ['Comprobante / factura', 'Comprobante auténtico', 'Comprobante no válido'],
  player: ['ID de jugador', 'Identidad verificada', 'Cuenta no habilitada'],
  team: ['ID de equipo', 'Equipo verificado', 'Equipo dado de baja'],
  tournament: ['ID de torneo', 'Torneo verificado', 'Torneo no válido'],
  university: ['ID universitario', 'Vínculo universitario verificado', 'Vínculo no válido'],
  community: ['ID de comunidad', 'Comunidad verificada', 'Comunidad archivada'],
  unknown: ['Sin coincidencia', 'Código no reconocido', 'Código no reconocido'],
}

function resultTitle(r) {
  const k = KIND[r.kind] || KIND.unknown
  return r.valid ? k[1] : k[2]
}
function kindLabel(kind) {
  return (KIND[kind] || KIND.unknown)[0]
}

const DETAIL_LABELS = {
  concept: 'Concepto', amount: 'Monto', status: 'Estado', mode: 'Modo', date: 'Fecha', buyer: 'Cliente',
  buyerId: 'ID cliente', tournament: 'Torneo', tournamentId: 'ID torneo', name: 'Nombre', tag: 'Tag',
  game: 'Juego', publicId: 'ID público', members: 'Miembros', created: 'Registro', slots: 'Cupos',
  siglas: 'Siglas', student: 'Estudiante', studentId: 'ID estudiante', regDate: 'Registro',
}

function ResultDetails({ r }) {
  const d = r.detail || {}
  const rows = Object.entries(d).filter(([k, v]) => DETAIL_LABELS[k] && v !== null && v !== '' && v !== undefined)
  return (
    <div className="gg-valid__details">
      {rows.map(([k, v]) => (
        <div key={k}><span>{DETAIL_LABELS[k]}</span><b>{k === 'amount' ? `${money(v)}${d.currency && d.currency !== 'USD' ? ` ${d.currency}` : ''}` : (k === 'mode' ? (v === 'demo' ? 'Demo (sin cobro real)' : 'Real') : String(v))}</b></div>
      ))}
      <div><span>Código</span><b className="mono">{r.code}</b></div>
    </div>
  )
}

function PlayerDetails({ r }) {
  const p = r.detail || {}
  return (
    <div className="gg-valid__player">
      {p.avatar ? <img src={p.avatar} alt={p.nick} /> : <span className="gg-valid__badge">{Icon.user}</span>}
      <div className="gg-valid__details" style={{ flex: 1 }}>
        <div><span>Jugador</span><b>{p.nick}{p.verified && <i className="gg-valid__verif">{Icon.check}</i>}</b></div>
        <div><span>País</span><b>{p.country || '—'}</b></div>
        <div><span>ID público</span><b className="mono">{p.publicId}</b></div>
        <div><span>ID extenso</span><b className="mono">{p.internalId}</b></div>
        {p.team && <div><span>Equipo</span><b>{p.team}{p.teamId ? ` · ${p.teamId}` : ''}</b></div>}
        <div><span>Registro</span><b>{p.joined}</b></div>
      </div>
    </div>
  )
}

