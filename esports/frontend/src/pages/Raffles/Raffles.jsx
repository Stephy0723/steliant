import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import PageHeader from '../../components/PageHeader/PageHeader.jsx'
import { Icon } from '../../components/icons/Icons.jsx'
import { api } from '../../lib/api.js'
import { toast } from '../../lib/toast.js'
import './Raffles.css'

const fmtDate = (iso) => iso ? new Date(iso).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'

export default function Raffles() {
  const [raffles, setRaffles] = useState([])
  const [loading, setLoading] = useState(true)
  const [joining, setJoining] = useState(null)

  useEffect(() => {
    let alive = true
    api('/raffles')
      .then(res => { if (alive) setRaffles(res.raffles || []) })
      .catch(() => { if (alive) toast('No se pudieron cargar los sorteos.', 'error') })
      .finally(() => { if (alive) setLoading(false) })
    return () => { alive = false }
  }, [])

  const join = async (raffle) => {
    setJoining(raffle.id)
    try {
      const res = await api(`/raffles/${raffle.id}/join`, { method: 'POST' })
      setRaffles(list => list.map(r => r.id === raffle.id ? { ...r, joined: true, participants: res.participants } : r))
      toast('¡Estás participando!', 'success')
    } catch (err) {
      toast(err.message || 'No se pudo unir al sorteo', 'error')
    } finally {
      setJoining(null)
    }
  }

  const open = raffles.filter(r => r.status === 'active')
  const closed = raffles.filter(r => r.status !== 'active')

  return (
    <div className="gg-page gg-raffles">
      <PageHeader title="Sorteos" sub="Participa en los sorteos activos de GlitchGang. Un click y ya estás dentro." />

      {loading && <div className="gg-raffles__empty">Cargando…</div>}

      {!loading && open.length > 0 && (
        <div className="gg-raffles__grid">
          {open.map((r, i) => (
            <motion.article key={r.id} className="gg-raffles__card" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
              {r.coverImage
                ? <img className="gg-raffles__cover" src={r.coverImage} alt="" />
                : <div className="gg-raffles__cover gg-raffles__cover--ph">{Icon.gem}</div>}
              <div className="gg-raffles__body">
                <h3>{r.title}</h3>
                <p className="gg-raffles__prize">{Icon.gem} {r.prize}</p>
                {r.description && <p className="gg-raffles__desc">{r.description}</p>}
                <div className="gg-raffles__meta">
                  {r.closesAt && r.closesAt !== 'Sin fecha' && <span>{Icon.calendar} Cierra {r.closesAt}</span>}
                  <span>{Icon.users} {r.participants} participante{r.participants === 1 ? '' : 's'}</span>
                </div>
                <button
                  className={`gg-raffles__btn ${r.joined ? 'joined' : ''}`}
                  disabled={r.joined || joining === r.id}
                  onClick={() => join(r)}
                >
                  {r.joined ? <>{Icon.check} Ya participas</> : (joining === r.id ? 'Procesando…' : 'Participar')}
                </button>
              </div>
            </motion.article>
          ))}
        </div>
      )}

      {!loading && open.length === 0 && (
        <div className="gg-raffles__empty">No hay sorteos abiertos en este momento. Vuelve pronto.</div>
      )}

      {!loading && closed.length > 0 && (
        <>
          <div className="gg-raffles__section-head"><h3>Sorteos anteriores</h3></div>
          <div className="gg-raffles__past">
            {closed.map(r => (
              <div key={r.id} className="gg-raffles__past-row">
                <span className="gg-raffles__past-title">{r.title}</span>
                <span className="gg-raffles__past-prize">{r.prize}</span>
                {r.winner
                  ? <span className="gg-raffles__past-winner">{Icon.award} {r.winner.nick}</span>
                  : <span className="gg-raffles__past-winner gg-raffles__past-winner--pending">Sin sortear</span>}
                <span className="gg-raffles__past-date">{fmtDate(r.drawnAt || r.createdAt)}</span>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}

