import { useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../../context/AuthContext.jsx'
import { Icon } from '../../../components/icons/Icons.jsx'
import RoleFieldInput from '../../../components/RoleFieldInput/RoleFieldInput.jsx'
import ListOrText from '../../../components/RoleFieldInput/ListOrText.jsx'
import RoleProfileCard from '../../../components/RoleProfileCard/RoleProfileCard.jsx'
import ShowcaseToggle from '../../../components/RoleProfileCard/ShowcaseToggle.jsx'
import { api } from '../../../lib/api.js'
import { toast } from '../../../lib/toast.js'
import { getProPlayerProfile, hasProPlayerProfile } from '../../../lib/roleCard.js'
import { GAMES_BY_CATEGORY } from '../../../data/games.js'
import { gameName } from '../../../../../shared/games.mjs'
import { checkGameAccountId, gameAccountFormat } from '../../../../../shared/gameAccountIds.mjs'
import { ranksFor } from '../../../data/gameRanks.js'
import { PLAYER_OBJECTIVES, rolesFor } from '../../../data/gameRoles.js'
import { YEARS_EXP_OPTIONS } from '../../../data/roleFieldOptions.js'
import { UNIQUE_DIAL_CODES, dialCodeFor } from '../../../data/dialCodes.js'
import '../../roles/RoleProfessionalProfile/RoleProfessionalProfile.css'
import './PlayerProfile.css'

const MAX_ENTRIES = 3
const LOCAL_KEY = 'gg-player-pro-draft'

// accountId: el ID de la cuenta en ESE juego (Riot ID, BattleTag, UID...).
// Su formato depende del juego, ver shared/gameAccountIds.mjs.
const emptyEntry = () => ({ gameId: '', accountId: '', rank: '', peakRank: '', role: '', secondaryRole: '' })

function readDraft(userId) {
  try { return JSON.parse(localStorage.getItem(`${LOCAL_KEY}:${userId}`) || 'null') } catch { return null }
}
function writeDraft(userId, value) {
  try { localStorage.setItem(`${LOCAL_KEY}:${userId}`, JSON.stringify(value)) } catch { /* almacenamiento no disponible */ }
}

// PERFIL PROFESIONAL de jugador. Todos ya tienen su perfil de jugador desde que
// se registran (eso no cambia): este es la tarjeta con la que se presentan ante
// los equipos -- juegos con rango y rol, horario, idiomas, contacto. Con ella se
// postulan desde "Buscar equipo" (/jugador/buscar-equipo). Reclutar jugadores se
// hace desde un equipo. Se guarda en gamerProfile.pro (y el rango tambien en
// gamerProfile.ranks, compatible con la Ficha de EditProfile).
export default function PlayerProfile() {
  const { user, updateUser } = useAuth()
  const navigate = useNavigate()
  const userId = String(user?._id || user?.id || '')
  const stored = getProPlayerProfile(user)
  const initial = useMemo(() => {
    const base = (stored && Object.keys(stored).length ? stored : readDraft(userId)) || {}
    return {
      entries: Array.isArray(base.entries) && base.entries.length
        ? base.entries.map(e => ({ ...emptyEntry(), gameId: e.gameId, accountId: e.accountId || '', rank: e.rank, peakRank: e.peakRank, role: e.role, secondaryRole: e.secondaryRole }))
        : [emptyEntry()],
      photo: base.photo || '',
      schedule: base.schedule || '',
      languages: base.languages || '',
      objective: base.objective || '',
      experience: base.experience || '',
      about: base.about || '',
      contact: {
        discord: base.contact?.discord ?? user?.social?.discord ?? user?.discord?.username ?? '',
        whatsappDial: base.contact?.whatsappDial || dialCodeFor(user?.countryCode) || '+1',
        whatsapp: base.contact?.whatsapp ?? '',
        social: base.contact?.social || '',
      },
    }
  }, [stored, userId, user])

  const [form, setForm] = useState(initial)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const set = (patch) => { setForm(prev => ({ ...prev, ...patch })); setError('') }
  const setContact = (patch) => set({ contact: { ...form.contact, ...patch } })
  const setEntry = (index, patch) => set({ entries: form.entries.map((e, i) => (i === index ? { ...e, ...patch } : e)) })
  const changeGame = (index, gameId) => setEntry(index, { ...emptyEntry(), gameId })

  // Un juego eSport aparece en su categoria y tambien en 'eSports': se lista una
  // sola vez (eSports al final para que gane la categoria de su genero).
  const categories = useMemo(() => {
    const seen = new Set()
    const ordered = [...GAMES_BY_CATEGORY.filter(c => c.id !== 'esports'), ...GAMES_BY_CATEGORY.filter(c => c.id === 'esports')]
    return ordered
      .map(c => ({ ...c, games: c.games.filter(g => !seen.has(g.id) && seen.add(g.id)) }))
      .filter(c => c.games.length)
  }, [])
  const usedIds = new Set(form.entries.map(e => e.gameId).filter(Boolean))

  // Lo minimo para poder postularse a un equipo.
  const missing = useMemo(() => {
    const out = []
    const used = form.entries.filter(e => e.gameId)
    if (!used.length) out.push('un juego')
    else {
      if (used.some(e => !e.rank)) out.push('tu rango')
      if (used.some(e => !e.role)) out.push('tu rol o línea')
    }
    if (!form.schedule) out.push('tu horario')
    if (!form.contact.discord.trim() && !form.contact.whatsapp.trim() && !form.contact.social) out.push('un contacto')
    return out
  }, [form])

  const save = async () => {
    if (saving) return
    // Un ID con formato imposible para su juego no se guarda (Riot ID sin #TAG,
    // UID con letras...). Los formatos no oficiales solo avisan.
    const badId = form.entries
      .filter(e => e.gameId)
      .map(e => ({ e, check: checkGameAccountId(e.gameId, e.accountId) }))
      .find(({ check }) => !check.ok && check.strict)
    if (badId) {
      setError(`${gameName(badId.e.gameId)}: ${badId.check.message}`)
      return
    }
    setSaving(true)
    setError('')
    const entries = form.entries
      .filter(e => e.gameId)
      .map(e => ({ ...e, accountId: checkGameAccountId(e.gameId, e.accountId).value }))
    const payload = { ...form, entries, updatedAt: new Date().toISOString() }
    writeDraft(userId, payload)
    try {
      const ranks = { ...(user?.gamerProfile?.ranks || {}) }
      for (const e of entries) if (e.rank) ranks[e.gameId] = e.rank
      const result = await api('/profile/me', { method: 'PATCH', body: { gamerProfile: { pro: payload, ranks } } })
      if (result?.user) updateUser(result.user)
      const persisted = result?.user?.gamerProfile?.pro
      if (persisted && Object.keys(persisted).length) {
        toast(missing.length ? 'Perfil guardado. Aún falta completar algunos datos.' : 'Perfil profesional de jugador guardado', missing.length ? 'info' : 'success')
      } else {
        toast('Guardado en este navegador; el servidor aún no almacena este perfil.', 'info')
      }
    } catch (err) {
      const message = err?.message || 'No se pudo guardar en el servidor.'
      setError(message)
      toast(`${message} Quedó guardado en este navegador.`, 'error')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="plp-shell role-dashboard">
      <div className="rpp">
        <div className="rpp__main">
          <motion.div className="pnl-card pnl-section-gap" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            <div className="pnl-card__title">{Icon.gamepad} Perfil profesional de jugador</div>
            <p className="pnl-empty-hint">
              Tu perfil de jugador ya existe desde que te registraste. Este es tu perfil <b>profesional</b>: la tarjeta con la que te
              presentas ante los equipos cuando buscas dónde jugar.
            </p>
            <RoleFieldInput field={{ id: 'photo', type: 'image', label: 'Foto profesional', help: 'Esta foto se guarda solo para tu perfil de jugador.' }} value={form.photo} onChange={photo => set({ photo })} user={user} />
            <div className="plp__entries">
              {form.entries.map((entry, index) => {
                const ranks = ranksFor(entry.gameId)
                const roles = rolesFor(entry.gameId)
                return (
                  <div className="plp__entry" key={index}>
                    <div className="plp__entry-head">
                      <label className="role-field plp__grow">
                        <span>Juego</span>
                        <select value={entry.gameId} onChange={e => changeGame(index, e.target.value)}>
                          <option value="">Selecciona un juego…</option>
                          {categories.map(c => (
                            <optgroup key={c.id} label={c.name}>
                              {c.games.filter(g => g.id === entry.gameId || !usedIds.has(g.id)).map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
                            </optgroup>
                          ))}
                        </select>
                      </label>
                      {form.entries.length > 1 && (
                        <button type="button" className="plp__remove" onClick={() => set({ entries: form.entries.filter((_, i) => i !== index) })} aria-label="Quitar juego">{Icon.x}</button>
                      )}
                    </div>
                    {entry.gameId && (() => {
                      const format = gameAccountFormat(entry.gameId)
                      const check = checkGameAccountId(entry.gameId, entry.accountId)
                      return (
                        <label className="role-field plp__account">
                          <span>{format.label} <small className="plp__optional">(opcional)</small></span>
                          <input
                            value={entry.accountId}
                            onChange={e => setEntry(index, { accountId: e.target.value })}
                            onBlur={() => check.ok && check.value !== entry.accountId && setEntry(index, { accountId: check.value })}
                            placeholder={format.placeholder}
                            data-no-translate
                            data-invalid={(!check.ok && check.strict) || undefined}
                            spellCheck={false}
                            autoComplete="off"
                          />
                          <small className={`plp__account-hint ${!check.ok ? (check.strict ? 'is-error' : 'is-warn') : ''}`}>
                            {!check.ok ? check.message : format.hint}
                          </small>
                        </label>
                      )
                    })()}
                    {entry.gameId && (
                      <div className="role-form-grid">
                        <ListOrText label="Rango actual" value={entry.rank} options={ranks} onChange={v => setEntry(index, { rank: v })} placeholder="ej. Diamante II" />
                        <ListOrText label="Rango más alto alcanzado" value={entry.peakRank} options={ranks} onChange={v => setEntry(index, { peakRank: v })} optional />
                        <ListOrText label="Rol / línea principal" value={entry.role} options={roles} onChange={v => setEntry(index, { role: v })} placeholder="ej. Mid" />
                        <ListOrText label="Rol / línea secundaria" value={entry.secondaryRole} options={roles} onChange={v => setEntry(index, { secondaryRole: v })} optional />
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
            {form.entries.length < MAX_ENTRIES && (
              <button type="button" className="pnl-btn plp__add" onClick={() => set({ entries: [...form.entries, emptyEntry()] })}>{Icon.plus} Agregar otro juego</button>
            )}
          </motion.div>

          <motion.div className="pnl-card pnl-section-gap" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            <div className="pnl-card__title">{Icon.clock} Disponibilidad e idiomas</div>
            <div className="role-form-grid">
              <RoleFieldInput field={{ id: 'schedule', type: 'schedule', label: 'Horario disponible' }} value={form.schedule} onChange={v => set({ schedule: v })} />
              <RoleFieldInput field={{ id: 'languages', type: 'languages', label: 'Idiomas que hablas' }} value={form.languages} onChange={v => set({ languages: v })} />
            </div>
          </motion.div>

          <motion.div className="pnl-card pnl-section-gap" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            <div className="pnl-card__title">{Icon.chat} Contacto</div>
            <p className="pnl-empty-hint">Solo lo ve el equipo al que te postulas; no aparece en tu perfil público. Agrega al menos uno.</p>
            <div className="role-form-grid">
              <label className="role-field">
                <span>Discord</span>
                <input value={form.contact.discord} maxLength={80} placeholder="usuario o enlace de invitación" onChange={e => setContact({ discord: e.target.value })} />
              </label>
              <label className="role-field">
                <span>WhatsApp (opcional)</span>
                <div className="plp__phone">
                  <select value={form.contact.whatsappDial} onChange={e => setContact({ whatsappDial: e.target.value })} aria-label="Prefijo">
                    {UNIQUE_DIAL_CODES.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                  <input inputMode="tel" value={form.contact.whatsapp} maxLength={20} placeholder="número" onChange={e => setContact({ whatsapp: e.target.value.replace(/[^\d\s-]/g, '') })} />
                </div>
              </label>
              <RoleFieldInput field={{ id: 'social', type: 'social', label: 'Otra red social (opcional)', placeholder: 'https://… o @usuario' }} value={form.contact.social} onChange={v => setContact({ social: v })} />
            </div>
          </motion.div>

          <motion.div className="pnl-card pnl-section-gap" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            <div className="pnl-card__title">{Icon.user} Sobre ti</div>
            <div className="role-form-grid">
              <label className="role-field">
                <span>Qué buscas en un equipo</span>
                <select value={form.objective} onChange={e => set({ objective: e.target.value })}>
                  <option value="">Selecciona…</option>
                  {PLAYER_OBJECTIVES.map(o => <option key={o} value={o}>{o}</option>)}
                </select>
              </label>
              <label className="role-field">
                <span>Experiencia compitiendo</span>
                <select value={form.experience} onChange={e => set({ experience: e.target.value })}>
                  <option value="">Selecciona…</option>
                  <option value="Sin experiencia">Sin experiencia, quiero empezar</option>
                  {YEARS_EXP_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}
                </select>
              </label>
              <label className="role-field role-field--wide">
                <span>Preséntate (máx. 300)</span>
                <textarea rows={4} maxLength={300} value={form.about} placeholder="Cómo juegas, tus fortalezas, qué aportas a un equipo…" onChange={e => set({ about: e.target.value })} />
              </label>
            </div>
            {error && <p className="pnl-empty-hint" role="alert" style={{ color: '#ef4444' }}>{error}</p>}
            <div className="role-actions">
              {missing.length > 0 && <span className="pnl-empty-hint">Para postularte falta: {missing.join(', ')}</span>}
              <button className="pnl-btn" type="button" onClick={() => navigate('/jugador/buscar-equipo')}>{Icon.search} Buscar equipo</button>
              <button className="pnl-btn pnl-btn--primary" type="button" onClick={save} disabled={saving}>
                {Icon.check} {saving ? 'Guardando...' : 'Guardar perfil profesional'}
              </button>
            </div>
          </motion.div>
        </div>

        <aside className="rpp__side">
          <div className="rpp__side-title">Tu tarjeta de Jugador Pro</div>
          <RoleProfileCard role="proplayer" user={user} details={{ ...form, entries: form.entries.filter(e => e.gameId) }} width={280} />
          <p className="rpp__hint">Así te ven los equipos. Haz clic para girarla y ver el detalle. Se actualiza mientras editas.</p>
          {hasProPlayerProfile(user) && <ShowcaseToggle role="proplayer" />}
        </aside>
      </div>
    </div>
  )
}

