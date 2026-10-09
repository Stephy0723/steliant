import { useEffect, useMemo, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Icon } from '../../../components/icons/Icons.jsx'
import { useAdmin } from '../../../context/AdminContext.jsx'
import { api } from '../../../lib/api.js'
import { toast } from '../../../lib/toast.js'
import './AdminControlPanels.css'

const EMPTY_FORM = {
  title: '',
  type: 'Comunidad',
  prize: '',
  closesAt: '',
  description: '',
}

function statusText(status) {
  if (status === 'active') return 'Abierto'
  if (status === 'scheduled') return 'Programado'
  if (status === 'closed') return 'Cerrado'
  return 'Borrador'
}

export default function AdminRaffles() {
  const { summary } = useAdmin()
  const [raffles, setRaffles] = useState([])
  const [loading, setLoading] = useState(true)
  const [form, setForm] = useState(EMPTY_FORM)
  const [filter, setFilter] = useState('all')
  const [busy, setBusy] = useState(null)
  const [detail, setDetail] = useState(null)

  const load = () => {
    setLoading(true)
    api('/admin/raffles')
      .then(res => setRaffles(Array.isArray(res.raffles) ? res.raffles : []))
      .catch(() => toast('No se pudo cargar los sorteos', 'error'))
      .finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [])

  const shown = useMemo(() => raffles.filter(item => filter === 'all' || item.status === filter), [raffles, filter])
  const active = raffles.filter(item => item.status === 'active').length
  const drawn = raffles.filter(item => item.winner).length
  const participants = raffles.reduce((sum, item) => sum + Number(item.participants || 0), 0)

  const replace = (raffle) => {
    setRaffles(list => list.map(item => item.id === raffle.id ? raffle : item))
    setDetail(current => current?.id === raffle.id ? raffle : current)
  }

  const set = (key, value) => setForm(prev => ({ ...prev, [key]: value }))
  const create = async (event) => {
    event.preventDefault()
    if (!form.title.trim() || !form.prize.trim()) return
    setBusy('new')
    try {
      const res = await api('/admin/raffles', {
        method: 'POST',
        body: { title: form.title.trim(), type: form.type, prize: form.prize.trim(), closesAt: form.closesAt, description: form.description.trim() },
      })
      setRaffles(prev => [res.raffle, ...prev])
      setForm(EMPTY_FORM)
      toast('Borrador creado. Actívalo para que la comunidad pueda participar.', 'success')
    } catch (error) {
      toast(error.message || 'No se pudo crear el sorteo', 'error')
    } finally {
      setBusy(null)
    }
  }

  const setStatus = async (raffle, status) => {
    setBusy(raffle.id)
    try {
      const res = await api(`/admin/raffles/${raffle.id}`, { method: 'PATCH', body: { status } })
      replace(res.raffle)
    } catch (error) {
      toast(error.message || 'No se pudo actualizar el sorteo', 'error')
    } finally {
      setBusy(null)
    }
  }

  const draw = async (raffle) => {
    if (!window.confirm(`¿Sortear "${raffle.title}" entre ${raffle.participants} participante${raffle.participants === 1 ? '' : 's'}? El sorteo se cierra y se avisa al ganador.`)) return
    setBusy(raffle.id)
    try {
      const res = await api(`/admin/raffles/${raffle.id}/draw`, { method: 'POST' })
      replace(res.raffle)
      toast(`Ganador: ${res.raffle.winner?.nick}`, 'success')
    } catch (error) {
      toast(error.message || 'No se pudo sortear', 'error')
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className="gg-admin-page gg-admin-control">
      <div className="gg-admin-page__header">
        <div>
          <h2>Sorteos & Eventos</h2>
          <p>Crea sorteos, ábrelos a la comunidad en /sorteos y sortea el ganador entre los participantes reales.</p>
        </div>
      </div>

      <section className="gg-admin-control__hero">
        <div>
          <span className="gg-admin-control__eyebrow">{Icon.gem} Activaciones</span>
          <h3>Panel de sorteos</h3>
          <p>Borrador → Abierto (cualquier cuenta logueada participa una vez desde /sorteos) → Sortear (el servidor elige al azar entre los inscritos, cierra el sorteo y avisa al ganador por notificación y correo).</p>
        </div>
        <div className="gg-admin-control__attention">
          <b>{summary?.totals?.requiresAttention || 0}</b>
          <span>items admin pendientes</span>
        </div>
      </section>

      <section className="gg-admin-control__metrics">
        <div><span>Total sorteos</span><b>{raffles.length}</b></div>
        <div><span>Abiertos</span><b>{active}</b></div>
        <div><span>Sorteados</span><b>{drawn}</b></div>
        <div><span>Participaciones</span><b>{participants}</b></div>
      </section>

      <section className="gg-admin-control__split">
        <form className="gg-admin-control__form" onSubmit={create}>
          <h3>{Icon.plus} Nuevo sorteo</h3>
          <label>Titulo<input value={form.title} onChange={event => set('title', event.target.value)} placeholder="Nombre del sorteo" /></label>
          <label>Tipo
            <select value={form.type} onChange={event => set('type', event.target.value)}>
              <option>Comunidad</option>
              <option>Evento</option>
              <option>Torneo</option>
              <option>Marca</option>
            </select>
          </label>
          <label>Premio<input value={form.prize} onChange={event => set('prize', event.target.value)} placeholder="Ej. pase Pro 1 mes, skin..." /></label>
          <label>Descripción<input value={form.description} onChange={event => set('description', event.target.value)} placeholder="Requisitos o detalle (se ve en /sorteos)" /></label>
          <label>Cierre<input value={form.closesAt} onChange={event => set('closesAt', event.target.value)} placeholder="Ej. 05 oct 2026" /></label>
          <button className="gg-btn gg-btn--primary gg-btn--sm" disabled={busy === 'new'}>{Icon.check} Crear borrador</button>
        </form>

        <div className="gg-admin-control__table">
          <div className="gg-admin-control__table-head">
            <h3>{Icon.gem} Sorteos</h3>
            <select value={filter} onChange={event => setFilter(event.target.value)}>
              <option value="all">Todos</option>
              <option value="draft">Borradores</option>
              <option value="scheduled">Programados</option>
              <option value="active">Abiertos</option>
              <option value="closed">Cerrados</option>
            </select>
          </div>
          <div className="gg-admin-control__rows">
            {loading && <p className="gg-admin-dim" style={{ padding: '12px' }}>Cargando...</p>}
            {!loading && shown.length === 0 && <p className="gg-admin-dim" style={{ padding: '12px' }}>Sin sorteos con ese filtro.</p>}
            {!loading && shown.map(item => (
              <motion.article key={item.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
                <span className="gg-admin-control__icon">{Icon.gem}</span>
                <div>
                  <b>{item.title}</b>
                  <span>{item.type} · Cierra {item.closesAt} · {item.participants} participante{item.participants === 1 ? '' : 's'}{item.winner ? ` · Ganador: ${item.winner.nick}` : ''}</span>
                </div>
                <strong>{item.prize}</strong>
                <em>{statusText(item.status)}</em>
                <div className="gg-admin-staff__actions">
                  <button type="button" className="gg-admin-raffle__btn" onClick={() => setDetail(item)}>Participantes</button>
                  {!item.winner && item.status !== 'active' && (
                    <button type="button" className="gg-admin-raffle__btn" disabled={busy === item.id} onClick={() => setStatus(item, 'active')}>Abrir</button>
                  )}
                  {!item.winner && item.status === 'active' && (
                    <button type="button" className="gg-admin-raffle__btn" disabled={busy === item.id} onClick={() => setStatus(item, 'closed')}>Cerrar</button>
                  )}
                  {!item.winner && item.participants > 0 && (
                    <button type="button" className="gg-admin-raffle__btn gg-admin-raffle__btn--primary" disabled={busy === item.id} onClick={() => draw(item)}>Sortear</button>
                  )}
                </div>
              </motion.article>
            ))}
          </div>
        </div>
      </section>

      <AnimatePresence>
        {detail && (
          <motion.div className="gg-ned-ov" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setDetail(null)}>
            <motion.div className="gg-ned gg-ned--sm" onClick={e => e.stopPropagation()} initial={{ y: 24, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 24, opacity: 0 }}>
              <div className="gg-ned__head"><h3>{detail.title} · {detail.participants} participantes</h3><button onClick={() => setDetail(null)}>{Icon.x}</button></div>
              <div className="gg-ned__form">
                {detail.winner && <p><b>Ganador:</b> {detail.winner.nick} ({detail.winner.publicId}) · {detail.drawnAt ? new Date(detail.drawnAt).toLocaleString('es-DO') : ''}</p>}
                {(detail.entrants || []).length === 0
                  ? <p className="gg-admin-dim">Nadie se ha inscrito todavía.</p>
                  : (
                    <div className="gg-admin-raffle__entrants">
                      {detail.entrants.map(e => (
                        <div key={e.id}><b>{e.nick}</b><span>{e.publicId}</span><span>{new Date(e.joinedAt).toLocaleString('es-DO')}</span></div>
                      ))}
                    </div>
                  )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

