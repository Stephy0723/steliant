import { useEffect, useMemo, useState } from 'react'
import { safeHref } from '../../../lib/safeUrl.js'
import { Link } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { Icon } from '../../../components/icons/Icons.jsx'
import GGTeamCard from '../../../components/GGTeamCard/GGTeamCard.jsx'
import { api } from '../../../lib/api.js'
import { exportTournamentsCsv, exportTournamentsPdf } from '../../../lib/tournamentExport.js'
import { toast } from '../../../lib/toast.js'
import { GAMES } from '../../../data/games.js'
import './AdminTournaments.css'

const GAME_MAP = GAMES.reduce((m, g) => { m[g.id] = g.name; m[g.name] = g.name; return m }, {})
const getGameName = (game) => GAME_MAP[game] || (game === 'mlbb' ? 'Mobile Legends' : game === 'val' ? 'Valorant' : game)

// ── Helpers de resumen ──
const toNum = (s) => Number(String(s ?? '').replace(/[^0-9.]/g, '')) || 0
const money = (n) => `$${Number(n || 0).toLocaleString()}`
const STATUS_ES = { live: 'En vivo', upcoming: 'Inscripciones', registration_closed: 'Inscripción cerrada', finished: 'Finalizado', cancelled: 'Cancelado', draft: 'Borrador' }
const entryFeeOf = (t) => (t.entryFee != null ? t.entryFee : toNum(t.cost))
const revenueOf = (t) => entryFeeOf(t) * (t.filled || 0)
const tournamentTeamCard = (team, tournament, index) => {
  const total = (team?.wins || 0) + (team?.losses || 0)
  const winrate = total ? Math.round((team.wins / total) * 100) : 0
  const members = Number(team?.members || 5)

  return {
    name: team?.name || 'Equipo',
    crest: team?.logo || '',
    country: team?.country || '',
    gender: team?.gender || '',
    initials: String(team?.tag || team?.name || 'GG').slice(0, 2).toUpperCase(),
    code: `#${team?.position || index + 1}`,
    shortCode: `T${team?.position || index + 1}`,
    game: getGameName(tournament?.game),
    region: tournament?.title || 'Torneo',
    bio: `${team?.wins || 0}W - ${team?.losses || 0}L / ${winrate}% WR`,
    tags: [
      { label: `${members} miembros`, on: true },
      `${winrate}% winrate`,
      tournament?.status ? STATUS_ES[tournament.status] || tournament.status : '',
    ].filter(Boolean),
    // El logo iba aqui como si fuera la foto de un jugador. El backend solo
    // manda cuantos son (no fotos ni nicks): un avatar generico por cada uno
    // para que el cupo y "N miembros" cuadren. Ver BACKEND-PENDIENTE.md.
    members: Array.from({ length: members }, () => '/demos/steliant-esports/avatar-default.svg'),
    capacity: Math.max(members, 5),
  }
}


export default function AdminTournaments() {
  const [tournaments, setTournaments] = useState([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [selectedTournament, setSelectedTournament] = useState(null)
  const [viewMode, setViewMode] = useState('cards')
  const [activeTab, setActiveTab] = useState('general')
  const [view, setView] = useState('torneos') // 'torneos' | 'equipos' | 'herramientas'

  // Un solo fetch real de /admin/tournaments -- antes había dos efectos
  // pisándose el mismo estado con dos formas distintas (la censo-cruda que
  // usa TorneosCensus y la mapForTools que usa la pestaña Herramientas),
  // condición de carrera que dejaba la tabla en 0 registros según cuál
  // resolviera último. toolsTournaments deriva la forma de Herramientas
  // sin tocar el estado crudo que necesita el censo.
  useEffect(() => {
    let alive = true
    api('/admin/tournaments')
      .then(res => { if (alive) setTournaments(Array.isArray(res?.tournaments) ? res.tournaments : []) })
      .catch(() => { if (alive) setLoadError('No se pudieron cargar los torneos desde el servidor.') })
      .finally(() => { if (alive) setLoading(false) })
    return () => { alive = false }
  }, [])

  const activeSelected = selectedTournament || tournaments[0] || {}

  const handleToggleDiscord = async (tournament) => {
    const nextValue = !tournament.discordEnabled
    try {
      const updated = await api(`/admin/tournaments/${tournament.id}/discord`, {
        method: 'PATCH',
        body: { discordEnabled: nextValue },
      })
      setTournaments(prev => prev.map(t => (t.id === tournament.id ? { ...t, discordEnabled: updated.discordEnabled } : t)))
      if (selectedTournament?.id === tournament.id) setSelectedTournament(prev => ({ ...prev, discordEnabled: updated.discordEnabled }))
      toast(updated.discordEnabled ? 'Torneo habilitado para Discord' : 'Torneo deshabilitado para Discord', 'success')
    } catch (err) {
      toast(err.message || 'No se pudo actualizar el torneo', 'error')
    }
  }

  return (
    <div className="gg-admin-page at-tournaments-page">
      <motion.div className="at-page-header" initial={{ opacity: 0, y: -12 }} animate={{ opacity: 1, y: 0 }}>
        <div>
          <h2>Torneos y equipos</h2>
          <p>
            Censo privado: ve todos los detalles y exporta a PDF o CSV ·{' '}
            <span className="gg-teams__src backend">{loading ? 'cargando…' : loadError || `${tournaments.length} torneos`}</span>
          </p>
        </div>
      </motion.div>

      <div className="at-viewnav">
        {[
          { id: 'torneos', label: 'Torneos', icon: Icon.trophy },
          { id: 'herramientas', label: 'Herramientas', icon: Icon.gem },
        ].map(v => (
          <button key={v.id} className={`at-viewnav__btn ${view === v.id ? 'active' : ''}`} onClick={() => setView(v.id)}>
            {v.icon}<span>{v.label}</span>
          </button>
        ))}
      </div>

      {view === 'torneos' && <TorneosCensus tournaments={tournaments} />}
      {view === 'herramientas' && (
        <DetailSection
          tournaments={tournaments}
          selectedTournament={activeSelected}
          setSelectedTournament={setSelectedTournament}
          viewMode={viewMode}
          setViewMode={setViewMode}
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          onToggleDiscord={handleToggleDiscord}
        />
      )}
    </div>
  )
}

// Equipos derivados de los participantes de cada torneo
function SummaryKpi({ icon, value, label }) {
  return (
    <div className="at-kpi">
      <div className="at-kpi__icon">{icon}</div>
      <div className="at-kpi__content">
        <div className="at-kpi__value">{value}</div>
        <div className="at-kpi__label">{label}</div>
      </div>
    </div>
  )
}

function ExportBar({ onCsv, onPdf, count }) {
  return (
    <div className="at-export">
      <span>{count} registros</span>
      <button onClick={onCsv}>{Icon.download} CSV</button>
      <button onClick={() => onPdf('profile')}>{Icon.fileText} Fichas PDF</button>
      <button onClick={() => onPdf('summary')}>{Icon.fileText} Resumen PDF</button>
      <button onClick={() => onPdf('table')}>{Icon.fileText} Tabla PDF</button>
    </div>
  )
}

// ════════ TORNEOS (estilo censo) ════════
// Usa el mismo estado `tournaments` (real, fetched por el padre) que la
// pestaña Herramientas -- antes leía el mock estático TOURNAMENTS y nunca
// se actualizaba con datos reales.
function TorneosCensus({ tournaments }) {
  const [q, setQ] = useState('')
  const [status, setStatus] = useState('Todos')
  const [sel, setSel] = useState(null)

  const rows = useMemo(() => tournaments.filter(t => {
    const mq = !q || [
      t.name, t.title, t.game, t.publicId, t.uid, t.tournamentCode, t.internalId, t.legacyPublicId, t.creator, t.organizerCode, t.countryCode
    ].some(v => String(v || '').toLowerCase().includes(q.toLowerCase()))
    return mq && (status === 'Todos' || t.status === status)
  }), [tournaments, q, status])

  const kpis = {
    total: tournaments.length,
    live: tournaments.filter(t => t.status === 'live').length,
    paid: tournaments.filter(t => entryFeeOf(t) > 0).length,
    revenue: tournaments.reduce((a, t) => a + revenueOf(t), 0),
    prizes: tournaments.reduce((a, t) => a + toNum(t.prize), 0),
  }

  return (
    <motion.div className="at-content" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
      <div className="at-kpi-grid">
        <SummaryKpi icon={Icon.trophy} value={kpis.total} label="Torneos" />
        <SummaryKpi icon={Icon.bolt} value={kpis.live} label="En vivo" />
        <SummaryKpi icon={Icon.creditCard} value={kpis.paid} label="De pago" />
        <SummaryKpi icon={Icon.star} value={money(kpis.revenue)} label="Ingresos inscripción" />
        <SummaryKpi icon={Icon.gem} value={money(kpis.prizes)} label="Premios totales" />
      </div>

      <div className="at-toolbar">
        <div className="gg-admin-filter-tabs">
          {['Todos', 'live', 'upcoming', 'finished'].map(s => (
            <button key={s} className={`gg-admin-filter-tab ${status === s ? 'active' : ''}`} onClick={() => setStatus(s)}>{s === 'Todos' ? 'Todos' : STATUS_ES[s]}</button>
          ))}
        </div>
        <div className="gg-admin-search">
          <span className="gg-admin-search__icon">{Icon.search}</span>
          <input value={q} onChange={e => setQ(e.target.value)} placeholder="Buscar nombre, juego o ID…" />
          {q && <button className="gg-admin-search__clear" onClick={() => setQ('')}>{Icon.x}</button>}
        </div>
      </div>

      <ExportBar count={rows.length}
        onCsv={() => { exportTournamentsCsv(rows); toast('Torneos exportados a CSV', 'success') }}
        onPdf={(format) => { exportTournamentsPdf({ tournaments: rows, format }); toast('PDF de torneos generado', 'success') }} />

      <div className="at-card-section" style={{ padding: 0 }}>
        <div className="at-table-wrap">
          <table className="at-summary-table">
            <thead><tr><th>Torneo</th><th>Identificadores</th><th>Estado</th><th>Fecha</th><th>Equipos</th><th>Inscripción</th><th>Premio</th><th>Ingresos</th><th></th></tr></thead>
            <tbody>
              {rows.map(t => {
                const fee = entryFeeOf(t)
                return (
                  <tr key={t.id || t.uid || t.publicId} className="at-row" onClick={() => setSel(t)}>
                    <td><div className="at-tname"><span className="at-dot" style={{ background: t.color || '#00E676' }} /><div><b>{t.name || t.title}</b><small>{getGameName(t.game)}{t.winner ? ` · 🏆 ${t.winner}` : ''}</small></div></div></td>
                    <td>
                      <div className="gg-tc__ids-row" style={{ display: 'flex', flexDirection: 'column', gap: '3px' }} onClick={e => e.stopPropagation()}>
                        <div className="gg-tc__id-item">
                          <span style={{ fontSize: '10px', color: 'var(--text-dim)', marginRight: '4px', fontWeight: 600 }}>PUB:</span>
                          <code className="at-id" style={{ cursor: 'pointer' }} onClick={() => { navigator.clipboard.writeText(t.publicId || t.uid); toast('ID público copiado', 'success') }}>{t.publicId || t.uid}</code>
                        </div>
                        <div className="gg-tc__id-item">
                          <span style={{ fontSize: '10px', color: 'var(--text-dim)', marginRight: '4px', fontWeight: 600 }}>INT:</span>
                          <code className="at-id-ext" style={{ cursor: 'pointer', fontFamily: 'monospace' }} onClick={() => { navigator.clipboard.writeText(t.tournamentCode || t.internalId); toast('Código interno copiado', 'success') }}>{t.tournamentCode || t.internalId}</code>
                        </div>
                        <div style={{ fontSize: '10px', color: 'var(--text-dim)', display: 'flex', gap: '8px', marginTop: '2px' }}>
                          <span>ORG: <b>{t.organizerCode || t.creator}</b></span>
                          <span>PAÍS: <b>{t.countryCode || 'RD'}</b></span>
                        </div>
                      </div>
                    </td>
                    <td><span className={`at-badge at-badge--${t.status}`}>{STATUS_ES[t.status] || t.status}</span></td>
                    <td>{t.date || t.startDate}{t.time ? ` · ${t.time}` : ''}</td>
                    <td><b>{t.filled}</b>/{t.slots}</td>
                    <td>{fee > 0 ? <span className="at-paid">{money(fee)}</span> : <span className="at-free">Gratis</span>}</td>
                    <td>{money(toNum(t.prize))}</td>
                    <td>{fee > 0 ? <b className="at-rev">{money(revenueOf(t))}</b> : '—'}</td>
                    <td><span className="at-see">{Icon.eye}</span></td>
                  </tr>
                )
              })}
              {rows.length === 0 && <tr><td colSpan={9} className="at-empty">Sin torneos con ese criterio.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      <AnimatePresence>{sel && <TournamentDrawer t={sel} onClose={() => setSel(null)} />}</AnimatePresence>
    </motion.div>
  )
}

function CopyId({ value, label }) {
  const copy = () => {
    navigator.clipboard?.writeText(value)
    toast(`${label} copiado`, 'success')
  }
  return (
    <code className="gg-pd__id" onClick={copy} title="Copiar">
      {value}
    </code>
  )
}

function TournamentDrawer({ t, onClose }) {
  const fee = entryFeeOf(t)

  // Sin fallback a datos de ejemplo (TOURNAMENT_DETAILS) -- este panel es
  // real, si el torneo no tiene participantes/reglas cargados se muestra
  // vacío en vez de inventar datos de la semilla mock.
  const participants = (t.participants && t.participants.length) ? t.participants : []
  const rules = (t.rules && t.rules !== '—') ? (Array.isArray(t.rules) ? t.rules : [t.rules]) : []
  const staff = t.staff || {}
  const overcup = t.overcup || {}
  const sponsors = t.sponsors || []
  const collaborators = t.collaborators || []
  const checkin = t.checkin || {}

  return (
    <motion.div className="gg-pd-overlay" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose}>
      <motion.div className="gg-pd" onClick={e => e.stopPropagation()}
        initial={{ x: 60, opacity: 0 }} animate={{ x: 0, opacity: 1 }} exit={{ x: 60, opacity: 0 }} transition={{ type: 'spring', stiffness: 260, damping: 28 }}>
        <button className="gg-pd__close" onClick={onClose}>{Icon.x}</button>
        
        <div className="gg-pd__head">
          <div className="at-drawer-badge" style={{ background: t.color || '#00E676' }}>{Icon.trophy}</div>
          <div>
            <h3>{t.name || t.title}</h3>
            <p>{getGameName(t.game)} · {t.platform || 'PC'} · {t.modality || '5v5'}</p>
            <div className="gg-pd__badges">
              <span className={`at-badge at-badge--${t.status}`}>{STATUS_ES[t.status] || t.status}</span>
              <span className="gg-pd__badge">{fee > 0 ? `Pago · ${money(fee)}` : 'Gratis'}</span>
              {t.winner && t.winner !== '—' && <span className="gg-pd__badge">🏆 {t.winner}</span>}
            </div>
          </div>
        </div>

        <div className="gg-pd__stats">
          <div><b>{t.filled || 0}/{t.slots || 32}</b><span>Equipos</span></div>
          <div><b>{money(toNum(t.prize || t.prizePool))}</b><span>Premio</span></div>
          <div><b>{money(revenueOf(t))}</b><span>Ingresos</span></div>
          <div><b>{t.format?.replace(/_/g, ' ') || '—'}</b><span>Formato</span></div>
        </div>

        {/* 1. IDENTIFICADORES */}
        <div className="gg-pd__section">
          <h4>{Icon.fileText} Identificadores</h4>
          <div className="gg-pd__rows">
            <div>
              <span>ID público</span>
              <CopyId value={t.publicId || t.uid} label="ID público" />
            </div>
            <div>
              <span>ID interno / código</span>
              <CopyId value={t.tournamentCode || t.internalId} label="Código interno" />
            </div>
            <div>
              <span>ID del organizador (DB)</span>
              <CopyId value={t.organizer || '—'} label="ID de organizador" />
            </div>
            <div>
              <span>Código del organizador</span>
              <CopyId value={t.organizerCode || t.creator} label="Código de organizador" />
            </div>
            {t.gameCode && (
              <div>
                <span>Código de juego</span>
                <CopyId value={t.gameCode} label="Código de juego" />
              </div>
            )}
            {t.countryCode && (
              <div>
                <span>Código de país</span>
                <CopyId value={t.countryCode} label="Código de país" />
              </div>
            )}
            {t.legacyPublicId && t.legacyPublicId !== '—' && (
              <div>
                <span>ID Legacy público</span>
                <CopyId value={t.legacyPublicId} label="ID Legacy" />
              </div>
            )}
          </div>
        </div>

        {/* 2. CONFIGURACIÓN TÉCNICA Y COMPETITIVA */}
        <div className="gg-pd__section">
          <h4>{Icon.adjusts || Icon.dashboard} Configuración Técnica</h4>
          <div className="gg-pd__rows">
            <div><span>Servidor</span><b>{t.server || '—'}</b></div>
            <div><span>Serie base</span><b>{t.series || '—'}</b></div>
            <div><span>Parche activo</span><b>{t.patch || '—'}</b></div>
            <div><span>Plataforma</span><b>{t.platform || '—'}</b></div>
            <div><span>Zona Horaria</span><b>{t.timezone || 'UTC'}</b></div>
            <div><span>Visibilidad</span><b style={{ textTransform: 'capitalize' }}>{t.visibility || 'public'}</b></div>
            <div><span>Edad mínima</span><b>{t.minAge || t.ageLimit || '0'}+ años</b></div>
            <div><span>Países permitidos</span><b>{t.countries || (t.allowedCountries && t.allowedCountries.join(', ')) || 'Global'}</b></div>
            <div><span>Map Pool</span><b style={{ fontSize: '11.5px', color: 'var(--text-dim)' }}>{t.mapPool || '—'}</b></div>
            {t.notes && <div><span>Notas elegibilidad</span><b style={{ fontStyle: 'italic' }}>{t.notes}</b></div>}
          </div>
        </div>

        {/* 3. INSCRIPCIÓN / CHECK-IN / SOBRECUPO */}
        <div className="gg-pd__section">
          <h4>{Icon.users} Registro y Check-in</h4>
          <div className="gg-pd__rows">
            {t.registrationWindow?.start && (
              <div><span>Apertura registros</span><b>{new Date(t.registrationWindow.start).toLocaleDateString('es-DO')}</b></div>
            )}
            {t.registrationWindow?.end && (
              <div><span>Cierre registros</span><b>{new Date(t.registrationWindow.end).toLocaleDateString('es-DO')}</b></div>
            )}
            {t.checkinDeadline && t.checkinDeadline !== '—' && (
              <div><span>Fecha check-in</span><b>{new Date(t.checkinDeadline).toLocaleDateString('es-DO')}</b></div>
            )}
            <div><span>Permitir sobrecupo</span><b>{overcup.enabled ? 'Sí' : 'No'}</b></div>
            {overcup.enabled && (
              <>
                <div><span>Ventana 2do check-in</span><b>{overcup.secondCheckinHours || 6} horas</b></div>
                <div><span>Límite 2do check-in</span><b>{overcup.secondCheckinDeadline ? new Date(overcup.secondCheckinDeadline).toLocaleString('es-DO') : '—'}</b></div>
                <div><span>Regla inamovible</span><b>{overcup.locked ? 'Sí' : 'No'}</b></div>
              </>
            )}
            {checkin && checkin.aTiempo != null && (
              <div>
                <span>Censo de check-in</span>
                <b style={{ color: 'var(--text-dim)' }}>
                  A tiempo: <span style={{ color: '#22c55e' }}>{checkin.aTiempo}</span> · 
                  Tarde: <span style={{ color: '#f59e0b' }}>{checkin.tarde}</span> · 
                  No-show: <span style={{ color: 'var(--danger)' }}>{checkin.noShow}</span>
                </b>
              </div>
            )}
          </div>
        </div>

        {/* 4. PREMIACIÓN Y BOLSA */}
        <div className="gg-pd__section">
          <h4>{Icon.gem} Premiación</h4>
          <div className="gg-pd__rows">
            <div><span>Tipo de premio</span><b>{t.prizeType || 'Dinero'}</b></div>
            {t.prizeFirst && t.prizeFirst !== '0' && <div><span>1er Lugar</span><b style={{ color: '#22c55e' }}>{money(t.prizeFirst)} {t.currency || 'USD'}</b></div>}
            {t.prizeSecond && t.prizeSecond !== '0' && <div><span>2do Lugar</span><b>{money(t.prizeSecond)} {t.currency || 'USD'}</b></div>}
            {t.prizeThird && t.prizeThird !== '0' && <div><span>3er Lugar</span><b>{money(t.prizeThird)} {t.currency || 'USD'}</b></div>}
            {t.prizeItems && t.prizeItems !== '0' && (
              <div style={{ flexDirection: 'column', alignItems: 'flex-start', gap: '4px' }}>
                <span>Objetos y periféricos</span>
                <b style={{ fontSize: '12px', color: 'var(--text-dim)' }}>{t.prizeItems}</b>
              </div>
            )}
            {t.prizes && t.prizes.length > 0 && (
              <div style={{ flexDirection: 'column', alignItems: 'flex-start', gap: '4px' }}>
                <span>Desglose de Premios</span>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginTop: '4px' }}>
                  {t.prizes.map((p, idx) => (
                    <span key={idx} className="gg-pd__badge" style={{ fontSize: '11px' }}>
                      {p.place}: <b>{p.amount > 0 ? money(p.amount) : ''} {p.items || ''}</b>
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* 5. STAFF DEL EVENTO */}
        {(staff.director || staff.admin || (staff.arbitros && staff.arbitros.length > 0)) && (
          <div className="gg-pd__section">
            <h4>{Icon.users || Icon.shield} Staff Técnico</h4>
            <div className="gg-pd__rows">
              {staff.director && <div><span>Director del evento</span><b>{staff.director}</b></div>}
              {staff.admin && <div><span>Administrador de sala</span><b>{staff.admin}</b></div>}
              {staff.arbitros && staff.arbitros.length > 0 && (
                <div><span>Árbitros oficiales</span><b>{staff.arbitros.join(' | ')}</b></div>
              )}
            </div>
          </div>
        )}

        {/* 6. COLABORADORES Y PATROCINADORES */}
        {(sponsors.length > 0 || collaborators.length > 0) && (
          <div className="gg-pd__section">
            <h4>{Icon.star} Patrocinadores y Partners</h4>
            <div className="gg-pd__rows">
              {sponsors.length > 0 && (
                <div style={{ flexDirection: 'column', alignItems: 'flex-start', gap: '4px' }}>
                  <span>Patrocinadores oficiales</span>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '4px' }}>
                    {sponsors.map((sp, idx) => {
                      const name = typeof sp === 'string' ? sp : sp.name
                      const tier = typeof sp === 'string' ? 'Sponsor' : sp.tier
                      return (
                        <span key={idx} className="gg-pd__badge" style={{ textTransform: 'none' }}>
                          {name} <small style={{ opacity: .7, marginLeft: '4px' }}>({tier})</small>
                        </span>
                      )
                    })}
                  </div>
                </div>
              )}
              {collaborators.length > 0 && (
                <div style={{ flexDirection: 'column', alignItems: 'flex-start', gap: '4px' }}>
                  <span>Colaboradores oficiales</span>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '4px' }}>
                    {collaborators.map((c, idx) => (
                      <span key={idx} className="gg-pd__badge" style={{ textTransform: 'none', background: 'rgba(255,255,255,0.06)' }}>
                        {c}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* 7. CONTACTO Y DIFUSIÓN */}
        <div className="gg-pd__section">
          <h4>{Icon.help || Icon.messages} Contacto y Transmisión</h4>
          <div className="gg-pd__rows">
            {t.contactEmail && t.contactEmail !== '—' && (
              <div><span>Email de soporte</span><b>{t.contactEmail}</b></div>
            )}
            {t.contactPhone && t.contactPhone !== '—' && (
              <div><span>Teléfono / WhatsApp</span><b>{t.contactPhone}</b></div>
            )}
            {t.contactDiscord && t.contactDiscord !== '—' && (
              <div><span>Canal Discord</span><a href={t.contactDiscord} target="_blank" rel="noreferrer" style={{ color: 'var(--accent)', textDecoration: 'underline', fontSize: '12px' }}>{t.contactDiscord}</a></div>
            )}
            {t.streamUrl && t.streamUrl !== '—' && (
              <div><span>Streaming oficial</span><a href={safeHref(t.streamUrl)} target="_blank" rel="noreferrer" style={{ color: 'var(--accent)', textDecoration: 'underline', fontSize: '12px' }}>{t.streamUrl} {t.streamLang ? `(${t.streamLang})` : ''}</a></div>
            )}
          </div>
        </div>

        {/* 8. JURISDICCIÓN Y LEGAL */}
        {(t.jurisdiction || t.law || t.complaintsChannel) && (
          <div className="gg-pd__section">
            <h4>{Icon.lock} Términos Legales</h4>
            <div className="gg-pd__rows">
              {t.jurisdiction && <div><span>Jurisdicción</span><b>{t.jurisdiction}</b></div>}
              {t.law && <div><span>Ley Aplicable</span><b>{t.law}</b></div>}
              {t.complaintsChannel && <div><span>Canal denuncias</span><b>{t.complaintsChannel}</b></div>}
            </div>
          </div>
        )}

        {/* 9. EQUIPOS PARTICIPANTES */}
        <div className="gg-pd__section">
          <h4>{Icon.team} Equipos participantes ({participants.length})</h4>
          {participants.length === 0
            ? <p className="gg-pd__empty">Sin equipos inscritos todavía.</p>
            : (
              <div className="gg-pd__rows" style={{ gap: '10px' }}>
                {participants.map((p, idx) => (
                  <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(255,255,255,0.02)', padding: '6px 10px', borderRadius: '8px', border: '1px solid var(--line)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ color: 'var(--accent)', fontWeight: 'bold' }}>#{p.seed || (idx + 1)}</span>
                      <span>{p.name}</span>
                      {p.tag && <span style={{ opacity: .7, fontSize: '11px' }}>({p.tag})</span>}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      {p.id && p.id !== '—' && <CopyId value={p.id} label={`ID de ${p.name}`} />}
                      <span style={{ fontSize: '11.5px', color: p.eliminated ? 'var(--danger)' : '#22c55e' }}>
                        {p.record || '0-0'} {p.placement ? `· ${p.placement}` : ''} {p.eliminated ? '(eliminado)' : ''}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
        </div>

        {/* 10. REGLAS */}
        {rules.length > 0 && (
          <div className="gg-pd__section">
            <h4>{Icon.shield} Reglas</h4>
            <ul className="at-rules">{rules.map((r, i) => <li key={i}>{r}</li>)}</ul>
          </div>
        )}
      </motion.div>
    </motion.div>
  )
}

// ════════ DETALLE (selector + sub-tabs + herramientas) ════════
function DetailSection({ tournaments, selectedTournament, setSelectedTournament, viewMode, setViewMode, activeTab, setActiveTab, onToggleDiscord }) {
  if (!tournaments.length) {
    return <div className="at-content"><p style={{ color: 'var(--text-dim)' }}>No hay torneos creados todavía.</p></div>
  }
  return (
    <>
      {/* Tournament selector */}
      <div className="at-tournament-selector">
        <div className="at-tournament-tabs">
          {tournaments.map(t => (
            <button
              key={t.id}
              className={`at-tournament-tab ${selectedTournament.id === t.id ? 'active' : ''}`}
              onClick={() => setSelectedTournament(t)}
            >
              <span className="at-tournament-tab__game">{getGameName(t.game)}</span>
              <span className="at-tournament-tab__title">{t.title}</span>
              <span className={`at-tournament-tab__status at-tournament-tab__status--${t.status}`}>
                {STATUS_ES[t.status] || t.status}
              </span>
            </button>
          ))}
        </div>
        {selectedTournament?.id && (
          <button
            type="button"
            className={`gg-btn gg-btn--sm ${selectedTournament.discordEnabled ? 'gg-btn--primary' : 'gg-btn--ghost'}`}
            style={{ marginTop: '10px' }}
            onClick={() => onToggleDiscord(selectedTournament)}
            title="Controla si este torneo aparece en /torneo del bot de Discord"
          >
            {selectedTournament.discordEnabled ? '✅ Se juega por Discord' : 'Activar para Discord'}
          </button>
        )}
      </div>

      {/* Sub tabs */}
      <div className="at-sub-tabs">
        {[
          { id: 'general', label: 'General', icon: Icon.dashboard },
          { id: 'teams', label: 'Equipos', icon: Icon.users },
          { id: 'bracket', label: 'Bracket', icon: Icon.trophy },
          { id: 'standings', label: 'Posicionamiento', icon: Icon.chartBar },
          { id: 'wheel', label: 'Ruleta', icon: Icon.gem },
        ].map(tab => (
          <button
            key={tab.id}
            className={`at-sub-tab ${activeTab === tab.id ? 'active' : ''}`}
            onClick={() => setActiveTab(tab.id)}
          >
            {tab.icon}
            <span>{tab.label}</span>
          </button>
        ))}
      </div>

      {/* Content */}
      <AnimatePresence mode="wait">
        {activeTab === 'general' && <TournamentGeneral tournament={selectedTournament} />}
        {activeTab === 'teams' && <TournamentTeams tournament={selectedTournament} viewMode={viewMode} setViewMode={setViewMode} />}
        {activeTab === 'bracket' && <TournamentBracket key={selectedTournament.id} tournament={selectedTournament} />}
        {activeTab === 'standings' && <TournamentStandings tournament={selectedTournament} />}
        {activeTab === 'wheel' && <TournamentWheel tournament={selectedTournament} />}
      </AnimatePresence>
    </>
  )
}

// General tab
function TournamentGeneral({ tournament }) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="at-content"
    >
      <div className="at-kpi-grid">
        <div className="at-kpi">
          <div className="at-kpi__icon">{Icon.users}</div>
          <div className="at-kpi__content">
            <div className="at-kpi__value">{tournament.filled || 0}/{tournament.slots || 0}</div>
            <div className="at-kpi__label">Equipos</div>
            <div className="at-kpi__meta">{tournament.slots ? Math.round((tournament.filled || 0) / tournament.slots * 100) : 0}% lleno</div>
          </div>
        </div>
        <div className="at-kpi">
          <div className="at-kpi__icon">{Icon.creditCard}</div>
          <div className="at-kpi__content">
            <div className="at-kpi__value">{money(tournament.prizePool)}</div>
            <div className="at-kpi__label">Prize Pool</div>
          </div>
        </div>
        <div className="at-kpi">
          <div className="at-kpi__icon">{Icon.calendar}</div>
          <div className="at-kpi__content">
            <div className="at-kpi__value">{tournament.startDate}</div>
            <div className="at-kpi__label">Inicio</div>
          </div>
        </div>
        <div className="at-kpi">
          <div className="at-kpi__icon">{Icon.trophy}</div>
          <div className="at-kpi__content">
            <div className="at-kpi__value">{tournament.format || '—'}</div>
            <div className="at-kpi__label">Formato</div>
          </div>
        </div>
      </div>

      <div className="at-card-section">
        <h3>Detalles del Torneo</h3>
        <div className="at-details-grid">
          <div className="at-detail-item">
            <span className="label">Título</span>
            <span className="value">{tournament.title}</span>
          </div>
          <div className="at-detail-item">
            <span className="label">Juego</span>
            <span className="value">{getGameName(tournament.game)}</span>
          </div>
          <div className="at-detail-item">
            <span className="label">Estado</span>
            <span className={`value at-status at-status--${tournament.status}`}>{STATUS_ES[tournament.status] || tournament.status}</span>
          </div>
          <div className="at-detail-item">
            <span className="label">Capacidad</span>
            <span className="value">{tournament.slots || 0} equipos máximo</span>
          </div>
        </div>
      </div>
    </motion.div>
  )
}

// Teams tab
function TournamentTeams({ tournament, viewMode, setViewMode }) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="at-content"
    >
      <div className="at-teams-header">
        <div>
          <h3>Equipos ({tournament.teams.length})</h3>
        </div>
        <div className="at-view-toggle" style={tournament.teams.length === 0 ? { display: 'none' } : undefined}>
          <button
            className={`at-view-btn ${viewMode === 'cards' ? 'active' : ''}`}
            onClick={() => setViewMode('cards')}
            title="Vista de tarjetas"
          >
            {Icon.layoutGrid}
          </button>
          <button
            className={`at-view-btn ${viewMode === 'list' ? 'active' : ''}`}
            onClick={() => setViewMode('list')}
            title="Vista de lista"
          >
            {Icon.list}
          </button>
        </div>
      </div>

      {tournament.teams.length === 0 ? (
        <div className="at-content" style={{ color: 'var(--text-dim)', textAlign: 'center', padding: '40px 0' }}>
          Sin equipos inscritos todavía.
        </div>
      ) : viewMode === 'cards' ? (
        <div className="at-teams-cards">
          {tournament.teams.map((team, i) => (
            <motion.div
              key={team.id}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
            >
              <GGTeamCard
                team={tournamentTeamCard(team, tournament, i)}
                tier={team.position === 1 ? 'elite' : team.position <= 3 ? 'profesional' : 'semipro'}
                index={i}
                hideJoin
                viewLabel="Ver equipo"
                onView={() => {}}
                actions={[
                  {
                    key: 'position',
                    label: `#${team.position}`,
                    disabled: true,
                  },
                ]}
              />
            </motion.div>
          ))}
        </div>
      ) : (
        <div className="at-teams-list">
          <table>
            <thead>
              <tr>
                <th>Pos</th>
                <th>Nombre</th>
                <th>Miembros</th>
                <th>Victorias</th>
                <th>Derrotas</th>
                <th>Winrate</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {tournament.teams.map((team) => (
                <tr key={team.id}>
                  <td className="at-pos">#{team.position}</td>
                  <td className="at-name"><strong>{team.name}</strong></td>
                  <td>{team.members}</td>
                  <td><span className="at-wins">{team.wins}</span></td>
                  <td><span className="at-losses">{team.losses}</span></td>
                  <td>{Math.round(team.wins / (team.wins + team.losses) * 100)}%</td>
                  <td><button>{Icon.eye}</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </motion.div>
  )
}

// Bracket tab: resultados reales del bracket (bracketDoc.results). Se
// gestiona desde el panel del torneo (organizador/admin), no desde aqui --
// antes esta pestaña generaba un bracket ficticio con "Equipo 1..N" que no
// se guardaba en ningun lado.
function TournamentBracket({ tournament }) {
  const matches = tournament.matches || []
  const manageUrl = `/organizador/torneo/${tournament.id}/gestionar/bracket`
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="at-content">
      <div className="at-card-section">
        <h3>Bracket · {tournament.bracketPublished ? 'publicado' : 'sin publicar'} · {{ idle: 'sin iniciar', running: 'en curso', finished: 'finalizado' }[tournament.bracketStatus] || tournament.bracketStatus}</h3>
        {tournament.champion && <p>🏆 Campeón: <b>{tournament.champion}</b></p>}
        <Link className="gg-btn gg-btn--sm gg-btn--ghost" to={manageUrl}>{Icon.trophy} Gestionar bracket del torneo</Link>
      </div>
      {matches.length === 0 ? (
        <p style={{ color: 'var(--text-dim)', marginTop: 12 }}>Este torneo todavía no tiene partidas cargadas en el bracket.</p>
      ) : (
        <div className="at-standings-table">
          <table>
            <thead>
              <tr><th>Partida</th><th className="at-team">Equipo A</th><th className="at-stat">Marcador</th><th className="at-team">Equipo B</th><th className="at-stat">Estado</th></tr>
            </thead>
            <tbody>
              {matches.map(m => (
                <tr key={m.id}>
                  <td><code>{m.id}</code></td>
                  <td className="at-team">{m.winner && m.winner === m.a ? <strong>{m.a}</strong> : (m.a || 'Por definir')}</td>
                  <td className="at-stat">{m.scoreA ?? '-'} : {m.scoreB ?? '-'}</td>
                  <td className="at-team">{m.winner && m.winner === m.b ? <strong>{m.b}</strong> : (m.b || 'Por definir')}</td>
                  <td className="at-stat">{m.confirmed ? 'Confirmado' : (m.winner ? 'Reportado' : 'Pendiente')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </motion.div>
  )
}

function TournamentStandings({ tournament }) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="at-content"
    >
      <div className="at-standings-table">
        <table>
          <thead>
            <tr>
              <th className="at-rank">Rank</th>
              <th className="at-team">Equipo</th>
              <th className="at-stat">Partidas</th>
              <th className="at-stat">Ganancias</th>
              <th className="at-stat">Derrotas</th>
              <th className="at-stat">Winrate</th>
            </tr>
          </thead>
          <tbody>
            {[...(tournament.teams || [])].sort((a, b) => (b.wins - a.wins) || (a.losses - b.losses)).map((team, idx) => (
              <tr key={team.id} className={idx === 0 && team.wins > 0 ? 'at-leading' : ''}>
                <td className="at-rank">
                  <div className="at-medal">{idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : `#${idx + 1}`}</div>
                </td>
                <td className="at-team">
                  <strong>{team.name}</strong>
                </td>
                <td className="at-stat">{team.wins + team.losses}</td>
                <td className="at-stat"><span className="at-positive">{team.wins}</span></td>
                <td className="at-stat"><span className="at-negative">{team.losses}</span></td>
                <td className="at-stat">{team.wins + team.losses ? Math.round(team.wins / (team.wins + team.losses) * 100) : 0}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </motion.div>
  )
}

// Wheel tab
function TournamentWheel({ tournament }) {
  const [isSpinning, setIsSpinning] = useState(false)
  const [selectedTeam, setSelectedTeam] = useState(null)
  const [rotation, setRotation] = useState(0)

  const handleSpin = () => {
    if (isSpinning || tournament.teams.length === 0) return
    setIsSpinning(true)
    const spins = Math.random() * 360 + 720
    setRotation(prev => prev + spins)

    setTimeout(() => {
      setIsSpinning(false)
      const selected = tournament.teams[Math.floor(Math.random() * tournament.teams.length)]
      setSelectedTeam(selected)
    }, 2000)
  }

  if (tournament.teams.length === 0) {
    return (
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="at-content at-wheel-container">
        <h3>Ruleta de Sorteo</h3>
        <p style={{ color: 'var(--text-dim)', marginTop: 12 }}>Este torneo aún no tiene equipos inscritos para sortear.</p>
      </motion.div>
    )
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="at-content at-wheel-container"
    >
      <h3>Ruleta de Sorteo</h3>
      <div className="at-wheel-wrapper">
        <div className="at-wheel" style={{ transform: `rotate(${rotation}deg)` }}>
          {tournament.teams.map((team, i) => {
            const angle = (360 / tournament.teams.length) * i
            return (
              <div
                key={team.id}
                className="at-wheel-segment"
                style={{
                  transform: `rotate(${angle}deg)`,
                  background: `hsl(${angle}, 70%, 60%)`
                }}
              >
                <div className="at-wheel-segment-label">{team.name}</div>
              </div>
            )
          })}
        </div>
        <div className="at-wheel-pointer"></div>
      </div>

      <button
        className={`at-spin-btn ${isSpinning ? 'spinning' : ''}`}
        onClick={handleSpin}
        disabled={isSpinning}
      >
        {isSpinning ? 'Girando...' : 'GIRAR RULETA'}
      </button>

      {selectedTeam && (
        <motion.div
          className="at-wheel-result"
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
        >
          <h4>¡Ganador!</h4>
          <p>{selectedTeam.name}</p>
        </motion.div>
      )}
    </motion.div>
  )
}

