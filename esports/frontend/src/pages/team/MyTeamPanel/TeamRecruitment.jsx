import { useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import { Icon } from '../../../components/icons/Icons.jsx'
import RoleFieldInput from '../../../components/RoleFieldInput/RoleFieldInput.jsx'
import RoleProfileCard from '../../../components/RoleProfileCard/RoleProfileCard.jsx'
import ListOrText from '../../../components/RoleFieldInput/ListOrText.jsx'
import { api } from '../../../lib/api.js'
import { toast } from '../../../lib/toast.js'
import { decodeSocial, formatFieldValue } from '../../../lib/roleFieldCodec.js'
import { gameIdOf } from '../../../lib/gameMatch.js'
import { ranksFor } from '../../../data/gameRanks.js'
import { rolesFor } from '../../../data/gameRoles.js'
import '../../player/PlayerProfile/PlayerProfile.css'
import './TeamRecruitment.css'

const MAX_VACANCIES = 5
const LEVELS = [
  { id: 'casual', label: 'Casual' },
  { id: 'competitivo', label: 'Competitivo' },
  { id: 'pro', label: 'Pro' },
]

const newVacancy = () => ({ key: `v-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`, _id: '', roles: [], rankMin: '', rankMax: '', level: '', femaleOnly: false, schedule: '', languages: '', description: '' })
const toDraft = (v) => ({ key: String(v._id || newVacancy().key), _id: String(v._id || ''), roles: v.roles || [], rankMin: v.rankMin || '', rankMax: v.rankMax || '', level: v.level || '', femaleOnly: Boolean(v.femaleOnly), schedule: v.schedule || '', languages: v.languages || '', description: v.description || '' })

function shareText(team, v, url) {
  const parts = [`${team.name} busca ${v.roles.length ? v.roles.join(' / ') : 'jugadores'} en ${team.game || 'GlitchGang'}`]
  if (v.rankMin || v.rankMax) parts.push(`rango ${v.rankMin || '…'} → ${v.rankMax || '…'}`)
  if (v.level) parts.push(v.level)
  if (v.femaleOnly) parts.push('solo jugadoras')
  return `🔎 ${parts.join(' · ')}. Postúlate con tu tarjeta de Jugador Pro: ${url}`
}

// Boton RECLUTAR del equipo: el lider define que busca (roles, rango, nivel,
// femenino, horario...) y lo comparte. Lo que define aqui es lo que ven los
// jugadores en "Buscar equipo" (/jugador/buscar-equipo). Guarda con
// PUT /teams/:id/recruitment.
export default function TeamRecruitment({ team, canManage, onSaved }) {
  const teamId = team?.id || team?._id
  const gid = gameIdOf(team?.game)
  const roles = rolesFor(gid)
  const ranks = ranksFor(gid)
  const [open, setOpen] = useState(Boolean(team?.recruitment?.open))
  const [vacancies, setVacancies] = useState(() => (team?.recruitment?.vacancies || []).map(toDraft))
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const url = useMemo(() => `${window.location.origin}/equipos/${teamId}`, [teamId])

  const setVacancy = (key, patch) => { setVacancies(list => list.map(v => (v.key === key ? { ...v, ...patch } : v))); setError('') }
  const toggleRole = (key, role) => setVacancies(list => list.map(v => (
    v.key === key ? { ...v, roles: v.roles.includes(role) ? v.roles.filter(r => r !== role) : [...v.roles, role] } : v
  )))

  const save = async () => {
    if (saving || !canManage) return
    if (open && !vacancies.length) { setError('Agrega al menos una vacante para abrir el reclutamiento.'); return }
    setSaving(true)
    setError('')
    try {
      const res = await api(`/teams/${encodeURIComponent(teamId)}/recruitment`, {
        method: 'PUT',
        body: { open, vacancies: vacancies.map(({ key, _id, ...v }) => ({ ...v, game: team.game })) },
      })
      const saved = res?.recruitment || { open, vacancies: [] }
      setOpen(Boolean(saved.open))
      setVacancies((saved.vacancies || []).map(toDraft))
      onSaved?.(saved)
      toast(saved.open ? 'Reclutamiento abierto: ya te ven los jugadores' : 'Reclutamiento guardado', 'success')
    } catch (err) {
      const message = err?.message || 'No se pudo guardar el reclutamiento.'
      setError(message)
      toast(message, 'error')
    } finally {
      setSaving(false)
    }
  }

  const copy = async (v) => {
    try {
      await navigator.clipboard.writeText(shareText(team, v, url))
      toast('Mensaje copiado: pégalo donde quieras compartirlo', 'success')
    } catch { toast('No se pudo copiar. Copia el enlace manualmente.', 'error') }
  }
  const nativeShare = async (v) => {
    if (navigator.share) {
      try { await navigator.share({ title: `${team.name} está reclutando`, text: shareText(team, v, url).replace(url, ''), url }) } catch { /* cancelado */ }
    } else copy(v)
  }

  if (!team) return null

  return (
    <div className="role-dashboard plp-shell">
      <motion.div className="pnl-card" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
        <div className="pnl-card__title">{Icon.send} Reclutar</div>
        <p className="pnl-empty-hint">
          Define qué está buscando {team.name}. Los jugadores lo verán en <b>Buscar equipo</b> y podrán postularse con su tarjeta de
          Jugador Pro; tú recibes la solicitud en <b>Solicitudes</b>.
        </p>
        {!canManage && <p className="pnl-empty-hint" style={{ color: '#fbbf24' }}>Solo el líder del equipo puede editar el reclutamiento.</p>}
        <label className={`trc-open${open ? ' is-on' : ''}`}>
          <input type="checkbox" checked={open} disabled={!canManage} onChange={e => setOpen(e.target.checked)} />
          <span><b>{open ? 'Estamos reclutando' : 'No estamos reclutando'}</b><small>{open ? 'Tu equipo aparece como “Reclutando” con las vacantes de abajo.' : 'Tu equipo puede seguir apareciendo en Buscar equipo, pero sin vacantes abiertas.'}</small></span>
        </label>
      </motion.div>

      {vacancies.map((v, index) => (
        <motion.div className="pnl-card" key={v.key} initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
          <div className="pnl-card__title">
            {Icon.users} Vacante {index + 1}
            {canManage && <button type="button" className="trc-remove" onClick={() => setVacancies(list => list.filter(x => x.key !== v.key))} aria-label="Quitar vacante">{Icon.x}</button>}
          </div>
          <div className="role-form-grid">
            <div className="rfi rfi--wide">
              <span className="rfi__label">Qué roles buscamos ({team.game || 'juego del equipo'})</span>
              {roles.length ? (
                <div className="rfi__chips">
                  {roles.map(r => (
                    <button type="button" key={r} className={`rfi__chip${v.roles.includes(r) ? ' is-on' : ''}`} aria-pressed={v.roles.includes(r)} disabled={!canManage} onClick={() => toggleRole(v.key, r)}>
                      {v.roles.includes(r) && Icon.check}{r}
                    </button>
                  ))}
                </div>
              ) : (
                <input value={v.roles.join(', ')} disabled={!canManage} placeholder="ej. Mid, Support" onChange={e => setVacancy(v.key, { roles: e.target.value.split(',').map(s => s.trim()).filter(Boolean).slice(0, 6) })} />
              )}
            </div>
            <ListOrText label="Rango mínimo" value={v.rankMin} options={ranks} onChange={val => setVacancy(v.key, { rankMin: val })} optional />
            <ListOrText label="Rango máximo" value={v.rankMax} options={ranks} onChange={val => setVacancy(v.key, { rankMax: val })} optional />
            <label className="role-field">
              <span>Nivel</span>
              <select value={v.level} disabled={!canManage} onChange={e => setVacancy(v.key, { level: e.target.value })}>
                <option value="">Cualquiera</option>
                {LEVELS.map(l => <option key={l.id} value={l.id}>{l.label}</option>)}
              </select>
            </label>
            <label className={`trc-female${v.femaleOnly ? ' is-on' : ''}`}>
              <input type="checkbox" checked={v.femaleOnly} disabled={!canManage} onChange={e => setVacancy(v.key, { femaleOnly: e.target.checked })} />
              Solo jugadoras (femenino)
            </label>
            <RoleFieldInput field={{ id: 'schedule', type: 'schedule', label: 'Horario de práctica / partidas' }} value={v.schedule} onChange={val => setVacancy(v.key, { schedule: val })} />
            <RoleFieldInput field={{ id: 'languages', type: 'languages', label: 'Idioma' }} value={v.languages} onChange={val => setVacancy(v.key, { languages: val })} />
            <label className="role-field role-field--wide">
              <span>Qué buscamos (máx. 300)</span>
              <textarea rows={3} maxLength={300} value={v.description} disabled={!canManage} placeholder="Estilo de juego, requisitos, compromiso…" onChange={e => setVacancy(v.key, { description: e.target.value })} />
            </label>
          </div>

          <div className="trc-share">
            <b>{Icon.send} Compartir</b>
            {v._id ? (
              <div className="trc-share__btns">
                <button type="button" className="pnl-btn" onClick={() => copy(v)}>{Icon.copy || Icon.fileText} Copiar mensaje</button>
                <button type="button" className="pnl-btn" onClick={() => nativeShare(v)}>{Icon.send} Compartir…</button>
                <button type="button" className="pnl-btn" onClick={() => { navigator.clipboard?.writeText(url); toast('Enlace del equipo copiado', 'success') }}>{Icon.link || Icon.globe} Copiar enlace</button>
              </div>
            ) : <small>Guarda el reclutamiento para poder compartir esta vacante.</small>}
          </div>
        </motion.div>
      ))}

      {canManage && vacancies.length < MAX_VACANCIES && (
        <button type="button" className="pnl-btn trc-add" onClick={() => setVacancies(list => [...list, newVacancy()])}>{Icon.plus} Agregar vacante</button>
      )}

      {error && <p className="pnl-empty-hint" role="alert" style={{ color: '#ef4444' }}>{error}</p>}
      {canManage && (
        <div className="role-actions">
          <button type="button" className="pnl-btn pnl-btn--primary" onClick={save} disabled={saving}>{Icon.check} {saving ? 'Guardando…' : 'Guardar reclutamiento'}</button>
        </div>
      )}
    </div>
  )
}

/** "Ver tarjeta": el lider ve la tarjeta de Jugador Pro y el contacto de quien se postulo. */
export function ProCardButton({ request }) {
  const [open, setOpen] = useState(false)
  const card = request?.card
  if (!card) return null
  const contact = card.contact || {}
  const social = decodeSocial(contact.social)
  const rows = [
    contact.discord && ['Discord', contact.discord],
    contact.whatsapp && ['WhatsApp', `${contact.whatsappDial || ''} ${contact.whatsapp}`.trim()],
    social.handle && [social.platform || 'Red', social.handle],
  ].filter(Boolean)
  const user = { nick: request.nick, avatar: request.avatar, playerCode: request.playerCode }
  return (
    <>
      <button type="button" className="pnl-btn" onClick={() => setOpen(true)}>{Icon.eye} Ver tarjeta</button>
      {open && (
        <div className="trc-ov" onClick={() => setOpen(false)}>
          <div className="trc-modal pnl-card" role="dialog" aria-modal="true" onClick={e => e.stopPropagation()}>
            <button type="button" className="trc-modal__close" onClick={() => setOpen(false)} aria-label="Cerrar">{Icon.x}</button>
            <div className="pnl-card__title">{Icon.user} {request.nick} — Jugador Pro</div>
            <div className="trc-modal__body">
              <RoleProfileCard role="proplayer" user={user} details={card} width={250} />
              <div className="trc-modal__info">
                {card.objective && <p><small>Busca</small><b>{card.objective}</b></p>}
                {card.schedule && <p><small>Horario</small><b>{formatFieldValue({ type: 'schedule' }, card.schedule)}</b></p>}
                {card.languages && <p><small>Idiomas</small><b>{card.languages}</b></p>}
                <h4>Contacto</h4>
                {rows.length ? rows.map(([k, val]) => <p key={k}><small>{k}</small><b>{val}</b></p>) : <p><small>Sin contacto indicado</small></p>}
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

