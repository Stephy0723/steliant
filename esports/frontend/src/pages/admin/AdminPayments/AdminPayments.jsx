import { useEffect, useMemo, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import StatCard from '../../../components/StatCard/StatCard.jsx'
import { Icon } from '../../../components/icons/Icons.jsx'
import { api } from '../../../lib/api.js'
import { buildInvoice, downloadInvoicePdf, money, COMPANY, DEFAULT_INSTRUCTIONS } from '../../../lib/invoiceDoc.js'
import { toast } from '../../../lib/toast.js'
import './AdminPayments.css'

const num = (s) => Number(String(s).replace(/[^0-9.]/g, '')) || 0
const STATUS_BADGE = {
  pagado: { label: 'Pagado', cls: 'ok' },
  reembolso: { label: 'Reembolso', cls: 'warn' },
  fallido: { label: 'Fallido', cls: 'bad' },
  pendiente: { label: 'Pendiente', cls: 'warn' },
}

export default function AdminPayments() {
  const [payments, setPayments] = useState([])
  const [loading, setLoading] = useState(true)
  const [invoice, setInvoice] = useState(null)
  const [filter, setFilter] = useState('Todos')

  const load = () => {
    setLoading(true)
    api('/admin/payments')
      .then(res => setPayments(Array.isArray(res.payments) ? res.payments : []))
      .catch(() => toast('No se pudo cargar el historial de pagos', 'error'))
      .finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [])

  // Solo cobros reales suman: un pago en modo demo nunca paso por PayPal.
  const paid = payments.filter(p => p.status === 'pagado' && p.mode !== 'demo')
  const totals = useMemo(() => {
    const revenue = paid.reduce((a, p) => a + num(p.amount), 0)
    const itbis = paid.reduce((a, p) => a + buildInvoice(p).itbis, 0)
    return { revenue, itbis, count: payments.length, invoices: paid.length }
  }, [payments]) // eslint-disable-line react-hooks/exhaustive-deps

  const shown = filter === 'Todos' ? payments : payments.filter(p => p.status === filter)

  const setStatus = async (payment, status) => {
    const prev = payments
    setPayments(list => list.map(p => p.id === payment.id ? { ...p, status } : p))
    try {
      await api(`/admin/payments/${payment.id}/status`, { method: 'PATCH', body: { status } })
    } catch (error) {
      setPayments(prev)
      toast(error.message || 'No se pudo actualizar el pago', 'error')
    }
  }

  return (
    <div className="gg-admin-page gg-pay">
      <div className="gg-admin-page__header">
        <div><h2>Pagos y facturación</h2><p>Cada pago emite recibo de cliente y factura fiscal de empresa</p></div>
      </div>

      <p className="gg-pay__note">{Icon.alert} Pagos reales (planes y entradas de torneo vía PayPal). Cambiar el estado corrige el registro para conciliación/soporte; no ejecuta un cobro ni un reembolso en PayPal. Los pagos en <b>modo demo</b> no suman a los ingresos.</p>

      <div className="gg-admin-kpis">
        <StatCard label="Ingresos (con ITBIS)" value={money(totals.revenue)} icon={Icon.star} />
        <StatCard label="ITBIS recaudado (18%)" value={money(totals.itbis)} icon={Icon.shield} />
        <StatCard label="Facturas emitidas" value={totals.invoices} icon={Icon.fileText} />
        <StatCard label="Transacciones" value={totals.count} icon={Icon.bolt} />
      </div>

      <div className="gg-admin-filter-tabs gg-pay__tabs">
        {['Todos', 'pagado', 'reembolso', 'fallido', 'pendiente'].map(s => (
          <button key={s} className={`gg-admin-filter-tab ${filter === s ? 'active' : ''}`} onClick={() => setFilter(s)}>{s === 'Todos' ? 'Todos' : STATUS_BADGE[s]?.label || s}</button>
        ))}
      </div>

      <div className="gg-admin-card" style={{ padding: 0 }}>
        <div className="gg-datatable-wrap">
          <table className="gg-datatable gg-pay__table">
            <thead>
              <tr><th>Factura</th><th>Cliente</th><th>Concepto</th><th>Subtotal</th><th>ITBIS</th><th>Total</th><th>Método</th><th>Fecha</th><th>Estado</th><th>Documentos</th></tr>
            </thead>
            <tbody>
              {loading && <tr><td colSpan={10} className="gg-datatable__empty">Cargando...</td></tr>}
              {!loading && shown.map((p, i) => {
                const inv = buildInvoice(p)
                return (
                  <motion.tr key={p.id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.02 }}>
                    <td><code className="gg-pay__num">{inv.number}</code><small className="gg-pay__ncf">{p.orderCode}{p.mode === 'demo' ? ' · demo' : ''}</small></td>
                    <td><b>{p.user}</b></td>
                    <td>{inv.items[0]?.desc}</td>
                    <td>{money(inv.subtotal)}</td>
                    <td className="gg-pay__itbis">{money(inv.itbis)}</td>
                    <td><b>{money(inv.total)}</b></td>
                    <td>{p.method}</td>
                    <td>{p.date}</td>
                    <td>
                      <select className="gg-admin-select" value={p.status} onChange={e => setStatus(p, e.target.value)}>
                        <option value="pagado">Pagado</option><option value="reembolso">Reembolso</option><option value="fallido">Fallido</option><option value="pendiente">Pendiente</option>
                      </select>
                    </td>
                    <td>
                      <button className="gg-pay__invbtn" onClick={() => setInvoice(p)} disabled={p.status !== 'pagado'} title={p.status !== 'pagado' ? 'Solo pagos completados' : 'Ver / editar factura'}>
                        {Icon.fileText} Factura
                      </button>
                    </td>
                  </motion.tr>
                )
              })}
              {!loading && shown.length === 0 && <tr><td colSpan={10} className="gg-datatable__empty">Sin transacciones con ese criterio.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      <AnimatePresence>
        {invoice && <InvoiceModal payment={invoice} onClose={() => setInvoice(null)} />}
      </AnimatePresence>
    </div>
  )
}

function InvoiceModal({ payment, onClose }) {
  const [copy, setCopy] = useState('cliente')
  const isCompany = copy === 'empresa'
  const base = buildInvoice(payment)
  // Estado editable (overrides)
  const [company, setCompany] = useState({ ...COMPANY })
  const [client, setClient] = useState({ ...base.client })
  const [meta, setMeta] = useState({ number: base.number, ncf: base.ncf, date: base.date, due: '' })
  const [items, setItems] = useState(base.items.map(it => ({ ...it })))
  const [instr, setInstr] = useState(DEFAULT_INSTRUCTIONS.join('\n'))
  const [notes, setNotes] = useState('')

  const inv = buildInvoice(payment, {
    company, client, ...meta,
    items, instructions: instr.split('\n').map(s => s.trim()).filter(Boolean), notes,
  })

  const setItem = (i, k, v) => setItems(arr => arr.map((it, idx) => idx === i ? { ...it, [k]: v } : it))
  const addItem = () => setItems(arr => [...arr, { desc: 'Nuevo concepto', qty: 1, price: 0 }])
  const delItem = (i) => setItems(arr => arr.filter((_, idx) => idx !== i))

  const download = async (type) => {
    try { await downloadInvoicePdf(inv, type); toast(`${type === 'empresa' ? 'Factura empresa' : 'Recibo cliente'} descargado`, 'success') }
    catch { toast('No se pudo generar el PDF', 'error') }
  }
  const downloadBoth = async () => { await download('cliente'); await download('empresa') }

  return (
    <motion.div className="gg-inv-ov" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose}>
      <motion.div className="gg-inv-modal" onClick={e => e.stopPropagation()}
        initial={{ y: 26, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 26, opacity: 0 }}>
        <div className="gg-inv-bar">
          <div className="gg-inv-switch">
            <button className={copy === 'cliente' ? 'on' : ''} onClick={() => setCopy('cliente')}>{Icon.user} Recibo cliente</button>
            <button className={copy === 'empresa' ? 'on' : ''} onClick={() => setCopy('empresa')}>{Icon.shield} Factura empresa</button>
          </div>
          <button className="gg-inv-x" onClick={onClose}>{Icon.x}</button>
        </div>

        <div className="gg-inv-cols">
          {/* ── Editor (datos superiores e inferiores) ── */}
          <div className="gg-inv-edit">
            <h4>{Icon.edit} Datos superiores</h4>
            <div className="gg-inv-grid2">
              <label>Empresa<input value={company.name} onChange={e => setCompany(c => ({ ...c, name: e.target.value }))} /></label>
              <label>RNC<input value={company.rnc} onChange={e => setCompany(c => ({ ...c, rnc: e.target.value }))} /></label>
            </div>
            <label>Dirección<input value={company.address} onChange={e => setCompany(c => ({ ...c, address: e.target.value }))} /></label>
            <div className="gg-inv-grid2">
              <label>Cliente<input value={client.name} onChange={e => setClient(c => ({ ...c, name: e.target.value }))} /></label>
              <label>Detalle cliente<input value={client.detail} onChange={e => setClient(c => ({ ...c, detail: e.target.value }))} /></label>
            </div>
            <div className="gg-inv-grid3">
              <label>Nº factura<input value={meta.number} onChange={e => setMeta(m => ({ ...m, number: e.target.value }))} /></label>
              <label>Fecha<input value={meta.date} onChange={e => setMeta(m => ({ ...m, date: e.target.value }))} /></label>
              <label>Vence<input value={meta.due} onChange={e => setMeta(m => ({ ...m, due: e.target.value }))} placeholder="opcional" /></label>
            </div>
            {isCompany && <label>NCF<input value={meta.ncf} onChange={e => setMeta(m => ({ ...m, ncf: e.target.value }))} /></label>}

            <h4>{Icon.list} Conceptos</h4>
            {items.map((it, i) => (
              <div key={i} className="gg-inv-item">
                <input className="desc" value={it.desc} onChange={e => setItem(i, 'desc', e.target.value)} placeholder="Descripción" />
                <input className="qty" type="number" value={it.qty} onChange={e => setItem(i, 'qty', Number(e.target.value))} />
                <input className="price" type="number" value={it.price} onChange={e => setItem(i, 'price', Number(e.target.value))} />
                <button onClick={() => delItem(i)} disabled={items.length === 1}>{Icon.trash}</button>
              </div>
            ))}
            <button className="gg-inv-additem" onClick={addItem}>{Icon.plus} Añadir concepto</button>

            <h4>{Icon.fileText} Datos inferiores</h4>
            <label>Instrucciones de pago (una por línea)<textarea rows={3} value={instr} onChange={e => setInstr(e.target.value)} /></label>
            <label>Notas<textarea rows={2} value={notes} onChange={e => setNotes(e.target.value)} placeholder="Nota opcional al pie" /></label>
          </div>

          {/* ── Vista previa: factura vertical tipo tarjeta ── */}
          <div className="gg-inv-previewwrap">
            <span className="gg-inv-previewlabel">Vista previa</span>
            <div className="gg-inv-paper">
              <div className="gg-inv-top">
                <div className="gg-inv-from">
                  <div className="gg-inv-logo">{Icon.bolt} STELIANT ESPORTS</div>
                  <b>{inv.company.name}</b>
                  <small>RNC: {inv.company.rnc}</small>
                  <small>{inv.company.address}</small>
                </div>
                <div className="gg-inv-title">
                  <h2>FACTURA</h2>
                  <span className="gg-inv-copy">{isCompany ? 'ORIGINAL — EMPRESA' : 'COPIA — CLIENTE'}</span>
                </div>
              </div>

              <div className="gg-inv-meta">
                <div><span>Facturar a</span><b>{inv.client.name}</b>{inv.client.detail && <small>{inv.client.detail}</small>}</div>
                <div className="r">
                  <p><span>Nº</span><b>{inv.number}</b></p>
                  <p><span>Fecha</span><b>{inv.date}</b></p>
                  {isCompany && <p><span>NCF</span><b>{inv.ncf}</b></p>}
                  {inv.due && <p><span>Vence</span><b>{inv.due}</b></p>}
                </div>
              </div>

              <table className="gg-inv-items">
                <thead><tr><th>Descripción</th><th>Cant</th><th>Precio</th><th>Importe</th></tr></thead>
                <tbody>
                  {inv.items.map((it, i) => (
                    <tr key={i}><td>{it.desc}</td><td>{it.qty}</td><td>{money(it.price)}</td><td>{money(it.qty * it.price)}</td></tr>
                  ))}
                </tbody>
              </table>

              <div className="gg-inv-totbox">
                {isCompany && <><p><span>Subtotal</span><b>{money(inv.subtotal)}</b></p><p><span>ITBIS (18%)</span><b>{money(inv.itbis)}</b></p></>}
                <p className="grand"><span>TOTAL</span><b>{money(inv.total)}</b></p>
              </div>

              <div className="gg-inv-pay">
                <span className="gg-inv-validated">{Icon.check} VALIDADO · <code>{inv.code}</code></span>
                <div className="gg-inv-instr">
                  <b>Instrucciones de pago</b>
                  {inv.instructions.map((l, i) => <small key={i}>{l}</small>)}
                  {inv.notes && <em>{inv.notes}</em>}
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="gg-inv-actions">
          <button className="gg-inv-btn ghost" onClick={() => download(copy)}>{Icon.download} Descargar {isCompany ? 'factura' : 'recibo'}</button>
          <button className="gg-inv-btn primary" onClick={downloadBoth}>{Icon.fileText} Descargar ambos PDF</button>
        </div>
      </motion.div>
    </motion.div>
  )
}

