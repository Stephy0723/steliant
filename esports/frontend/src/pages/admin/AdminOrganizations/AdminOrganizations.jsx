import { useEffect, useState } from 'react'
import StatusPill from '../../../components/StatusPill/StatusPill.jsx'
import Button from '../../../components/Button/Button.jsx'
import { Icon } from '../../../components/icons/Icons.jsx'
import { api } from '../../../lib/api.js'
import './AdminOrganizations.css'

const REQUEST_STATUS_LABEL = { pending: 'pendiente', approved: 'autorizado', rejected: 'rechazado' }
const ORG_STATUS_LABEL = { active: 'activo', paused: 'inactivo' }

function fmt(d) {
  return d ? new Date(d).toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'
}

function NewOrgForm({ onCreated }) {
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState({ name: '', discordGuildId: '', ownerEmail: '', welcomeChannelId: '' })
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  const submit = async (e) => {
    e.preventDefault()
    setError('')
    setSubmitting(true)
    try {
      await api('/admin/organizations', { method: 'POST', body: form })
      setForm({ name: '', discordGuildId: '', ownerEmail: '', welcomeChannelId: '' })
      setOpen(false)
      onCreated()
    } catch (err) {
      setError(err.message || 'No se pudo crear la organización')
    } finally {
      setSubmitting(false)
    }
  }

  if (!open) {
    return (
      <Button size="sm" variant="primary" onClick={() => setOpen(true)}>
        {Icon.plus} Nueva organización
      </Button>
    )
  }

  return (
    <form className="ao-form" onSubmit={submit}>
      <div className="ao-form__grid">
        <label>
          <span>Nombre</span>
          <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
        </label>
        <label>
          <span>Discord Guild ID</span>
          <input value={form.discordGuildId} onChange={(e) => setForm({ ...form, discordGuildId: e.target.value })} required />
        </label>
        <label>
          <span>Correo del dueño</span>
          <input type="email" value={form.ownerEmail} onChange={(e) => setForm({ ...form, ownerEmail: e.target.value })} required />
        </label>
        <label>
          <span>Canal de bienvenida (opcional)</span>
          <input value={form.welcomeChannelId} onChange={(e) => setForm({ ...form, welcomeChannelId: e.target.value })} />
        </label>
      </div>
      {error && <p className="ao-error">{error}</p>}
      <div className="ao-form__actions">
        <Button size="sm" variant="ghost" type="button" onClick={() => setOpen(false)} disabled={submitting}>Cancelar</Button>
        <Button size="sm" variant="primary" type="submit" disabled={submitting}>{submitting ? 'Creando...' : 'Crear'}</Button>
      </div>
    </form>
  )
}

export default function AdminOrganizations() {
  const [requests, setRequests] = useState([])
  const [orgs, setOrgs] = useState([])
  const [discordAccess, setDiscordAccess] = useState([])
  const [loading, setLoading] = useState(true)
  const [requestFilter, setRequestFilter] = useState('pending')
  const [resolving, setResolving] = useState(null)
  const [editingOrgId, setEditingOrgId] = useState(null)
  const [editingGuildId, setEditingGuildId] = useState('')

  const load = () => {
    setLoading(true)
    Promise.all([
      api(`/admin/organization-requests?status=${requestFilter}`).catch(() => ({ requests: [] })),
      api('/admin/organizations').catch(() => ({ organizations: [] })),
      api('/admin/discord-access?status=all').catch(() => ({ requests: [] })),
    ]).then(([r, o, d]) => {
      setRequests(r.requests || [])
      setOrgs(o.organizations || [])
      setDiscordAccess(d.requests || [])
    }).finally(() => setLoading(false))
  }

  const reviewDiscord = async (userId, decision) => {
    setResolving(`d:${userId}`)
    try { await api(`/admin/discord-access/${userId}/review`, { method: 'POST', body: { decision } }); load() }
    catch (err) { alert(err.message || 'No se pudo procesar') }
    finally { setResolving(null) }
  }

  useEffect(() => { load() }, [requestFilter])

  const review = async (id, action) => {
    const rejectionReason = action === 'reject' ? (window.prompt('Motivo del rechazo (opcional):') || '') : undefined
    setResolving(id)
    try {
      await api(`/admin/organization-requests/${id}/review`, { method: 'POST', body: { action, rejectionReason } })
      load()
    } catch (err) {
      alert(err.message || 'No se pudo procesar la solicitud')
    } finally {
      setResolving(null)
    }
  }

  const pendingCount = requests.filter(r => r.status === 'pending').length

  const startEditGuildId = (org) => {
    setEditingOrgId(org.id)
    setEditingGuildId(org.discordGuildId || '')
  }

  const cancelEditGuildId = () => {
    setEditingOrgId(null)
    setEditingGuildId('')
  }

  const saveGuildId = async (orgId) => {
    const discordGuildId = editingGuildId.trim()
    if (!discordGuildId) return alert('El Discord Guild ID no puede quedar vacio.')
    setResolving(`org:${orgId}`)
    try {
      await api(`/admin/organizations/${orgId}`, { method: 'PATCH', body: { discordGuildId } })
      cancelEditGuildId()
      load()
    } catch (err) {
      alert(err.message || 'No se pudo actualizar el Discord Guild ID')
    } finally {
      setResolving(null)
    }
  }

  return (
    <div className="gg-admin-page">
      <div className="gg-admin-page__header">
        <div>
          <h2>Organizaciones</h2>
          <p>Clientes con su Discord activado — cada uno con sus torneos aislados de los demás.</p>
        </div>
        <NewOrgForm onCreated={load} />
      </div>

      <div className="gg-admin-card ao-list">
        <div className="ao-list__head">
          <h3>Solicitudes de activación</h3>
          <div className="ao-filters">
            {['pending', 'approved', 'rejected', 'all'].map(s => (
              <Button key={s} size="sm" variant={requestFilter === s ? 'primary' : 'ghost'} onClick={() => setRequestFilter(s)}>
                {{ pending: 'Pendientes', approved: 'Aprobadas', rejected: 'Rechazadas', all: 'Todas' }[s]}
              </Button>
            ))}
          </div>
        </div>

        {loading ? (
          <p className="gg-admin-dim ao-empty">Cargando...</p>
        ) : requests.length === 0 ? (
          <p className="gg-admin-dim ao-empty">Sin solicitudes en esta categoría.</p>
        ) : (
          <div className="ao-table-wrap">
          <table className="ao-table">
            <thead>
              <tr>
                <th>Organización</th>
                <th>Discord Guild ID</th>
                <th>Solicitado por</th>
                <th>Fecha</th>
                <th>Estado</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {requests.map(r => (
                <tr key={r.id}>
                  <td><b>{r.name}</b>{r.message && <div className="ao-dim">{r.message}</div>}</td>
                  <td className="ao-mono">{r.discordGuildId}</td>
                  <td className="ao-dim">{r.requester}</td>
                  <td className="ao-dim">{fmt(r.createdAt)}</td>
                  <td><StatusPill status={REQUEST_STATUS_LABEL[r.status] || r.status} /></td>
                  <td>
                    {r.status === 'pending' && (
                      <div className="ao-row-actions">
                        <Button size="sm" variant="ghost" disabled={resolving === r.id} onClick={() => review(r.id, 'reject')}>{Icon.x}</Button>
                        <Button size="sm" variant="primary" disabled={resolving === r.id} onClick={() => review(r.id, 'approve')}>{Icon.check} Aprobar</Button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        )}
      </div>

      <div className="gg-admin-card ao-list">
        <div className="ao-list__head">
          <h3>Acceso a Discord de GlitchGang (organizadores)</h3>
        </div>
        {loading ? (
          <p className="gg-admin-dim ao-empty">Cargando...</p>
        ) : discordAccess.length === 0 ? (
          <p className="gg-admin-dim ao-empty">Ningún organizador ha solicitado acceso.</p>
        ) : (
          <div className="ao-table-wrap">
          <table className="ao-table">
            <thead><tr><th>Organizador</th><th>Código</th><th>Solicitado</th><th>Estado</th><th></th></tr></thead>
            <tbody>
              {discordAccess.map(d => (
                <tr key={d.userId}>
                  <td><b>{d.nick}</b>{d.note && <div className="ao-dim">{d.note}</div>}<div className="ao-dim">{d.email}</div></td>
                  <td className="ao-mono">{d.organizerCode || '—'}</td>
                  <td className="ao-dim">{d.requestedAt ? fmt(d.requestedAt) : '—'}</td>
                  <td><StatusPill status={{ pending: 'Pendiente', enabled: 'Habilitado', revoked: 'Revocado', none: '—' }[d.status] || d.status} /></td>
                  <td>
                    <div className="ao-row-actions">
                      {d.status !== 'enabled' && <Button size="sm" variant="primary" disabled={resolving === `d:${d.userId}`} onClick={() => reviewDiscord(d.userId, 'enable')}>{Icon.check} Habilitar</Button>}
                      {d.status !== 'none' && d.status !== 'revoked' && <Button size="sm" variant="ghost" disabled={resolving === `d:${d.userId}`} onClick={() => reviewDiscord(d.userId, 'reject')}>{Icon.x}</Button>}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        )}
      </div>

      <div className="gg-admin-card ao-list">
        <div className="ao-list__head">
          <h3>Organizaciones activas ({orgs.length})</h3>
        </div>
        {orgs.length === 0 ? (
          <p className="gg-admin-dim ao-empty">Todavía no hay organizaciones dadas de alta.</p>
        ) : (
          <div className="ao-table-wrap">
          <table className="ao-table">
            <thead>
              <tr>
                <th>Nombre</th>
                <th>Discord Guild ID</th>
                <th>Estado</th>
                <th>Creada</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {orgs.map(o => (
                <tr key={o.id}>
                  <td><b>{o.name}</b></td>
                  <td className="ao-mono">
                    {editingOrgId === o.id ? (
                      <input
                        className="ao-mono-input"
                        value={editingGuildId}
                        onChange={(e) => setEditingGuildId(e.target.value)}
                        autoFocus
                      />
                    ) : o.discordGuildId}
                  </td>
                  <td><StatusPill status={ORG_STATUS_LABEL[o.status] || o.status} /></td>
                  <td className="ao-dim">{fmt(o.createdAt)}</td>
                  <td>
                    {editingOrgId === o.id ? (
                      <div className="ao-row-actions">
                        <Button size="sm" variant="ghost" disabled={resolving === `org:${o.id}`} onClick={cancelEditGuildId}>{Icon.x}</Button>
                        <Button size="sm" variant="primary" disabled={resolving === `org:${o.id}`} onClick={() => saveGuildId(o.id)}>{Icon.check} Guardar</Button>
                      </div>
                    ) : (
                      <Button size="sm" variant="ghost" onClick={() => startEditGuildId(o)}>Editar</Button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        )}
      </div>
    </div>
  )
}

