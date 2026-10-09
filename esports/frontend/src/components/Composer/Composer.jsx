import { useState, useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import Avatar from '../Avatar/Avatar.jsx'
import { Icon } from '../icons/Icons.jsx'
import { api } from '../../lib/api.js'
import { toast } from '../../lib/toast.js'
import './Composer.css'

const TYPE_META = {
  post:             { icon: Icon.edit,     label: 'Mensaje' },
  logro:            { icon: Icon.award,    label: 'Logro' },
  poll:             { icon: Icon.chartBar, label: 'Encuesta' },
  tournament:       { icon: Icon.trophy,   label: 'Torneo' },
  event:            { icon: Icon.bolt,     label: 'Evento' },
  reto:             { icon: Icon.target,   label: 'Reto' },
  reclutamiento:    { icon: Icon.users,    label: 'Reclutamiento' },
  share_tournament: { icon: Icon.trophy,   label: 'Compartir Torneo' },
  share_team:       { icon: Icon.team,     label: 'Compartir Equipo' }
}

const GAME_LIST = ['Valorant', 'CS2', 'League of Legends', 'Apex Legends', 'Rocket League', 'Dota 2', 'Free Fire', 'Mobile Legends']
const FORMAT_LIST = ['5vs5 — Eliminación simple', '5vs5 — Eliminación doble', 'Grupos + Play-offs', '1vs1 — Bo3', 'Round Robin']

export default function Composer({ onSubmit, userRole = 'member', communitySlug = '', userAvatar, userNick, userStatus, allowedTypes, forceShareOnly }) {
  const allowed = allowedTypes || ['post', 'logro', 'poll', 'tournament', 'event']
  const canCreate = !forceShareOnly && ['admin', 'moderator', 'organizer', 'tournament-organizer', 'event-organizer'].includes(userRole)

  const [active, setActive] = useState(false)
  const [type, setType] = useState(allowed[0] || 'post')
  const [loading, setLoading] = useState(false)

  // Share vs Create Modes
  const [tMode, setTMode] = useState('share')
  const [eMode, setEMode] = useState('share')
  const [tId, setTId] = useState('')
  const [eId, setEId] = useState('')
  const [teamIdInput, setTeamIdInput] = useState('')

  // Live Previews
  const [tPreview, setTPreview] = useState(null)
  const [teamPreview, setTeamPreview] = useState(null)
  const [loadingPreview, setLoadingPreview] = useState(false)

  // Sync mode based on role
  useEffect(() => {
    const allowedToCreate = !forceShareOnly && ['admin', 'moderator', 'organizer', 'tournament-organizer', 'event-organizer'].includes(userRole)
    setTMode(allowedToCreate ? 'create' : 'share')
    setEMode(allowedToCreate ? 'create' : 'share')
  }, [userRole, forceShareOnly])

  // Debounced Tournament Live Preview
  useEffect(() => {
    const query = tId.trim()
    if (!query) {
      setTPreview(null)
      return
    }
    setLoadingPreview(true)
    const delayDebounce = setTimeout(() => {
      api(`/tournaments/${query}`)
        .then(res => setTPreview(res))
        .catch(() => setTPreview(null))
        .finally(() => setLoadingPreview(false))
    }, 600)
    return () => clearTimeout(delayDebounce)
  }, [tId])

  // Debounced Team Live Preview
  useEffect(() => {
    const query = teamIdInput.trim()
    if (!query) {
      setTeamPreview(null)
      return
    }
    setLoadingPreview(true)
    const delayDebounce = setTimeout(() => {
      api(`/teams/${query}`)
        .then(res => setTeamPreview(res))
        .catch(() => setTeamPreview(null))
        .finally(() => setLoadingPreview(false))
    }, 600)
    return () => clearTimeout(delayDebounce)
  }, [teamIdInput])

  // General Post state
  const [content, setContent] = useState('')
  const [imageFile, setImageFile] = useState(null)
  const [imagePreview, setImagePreview] = useState('')
  const [docFile, setDocFile] = useState(null)
  const [docName, setDocName] = useState('')

  // Achievement state
  const [achTitle, setAchTitle] = useState('')

  // Reto state
  const [rTitle, setRTitle] = useState('')
  const [rGame, setRGame] = useState(GAME_LIST[0])
  const [rStake, setRStake] = useState('')

  // Reclutamiento state
  const [recTitle, setRecTitle] = useState('')
  const [recGame, setRecGame] = useState(GAME_LIST[0])
  const [recRole, setRecRole] = useState('')

  // Tournament state
  const [tTitle, setTTitle]   = useState('')
  const [tGame,  setTGame]    = useState(GAME_LIST[0])
  const [tFmt,   setTFmt]     = useState(FORMAT_LIST[0])
  const [tSlots, setTSlots]   = useState(8)
  const [tPrize, setTPrize]   = useState('')
  const [tDate,  setTDate]    = useState('')

  // Event state
  const [eTitle, setETitle]   = useState('')
  const [eDesc,  setEDesc]    = useState('')
  const [eDate,  setEDate]    = useState('')
  const [eTime,  setETime]    = useState('')
  const [eLink,  setELink]    = useState('')

  // Poll state
  const [pQuestion, setPQuestion] = useState('')
  const [pOptions,  setPOptions]  = useState(['', ''])

  const fileInputRef = useRef(null)
  const docInputRef = useRef(null)

  const reset = () => {
    setContent(''); setImageFile(null); setImagePreview(''); setDocFile(null); setDocName('')
    setAchTitle('')
    setTId(''); setEId(''); setTeamIdInput('')
    setTPreview(null); setTeamPreview(null)
    setRTitle(''); setRGame(GAME_LIST[0]); setRStake('')
    setRecTitle(''); setRecGame(GAME_LIST[0]); setRecRole('')
    setTTitle(''); setTGame(GAME_LIST[0]); setTFmt(FORMAT_LIST[0])
    setTSlots(8); setTPrize(''); setTDate('')
    setETitle(''); setEDesc(''); setEDate(''); setETime(''); setELink('')
    setPQuestion(''); setPOptions(['', ''])
    setActive(false)
  }

  const handleImageChange = (e) => {
    const file = e.target.files[0]
    if (!file) return
    if (file.size > 8 * 1024 * 1024) {
      toast('La imagen supera el límite de 8MB', 'error')
      return
    }
    setImageFile(file)
    setDocFile(null)
    const reader = new FileReader()
    reader.onloadend = () => setImagePreview(reader.result)
    reader.readAsDataURL(file)
  }

  const handleDocChange = (e) => {
    const file = e.target.files[0]
    if (!file) return
    if (file.size > 8 * 1024 * 1024) {
      toast('El documento supera el límite de 8MB', 'error')
      return
    }
    setDocFile(file)
    setDocName(file.name)
    setImageFile(null)
    setImagePreview('')
  }

  const uploadFileToBase64 = async (file) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.readAsDataURL(file)
      reader.onload = async () => {
        try {
          const res = await api('/uploads', {
            method: 'POST',
            body: { dataUrl: reader.result, filename: file.name }
          })
          resolve(res.url)
        } catch (err) {
          reject(err)
        }
      }
      reader.onerror = (error) => reject(error)
    })
  }

  const submit = async () => {
    setLoading(true)
    try {
      let photoUrl = ''
      let fileUrl = ''
      let fileName = ''

      if (imageFile) {
        photoUrl = await uploadFileToBase64(imageFile)
      } else if (docFile) {
        fileUrl = await uploadFileToBase64(docFile)
        fileName = docName
      }

      // `kind` debe ser uno del enum de Post: 'tournament'/'event' no lo son y
      // Mongoose rechazaba la publicación (crear torneo/evento siempre fallaba).
      const KIND_BY_TYPE = { poll: 'encuesta', tournament: 'torneo', event: 'evento', share_tournament: 'torneo', share_team: 'compartir_equipo' }
      let payload = {
        kind: type === 'post'
          ? (photoUrl ? 'foto' : fileUrl ? 'documento' : 'mensaje')
          : (KIND_BY_TYPE[type] || type),
        communitySlug,
        photoUrl,
        fileUrl,
        fileName
      }

      if (type === 'post') {
        if (!content.trim()) {
          toast('Escribe un mensaje para publicar', 'error')
          setLoading(false)
          return
        }
        payload.text = content.trim()
      }

      if (type === 'logro') {
        if (!achTitle.trim() || !content.trim()) {
          toast('Ingresa un título y descripción para el logro', 'error')
          setLoading(false)
          return
        }
        payload.title = achTitle.trim()
        payload.text = content.trim()
      }

      if (type === 'reto') {
        if (!rTitle.trim() || !content.trim()) {
          toast('Ingresa un título y descripción para el reto', 'error')
          setLoading(false)
          return
        }
        payload.title = rTitle.trim()
        payload.text = content.trim()
        payload.challengeData = {
          game: rGame,
          stake: rStake.trim() || 'Por diversión'
        }
      }

      if (type === 'reclutamiento') {
        if (!recTitle.trim() || !recRole.trim() || !content.trim()) {
          toast('Completa todos los campos de reclutamiento', 'error')
          setLoading(false)
          return
        }
        payload.title = recTitle.trim()
        payload.text = content.trim()
        payload.recruitmentData = {
          roleNeeded: recRole.trim(),
          game: recGame
        }
      }

      if (type === 'share_tournament' || (type === 'tournament' && tMode === 'share')) {
        if (!tId.trim()) {
          toast('Ingresa el ID del torneo para compartir', 'error')
          setLoading(false)
          return
        }
        payload.kind = 'torneo'
        payload.tournamentId = tId.trim()
        payload.text = content.trim() || '¡Mira este torneo!'
      }

      if (type === 'share_team') {
        if (!teamIdInput.trim()) {
          toast('Ingresa el ID o Tag del equipo para compartir', 'error')
          setLoading(false)
          return
        }
        payload.kind = 'compartir_equipo'
        payload.teamId = teamIdInput.trim()
        payload.text = content.trim() || '¡Mira este equipo!'
      }

      if (type === 'poll') {
        const activeOpts = pOptions.filter(o => o.trim())
        if (!pQuestion.trim() || activeOpts.length < 2) {
          toast('La encuesta necesita una pregunta y al menos 2 opciones', 'error')
          setLoading(false)
          return
        }
        payload.text = pQuestion.trim()
        payload.kind = 'encuesta'
        payload.pollOptions = activeOpts
      }

      if (type === 'tournament' && tMode === 'create') {
        if (!tTitle.trim() || !tDate) {
          toast('Ingresa el título y la fecha del torneo', 'error')
          setLoading(false)
          return
        }
        payload.text = `Torneo oficial de ${tGame}`
        payload.title = tTitle.trim()
        payload.tournamentData = {
          game: tGame,
          format: tFmt,
          slots: Number(tSlots),
          prize: tPrize || 'Por definir',
          date: new Date(tDate)
        }
      }

      // Compartir un evento existente: antes el ID se escribía pero no se enviaba.
      if (type === 'event' && eMode === 'share') {
        if (!eId.trim()) {
          toast('Ingresa el ID del evento para compartir', 'error')
          setLoading(false)
          return
        }
        payload.eventId = eId.trim()
        payload.text = content.trim() || '¡Mira este evento!'
      }

      if (type === 'event' && eMode === 'create') {
        if (!eTitle.trim() || !eDate || !eTime) {
          toast('Ingresa el título, fecha y hora del evento', 'error')
          setLoading(false)
          return
        }
        payload.text = eDesc.trim() || `Evento de la comunidad`
        payload.eventData = {
          title: eTitle.trim(),
          description: eDesc.trim(),
          date: new Date(eDate),
          time: eTime,
          link: eLink.trim()
        }
      }

      // 3. Send to API
      const newPost = await api('/posts', {
        method: 'POST',
        body: payload
      })

      toast('¡Publicado con éxito!', 'success')
      onSubmit?.(newPost)
      reset()
    } catch (err) {
      console.error(err)
      toast(err.message || 'Error al publicar', 'error')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className={`gg-composer ${active ? 'open' : ''}`}>
      {/* Collapsed trigger */}
      {!active && (
        <div className="gg-composer__trigger" onClick={() => setActive(true)}>
          <Avatar src={userAvatar || ''} size={36} status={userStatus} />
          <span className="gg-composer__placeholder">
            {forceShareOnly ? 'Comparte un mensaje, encuesta, torneo o equipo existente' : '¿Qué quieres compartir con la comunidad?'}
          </span>
          <span className="gg-composer__trigger-icon">{Icon.edit}</span>
        </div>
      )}

      {/* Expanded */}
      <AnimatePresence>
        {active && (
          <motion.div
            className="gg-composer__expanded"
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
          >
            {/* Type selector */}
            {allowed.length > 1 && (
              <div className="gg-composer__types">
                {allowed.map(t => {
                  const meta = TYPE_META[t] || TYPE_META.post
                  return (
                    <button
                      key={t} type="button"
                      className={`gg-composer__type-btn ${type === t ? 'active' : ''}`}
                      onClick={() => setType(t)}
                    >
                      {meta.icon} {meta.label}
                    </button>
                  )
                })}
              </div>
            )}

            {/* ── LOGRO TITLE ── */}
            {type === 'logro' && (
              <input
                className="gg-composer__achievement-title"
                placeholder="🏆 Título del logro obtenido (ej: ¡Campeón de Copa!)"
                value={achTitle}
                onChange={e => setAchTitle(e.target.value)}
              />
            )}

            {/* ── RETO FORM ── */}
            {type === 'reto' && (
              <div className="gg-composer__form">
                <div className="gg-composer__row">
                  <div className="gg-composer__field">
                    <label>Título del Reto</label>
                    <input value={rTitle} onChange={e => setRTitle(e.target.value)} placeholder="Reto 1v1 Valorant, Desafío de Escuadra..." />
                  </div>
                  <div className="gg-composer__field">
                    <label>Juego</label>
                    <select value={rGame} onChange={e => setRGame(e.target.value)}>
                      {GAME_LIST.map(g => <option key={g}>{g}</option>)}
                    </select>
                  </div>
                </div>
                <div className="gg-composer__field">
                  <label>Apuesta / Recompensa (opcional)</label>
                  <input value={rStake} onChange={e => setRStake(e.target.value)} placeholder="Ej: 100 GP, Por el honor, etc." />
                </div>
              </div>
            )}

            {/* ── RECLUTAMIENTO FORM ── */}
            {type === 'reclutamiento' && (
              <div className="gg-composer__form">
                <div className="gg-composer__row">
                  <div className="gg-composer__field">
                    <label>Título de la Búsqueda</label>
                    <input value={recTitle} onChange={e => setRecTitle(e.target.value)} placeholder="Buscando IGL, Reclutando Support..." />
                  </div>
                  <div className="gg-composer__field">
                    <label>Juego</label>
                    <select value={recGame} onChange={e => setRecGame(e.target.value)}>
                      {GAME_LIST.map(g => <option key={g}>{g}</option>)}
                    </select>
                  </div>
                </div>
                <div className="gg-composer__field">
                  <label>Rol Necesitado</label>
                  <input value={recRole} onChange={e => setRecRole(e.target.value)} placeholder="Ej: IGL, Duelista, Flex, Coach..." />
                </div>
              </div>
            )}

            {/* ── SHARE TOURNAMENT BY ID ── */}
            {type === 'share_tournament' && (
              <div className="gg-composer__form">
                <div className="gg-composer__field">
                  <label>ID o Código del Torneo</label>
                  <input 
                    value={tId} 
                    onChange={e => setTId(e.target.value)} 
                    placeholder="Ingresa el ID del torneo (ej: TOR-VAL-ORG100-001-01)" 
                  />
                </div>

                {/* Live Preview Card */}
                {loadingPreview && <div className="gg-composer__preview-loading">Buscando torneo...</div>}
                {!loadingPreview && tPreview && (
                  <div className="gg-composer__live-preview tournament">
                    <span className="badge">📢 Torneo Encontrado</span>
                    <h4>{tPreview.title}</h4>
                    <div className="preview-grid">
                      <span>🎮 {tPreview.game}</span>
                      <span>🏆 {tPreview.prizePool ? `${tPreview.prizePool} ${tPreview.currency || 'USD'}` : 'Sin premio'}</span>
                      <span>👥 {tPreview.maxSlots} Slots</span>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* ── SHARE TEAM BY ID ── */}
            {type === 'share_team' && (
              <div className="gg-composer__form">
                <div className="gg-composer__field">
                  <label>ID o Tag del Equipo</label>
                  <input 
                    value={teamIdInput} 
                    onChange={e => setTeamIdInput(e.target.value)} 
                    placeholder="Ingresa el ID o Tag de tu equipo..." 
                  />
                </div>

                {/* Live Preview Card */}
                {loadingPreview && <div className="gg-composer__preview-loading">Buscando equipo...</div>}
                {!loadingPreview && teamPreview && (
                  <div className="gg-composer__live-preview team">
                    <span className="badge">👥 Equipo Encontrado</span>
                    <div className="team-preview-info">
                      {teamPreview.logo && <img src={teamPreview.logo} alt="Logo" className="team-preview-logo" />}
                      <div>
                        <h4>{teamPreview.name} [{teamPreview.tag}]</h4>
                        <span>🎮 {teamPreview.game || 'Varios'}</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* ── GENERAL TEXTAREA (for post, logro, reto, reclutamiento, tournament share, team share) ── */}
            {(type === 'post' || type === 'logro' || type === 'reto' || type === 'reclutamiento' || type === 'share_tournament' || type === 'share_team') && (
              <div className="gg-composer__text-container">
                <textarea
                  className="gg-composer__textarea"
                  placeholder={
                    type === 'logro' ? "Describe tu logro gamer..." : 
                    type === 'reto' ? "Describe el reto (reglas, horarios, etc.)..." : 
                    type === 'reclutamiento' ? "Describe los requisitos y lo que ofreces..." :
                    type === 'share_tournament' ? "Escribe un comentario invitando a otros a participar..." :
                    type === 'share_team' ? "Escribe un comentario presentando a tu equipo..." :
                    "Escribe algo para la comunidad…"
                  }
                  value={content}
                  onChange={e => setContent(e.target.value)}
                  rows={3}
                />
                
                {/* File Attachment Previews */}
                {imagePreview && (
                  <div className="gg-composer__file-preview image">
                    <img src={imagePreview} alt="Preview" />
                    <button type="button" className="remove-btn" onClick={() => { setImageFile(null); setImagePreview('') }}>
                      {Icon.x}
                    </button>
                  </div>
                )}
                {docName && (
                  <div className="gg-composer__file-preview doc">
                    <span className="icon">📄</span>
                    <span className="name">{docName}</span>
                    <button type="button" className="remove-btn" onClick={() => { setDocFile(null); setDocName('') }}>
                      {Icon.x}
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* ── TOURNAMENT (Legacy / Creation Mode for Communities) ── */}
            {type === 'tournament' && (
              <div className="gg-composer__form">
                {canCreate && (
                  <div className="gg-composer__mode-toggle">
                    <button type="button" className={`mode-btn ${tMode === 'share' ? 'active' : ''}`} onClick={() => setTMode('share')}>
                      Compartir por ID
                    </button>
                    <button type="button" className={`mode-btn ${tMode === 'create' ? 'active' : ''}`} onClick={() => setTMode('create')}>
                      Crear nuevo Torneo
                    </button>
                  </div>
                )}

                {tMode === 'share' ? (
                  <div className="gg-composer__share-by-id">
                    <div className="gg-composer__field">
                      <label>ID del Torneo</label>
                      <input 
                        value={tId} 
                        onChange={e => setTId(e.target.value)} 
                        placeholder="Ingresa el ID del torneo..." 
                      />
                    </div>
                    <div className="gg-composer__field" style={{ marginTop: '10px' }}>
                      <label>Comentario adicional</label>
                      <textarea 
                        rows={2} 
                        value={content} 
                        onChange={e => setContent(e.target.value)} 
                        placeholder="Escribe algo sobre este torneo..." 
                      />
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="gg-composer__row">
                      <div className="gg-composer__field">
                        <label>Título del torneo</label>
                        <input value={tTitle} onChange={e => setTTitle(e.target.value)} placeholder="GG Open #13" />
                      </div>
                      <div className="gg-composer__field">
                        <label>Juego</label>
                        <select value={tGame} onChange={e => setTGame(e.target.value)}>
                          {GAME_LIST.map(g => <option key={g}>{g}</option>)}
                        </select>
                      </div>
                    </div>
                    <div className="gg-composer__row">
                      <div className="gg-composer__field">
                        <label>Formato</label>
                        <select value={tFmt} onChange={e => setTFmt(e.target.value)}>
                          {FORMAT_LIST.map(f => <option key={f}>{f}</option>)}
                        </select>
                      </div>
                      <div className="gg-composer__field">
                        <label>Slots</label>
                        <input type="number" min={2} max={128} value={tSlots} onChange={e => setTSlots(e.target.value)} />
                      </div>
                    </div>
                    <div className="gg-composer__row">
                      <div className="gg-composer__field">
                        <label>Premio (opcional)</label>
                        <input value={tPrize} onChange={e => setTPrize(e.target.value)} placeholder="€500" />
                      </div>
                      <div className="gg-composer__field">
                        <label>Fecha</label>
                        <input type="date" value={tDate} onChange={e => setTDate(e.target.value)} />
                      </div>
                    </div>
                  </>
                )}
              </div>
            )}

            {/* ── EVENT (Legacy / Creation Mode for Communities) ── */}
            {type === 'event' && (
              <div className="gg-composer__form">
                {canCreate && (
                  <div className="gg-composer__mode-toggle">
                    <button type="button" className={`mode-btn ${eMode === 'share' ? 'active' : ''}`} onClick={() => setEMode('share')}>
                      Compartir por ID
                    </button>
                    <button type="button" className={`mode-btn ${eMode === 'create' ? 'active' : ''}`} onClick={() => setEMode('create')}>
                      Crear nuevo Evento
                    </button>
                  </div>
                )}

                {eMode === 'share' ? (
                  <div className="gg-composer__share-by-id">
                    <div className="gg-composer__field">
                      <label>ID del Evento</label>
                      <input 
                        value={eId} 
                        onChange={e => setEId(e.target.value)} 
                        placeholder="Ingresa el ID del evento..." 
                      />
                    </div>
                    <div className="gg-composer__field" style={{ marginTop: '10px' }}>
                      <label>Comentario adicional</label>
                      <textarea 
                        rows={2} 
                        value={content} 
                        onChange={e => setContent(e.target.value)} 
                        placeholder="Escribe algo sobre este evento..." 
                      />
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="gg-composer__field">
                      <label>Título del evento</label>
                      <input value={eTitle} onChange={e => setETitle(e.target.value)} placeholder="Scrim Night, Watch Party…" />
                    </div>
                    <div className="gg-composer__field">
                      <label>Descripción</label>
                      <textarea rows={2} value={eDesc} onChange={e => setEDesc(e.target.value)} placeholder="Descripción breve del evento" />
                    </div>
                    <div className="gg-composer__row">
                      <div className="gg-composer__field">
                        <label>Fecha</label>
                        <input type="date" value={eDate} onChange={e => setEDate(e.target.value)} />
                      </div>
                      <div className="gg-composer__field">
                        <label>Hora</label>
                        <input type="time" value={eTime} onChange={e => setETime(e.target.value)} />
                      </div>
                    </div>
                    <div className="gg-composer__field">
                      <label>Enlace / Lugar (opcional)</label>
                      <input value={eLink} onChange={e => setELink(e.target.value)} placeholder="discord.gg/bZTsanNB3G" />
                    </div>
                  </>
                )}
              </div>
            )}

            {/* ── POLL ── */}
            {type === 'poll' && (
              <div className="gg-composer__form">
                <div className="gg-composer__field">
                  <label>Pregunta de la encuesta</label>
                  <input value={pQuestion} onChange={e => setPQuestion(e.target.value)} placeholder="¿Cuál es tu equipo favorito?" />
                </div>
                <div className="gg-composer__field">
                  <label>Opciones</label>
                  {pOptions.map((opt, i) => (
                    <div key={i} className="gg-composer__poll-opt-row">
                      <input
                        value={opt}
                        onChange={e => setPOptions(prev => prev.map((o, j) => j === i ? e.target.value : o))}
                        placeholder={`Opción ${i + 1}`}
                      />
                      {pOptions.length > 2 && (
                        <button type="button" className="delete-opt" onClick={() => setPOptions(prev => prev.filter((_, j) => j !== i))}>
                          {Icon.x}
                        </button>
                      )}
                    </div>
                  ))}
                  {pOptions.length < 6 && (
                    <button type="button" className="gg-composer__add-opt" onClick={() => setPOptions(prev => [...prev, ''])}>
                      {Icon.plus} Añadir opción
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* Attachments Buttons */}
            <div className="gg-composer__toolbar">
              <div className="gg-composer__attachment-buttons">
                {/* Only show file uploads for general posts */}
                {type === 'post' && (
                  <>
                    <button type="button" className="toolbar-btn" onClick={() => fileInputRef.current?.click()} title="Adjuntar Imagen">
                      {Icon.camera} <span className="lbl">Imagen</span>
                      <input type="file" ref={fileInputRef} accept="image/*" onChange={handleImageChange} hidden />
                    </button>
                    <button type="button" className="toolbar-btn" onClick={() => docInputRef.current?.click()} title="Adjuntar Documento">
                      {Icon.fileText} <span className="lbl">Archivo</span>
                      <input type="file" ref={docInputRef} accept=".pdf,.doc,.docx,.xls,.xlsx,.txt,.zip" onChange={handleDocChange} hidden />
                    </button>
                  </>
                )}
              </div>

              {/* Action Buttons */}
              <div className="gg-composer__actions">
                <button type="button" className="gg-btn gg-btn--ghost gg-btn--sm" onClick={reset} disabled={loading}>
                  Cancelar
                </button>
                <button type="button" className="gg-btn gg-btn--primary gg-btn--sm" onClick={submit} disabled={loading}>
                  {loading ? 'Publicando...' : `Publicar ${TYPE_META[type]?.label || 'Publicación'}`}
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

