import { cloneElement, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { useAuth } from '../../context/AuthContext.jsx'
import { Icon } from '../../components/icons/Icons.jsx'
import { GAMES, GAMES_BY_CATEGORY } from '../../data/games.js'
import { COUNTRY_ENTRIES } from '../../data/countries.js'
import { changeMapMode, defaultGameBanner, gameSelection, modalitiesFor } from '../../data/tournamentGameConfig.mjs'
import { MapsField, PatchField, ServerField } from './GameTechnicalFields.jsx'
import CompetitionFields from './CompetitionFields.jsx'
import RoleStaffSearch from '../../components/RoleStaffSearch/RoleStaffSearch.jsx'
import { SOCIAL_PLATFORMS } from '../../data/socialPlatforms.js'
import { api } from '../../lib/api.js'
import { setGGContext, APPLY_TOURNAMENT_FIELDS, TOURNAMENT_SCHEDULE_KEYS, registerGGFields } from '../../lib/ggAssistant.js'
import { tournamentsApi, uploadsApi } from '../../lib/serverApi.js'
import { SETUP_STEPS, STAFF_ROLES, SPONSOR_TIERS, AWARD_PRESETS, PLATFORM_STAFF_ROLES, STAFF_ROLE_BY_PLATFORM, REGION_PRESETS, COMPETITION_SYSTEMS, MIN_LEAD_MS, inputDateTime, scheduleWarnings, nextSeason, tournamentPayload, validateSetupStep, initialTournamentForm, initialCompetition } from '../../../../shared/tournamentSetup.mjs'
import useTournamentDraft from './useTournamentDraft.js'
import './TorneoCrear.css'

const seriesSummary = competition => {
  const overrides = Object.entries(competition?.seriesByRound || {})
  return overrides.length
    ? `${competition.defaultSeries} · ${overrides.map(([, v]) => v).join('/')} en rondas clave`
    : competition?.defaultSeries || 'BO1'
}
const COUNTRY_NAMES = new Intl.DisplayNames(['es'], { type: 'region' })
const countryName = code => COUNTRY_NAMES.of(code === 'RD' ? 'DO' : code) || code
const COUNTRIES = COUNTRY_ENTRIES.map(c => ({ ...c, name: countryName(c.code) })).sort((a, b) => a.name.localeCompare(b.name, 'es'))

function Field({ id, label, error, children, full = false }) {
  return <div className={`tc-field${full ? ' tc-field--full' : ''}`}>
    <label htmlFor={`tc-${id}`}>{label}</label>
    {cloneElement(children, { id: `tc-${id}`, 'aria-invalid': Boolean(error), 'aria-describedby': error ? `tc-${id}-error` : undefined })}
    {error && <span className="tc-error" id={`tc-${id}-error`}>{error}</span>}
  </div>
}

function RowEditor({ rows, onChange, type, onUploadImage }) {
  const sponsor = type === 'sponsors'
  const prize = type === 'prizes'
  const label = sponsor ? 'patrocinador' : prize ? 'premio' : 'integrante'
  const [uploadError, setUploadError] = useState('')
  const change = (index, key, value) => onChange(rows.map((row, i) => i === index ? { ...row, [key]: value } : row))
  const addRow = extra => onChange([...rows, { localId: crypto.randomUUID(), ...extra }])
  const placementCount = rows.filter(r => r.kind !== 'award').length
  return <div className="tc-rows">
    {rows.map((row, i) => <div className={`tc-row tc-row--${type}${prize && row.kind === 'award' ? ' tc-row--award' : ''}`} key={row.localId || row._id || i}>
      {prize ? <>
        <label>Tipo<select aria-label={`Tipo de premio ${i + 1}`} value={row.kind === 'award' ? 'award' : 'placement'} onChange={e => change(i, 'kind', e.target.value)}>
          <option value="placement">Puesto</option>
          <option value="award">Premio especial</option>
        </select></label>
        <label>{row.kind === 'award' ? 'Nombre del premio' : 'Puesto'}
          <input aria-label={`${row.kind === 'award' ? 'Nombre del premio' : 'Puesto'} ${i + 1}`} value={row.place} maxLength={80}
            list={row.kind === 'award' ? 'tc-award-presets' : undefined}
            placeholder={row.kind === 'award' ? 'MVP, Mejor novato...' : '1er lugar'}
            onChange={e => change(i, 'place', e.target.value)} /></label>
        <label>Importe<input aria-label={`Importe ${i + 1}`} type="number" min="0" step="0.01" value={row.amount} onChange={e => change(i, 'amount', e.target.value)} /></label>
        <label>Articulo o detalle<input aria-label={`Detalle ${i + 1}`} value={row.items} maxLength={300} onChange={e => change(i, 'items', e.target.value)} /></label>
      </> : <>
        <label>Nombre<input aria-label={`Nombre de ${label} ${i + 1}`} value={row.name} maxLength={120} onChange={e => change(i, 'name', e.target.value)} /></label>
        <label>{sponsor ? 'Nivel' : 'Rol'}<select aria-label={`${sponsor ? 'Nivel' : 'Rol'} ${i + 1}`} value={sponsor ? row.tier : row.role} onChange={e => change(i, sponsor ? 'tier' : 'role', e.target.value)}>
          {(sponsor ? SPONSOR_TIERS : STAFF_ROLES).map(role => <option key={role}>{role}</option>)}
        </select></label>
        {sponsor && <>
          <label>Enlace<input type="url" aria-label={`Enlace ${i + 1}`} value={row.link} maxLength={1000} onChange={e => change(i, 'link', e.target.value)} /></label>
          <label>Aporte<input aria-label={`Aporte ${i + 1}`} value={row.contribution} maxLength={500} onChange={e => change(i, 'contribution', e.target.value)} /></label>
          <label className="tc-row__logo-field">Logo
            <div className="tc-row__logo">
              {row.logo
                ? <img src={row.logo} alt="" />
                : <span className="tc-row__logo-ph">{Icon.upload}</span>}
              <label className="tc-button tc-button--quiet tc-button--sm">
                {row.logo ? 'Cambiar' : 'Subir'}
                <input type="file" className="tc-file-input" accept="image/png,image/jpeg,image/webp"
                  onChange={async e => {
                    const file = e.target.files?.[0]; e.target.value = ''
                    if (!file || !onUploadImage) return
                    setUploadError('')
                    try { change(i, 'logo', await onUploadImage(file)) }
                    catch (err) { setUploadError(err.message || 'No se pudo subir el logo.') }
                  }} />
              </label>
              {row.logo && <button type="button" className="tc-icon-button" title="Quitar logo" aria-label="Quitar logo" onClick={() => change(i, 'logo', '')}>{Icon.trash}</button>}
            </div>
          </label>
        </>}
      </>}
      <button type="button" className="tc-icon-button" title={`Eliminar ${label} ${i + 1}`} aria-label={`Eliminar ${label} ${i + 1}`} onClick={() => onChange(rows.filter((_, index) => index !== i))}>{Icon.trash}</button>
    </div>)}
    {sponsor && uploadError && <p className="tc-error">{uploadError}</p>}
    {prize && <datalist id="tc-award-presets">{AWARD_PRESETS.map(a => <option key={a} value={a} />)}</datalist>}
    <div className="tc-rows__add">
      {prize ? <>
        <button type="button" className="tc-button tc-button--quiet" disabled={rows.length >= 30} onClick={() => addRow({ kind: 'placement', place: `${placementCount + 1}º lugar`, amount: 0, items: '' })}>{Icon.plus} Agregar puesto</button>
        <button type="button" className="tc-button tc-button--quiet" disabled={rows.length >= 30} onClick={() => addRow({ kind: 'award', place: '', amount: 0, items: '' })}>{Icon.star} Agregar premio especial</button>
      </> : <button type="button" className="tc-button tc-button--quiet" disabled={rows.length >= 30} onClick={() => addRow(sponsor ? { name: '', tier: 'Colaborador', link: '', contribution: '', logo: '' } : { name: '', role: 'Arbitro' })}>{Icon.plus} Agregar {label}</button>}
    </div>
  </div>
}

export default function TorneoCrear() {
  const { user } = useAuth()
  return user ? <TournamentWizard key={user._id || user.id} user={user} /> : null
}

function TournamentWizard({ user }) {
  const navigate = useNavigate()
  const { updateUser } = useAuth()
  const { draft, ready, status, update, flush, clear, discard } = useTournamentDraft(user)
  const [errors, setErrors] = useState({})
  const [notice, setNotice] = useState('')
  const [busy, setBusy] = useState(false)
  const [scheduledPublishAt, setScheduledPublishAt] = useState('')
  const [uploads, setUploads] = useState(0)
  const [socials, setSocials] = useState(() => Object.fromEntries(SOCIAL_PLATFORMS.map(p => [p.id, user?.social?.[p.id] || ''])))
  const [socialsState, setSocialsState] = useState('')
  const [tournaments, setTournaments] = useState([])
  const [source, setSource] = useState('')
  const [replacing, setReplacing] = useState(false)
  const [countrySearch, setCountrySearch] = useState('')
  const [discordAccess, setDiscordAccess] = useState('none')
  const [discordReqBusy, setDiscordReqBusy] = useState(false)
  const panelRef = useRef(null)
  const current = useRef(draft)
  current.current = draft
  const form = draft?.form
  const step = draft?.step || 0

  // GG (asistente): publica los valores actuales para que "lea" el formulario y
  // aplica las fechas que el usuario acepte desde el chat.
  const updateRef = useRef(update)
  updateRef.current = update
  useEffect(() => {
    if (!form) return
    const { title, game, timezone, maxSlots, registrationStart, registrationEnd, checkinDeadline, date, endDate } = form
    setGGContext('tournamentForm', { title, game, timezone, maxSlots, registrationStart, registrationEnd, checkinDeadline, date, endDate })
  }, [form])
  useEffect(() => () => setGGContext('tournamentForm', null), [])
  // Textos que GG puede redactar aunque el usuario este en otro paso.
  useEffect(() => {
    if (!form) return
    return registerGGFields('torneo', {
      label: 'Torneo',
      scope: '.tc-wizard',
      fields: [
        { key: 'description', label: 'Descripción', value: form.description, maxLength: 2000 },
        { key: 'rules', label: 'Reglamento', value: form.rules, maxLength: 15000 },
      ],
      apply: (key, text) => {
        if (!['description', 'rules'].includes(key)) return
        updateRef.current(latest => ({ ...latest, [key]: text.slice(0, key === 'rules' ? 15000 : 2000) }))
        setErrors(prev => ({ ...prev, [key]: undefined }))
        setNotice(key === 'rules' ? 'GG escribio el reglamento. Revisalo y ajustalo a tu gusto.' : 'GG escribio la descripcion. Revisala y ajustala a tu gusto.')
      },
    })
  }, [form?.description, form?.rules, Boolean(form)])
  useEffect(() => {
    const onApply = event => {
      const fields = {}
      for (const key of TOURNAMENT_SCHEDULE_KEYS) if (typeof event.detail?.[key] === 'string') fields[key] = event.detail[key]
      if (!Object.keys(fields).length) return
      updateRef.current(latest => ({ ...latest, ...fields }), 2)
      setErrors(prev => ({ ...prev, ...Object.fromEntries(Object.keys(fields).map(key => [key, undefined])) }))
      setNotice('GG aplico las fechas propuestas. Revisalas en el paso Calendario antes de continuar.')
    }
    window.addEventListener(APPLY_TOURNAMENT_FIELDS, onApply)
    return () => window.removeEventListener(APPLY_TOURNAMENT_FIELDS, onApply)
  }, [])

  useEffect(() => {
    if (!ready || !form?.gameId || form.banner) return
    const banner = defaultGameBanner(GAMES.find(game => game.id === form.gameId))
    if (banner) {
      update(latest => latest.banner || latest.gameId !== form.gameId ? latest : { ...latest, banner, bannerName: '' })
      setErrors(previous => ({ ...previous, banner: undefined }))
    }
  }, [ready, form?.gameId, form?.banner])

  useEffect(() => {
    tournamentsApi.mine().then(data => setTournaments(data.tournaments || [])).catch(() => setNotice('No se pudieron cargar tus torneos anteriores.'))
    api('/organizations/discord-access').then(d => setDiscordAccess(d.status || 'none')).catch(() => {})
  }, [])
  const requestDiscord = async () => {
    setDiscordReqBusy(true)
    try { const d = await api('/organizations/discord-access', { method: 'POST', body: {} }); setDiscordAccess(d.status || 'pending') }
    catch (err) { setNotice(err.message || 'No se pudo enviar la solicitud de Discord.') }
    finally { setDiscordReqBusy(false) }
  }
  useEffect(() => {
    if (!uploads) return
    const warn = event => { event.preventDefault(); event.returnValue = '' }
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [uploads])
  const set = (key, value) => {
    update(latest => ({ ...latest, [key]: value }))
    setErrors(prev => ({ ...prev, [key]: undefined }))
    setNotice('')
  }
  const currentGame = () => GAMES.find(game => game.id === form.gameId) || GAMES.find(game => game.name === form.game)
  const selectCategory = value => {
    update({ ...gameSelection(form, null, Date.now(), currentGame()), categoryId: value })
    setErrors({})
    setNotice('')
  }
  const selectGame = value => {
    update(gameSelection(form, GAMES.find(game => game.id === value), Date.now(), currentGame()))
    setErrors({})
    setNotice('')
  }
  const field = (key, label, options = {}) => <Field key={key} id={key} label={label} error={errors[key]} full={options.full}>
    {options.textarea ? <textarea value={form[key]} rows={options.rows || 3} maxLength={options.maxLength || 2000} onChange={e => set(key, e.target.value)} /> :
      <input type={options.type || 'text'} value={form[key]} min={options.min} max={options.max} step={options.increment} maxLength={options.maxLength || 160} placeholder={options.placeholder} onChange={e => set(key, e.target.value)} />}
  </Field>
  const select = (key, label, options) => <Field id={key} label={label} error={errors[key]}>
    <select value={form[key]} onChange={e => set(key, e.target.value)}>{options.map(option => {
      const [value, text] = Array.isArray(option) ? option : [option, option]
      return <option key={value} value={value}>{text}</option>
    })}</select>
  </Field>
  const checkbox = (key, label, onChange) => <label className="tc-check"><input type="checkbox" checked={form[key]} onChange={e => onChange ? onChange(e.target.checked) : set(key, e.target.checked)} /><span>{label}</span></label>
  const upload = async (file, key) => {
    if (!file) return
    const isImage = key === 'banner' || key === 'logo'
    const nameKey = key === 'banner' ? 'bannerName' : key === 'rulesDocument' ? 'rulesName' : null
    if (!(isImage ? ['image/jpeg', 'image/png', 'image/webp'].includes(file.type) : file.type === 'application/pdf') || file.size > 5 * 1024 * 1024) {
      setErrors(prev => ({ ...prev, [key]: isImage ? 'Selecciona JPG, PNG o WEBP de hasta 5 MB.' : 'Selecciona un PDF de hasta 5 MB.' })); return
    }
    setUploads(n => n + 1)
    try {
      const { url } = await uploadsApi.upload(file)
      update({ ...current.current.form, [key]: url, ...(nameKey ? { [nameKey]: file.name } : {}) })
      setErrors(prev => ({ ...prev, [key]: undefined }))
    } catch (err) { setErrors(prev => ({ ...prev, [key]: err.message })) }
    finally { setUploads(n => n - 1) }
  }
  // Subida suelta (logos de patrocinador): devuelve la URL, sin tocar el form.
  const uploadImage = async (file) => {
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || file.size > 5 * 1024 * 1024) {
      throw new Error('Selecciona JPG, PNG o WEBP de hasta 5 MB.')
    }
    setUploads(n => n + 1)
    try { const { url } = await uploadsApi.upload(file); return url }
    finally { setUploads(n => n - 1) }
  }
  const saveSocials = async () => {
    setSocialsState('saving')
    try {
      const res = await api('/profile/me', { method: 'PATCH', body: { social: { ...(user?.social || {}), ...socials } } })
      if (res.user) updateUser(res.user)
      setSocialsState('saved')
    } catch { setSocialsState('error') }
  }
  const stepErrors = index => {
    const e = validateSetupStep(form, index)
    if (index === 0 && form.discordMode === 'glitchgang' && discordAccess === 'enabled' && !form.discordConsent) {
      e.discordConsent = 'Debes autorizar al bot para usar Discord.'
    }
    return e
  }
  const move = target => {
    if (target > step) {
      for (let index = 0; index < target; index++) {
        const nextErrors = stepErrors(index)
        if (Object.keys(nextErrors).length) {
          setErrors(nextErrors); update(form, index); setNotice('Completa los campos marcados para continuar.')
          setTimeout(() => panelRef.current?.querySelector('[aria-invalid="true"]')?.focus(), 30)
          return
        }
      }
    }
    setErrors({}); setNotice(''); update(form, target)
    panelRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    setTimeout(() => panelRef.current?.focus({ preventScroll: true }), 30)
  }
  const reuse = () => {
    const tournament = tournaments.find(t => String(t._id) === source)
    if (!tournament) return
    const typedTitle = form.title?.trim()
    const next = nextSeason(tournament, user)
    const game = GAMES.find(g => g.id === next.gameId) || GAMES.find(g => g.name === next.game || g.id === next.game)
    if (game) { next.gameId = game.id; next.game = game.name; next.categoryId = game.categoryId }
    if (typedTitle) next.title = typedTitle
    update(next, 0); setReplacing(false); setErrors({})
    setNotice(`Temporada cargada${typedTitle ? '' : ` como "${next.title}"`}. Fechas y consentimientos pendientes.`)
  }
  const leave = async () => {
    setBusy(true)
    try { await flush(); navigate('/torneos') }
    catch { setNotice('No se pudo sincronizar. Tu borrador local sigue disponible. Reintenta Guardar y salir.') }
    finally { setBusy(false) }
  }
  const createTournament = async (publicationStatus = 'open') => {
    if (busy || uploads) return
    for (let index = 0; index < 6; index++) {
      const nextErrors = stepErrors(index)
      if (Object.keys(nextErrors).length) { update(form, index); setErrors(nextErrors); setNotice('Revisa los campos marcados.'); return }
    }
    setBusy(true); setNotice('')
    try {
      await flush().catch(err => {
        if (err.status !== 409 || err.message !== 'Este torneo ya fue creado.') throw err
      })
      const publishNow = publicationStatus !== 'draft'
      const created = await tournamentsApi.create({
        ...tournamentPayload(form),
        entryFee: 0, // cobro de inscripcion deshabilitado: no hay pasarela de pago real (ver BACKEND-PENDIENTE.md)
        status: publishNow ? 'open' : 'draft',
        visibility: publishNow ? 'public' : 'private',
        creationKey: draft.creationKey,
        scheduledPublishAt: !publishNow && scheduledPublishAt ? new Date(scheduledPublishAt).toISOString() : null,
      })
      await clear()
      navigate(publishNow
        ? `/torneos/${created.publicId || created._id}`
        : `/organizador/torneo/${created.publicId || created._id}/gestionar`)
    } catch (err) { setNotice(err.message || 'No se pudo crear el torneo. El borrador se conserva.') }
    finally { setBusy(false) }
  }
  const publish = async event => {
    event.preventDefault()
    if (busy || uploads) return
    if (step < 5) { move(step + 1); return }
    await createTournament('open')
  }
  const downloadConsent = async () => {
    setBusy(true)
    try { const { downloadTournamentConsent } = await import('../../lib/tournamentConsentPdf.js'); downloadTournamentConsent(form) }
    catch { setNotice('No se pudo generar el PDF. Reintenta la descarga.') }
    finally { setBusy(false) }
  }
  const discardDraft = async () => {
    if (!window.confirm('Descartar este borrador y comenzar un torneo nuevo?')) return
    setBusy(true)
    try { await discard(); setErrors({}); setNotice(''); setSource('') }
    catch (err) { setNotice(err.message || 'No se pudo descartar el borrador.') }
    finally { setBusy(false) }
  }
  // Solo para QA: llena el formulario con un torneo minimo (1v1, 4 cupos, fechas
  // a horas de distancia) para no tener que armarlo a mano en cada prueba del bot.
  const fillTestData = () => {
    const now = Date.now()
    const HOUR = 60 * 60 * 1000
    const tz = '-04:00'
    const game = GAMES.find(g => g.id === 'league-of-legends')
    const base = gameSelection(initialTournamentForm(user), game, now)
    const stamp = new Date(now).toLocaleString('es-DO', { hour: '2-digit', minute: '2-digit' })
    update({
      ...base,
      title: `Torneo de prueba ${stamp}`,
      seasonName: 'Prueba QA',
      description: 'Torneo de prueba generado automaticamente para probar el flujo de creacion, inscripcion y el bot de Discord sin llenar el formulario a mano.',
      discordMode: 'glitchgang', discordConsent: true,
      modality: '1v1', server: 'LA1', mapMode: 'fixed', mapPool: 'Grieta del Invocador',
      maxSlots: 4, competition: initialCompetition(),
      participationScope: 'global', timezone: tz,
      registrationStart: inputDateTime(now + MIN_LEAD_MS + 10 * 60000, tz),
      registrationEnd: inputDateTime(now + MIN_LEAD_MS + 40 * 60000, tz),
      checkinDeadline: inputDateTime(now + MIN_LEAD_MS + 50 * 60000, tz),
      date: inputDateTime(now + 3 * HOUR, tz),
      endDate: inputDateTime(now + 27 * HOUR, tz),
      minAge: 18, minorsAllowed: false,
      prizeType: 'Sin premio', prizePool: 0, prizes: [],
      organizerBrandName: user.nick || user.username || 'GlitchGang QA',
      organizationContact: user.nick || user.username || 'Organizador de prueba',
      contactEmail: user.email || 'qa@glitchgang.net',
      jurisdiction: 'Republica Dominicana',
      complaintsChannel: user.email || 'qa@glitchgang.net',
      rules: 'Reglamento de prueba: 1v1, BO1, 4 equipos, sin premios. Torneo generado automaticamente para pruebas internas.',
      acceptTerms: true,
    }, 0)
    setErrors({}); setNotice('Formulario de prueba cargado: League of Legends 1v1, 4 cupos. Revisa y publica.')
  }
  if (!ready || !form) return <div className="gg-page tc-loading" role="status">Cargando borrador...</div>
  const game = currentGame()
  const category = GAMES_BY_CATEGORY.find(c => c.id === form.categoryId)
  const minDateTime = inputDateTime(Date.now() + MIN_LEAD_MS, form.timezone)
  const scheduleNotes = step === 2 ? scheduleWarnings(form) : {}
  const fileField = (key, label) => {
    const isImage = key === 'banner' || key === 'logo'
    const nameKey = key === 'banner' ? 'bannerName' : key === 'rulesDocument' ? 'rulesName' : null
    const preview = key === 'banner' ? (form.banner || game?.images?.horizontal)
      : key === 'logo' ? (form.logo || game?.images?.logo) : null
    const gameDefault = key === 'banner' ? defaultGameBanner(game) : key === 'logo' ? (game?.images?.logo || '') : ''
    const removable = form[key] && (!isImage || form[nameKey] || form[key] !== gameDefault)
    return <div className="tc-field tc-field--full">
      <label htmlFor={`tc-file-${key}`}>{label}</label>
      <div className={`tc-upload${key === 'logo' ? ' tc-upload--logo' : ''}`}>
        {preview && <img src={preview} alt={form[key] ? label : form.game} />}
        <div><label className="tc-button tc-button--quiet" htmlFor={`tc-file-${key}`}>{Icon.upload} {form[key] ? 'Cambiar archivo' : 'Seleccionar archivo'}</label>
          <input id={`tc-file-${key}`} className="tc-file-input" type="file" disabled={uploads > 0 || busy} accept={isImage ? 'image/png,image/jpeg,image/webp' : 'application/pdf'} onChange={e => { upload(e.target.files?.[0], key); e.target.value = '' }} />
          <span>{form[nameKey] || (isImage && form[key] ? 'Imagen del juego' : isImage ? 'JPG, PNG o WEBP / hasta 5 MB' : 'PDF / hasta 5 MB')}</span>
          {removable && <button className="tc-icon-button" type="button" title={gameDefault ? 'Restaurar imagen del juego' : `Quitar ${label}`} aria-label={gameDefault ? 'Restaurar imagen del juego' : `Quitar ${label}`} onClick={() => update({ ...form, [key]: gameDefault, ...(nameKey ? { [nameKey]: '' } : {}) })}>{Icon.trash}</button>}
        </div>
      </div>{errors[key] && <span className="tc-error">{errors[key]}</span>}
    </div>
  }

  return <div className="gg-page tc-wizard">
    <motion.header className="tc-header" initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: .3 }}>
      <div><span className="tc-eyebrow">{Icon.trophy} CENTRO DE TORNEOS</span><h1>Crear torneo</h1></div>
      <div className="tc-header__actions">
        {import.meta.env.DEV && <button className="tc-button tc-button--quiet" type="button" title="Solo en desarrollo: llena el formulario con un torneo de prueba (1v1, 4 cupos, fechas en horas)" disabled={busy || uploads > 0} onClick={fillTestData}>{Icon.bolt} Llenar formulario</button>}
        <button className="tc-button tc-button--quiet" type="button" disabled={busy || uploads > 0} onClick={leave}>{Icon.bookmark} Guardar y salir</button>
      </div>
    </motion.header>
    <div className="tc-meta"><span>{user.nick || user.username} <span className="tc-code">{user.roleProfiles?.organizer?.organizerCode || ''}</span></span><div className="tc-save-state"><span role="status">{uploads ? 'Subiendo archivo...' : status || 'Nuevo torneo'}</span>{draft.savedAt > 0 && <button className="tc-icon-button" type="button" title="Descartar borrador" aria-label="Descartar borrador" disabled={busy || uploads > 0} onClick={discardDraft}>{Icon.trash}</button>}</div></div>
    <nav className="tc-steps" aria-label="Pasos del torneo">{SETUP_STEPS.map((label, i) => <button key={label} type="button" aria-current={i === step ? 'step' : undefined} disabled={busy || uploads > 0 || i > step + 1} onClick={() => move(i)}><span>{i < step ? Icon.check : String(i + 1).padStart(2, '0')}</span><b>{label}</b></button>)}</nav>
    <form noValidate onSubmit={publish}>
      <fieldset disabled={busy} className="tc-panel" ref={panelRef} tabIndex="-1">
        <div className="tc-panel-heading"><h2>{SETUP_STEPS[step]}</h2><span>{step + 1} de {SETUP_STEPS.length}</span></div>
        {notice && <p className="tc-notice" role="alert">{notice}</p>}
        <AnimatePresence mode="wait">
        <motion.div key={step} initial={{ opacity: 0, x: 18 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -18 }} transition={{ duration: .22, ease: 'easeOut' }}>
        {step === 0 && <>
          <details className="tc-details"><summary>{Icon.copy} Reutilizar un torneo anterior</summary>
            <div className="tc-reuse"><label htmlFor="tc-source">Torneo de origen</label><select id="tc-source" value={source} onChange={e => { setSource(e.target.value); setReplacing(false) }}><option value="">Seleccionar torneo</option>{tournaments.map(t => <option key={t._id} value={t._id}>{t.title}</option>)}</select>
              <button type="button" className="tc-button" disabled={!source || uploads > 0} onClick={() => setReplacing(true)}>{Icon.copy} Nueva temporada</button>
            </div>
            {replacing && <div className="tc-notice">Se sustituiran los datos de este borrador por los del torneo elegido.<div className="tc-inline-actions"><button type="button" className="tc-button" onClick={reuse}>Usar esta configuracion</button><button type="button" className="tc-button tc-button--quiet" onClick={() => setReplacing(false)}>Cancelar</button></div></div>}
          </details>
          <div className="tc-grid">
            {field('title', 'Nombre del torneo *', { full: true, maxLength: 120 })}
            {field('seasonName', 'Serie de torneos', { maxLength: 120 })}
            {field('seasonNumber', 'Temporada', { type: 'number', min: 1, increment: 1 })}
            <Field id="categoryId" label="Categoria" error={errors.categoryId}><select value={form.categoryId} onChange={e => selectCategory(e.target.value)}><option value="">Seleccionar categoria</option>{GAMES_BY_CATEGORY.map(c => <option key={c.id} value={c.id}>{c.name} ({c.games.length})</option>)}</select></Field>
            <Field id="gameId" label="Juego *" error={errors.gameId}><select value={form.gameId} disabled={!category?.games.length} onChange={e => selectGame(e.target.value)}><option value="">{category && !category.games.length ? 'Sin juegos en el catalogo' : 'Seleccionar juego'}</option>{category?.games.map(g => <option key={g.id} value={g.id} translate="no">{g.name}</option>)}</select></Field>
            {field('description', 'Descripcion *', { full: true, textarea: true, maxLength: 2000 })}
            {fileField('banner', 'Banner del torneo (opcional)')}
            {fileField('logo', 'Logo del torneo (opcional)')}
            <Field id="primaryColor" label="Color principal (opcional)" error={errors.primaryColor}>
              <input type="color" value={/^#[0-9a-fA-F]{6}$/.test(form.primaryColor) ? form.primaryColor : (game?.color || '#1E90FF')} onChange={e => set('primaryColor', e.target.value)} />
            </Field>
            <fieldset className="tc-field--full tc-discord">
              <legend>¿Como se gestiona este torneo? *</legend>
              <details className="tc-details"><summary>{Icon.discord} Que ofrece el Discord de GlitchGang</summary>
                <ul className="tc-discord__perks">
                  <li>Comandos slash para check-in, reportar resultados y ver el bracket.</li>
                  <li>Canales y roles del torneo creados y administrados por el bot.</li>
                  <li>Recordatorios y anuncios automaticos a los participantes.</li>
                  <li>Grabacion de audio en partidas para resolver disputas con evidencia.</li>
                  <li>Tu torneo aislado del resto: solo ves y editas lo tuyo.</li>
                </ul>
              </details>
              {[
                ['none', 'Solo panel web', 'Check-in, bracket y resultados desde la web de GlitchGang.'],
                ['glitchgang', 'Discord de GlitchGang', 'El bot arma el torneo en el servidor de GlitchGang. Los participantes hacen check-in y juegan desde Discord; vos lo seguis todo desde el panel web.'],
                ['own', 'Mi propio servidor de Discord', 'Plan superior — proximamente.'],
              ].map(([value, title, desc]) => (
                <label className={`tc-discord__opt${form.discordMode === value ? ' is-active' : ''}${value === 'own' ? ' is-locked' : ''}`} key={value}>
                  <input type="radio" name="tc-discordMode" value={value} disabled={value === 'own'} checked={form.discordMode === value}
                    onChange={() => { set('discordMode', value); if (value !== 'glitchgang') set('discordConsent', false) }} />
                  <span><b>{title}{value === 'own' && ' 🔒'}</b><small>{desc}</small></span>
                </label>
              ))}
              {errors.discordMode && <span className="tc-error" role="alert">{errors.discordMode}</span>}
              {form.discordMode === 'glitchgang' && <div className="tc-discord__panel">
                {discordAccess === 'enabled' ? <>
                  <label className="tc-check"><input type="checkbox" checked={form.discordConsent} onChange={e => set('discordConsent', e.target.checked)} />
                    <span>Autorizo al bot de GlitchGang a crear y administrar los canales y roles de este torneo en el servidor de GlitchGang.</span></label>
                  {errors.discordConsent && <span className="tc-error" role="alert">{errors.discordConsent}</span>}
                  <p className="tc-hint tc-hint--muted">Todos los participantes y el staff deben tener cuenta de GlitchGang y estar en el servidor de Discord. Sin cuenta no reciben el rol ni pueden jugar.</p>
                </> : discordAccess === 'pending' ? (
                  <p className="tc-hint">Tu solicitud de acceso a Discord esta pendiente de aprobacion del admin. Podes publicar el torneo ahora sin Discord y activarlo cuando te aprueben.</p>
                ) : (
                  <div className="tc-inline-actions">
                    <p className="tc-hint">Un admin de GlitchGang tiene que habilitarte Discord una sola vez. Despues podes activarlo en todos tus torneos.</p>
                    <button type="button" className="tc-button tc-button--quiet" disabled={discordReqBusy} onClick={requestDiscord}>{Icon.discord} {discordReqBusy ? 'Enviando...' : 'Solicitar acceso a Discord'}</button>
                  </div>
                )}
              </div>}
            </fieldset>
          </div>
        </>}
        {step === 1 && <div className="tc-grid">
          <div className="tc-game-context tc-field--full">{game?.images?.logo && <img src={game.images.logo} alt="" />}<h3>{form.game}</h3></div>
          <PatchField game={game} value={form.patch} onChange={value => set('patch', value)} error={errors.patch} />
          {select('platform', 'Plataforma', [['pc', 'PC'], ['console', 'Consola'], ['mobile', 'Movil'], ['cross', 'Multiplataforma']])}
          <ServerField key={form.gameId} game={game} value={form.server} onChange={value => set('server', value)} error={errors.server} />
          <Field id="modality" label="Modalidad *" error={errors.modality}>
            <select value={form.modality} onChange={e => set('modality', e.target.value)}>
              {modalitiesFor(form.gameId).map(m => <option key={m} value={m}>{m}</option>)}
              {form.modality && !modalitiesFor(form.gameId).includes(form.modality) && <option value={form.modality}>{form.modality}</option>}
            </select>
          </Field>
          <CompetitionFields
            competition={form.competition} maxSlots={form.maxSlots} errors={errors} disabled={busy}
            onChange={next => { update(latest => ({ ...latest, competition: next })); setErrors(prev => ({ ...prev, system: undefined, defaultSeries: undefined, swissRounds: undefined, groups: undefined, advancePerGroup: undefined, scoring: undefined, seriesByRound: undefined, legs: undefined, groupsPhaseSystem: undefined, playoffsSystem: undefined })) }}
            onMaxSlots={value => set('maxSlots', value)}
          />
          <Field id="mapMode" label="Seleccion de mapas" error={errors.mapMode}><select value={form.mapMode} onChange={e => { update(changeMapMode(form, e.target.value)); setErrors(prev => ({ ...prev, mapPool: undefined })) }}><option value="fixed">Mapa fijo</option><option value="random">Aleatorio entre mapas</option><option value="veto">Seleccion y veto</option></select></Field>
          <MapsField key={`${form.gameId}:${form.mapMode}`} game={game} mode={form.mapMode} value={form.mapPool} onChange={value => set('mapPool', value)} error={errors.mapPool} />
          {select('participationScope', 'Participacion', [['global', 'Global'], ['regional', 'Limitada por pais o region']])}
          {form.participationScope === 'regional' && <div className="tc-country-picker tc-field--full">
            <label htmlFor="tc-region-preset">Region</label><select id="tc-region-preset" defaultValue="" onChange={e => { if (e.target.value) set('allowedCountries', REGION_PRESETS[e.target.value]); e.target.value = '' }}><option value="">Seleccion personalizada</option>{Object.keys(REGION_PRESETS).map(r => <option key={r}>{r}</option>)}</select>
            <label htmlFor="tc-country-search">Paises permitidos ({form.allowedCountries.length})</label><input id="tc-country-search" type="search" value={countrySearch} onChange={e => setCountrySearch(e.target.value)} />
            <div className="tc-countries">{COUNTRIES.filter(c => c.name.toLowerCase().includes(countrySearch.toLowerCase())).map(c => <label className="tc-check" key={c.code}><input type="checkbox" checked={form.allowedCountries.includes(c.code)} onChange={e => set('allowedCountries', e.target.checked ? [...form.allowedCountries, c.code] : form.allowedCountries.filter(code => code !== c.code))} />{c.name}</label>)}</div>
            {errors.allowedCountries && <span className="tc-error" role="alert">{errors.allowedCountries}</span>}
          </div>}
        </div>}
        {step === 2 && <div className="tc-grid">
          {select('timezone', 'Zona horaria', [['-04:00', 'UTC-04:00 / Republica Dominicana'], ['+00:00', 'UTC'], ['-06:00', 'UTC-06:00'], ['-05:00', 'UTC-05:00'], ['-03:00', 'UTC-03:00'], ['+01:00', 'UTC+01:00'], ['+02:00', 'UTC+02:00']])}
          <div className="tc-schedule-rule">{Icon.clock}<span>La apertura y el inicio deben ser al menos 2 horas despues de crear el torneo. 48 h de inscripcion es lo recomendado.</span></div>
          {field('registrationStart', 'Apertura de inscripciones *', { type: 'datetime-local', min: minDateTime })}
          {field('registrationEnd', 'Cierre de inscripciones *', { type: 'datetime-local', min: minDateTime })}
          {scheduleNotes.registrationEnd && !errors.registrationEnd && <p className="tc-hint tc-field--full">{scheduleNotes.registrationEnd}</p>}
          {field('date', 'Inicio del torneo *', { type: 'datetime-local', min: minDateTime })}
          {field('endDate', 'Fin del torneo *', { type: 'datetime-local', min: minDateTime })}
          {field('checkinDeadline', 'Limite de check-in (opcional)', { type: 'datetime-local', min: minDateTime })}
          {field('minAge', 'Edad minima al comenzar *', { type: 'number', min: form.minorsAllowed ? 1 : 18, max: 99, increment: 1 })}
          <div className="tc-field--full">{checkbox('minorsAllowed', 'Permitir menores con autorizacion del representante', enabled => update({ ...form, minorsAllowed: enabled, minAge: enabled ? form.minAge : Math.max(18, Number(form.minAge)) }))}</div>
          {field('notes', 'Requisitos adicionales (opcional)', { textarea: true, full: true })}
          <details className="tc-details tc-field--full"><summary>Check-in avanzado</summary>
            {checkbox('overcupEnabled', 'Permitir sobrecupo')}
            {form.overcupEnabled && <div className="tc-grid">
              {field('secondCheckinHours', 'Ventana de segundo check-in (horas)', { type: 'number', min: 6, max: 12 })}
              {field('secondCheckinDeadline', 'Limite de segundo check-in', { type: 'datetime-local' })}
              {checkbox('overcupLocked', 'Fijar la regla de sobrecupo')}
            </div>}
            {(errors.secondCheckinHours || errors.secondCheckinDeadline) && <p className="tc-error">{errors.secondCheckinHours || errors.secondCheckinDeadline}</p>}
          </details>
        </div>}
        {step === 3 && <>
          <div className="tc-grid">
            <Field id="entryFee" label="Costo de inscripcion">
              <input type="number" value={0} disabled readOnly />
            </Field>
            {select('currency', 'Moneda', ['DOP', 'USD', 'EUR', 'MXN', 'COP', 'ARS', 'BRL'])}
            {select('prizeType', 'Premiacion', ['Sin premio', 'Dinero', 'Articulos', 'Mixto'])}
            {form.prizeType !== 'Sin premio' && field('prizePool', 'Total en dinero', { type: 'number', min: 0, increment: '0.01' })}
          </div>
          <p className="tc-hint tc-field--full">Cobro de inscripcion deshabilitado por ahora: todavia no tenemos pasarela de pago real para organizador y jugador. El torneo sera gratuito hasta que este disponible.</p>
          {form.prizeType !== 'Sin premio' && <div className="tc-subsection"><h3>Distribucion de premios</h3>
            <p className="tc-hint tc-hint--muted">Premios por puesto final y, si aplica, premios especiales (MVP, mejor novato, fair play...). El total en dinero debe cuadrar con la suma de los importes.</p>
            <RowEditor type="prizes" rows={form.prizes} onChange={rows => set('prizes', rows)} />{errors.prizes && <p className="tc-error">{errors.prizes}</p>}</div>}
        </>}
        {step === 4 && <>
          <div className="tc-grid">
            {field('organizerBrandName', 'Organizacion responsable *', { maxLength: 120 })}
            {field('organizationContact', 'Nombre del responsable *')}
            {field('contactEmail', 'Correo de contacto *', { type: 'email' })}
            {field('contactPhone', 'Telefono (opcional)', { type: 'tel' })}
            {field('contactDiscord', 'Discord (opcional)', { type: 'url', full: true })}
          </div>
          <details className="tc-details"><summary>{Icon.tv} Transmision</summary><div className="tc-grid">{field('streamUrl', 'Canal de transmision', { type: 'url' })}{select('streamLang', 'Idioma', ['Espanol', 'Ingles', 'Portugues', 'Bilingue'])}</div>{errors.streamUrl && <p className="tc-error">{errors.streamUrl}</p>}</details>
          <details className="tc-details"><summary>{Icon.share} Redes sociales del organizador</summary>
            <p className="tc-hint tc-hint--muted">Se guardan en tu perfil y se muestran en la pagina publica de todos tus torneos.</p>
            <div className="tc-grid">
              {SOCIAL_PLATFORMS.map(p => <Field key={p.id} id={`social-${p.id}`} label={p.label}>
                <input value={socials[p.id] || ''} placeholder={p.placeholder} maxLength={100}
                  onChange={e => { setSocials(s => ({ ...s, [p.id]: e.target.value })); setSocialsState('') }} />
              </Field>)}
            </div>
            <div className="tc-inline-actions">
              <button type="button" className="tc-button tc-button--quiet" disabled={socialsState === 'saving'} onClick={saveSocials}>
                {Icon.check} {socialsState === 'saving' ? 'Guardando...' : 'Guardar redes en mi perfil'}
              </button>
              {socialsState === 'saved' && <span className="tc-hint">Guardado.</span>}
              {socialsState === 'error' && <span className="tc-error">No se pudo guardar.</span>}
            </div>
          </details>
          <details className="tc-details" open={errors.sponsors ? true : undefined}><summary>{Icon.star} Patrocinadores <span>{form.sponsors.length}</span></summary><RowEditor type="sponsors" rows={form.sponsors} onChange={rows => set('sponsors', rows)} onUploadImage={uploadImage} />{errors.sponsors && <p className="tc-error">{errors.sponsors}</p>}</details>
          <details className="tc-details" open={errors.staffMembers ? true : undefined}><summary>{Icon.team} Staff <span>{form.staffMembers.length}</span></summary>
            <p className="tc-hint tc-hint--muted">El staff son perfiles reales de GlitchGang con rol aprobado. Cada persona recibe una notificacion al publicar el torneo.</p>
            {form.staffMembers.length > 0 && <ul className="tc-staff-list">
              {form.staffMembers.map((member, i) => <li key={member.localId || member.user || i}>
                {member.avatar ? <img src={member.avatar} alt="" /> : <span className="tc-staff-list__fallback">{(member.nick || '?').slice(0, 2).toUpperCase()}</span>}
                <div><b>{member.nick || member.name}</b>{member.playerCode && <small>{member.playerCode}</small>}</div>
                <select aria-label={`Rol de ${member.nick || member.name}`} value={member.role} onChange={e => set('staffMembers', form.staffMembers.map((m, index) => index === i ? { ...m, role: e.target.value } : m))}>
                  {STAFF_ROLES.map(r => <option key={r} value={r}>{r}</option>)}
                </select>
                <button type="button" className="tc-icon-button" title={`Quitar a ${member.nick || member.name}`} aria-label={`Quitar a ${member.nick || member.name}`} onClick={() => set('staffMembers', form.staffMembers.filter((_, index) => index !== i))}>{Icon.trash}</button>
              </li>)}
            </ul>}
            {errors.staffMembers && <p className="tc-error">{errors.staffMembers}</p>}
            <RoleStaffSearch roles={PLATFORM_STAFF_ROLES} excludeIds={form.staffMembers.map(s => s.user).filter(Boolean)} selectLabel="Agregar"
              onSelect={(person, roleEntry) => {
                if (form.staffMembers.some(s => s.user === person.id)) return
                set('staffMembers', [...form.staffMembers, {
                  localId: crypto.randomUUID(), user: person.id, nick: person.nick, name: person.nick,
                  avatar: person.avatar || '', playerCode: person.playerCode || '', platformRole: roleEntry?.role || '',
                  role: STAFF_ROLE_BY_PLATFORM[roleEntry?.role] || 'Moderador',
                }])
              }} />
          </details>
        </>}
        {step === 5 && <>
          <dl className="tc-review">{[
            ['Torneo', form.title, 0], ['Temporada', `${form.seasonName || form.title} / ${form.seasonNumber}`, 0],
            ['Juego', form.game, 0],
            ['Gestion', form.discordMode === 'glitchgang' ? (discordAccess === 'enabled' && form.discordConsent ? 'Discord de GlitchGang' : 'Panel web (Discord pendiente de habilitacion)') : 'Panel web', 0],
            ['Competencia', `${form.modality} / ${COMPETITION_SYSTEMS[form.competition?.system]?.label || ''} / ${form.maxSlots} cupos`, 1],
            ['Serie', seriesSummary(form.competition), 1],
            ['Mapas', `${form.mapMode === 'random' ? 'Aleatorio: ' : ''}${form.mapPool}`, 1],
            ['Paises', form.participationScope === 'regional' ? form.allowedCountries.map(countryName).join(', ') : 'Global', 1],
            ['Inscripciones', `${form.registrationStart.replace('T', ' ')} a ${form.registrationEnd.replace('T', ' ')} / UTC${form.timezone}`, 2],
            ['Calendario', `${form.date.replace('T', ' ')} a ${form.endDate.replace('T', ' ')} / UTC${form.timezone}`, 2],
            ['Premios', form.prizeType === 'Sin premio' ? 'Sin premio' : `${form.prizeType} / ${form.prizePool} ${form.currency} / ${form.prizes.length} premio(s)${form.prizes.some(p => p.kind === 'award') ? `, ${form.prizes.filter(p => p.kind === 'award').length} especial(es)` : ''}`, 3],
            ['Organizacion', `${form.organizerBrandName} / ${form.sponsors.length} patrocinadores / ${form.staffMembers.length} staff`, 4],
          ].map(([label, value, target], i) => <div key={i}><dt>{label}</dt><dd>{value}</dd><button className="tc-icon-button" title={`Editar ${label}`} aria-label={`Editar ${label}`} type="button" onClick={() => move(target)}>{Icon.edit}</button></div>)}</dl>
          <div className="tc-grid">
            {field('jurisdiction', 'Pais de organizacion *')}
            {field('complaintsChannel', 'Contacto para consultas y reclamaciones *')}
            {field('rules', 'Reglamento', { textarea: true, full: true, rows: 5, maxLength: 15000 })}
            {fileField('rulesDocument', 'Reglamento en PDF (opcional)')}
          </div>
          {form.minorsAllowed && <section className="tc-subsection"><h3>Autorizacion de menores</h3><div className="tc-grid">
            {field('organizationAddress', 'Domicilio de la organizacion *', { full: true, maxLength: 500 })}
            {field('mediaChannels', 'Canales previstos para imagen y contenido *', { textarea: true, full: true, maxLength: 1500 })}
            {field('mediaRetentionMonths', 'Plazo de uso y conservacion (meses)', { type: 'number', min: 1, max: 120 })}
          </div><p className="tc-legal-note">Plantilla para Republica Dominicana, pendiente de revision legal y firma del representante. Generarla no acredita autorizacion.</p>
            <button className="tc-button tc-button--quiet" type="button" disabled={!form.organizationAddress || !form.mediaChannels} onClick={downloadConsent}>{Icon.download} Descargar autorizacion PDF</button>
          </section>}
          <div className="tc-terms">{checkbox('acceptTerms', <>Acepto los <a href="/terminos-organizador" target="_blank" rel="noreferrer">terminos del organizador</a> y confirmo los datos del torneo.</>)}{errors.acceptTerms && <p className="tc-error">{errors.acceptTerms}</p>}</div>
          <div className="tc-field">
            <label htmlFor="tc-scheduled-publish">Programar publicacion (opcional)</label>
            <input id="tc-scheduled-publish" type="datetime-local" min={minDateTime} value={scheduledPublishAt} onChange={e => setScheduledPublishAt(e.target.value)} />
            <span className="tc-hint tc-hint--muted">Si eliges una fecha, el torneo se crea sin publicar y se publica solo en ese momento. Util para torneos semanales que armas con anticipacion.</span>
          </div>
        </>}
        </motion.div>
        </AnimatePresence>
      </fieldset>
      <footer className="tc-actions">
        <button type="button" className="tc-button tc-button--quiet" disabled={busy || uploads > 0 || step === 0} onClick={() => move(step - 1)}><span className="tc-back-icon">{Icon.chevronRight}</span> Atras</button>
        <span className="tc-actions__step">{String(step + 1).padStart(2, '0')} / 06</span>
        <div className="tc-actions__submit">
          {step === 5 && <button type="button" className="tc-button tc-button--quiet" disabled={busy || uploads > 0} onClick={() => createTournament('draft')}>{Icon.bookmark} {scheduledPublishAt ? 'Programar publicacion' : 'Crear sin publicar'}</button>}
          <button type="submit" className="tc-button tc-button--primary" disabled={busy || uploads > 0}>{busy ? 'Guardando...' : step === 5 ? 'Publicar torneo' : 'Continuar'}{step === 5 ? Icon.check : Icon.chevronRight}</button>
        </div>
      </footer>
    </form>
  </div>
}

