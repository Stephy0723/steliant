import { useEffect, useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import { Icon } from '../../../components/icons/Icons.jsx'
import { useActiveCommunity } from '../../../hooks/useActiveCommunity.js'
import { api } from '../../../lib/api.js'
const ROLE_LABEL = { 'Dueño': 'Dueño', Admin: 'Admin', Moderador: 'Moderador', Editor: 'Editor', Caster: 'Caster', Diseñador: 'Diseñador', 'Community Manager': 'Community Manager' }
import { toast } from '../../../lib/toast.js'
import '../CommunityPanelDashboard/CommunityPanel.css'

const FILTERS = [
  { key: 'all', label: 'Todos' },
  { key: 'staff', label: 'Staff' },
  // Sin "En línea": estos miembros son nombres de la configuración de la
  // comunidad (sin cuenta vinculada), no hay presencia real que filtrar.
]

export default function CommunityMembers() {
  const { community, reload } = useActiveCommunity()
  const [members, setMembers] = useState([])
  const [filter, setFilter] = useState('all')
  const [query, setQuery] = useState('')

  useEffect(() => {
    if (!community) {
      setMembers([])
      return
    }
    // En el backend se llama `staff` (el formulario lo manda como `team`).
    const staffList = Array.isArray(community.staff) && community.staff.length ? community.staff : community.team
    const staff = Array.isArray(staffList) ? staffList : []
    // Sin cifras inventadas: antes el primero tenía "3 posts" y los dos
    // primeros salían "en línea" siempre.
    setMembers(staff.map((member, index) => ({
      id: member.id || member._id || `${community.id}-staff-${index}`,
      nick: String(member.username || `staff-${index + 1}`).replace(/^@/, ''),
      avatar: '/demos/steliant-esports/avatar-default.svg',
      role: member.role || 'Moderador',
      joined: community.createdAt ? new Date(community.createdAt).toLocaleDateString('es-ES') : '—',
      posts: 0,
      online: false,
    })))
  }, [community])

  const filtered = useMemo(() => {
    let list = members
    if (filter === 'staff') list = list.filter(m => ['Dueño', 'Admin', 'Moderador', 'Editor', 'Community Manager', 'Caster', 'Diseñador'].includes(m.role))
    if (filter === 'online') list = list.filter(m => m.online)
    const q = query.trim().toLowerCase()
    if (q) list = list.filter(m => m.nick.toLowerCase().includes(q))
    return list
  }, [members, filter, query])

  // Devuelve true solo si el servidor guardó; si falla se vuelve a la lista previa.
  const syncTeam = async (nextMembers) => {
    if (!community) return false
    const previous = members
    setMembers(nextMembers)
    try {
      // El backend solo tiene PUT /communities/:id (no PATCH) -- con PATCH
      // esto siempre devolvia 404 y el staff nunca se sincronizaba de verdad.
      await api(`/communities/${encodeURIComponent(community.id)}`, {
        method: 'PUT',
        body: { team: nextMembers.map(member => ({ role: member.role, username: member.nick })) },
      })
      reload()
      return true
    } catch (err) {
      setMembers(previous)
      toast(err?.message || 'No se pudo guardar el staff.', 'error')
      return false
    }
  }

  const promote = async (m) => {
    const next = members.map(x => x.id === m.id ? { ...x, role: 'Moderador' } : x)
    if (await syncTeam(next)) toast(`${m.nick} ahora es Moderador`, 'success')
  }

  const remove = async (m) => {
    const next = members.filter(x => x.id !== m.id)
    if (await syncTeam(next)) toast(`${m.nick} fue removido del staff`, 'info')
  }

  if (!community) {
    return (
      <div className="pnl-card">
        <div className="pnl-empty"><div className="pnl-empty__icon">{Icon.users}</div><h3>No hay comunidad activa</h3><p>Crea o selecciona una comunidad para gestionar su staff.</p></div>
      </div>
    )
  }

  return (
    <div>
      <div className="pnl-head">
        <div><h1>Staff y moderación</h1><p>Gestiona quién administra {community.name} y deja claro quién tiene permisos dentro de la comunidad.</p></div>
        <button className="pnl-btn" onClick={() => toast(`ID de comunidad copiado: ${community.publicId}`, 'info')}>{Icon.plus} Compartir acceso</button>
      </div>

      <div className="cp-controls">
        <div className="cp-tabs">
          {FILTERS.map(f => <button key={f.key} className={`cp-tab${filter === f.key ? ' active' : ''}`} onClick={() => setFilter(f.key)}>{f.label}</button>)}
        </div>
        <label className="cp-search">{Icon.search}<input value={query} onChange={e => setQuery(e.target.value)} placeholder="Buscar miembro…" /></label>
      </div>

      <motion.div className="pnl-card" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
        <table className="pnl-table">
          <thead><tr><th>Miembro</th><th>Rol</th><th>Ingreso</th><th>Posts</th><th></th></tr></thead>
          <tbody>
            {filtered.map(m => (
              <tr key={m.id}>
                <td><span className="cp-member"><img src={m.avatar} alt={m.nick} />{m.online && <i className="cp-member__dot" />}<b>{m.nick}</b></span></td>
                <td><span className={`pnl-tag ${['Dueño','Admin','Moderador'].includes(m.role) ? 'pnl-tag--accent' : ''}`}>{ROLE_LABEL[m.role] || m.role}</span></td>
                <td>{m.joined}</td>
                <td>{m.posts}</td>
                <td style={{ textAlign: 'right' }}>
                  <div className="cp-actions">
                    {!['Dueño','Moderador'].includes(m.role) && <button className="cp-act" title="Promover a moderador" onClick={() => promote(m)}>{Icon.award}</button>}
                    {m.role !== 'Dueño' && <button className="cp-act cp-act--danger" title="Remover del staff" onClick={() => remove(m)}>{Icon.x}</button>}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {filtered.length === 0 && <div className="pnl-empty"><div className="pnl-empty__icon">{Icon.users}</div><h3>Sin staff visible</h3><p>Añade miembros del equipo desde la edición de la comunidad o ajusta el filtro.</p></div>}
      </motion.div>
    </div>
  )
}

