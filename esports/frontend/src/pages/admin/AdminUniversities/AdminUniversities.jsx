import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import StatusPill from '../../../components/StatusPill/StatusPill.jsx'
import Button from '../../../components/Button/Button.jsx'
import { Icon } from '../../../components/icons/Icons.jsx'
import { api } from '../../../lib/api.js'
import { toast } from '../../../lib/toast.js'
import AdminUniversityCatalogTab from './AdminUniversityCatalogTab.jsx'
import './AdminUniversities.css'

// ── Panel de detalle lateral ──────────────────────────────────────────────────
function DetailPanel({ app, onClose, onUnlink, resolving }) {
  const [reason, setReason] = useState('')
  const [showUnlinkBox, setShowUnlinkBox] = useState(false)

  if (!app) return null

  return (
    <motion.div
      className="au-overlay"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
    >
      <motion.aside
        className="au-panel"
        initial={{ x: 420 }}
        animate={{ x: 0 }}
        exit={{ x: 420 }}
        transition={{ type: 'spring', stiffness: 320, damping: 32 }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="au-panel__head">
          <div>
            <span className="au-panel__pretitle">ESTUDIANTE VERIFICADO</span>
            <h3 className="au-panel__title">{app.universityName}</h3>
          </div>
          <button className="au-panel__close" onClick={onClose}>{Icon.x}</button>
        </div>

        <div className="au-panel__body">
          {/* Solicitante */}
          <section className="au-section">
            <h4 className="au-section__title">Estudiante</h4>
            <div className="au-fields">
              <div className="au-field"><span>Nick</span><b>@{app.user?.nick || '—'}</b></div>
              <div className="au-field"><span>Email personal</span><b>{app.user?.email || '—'}</b></div>
              <div className="au-field"><span>Código</span><b>{app.user?.playerCode || '—'}</b></div>
              <div className="au-field"><span>Enviado</span><b>{new Date(app.submittedAt).toLocaleDateString('es-ES')}</b></div>
              {app.publicCode && <div className="au-field"><span>Código Solicitud</span><b>{app.publicCode}</b></div>}
              <div className="au-field au-field--full">
                <span>Estado</span>
                <StatusPill status={app.status === 'approved' ? 'autorizado' : app.status === 'rejected' ? 'rechazado' : 'pendiente'} />
              </div>
            </div>
          </section>

          {/* Datos Universitarios */}
          <section className="au-section">
            <h4 className="au-section__title">Detalles Académicos</h4>
            <div className="au-fields">
              <div className="au-field au-field--full"><span>Universidad</span><b>{app.universityName} ({app.universityTag})</b></div>
              <div className="au-field"><span>Matrícula</span><b>{app.studentId || '—'}</b></div>
              <div className="au-field"><span>Nivel</span><b>{app.academicLevel}</b></div>
              <div className="au-field au-field--full"><span>Carrera</span><b>{app.program}</b></div>
              <div className="au-field"><span>Campus</span><b>{app.campus}</b></div>
              <div className="au-field"><span>Región</span><b>{app.region ? app.region.toUpperCase() : 'RD'}</b></div>
              <div className="au-field au-field--full"><span>Correo institucional</span><b>{app.institutionalEmail || '—'}</b></div>
            </div>
          </section>

          {/* Origen de verificación */}
          <section className="au-section">
            <h4 className="au-section__title">Método de Verificación</h4>
            <div className="au-fields">
              <div className="au-field au-field--full">
                <span>Origen</span>
                <b>{{ email: 'Código al correo institucional', microsoft: 'Microsoft/Entra ID', admin: 'Vinculado por un admin' }[app.verificationSource] || 'Revisión manual (sistema anterior)'}</b>
              </div>
              {app.verificationSource === 'microsoft' && app.microsoft && (
                <>
                  <div className="au-field"><span>Nombre MS</span><b>{app.microsoft.displayName || '—'}</b></div>
                  <div className="au-field"><span>Email MS</span><b>{app.microsoft.email || '—'}</b></div>
                  <div className="au-field au-field--full"><span>Microsoft ID</span><b>{app.microsoft.id || '—'}</b></div>
                </>
              )}
            </div>
          </section>

          {/* Motivo de rechazo o de revocación si lo hay */}
          {app.status === 'rejected' && app.rejectReason && (
            <section className="au-section au-section--danger">
              <h4 className="au-section__title">Motivo de rechazo</h4>
              <p className="au-reject-reason">{app.rejectReason}</p>
            </section>
          )}

          {app.reviewedBy && (
            <section className="au-section">
              <h4 className="au-section__title">Revisado Por</h4>
              <div className="au-fields">
                <div className="au-field"><span>Admin</span><b>@{app.reviewedBy.nick}</b></div>
                <div className="au-field"><span>Fecha</span><b>{new Date(app.reviewedAt).toLocaleDateString('es-ES')}</b></div>
              </div>
            </section>
          )}
        </div>

        {/* Acciones */}
        <div className="au-panel__footer">
          {showUnlinkBox ? (
            <div className="au-reject-box">
              <textarea
                placeholder="Motivo (opcional, se le envía al usuario)..."
                value={reason}
                onChange={e => setReason(e.target.value)}
                rows={3}
              />
              <div className="au-reject-box__btns">
                <Button size="sm" variant="ghost" onClick={() => setShowUnlinkBox(false)}>Cancelar</Button>
                <Button size="sm" variant="ghost" onClick={() => onUnlink(app.user?._id, reason)} disabled={resolving}>
                  {Icon.lock} Confirmar desvinculación
                </Button>
              </div>
            </div>
          ) : (
            <div className="au-panel__actions">
              <Button variant="ghost" onClick={() => setShowUnlinkBox(true)} disabled={resolving} style={{ color: '#f87171', borderColor: 'rgba(248,113,113,.2)' }}>
                {Icon.lock} Desvincular de la universidad
              </Button>
            </div>
          )}
        </div>
      </motion.aside>
    </motion.div>
  )
}

// ── Página principal ──────────────────────────────────────────────────────────
export default function AdminUniversities() {
  const [apps, setApps] = useState([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState(null)
  const [resolving, setResolving] = useState(false)
  const [view, setView] = useState('catalogo')

  // Solo existen estudiantes verificados por correo institucional; no hay
  // cola de revisión manual.
  const load = () => {
    setLoading(true)
    api('/university/applications?status=approved')
      .then(data => setApps(Array.isArray(data) ? data : []))
      .catch(() => setApps([]))
      .finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [])

  const unlink = async (userId, reason = '') => {
    if (!userId) return
    setResolving(true)
    try {
      const res = await api(`/university/admin/users/${userId}`, {
        method: 'DELETE',
        body: JSON.stringify({ reason }),
      })
      toast(res.message || 'Usuario desvinculado', 'success')
      setSelected(null)
      load()
    } catch (err) {
      toast(err.message || 'No se pudo desvincular', 'error')
    } finally {
      setResolving(false)
    }
  }


  return (
    <div className="gg-admin-page">
      <div className="gg-admin-page__header">
        <div>
          <h2>Universidades</h2>
          <p>
            {view === 'catalogo'
              ? 'Catálogo de universidades: agrégalas, edita logos, carreras, campus y dominios de correo sin tocar código.'
              : `${apps.length} estudiante${apps.length !== 1 ? 's' : ''} verificado${apps.length !== 1 ? 's' : ''} con el código enviado al correo institucional.`}
          </p>
        </div>
        <div className="au-filters">
          <Button size="sm" variant={view === 'catalogo' ? 'primary' : 'ghost'} onClick={() => setView('catalogo')}>Catálogo</Button>
          <Button size="sm" variant={view === 'estudiantes' ? 'primary' : 'ghost'} onClick={() => setView('estudiantes')}>Estudiantes verificados</Button>
        </div>
      </div>

      {view === 'catalogo' ? <AdminUniversityCatalogTab /> : (
      <div className="gg-admin-card au-list">
        {loading ? (
          <p className="gg-admin-dim au-list__empty">Cargando...</p>
        ) : apps.length === 0 ? (
          <p className="gg-admin-dim au-list__empty">Todavía no hay estudiantes verificados.</p>
        ) : (
          <table className="au-table">
            <thead>
              <tr>
                <th>Estudiante</th>
                <th>Universidad</th>
                <th>Correo institucional</th>
                <th>Carrera</th>
                <th>Método</th>
                <th>Fecha</th>
                <th>Estado</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {apps.map(app => (
                <tr
                  key={app._id}
                  className={`au-row ${selected?._id === app._id ? 'au-row--active' : ''}`}
                  onClick={() => setSelected(app)}
                >
                  <td>
                    <div className="au-user">
                      <b>@{app.user?.nick || '—'}</b>
                      <small>{app.user?.email || '—'}</small>
                    </div>
                  </td>
                  <td><span className="au-uni-tag">{app.universityTag || app.universityName}</span></td>
                  <td className="au-dim">{app.institutionalEmail || '—'}</td>
                  <td className="au-dim">{app.program}</td>
                  <td>
                    {app.verificationSource === 'email'
                      ? <span style={{ color: 'var(--accent)', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>{Icon.check} Correo</span>
                      : app.verificationSource === 'microsoft'
                      ? <span style={{ color: '#60a5fa', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>{Icon.globe} Microsoft</span>
                      : <span style={{ color: '#94a3b8', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>{Icon.user} Manual</span>
                    }
                  </td>
                  <td className="au-dim">{new Date(app.submittedAt).toLocaleDateString('es-ES')}</td>
                  <td>
                    <StatusPill status={app.status === 'approved' ? 'autorizado' : app.status === 'rejected' ? 'rechazado' : 'pendiente'} />
                  </td>
                  <td><button className="au-view-btn">{Icon.eye} Ver</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      )}

      <AnimatePresence>
        {selected && (
          <DetailPanel
            app={selected}
            onClose={() => setSelected(null)}
            onUnlink={unlink}
            resolving={resolving}
          />
        )}
      </AnimatePresence>
    </div>
  )
}

