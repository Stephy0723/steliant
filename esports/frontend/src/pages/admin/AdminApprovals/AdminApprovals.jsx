import { formatFieldValue } from '../../../lib/roleFieldCodec.js'
import { safeHref } from '../../../lib/safeUrl.js'
import { useEffect, useMemo, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import StatusPill from '../../../components/StatusPill/StatusPill.jsx'
import Button from '../../../components/Button/Button.jsx'
import { Icon } from '../../../components/icons/Icons.jsx'
import { api } from '../../../lib/api.js'
import { PLATFORM_ROLES } from '../../../data/roleApplications.js'
import './AdminApprovals.css'

const STATUS_LABEL = { pending: 'pendiente', approved: 'autorizado', rejected: 'rechazado' }

// El catálogo de roles (etiquetas, íconos y los campos de cada formulario) ya
// vive en roleApplications.js -- lo reusamos en vez de mantener un segundo
// diccionario a mano, que es justo lo que dejaba a "moderator" y a varios
// campos (availability, rate, languages...) sin traducir en este panel.
const REVIEWABLE_ROLES = PLATFORM_ROLES.filter(r => r.id !== 'player')
const ROLE_BY_ID = Object.fromEntries(REVIEWABLE_ROLES.map(r => [r.id, r]))
const ROLE_LABEL = Object.fromEntries(REVIEWABLE_ROLES.map(r => [r.id, r.label]))

function fieldDef(roleId, key) {
  const role = ROLE_BY_ID[roleId]
  const fields = role ? [...(role.profileFields || []), ...(role.experienceFields || [])] : []
  return fields.find(f => f.id === key)
}

function fieldLabel(roleId, key) {
  return fieldDef(roleId, key)?.label || key
}

function FieldValue({ roleId, fieldKey, value }) {
  if (!value) return '—'
  const def = fieldDef(roleId, fieldKey)
  if (def?.type === 'image') return <a href={value} target="_blank" rel="noreferrer"><img src={value} alt="" style={{ width: 56, height: 56, objectFit: 'cover' }} /></a>
  return formatFieldValue(def, value)
}

function fmt(d) {
  return d ? new Date(d).toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—'
}
function fmtShort(d) {
  return d ? new Date(d).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' }) : '—'
}
function isPdf(url) { return url?.toLowerCase().endsWith('.pdf') }
function initials(nick) { return (nick || '?').slice(0, 2).toUpperCase() }

// ── Bloque de código con copiar ───────────────────────────────────────────────
function CodeBlock({ label, value, tone }) {
  const [copied, setCopied] = useState(false)
  if (!value) return null
  const copy = () => {
    navigator.clipboard?.writeText(value).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 1400)
    })
  }
  return (
    <div className={`aa-codeblock ${tone ? `aa-codeblock--${tone}` : ''}`}>
      <span>{label}</span>
      <div className="aa-codeblock__row">
        <b>{value}</b>
        <button type="button" className="aa-copy-btn" onClick={copy} title="Copiar">
          {copied ? Icon.check : Icon.copy}
        </button>
      </div>
    </div>
  )
}

// ── Panel de detalle lateral ──────────────────────────────────────────────────
function DetailPanel({ app, onClose, onResolve, resolving }) {
  const navigate = useNavigate()
  const [rejectReason, setRejectReason] = useState('')
  const [showRejectBox, setShowRejectBox] = useState(false)
  const [showApproveConfirm, setShowApproveConfirm] = useState(false)

  if (!app) return null

  const roleLabel = ROLE_LABEL[app.roleId] || app.roleLabel
  const isImage = app.documentUrl && !isPdf(app.documentUrl)
  const hasPdf = app.documentUrl && isPdf(app.documentUrl)

  const handleReject = () => {
    onResolve(app._id, 'reject', rejectReason)
    setShowRejectBox(false)
    setRejectReason('')
  }

  const openTicket = () => navigate(`/admin/tickets?ticket=${app.systemTicket}`)

  return (
    <motion.div
      className="aa-overlay"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
    >
      <motion.aside
        className="aa-panel"
        initial={{ x: 420 }}
        animate={{ x: 0 }}
        exit={{ x: 420 }}
        transition={{ type: 'spring', stiffness: 320, damping: 32 }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="aa-panel__head">
          <div>
            <span className="aa-panel__pretitle">SOLICITUD DE ROL</span>
            <h3 className="aa-panel__title">{roleLabel}</h3>
          </div>
          <button className="aa-panel__close" onClick={onClose}>{Icon.x}</button>
        </div>

        <div className="aa-panel__body">
          {/* Estado + código real del rol, primero y bien visible */}
          <section className="aa-section">
            <div className="aa-section__head-row">
              <h4 className="aa-section__title">Estado</h4>
              <StatusPill status={STATUS_LABEL[app.status] || app.status} />
            </div>

            {app.status === 'pending' && (
              <p className="aa-hint">El código real de {roleLabel} se genera automáticamente al autorizar esta solicitud.</p>
            )}
            {app.status === 'rejected' && (
              <p className="aa-hint">Esta solicitud fue rechazada, no se generó ningún código.</p>
            )}
            {app.status === 'approved' && (
              app.roleCode ? (
                <CodeBlock label={`Código real de ${roleLabel}`} value={`${app.roleCode}${app.roleInternalCode ? ` (${app.roleInternalCode})` : ''}`} tone="ok" />
              ) : (
                <div className="aa-code-broken">
                  <span className="aa-code-broken__icon">{Icon.alert}</span>
                  <div>
                    <b>Esta solicitud quedó autorizada, pero el usuario nunca recibió su código real.</b>
                    <p>Es un caso conocido: pasa cuando la aprobación ocurrió antes de una reparación de backend. Repórtalo con el ID de abajo para que se corrija.</p>
                    <CodeBlock label="ID de la solicitud (para soporte técnico)" value={app._id} />
                  </div>
                </div>
              )
            )}

            {app.systemTicket && (
              <button type="button" className="aa-ticket-link" onClick={openTicket}>
                {Icon.msg} Ver conversación / ticket de soporte vinculado
              </button>
            )}
          </section>

          {/* Solicitante */}
          <section className="aa-section">
            <h4 className="aa-section__title">Solicitante</h4>
            <div className="aa-fields">
              <div className="aa-field"><span>Nick</span><b>@{app.userId?.nick || '—'}</b></div>
              <div className="aa-field"><span>Email</span><b>{app.userId?.email || '—'}</b></div>
              <div className="aa-field"><span>Código de jugador</span><b>{app.userId?.playerCode || '—'}</b></div>
              <div className="aa-field"><span>Enviado</span><b>{fmt(app.createdAt)}</b></div>
            </div>
            <details className="aa-tech-details">
              <summary>Detalles técnicos de la solicitud</summary>
              <div className="aa-fields">
                {app.publicCode && <div className="aa-field"><span>Código de solicitud</span><b>{app.publicCode}</b></div>}
                {app.internalCode && <div className="aa-field"><span>Código interno (admin)</span><b>{app.internalCode}</b></div>}
              </div>
            </details>
          </section>

          {/* Documento de identidad */}
          <section className="aa-section">
            <h4 className="aa-section__title">Documento de Identidad</h4>
            <div className="aa-fields">
              <div className="aa-field aa-field--full"><span>DNI / Pasaporte</span><b>{app.dni}</b></div>
            </div>

            {isImage && (
              <div className="aa-doc-preview">
                <img
                  src={app.documentUrl}
                  alt="Documento de identidad"
                  onError={e => { e.target.style.display = 'none' }}
                />
                <a href={safeHref(app.documentUrl)} target="_blank" rel="noreferrer" className="aa-doc-link">
                  {Icon.eye} Ver en tamaño completo
                </a>
              </div>
            )}

            {hasPdf && (
              <a href={safeHref(app.documentUrl)} target="_blank" rel="noreferrer" className="aa-doc-link aa-doc-link--pdf">
                {Icon.file || Icon.news} Abrir PDF — {app.documentFileName}
              </a>
            )}

            {!app.documentUrl && (
              <p className="aa-no-doc">Sin documento adjunto</p>
            )}
          </section>

          {/* Datos del formulario */}
          {app.formData && Object.keys(app.formData).length > 0 && (
            <section className="aa-section">
              <h4 className="aa-section__title">Formulario completado</h4>
              <div className="aa-fields">
                {Object.entries(app.formData).map(([key, val]) => (
                  <div key={key} className={`aa-field ${key === 'descComplex' ? 'aa-field--full' : ''}`}>
                    <span>{fieldLabel(app.roleId, key)}</span>
                    <b><FieldValue roleId={app.roleId} fieldKey={key} value={val} /></b>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Motivo de rechazo si fue rechazado */}
          {app.status === 'rejected' && app.rejectionReason && (
            <section className="aa-section aa-section--danger">
              <h4 className="aa-section__title">Motivo de rechazo</h4>
              <p className="aa-reject-reason">{app.rejectionReason}</p>
            </section>
          )}
        </div>

        {/* Acciones */}
        {app.status === 'pending' && (
          <div className="aa-panel__footer">
            {showRejectBox ? (
              <div className="aa-reject-box">
                <textarea
                  placeholder="Motivo del rechazo (opcional)..."
                  value={rejectReason}
                  onChange={e => setRejectReason(e.target.value)}
                  rows={3}
                />
                <div className="aa-reject-box__btns">
                  <Button size="sm" variant="ghost" onClick={() => setShowRejectBox(false)}>Cancelar</Button>
                  <Button size="sm" variant="ghost" onClick={handleReject} disabled={resolving}>
                    {Icon.x} Confirmar rechazo
                  </Button>
                </div>
              </div>
            ) : showApproveConfirm ? (
              <div className="aa-approve-box">
                <p>¿Confirmas autorizar a <b>@{app.userId?.nick || 'este usuario'}</b> como <b>{roleLabel}</b>? Se le genera su código real de inmediato.</p>
                <div className="aa-reject-box__btns">
                  <Button size="sm" variant="ghost" onClick={() => setShowApproveConfirm(false)} disabled={resolving}>Cancelar</Button>
                  <Button size="sm" variant="primary" onClick={() => onResolve(app._id, 'approve')} disabled={resolving}>
                    {Icon.check} Sí, autorizar
                  </Button>
                </div>
              </div>
            ) : (
              <div className="aa-panel__actions">
                <Button
                  variant="ghost"
                  onClick={() => setShowRejectBox(true)}
                  disabled={resolving}
                >
                  {Icon.x} Rechazar
                </Button>
                <Button
                  variant="primary"
                  onClick={() => setShowApproveConfirm(true)}
                  disabled={resolving}
                >
                  {Icon.check} Autorizar como {roleLabel}
                </Button>
              </div>
            )}
          </div>
        )}
      </motion.aside>
    </motion.div>
  )
}

// ── Página principal ──────────────────────────────────────────────────────────
export default function AdminApprovals() {
  const location = useLocation()
  const navigate = useNavigate()
  const [apps, setApps] = useState([])
  const [stats, setStats] = useState({})
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('pending')
  const [roleFilter, setRoleFilter] = useState(location.state?.roleFilter || '')
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState(null)
  const [resolving, setResolving] = useState(false)

  const load = (status) => {
    setLoading(true)
    api(`/role-applications/admin?status=${status}`)
      .then(data => setApps(data))
      .catch(() => setApps([]))
      .finally(() => setLoading(false))
  }

  const loadStats = () => {
    api('/role-applications/admin/stats').then(setStats).catch(() => {})
  }

  useEffect(() => { load(filter) }, [filter])
  useEffect(loadStats, [])

  const resolve = async (id, action, rejectionReason = '') => {
    setResolving(true)
    try {
      await api(`/role-applications/admin/${id}`, { method: 'PATCH', body: { action, rejectionReason } })
      setSelected(null)
      load(filter)
      loadStats()
    } catch (err) {
      alert(err.message || 'Error al procesar la solicitud')
    } finally {
      setResolving(false)
    }
  }

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase()
    return apps.filter(a => {
      if (roleFilter && a.roleId !== roleFilter) return false
      if (!q) return true
      return [a.userId?.nick, a.userId?.email, a.publicCode, a.roleCode]
        .some(v => v?.toLowerCase().includes(q))
    })
  }, [apps, roleFilter, search])

  const pending = apps.filter(a => a.status === 'pending').length
  const totalPendingAllRoles = Object.values(stats).reduce((sum, s) => sum + (s.pending || 0), 0)

  return (
    <div className="gg-admin-page aa-page">
      <div className="gg-admin-page__header">
        <div>
          <h2>Autorizaciones</h2>
          <p>
            {pending} solicitud{pending !== 1 ? 'es' : ''} pendiente{pending !== 1 ? 's' : ''} en este filtro
            {totalPendingAllRoles !== pending ? ` · ${totalPendingAllRoles} en total, todos los roles` : ''}
          </p>
        </div>
      </div>

      {/* Resumen por rol -- reemplaza el viaje a /admin/roles solo para ver
          cuántas solicitudes hay de cada tipo; aquí también sirve de filtro. */}
      <div className="aa-role-strip">
        {REVIEWABLE_ROLES.map(role => {
          const s = stats[role.id] || { pending: 0, users: 0 }
          const active = roleFilter === role.id
          return (
            <button
              key={role.id}
              type="button"
              className={`aa-role-chip ${active ? 'aa-role-chip--active' : ''} ${s.pending > 0 ? 'aa-role-chip--warn' : ''}`}
              onClick={() => setRoleFilter(active ? '' : role.id)}
            >
              <span className="aa-role-chip__icon">{Icon[role.icon] || Icon.star}</span>
              <span className="aa-role-chip__label">{role.label}</span>
              {s.pending > 0 && <span className="aa-role-chip__badge">{s.pending}</span>}
            </button>
          )
        })}
      </div>

      <div className="gg-admin-controls">
        <div className="gg-admin-search">
          <span className="gg-admin-search__icon">{Icon.search}</span>
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar por nick, email o código..." />
          {search && (
            <button className="gg-admin-search__clear" onClick={() => setSearch('')}>{Icon.x}</button>
          )}
        </div>
        <div className="aa-filters">
          {['pending', 'approved', 'rejected', 'all'].map(s => (
            <Button key={s} size="sm" variant={filter === s ? 'primary' : 'ghost'} onClick={() => setFilter(s)}>
              {{ pending: 'Pendientes', approved: 'Aprobadas', rejected: 'Rechazadas', all: 'Todas' }[s]}
            </Button>
          ))}
        </div>
      </div>

      <div className="gg-admin-card aa-list">
        {loading ? (
          <p className="gg-admin-dim aa-list__empty">Cargando...</p>
        ) : visible.length === 0 ? (
          <p className="gg-admin-dim aa-list__empty">Sin solicitudes en esta categoría.</p>
        ) : (
          <div className="aa-rows">
            <div className="aa-rows__head" aria-hidden="true">
              <span />
              <span>Solicitante</span>
              <span>Rol</span>
              <span>Código</span>
              <span>Doc.</span>
              <span>Fecha</span>
              <span>Estado</span>
              <span />
              <span />
            </div>
            {visible.map(app => (
              <div
                key={app._id}
                role="button"
                tabIndex={0}
                className={`aa-row ${selected?._id === app._id ? 'aa-row--active' : ''}`}
                onClick={() => setSelected(app)}
                onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') setSelected(app) }}
              >
                <span className="aa-row__avatar">{initials(app.userId?.nick)}</span>
                <span className="aa-row__user">
                  <b>@{app.userId?.nick || '—'}</b>
                  <small>{app.userId?.email || '—'}</small>
                </span>
                <span className="aa-role-tag">{ROLE_LABEL[app.roleId] || app.roleId}</span>
                <span className="aa-dim aa-row__code">
                  {app.status === 'approved' ? (
                    app.roleCode
                      ? <b>{app.roleCode}</b>
                      : <span className="aa-code-missing" title="La solicitud quedó autorizada pero el usuario nunca recibió el código real — repórtalo a backend">{Icon.alert} Falta código</span>
                  ) : (app.publicCode || '—')}
                </span>
                <span>
                  {app.documentUrl
                    ? <span className="aa-has-doc" title="Tiene documento adjunto">{Icon.check}</span>
                    : <span className="aa-no-doc-tag" title="Sin documento adjunto">—</span>}
                </span>
                <span className="aa-dim">{fmtShort(app.createdAt)}</span>
                <StatusPill status={STATUS_LABEL[app.status] || app.status} />
                {app.systemTicket ? (
                  <button
                    type="button"
                    className="aa-row__ticket"
                    title="Ver ticket de soporte vinculado"
                    onClick={e => { e.stopPropagation(); navigate(`/admin/tickets?ticket=${app.systemTicket}`) }}
                  >
                    {Icon.msg}
                  </button>
                ) : <span />}
                <span className="aa-row__chevron">{Icon.chevronRight}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      <AnimatePresence>
        {selected && (
          <DetailPanel
            app={selected}
            onClose={() => setSelected(null)}
            onResolve={resolve}
            resolving={resolving}
          />
        )}
      </AnimatePresence>
    </div>
  )
}

