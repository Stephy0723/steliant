import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { useAuth } from '../../../context/AuthContext.jsx'
import { Icon } from '../../../components/icons/Icons.jsx'
import { getCommunityById, generateCommunityId } from '../../../lib/communityStore.js'
import { toast } from '../../../lib/toast.js'
import { api } from '../../../lib/api.js'
import { GAMES } from '../../../data/games.js'
import { getAllCommunities } from '../../../data/communities.js'
import './CommunityCreate.css'

const GAME_NAMES = [...new Set([
  ...GAMES.map(game => game.name),
  ...getAllCommunities().map(community => community.name),
])].sort((a, b) => a.localeCompare(b, 'es'))
const REGIONS = ['Rep. Dominicana', 'Caribe', 'LATAM', 'Norteamérica', 'Europa', 'Global']
const LANGS = ['Español', 'Inglés', 'Portugués', 'Bilingüe (ES/EN)']
const TEAM_ROLES = ['Dueño', 'Admin', 'Moderador', 'Editor', 'Caster', 'Diseñador', 'Community Manager']
const SOCIALS = [
  { key: 'website',   label: 'Sitio web',  icon: 'globe',     ph: 'https://tucomunidad.gg' },
  { key: 'discord',   label: 'Discord',    icon: 'discord',   ph: 'https://discord.gg/tucomunidad' },
  { key: 'twitter',   label: 'X / Twitter',icon: 'globe',     ph: 'https://x.com/tucomunidad' },
  { key: 'instagram', label: 'Instagram',  icon: 'instagram', ph: 'https://instagram.com/tucomunidad' },
  { key: 'youtube',   label: 'YouTube',    icon: 'youtube',   ph: 'https://youtube.com/@tucomunidad' },
  { key: 'twitch',    label: 'Twitch',     icon: 'twitch',    ph: 'https://twitch.tv/tucomunidad' },
  { key: 'tiktok',    label: 'TikTok',     icon: 'tiktok',    ph: 'https://tiktok.com/@tucomunidad' },
]
const FEATURES = [
  { key: 'emailVerif', label: 'Verificación por email' },
  { key: 'antiSpam',   label: 'Anti spam' },
  { key: 'discord',    label: 'Integración Discord' },
  { key: 'welcome',    label: 'Correo de bienvenida' },
  { key: 'events',     label: 'Eventos futuros' },
  { key: 'tournaments',label: 'Torneos futuros' },
]
const STEPS = ['Identidad', 'Redes', 'Contenido', 'Equipo', 'Avanzado']
const TUTORIAL_DONE_KEY = 'gg-community-tutorial-done'
const TUTORIAL_FORCE_KEY = 'gg-community-tutorial-force-open'
const TUTORIAL_STEPS = [
  {
    title: 'Empieza por la identidad',
    text: 'Aquí defines cómo se verá tu comunidad. Sube banner y logo, escribe el nombre y una descripción simple para que la gente la entienda rápido.',
    note: 'Botones importantes: Subir banner, Subir logo y Siguiente.',
    formStep: 0,
    target: 'identity',
  },
  {
    title: 'Conecta solo las redes que sí usas',
    text: 'No necesitas llenar todas. Si tu comunidad vive en Discord, empieza por Discord y una red principal.',
    note: 'Botones importantes: Atrás, Siguiente.',
    formStep: 1,
    target: 'socials',
  },
  {
    title: 'Define juegos y reglas',
    text: 'Este paso evita confusión: elige los juegos, decide quién publica y deja claras las reglas y límites de la comunidad.',
    note: 'Botones importantes: Añadir regla, Subir reglas en PDF y Siguiente.',
    formStep: 2,
    target: 'content',
  },
  {
    title: 'Asigna el equipo correcto',
    text: 'Pon a las personas correctas como Dueño, Admin o Moderador. Eso define quién puede gestionar la comunidad después.',
    note: 'Botones importantes: Añadir miembro del staff y Atrás/Siguiente.',
    formStep: 3,
    target: 'team',
  },
  {
    title: 'Revisa y crea la comunidad',
    text: 'Aquí ves una vista previa final. Si todo se ve bien, termina con Crear comunidad. Luego podrás editarla cuando quieras.',
    note: 'Botones importantes: Crear comunidad y Atrás.',
    formStep: 4,
    target: 'advanced',
  },
]

function readFile(file, cb) {
  const r = new FileReader()
  r.onload = () => cb(r.result)
  r.readAsDataURL(file)
}

export default function CommunityCreate() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const { id: editId } = useParams()
  const editing = editId ? getCommunityById(editId) : null
  const logoRef = useRef(null)
  const bannerRef = useRef(null)
  const bannerVideoRef = useRef(null)
  const galleryRef = useRef(null)
  const pdfRef = useRef(null)
  const [step, setStep] = useState(0)
  const [created, setCreated] = useState(null)
  const [tutorialOpen, setTutorialOpen] = useState(false)
  const [tutorialIndex, setTutorialIndex] = useState(0)

  const creatorCode = user?.nick || 'Usuario'

  const DEFAULTS = {
    name: '', description: '', region: REGIONS[0], lang: LANGS[0],
    logo: null, banner: null, video: '', gallery: [], accent: '#00E676',
    links: {}, games: [], whoPublishes: 'Todos', audience: 'Mixto',
    banned: 'Piratería, cheats, NSFW explícito, acoso y reventa de cuentas.',
    allowed: 'Clips, guías, scrims, búsqueda de equipo, anuncios de la comunidad.',
    notAllowed: 'Spam, autopromoción sin permiso, lenguaje de odio, links sospechosos.',
    rules: ['Respeta a todos los miembros.', 'Nada de cheats ni piratería.', 'Mantén el contenido en su canal correcto.'],
    rulesPdf: null,
    team: [{ role: 'Dueño', username: creatorCode }],
    features: { emailVerif: true, antiSpam: true, discord: false, welcome: true, events: false, tournaments: false },
  }
  const [f, setF] = useState(() => editing
    ? { ...DEFAULTS, ...editing, links: editing.links || {}, rules: editing.rules?.length ? editing.rules : DEFAULTS.rules, team: editing.team?.length ? editing.team : DEFAULTS.team, features: { ...DEFAULTS.features, ...(editing.features || {}) } }
    : DEFAULTS)
  const idPreview = useMemo(() => f?.publicId || f?.publicCode || editing?.publicId || generateCommunityId(creatorCode, new Date(), 1).replace(/-\d{4}$/, '-XXXX'), [creatorCode, editing, f?.publicCode, f?.publicId])
  const set = (patch) => setF(prev => ({ ...prev, ...patch }))
  const setLink = (k, v) => setF(prev => ({ ...prev, links: { ...prev.links, [k]: v } }))
  const toggleGame = (g) => setF(prev => ({ ...prev, games: prev.games.includes(g) ? prev.games.filter(x => x !== g) : [...prev.games, g] }))
  const toggleFeature = (k) => setF(prev => ({ ...prev, features: { ...prev.features, [k]: !prev.features[k] } }))
  const setRule = (i, v) => setF(prev => ({ ...prev, rules: prev.rules.map((r, idx) => idx === i ? v : r) }))
  const addRule = () => setF(prev => ({ ...prev, rules: [...prev.rules, ''] }))
  const removeRule = (i) => setF(prev => ({ ...prev, rules: prev.rules.filter((_, idx) => idx !== i) }))
  const setTeam = (i, patch) => setF(prev => ({ ...prev, team: prev.team.map((t, idx) => idx === i ? { ...t, ...patch } : t) }))
  const addTeam = () => setF(prev => ({ ...prev, team: [...prev.team, { role: 'Moderador', username: '' }] }))
  const removeTeam = (i) => setF(prev => ({ ...prev, team: prev.team.filter((_, idx) => idx !== i) }))
  const removeGalleryItem = (i) => setF(prev => ({ ...prev, gallery: (prev.gallery || []).filter((_, idx) => idx !== i) }))
  const setGalleryTitle = (i, title) => setF(prev => ({ ...prev, gallery: (prev.gallery || []).map((item, idx) => idx === i ? { ...item, title } : item) }))

  const uploadAsset = async (file) => {
    const dataUrl = await new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve(reader.result)
      reader.onerror = reject
      reader.readAsDataURL(file)
    })
    const data = await api('/uploads', { method: 'POST', body: { dataUrl, filename: file.name } })
    return data.url
  }

  const handleBannerImage = async (file) => {
    if (!file) return
    try {
      const url = await uploadAsset(file)
      set({ banner: url, video: '' })
      toast('Banner actualizado', 'success')
    } catch (error) {
      toast(error?.message || 'No se pudo subir el banner', 'error')
    }
  }

  const handleBannerVideo = async (file) => {
    if (!file) return
    try {
      const url = await uploadAsset(file)
      set({ video: url })
      toast('Video de banner actualizado', 'success')
    } catch (error) {
      toast(error?.message || 'No se pudo subir el video', 'error')
    }
  }

  const handleGalleryFiles = async (files) => {
    const selected = [...(files || [])].slice(0, 8)
    if (!selected.length) return
    try {
      const uploaded = []
      for (const file of selected) {
        const url = await uploadAsset(file)
        uploaded.push({ url, type: file.type.startsWith('video/') ? 'video' : 'image', title: file.name.replace(/\.[^.]+$/, '') })
      }
      setF(prev => ({ ...prev, gallery: [...(prev.gallery || []), ...uploaded].slice(0, 12) }))
      toast('Galeria actualizada', 'success')
    } catch (error) {
      toast(error?.message || 'No se pudieron subir los archivos', 'error')
    }
  }

  const canNext = step !== 0 || (f.name.trim() && f.description.trim())

  useEffect(() => {
    if (!editId || editing) return
    let cancelled = false
    api(`/communities/${encodeURIComponent(editId)}`)
      .then(data => {
        if (cancelled || !data.community) return
        const remote = data.community
        setF(prev => ({
          ...prev,
          ...remote,
          links: remote.links || {},
          rules: remote.rules?.length ? remote.rules : prev.rules,
          team: remote.team?.length ? remote.team : remote.staff?.length ? remote.staff : prev.team,
          features: { ...prev.features, ...(remote.features || {}) },
        }))
      })
      .catch(() => toast('No se pudo cargar la comunidad para editar.', 'error'))
    return () => { cancelled = true }
  }, [editId, editing])

  useEffect(() => {
    if (editing) return
    const forceOpen = localStorage.getItem(TUTORIAL_FORCE_KEY) === '1'
    const alreadySeen = localStorage.getItem(TUTORIAL_DONE_KEY) === '1'
    if (forceOpen || !alreadySeen) {
      setTutorialOpen(true)
      setTutorialIndex(0)
      setStep(TUTORIAL_STEPS[0].formStep)
      localStorage.removeItem(TUTORIAL_FORCE_KEY)
    }
  }, [editing])

  useEffect(() => {
    if (!tutorialOpen) return
    setStep(TUTORIAL_STEPS[tutorialIndex].formStep)
  }, [tutorialOpen, tutorialIndex])

  const closeTutorial = (completed = false) => {
    setTutorialOpen(false)
    if (completed) localStorage.setItem(TUTORIAL_DONE_KEY, '1')
  }

  const nextTutorial = () => {
    if (tutorialIndex >= TUTORIAL_STEPS.length - 1) {
      closeTutorial(true)
      toast('La guía quedó disponible para reactivarla cuando quieras.', 'info')
      return
    }
    setTutorialIndex(prev => prev + 1)
  }

  const prevTutorial = () => {
    if (tutorialIndex === 0) return
    setTutorialIndex(prev => prev - 1)
  }

  const submit = async () => {
    if (!f.name.trim()) { toast('Falta el nombre de la comunidad', 'error'); setStep(0); return }
    const payload = {
      ...f,
      rules: f.rules.filter(r => r.trim()),
      links: Object.fromEntries(Object.entries(f.links).filter(([, v]) => v && v.trim())),
    }
    try {
      // El backend solo tiene PUT /communities/:id (no PATCH) -- con PATCH
      // esto siempre devolvía 404 y editar una comunidad no hacía nada.
      const endpoint = editId ? `/communities/${encodeURIComponent(editId)}` : '/communities'
      const data = await api(endpoint, {
        method: editId ? 'PUT' : 'POST',
        body: payload,
      })
      const rec = data.community
      setCreated(editId ? { ...rec, _edited: true } : rec)
      window.dispatchEvent(new CustomEvent('gg-admin-summary:update'))
      toast(`${editId ? 'Comunidad actualizada' : 'Comunidad creada'} - ${rec.publicCode || rec.publicId || rec.name}`, 'success')
    } catch (error) {
      toast(error?.message || 'No se pudo guardar la comunidad.', 'error')
    }
  }

  if (created) {
    return (
      <div className="cmc-done">
        <motion.div className="cmc-done__card" initial={{ opacity: 0, scale: .96 }} animate={{ opacity: 1, scale: 1 }}>
          <div className="cmc-done__check">{Icon.check}</div>
          <h1>{created._edited ? '¡Comunidad actualizada!' : '¡Comunidad creada!'}</h1>
          <p>Tu comunidad <b>{created.name}</b> {created._edited ? 'se guardó correctamente' : 'ya existe'}. Gestiónala y publica desde tu panel.</p>
          <div className="cmc-done__id"><span>ID oficial</span><b>{created.publicCode || created.publicId}</b></div>
          <div className="cmc-done__btns">
            <button className="pnl-btn pnl-btn--primary" onClick={() => navigate('/mi-comunidad')}>{Icon.dashboard} Ir al panel</button>
            <button className="pnl-btn" onClick={() => { setCreated(null); setStep(0) }}>{Icon.plus} Crear otra</button>
          </div>
        </motion.div>
      </div>
    )
  }

  return (
    <div className="cmc">
      <div className="pnl-head">
        <div>
          <h1>{editId ? 'Editar comunidad' : 'Crear comunidad'}</h1>
          <p>{editId ? 'Modifica los datos de tu comunidad.' : 'Completa los pasos.'} ID oficial: <code>{idPreview}</code></p>
        </div>
        {!editId && <button className="pnl-btn" onClick={() => { setTutorialOpen(true); setTutorialIndex(0); setStep(0) }}>{Icon.lightbulb} Activar guía</button>}
      </div>

      <AnimatePresence>
        {tutorialOpen && !editId && (
          <motion.div className="cmc-tour-inline" initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}>
            <div className="cmc-tour-inline__top">
              <span className="cmc-tour__eyebrow">Guía paso a paso</span>
              <button className="cmc-tour__close" onClick={() => closeTutorial(false)}>{Icon.x}</button>
            </div>
            <div className="cmc-tour-inline__body">
              <div className="cmc-tour-inline__copy">
                <b>{TUTORIAL_STEPS[tutorialIndex].title}</b>
                <p>{TUTORIAL_STEPS[tutorialIndex].text}</p>
                <small>{TUTORIAL_STEPS[tutorialIndex].note}</small>
              </div>
              <div className="cmc-tour-inline__side">
                <div className="cmc-tour__progress">
                  <span>{tutorialIndex + 1} / {TUTORIAL_STEPS.length}</span>
                  <div className="cmc-tour__bar"><i style={{ width: `${((tutorialIndex + 1) / TUTORIAL_STEPS.length) * 100}%` }} /></div>
                </div>
                <div className="cmc-tour__actions">
                  <button className="pnl-btn" disabled={tutorialIndex === 0} onClick={prevTutorial}>Anterior</button>
                  <button className="pnl-btn" onClick={() => closeTutorial(false)}>Cerrar</button>
                  <button className="pnl-btn pnl-btn--primary" onClick={nextTutorial}>{tutorialIndex === TUTORIAL_STEPS.length - 1 ? 'Terminar' : 'Siguiente paso'}</button>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Stepper */}
      <div className="cmc-steps">
        {STEPS.map((s, i) => (
          <button key={s} className={`cmc-step${i === step ? ' active' : ''}${i < step ? ' done' : ''}`} onClick={() => i < step && setStep(i)}>
            <span className="cmc-step__n">{i < step ? Icon.check : i + 1}</span>
            <span className="cmc-step__l">{s}</span>
          </button>
        ))}
      </div>

      <AnimatePresence mode="wait">
        <motion.div key={step} className={`cmc-panel ${tutorialOpen ? `cmc-panel--focus cmc-panel--${TUTORIAL_STEPS[tutorialIndex].target}` : ''}`} initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -10 }} transition={{ duration: .18 }}>

          {/* �
��
� 1. IDENTIDAD �
��
� */}
          {step === 0 && (
            <>
              <div className="cmc-uploads">
                <button type="button" className="cmc-upload cmc-upload--banner" style={f.banner ? { backgroundImage: `url(${f.banner})` } : undefined} onClick={() => bannerRef.current?.click()}>
                  {f.video && <video src={f.video} muted loop autoPlay playsInline />}
                  {!f.banner && !f.video && <span>{Icon.camera} Subir banner <small>Imagen 1920x480 o video corto</small></span>}
                  <input ref={bannerRef} type="file" accept="image/*" hidden onChange={e => handleBannerImage(e.target.files?.[0])} />
                </button>
                <button type="button" className="cmc-upload cmc-upload--logo" style={f.logo ? { backgroundImage: `url(${f.logo})` } : undefined} onClick={() => logoRef.current?.click()}>
                  {!f.logo && <span>{Icon.camera}<small>Logo</small></span>}
                  <input ref={logoRef} type="file" accept="image/*" hidden onChange={e => e.target.files[0] && readFile(e.target.files[0], v => set({ logo: v }))} />
                </button>
              </div>
              <div className="cmc-media-actions">
                <button type="button" className="cmc-add" onClick={() => bannerRef.current?.click()}>{Icon.camera} Cambiar imagen banner</button>
                <button type="button" className="cmc-add" onClick={() => bannerVideoRef.current?.click()}>{Icon.play} Subir video banner</button>
                <button type="button" className="cmc-add cmc-add--danger" onClick={() => set({ banner: '', video: '' })}>{Icon.x} Quitar banner</button>
                <input ref={bannerVideoRef} type="file" accept="video/mp4,video/webm" hidden onChange={e => handleBannerVideo(e.target.files?.[0])} />
              </div>
              <div className="cmc-grid2">
                <label className="cmc-field"><span>Nombre público *</span><input value={f.name} onChange={e => set({ name: e.target.value })} placeholder="Ej. GlitchGang Valorant" /></label>
                <label className="cmc-field"><span>Acento</span><input type="color" value={f.accent} onChange={e => set({ accent: e.target.value })} className="cmc-color" /></label>
                <label className="cmc-field"><span>Región</span><select value={f.region} onChange={e => set({ region: e.target.value })}>{REGIONS.map(r => <option key={r}>{r}</option>)}</select></label>
                <label className="cmc-field"><span>Idioma</span><select value={f.lang} onChange={e => set({ lang: e.target.value })}>{LANGS.map(l => <option key={l}>{l}</option>)}</select></label>
              </div>
              <label className="cmc-field"><span>Historia / descripción *</span><textarea rows={4} value={f.description} onChange={e => set({ description: e.target.value })} placeholder="Cuenta de qué trata tu comunidad, su origen y objetivo⬦" /></label>
            </>
          )}

          {/* �
��
� 2. REDES �
��
� */}
          {step === 1 && (
            <>
              <p className="cmc-hint">Solo mostraremos los enlaces que llenes. Todo es opcional.</p>
              <div className="cmc-grid2">
                {SOCIALS.map(s => (
                  <label className="cmc-field" key={s.key}>
                    <span>{Icon[s.icon]} {s.label}</span>
                    <input value={f.links[s.key] || ''} onChange={e => setLink(s.key, e.target.value)} placeholder={s.ph} />
                  </label>
                ))}
              </div>
            </>
          )}

          {/* �
��
� 3. CONTENIDO �
��
� */}
          {step === 2 && (
            <>
              <div className="cmc-block">
                <h3>Juego(s)</h3>
                <p className="cmc-hint">Si eliges más de uno, la comunidad se organiza por categorías.</p>
                <div className="cmc-chips">
                  {GAME_NAMES.map(g => <button key={g} type="button" className={`cmc-chip${f.games.includes(g) ? ' active' : ''}`} onClick={() => toggleGame(g)}>{f.games.includes(g) && Icon.check} {g}</button>)}
                </div>
              </div>
              <div className="cmc-grid2">
                <label className="cmc-field"><span>Quién puede publicar</span><select value={f.whoPublishes} onChange={e => set({ whoPublishes: e.target.value })}><option>Todos</option><option>Solo staff</option><option>Solo dueño</option></select></label>
                <label className="cmc-field"><span>Audiencia</span><select value={f.audience} onChange={e => set({ audience: e.target.value })}><option>Mixto</option><option>+18</option><option>Familiar</option></select></label>
              </div>
              <label className="cmc-field"><span>Contenido prohibido</span><textarea rows={2} value={f.banned} onChange={e => set({ banned: e.target.value })} /></label>
              <div className="cmc-grid2">
                <label className="cmc-field"><span>Qué está permitido</span><textarea rows={3} value={f.allowed} onChange={e => set({ allowed: e.target.value })} /></label>
                <label className="cmc-field"><span>Qué NO está permitido</span><textarea rows={3} value={f.notAllowed} onChange={e => set({ notAllowed: e.target.value })} /></label>
              </div>
              <div className="cmc-block">
                <h3>Reglas (enumeradas)</h3>
                {f.rules.map((r, i) => (
                  <div className="cmc-rule" key={i}>
                    <span className="cmc-rule__n">{i + 1}</span>
                    <input value={r} onChange={e => setRule(i, e.target.value)} placeholder={`Regla ${i + 1}`} />
                    <button type="button" className="cmc-rule__x" onClick={() => removeRule(i)}>{Icon.x}</button>
                  </div>
                ))}
                <div className="cmc-rule-actions">
                  <button type="button" className="cmc-add" onClick={addRule}>{Icon.plus} Añadir regla</button>
                  <button type="button" className={`cmc-pdf${f.rulesPdf ? ' has' : ''}`} onClick={() => pdfRef.current?.click()}>
                    {Icon.fileText} {f.rulesPdf ? f.rulesPdf : 'Subir reglas en PDF'}
                    <input ref={pdfRef} type="file" accept=".pdf" hidden onChange={e => e.target.files[0] && set({ rulesPdf: e.target.files[0].name })} />
                  </button>
                </div>
              </div>
            </>
          )}

          {/* �
��
� 4. EQUIPO �
��
� */}
          {step === 3 && (
            <div className="cmc-block">
              <h3>Equipo y roles</h3>
              <p className="cmc-hint">Selecciona el rol y escribe el ID o username de la persona a designar. Los permisos para publicar dependen de estos roles.</p>
              {f.team.map((t, i) => (
                <div className="cmc-team" key={i}>
                  <select value={t.role} onChange={e => setTeam(i, { role: e.target.value })}>{TEAM_ROLES.map(r => <option key={r}>{r}</option>)}</select>
                  <input value={t.username} onChange={e => setTeam(i, { username: e.target.value })} placeholder="ID o @username" />
                  <button type="button" className="cmc-rule__x" onClick={() => removeTeam(i)} disabled={i === 0}>{Icon.x}</button>
                </div>
              ))}
              <button type="button" className="cmc-add" onClick={addTeam}>{Icon.plus} Añadir miembro del staff</button>
            </div>
          )}

          {/* �
��
� 5. AVANZADO �
��
� */}
          {step === 4 && (
            <>
              <div className="cmc-block">
                <h3>Avanzado · Imagen</h3>
                <p className="cmc-hint">Vista previa de cómo se verá tu comunidad con el banner, logo y acento elegidos.</p>
                <div className="cmc-preview" style={{ '--pa': f.accent }}>
                  <div className="cmc-preview__banner" style={f.banner ? { backgroundImage: `url(${f.banner})` } : undefined}>{f.video && <video src={f.video} muted loop autoPlay playsInline />}</div>
                  <div className="cmc-preview__logo" style={f.logo ? { backgroundImage: `url(${f.logo})` } : undefined}>{!f.logo && (f.name[0] || 'C')}</div>
                  <div className="cmc-preview__info"><b>{f.name || 'Tu comunidad'}</b><small>{f.region} · {f.games.join(', ') || 'Sin juegos'}</small></div>
                </div>
              </div>
              <div className="cmc-block">
                <h3>Galeria de comunidad</h3>
                <p className="cmc-hint">Sube fotos o videos para que aparezcan en la pagina publica de la comunidad.</p>
                <div className="cmc-gallery-tools">
                  <button type="button" className="cmc-add" onClick={() => galleryRef.current?.click()}>{Icon.plus} Agregar fotos o videos</button>
                  <input ref={galleryRef} type="file" accept="image/*,video/mp4,video/webm" multiple hidden onChange={e => handleGalleryFiles(e.target.files)} />
                </div>
                <div className="cmc-gallery">
                  {(f.gallery || []).map((item, i) => (
                    <div className="cmc-gallery__item" key={`${item.url}-${i}`}>
                      {item.type === 'video' ? <video src={item.url} muted /> : <img src={item.url} alt={item.title || `Galeria ${i + 1}`} />}
                      <input value={item.title || ''} onChange={e => setGalleryTitle(i, e.target.value)} placeholder="Titulo o descripcion corta" />
                      <button type="button" onClick={() => removeGalleryItem(i)}>{Icon.x}</button>
                    </div>
                  ))}
                  {!(f.gallery || []).length && <p className="cmc-hint">Aun no hay fotos en la galeria.</p>}
                </div>
              </div>
              <div className="cmc-block">
                <h3>Funciones</h3>
                {/* Ningún módulo aplica todavía estas opciones (se guardan, nada las lee). */}
                <p className="cmc-hint">Estas funciones se habilitarán en la próxima versión. Tu selección queda guardada.</p>
                <div className="cmc-features">
                  {FEATURES.map(ft => (
                    <button key={ft.key} type="button" className={`cmc-feature${f.features[ft.key] ? ' on' : ''}`} onClick={() => toggleFeature(ft.key)}>
                      {f.features[ft.key] && <span className="cmc-feature__c">{Icon.check}</span>}{ft.label}
                    </button>
                  ))}
                </div>
              </div>
            </>
          )}
        </motion.div>
      </AnimatePresence>

      {/* Nav */}
      <div className="cmc-nav">
        <button className="pnl-btn" disabled={step === 0} onClick={() => setStep(s => s - 1)}>Atrás</button>
        {step < STEPS.length - 1
          ? <button className="pnl-btn pnl-btn--primary" disabled={!canNext} onClick={() => setStep(s => s + 1)}>Siguiente</button>
          : <button className="pnl-btn pnl-btn--primary" onClick={submit}>{Icon.check} {editId ? 'Guardar cambios' : 'Crear comunidad'}</button>}
      </div>

    </div>
  )
}

