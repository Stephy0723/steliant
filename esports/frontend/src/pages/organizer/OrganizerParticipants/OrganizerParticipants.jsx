import { useState } from 'react'
import { motion } from 'framer-motion'
import { Icon } from '../../../components/icons/Icons.jsx'
import './OrganizerParticipants.css'

const MOCK_PARTICIPANTS = [
  { id: 1, team: 'Glitch Core', players: ['Player1', 'Player2', 'Player3'], event: 'GG Spring Split', status: 'paid', registeredDate: '2026-06-01', fee: 100 },
  { id: 2, team: 'Nova Esports', players: ['Nova1', 'Nova2', 'Nova3'], event: 'GG Spring Split', status: 'paid', registeredDate: '2026-06-02', fee: 100 },
  { id: 3, team: 'Royal Guard', players: ['Royal1', 'Royal2', 'Royal3'], event: 'Copa Pro 2026', status: 'pending', registeredDate: '2026-06-03', fee: 90 },
  { id: 4, team: 'Dark Phoenix', players: ['Dark1', 'Dark2', 'Dark3'], event: 'GG Spring Split', status: 'refunded', registeredDate: '2026-05-20', fee: 100 },
]

function OrganizerParticipants() {
  const [participants] = useState(MOCK_PARTICIPANTS)
  const [searchTerm, setSearchTerm] = useState('')
  const [filterStatus, setFilterStatus] = useState('all')
  const [filterEvent, setFilterEvent] = useState('all')

  const filteredParticipants = participants.filter(p => {
    const matchesSearch = p.team.toLowerCase().includes(searchTerm.toLowerCase())
    const matchesStatus = filterStatus === 'all' || p.status === filterStatus
    const matchesEvent = filterEvent === 'all' || p.event === filterEvent
    return matchesSearch && matchesStatus && matchesEvent
  })

  const totalFees = filteredParticipants.reduce((sum, p) => sum + p.fee, 0)
  const paidCount = filteredParticipants.filter(p => p.status === 'paid').length
  const pendingCount = filteredParticipants.filter(p => p.status === 'pending').length

  return (
    <div className="org-participants">
      <motion.div className="org-participants__header" initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }}>
        <div>
          <h1>Participantes</h1>
          <p>Gestiona inscritos y pagos</p>
        </div>
      </motion.div>

      <motion.div className="org-participants__stats" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
        <div className="org-stat-card">
          <div className="org-stat-card__icon">{Icon.users}</div>
          <div className="org-stat-card__content">
            <div className="org-stat-card__label">Total Inscritos</div>
            <div className="org-stat-card__value">{filteredParticipants.length}</div>
          </div>
        </div>
        <div className="org-stat-card">
          <div className="org-stat-card__icon" style={{ color: '#22c55e' }}>{Icon.creditCard}</div>
          <div className="org-stat-card__content">
            <div className="org-stat-card__label">Pagados</div>
            <div className="org-stat-card__value">{paidCount}</div>
          </div>
        </div>
        <div className="org-stat-card">
          <div className="org-stat-card__icon" style={{ color: '#f59e0b' }}>{Icon.clock}</div>
          <div className="org-stat-card__content">
            <div className="org-stat-card__label">Pendientes</div>
            <div className="org-stat-card__value">{pendingCount}</div>
          </div>
        </div>
        <div className="org-stat-card">
          <div className="org-stat-card__icon" style={{ color: '#3b82f6' }}>{Icon.creditCard}</div>
          <div className="org-stat-card__content">
            <div className="org-stat-card__label">Ingresos Totales</div>
            <div className="org-stat-card__value">${totalFees.toLocaleString()}</div>
          </div>
        </div>
      </motion.div>

      <motion.div className="org-participants__controls" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
        <div className="org-participants__search">
          <span className="org-icon">{Icon.search}</span>
          <input type="text" placeholder="Buscar equipo..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
        </div>
        <div className="org-participants__filters">
          <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} className="org-select">
            <option value="all">Todos</option>
            <option value="paid">Pagados</option>
            <option value="pending">Pendientes</option>
            <option value="refunded">Reembolsados</option>
          </select>
          <select value={filterEvent} onChange={(e) => setFilterEvent(e.target.value)} className="org-select">
            <option value="all">Todos los eventos</option>
            <option value="GG Spring Split">GG Spring Split</option>
            <option value="Copa Pro 2026">Copa Pro 2026</option>
          </select>
        </div>
      </motion.div>

      <motion.div className="org-participants__table" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
        <table>
          <thead>
            <tr>
              <th>Equipo</th>
              <th>Evento</th>
              <th>Jugadores</th>
              <th>Fecha Inscripción</th>
              <th>Cuota</th>
              <th>Estado</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {filteredParticipants.map(p => (
              <tr key={p.id}>
                <td className="org-team-name"><strong>{p.team}</strong></td>
                <td>{p.event}</td>
                <td><span className="org-players">{p.players.length} jugadores</span></td>
                <td>{p.registeredDate}</td>
                <td><strong>${p.fee}</strong></td>
                <td>
                  <span className={`org-badge org-badge--${p.status}`}>
                    {p.status === 'paid' && 'Pagado'}
                    {p.status === 'pending' && 'Pendiente'}
                    {p.status === 'refunded' && 'Reembolsado'}
                  </span>
                </td>
                <td>
                  <button className="org-icon-btn">{Icon.moreVertical}</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </motion.div>
    </div>
  )
}

export { OrganizerParticipants }
export default OrganizerParticipants

