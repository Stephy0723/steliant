import { useState, useEffect, useCallback } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { motion } from 'framer-motion'
import PageHeader from '../../components/PageHeader/PageHeader.jsx'
import Badge from '../../components/Badge/Badge.jsx'
import Button from '../../components/Button/Button.jsx'
import Tabs from '../../components/Tabs/Tabs.jsx'
import UniCard from '../../components/UniCard/UniCard.jsx'
import { Icon } from '../../components/icons/Icons.jsx'
import { api } from '../../lib/api.js'
import { useAuth } from '../../context/AuthContext.jsx'
import { hasTeamDraft, teamDraftUserKey, returnToTeamDraft } from '../../lib/teamEligibility.js'
import './Universidad.css'

const TABS = [
  { id: 'inicio',  label: 'Inicio' },
  { id: 'equipos', label: 'Universidades' },
  { id: 'ranking', label: 'Ranking' },
]

// ─── Microsoft Windows icon ──────────────────────────────────────────────────
const MicrosoftIcon = () => (
  <svg viewBox="0 0 21 21" width="18" height="18" fill="none" style={{ display: 'block' }}>
    <rect x="1"  y="1"  width="9" height="9" fill="#F25022"/>
    <rect x="11" y="1"  width="9" height="9" fill="#7FBA00"/>
    <rect x="1"  y="11" width="9" height="9" fill="#00A4EF"/>
    <rect x="11" y="11" width="9" height="9" fill="#FFB900"/>
  </svg>
)

// ─── Hook: cargar datos ───────────────────────────────────────────────────────
function useUniversityData() {
  const [catalog, setCatalog]     = useState([])
  const [standings, setStandings] = useState([])
  const [myStatus, setMyStatus]   = useState(null)
  const [loading, setLoading]     = useState(true)
  const [error, setError]         = useState(null)
  const { user } = useAuth()

  const reload = useCallback(() => {
    setLoading(true)
    const fetches = [
      api('/university/catalog').catch(() => []),
      api('/university/standings').catch(() => ({ standings: [] })),
    ]
    if (user) fetches.push(api('/university/me').catch(() => null))

    Promise.all(fetches).then(([cat, stand, me]) => {
      setCatalog(Array.isArray(cat) ? cat : [])
      setStandings(Array.isArray(stand?.standings) ? stand.standings : [])
      if (me !== undefined) setMyStatus(me)
    }).catch((err) => setError(err.message)).finally(() => setLoading(false))
  }, [user])

  useEffect(() => { reload() }, [reload])

  return { catalog, standings, myStatus, setMyStatus, loading, error, reload }
}

// ─── Panel: Estado de mi solicitud universitaria ──────────────────────────────
function MiSolicitudCard({ myStatus, catalog, onReload }) {
  const [unlinkError, setUnlinkError] = useState('')
  const [unlinking, setUnlinking]     = useState(false)

  const uni       = myStatus?.university
  const app       = myStatus?.application
  const msConn    = myStatus?.microsoftConnection
  const status    = uni?.verificationStatus
  const uniData   = catalog.find(u => u.id === uni?.universityId)

  if (!uni || status === 'unlinked') return null

  const unlinkUniversity = async () => {
    const warning = status === 'verified'
      ? `¿Cerrar tu sesión con ${uni.universityName}? Si estás en un equipo exclusivo de esta universidad, se te removerá de ese equipo automáticamente. No podrás verificarte con otra universidad hasta dentro de 30 días.`
      : `¿Retirar tu postulación a ${uni.universityName}?`
    if (!window.confirm(warning)) return

    setUnlinking(true)
    try {
      await api('/university/me', { method: 'DELETE' })
      onReload()
    } catch (err) {
      setUnlinkError(err.message || 'No se pudo desvincular la universidad.')
    } finally {
      setUnlinking(false)
    }
  }

  const statusConfig = {
    verified: { label: 'Verificado',          variant: 'pro',  color: '#22c55e' },
    pending:  { label: 'Sin verificar — confirma tu correo institucional', variant: 'muted', color: '#f59e0b' },
    rejected: { label: 'Rechazado',            variant: 'muted', color: '#ef4444' },
  }
  const sc = statusConfig[status] || statusConfig.pending

  return (
    <motion.div
      className="gg-uni-solicitud"
      initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
    >
      {/* Header */}
      <div className="gg-uni-solicitud__head">
        <div className="gg-uni-solicitud__logo" style={{ background: uniData?.color || '#333' }}>
          {uniData?.logo
            ? <img src={uniData.logo} alt={uni.universityTag} />
            : uni.universityTag
          }
        </div>
        <div className="gg-uni-solicitud__title">
          <Badge variant={sc.variant}
            style={{ '--badge-color': sc.color }}>
            {status === 'verified' ? '✓' : status === 'rejected' ? '✕' : '●'} {sc.label}
          </Badge>
          <h3>{uni.universityName}</h3>
          <p className="gg-uni-solicitud__sub">{uni.universityTag} · {uni.city}</p>
        </div>
      </div>

      {/* Datos de la solicitud */}
      <div className="gg-uni-solicitud__grid">
        <div className="gg-uni-solicitud__field">
          <span>Carrera</span><b>{uni.program || '—'}</b>
        </div>
        <div className="gg-uni-solicitud__field">
          <span>Nivel</span><b>{uni.academicLevel || '—'}</b>
        </div>
        <div className="gg-uni-solicitud__field">
          <span>Correo institucional</span>
          <b>{uni.institutionalEmail || '—'}</b>
        </div>
        <div className="gg-uni-solicitud__field">
          <span>Campus</span><b>{uni.campus || '—'}</b>
        </div>
        {app?.submittedAt && (
          <div className="gg-uni-solicitud__field">
            <span>Enviado</span>
            <b>{new Date(app.submittedAt).toLocaleDateString('es-DO', { day: '2-digit', month: 'short', year: 'numeric' })}</b>
          </div>
        )}
        {status === 'verified' && uni.verifiedAt && (
          <div className="gg-uni-solicitud__field">
            <span>Verificado</span>
            <b>{new Date(uni.verifiedAt).toLocaleDateString('es-DO', { day: '2-digit', month: 'short', year: 'numeric' })}</b>
          </div>
        )}
      </div>

      {/* Razón de rechazo */}
      {status === 'rejected' && uni.rejectReason && (
        <div className="gg-uni-solicitud__reject">
          <span>{Icon.x}</span>
          <p>{uni.rejectReason}</p>
        </div>
      )}

      {/* Estado Microsoft */}
      {msConn?.verified && (
        <div className="gg-uni-solicitud__ms-connected">
          <MicrosoftIcon />
          <span>Verificado con Microsoft · {msConn.email}</span>
        </div>
      )}

      {(status === 'verified' || status === 'pending') && (
        <div className="gg-uni-solicitud__unlink">
          <button type="button" className="gg-uni-unlink-btn" onClick={unlinkUniversity} disabled={unlinking}>
            {Icon.logout} {unlinking ? 'Desvinculando…' : status === 'verified' ? 'Cerrar sesión universitaria' : 'Retirar postulación'}
          </button>
          {unlinkError && <p className="gg-uni-solicitud__ms-err">{unlinkError}</p>}
        </div>
      )}
    </motion.div>
  )
}

// ─── Verificación con Microsoft (cuenta institucional) ───────────────────────
// Única forma de unirse a una universidad: el estudiante inicia sesión con la
// cuenta Microsoft que le dio su universidad (eso prueba que el correo es suyo,
// sin códigos). La universidad se detecta por el dominio de esa cuenta; luego
// elige campus/carrera/nivel y queda verificado.
const ACADEMIC_LEVELS = ['Tecnico', 'Grado', 'Postgrado', 'Maestria', 'Doctorado']

function UniversityMicrosoftVerify({ catalog, pending, notice, onVerified }) {
  const [form, setForm]   = useState({ campus: '', program: '', academicLevel: 'Grado', admissionYear: '' })
  const [busy, setBusy]   = useState(false)
  const [error, setError] = useState(notice?.type === 'error' ? notice.message : '')
  const [info, setInfo]   = useState(notice?.type === 'info' ? notice.message : '')

  const uni = pending ? catalog.find(u => u.id === pending.universityId) : null
  const set = (key) => (e) => setForm(f => ({ ...f, [key]: e.target.value }))

  const uniId = uni?.id
  useEffect(() => {
    setForm(f => ({ ...f, campus: uni?.campuses?.[0] || '', program: '' }))
  }, [uniId]) // eslint-disable-line react-hooks/exhaustive-deps

  const signIn = async () => {
    setBusy(true); setError(''); setInfo('')
    try {
      const res = await api('/university/microsoft/start')
      window.location.assign(res.authorizationUrl)
    } catch (err) {
      setError(err.message || 'No se pudo iniciar la verificación con Microsoft.')
      setBusy(false)
    }
  }

  const canConfirm = uni && form.campus && form.program && form.academicLevel && !busy
  const confirm = async (e) => {
    e?.preventDefault()
    if (!canConfirm) return
    setBusy(true); setError(''); setInfo('')
    try {
      await api('/university/microsoft/confirm', { method: 'POST', body: JSON.stringify(form) })
      onVerified()
    } catch (err) {
      setError(err.message || 'No se pudo completar la verificación.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <motion.div id="verificar-universidad" className="gg-uni-verify" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
      <div className="gg-uni-verify__head">
        <span className="gg-uni-verify__icon">{Icon.award}</span>
        <div>
          <h3>Únete a tu universidad</h3>
          <p>Inicia sesión con la cuenta Microsoft que te dio tu universidad y quedas verificado. Sin códigos.</p>
        </div>
      </div>

      {!pending ? (
        <div className="gg-uni-verify__form">
          <div className="gg-uni-verify__full gg-uni-verify__detect">
            <span className="gg-uni-verify__hint">Tu universidad se detecta automáticamente por tu cuenta institucional (por ejemplo, tu.matricula@tuuniversidad.edu.do).</span>
          </div>
          <div className="gg-uni-verify__full gg-uni-verify__actions">
            <button type="button" className="gg-uni-ms-btn" onClick={signIn} disabled={busy}>
              <MicrosoftIcon />
              <span>{busy ? 'Abriendo Microsoft…' : 'Verificar con mi cuenta de la universidad'}</span>
            </button>
          </div>
        </div>
      ) : (
        <form className="gg-uni-verify__form" onSubmit={confirm}>
          <div className="gg-uni-verify__full gg-uni-verify__detect">
            {uni?.logo && <img src={uni.logo} alt={uni.tag} />}
            <span>
              {uni ? <><b>{uni.name}</b> · cuenta <b>{pending.email}</b> comprobada</> : 'Tu universidad ya no está en el catálogo.'}
            </span>
          </div>

          {uni && (
            <>
              <label>
                <span>Campus</span>
                <select value={form.campus} onChange={set('campus')}>
                  {(uni.campuses || []).map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </label>
              <label>
                <span>Nivel</span>
                <select value={form.academicLevel} onChange={set('academicLevel')}>
                  {ACADEMIC_LEVELS.map(l => <option key={l} value={l}>{l}</option>)}
                </select>
              </label>
              <label className="gg-uni-verify__full">
                <span>Carrera</span>
                <select value={form.program} onChange={set('program')}>
                  <option value="">Elige tu carrera…</option>
                  {(uni.programs || []).map(p => <option key={p} value={p}>{p}</option>)}
                </select>
              </label>
              <label>
                <span>Año de ingreso (opcional)</span>
                <input type="number" min="1980" max={new Date().getFullYear() + 1} value={form.admissionYear} onChange={set('admissionYear')} />
              </label>
            </>
          )}

          <div className="gg-uni-verify__full gg-uni-verify__actions">
            <Button variant="ghost" type="button" onClick={signIn} disabled={busy}>
              Usar otra cuenta
            </Button>
            <Button variant="primary" type="submit" disabled={!canConfirm}>
              {busy ? 'Verificando…' : 'Terminar verificación'}
            </Button>
          </div>
        </form>
      )}

      {info && <p className="gg-uni-verify__ok">{info}</p>}
      {error && <p className="gg-uni-verify__err">{error}</p>}
    </motion.div>
  )
}

// ─── Página principal ─────────────────────────────────────────────────────────
export default function Universidad() {
  const [tab, setTab]               = useState('inicio')
  const navigate                    = useNavigate()
  const { user }                    = useAuth()
  const { catalog, standings, myStatus, loading, error, reload } = useUniversityData()

  // Resultado del regreso de Microsoft (/university/microsoft/callback):
  // ?universityMs=pick|error&message=... -- se muestra una vez y se limpia la URL.
  const [searchParams, setSearchParams] = useSearchParams()
  const [msNotice] = useState(() => {
    const result = searchParams.get('universityMs')
    if (!result) return null
    return { type: result === 'error' ? 'error' : 'info', message: searchParams.get('message') || '' }
  })
  useEffect(() => {
    if (!searchParams.get('universityMs')) return
    const next = new URLSearchParams(searchParams)
    next.delete('universityMs'); next.delete('message')
    setSearchParams(next, { replace: true })
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const myUni   = myStatus?.university
  const status  = myUni?.verificationStatus
  const hasUni  = status && status !== 'unlinked'

  // Posición en el ranking (solo cuando ya hay puntos repartidos) y top 3
  // ordenado por ese ranking, no por el orden del catálogo.
  const rankOf = new Map(standings.some(u => (u.points || 0) > 0) ? standings.map((u, i) => [u.id, i + 1]) : [])
  const top3 = rankOf.size
    ? [...catalog].sort((a, b) => (rankOf.get(a.id) || 999) - (rankOf.get(b.id) || 999)).slice(0, 3)
    : catalog.slice(0, 3)
  const uniStats = {
    universities: catalog.length,
    teams:        catalog.reduce((a, u) => a + (u.activeTeamsCount || 0), 0),
    students:     catalog.reduce((a, u) => a + (u.verifiedStudentsCount || 0), 0),
  }

  if (loading) {
    return (
      <div className="gg-page gg-universidad">
        <PageHeader title="Universidad" sub="eSports universitario — compite, aprende, crece." />
        <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--text-muted)' }}>Cargando…</div>
      </div>
    )
  }

  return (
    <div className="gg-page gg-universidad">
      <PageHeader title="Universidad" sub="eSports universitario — compite, aprende, crece.">
        {user
          ? hasUni
            ? <Badge variant={status === 'verified' ? 'pro' : 'muted'}>
                {status === 'verified' ? `✓ ${myUni.universityTag}` : status === 'rejected' ? `Rechazado` : `Sin verificar — ${myUni.universityTag}`}
              </Badge>
            : <Button variant="primary" size="sm" onClick={() => { setTab('inicio'); setTimeout(() => document.getElementById('verificar-universidad')?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 50) }}>
                Únete a tu universidad
              </Button>
          : <Button variant="primary" size="sm" onClick={() => navigate('/login')}>
              Iniciar sesión
            </Button>
        }
      </PageHeader>

      {error && (
        <div style={{ color: 'var(--error)', fontSize: 13, padding: '4px 0' }}>
          No se pudo conectar con el servidor.
        </div>
      )}

      {/* Vino desde Crear equipo (Universitario) con un borrador guardado */}
      {user && hasTeamDraft(teamDraftUserKey(user)) && (
        <div className={`gg-uni-return ${status === 'verified' ? 'ready' : ''}`}>
          <span className="gg-uni-return__ic">{status === 'verified' ? Icon.check : Icon.team}</span>
          <div>
            <b>{status === 'verified' ? 'Universidad verificada' : 'Tu equipo está guardado'}</b>
            <small>{status === 'verified'
              ? 'Ya puedes publicar tu equipo universitario.'
              : 'Verifícate con tu cuenta de la universidad y vuelve a terminarlo donde lo dejaste.'}</small>
          </div>
          <Button variant={status === 'verified' ? 'primary' : 'ghost'} size="sm" onClick={() => returnToTeamDraft(navigate)}>
            Volver a mi equipo
          </Button>
        </div>
      )}

      <Tabs tabs={TABS} value={tab} onChange={setTab} />

      {/* ── INICIO ── */}
      {tab === 'inicio' && (
        <div className="gg-uni-inicio">

          {/* Panel Mi Solicitud (si el usuario tiene una) */}
          {user && hasUni && (
            <MiSolicitudCard
              myStatus={myStatus}
              catalog={catalog}
              onReload={reload}
            />
          )}

          {user && status !== 'verified' && (
            <UniversityMicrosoftVerify
              key={msNotice?.message || 'ms-verify'}
              catalog={catalog}
              pending={myStatus?.pendingMicrosoftVerification}
              notice={msNotice}
              onVerified={reload}
            />
          )}

          {/* Hero */}
          <motion.div
            className="gg-uni-hero"
            initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
          >
            <div className="gg-uni-hero__content">
              <span className="gg-uni-eyebrow">{Icon.bolt} Temporada activa // Circuito universitario</span>
              <h2 data-text="Las universidades dominicanas compiten por la gloria digital">Las universidades dominicanas compiten por la gloria digital</h2>
              <p>
                {uniStats.universities > 0
                  ? `${uniStats.universities} universidades y ${uniStats.students} estudiantes verificados forman el circuito universitario de GlitchGang.`
                  : 'El circuito universitario de GlitchGang está abierto. Sé parte de la primera generación.'}
              </p>
              <div className="gg-uni-hero__actions">
                {!user && <Button variant="primary" onClick={() => navigate('/login')}>Iniciar sesión</Button>}
                <Button variant="ghost" onClick={() => setTab('ranking')}>
                  Ver ranking
                </Button>
              </div>
            </div>
            <div className="gg-uni-hero__glow" />
          </motion.div>

          {/* Stats */}
          <div className="gg-uni-stats">
            {[
              { label: 'Universidades', value: uniStats.universities, icon: Icon.users },
              { label: 'Equipos activos', value: uniStats.teams, icon: Icon.team },
              { label: 'Estudiantes verificados', value: uniStats.students, icon: Icon.user },
            ].map((s, i) => (
              <motion.div
                key={s.label} className="gg-uni-stat"
                initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                transition={{ delay: .05 * i }}
              >
                <div className="gg-uni-stat__icon">{s.icon}</div>
                <span className="gg-uni-stat__val">{s.value}</span>
                <span className="gg-uni-stat__lbl">{s.label}</span>
              </motion.div>
            ))}
          </div>

          {/* Top 3 */}
          {top3.length > 0 && (
            <section>
              <h3 className="gg-uni-section-title">Top universidades</h3>
              <div className="gg-uni-top3">
                {top3.map((u, i) => (
                  <UniCard key={u.id} uni={adaptUni(u, rankOf)} delay={i * 0.07} />
                ))}
              </div>
            </section>
          )}

        </div>
      )}

      {/* ── UNIVERSIDADES ── */}
      {tab === 'equipos' && (
        <div className="gg-uni-equipos">
          {catalog.length === 0
            ? <p style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '40px 0' }}>No hay universidades registradas aún.</p>
            : <div className="gg-uni-grid">
                {catalog.map((u, i) => (
                  <UniCard key={u.id} uni={adaptUni(u, rankOf)} delay={i * 0.06} />
                ))}
              </div>
          }
        </div>
      )}

      {/* ── RANKING ── */}
      {tab === 'ranking' && (
        <div className="gg-uni-ranking">
          {standings.length === 0
            ? <p style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '40px 0' }}>
                Aún no hay torneos universitarios finalizados. El ranking se actualizará cuando terminen las primeras competencias.
              </p>
            : <div className="gg-uni-rank-table">
                <div className="gg-uni-rank-table__header">
                  <span>Pos</span>
                  <span>Universidad</span>
                  <span>Ciudad</span>
                  <span>Equipos</span>
                  <span>Estudiantes</span>
                  <span>Puntos</span>
                </div>
                {standings.map((u, i) => (
                  <motion.div
                    key={u.id}
                    className={`gg-uni-rank-row ${myUni?.universityId === u.id ? 'mine' : ''}`}
                    onClick={() => navigate(`/universidad/${u.id}`)}
                    role="link"
                    initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * .05 }}
                  >
                    <span className={`gg-uni-rank-pos${i < 3 && (u.points || 0) > 0 ? ` pos${i + 1}` : ''}`}>{i + 1}</span>
                    <span className="gg-uni-rank-name">
                      <span
                        className="gg-uni-rank-badge"
                        style={{ background: u.color || '#333', padding: u.logo ? 2 : undefined }}
                      >
                        {u.logo
                          ? <img src={u.logo} alt={u.tag} style={{ width: 28, height: 28, objectFit: 'contain', borderRadius: 6, display: 'block' }} />
                          : u.tag
                        }
                      </span>
                      {u.name}
                      {myUni?.universityId === u.id && <Badge variant="pro">Tú</Badge>}
                    </span>
                    <span>{u.city}</span>
                    <span>{u.activeTeamsCount || 0}</span>
                    <span>{u.verifiedStudentsCount || 0}</span>
                    <span className="pts">{(u.points || 0).toLocaleString()}</span>
                  </motion.div>
                ))}
              </div>
          }
        </div>
      )}
    </div>
  )
}

function adaptUni(u, rankOf = new Map()) {
  return {
    id:        u.id,
    name:      u.name,
    shortName: u.tag,
    acronym:   u.tag,
    color:     u.color || '#00E676',
    city:      u.city || '',
    country:   'Rep. Dom.',
    teams:     u.activeTeamsCount || 0,
    players:   u.verifiedStudentsCount || 0,
    verified:  Boolean(u.verified),
    stats:     { wins: u.stats?.matchWins || 0, championships: u.stats?.championships || 0, points: u.points || 0 },
    logo:      u.logo || null,
    rank:      rankOf.get(u.id) || null,
  }
}

