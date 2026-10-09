import { Children, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { useNavigate } from 'react-router-dom'
import { Icon } from '../../components/icons/Icons.jsx'
import PlayerCard, { CARD_MODELS, resolveCardModel } from '../../components/PlayerCard/PlayerCard.jsx'
import { useAuth } from '../../context/AuthContext.jsx'
import { api } from '../../lib/api.js'
import {
  ACHIEVEMENT_CARDS, COMBOS, FRAMES, FRAME_BY_ID, PLATES, PLATE_BY_ID, STATUSES, STATUS_BY_ID, CARD_BY_ID,
  UNLOCK_SOURCES, WELCOME_FRAME, WELCOME_PLATE, DEFAULT_STATUS, resolveFrameId, resolvePlateId, resolveStatusId, sourceInfo,
} from '../../data/cosmetics.js'
import { formatRemaining, isBirthdayToday, useCosmeticUnlocks } from '../../lib/cosmeticUnlocks.js'
import { AchievementCard, CosmeticDefs, CosmeticFrame, CosmeticPlate, StatusAvatar } from '../../components/Cosmetics/Cosmetics.jsx'
import { PROFILE_BACKGROUNDS } from '../../data/backgrounds.js'
import { CARD_THEMES, cardThemeVars, getCardTheme } from '../../data/cardThemes.js'
import { toast } from '../../lib/toast.js'
import { GAMES, normalizeGameId } from '../../data/games.js'
import { ranksFor } from '../../data/gameRanks.js'
import { charactersFor } from '../../data/gameCharacters.js'
import { dialCodeFor, UNIQUE_DIAL_CODES, splitDialCode } from '../../data/dialCodes.js'
import { citiesFor } from '../../data/citiesByCountry.js'
import { normalizeCountryCode } from '../../lib/ids.js'
import { useLang } from '../../i18n/LangContext.jsx'
import Avatar from '../../components/Avatar/Avatar.jsx'
import { SOCIAL_PLATFORMS } from '../../data/socialPlatforms.js'
import { GameIdVerify } from '../../components/GameAccountConnect/GameAccountConnect.jsx'
import { isMobileLegends } from '../../../../shared/matchStats.mjs'
import './EditProfile.css'

const TABS = [
  { id: 'identidad', label: 'Identidad', icon: Icon.user },
  { id: 'gamer', label: 'Jugador', icon: Icon.gamepad },
  { id: 'social', label: 'Social', icon: Icon.globe },
  { id: 'visual', label: 'Visual', icon: Icon.palette },
  { id: 'privacidad', label: 'Privacidad', icon: Icon.shield },
]

const COUNTRIES = [
  ['RD', 'Republica Dominicana'],
  ['MX', 'Mexico'],
  ['CO', 'Colombia'],
  ['AR', 'Argentina'],
  ['VE', 'Venezuela'],
  ['CL', 'Chile'],
  ['PE', 'Peru'],
  ['BR', 'Brasil'],
  ['EC', 'Ecuador'],
  ['GT', 'Guatemala'],
  ['PA', 'Panama'],
  ['CR', 'Costa Rica'],
  ['PR', 'Puerto Rico'],
  ['ES', 'Espana'],
  ['US', 'Estados Unidos'],
]

const GENDERS = [
  ['male', Icon.genderMale, 'Masculino'],
  ['female', Icon.genderFemale, 'Femenino'],
  ['non_binary', Icon.genderOther, 'No binario'],
  ['other', Icon.gem, 'Otro'],
  ['prefer_not_to_say', Icon.eye, 'Prefiero no decirlo'],
]

const LANGUAGES = [
  ['es', 'ES', 'Espanol'],
  ['en', 'US', 'Ingles'],
  ['pt', 'BR', 'Portugues'],
  ['fr', 'FR', 'Frances'],
]

const EXPERIENCE = [
  ['rookie', Icon.bolt, 'Principiante'],
  ['mid', Icon.trend, 'Intermedio'],
  ['pro', Icon.award, 'Avanzado / Pro'],
]

const PLATFORMS = [
  ['pc', Icon.tv, 'PC'],
  ['mobile', Icon.phone, 'Mobile'],
  ['console', Icon.gamepad, 'Consola'],
]

const LOOKING_FOR = [
  ['tournaments', Icon.trophy, 'Torneos'],
  ['team_duo', Icon.team, 'Equipo / Duo'],
  ['fun', Icon.gamepad, 'Jugar casual'],
]

const PLAYER_ROLES = ['IGL', 'Duelist', 'Sentinel', 'Initiator', 'Controller', 'Support', 'Entry Fragger', 'AWPer', 'Jungla', 'Roamer', 'Gold Lane', 'Mid Lane', 'EXP Lane']

const CARD_LAYOUTS = CARD_MODELS.map(model => ({
  id: model.id,
  label: model.name,
  mood: {
    punk: 'Bisel magenta con riel lateral y serial publico',
    ak: 'Rejilla verde con sello y marca vertical',
    goku: 'Halo cyan con brackets y placa inferior',
    rock: 'Chaflan violeta con placa superior',
    neon: 'Escalon neon con riel lleno',
    hazard: 'Octagono naranja con chip verificable',
    mono: 'Blanco y negro con barra inferior',
    pulse: 'Pulso violeta con ecualizador y sello',
  }[model.id],
}))

const CARD_BACKGROUND_CHOICES = [
  ...PROFILE_BACKGROUNDS.filter(bg => !bg.isCustom).map(bg => ({ ...bg, kind: 'image' })),
  ...CARD_THEMES.map(theme => ({ ...theme, kind: 'theme', unlocked: true })),
]

// Grilla que muestra solo 2 filas y un "Ver mas" para el resto. Las columnas
// cambian con el ancho (auto-fit), asi que se cuentan del grid real en vez de
// fijar un numero de items: 2 filas son 2 filas en PC y en telefono.
function TwoRowGrid({ className, children }) {
  const ref = useRef(null)
  const [cols, setCols] = useState(0)
  const [open, setOpen] = useState(false)
  const items = Children.toArray(children)

  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return undefined
    const measure = () => setCols(getComputedStyle(el).gridTemplateColumns.split(' ').filter(Boolean).length || 1)
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  const limit = cols * 2
  const overflow = cols > 0 && items.length > limit
  return (
    <>
      <div ref={ref} className={className}>
        {overflow && !open ? items.slice(0, limit) : items}
      </div>
      {overflow && (
        <button type="button" className={`ep-more ${open ? 'is-open' : ''}`} onClick={() => setOpen(v => !v)} aria-expanded={open}>
          <span>{open ? 'Ver menos' : `Ver más (${items.length - limit})`}</span>
          {Icon.chevronRight}
        </button>
      )}
    </>
  )
}

// Propositos agrupados para el "Como se consigue cada uno" de la pestana Visual.
const PURPOSE_GROUPS = Object.entries(UNLOCK_SOURCES)
  .filter(([key]) => key !== 'base')
  .map(([key, info]) => ({
    key,
    info,
    items: [
      ...STATUSES.filter(item => item.source === key).map(item => `Estado ${item.label}`),
      ...FRAMES.filter(item => item.source === key).map(item => `Marco ${item.name}`),
      ...PLATES.filter(item => item.source === key).map(item => `Placa ${item.name}`),
      ...ACHIEVEMENT_CARDS.filter(item => item.source === key).map(item => `Carta ${item.name}`),
    ],
  }))
  .filter(group => group.items.length)

// Etiqueta de cada cosmetico: candado + como se consigue, tiempo que le queda
// a un regalo temporal, o de donde salio (Bienvenida, Premium...).
function UnlockTag({ state, now, auto = false }) {
  const info = sourceInfo(state.source)
  if (auto) return <em className="ep-cos-tag ep-cos-tag--temp">{Icon.calendar}Automático</em>
  if (!state.unlocked) return <em className="ep-cos-tag ep-cos-tag--lock">{Icon.lock}{info.short}</em>
  if (state.expiresAt) return <em className="ep-cos-tag ep-cos-tag--temp">{Icon.clock}Quedan {formatRemaining(state.expiresAt, now)}</em>
  if (info.while) return <em className="ep-cos-tag ep-cos-tag--temp">{Icon.clock}Mientras dure</em>
  return <em className="ep-cos-tag">{info.short}</em>
}

function CosmeticTile({ name, detail, state, now, selected, onPick, auto = false, row = false, children }) {
  const locked = !state.unlocked && !auto
  const info = sourceInfo(state.source)
  return (
    <button
      type="button"
      className={`ep-cos ${row ? 'ep-cos--row' : ''} ${selected ? 'selected' : ''} ${locked ? 'locked' : ''}`}
      onClick={onPick}
      aria-pressed={selected}
      title={locked ? `${name} — ${info.desc}` : name}
    >
      <span className="ep-cos__art" aria-hidden="true">{children}</span>
      <span className="ep-cos__meta">
        <b>{name}</b>
        <small>{locked ? info.desc : detail}</small>
        <UnlockTag state={state} now={now} auto={auto} />
      </span>
      {locked && <span className="ep-cos__lock">{Icon.lock}</span>}
    </button>
  )
}

function findScroller(el) {
  for (let node = el?.parentElement; node; node = node.parentElement) {
    const overflowY = getComputedStyle(node).overflowY
    if ((overflowY === 'auto' || overflowY === 'scroll') && node.scrollHeight > node.clientHeight) return node
  }
  return document.scrollingElement || document.documentElement
}

// Flechas flotantes arriba/abajo. Un toque lleva hasta el principio o el
// final; mantenerlo presionado desplaza rapido (acelerando) mientras se
// sostiene. En PC scrollea .gg-content y en telefono la ventana, por eso se
// busca el contenedor real desde la pagina.
function ScrollJump() {
  const anchorRef = useRef(null)
  const hold = useRef({ timer: 0, frame: 0, held: false })
  const [edge, setEdge] = useState({ top: true, bottom: false, scrollable: false })

  useEffect(() => {
    const scroller = findScroller(anchorRef.current)
    const target = scroller === document.scrollingElement ? window : scroller
    const update = () => {
      const max = scroller.scrollHeight - scroller.clientHeight
      setEdge({ top: scroller.scrollTop <= 4, bottom: scroller.scrollTop >= max - 4, scrollable: max > 120 })
    }
    update()
    target.addEventListener('scroll', update, { passive: true })
    window.addEventListener('resize', update)
    const observer = new ResizeObserver(update)
    observer.observe(anchorRef.current?.parentElement || document.body)
    return () => {
      target.removeEventListener('scroll', update)
      window.removeEventListener('resize', update)
      observer.disconnect()
      clearTimeout(hold.current.timer)
      cancelAnimationFrame(hold.current.frame)
    }
  }, [])

  const stop = () => {
    clearTimeout(hold.current.timer)
    cancelAnimationFrame(hold.current.frame)
  }
  const start = dir => {
    stop()
    hold.current.held = false
    hold.current.timer = setTimeout(() => {
      hold.current.held = true
      const scroller = findScroller(anchorRef.current)
      let speed = 14
      const step = () => {
        // 'instant': html tiene scroll-behavior:smooth, y en telefono (donde
        // scrollea la ventana) cada paso se volvia una animacion que se
        // reiniciaba en el siguiente frame -- el scroll apenas avanzaba.
        scroller.scrollTo({ top: scroller.scrollTop + dir * speed, behavior: 'instant' })
        speed = Math.min(speed * 1.06, 90)
        const max = scroller.scrollHeight - scroller.clientHeight
        if ((dir < 0 && scroller.scrollTop > 0) || (dir > 0 && scroller.scrollTop < max)) hold.current.frame = requestAnimationFrame(step)
      }
      hold.current.frame = requestAnimationFrame(step)
    }, 220)
  }
  const jump = dir => {
    if (hold.current.held) { hold.current.held = false; return }
    const scroller = findScroller(anchorRef.current)
    scroller.scrollTo({ top: dir < 0 ? 0 : scroller.scrollHeight, behavior: 'smooth' })
  }
  const arrow = (dir, label, disabled) => (
    <button
      type="button"
      className={`ep-jump__btn ep-jump__btn--${dir < 0 ? 'up' : 'down'}`}
      aria-label={label}
      title={`${label} (mantén presionado para ir rápido)`}
      disabled={disabled}
      onPointerDown={() => start(dir)}
      onPointerUp={stop}
      onPointerLeave={stop}
      onPointerCancel={stop}
      onContextMenu={e => e.preventDefault()}
      onClick={() => jump(dir)}
    >
      {Icon.chevronRight}
    </button>
  )

  return (
    <>
      <span ref={anchorRef} hidden />
      {edge.scrollable && createPortal(
        <div className="ep-jump">
          {arrow(-1, 'Ir arriba', edge.top)}
          {arrow(1, 'Ir abajo', edge.bottom)}
        </div>,
        document.body,
      )}
    </>
  )
}

// 'followers' se saco a proposito: la plataforma no tiene sistema de
// seguidores todavia (ni endpoint ni boton real en ningun lado), asi que
// si alguien elegia esta opcion ese dato quedaba invisible para siempre --
// nadie puede llegar a ser su "seguidor". Vuelve a agregarse cuando exista.
const VISIBILITY_OPTIONS = [
  ['public', 'Todos'],
  ['friends', 'Solo amigos'],
  ['nobody', 'Nadie'],
]

const PRIVACY_FIELDS = [
  ['personalVisibility', 'Datos personales', 'Nombre, pais, fecha de cumpleanos, sexo, idiomas y biografia.'],
  ['statsVisibility', 'Datos competitivos', 'Nivel, estado de busqueda, puntos y actividad competitiva.'],
  ['gamesVisibility', 'Juegos', 'Juego principal, secundario, lista de juegos y rol dentro del juego.'],
  ['tournamentsVisibility', 'Torneos', 'Inscripciones, historial y actividad de torneos.'],
  ['teamsVisibility', 'Equipo', 'Club, equipo actual, roster y datos asociados.'],
  ['socialVisibility', 'Redes', 'Discord, Twitch, YouTube, Instagram, X y sitio web.'],
]

function dateInputValue(value) {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return date.toISOString().slice(0, 10)
}

function gameById(id) {
  return GAMES.find(game => game.id === id)
}

function resolveUploadUrl(value) {
  if (!value) return value
  const text = String(value)
  if (text.startsWith('blob:')) return text
  try {
    const url = new URL(text, window.location.origin)
    if (url.pathname.startsWith('/uploads/')) return url.pathname
  } catch {}
  return text
}

function flagUrl(code) {
  // "RD" es el codigo de plataforma para Republica Dominicana, no un ISO
  // real -- flagcdn.com necesita el ISO "do" para servir la bandera.
  const iso = String(code || 'RD').toUpperCase() === 'RD' ? 'do' : code
  const cleanCode = String(iso || 'do').toLowerCase().replace(/[^a-z]/g, '').slice(0, 2)
  return `https://flagcdn.com/w80/${cleanCode || 'do'}.png`
}

function formatBirthDateLabel(value, lang = 'es') {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return date.toLocaleDateString(lang === 'en' ? 'en-US' : 'es-DO', { day: 'numeric', month: 'long' })
}

function bannerBackgroundStyle(bg, customUrl) {
  if (bg?.id === 'custom' && customUrl) {
    return { backgroundImage: `linear-gradient(135deg, rgba(5,8,14,.18), rgba(5,8,14,.72)), url(${resolveUploadUrl(customUrl)})` }
  }
  if (bg?.image) {
    return { backgroundImage: `linear-gradient(135deg, rgba(5,8,14,.16), rgba(5,8,14,.68)), url(${bg.poster || bg.image})` }
  }
  return { background: bg?.gradient || 'linear-gradient(135deg, var(--bg-card), var(--bg))' }
}


function splitList(value) {
  return String(value || '')
    .split(',')
    .map(item => item.trim())
    .filter(Boolean)
}

function joinList(value) {
  return Array.isArray(value) ? value.filter(Boolean).join(', ') : ''
}

function buildMiniBio(form, lang = 'es') {
  const isEn = lang === 'en'
  const nick = form.nick?.trim() || (isEn ? 'Player' : 'Jugador')
  const birthday = formatBirthDateLabel(form.birthDate, lang)
  const main = gameById(form.game)?.name
  const preferred = [...new Set([form.game, form.secondGame, ...(form.games || [])].filter(Boolean))]
    .map(gameId => gameById(gameId)?.name || gameId)
    .slice(0, 3)
  const role = form.mainRole || form.ranks?.[form.game] || Object.values(form.ranks || {})[0] || ''
  const platform = PLATFORMS.find(([value]) => value === form.mainPlatform)?.[2] || form.mainPlatform
  const lookingFor = (form.lookingFor || [])
    .map(value => LOOKING_FOR.find(([id]) => id === value)?.[2])
    .filter(Boolean)
    .slice(0, 2)

  if (isEn) {
    const englishGoals = {
      Torneos: 'tournaments',
      'Equipo / Duo': 'team or duo',
      'Jugar casual': 'casual matches',
    }
    const parts = [
      `${nick} is an esports player${main ? ` focused on ${main}` : ''}${platform ? ` on ${platform}` : ''}`,
      role ? `specialized in ${role}` : '',
      preferred.length ? `with favorite games like ${preferred.join(', ')}` : '',
      birthday ? `Birthday: ${birthday}` : '',
      lookingFor.length ? `Looking for ${lookingFor.map(goal => englishGoals[goal] || goal).join(' and ')} in GlitchGang` : '',
    ].filter(Boolean)

    return `${parts.join('. ')}.`
  }

  const parts = [
    `${nick} es un jugador de ${main || 'esports'}${platform ? ` en ${platform}` : ''}`,
    role ? `especializado en ${role}` : '',
    preferred.length ? `con enfoque en ${preferred.join(', ')}` : '',
    birthday ? `Celebra su cumpleanos el ${birthday}` : '',
    lookingFor.length ? `Busca ${lookingFor.join(' y ').toLowerCase()} dentro de GlitchGang` : '',
  ].filter(Boolean)

  return `${parts.join('. ')}.`
}

function completionScore(form, user) {
  const checks = [
    form.nick,
    form.birthDate,
    form.gender,
    form.languages?.length,
    form.country,
    // form.bio se auto-rellena con una sugerencia (buildMiniBio) apenas se
    // abre el formulario, incluso si el usuario nunca guardó una bio real —
    // por eso este check mira el valor ya persistido, no el del formulario.
    Boolean(user?.bio),
    form.game,
    form.experienceLevel,
    form.mainPlatform,
    form.games?.length,
    form.discord || form.instagram || form.twitch || form.youtube,
  ]
  return Math.round((checks.filter(Boolean).length / checks.length) * 100)
}

function Field({ label, hint, children, wide = false }) {
  return (
    <label className={`ep-field ${wide ? 'ep-field--wide' : ''}`}>
      <span>{label}</span>
      {children}
      {hint && <small>{hint}</small>}
    </label>
  )
}

export default function EditProfile() {
  const { user, updateUser } = useAuth()
  const { lang } = useLang()
  const isEn = lang === 'en'
  const navigate = useNavigate()
  const avatarRef = useRef(null)
  const bannerBgRef = useRef(null)
  const cardBgRef = useRef(null)
  const userGamerProfile = user?.gamerProfile || {}
  const initialCountry = normalizeCountryCode(user?.countryCode || 'RD')
  const initialGames = [...new Set((user?.games || []).map(game => normalizeGameId(game, '')).filter(Boolean))]
  const initialMainGame = normalizeGameId(userGamerProfile.mainGame || initialGames[0] || '', '')
  const initialSecondGame = normalizeGameId(userGamerProfile.secondGame || initialGames.find(game => game !== initialMainGame) || '', '')
  // Antes "rango" era un solo texto libre para todo el perfil -- ahora es un
  // mapa por juego (cada juego tiene su propio ladder). Si el usuario ya
  // tenia el campo viejo guardado, se migra a su juego principal.
  const initialRanks = userGamerProfile.ranks && typeof userGamerProfile.ranks === 'object'
    ? userGamerProfile.ranks
    : (userGamerProfile.rank ? { [initialMainGame]: userGamerProfile.rank } : {})
  // Mismo caso: "personajes principales" era un solo texto libre con todo
  // mezclado -- ahora es un mapa por juego. El array viejo se migra entero
  // al juego principal (no sabiamos de cual juego era cada personaje).
  const initialCharactersByGame = userGamerProfile.charactersByGame && typeof userGamerProfile.charactersByGame === 'object'
    ? userGamerProfile.charactersByGame
    : (Array.isArray(userGamerProfile.mainCharacters) && userGamerProfile.mainCharacters.length
      ? { [initialMainGame]: userGamerProfile.mainCharacters }
      : {})

  const [tab, setTab] = useState('identidad')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [gameToAdd, setGameToAdd] = useState('')
  const [countrySearch, setCountrySearch] = useState('')
  const [genderSearch, setGenderSearch] = useState('')
  const [countryOpen, setCountryOpen] = useState(false)
  const [genderOpen, setGenderOpen] = useState(false)
  const [cityOtherMode, setCityOtherMode] = useState(() => {
    const list = citiesFor(initialCountry)
    const savedCity = user?.social?.city || ''
    return Boolean(savedCity) && Boolean(list) && !list.includes(savedCity)
  })
  const [avatarFile, setAvatarFile] = useState(null)
  const [bannerBgFile, setBannerBgFile] = useState(null)
  const [cardBgFile, setCardBgFile] = useState(null)
  const [selectedFrame, setSelectedFrame] = useState(resolveFrameId(user?.activeFrame))
  const [selectedBannerBg, setSelectedBannerBg] = useState(user?.activeBg || 'banner-basic-1')
  const [selectedCardDesign, setSelectedCardDesign] = useState(resolveCardModel(user?.activeCardDesign))
  const [selectedCardBg, setSelectedCardBg] = useState(user?.activeCardBg || 'tech-orange')
  const [selectedStatus, setSelectedStatus] = useState(resolveStatusId(user?.activeStatus))
  // 0 = sin placa. Los ids viejos (101 por defecto del backend) pasan a la
  // placa de bienvenida -- ver resolvePlateId.
  const [selectedBadge, setSelectedBadge] = useState(resolvePlateId(user?.activeBadge))
  const [customBannerBgUrl, setCustomBannerBgUrl] = useState(resolveUploadUrl(user?.activeCustomBg) || '')
  const [customCardBgUrl, setCustomCardBgUrl] = useState(resolveUploadUrl(user?.activeCardCustomBg) || '')

  const [form, setForm] = useState({
    firstName: user?.firstName || '',
    lastName: user?.lastName || '',
    nick: user?.nick || '',
    bio: user?.bio || buildMiniBio({
      nick: user?.nick || '',
      birthDate: dateInputValue(user?.birthDate),
      gender: user?.gender || 'prefer_not_to_say',
      country: initialCountry,
      languages: Array.isArray(user?.languages) && user.languages.length ? user.languages : ['es'],
      game: initialMainGame,
      secondGame: initialSecondGame,
      games: [...new Set([initialMainGame, initialSecondGame, ...initialGames].filter(Boolean))],
      experienceLevel: user?.experienceLevel || 'rookie',
      mainPlatform: user?.mainPlatform || 'mobile',
      lookingFor: Array.isArray(user?.lookingFor) ? user.lookingFor : [],
      mainRole: userGamerProfile.mainRole || '',
      ranks: initialRanks,
    }, lang),
    country: initialCountry,
    birthDate: dateInputValue(user?.birthDate),
    gender: user?.gender || 'prefer_not_to_say',
    languages: Array.isArray(user?.languages) && user.languages.length ? user.languages : ['es'],
    experienceLevel: user?.experienceLevel || 'rookie',
    mainPlatform: user?.mainPlatform || 'mobile',
    lookingFor: Array.isArray(user?.lookingFor) ? user.lookingFor : [],
    game: initialMainGame,
    secondGame: initialSecondGame,
    games: [...new Set([initialMainGame, initialSecondGame, ...initialGames].filter(Boolean))],
    // Sin avatar se queda vacío (el componente Avatar pone el default). Antes
    // caía en la foto de ejemplo de data/profile.js y al guardar quedaba
    // grabada como avatar real del usuario.
    avatar: resolveUploadUrl(user?.avatar) || '',
    website: user?.website || '',
    contactEmail: user?.social?.contactEmail || user?.email || '',
    phoneCountryDial: user?.phoneCountryDial || dialCodeFor(initialCountry) || '+1',
    phoneNumber: user?.phoneNumber || '',
    city: user?.social?.city || '',
    ...Object.fromEntries(SOCIAL_PLATFORMS.map(p => [p.id, user?.social?.[p.id] || ''])),
    ranks: initialRanks,
    mainRole: userGamerProfile.mainRole || '',
    charactersByGame: initialCharactersByGame,
    sensitivity: userGamerProfile.sensitivity || '',
    dpi: userGamerProfile.dpi || '',
    publicProfile: user?.privacy?.publicProfile ?? true,
    showStats: user?.privacy?.showStats ?? true,
    showGames: user?.privacy?.showGames ?? true,
    allowFriends: user?.privacy?.allowFriends ?? true,
    personalVisibility: user?.privacy?.personalVisibility || 'public',
    statsVisibility: user?.privacy?.statsVisibility || 'public',
    gamesVisibility: user?.privacy?.gamesVisibility || 'public',
    tournamentsVisibility: user?.privacy?.tournamentsVisibility || 'public',
    teamsVisibility: user?.privacy?.teamsVisibility || 'public',
    socialVisibility: user?.privacy?.socialVisibility || 'public',
  })

  const selectedGames = useMemo(
    () => [...new Set((form.games || []).map(game => normalizeGameId(game, '')).filter(Boolean))],
    [form.games],
  )
  const availableGames = GAMES.filter(game => !selectedGames.includes(game.id))
  const selectedCountry = COUNTRIES.find(([value]) => value === form.country) || COUNTRIES[0]
  const selectedGender = GENDERS.find(([value]) => value === form.gender) || GENDERS[GENDERS.length - 1]
  const gameToAddMeta = availableGames.find(game => game.id === gameToAdd)
  const filteredCountries = COUNTRIES.filter(([value, label]) => {
    const query = countrySearch.trim().toLowerCase()
    if (!query) return true
    return value.toLowerCase().includes(query) || label.toLowerCase().includes(query)
  })
  const filteredGenders = GENDERS.filter(([value, , label]) => {
    const query = genderSearch.trim().toLowerCase()
    if (!query) return true
    return value.toLowerCase().includes(query) || label.toLowerCase().includes(query)
  })
  const mainGame = gameById(form.game)
  const secondGame = gameById(form.secondGame)
  const currentBannerBg = selectedBannerBg === 'custom'
    ? { id: 'custom', image: resolveUploadUrl(customBannerBgUrl), name: 'Personalizado' }
    : (PROFILE_BACKGROUNDS.find(bg => bg.id === selectedBannerBg) || PROFILE_BACKGROUNDS[0])
  const currentBannerPreviewStyle = bannerBackgroundStyle(currentBannerBg, customBannerBgUrl)
  const currentCardTheme = getCardTheme(selectedCardBg)
  const currentCardImageBg = PROFILE_BACKGROUNDS.find(bg => bg.id === selectedCardBg)
  const score = completionScore(form, user)
  const { stateOf, loading: unlocksLoading, now: unlockNow } = useCosmeticUnlocks(user, score)
  // Lo equipado que ya no esta desbloqueado (la Corona despues de sus 7
  // dias, Tormenta si se cae el plan...) vuelve al regalo de bienvenida.
  // Mientras cargan los resultados de torneo no se toca nada.
  const isOpen = (kind, item) => unlocksLoading || stateOf(kind, item).unlocked
  const frameLapsed = !isOpen('frame', FRAME_BY_ID[selectedFrame])
  const plateLapsed = Number(selectedBadge) !== 0 && !isOpen('plate', PLATE_BY_ID[selectedBadge])
  const statusLapsed = !isOpen('status', STATUS_BY_ID[selectedStatus])
  const effectiveFrame = frameLapsed ? WELCOME_FRAME : selectedFrame
  const effectiveBadge = plateLapsed ? WELCOME_PLATE : Number(selectedBadge)
  const effectiveStatus = statusLapsed ? DEFAULT_STATUS : selectedStatus
  const currentFrame = FRAME_BY_ID[effectiveFrame]
  const currentStatus = STATUS_BY_ID[isBirthdayToday(form.birthDate) ? 'bday' : effectiveStatus]
  const currentBadge = effectiveBadge === 0 ? null : PLATE_BY_ID[effectiveBadge]
  const cityOptions = citiesFor(form.country)
  const playerCardPreviewBackground = selectedCardBg === 'custom' && customCardBgUrl
    ? { image: resolveUploadUrl(customCardBgUrl), collection: 'Personalizado' }
    : currentCardImageBg
      ? {
          image: currentCardImageBg.image,
          poster: currentCardImageBg.poster,
          isVideo: currentCardImageBg.isVideo,
          collection: currentCardImageBg.collection || currentCardImageBg.name,
        }
      : {
          gradient: `linear-gradient(145deg, ${currentCardTheme.dark}, color-mix(in srgb, ${currentCardTheme.accent} 34%, ${currentCardTheme.dark}) 58%, ${currentCardTheme.dark})`,
          collection: currentCardTheme.name,
        }
  const playerCardPreview = {
    nick: form.nick || 'Jugador',
    avatar: resolveUploadUrl(form.avatar),
    role: user?.role || 'player',
    roles: ['Jugador', ...(user?.role && user.role !== 'player' ? [user.role] : [])],
    tags: ['Jugador', user?.plan || 'Free'],
    bio: form.bio,
    platform: PLATFORMS.find(([value]) => value === form.mainPlatform)?.[2] || form.mainPlatform || 'Mobile',
    region: form.country || 'RD',
    team: user?.team?.name || user?.team || '—',
    gamer: {
      rank: form.ranks?.[form.game] || Object.values(form.ranks || {})[0] || '',
      mainRole: form.mainRole,
      game: mainGame?.name || 'Sin definir',
      secondGame: secondGame?.name || 'Sin definir',
      sensitivity: form.sensitivity,
      dpi: form.dpi,
    },
    legalName: [user?.firstName, user?.lastName].filter(Boolean).join(' ') || '—',
    sex: selectedGender?.[2] || '—',
    birth: form.birthDate || '—',
    level: EXPERIENCE.find(([value]) => value === form.experienceLevel)?.[2] || '—',
    email: form.contactEmail ? `${form.contactEmail.slice(0, 2)}•••${form.contactEmail.includes('@') ? `@${form.contactEmail.split('@')[1]}` : ''}` : '—',
    code: user?.playerCode || '—',
    internalLabel: 'ID interno admin',
    internalId: user?.role === 'admin' ? user?.internalCode : '',
    specialIds: [],
    security: user?.twoFactorEnabled ? '2FA' : '—',
    joined: user?.createdAt ? new Date(user.createdAt).toLocaleDateString(isEn ? 'en-US' : 'es-DO', { month: 'long', year: 'numeric' }) : '—',
    uid: user?.id || user?._id,
  }

  const previewAvatar = resolveUploadUrl(form.avatar)
  const cardArtImage = playerCardPreviewBackground?.poster || playerCardPreviewBackground?.image || previewAvatar
  const collectionRows = [
    ...STATUSES.map(item => ['status', item, item.label]),
    ...FRAMES.filter(item => item.id !== 'none').map(item => ['frame', item, item.name]),
    ...PLATES.map(item => ['plate', item, item.name]),
    ...ACHIEVEMENT_CARDS.map(item => ['card', item, item.name]),
  ].map(([kind, item, name]) => ({ kind, item, name, state: stateOf(kind, item) }))
  const collection = {
    total: collectionRows.length,
    unlocked: collectionRows.filter(row => row.state.unlocked).length,
    temporary: collectionRows.filter(row => row.state.unlocked && row.state.expiresAt),
  }
  // Bloqueado: explica como se consigue en vez de no hacer nada.
  const pickCosmetic = (kind, item, label, apply) => {
    const state = stateOf(kind, item)
    if (state.unlocked) { apply(); return }
    toast(`${label}: ${sourceInfo(state.source).desc}`, 'info', { title: isEn ? 'Locked' : 'Bloqueado' })
  }

  const setValue = (key, value) => setForm(prev => ({ ...prev, [key]: value }))
  const setRank = (gameId, value) => setForm(prev => ({ ...prev, ranks: { ...prev.ranks, [gameId]: value } }))
  const toggleCharacter = (gameId, name) => setForm(prev => {
    const current = Array.isArray(prev.charactersByGame?.[gameId]) ? prev.charactersByGame[gameId] : []
    const next = current.includes(name) ? current.filter(item => item !== name) : [...current, name]
    return { ...prev, charactersByGame: { ...prev.charactersByGame, [gameId]: next } }
  })
  const setCharacterText = (gameId, text) => setForm(prev => ({
    ...prev,
    charactersByGame: { ...prev.charactersByGame, [gameId]: splitList(text) },
  }))

  const playClickRipple = (event) => {
    const target = event.currentTarget
    const rect = target.getBoundingClientRect()
    target.style.setProperty('--ripple-x', `${event.clientX - rect.left}px`)
    target.style.setProperty('--ripple-y', `${event.clientY - rect.top}px`)
    target.classList.remove('ep-rippling')
    window.requestAnimationFrame(() => {
      target.classList.add('ep-rippling')
      window.setTimeout(() => target.classList.remove('ep-rippling'), 620)
    })
  }

  const toggleListValue = (key, value) => {
    setForm(prev => {
      const current = Array.isArray(prev[key]) ? prev[key] : []
      return {
        ...prev,
        [key]: current.includes(value) ? current.filter(item => item !== value) : [...current, value],
      }
    })
  }

  const handleAvatarChange = (event) => {
    const file = event.target.files?.[0]
    if (!file) return
    setAvatarFile(file)
    setValue('avatar', URL.createObjectURL(file))
  }

  const handleBannerBgChange = (event) => {
    const file = event.target.files?.[0]
    if (!file) return
    setBannerBgFile(file)
    setSelectedBannerBg('custom')
    setCustomBannerBgUrl(URL.createObjectURL(file))
  }

  const handleCardBgChange = (event) => {
    const file = event.target.files?.[0]
    if (!file) return
    setCardBgFile(file)
    setSelectedCardBg('custom')
    setCustomCardBgUrl(URL.createObjectURL(file))
  }

  const addGame = () => {
    const id = normalizeGameId(gameToAdd, '')
    if (!id) return
    setForm(prev => ({ ...prev, games: [...new Set([...(prev.games || []), id])], game: prev.game || id }))
    setGameToAdd('')
  }

  const removeGame = (gameId) => {
    setForm(prev => {
      const nextGames = (prev.games || []).filter(game => game !== gameId)
      const fallback = nextGames[0] || ''
      return {
        ...prev,
        games: nextGames,
        game: prev.game === gameId ? fallback : prev.game,
        secondGame: prev.secondGame === gameId ? '' : prev.secondGame,
      }
    })
  }

  const saveProfile = async () => {
    if (saving) return

    const nick = form.nick.trim()
    if (nick.length < 3) {
      toast(isEn ? 'Username must be at least 3 characters' : 'El nombre de usuario debe tener al menos 3 caracteres', 'error')
      setTab('identidad')
      return
    }
    if (!form.birthDate) {
      toast(isEn ? 'Please add your birth date' : 'Falta tu fecha de nacimiento', 'error')
      setTab('identidad')
      return
    }
    if (!form.phoneNumber.trim()) {
      toast(isEn ? 'Please add a phone number' : 'Falta tu numero de telefono', 'error')
      setTab('social')
      return
    }

    setSaving(true)

    try {
      let avatarUrl = form.avatar
      let bannerBgId = selectedBannerBg
      let bannerBgUrl = selectedBannerBg === 'custom' ? customBannerBgUrl : ''
      let cardBgId = selectedCardBg
      let cardBgUrl = selectedCardBg === 'custom' ? customCardBgUrl : ''

      if (avatarFile) {
        const avatarData = new FormData()
        avatarData.append('avatar', avatarFile)
        const uploaded = await api('/profile/me/avatar', { method: 'PATCH', body: avatarData })
        avatarUrl = uploaded.avatar || avatarUrl
        setValue('avatar', avatarUrl)
        if (uploaded.user) updateUser(uploaded.user)
      }

      if (bannerBgFile) {
        const bgData = new FormData()
        bgData.append('background', bannerBgFile)
        const uploaded = await api('/profile/me/background', { method: 'PATCH', body: bgData })
        bannerBgId = uploaded.activeBg || 'custom'
        bannerBgUrl = uploaded.activeCustomBg || bannerBgUrl
        if (uploaded.user) updateUser(uploaded.user)
      }

      if (cardBgFile) {
        const bgData = new FormData()
        bgData.append('background', cardBgFile)
        const uploaded = await api('/profile/me/card-background', { method: 'PATCH', body: bgData })
        cardBgId = uploaded.activeCardBg || 'custom'
        cardBgUrl = uploaded.activeCardCustomBg || cardBgUrl
        if (uploaded.user) updateUser(uploaded.user)
      }

      const games = [...new Set([form.game, form.secondGame, ...selectedGames].filter(Boolean).map(game => normalizeGameId(game, '')).filter(Boolean))]
      const payload = {
        activeFrame: effectiveFrame,
        activeBg: bannerBgId,
        activeStatus: effectiveStatus,
        activeBadge: effectiveBadge,
        activeCustomBg: bannerBgId === 'custom' ? bannerBgUrl : '',
        activeCardDesign: selectedCardDesign,
        activeCardBg: cardBgId,
        activeCardCustomBg: cardBgId === 'custom' ? cardBgUrl : '',
        firstName: form.firstName.trim(),
        lastName: form.lastName.trim(),
        nick,
        avatar: avatarUrl,
        bio: form.bio,
        countryCode: form.country,
        birthDate: form.birthDate,
        gender: form.gender,
        languages: form.languages,
        phoneCountryDial: form.phoneCountryDial,
        phoneNumber: form.phoneNumber,
        experienceLevel: form.experienceLevel,
        mainPlatform: form.mainPlatform,
        lookingFor: form.lookingFor,
        website: form.website,
        social: {
          contactEmail: form.contactEmail,
          city: form.city,
          ...Object.fromEntries(SOCIAL_PLATFORMS.map(p => [p.id, form[p.id] || ''])),
        },
        games,
        gamerProfile: {
          ...userGamerProfile,
          mainGame: form.game,
          secondGame: form.secondGame,
          mainRole: form.mainRole,
          charactersByGame: form.charactersByGame || {},
          mainCharacters: [...new Set(Object.values(form.charactersByGame || {}).flat().filter(Boolean))],
          ranks: form.ranks || {},
          rank: form.ranks?.[form.game] || Object.values(form.ranks || {})[0] || '',
          sensitivity: form.sensitivity,
          dpi: form.dpi,
        },
        privacy: {
          publicProfile: form.publicProfile,
          showStats: form.showStats,
          showGames: form.showGames,
          allowFriends: form.allowFriends,
          personalVisibility: form.personalVisibility,
          statsVisibility: form.statsVisibility,
          gamesVisibility: form.gamesVisibility,
          tournamentsVisibility: form.tournamentsVisibility,
          teamsVisibility: form.teamsVisibility,
          socialVisibility: form.socialVisibility,
        },
      }

      // El servidor valida que marco/placa/estado esten desbloqueados (403 si no).
      const { user: savedUser } = await api('/profile/me', { method: 'PATCH', body: payload })
      const finalUser = savedUser || payload
      updateUser(finalUser)
      setValue('avatar', finalUser.avatar || avatarUrl)
      setSelectedBannerBg(finalUser.activeBg || bannerBgId)
      setCustomBannerBgUrl(finalUser.activeCustomBg || bannerBgUrl)
      setSelectedCardBg(finalUser.activeCardBg || cardBgId)
      setCustomCardBgUrl(finalUser.activeCardCustomBg || cardBgUrl)
      setAvatarFile(null)
      setBannerBgFile(null)
      setCardBgFile(null)
      setSaved(true)
      toast(isEn ? 'Profile updated successfully' : 'Perfil actualizado correctamente', 'success')
      setTimeout(() => {
        setSaved(false)
        navigate('/perfil')
      }, 750)
    } catch (err) {
      toast(err.message || (isEn ? 'Could not save profile' : 'No se pudo guardar el perfil'), 'error')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="gg-page ep-page">
      <header className="ep-hero">
        <button className="ep-back" type="button" onClick={() => navigate('/perfil')}>
          {Icon.chevronRight}
          <span>Volver al perfil</span>
        </button>
        <div className="ep-hero__main">
          <div className="ep-avatar-shell">
            <Avatar src={form.avatar} size={82} />
            <button type="button" className="ep-avatar-action" onClick={() => avatarRef.current?.click()} title="Cambiar foto">
              {Icon.camera}
            </button>
            <input ref={avatarRef} type="file" accept="image/jpeg,image/png,image/webp" hidden onChange={handleAvatarChange} />
          </div>
          <div>
            <p className="ep-kicker">Centro de perfil</p>
            <h1>Editar perfil</h1>
            <p className="ep-hero__copy">Organiza tu identidad, datos personales, juegos y presencia publica en un solo lugar.</p>
          </div>
        </div>
        <div className="ep-actions">
          <div className="ep-score">
            <span>{score}%</span>
            <small>Completo</small>
          </div>
          <button type="button" className="ep-save ep-ripple" onMouseDown={playClickRipple} onClick={saveProfile} disabled={saving}>
            {saving ? 'Guardando...' : saved ? 'Guardado' : 'Guardar cambios'}
          </button>
        </div>
      </header>

      <nav className="ep-tabs" aria-label="Secciones de editar perfil">
        {TABS.map(item => (
          <button key={item.id} type="button" className={`ep-tab ${tab === item.id ? 'active' : ''}`} onClick={() => setTab(item.id)}>
            <span>{item.icon}</span>
            {item.label}
          </button>
        ))}
      </nav>

      <main className="ep-workspace">
        <section className="ep-panel">
          <AnimatePresence mode="wait">
            <motion.div
              key={tab}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.16 }}
            >
              {tab === 'identidad' && (
                <div className="ep-section">
                  <div className="ep-section-head">
                    <span>{Icon.user}</span>
                    <div>
                      <h2>Identidad personal</h2>
                      <p>Datos base del usuario y la ficha publica.</p>
                    </div>
                  </div>

                  <div className="ep-form-grid">
                    <Field label="Nombre">
                      <input value={form.firstName} maxLength={60} onChange={event => setValue('firstName', event.target.value)} />
                    </Field>
                    <Field label="Apellido">
                      <input value={form.lastName} maxLength={80} onChange={event => setValue('lastName', event.target.value)} />
                    </Field>
                    <Field label="Nombre de usuario">
                      <input value={form.nick} maxLength={32} onChange={event => setValue('nick', event.target.value)} />
                    </Field>
                    <Field label="Pais">
                      <div className={`ep-select-picker ${countryOpen ? 'open' : ''}`}>
                        <button type="button" className="ep-select-trigger ep-ripple" onMouseDown={playClickRipple} onClick={() => {
                          setGenderOpen(false)
                          setCountryOpen(open => !open)
                        }}>
                          <span className="ep-flag-mark"><img src={flagUrl(selectedCountry?.[0])} alt="" /></span>
                          <div>
                            <b>{selectedCountry?.[1] || 'Seleccionar pais'}</b>
                            <small>{selectedCountry?.[0] || 'Pais'}</small>
                          </div>
                          <em>{Icon.chevronRight}</em>
                        </button>
                        {countryOpen && (
                          <div className="ep-select-menu">
                            <div className="ep-country-picker__search">
                              <span>{Icon.search}</span>
                              <input
                                value={countrySearch}
                                onChange={event => setCountrySearch(event.target.value)}
                                placeholder="Escribe DO, MX, RD, Colombia..."
                                autoFocus
                              />
                            </div>
                            <div className="ep-country-picker__list">
                              {filteredCountries.map(([value, label]) => (
                                <button
                                  key={value}
                                  type="button"
                                  className={`ep-country-option ep-ripple ${form.country === value ? 'selected' : ''}`}
                                  onMouseDown={playClickRipple}
                                  onClick={() => {
                                    setValue('country', value)
                                    setCountrySearch('')
                                    setCountryOpen(false)
                                  }}
                                >
                                  <span className="ep-flag-mark ep-flag-mark--option"><img src={flagUrl(value)} alt="" /></span>
                                  <b>{label}</b>
                                  <small>{value}</small>
                                </button>
                              ))}
                              {!filteredCountries.length && (
                                <div className="ep-country-picker__empty">Sin resultados</div>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    </Field>
                    <Field label="Cumpleanos">
                      <div className="ep-date-control">
                        <span>{Icon.calendar}</span>
                        <input type="date" value={form.birthDate} onChange={event => setValue('birthDate', event.target.value)} />
                      </div>
                    </Field>
                    <Field label="Sexo">
                      <div className={`ep-select-picker ${genderOpen ? 'open' : ''}`}>
                        <button type="button" className="ep-select-trigger ep-ripple" onMouseDown={playClickRipple} onClick={() => {
                          setCountryOpen(false)
                          setGenderOpen(open => !open)
                        }}>
                          <span>{selectedGender?.[1]}</span>
                          <div>
                            <b>{selectedGender?.[2] || 'Seleccionar sexo'}</b>
                            <small>Sexo</small>
                          </div>
                          <em>{Icon.chevronRight}</em>
                        </button>
                        {genderOpen && (
                          <div className="ep-select-menu">
                            <div className="ep-country-picker__search">
                              <span>{Icon.search}</span>
                              <input
                                value={genderSearch}
                                onChange={event => setGenderSearch(event.target.value)}
                                placeholder="Escribe fem, mas, no..."
                                autoFocus
                              />
                            </div>
                            <div className="ep-country-picker__list ep-country-picker__list--single">
                              {filteredGenders.map(([value, icon, label]) => (
                              <button
                                key={value}
                                type="button"
                                className={`ep-country-option ep-ripple ${form.gender === value ? 'selected' : ''}`}
                                onMouseDown={playClickRipple}
                                onClick={() => {
                                  setValue('gender', value)
                                  setGenderSearch('')
                                  setGenderOpen(false)
                                }}
                              >
                                <span>{icon}</span>
                                <b>{label}</b>
                                <small>{value}</small>
                              </button>
                            ))}
                              {!filteredGenders.length && (
                                <div className="ep-country-picker__empty">Sin resultados</div>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    </Field>
                    <Field label="Idiomas" hint="Selecciona todos los idiomas que usas para jugar." wide>
                      <div className="ep-language-grid">
                        {LANGUAGES.map(([value, flagCode, label]) => (
                          <button
                            key={value}
                            type="button"
                            className={`ep-option-card ep-ripple ep-option-card--language ${form.languages.includes(value) ? 'selected' : ''}`}
                            onMouseDown={playClickRipple}
                            onClick={() => toggleListValue('languages', value)}
                          >
                            <span className="ep-option-card__icon ep-flag-mark"><img src={flagUrl(flagCode)} alt="" /></span>
                            <b>{label}</b>
                            <small>{value.toUpperCase()}</small>
                          </button>
                        ))}
                      </div>
                    </Field>
                    <Field label="Mini biografia" hint={`${form.bio.length}/300 caracteres`} wide>
                      <div className="ep-bio-tools">
                        <button type="button" className="ep-ripple" onMouseDown={playClickRipple} onClick={() => setValue('bio', buildMiniBio(form, lang))}>
                          {Icon.bolt}
                          <span>Generar bio con mis datos</span>
                        </button>
                      </div>
                      <textarea rows={5} maxLength={300} value={form.bio} onChange={event => setValue('bio', event.target.value)} placeholder="Cuenta quien eres, que juegas y que buscas en GlitchGang." />
                    </Field>
                  </div>
                </div>
              )}

              {tab === 'gamer' && (
                <div className="ep-section">
                  <div className="ep-section-head">
                    <span>{Icon.gamepad}</span>
                    <div>
                      <h2>Perfil de jugador</h2>
                      <p>Juegos, nivel competitivo, plataforma y preferencias de busqueda.</p>
                    </div>
                  </div>

                  <div className="ep-form-grid">
                    <Field label="Juego principal">
                      <select value={form.game} onChange={event => {
                        const value = event.target.value
                        setForm(prev => ({ ...prev, game: value, games: value ? [...new Set([...(prev.games || []), value])] : prev.games }))
                      }}>
                        <option value="">Sin juego principal</option>
                        {GAMES.map(game => <option key={game.id} value={game.id}>{game.name}</option>)}
                      </select>
                    </Field>
                    <Field label="Juego secundario">
                      <select value={form.secondGame} onChange={event => {
                        const value = event.target.value
                        setForm(prev => ({ ...prev, secondGame: value, games: value ? [...new Set([...(prev.games || []), value])] : prev.games }))
                      }}>
                        <option value="">Sin juego secundario</option>
                        {GAMES.map(game => <option key={game.id} value={game.id}>{game.name}</option>)}
                      </select>
                    </Field>
                    <Field label="Nivel de experiencia">
                      <div className="ep-icon-select">
                        {EXPERIENCE.map(([value, icon, label]) => (
                          <button
                            key={value}
                            type="button"
                            className={`ep-option-card ep-ripple ep-option-card--compact ${form.experienceLevel === value ? 'selected' : ''}`}
                            onMouseDown={playClickRipple}
                            onClick={() => setValue('experienceLevel', value)}
                          >
                            <span className="ep-option-card__icon">{icon}</span>
                            <b>{label}</b>
                          </button>
                        ))}
                      </div>
                    </Field>
                    <Field label="Plataforma principal">
                      <div className="ep-icon-select">
                        {PLATFORMS.map(([value, icon, label]) => (
                          <button
                            key={value}
                            type="button"
                            className={`ep-option-card ep-ripple ep-option-card--compact ${form.mainPlatform === value ? 'selected' : ''}`}
                            onMouseDown={playClickRipple}
                            onClick={() => setValue('mainPlatform', value)}
                          >
                            <span className="ep-option-card__icon">{icon}</span>
                            <b>{label}</b>
                          </button>
                        ))}
                      </div>
                    </Field>
                    {selectedGames.some(isMobileLegends) && (
                      <Field label="Cuenta de Mobile Legends" hint="Tu ID y servidor se verifican con un código que llega al correo dentro del juego." wide>
                        <GameIdVerify />
                      </Field>
                    )}
                    <Field label="Rango actual" hint={selectedGames.length ? 'Uno por cada juego que agregaste' : 'Agrega un juego para poder cargar tu rango'} wide>
                      {selectedGames.length ? (
                        <div className="ep-ranks-grid">
                          {selectedGames.map(gameId => {
                            const tiers = ranksFor(gameId)
                            const gameName = GAMES.find(g => g.id === gameId)?.name || gameId
                            return (
                              <div key={gameId} className="ep-ranks-grid__row">
                                <span className="ep-ranks-grid__game" data-no-translate>{gameName}</span>
                                {tiers.length ? (
                                  <select value={form.ranks?.[gameId] || ''} onChange={event => setRank(gameId, event.target.value)} data-no-translate>
                                    <option value="">Sin rango</option>
                                    {tiers.map(tier => <option key={tier} value={tier}>{tier}</option>)}
                                  </select>
                                ) : (
                                  <input
                                    value={form.ranks?.[gameId] || ''}
                                    onChange={event => setRank(gameId, event.target.value)}
                                    placeholder="Ej. Mythic, Diamond..."
                                  />
                                )}
                              </div>
                            )
                          })}
                        </div>
                      ) : (
                        <p className="ep-empty">Todavia no tienes juegos agregados.</p>
                      )}
                    </Field>
                    <Field label="Rol dentro del juego">
                      <select value={form.mainRole} onChange={event => setValue('mainRole', event.target.value)}>
                        <option value="">Seleccionar rol</option>
                        {PLAYER_ROLES.map(role => <option key={role} value={role}>{role}</option>)}
                      </select>
                    </Field>
                    <Field label="Personajes / agentes principales" hint={selectedGames.length ? 'Uno o mas por cada juego que agregaste' : 'Agrega un juego para poder elegir personajes'} wide>
                      {selectedGames.length ? (
                        <div className="ep-chars-grid">
                          {selectedGames.map(gameId => {
                            const roster = charactersFor(gameId)
                            const gameName = GAMES.find(g => g.id === gameId)?.name || gameId
                            const picked = Array.isArray(form.charactersByGame?.[gameId]) ? form.charactersByGame[gameId] : []
                            return (
                              <div key={gameId} className="ep-chars-grid__group">
                                <span className="ep-chars-grid__game" data-no-translate>{gameName}</span>
                                {roster.length ? (
                                  <div className="ep-char-chips" data-no-translate>
                                    {roster.map(name => (
                                      <button
                                        key={name}
                                        type="button"
                                        className={`ep-char-chip ep-ripple ${picked.includes(name) ? 'selected' : ''}`}
                                        onMouseDown={playClickRipple}
                                        onClick={() => toggleCharacter(gameId, name)}
                                      >
                                        {name}
                                      </button>
                                    ))}
                                  </div>
                                ) : (
                                  <input
                                    value={joinList(picked)}
                                    onChange={event => setCharacterText(gameId, event.target.value)}
                                    placeholder="Ej. Jett, Raze, Killjoy"
                                  />
                                )}
                              </div>
                            )
                          })}
                        </div>
                      ) : (
                        <p className="ep-empty">Todavia no tienes juegos agregados.</p>
                      )}
                    </Field>
                    <Field label="Sensibilidad">
                      <input
                        value={form.sensitivity}
                        onChange={event => {
                          const raw = event.target.value.replace(/[^0-9.]/g, '')
                          const cleaned = raw.replace(/(\..*)\./g, '$1').slice(0, 10)
                          setValue('sensitivity', cleaned)
                        }}
                        inputMode="decimal"
                        placeholder="Ej. 0.45"
                      />
                    </Field>
                    <Field label="DPI">
                      <input
                        value={form.dpi}
                        onChange={event => setValue('dpi', event.target.value.replace(/\D/g, '').slice(0, 6))}
                        inputMode="numeric"
                        placeholder="Ej. 800"
                      />
                    </Field>
                    <Field label="Busco en GlitchGang" wide>
                      <div className="ep-profile-goals">
                        {LOOKING_FOR.map(([value, icon, label]) => (
                          <button
                            key={value}
                            type="button"
                            className={`ep-option-card ep-ripple ep-option-card--goal ${form.lookingFor.includes(value) ? 'selected' : ''}`}
                            onMouseDown={playClickRipple}
                            onClick={() => toggleListValue('lookingFor', value)}
                          >
                            <span className="ep-option-card__icon">{icon}</span>
                            <b>{label}</b>
                            <small>Multi-select</small>
                          </button>
                        ))}
                      </div>
                    </Field>
                  </div>

                  <div className="ep-subpanel">
                    <div className="ep-subpanel__head">
                      <div>
                        <h3>Mis juegos</h3>
                        <p>Se guardan en tu perfil y aparecen como juegos/comunidades visuales con su icono.</p>
                      </div>
                      <div className="ep-add-game">
                        <div className="ep-add-game__select">
                          <span>
                            {gameToAddMeta?.images?.logo ? <img src={gameToAddMeta.images.logo} alt="" /> : Icon.gamepad}
                          </span>
                          <select value={gameToAdd} onChange={event => setGameToAdd(event.target.value)}>
                            <option value="">Seleccionar juego</option>
                            {availableGames.map(game => <option key={game.id} value={game.id}>{game.name}</option>)}
                          </select>
                        </div>
                        <button type="button" className="ep-ripple" onMouseDown={playClickRipple} onClick={addGame} disabled={!gameToAdd}>{Icon.plus}</button>
                      </div>
                    </div>
                    {selectedGames.length ? (
                      <div className="ep-games-list">
                        {selectedGames.map(gameId => {
                          const game = gameById(gameId)
                          const label = form.game === gameId ? 'Principal' : form.secondGame === gameId ? 'Secundario' : game?.category || 'Juego'
                          return (
                            <article key={gameId} className="ep-game-item">
                              <span className="ep-game-item__logo">
                                {game?.images?.logo ? <img src={game.images.logo} alt="" /> : Icon.gamepad}
                              </span>
                              <div>
                                <b>{game?.name || gameId}</b>
                                <small>{game?.category || 'Juego competitivo'}</small>
                              </div>
                              <em>{label}</em>
                              <button type="button" className="ep-ripple" onMouseDown={playClickRipple} onClick={() => removeGame(gameId)} aria-label={`Eliminar ${game?.name || gameId}`}>{Icon.trash}</button>
                            </article>
                          )
                        })}
                      </div>
                    ) : (
                      <p className="ep-empty">Todavia no tienes juegos agregados.</p>
                    )}
                  </div>
                </div>
              )}

              {tab === 'social' && (
                <div className="ep-section">
                  <div className="ep-section-head">
                    <span>{Icon.globe}</span>
                    <div>
                      <h2>Redes y contacto publico</h2>
                      <p>Enlaces visibles para jugadores, equipos y comunidades.</p>
                    </div>
                  </div>
                  <div className="ep-form-grid">
                    <div className="ep-contact-grid">
                      {[
                        ['contactEmail', 'Correo publico', user?.email || 'correo@glitchgang.gg', Icon.mail],
                      ].map(([key, label, placeholder, icon]) => (
                        <Field key={key} label={label}>
                          <div className="ep-input-icon ep-input-icon--contact">
                            <span>{icon}</span>
                            <input
                              value={form[key] || ''}
                              onChange={event => setValue(key, event.target.value)}
                              placeholder={placeholder}
                            />
                          </div>
                        </Field>
                      ))}
                      <Field label="Ciudad / zona" hint={cityOptions ? 'Segun el pais de tu perfil' : undefined}>
                        {cityOptions && !cityOtherMode ? (
                          <div className="ep-input-icon ep-input-icon--contact">
                            <span>{Icon.mapPin}</span>
                            <select
                              value={cityOptions.includes(form.city) ? form.city : ''}
                              onChange={event => {
                                if (event.target.value === '__other__') { setCityOtherMode(true); setValue('city', ''); return }
                                setValue('city', event.target.value)
                              }}
                            >
                              <option value="" disabled>Selecciona tu ciudad</option>
                              {cityOptions.map(c => <option key={c} value={c}>{c}</option>)}
                              <option value="__other__">Otra ciudad...</option>
                            </select>
                          </div>
                        ) : (
                          <div className="ep-input-icon ep-input-icon--contact">
                            <span>{Icon.mapPin}</span>
                            <input
                              value={form.city || ''}
                              onChange={event => setValue('city', event.target.value)}
                              placeholder="Santo Domingo"
                            />
                          </div>
                        )}
                        {cityOptions && cityOtherMode && (
                          <button type="button" className="ep-city-back" onClick={() => setCityOtherMode(false)}>
                            {Icon.chevronRight} Elegir de la lista
                          </button>
                        )}
                      </Field>
                      <Field label="Telefono" hint="Elige el codigo o pega tu numero completo (ej. +18092183837) y se detecta solo">
                        <div className="ep-input-icon ep-input-icon--contact ep-input-icon--phone">
                          <span>{Icon.phone}</span>
                          <select
                            className="ep-dial-badge ep-dial-select"
                            value={form.phoneCountryDial || '+1'}
                            onChange={event => setValue('phoneCountryDial', event.target.value)}
                          >
                            {UNIQUE_DIAL_CODES.map(code => <option key={code} value={code}>{code}</option>)}
                          </select>
                          <input
                            value={form.phoneNumber || ''}
                            onChange={event => {
                              const raw = event.target.value
                              const split = splitDialCode(raw)
                              if (split) {
                                setValue('phoneCountryDial', split.dialCode)
                                setValue('phoneNumber', split.number.slice(0, 15))
                                return
                              }
                              // Codigo internacional a medio escribir (ej. "+5" antes de
                              // completar "+52"): se deja tal cual en vez de comerse el
                              // "+" -- si se stripeara ya, splitDialCode nunca podria
                              // completar el match con las siguientes teclas.
                              if (raw.startsWith('+') || raw.startsWith('00')) {
                                setValue('phoneNumber', raw.slice(0, 20))
                                return
                              }
                              setValue('phoneNumber', raw.replace(/\D/g, '').slice(0, 15))
                            }}
                            placeholder="8090000000"
                            inputMode="tel"
                            maxLength={20}
                          />
                        </div>
                      </Field>
                      <Field label="Sitio web">
                        <div className="ep-input-icon ep-input-icon--contact">
                          <span>{Icon.globe}</span>
                          <input value={form.website} onChange={event => setValue('website', event.target.value)} placeholder="https://..." />
                        </div>
                      </Field>
                    </div>
                    <div className="ep-subpanel ep-subpanel--social">
                      <div className="ep-subpanel__head">
                        <div>
                          <h3>Redes sociales</h3>
                          <p>Canales publicos para comunidad, equipos, marcas y torneos.</p>
                        </div>
                      </div>
                      <div className="ep-social-grid">
                    {SOCIAL_PLATFORMS.filter(({ id }) => id !== 'whatsapp').map(({ id, label, icon, placeholder }) => (
                      <Field key={id} label={label}>
                        <div className="ep-input-icon ep-input-icon--social">
                          <span>{Icon[icon] || Icon.globe}</span>
                          <input value={form[id] || ''} onChange={event => setValue(id, event.target.value)} placeholder={placeholder} />
                        </div>
                      </Field>
                    ))}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {tab === 'visual' && (
                <div className="ep-section">
                  <CosmeticDefs />
                  <div className="ep-section-head">
                    <span>{Icon.palette}</span>
                    <div>
                      <h2>Estilo visual</h2>
                      <p>Estado, marco, placa, combos y el diseño de tu tarjeta ID.</p>
                    </div>
                  </div>

                  <div className="ep-visual-upload">
                    <button type="button" onClick={() => avatarRef.current?.click()}>
                      {Icon.camera}
                      <span>Cambiar avatar</span>
                    </button>
                    <button type="button" onClick={() => bannerBgRef.current?.click()}>
                      {Icon.upload}
                      <span>Subir banner</span>
                    </button>
                    <button type="button" onClick={() => cardBgRef.current?.click()}>
                      {Icon.upload}
                      <span>Subir fondo de tarjeta</span>
                    </button>
                    <input ref={bannerBgRef} type="file" accept="image/jpeg,image/png,image/webp" hidden onChange={handleBannerBgChange} />
                    <input ref={cardBgRef} type="file" accept="image/jpeg,image/png,image/webp" hidden onChange={handleCardBgChange} />
                  </div>

                  <div className="ep-subpanel ep-collection">
                    <div className="ep-subpanel__head">
                      <div>
                        <h3>Tu colección</h3>
                        <p>Estados, marcos, placas y cartas de logro. Algunos son tuyos para siempre y otros son regalos por un tiempo.</p>
                      </div>
                      <div className="ep-collection__count" aria-label={`${collection.unlocked} de ${collection.total} desbloqueados`}>
                        <b>{collection.unlocked}</b><span>/ {collection.total}</span>
                        <i style={{ '--p': `${Math.round((collection.unlocked / collection.total) * 100)}%` }} />
                      </div>
                    </div>
                    {collection.temporary.length > 0 && (
                      <div className="ep-collection__gifts">
                        {collection.temporary.map(row => (
                          <span key={`${row.kind}-${row.item.id}`} className="ep-cos-tag ep-cos-tag--temp">
                            {Icon.clock}{row.name} · {formatRemaining(row.state.expiresAt, unlockNow)}
                          </span>
                        ))}
                      </div>
                    )}
                    <details className="ep-purposes">
                      <summary>{Icon.gem}<span>Cómo se consigue cada uno</span>{Icon.chevronRight}</summary>
                      <div className="ep-purposes__grid">
                        {PURPOSE_GROUPS.map(group => (
                          <div key={group.key} className="ep-purpose">
                            <b>{group.info.label}</b>
                            <small>{group.info.desc}</small>
                            <span>{group.items.join(' · ')}</span>
                          </div>
                        ))}
                      </div>
                    </details>
                  </div>

                  <div className="ep-subpanel">
                    <div className="ep-subpanel__head">
                      <div>
                        <h3>Estado</h3>
                        <p>Así te ven en el perfil, el chat y las listas de escuadra.</p>
                      </div>
                    </div>
                    <div className="ep-status-stage">
                      <StatusAvatar statusId={currentStatus?.id} avatar={previewAvatar} large />
                      <div>
                        <b data-no-translate>{form.nick || 'Jugador'}</b>
                        <span className="ep-status-stage__pill" style={{ '--pc': currentStatus?.color }}><i />{currentStatus?.label}</span>
                        {currentStatus?.id === 'bday' && <small>Hoy es tu cumpleaños: el estado se puso solo. Mañana vuelve el que elegiste.</small>}
                        {statusLapsed && <small>Tu estado {STATUS_BY_ID[selectedStatus]?.label} ya no está activo. Se usa En línea.</small>}
                      </div>
                    </div>
                    <div className="ep-cos-sub">Estados base</div>
                    <div className="ep-cos-grid ep-cos-grid--status">
                      {STATUSES.filter(status => !status.exclusive).map(status => (
                        <CosmeticTile key={status.id} name={status.label} detail={status.desc} state={stateOf('status', status)} now={unlockNow} selected={effectiveStatus === status.id} onPick={() => pickCosmetic('status', status, status.label, () => setSelectedStatus(status.id))} row>
                          <StatusAvatar statusId={status.id} avatar={previewAvatar} />
                        </CosmeticTile>
                      ))}
                    </div>
                    <div className="ep-cos-sub">Estados exclusivos</div>
                    <div className="ep-cos-grid ep-cos-grid--status">
                      {STATUSES.filter(status => status.exclusive).map(status => (
                        <CosmeticTile key={status.id} name={status.label} detail={status.desc} state={stateOf('status', status)} now={unlockNow} selected={effectiveStatus === status.id} auto={status.auto} onPick={() => (status.auto
                          ? toast('Se activa solo el día de tu cumpleaños. No hace falta elegirlo.', 'info')
                          : pickCosmetic('status', status, status.label, () => setSelectedStatus(status.id)))} row>
                          <StatusAvatar statusId={status.id} avatar={previewAvatar} />
                        </CosmeticTile>
                      ))}
                    </div>
                  </div>

                  <div className="ep-subpanel">
                    <div className="ep-subpanel__head">
                      <div>
                        <h3>Marcos</h3>
                        <p>Decoraciones animadas alrededor de tu avatar.</p>
                      </div>
                    </div>
                    {frameLapsed && <p className="ep-cos-note">{Icon.clock}Tu marco {FRAME_BY_ID[selectedFrame]?.name} se venció. Mientras tanto usas {FRAME_BY_ID[WELCOME_FRAME].name}.</p>}
                    <TwoRowGrid className="ep-cos-grid ep-cos-grid--frame">
                      {FRAMES.map(frame => (
                        <CosmeticTile key={frame.id} name={frame.name} detail={frame.cat || frame.desc} state={stateOf('frame', frame)} now={unlockNow} selected={effectiveFrame === frame.id} onPick={() => pickCosmetic('frame', frame, frame.name, () => setSelectedFrame(frame.id))}>
                          <CosmeticFrame id={frame.id} avatar={previewAvatar} size={62} />
                        </CosmeticTile>
                      ))}
                    </TwoRowGrid>
                  </div>

                  <div className="ep-subpanel">
                    <div className="ep-subpanel__head">
                      <div>
                        <h3>Placa</h3>
                        <p>Va debajo de tu nick en la tarjeta ID. Puedes quitarla.</p>
                      </div>
                    </div>
                    {plateLapsed && <p className="ep-cos-note">{Icon.clock}Tu placa {PLATE_BY_ID[selectedBadge]?.name} se venció. Mientras tanto usas {PLATE_BY_ID[WELCOME_PLATE].name}.</p>}
                    <TwoRowGrid className="ep-cos-grid ep-cos-grid--plate">
                      <CosmeticTile name="Sin placa" detail="Ocultar la placa" state={{ unlocked: true, source: 'base' }} now={unlockNow} selected={effectiveBadge === 0} onPick={() => setSelectedBadge(0)}>
                        <span className="ep-cos-empty-plate" data-no-translate>{form.nick || 'Jugador'}</span>
                      </CosmeticTile>
                      {PLATES.map(plate => (
                        <CosmeticTile key={plate.id} name={plate.name} detail={plate.cat} state={stateOf('plate', plate)} now={unlockNow} selected={effectiveBadge === plate.id} onPick={() => pickCosmetic('plate', plate, plate.name, () => setSelectedBadge(plate.id))}>
                          <CosmeticPlate id={plate.id} nick={form.nick || 'Jugador'} width={266} />
                        </CosmeticTile>
                      ))}
                    </TwoRowGrid>
                  </div>

                  <div className="ep-subpanel">
                    <div className="ep-subpanel__head">
                      <div>
                        <h3>Combos</h3>
                        <p>Carta + marco + placa pensados para verse juntos. Equipa el marco y la placa de un toque.</p>
                      </div>
                    </div>
                    <div className="ep-combos">
                      {COMBOS.map(combo => {
                        const card = CARD_BY_ID[combo.card]
                        const frame = FRAME_BY_ID[combo.frame]
                        const plate = PLATE_BY_ID[combo.plate]
                        const pieces = [
                          ['Carta', card.name, stateOf('card', card)],
                          ['Marco', frame.name, stateOf('frame', frame)],
                          ['Placa', plate.name, stateOf('plate', plate)],
                        ]
                        const ready = pieces[1][2].unlocked && pieces[2][2].unlocked
                        const equipped = effectiveFrame === frame.id && effectiveBadge === plate.id
                        return (
                          <article key={combo.id} className={`ep-combo ${ready ? '' : 'locked'}`}>
                            <AchievementCard id={card.id} nick={form.nick || 'Jugador'} image={cardArtImage} width={128} className="ep-combo__card" />
                            <div className="ep-combo__body">
                              <span className="ep-combo__rar">Combo · {combo.rarity}</span>
                              <h4>{combo.name}</h4>
                              <p>{combo.desc}</p>
                              <div className="ep-combo__pieces">
                                <CosmeticFrame id={frame.id} avatar={previewAvatar} size={54} />
                                <CosmeticPlate id={plate.id} nick={form.nick || 'Jugador'} width={230} />
                              </div>
                              <div className="ep-combo__chips">
                                {pieces.map(([kind, name, state]) => (
                                  <span key={kind} className={`ep-cos-tag ${state.unlocked ? '' : 'ep-cos-tag--lock'}`} title={state.unlocked ? undefined : sourceInfo(state.source).desc}>
                                    {state.unlocked ? Icon.check : Icon.lock}{kind} · {name}
                                  </span>
                                ))}
                              </div>
                              <button
                                type="button"
                                className="ep-combo__equip"
                                disabled={!ready || equipped}
                                onClick={() => { setSelectedFrame(frame.id); setSelectedBadge(plate.id) }}
                              >
                                {equipped ? 'Equipado' : ready ? 'Equipar marco y placa' : `Se desbloquea con: ${[...new Set([pieces[1], pieces[2]].filter(p => !p[2].unlocked).map(p => sourceInfo(p[2].source).short))].join(' + ')}`}
                              </button>
                            </div>
                          </article>
                        )
                      })}
                    </div>
                  </div>

                  <div className="ep-subpanel">
                    <div className="ep-subpanel__head">
                      <div>
                        <h3>Banner del perfil</h3>
                        <p>Este fondo es para el perfil completo, no para la tarjeta ID.</p>
                      </div>
                    </div>
                    <div className="ep-banner-preview" style={currentBannerBg?.isVideo ? undefined : currentBannerPreviewStyle}>
                      {currentBannerBg?.isVideo && (
                        <video src={currentBannerBg.image} poster={currentBannerBg.poster} autoPlay loop muted playsInline />
                      )}
                      <span>{currentBannerBg?.name || 'Banner'}</span>
                    </div>
                    <TwoRowGrid className="ep-bg-list">
                      {PROFILE_BACKGROUNDS.filter(bg => !bg.isCustom).map(bg => (
                        <button key={bg.id} type="button" className={`ep-bg-choice ${selectedBannerBg === bg.id ? 'selected' : ''} ${!bg.unlocked ? 'locked' : ''}`} onClick={() => bg.unlocked && setSelectedBannerBg(bg.id)}>
                          <span style={bannerBackgroundStyle(bg, customBannerBgUrl)} />
                          <b>{bg.name}</b>
                          <small>{bg.unlocked ? 'Banner' : bg.unlock}</small>
                        </button>
                      ))}
                    </TwoRowGrid>
                  </div>

                  <div className="ep-subpanel">
                    <div className="ep-subpanel__head">
                      <div>
                        <h3>Diseños de tarjeta</h3>
                        <p>Esto solo cambia el orden interno y la animacion de la tarjeta.</p>
                      </div>
                    </div>
                    <TwoRowGrid className="ep-card-design-list">
                      {CARD_LAYOUTS.map(layout => (
                        <button
                          key={layout.id}
                          type="button"
                          className={`ep-card-design-choice ${selectedCardDesign === layout.id ? 'selected' : ''}`}
                          onClick={() => setSelectedCardDesign(layout.id)}
                          title={layout.mood}
                        >
                          <span className="ep-card-design-choice__card" aria-hidden="true">
                            <PlayerCard
                              model={layout.id}
                              frame={currentFrame}
                              badge={currentBadge}
                              status={currentStatus}
                              background={playerCardPreviewBackground}
                              player={playerCardPreview}
                              width={68}
                              tilt={false}
                              flippable={false}
                            />
                          </span>
                          <b>{layout.label}</b>
                          <small>{layout.mood}</small>
                        </button>
                      ))}
                    </TwoRowGrid>
                  </div>

                  <div className="ep-subpanel">
                    <div className="ep-subpanel__head">
                      <div>
                        <h3>Fondo de tarjeta</h3>
                        <p>Este fondo solo afecta la tarjeta ID, separado del banner.</p>
                      </div>
                    </div>
                    <TwoRowGrid className="ep-bg-list">
                      {CARD_BACKGROUND_CHOICES.map(bg => (
                        <button
                          key={`${bg.kind}-${bg.id}`}
                          type="button"
                          className={`ep-bg-choice ep-card-theme-choice ${selectedCardBg === bg.id ? 'selected' : ''} ${!bg.unlocked ? 'locked' : ''}`}
                          onClick={() => bg.unlocked && setSelectedCardBg(bg.id)}
                        >
                          <span
                            className={bg.kind === 'theme' ? bg.className : undefined}
                            style={bg.kind === 'theme' ? cardThemeVars(bg) : bannerBackgroundStyle(bg, customCardBgUrl)}
                          />
                          <b>{bg.name}</b>
                          <small>{bg.kind === 'theme' ? bg.tone : (bg.unlocked ? bg.collection || 'Fondo' : bg.unlock)}</small>
                        </button>
                      ))}
                    </TwoRowGrid>
                  </div>


                  <div className="ep-subpanel">
                    <div className="ep-subpanel__head">
                      <div>
                        <h3>Cartas de logro</h3>
                        <p>Se ganan cumpliendo el logro y son permanentes. La ventana usa tu fondo de tarjeta (o tu avatar).</p>
                      </div>
                    </div>
                    <TwoRowGrid className="ep-cos-grid ep-cos-grid--card">
                      {ACHIEVEMENT_CARDS.map(card => {
                        const state = stateOf('card', card)
                        return (
                          <div key={card.id} className={`ep-cos ep-cos--card ${state.unlocked ? '' : 'locked'}`} title={state.unlocked ? card.goal : `${card.name} — ${card.goal}`}>
                            <span className="ep-cos__art" aria-hidden="true">
                              <AchievementCard id={card.id} nick={form.nick || 'Jugador'} image={cardArtImage} width={136} />
                            </span>
                            <span className="ep-cos__meta">
                              <b>{card.name}</b>
                              <small>{card.goal}</small>
                              <UnlockTag state={state} now={unlockNow} />
                            </span>
                            {!state.unlocked && <span className="ep-cos__lock">{Icon.lock}</span>}
                          </div>
                        )
                      })}
                    </TwoRowGrid>
                  </div>
                </div>
              )}

              {tab === 'privacidad' && (
                <div className="ep-section">
                  <div className="ep-section-head">
                    <span>{Icon.shield}</span>
                    <div>
                      <h2>Privacidad</h2>
                      <p>Controla que datos aparecen para otros usuarios.</p>
                    </div>
                  </div>
                  <div className="ep-privacy-list">
                    {[
                      ['publicProfile', 'Perfil publico', 'Permite que otros usuarios vean tu perfil.'],
                      ['showStats', 'Mostrar estadisticas', 'Muestra datos competitivos y actividad.'],
                      ['showGames', 'Mostrar juegos', 'Muestra la lista de videojuegos en tu perfil.'],
                      ['allowFriends', 'Solicitudes de amistad', 'Permite que otros jugadores te agreguen.'],
                    ].map(([key, label, desc]) => (
                      <div key={key} className="ep-privacy-row">
                        <div>
                          <b>{label}</b>
                          <small>{desc}</small>
                        </div>
                        <label className="ep-toggle">
                          <input type="checkbox" checked={Boolean(form[key])} onChange={event => setValue(key, event.target.checked)} />
                          <span />
                        </label>
                      </div>
                    ))}
                  </div>
                  <div className="ep-visibility-panel">
                    <div className="ep-subpanel__head">
                      <div>
                        <h3>Visibilidad por datos</h3>
                        <p>Define quien puede ver cada parte del perfil publico.</p>
                      </div>
                    </div>
                    <div className="ep-visibility-grid">
                      {PRIVACY_FIELDS.map(([key, label, desc]) => (
                        <div key={key} className="ep-visibility-card">
                          <div>
                            <b>{label}</b>
                            <small>{desc}</small>
                          </div>
                          <div className="ep-visibility-options" role="group" aria-label={label}>
                            {VISIBILITY_OPTIONS.map(([value, optionLabel]) => (
                              <button
                                key={value}
                                type="button"
                                className={form[key] === value ? 'selected' : ''}
                                onClick={() => setValue(key, value)}
                              >
                                {optionLabel}
                              </button>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </motion.div>
          </AnimatePresence>
        </section>

        <aside className="ep-preview">
          <PlayerCard
            model={selectedCardDesign}
            frame={currentFrame}
            badge={currentBadge}
            status={currentStatus}
            background={playerCardPreviewBackground}
            player={playerCardPreview}
            width={280}
          />
        </aside>
      </main>
      <ScrollJump />
    </div>
  )
}

