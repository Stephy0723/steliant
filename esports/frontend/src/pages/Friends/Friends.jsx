import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useLang } from '../../i18n/LangContext.jsx'
import { useAuth } from '../../context/AuthContext.jsx'
import { api } from '../../lib/api.js'
import { toast } from '../../lib/toast.js'
import { GAME_BY_ID, normalizeGameId } from '../../data/games.js'
import { Av, I } from '../../components/SocialKit/SocialKit.jsx'
import UserActionsMenu from '../../components/UserActions/UserActionsMenu.jsx'
import { presenceInfo } from '../../lib/presence.js'
import { onSocket } from '../../lib/socket.js'

// Diseño del kit "Chat y Amigos" (ui_kits/social): misma estructura y clases
// sx-*; los datos salen de la API real (/profile, /profile/search, /profile/me/friends).

const COUNTRY_LABELS = {
  RD: 'Republica Dominicana',
  DO: 'Republica Dominicana',
}

function countryLabel(code) {
  const value = String(code || '').trim().toUpperCase()
  if (!value) return ''
  return COUNTRY_LABELS[value] || value
}

function normalizeCountryFilter(code) {
  const value = String(code || '').trim().toUpperCase()
  return value === 'DO' ? 'RD' : value
}

function gameOf(raw) {
  if (!raw) return null
  const id = normalizeGameId(typeof raw === 'string' ? raw : raw.id || raw.gameId || raw.name, '')
  const game = GAME_BY_ID[id]
  return game ? { name: game.name, logo: game.images?.logo || null } : { name: String(raw.name || raw), logo: null }
}

function toPerson(f) {
  const game = gameOf(f.games?.[0] || f.mainGame)
  return {
    id: String(f._id || f.id || f),
    name: f.nick || '—',
    img: f.avatar && !String(f.avatar).includes('avatar-default') ? f.avatar : null,
    // Estado que eligio (Jugando, AFK, No molestar...) si esta conectado.
    presence: presenceInfo(f),
    on: presenceInfo(f).online,
    game,
    rank: f.rank || null,
    country: f.countryCode || f.region || null,
    countryName: countryLabel(f.countryCode || f.region),
    pro: /pro|premium/i.test(String(f.plan || '')),
    code: f.playerCode || null,
  }
}

function Id({ p, isEs }) {
  return (
    <div className="sx-card__id">
      <b>{p.name}</b>
      {p.game && (
        <span className="sx-game">{p.game.logo && <img src={p.game.logo} alt="" />}<span>{p.game.name}</span></span>
      )}
      {p.countryName && <span className="sx-game"><span>{p.countryName}</span></span>}
      {!p.game && p.code && <span className="sx-game"><span>{p.code}</span></span>}
      {(p.rank || p.pro) && (
        <span style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 4 }}>
          {p.rank && <span className="sx-tag">{p.rank}</span>}
          {p.pro && <span className="sx-tag pro">PRO</span>}
        </span>
      )}
      {!p.game && !p.code && !p.rank && !p.pro && <span className="sx-game"><span>{isEs ? 'Sin juego principal' : 'No main game'}</span></span>}
    </div>
  )
}

function FriendCard({ p, isEs, onMessage, onProfile }) {
  const cls = p.on ? ' on' : ''
  const status = p.presence?.online ? p.presence.label : (isEs ? 'Desconectado' : 'Offline')
  return (
    <article className="sx-card sx-cut">
      <div className="sx-card__top">
        <Av name={p.name} img={p.img} s={60} on={p.on} dot={p.presence?.color} dotLabel={status} />
        <Id p={p} isEs={isEs} />
        <UserActionsMenu user={{ _id: p.id, nick: p.name, avatar: p.img }} context={{ type: 'profile', id: p.id }} />
      </div>
      <div className={'sx-status' + cls} style={p.on && p.presence?.color ? { color: p.presence.color } : undefined}><i style={p.on && p.presence?.color ? { background: p.presence.color } : undefined} />{status}</div>
      <div className="sx-card__acts">
        <button className="sx-btn sx-btn--pri" onClick={onMessage}><I name="msg" size={16} />{isEs ? 'Mensaje' : 'Message'}</button>
        <button className="sx-btn sx-btn--sec" onClick={onProfile}>{isEs ? 'Ver perfil' : 'View profile'}</button>
      </div>
    </article>
  )
}

function ReqCard({ p, state, busy, isEs, onAct }) {
  return (
    <article className="sx-card req sx-cut">
      <div className="sx-card__top"><Av name={p.name} img={p.img} s={56} /><Id p={p} isEs={isEs} /><UserActionsMenu user={{ _id: p.id, nick: p.name, avatar: p.img }} context={{ type: 'profile', id: p.id }} /></div>
      <div className="sx-card__acts">
        {state === 'ok' ? <button className="sx-btn sx-btn--done"><I name="check" size={16} />{isEs ? 'Ahora son amigos' : 'You are now friends'}</button>
          : state === 'no' ? <button className="sx-btn sx-btn--done">{isEs ? 'Solicitud ignorada' : 'Request ignored'}</button>
          : <>
              <button className="sx-btn sx-btn--pri" disabled={busy} onClick={() => onAct('ok')}><I name="check" size={16} />{isEs ? 'Aceptar' : 'Accept'}</button>
              <button className="sx-btn sx-btn--sec" disabled={busy} onClick={() => onAct('no')}>{isEs ? 'Ignorar' : 'Ignore'}</button>
            </>}
      </div>
    </article>
  )
}

function ResultCard({ p, relation, busy, isEs, onAdd, onAccept, onProfile }) {
  let action
  if (relation === 'friend') action = <button className="sx-btn sx-btn--done"><I name="check" size={16} />{isEs ? 'Ya son amigos' : 'Already friends'}</button>
  else if (relation === 'pending') action = <button className="sx-btn sx-btn--pri" onClick={onAccept}><I name="check" size={16} />{isEs ? 'Aceptar' : 'Accept'}</button>
  else if (relation === 'sent') action = <button className="sx-btn sx-btn--done"><I name="clock" size={16} />{isEs ? 'Solicitud enviada' : 'Request sent'}</button>
  else action = <button className="sx-btn sx-btn--pri" disabled={busy} onClick={onAdd}><I name="plus" size={16} />{busy ? (isEs ? 'Enviando…' : 'Sending…') : (isEs ? 'Agregar' : 'Add')}</button>
  return (
    <article className="sx-card sx-cut">
      <div className="sx-card__top"><Av name={p.name} img={p.img} s={56} on={p.on} dot={p.presence?.color} dotLabel={p.presence?.label} /><Id p={p} isEs={isEs} /><UserActionsMenu user={{ _id: p.id, nick: p.name, avatar: p.img }} context={{ type: 'profile', id: p.id }} /></div>
      <div className="sx-card__acts">
        {action}
        <button className="sx-btn sx-btn--sec" onClick={onProfile}>{isEs ? 'Ver perfil' : 'View profile'}</button>
      </div>
    </article>
  )
}

function FrState({ ic, title, text, cta, err, onCta }) {
  return (
    <div className="sx-fr-state sx-cut">
      <span className={'sx-state__ic sx-cut' + (err ? ' err' : '')}><I name={ic} size={28} /></span>
      <div className="t-sec">{title}</div>
      <p className="t-body">{text}</p>
      {cta && <button className="sx-btn sx-btn--pri" onClick={onCta}>{cta}</button>}
    </div>
  )
}

function Skeletons({ n = 4 }) {
  return (
    <div className="sx-grid" aria-busy="true">
      {Array.from({ length: n }).map((_, i) => (
        <div key={i} className="sx-skcard sx-cut">
          <div style={{ display: 'flex', gap: 12 }}><span className="sx-sk" style={{ width: 60, height: 60, borderRadius: '50%' }} />
            <div style={{ flex: 1, display: 'grid', gap: 8, alignContent: 'start', paddingTop: 6 }}><span className="sx-sk" style={{ height: 14, width: '60%' }} /><span className="sx-sk" style={{ height: 10, width: '80%' }} /><span className="sx-sk" style={{ height: 16, width: '45%' }} /></div></div>
          <div style={{ display: 'flex', gap: 8 }}><span className="sx-sk" style={{ flex: 1, height: 40 }} /><span className="sx-sk" style={{ flex: 1, height: 40 }} /></div>
        </div>
      ))}
    </div>
  )
}

function uniqueGameIds(values = []) {
  return [...new Set(values.map(value => normalizeGameId(value, '')).filter(Boolean))]
}

export default function Friends() {
  const { lang } = useLang()
  const isEs = lang !== 'en'
  const navigate = useNavigate()
  const { user } = useAuth()

  const [state, setState] = useState('loading') // loading | ok | error
  const [friends, setFriends] = useState([])
  const [requests, setRequests] = useState([])
  const [sentRequests, setSentRequests] = useState([])
  const [reqState, setReqState] = useState({})
  const [busyReq, setBusyReq] = useState(null)
  const [tab, setTab] = useState('amigos')
  const [filter, setFilter] = useState('')

  const load = useCallback(() => {
    if (!user) return
    setState(s => (s === 'ok' ? 'ok' : 'loading'))
    api(`/profile/${user._id || user.id}`)
      .then(({ user: profile }) => {
        setFriends((profile.friends || []).map(toPerson))
        setRequests((profile.friendRequests?.received || []).map(toPerson))
        setSentRequests((profile.friendRequests?.sent || []).map(toPerson))
        setState('ok')
      })
      .catch(() => setState('error'))
  }, [user])

  useEffect(load, [load])

  // Un amigo se conecta, se va o cambia su estado: se actualiza al momento.
  useEffect(() => onSocket('presence', ({ userId, presence, online }) => {
    setFriends(prev => prev.map(f => (f.id === String(userId)
      ? { ...f, on: Boolean(online), presence: presenceInfo({ presence }) }
      : f)))
  }), [])

  const respond = (p, act) => {
    setBusyReq(p.id)
    api(`/profile/me/friends/${p.id}`, { method: 'PATCH', body: { action: act === 'ok' ? 'accept' : 'reject' } })
      .then(() => {
        setReqState(s => ({ ...s, [p.id]: act }))
        if (act === 'ok') setFriends(list => [p, ...list.filter(f => f.id !== p.id)])
      })
      .catch(err => toast(err.message || (isEs ? 'No se pudo procesar la solicitud' : 'Could not process the request'), 'error'))
      .finally(() => setBusyReq(null))
  }

  const cancelSentRequest = id => {
    api(`/profile/me/friends/request/${id}`, { method: 'DELETE' })
      .then(() => setSentRequests(list => list.filter(f => f.id !== id)))
      .catch(err => toast(err.message || (isEs ? 'No se pudo cancelar la solicitud' : 'Could not cancel the request'), 'error'))
  }

  // ── Buscar jugadores ──
  const [q, setQ] = useState('')
  const [found, setFound] = useState([])
  const [searching, setSearching] = useState(false)
  const [sent, setSent] = useState({})
  const [sending, setSending] = useState(null)
  const myCountry = normalizeCountryFilter(user?.countryCode || user?.region || 'RD')
  const myGames = useMemo(() => uniqueGameIds([
    ...(Array.isArray(user?.games) ? user.games : []),
    user?.gamerProfile?.mainGame,
    user?.gamerProfile?.secondGame,
    user?.gamerProfile?.gameId,
  ]).slice(0, 4), [user])
  const [countryFilter, setCountryFilter] = useState(myCountry)
  const [gameFilters, setGameFilters] = useState(myGames)

  useEffect(() => {
    setCountryFilter(myCountry)
  }, [myCountry])

  useEffect(() => {
    setGameFilters(myGames)
  }, [myGames])

  useEffect(() => {
    const term = q.trim()
    const activeGames = gameFilters.filter(Boolean)
    if (term.length < 2 && !countryFilter && !activeGames.length) { setFound([]); setSearching(false); return }
    let cancelled = false
    setSearching(true)
    const timer = setTimeout(() => {
      const params = new URLSearchParams()
      if (term.length >= 2) params.set('q', term)
      if (countryFilter) params.set('country', countryFilter)
      if (activeGames.length) params.set('games', activeGames.join(','))
      api(`/profile/search?${params.toString()}`)
        .then(({ users }) => { if (!cancelled) setFound((users || []).map(toPerson)) })
        .catch(() => { if (!cancelled) setFound([]) })
        .finally(() => { if (!cancelled) setSearching(false) })
    }, 300)
    return () => { cancelled = true; clearTimeout(timer) }
  }, [q, countryFilter, gameFilters])

  const sendRequest = id => {
    setSending(id)
    api(`/profile/me/friends/request/${id}`, { method: 'POST' })
      .then(() => setSent(s => ({ ...s, [id]: true })))
      .catch(err => toast(err.message || (isEs ? 'No se pudo enviar la solicitud' : 'Could not send the request'), 'error'))
      .finally(() => setSending(null))
  }

  const friendIds = useMemo(() => new Set(friends.map(f => f.id)), [friends])
  const sentIds = useMemo(() => new Set(sentRequests.map(f => f.id)), [sentRequests])
  const pendingReqs = requests.filter(r => !reqState[r.id])
  const pending = pendingReqs.length
  const online = friends.filter(f => f.on === true)
  const shown = (tab === 'online' ? online : friends).filter(f => f.name.toLowerCase().includes(filter.trim().toLowerCase()))
  const counted = state === 'ok'

  const openProfile = p => navigate(`/perfil?user=${encodeURIComponent(p.name)}`)
  const openChat = p => navigate(`/mensajes?dm=${encodeURIComponent(p.id)}&name=${encodeURIComponent(p.name)}`)

  const TABS = [
    ['amigos', isEs ? 'Amigos' : 'Friends', friends.length],
    ['online', isEs ? 'En línea' : 'Online', online.length],
    ['req', isEs ? 'Solicitudes' : 'Requests', pending, true],
    ['sent', isEs ? 'Enviadas' : 'Sent', sentRequests.length],
    ['buscar', isEs ? 'Buscar jugadores' : 'Find players'],
  ]

  let body
  if (state === 'loading' && tab !== 'buscar') {
    body = <><div className="t-lab" style={{ marginBottom: 12 }}>{isEs ? 'Cargando amigos…' : 'Loading friends…'}</div><Skeletons n={4} /></>
  } else if (state === 'error' && tab !== 'buscar') {
    body = <FrState err ic="alert" title={isEs ? 'No pudimos cargar tus amigos' : 'We could not load your friends'} text={isEs ? 'Hubo un problema de conexión. Revisa tu internet y vuelve a intentarlo.' : 'There was a connection problem. Check your internet and try again.'} cta={isEs ? 'Reintentar' : 'Retry'} onCta={load} />
  } else if (tab === 'req') {
    body = requests.length ? <>
        <div className="sx-sec-h"><h2 className="t-sec">{isEs ? 'Solicitudes recibidas' : 'Received requests'}</h2><span className="t-lab">{pending} {isEs ? 'pendientes' : 'pending'}</span></div>
        <div className="sx-grid">{requests.map(r => <ReqCard key={r.id} p={r} isEs={isEs} state={reqState[r.id]} busy={busyReq === r.id} onAct={a => respond(r, a)} />)}</div></>
      : <FrState ic="bell" title={isEs ? 'No tienes solicitudes pendientes' : 'No pending requests'} text={isEs ? 'Cuando alguien quiera agregarte, su solicitud aparecerá aquí.' : 'When someone wants to add you, their request will show up here.'} cta={isEs ? 'Buscar jugadores' : 'Find players'} onCta={() => setTab('buscar')} />
  } else if (tab === 'buscar') {
    const hasDiscoveryFilter = Boolean(countryFilter || gameFilters.length)
    const term = q.trim() || (hasDiscoveryFilter ? (isEs ? 'esos filtros' : 'those filters') : '')
    const toggleGameFilter = (id) => setGameFilters(list => list.includes(id) ? list.filter(item => item !== id) : [...list, id])
    body = <>
      <label className="sx-bigsearch sx-cut">
        <I name="search" size={20} />
        <input value={q} onChange={e => setQ(e.target.value)} placeholder={isEs ? 'Busca por nick o ID de jugador' : 'Search by nick or player ID'} />
        {q && <button className="sx-ico" aria-label={isEs ? 'Borrar' : 'Clear'} onClick={() => setQ('')}><I name="x" size={16} /></button>}
      </label>
      <div className="sx-discover sx-cut">
        <div className="sx-discover__head">
          <div>
            <h2 className="t-sec">{isEs ? 'Descubrir jugadores' : 'Discover players'}</h2>
            <p className="t-sm">{q.trim().length >= 2
              ? (isEs ? 'Al buscar por nick o ID se muestran jugadores de todos los países y juegos.' : 'Searching by nick or ID shows players from every country and game.')
              : (isEs ? 'Filtra por tu pais y por los juegos que tienes en el perfil.' : 'Filter by your country and the games selected in your profile.')}</p>
          </div>
          {(countryFilter || gameFilters.length > 0) && (
            <button className="sx-discover__clear" onClick={() => { setCountryFilter(''); setGameFilters([]) }}>
              {isEs ? 'Limpiar' : 'Clear'}
            </button>
          )}
        </div>
        <div className="sx-filter-row">
          {myCountry && (
            <button className={'sx-filter-chip' + (countryFilter ? ' on' : '')} onClick={() => setCountryFilter(value => value ? '' : myCountry)}>
              <span>{countryLabel(myCountry)}</span>
            </button>
          )}
          {myGames.map(gameId => {
            const game = GAME_BY_ID[gameId]
            return (
              <button key={gameId} className={'sx-filter-chip' + (gameFilters.includes(gameId) ? ' on' : '')} onClick={() => toggleGameFilter(gameId)}>
                {game?.images?.logo && <img src={game.images.logo} alt="" />}
                <span>{game?.name || gameId}</span>
              </button>
            )
          })}
        </div>
      </div>
      {term.length < 2 ? <FrState ic="search" title={isEs ? 'Encuentra a tu próximo dúo' : 'Find your next duo'} text={isEs ? 'Escribe un nick o un ID de jugador para ver resultados.' : 'Type a nick or a player ID to see results.'} />
        : searching ? <><div className="t-lab" style={{ marginBottom: 12 }}>{isEs ? 'Buscando…' : 'Searching…'}</div><Skeletons n={2} /></>
        : found.length ? <>
            <div className="sx-sec-h"><h2 className="t-sec">{isEs ? 'Resultados' : 'Results'}</h2><span className="t-lab">{found.length} {isEs ? 'jugadores' : 'players'}</span></div>
            <div className="sx-grid">{found.map(p => {
              const pendingReq = requests.find(r => r.id === p.id && !reqState[r.id])
              const relation = friendIds.has(p.id) ? 'friend' : pendingReq ? 'pending' : (sent[p.id] || sentIds.has(p.id)) ? 'sent' : 'none'
              return <ResultCard key={p.id} p={p} isEs={isEs} relation={relation} busy={sending === p.id} onAdd={() => sendRequest(p.id)} onAccept={() => respond(pendingReq, 'ok')} onProfile={() => openProfile(p)} />
            })}</div></>
        : <FrState ic="search" title={isEs ? `Nadie con “${term}” por aquí` : `Nobody named “${term}” here`} text={isEs ? 'Revisa cómo se escribe el nick o prueba con su ID de jugador.' : 'Check the spelling of the nick or try their player ID.'} />}
    </>
  } else if (tab === 'sent') {
    body = sentRequests.length ? <>
      <div className="sx-sec-h"><h2 className="t-sec">{isEs ? 'Solicitudes enviadas' : 'Sent requests'}</h2><span className="t-lab">{sentRequests.length}</span></div>
      <div className="sx-grid">{sentRequests.map(p => (
        <article className="sx-card req sx-cut" key={p.id}>
          <div className="sx-card__top"><Av name={p.name} img={p.img} s={56} /><Id p={p} isEs={isEs} /><UserActionsMenu user={{ _id: p.id, nick: p.name, avatar: p.img }} context={{ type: 'profile', id: p.id }} /></div>
          <div className="sx-card__acts">
            <button className="sx-btn sx-btn--sec" onClick={() => cancelSentRequest(p.id)}><I name="x" size={16} />{isEs ? 'Cancelar' : 'Cancel'}</button>
            <button className="sx-btn sx-btn--sec" onClick={() => openProfile(p)}>{isEs ? 'Ver perfil' : 'View profile'}</button>
          </div>
        </article>
      ))}</div>
    </> : <FrState ic="clock" title={isEs ? 'No tienes solicitudes enviadas' : 'No sent requests'} text={isEs ? 'Cuando envíes solicitudes, podrás cancelarlas desde aquí.' : 'When you send requests, you can cancel them here.'} />
  } else if (!friends.length) {
    body = <FrState ic="users" title={isEs ? 'Tu lista está vacía por ahora' : 'Your list is empty for now'} text={isEs ? 'Busca jugadores por nick, agrégalos y arma tu escuadra para el próximo torneo.' : 'Find players by nick, add them and build your squad for the next tournament.'} cta={isEs ? 'Buscar jugadores' : 'Find players'} onCta={() => setTab('buscar')} />
  } else {
    body = <>
      <div className="sx-tool">
        <label className="sx-search sx-cut"><I name="search" size={16} /><input placeholder={isEs ? 'Filtrar amigos' : 'Filter friends'} value={filter} onChange={e => setFilter(e.target.value)} /></label>
      </div>
      {shown.length
        ? <div className="sx-grid">{shown.map(f => <FriendCard key={f.id} p={f} isEs={isEs} onMessage={() => openChat(f)} onProfile={() => openProfile(f)} />)}</div>
        : <FrState ic="users" title={tab === 'online' ? (isEs ? 'Nadie en línea ahora' : 'Nobody online right now') : (isEs ? 'Sin coincidencias' : 'No matches')} text={tab === 'online' ? (isEs ? 'Cuando tus amigos se conecten, aparecerán aquí.' : 'When your friends come online, they will show up here.') : (isEs ? 'Ningún amigo coincide con ese nick.' : 'No friend matches that nick.')} />}
    </>
  }

  return (
    <div className="sx sx-fr">
      <div className="sx-fr__in">
        <div className="sx-fr__head">
          <div><h1 className="t-page">{isEs ? 'Amigos' : 'Friends'}</h1><p className="t-body">{isEs ? 'Tu gente para jugar, practicar y competir.' : 'Your people to play, practice and compete with.'}</p></div>
          <div className="sx-kpis">
            <div className="sx-kpi sx-cut"><b>{counted ? friends.length : '—'}</b><span className="t-lab">{isEs ? 'Amigos' : 'Friends'}</span></div>
            <div className="sx-kpi sx-cut"><b>{counted ? online.length : '—'}</b><span className="t-lab">{isEs ? 'En línea' : 'Online'}</span></div>
            <button className={'sx-kpi sx-cut' + (pending ? ' hot' : '')} style={{ textAlign: 'left' }} onClick={() => setTab('req')}><b>{counted ? pending : '—'}</b><span className="t-lab">{isEs ? 'Solicitudes' : 'Requests'}</span></button>
          </div>
        </div>
        <nav className="sx-tabs" role="tablist">
          {TABS.map(([id, label, n, hot]) => (
            <button key={id} role="tab" aria-selected={tab === id} className={'sx-tab' + (tab === id ? ' on' : '') + (id === 'buscar' ? ' sx-tab--end' : '')} onClick={() => setTab(id)}>
              {id === 'buscar' && <I name="search" size={16} />}{label}
              {n !== undefined && counted && <em className={hot && n ? 'hot' : ''}>{n}</em>}
            </button>
          ))}
        </nav>
        {body}
      </div>
    </div>
  )
}

