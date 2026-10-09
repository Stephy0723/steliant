import { useEffect, useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import { useNavigate } from 'react-router-dom'
import { Icon } from '../../../components/icons/Icons.jsx'
import { useAuth } from '../../../context/AuthContext.jsx'
import { api } from '../../../lib/api.js'
import { toast } from '../../../lib/toast.js'
import './AdminControlPanels.css'

const ROLE_LABEL = { admin: 'Administrador', moderator: 'Moderador' }

export default function AdminAdmins() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const [staff, setStaff] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [query, setQuery] = useState('')
  const [form, setForm] = useState({ identifier: '', role: 'moderator' })
  const [busy, setBusy] = useState(null)

  const load = () => {
    setLoading(true)
    setError('')
    api('/admin/staff')
      .then(res => setStaff(Array.isArray(res.staff) ? res.staff : []))
      .catch(() => setError('No se pudo cargar el equipo administrativo.'))
      .finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [])

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase()
    return staff.filter(s => !q || [s.nick, s.email, s.publicId].join(' ').toLowerCase().includes(q))
  }, [staff, query])

  const metrics = {
    admins: staff.filter(s => s.isAdmin).length,
    moderators: staff.filter(s => s.isModerator).length,
    active: staff.filter(s => s.status !== 'ban').length,
  }

  const promote = async (event) => {
    event.preventDefault()
    if (!form.identifier.trim()) return
    setBusy('new')
    try {
      const res = await api('/admin/staff', { method: 'POST', body: { identifier: form.identifier.trim(), role: form.role } })
      setStaff(prev => [...prev.filter(s => s.id !== res.staff.id), res.staff])
      setForm(f => ({ ...f, identifier: '' }))
      toast(`${res.staff.nick} ahora es ${ROLE_LABEL[form.role]}`, 'success')
    } catch (err) {
      toast(err.message || 'No se pudo otorgar el rol', 'error')
    } finally {
      setBusy(null)
    }
  }

  const removeRole = async (member, role) => {
    if (!window.confirm(`¿Quitar el rol de ${ROLE_LABEL[role]} a ${member.nick}?`)) return
    setBusy(`${member.id}:${role}`)
    try {
      const res = await api(`/admin/staff/${member.id}/${role}`, { method: 'DELETE' })
      setStaff(prev => res.staff ? prev.map(s => s.id === member.id ? res.staff : s) : prev.filter(s => s.id !== member.id))
      toast(`Rol de ${ROLE_LABEL[role]} retirado a ${member.nick}`, 'success')
    } catch (err) {
      toast(err.message || 'No se pudo quitar el rol', 'error')
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className="gg-admin-page gg-admin-control">
      <div className="gg-admin-page__header">
        <div>
          <h2>Usuarios Admin</h2>
          <p>Controla quienes pueden operar el panel, revisar casos y ejecutar acciones sensibles.</p>
        </div>
        <button className="gg-btn gg-btn--primary gg-btn--sm" onClick={() => navigate('/admin/roles')}>
          {Icon.layoutGrid} Roles y permisos
        </button>
      </div>

      <section className="gg-admin-control__hero">
        <div>
          <span className="gg-admin-control__eyebrow">{Icon.shield} Acceso interno</span>
          <h3>Equipo administrativo de GlitchGang</h3>
          <p>Administradores (acceso completo a este panel) y moderadores (panel de moderación). Cada cambio avisa a la persona por notificación y correo, y queda en la bitácora.</p>
        </div>
        <label className="gg-admin-control__search">
          {Icon.search}
          <input value={query} onChange={event => setQuery(event.target.value)} placeholder="Buscar admin, email o ID..." />
        </label>
      </section>

      <section className="gg-admin-control__metrics">
        <div><span>Administradores</span><b>{loading ? '…' : metrics.admins}</b></div>
        <div><span>Moderadores</span><b>{loading ? '…' : metrics.moderators}</b></div>
        <div><span>Activos</span><b>{loading ? '…' : metrics.active}</b></div>
      </section>

      <section className="gg-admin-control__split">
        <form className="gg-admin-control__form" onSubmit={promote}>
          <h3>{Icon.plus} Dar acceso</h3>
          <label>Cuenta existente
            <input value={form.identifier} onChange={e => setForm(f => ({ ...f, identifier: e.target.value }))} placeholder="Email, nick o ID de jugador" />
          </label>
          <label>Rol
            <select value={form.role} onChange={e => setForm(f => ({ ...f, role: e.target.value }))}>
              <option value="moderator">Moderador</option>
              <option value="admin">Administrador</option>
            </select>
          </label>
          <button className="gg-btn gg-btn--primary gg-btn--sm" disabled={busy === 'new' || !form.identifier.trim()}>
            {Icon.check} {busy === 'new' ? 'Guardando…' : 'Otorgar rol'}
          </button>
        </form>

        <div className="gg-admin-control__table">
          <div className="gg-admin-control__table-head">
            <h3>{Icon.users} Personal con acceso</h3>
            <span>{shown.length} perfiles</span>
          </div>
          <div className="gg-admin-control__rows">
            {loading && <p className="gg-admin-dim" style={{ padding: '12px' }}>Cargando…</p>}
            {!loading && error && <p className="gg-admin-dim" style={{ padding: '12px' }}>{error}</p>}
            {!loading && !error && shown.map(member => {
              const isMe = String(member.id) === String(user?._id || user?.id)
              return (
                <motion.article key={member.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
                  {member.avatar
                    ? <img src={member.avatar} alt={member.nick} />
                    : <span className="gg-admin-control__icon">{Icon.user}</span>}
                  <div>
                    <b>{member.nick}{isMe ? ' (tú)' : ''}</b>
                    <span>{member.email} · {member.publicId || 'Sin ID'}</span>
                  </div>
                  <strong>{[member.isAdmin && 'Administrador', member.isModerator && 'Moderador'].filter(Boolean).join(' + ')}</strong>
                  <em className={member.status === 'ban' ? 'danger' : ''}>{member.status === 'ban' ? 'baneado' : 'activo'}</em>
                  <div className="gg-admin-staff__actions">
                    {member.isAdmin && (
                      <button type="button" disabled={isMe || busy === `${member.id}:admin`} title={isMe ? 'No puedes quitarte tu propio acceso' : ''} onClick={() => removeRole(member, 'admin')}>
                        Quitar admin
                      </button>
                    )}
                    {member.isModerator && (
                      <button type="button" disabled={isMe || busy === `${member.id}:moderator`} onClick={() => removeRole(member, 'moderator')}>
                        Quitar mod
                      </button>
                    )}
                  </div>
                </motion.article>
              )
            })}
            {!loading && !error && !shown.length && (
              <div className="gg-admin-control__empty">
                {Icon.search}
                <p>No hay personal con ese criterio.</p>
              </div>
            )}
          </div>
        </div>
      </section>
    </div>
  )
}

