import { useState, useEffect } from 'react'
import { safeHref } from '../../lib/safeUrl.js'
import { useParams, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import VideoHero from '../../components/VideoHero/VideoHero.jsx'
import Tabs from '../../components/Tabs/Tabs.jsx'
import Badge from '../../components/Badge/Badge.jsx'
import Avatar from '../../components/Avatar/Avatar.jsx'
import CreatorCard from '../../components/CreatorCard/CreatorCard.jsx'
import PostCard from '../../components/PostCard/PostCard.jsx'
import RoleBadge from '../../components/RoleBadge/RoleBadge.jsx'
import Composer from '../../components/Composer/Composer.jsx'
import ShareModal from '../../components/ShareModal/ShareModal.jsx'
import { Icon } from '../../components/icons/Icons.jsx'
import { GlitchGangText } from '../../components/GlitchText/GlitchText.jsx'
import { getAllCommunities, getCommunityBySlug } from '../../data/communities.js'
import { getCommunityMold, SOCIAL_META } from '../../data/communityMold.js'
import { NEWS } from '../../data/news.js'
import { useShareDestinations } from '../../hooks/useShareDestinations.js'
import { useNotifications } from '../../context/NotificationsContext.jsx'
import { useAuth } from '../../context/AuthContext.jsx'
import { toast } from '../../lib/toast.js'
import { api } from '../../lib/api.js'
import './CommunityPage.css'

const TAG_TAB_MAP = {
  Torneos:    'torneos',
  Creadores:  'creadores',
  Noticias:   'noticias',
}

const COMMUNITY_TABS = [
  { id: 'comunidad',  label: 'Comunidad' },
  { id: 'torneos',    label: 'Torneos' },
  { id: 'creadores',  label: 'Creadores' },
  { id: 'noticias',   label: 'Noticias' },
  { id: 'mas-info',   label: 'Más info' },
]



// ── Tournament card (Torneos tab) ─────────────────────────────
function normalizeRemoteCommunity(remote = {}, fallback = null, viewerId = null) {
  const links = Object.entries(remote.links || {})
    .filter(([, value]) => value)
    .map(([label, url]) => ({ label, url }))
  const creatorId = remote.creator?._id || remote.creator || null
  return {
    ...(fallback || {}),
    ...remote,
    id: remote.id || remote._id || fallback?.id,
    remoteId: remote._id || null,
    slug: remote.slug || fallback?.slug,
    // Datos reales del backend (decorate): conteo y si el que mira es miembro.
    members: Number(remote.memberCount ?? (Array.isArray(remote.members) ? remote.members.length : 0)) || 0,
    joined: Boolean(remote.joined),
    isCreator: Boolean(viewerId && creatorId && String(creatorId) === String(viewerId)),
    genre: remote.game || remote.games?.[0] || fallback?.genre || 'Comunidad',
    tags: [...new Set([...(fallback?.tags || []), ...(remote.games || []), remote.region, remote.lang, 'Comunidad'].filter(Boolean))],
    poster: remote.banner || remote.poster || fallback?.poster || '',
    video: remote.video || fallback?.video || '',
    gallery: Array.isArray(remote.gallery) ? remote.gallery : fallback?.gallery || [],
    lowFpsImage: remote.banner || fallback?.lowFpsImage || '',
    color: remote.color || remote.accent || fallback?.color,
    railImages: fallback?.railImages || {},
    railData: {},
    userRole: viewerId && creatorId && String(creatorId) === String(viewerId) ? 'admin' : 'member',
    posts: [],
    creators: [],
    news: [],
    info: {
      ...(fallback?.info || {}),
      modes: remote.games?.length ? remote.games : fallback?.info?.modes || ['Comunidad'],
      links: links.length ? links : fallback?.info?.links || [],
      events: fallback?.info?.events || [],
      rules: remote.rules?.length ? remote.rules.join(' ') : fallback?.info?.rules,
      allowed: remote.allowed || fallback?.info?.allowed,
      notAllowed: remote.notAllowed || fallback?.info?.notAllowed,
      banned: remote.banned || fallback?.info?.banned,
      team: remote.team || remote.staff || fallback?.info?.team,
    },
  }
}

function TournamentCardSimple({ post, idx }) {
  const navigate = useNavigate()
  return (
    <motion.div
      className="gg-cp-torneo"
      initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
      transition={{ delay: idx * .07 }}
    >
      <div className="gg-cp-torneo__head">
        <div className="gg-cp-torneo__title-row">
          <h3><GlitchGangText>{post.title}</GlitchGangText></h3>
          <Badge variant="accent">{Icon.trophy} {post.prize}</Badge>
        </div>
        <div className="gg-cp-torneo__meta">
          <span>{post.game}</span>
          <span>{post.format}</span>
          <span>{Icon.bolt} {new Date(post.date).toLocaleDateString('es-ES')}</span>
        </div>
      </div>
      <div className="gg-cp-torneo__progress">
        <div className="gg-cp-post__slots-bar">
          <div className="gg-cp-post__slots-fill" style={{ width: `${(post.filledSlots / post.slots) * 100}%` }} />
        </div>
        <span className="gg-cp-torneo__slots">{post.filledSlots}/{post.slots} slots</span>
      </div>
      {post.tournamentId && (
        <button className="gg-btn gg-btn--primary gg-btn--sm" onClick={() => navigate(`/torneos/${post.tournamentId}`)}>Ver torneo</button>
      )}
    </motion.div>
  )
}

// ── News card ─────────────────────────────────────────────────
function NewsItem({ article, idx }) {
  return (
    <motion.div
      className="gg-cp-news"
      initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }}
      transition={{ delay: idx * .06 }}
    >
      <div className="gg-cp-news__dot" style={{ background: article.color }} />
      <div>
        <Badge variant="muted" className="gg-cp-news__tag">{article.tag}</Badge>
        <h4><GlitchGangText>{article.title}</GlitchGangText></h4>
        <p>{article.excerpt}</p>
        <time>{article.date}</time>
      </div>
    </motion.div>
  )
}

// ── Main page ─────────────────────────────────────────────────
export default function CommunityPage() {
  const { game } = useParams()
  const navigate  = useNavigate()
  const { pushNotification } = useNotifications() || {}
  const { user } = useAuth() || {}
  const [community, setCommunity] = useState(null)
  const [tab, setTab]             = useState('comunidad')
  const [activeTag, setActiveTag] = useState(null)
  const [posts, setPosts]         = useState([])
  const [shareOpen, setShareOpen] = useState(false)
  const [membershipBusy, setMembershipBusy] = useState(false)

  useEffect(() => {
    let cancelled = false
    // Solo posts reales: antes, sin posts se mostraban los de ejemplo.
    const loadRemotePosts = (slug) => {
      api(`/posts?community=${encodeURIComponent(slug)}`)
        .then(data => {
          if (!cancelled) setPosts(Array.isArray(data.posts) ? data.posts : [])
        })
        .catch(() => {
          if (!cancelled) setPosts([])
        })
    }
    const fallback = getCommunityBySlug(game)
    if (fallback) {
      setCommunity(fallback)
      loadRemotePosts(fallback.slug || game)
    }
    // No existe /communities/public/:slug -- GET /communities/:id ya acepta
    // un slug ademas del _id real (ver getCommunityDetail en el backend).
    api(`/communities/${encodeURIComponent(game)}`)
      .then(data => {
        if (cancelled) return
        const remote = data.community
        const next = normalizeRemoteCommunity(remote, fallback, user?._id || user?.id)
        setCommunity(next)
        loadRemotePosts(next.slug || game)
      })
      .catch(() => {
        if (!cancelled && !fallback) navigate('/comunidad')
      })
    return () => { cancelled = true }
  }, [game, navigate, user?._id, user?.id])

  const { friends: shareContacts, teams: shareTeams } = useShareDestinations(shareOpen)

  if (!community) return null

  const { name, genre, description, tags = [], video, poster, lowFpsImage, railImages = {}, railData = {}, color, members, joined, userRole, creators = [], news = [], info = {} } = community
  const isManagedCommunity = Boolean(community.publicCode || community.updatedAt)
  const mold = isManagedCommunity ? null : getCommunityMold(community.slug)
  const communityKey = community.publicId || community.slug || community.id || game
  const communityUrl = typeof window !== 'undefined'
    ? `${window.location.origin}/comunidad/${encodeURIComponent(communityKey)}`
    : `/comunidad/${communityKey}`
  const shareCommunities = getAllCommunities()
    .filter(item => item.slug !== community.slug)
    .slice(0, 8)
    .map(item => ({
      id: item.slug || item.id,
      name: item.name,
      subtitle: item.genre || 'Comunidad',
      avatar: item.logo || item.poster || item.lowFpsImage || '',
      logo: item.logo || '',
      cover: item.poster || item.lowFpsImage || '',
    }))
  const shareSummary = `${name} es una comunidad de ${genre} con ${Number(members || 0).toLocaleString('es-DO')} miembros en GlitchGang.`

  const handleTagClick = (tag) => {
    const targetTab = TAG_TAB_MAP[tag]
    if (targetTab) {
      setTab(targetTab)
    } else {
      setActiveTag(t => t === tag ? null : tag)
      setTab('comunidad')
    }
  }

  const notifyMembership = (joined, nextCommunity) => {
    const action = joined ? 'entraste a' : 'saliste de'
    const title = joined ? 'Te uniste a la comunidad' : 'Saliste de la comunidad'
    const desc = `Ya ${action} ${nextCommunity.name}.`

    toast(desc, joined ? 'success' : 'info')
    pushNotification?.({
      type: 'comunidad',
      title,
      desc,
      fullMessage: joined
        ? `Ahora formas parte de ${nextCommunity.name}. Puedes ver sus publicaciones, torneos y novedades.`
        : `Dejaste ${nextCommunity.name}. Puedes volver a unirte cuando quieras desde la página de la comunidad.`,
      category: 'Comunidad',
      tone: joined ? 'success' : 'info',
      action: { label: 'Ver comunidad', link: `/comunidad/${nextCommunity.slug}` },
    })
  }

  // Unirse/salir en el servidor (POST /communities/:id/join|leave). Antes solo
  // se guardaba en localStorage: nadie más lo veía y no contaba como miembro.
  const changeMembership = async (join) => {
    if (!community || membershipBusy || Boolean(community.joined) === join) return
    if (!user) { navigate('/login'); return }
    if (!community.remoteId) {
      toast('Unirse a esta comunidad se habilitará en la próxima versión.', 'info')
      return
    }
    setMembershipBusy(true)
    try {
      const res = await api(`/communities/${community.remoteId}/${join ? 'join' : 'leave'}`, { method: 'POST' })
      const next = { ...community, joined: Boolean(res.joined), members: Number(res.memberCount) || 0 }
      setCommunity(next)
      notifyMembership(join, next)
    } catch (err) {
      toast(err.message || 'No se pudo actualizar tu membresía', 'error')
    } finally {
      setMembershipBusy(false)
    }
  }
  const handleJoin = () => changeMembership(true)
  const handleLeave = () => changeMembership(false)

  const handleNewPost = (newPost) => {
    setPosts(prev => [newPost, ...prev])
  }

  // Filter feed posts by active tag and tab
  const feedPosts = posts.filter(p => {
    if (tab === 'torneos') return false
    if (activeTag) {
      const contentStr = p.content || p.text || p.title || p.description || ''
      return contentStr.toLowerCase().includes(activeTag.toLowerCase()) || p.type === 'tournament'
    }
    return true
  })

  // Tournament posts
  const tournamentPosts = posts.filter(p => p.type === 'tournament')

  // Community news
  const communityNews = NEWS.filter(n => news.includes(String(n.id)))

  return (
    <div className="gg-page gg-cp">
      {/* Video Hero */}
      <VideoHero
        name={name}
        genre={genre}
        description={description}
        tags={tags}
        video={video}
        poster={poster}
        lowFpsImage={lowFpsImage}
        railImages={railImages}
        railData={railData}
        color={color}
        members={members}
        activePlayers={community.activePlayers}
        joined={community.joined}
        onJoin={handleJoin}
        onLeave={handleLeave}
        onTagClick={handleTagClick}
        activeTag={activeTag}
        onQuickNav={(t) => { setTab(t); setActiveTag(null) }}
        onShare={() => setShareOpen(true)}
        counts={{ torneos: tournamentPosts.length, creadores: creators?.length || 0, noticias: communityNews.length }}
        onBack={() => navigate('/comunidad')}
      />
      <ShareModal
        open={shareOpen}
        onClose={() => setShareOpen(false)}
        title={`Compartir ${name}`}
        subtitle="Comparte esta comunidad dentro de GlitchGang o envia el enlace completo."
        url={communityUrl}
        text={`Te invito a unirte a la comunidad de ${name} en GlitchGang.`}
        game={genre}
        summary={shareSummary}
        image={poster || lowFpsImage}
        logo={community.logo || community.icon || poster || lowFpsImage}
        contacts={shareContacts}
        teams={shareTeams}
        communities={shareCommunities}
        shareKind="community"
      />

      {/* Role panel */}
      <div className="gg-cp__role-banner">
        <RoleBadge role={userRole} />
        <span className="gg-cp__role-desc">
          {userRole === 'member'               && 'Puedes publicar en el feed de la comunidad.'}
          {userRole === 'creator'              && 'Crea publicaciones y comparte tu contenido.'}
          {userRole === 'event-organizer'      && 'Organiza eventos y crea publicaciones.'}
          {userRole === 'tournament-organizer' && 'Organiza torneos, eventos y publicaciones.'}
          {userRole === 'moderator'            && 'Acceso completo: torneos, eventos, encuestas y moderación.'}
          {userRole === 'admin'                && 'Admin de la comunidad — acceso total.'}
        </span>
        {userRole === 'member' && (
          <button className="gg-btn gg-btn--ghost gg-btn--sm" onClick={() => navigate('/solicitar-rol')}>Solicitar rol →</button>
        )}
      </div>

      {/* Tabs */}
      <Tabs tabs={COMMUNITY_TABS} value={tab} onChange={t => { setTab(t); setActiveTag(null) }} />

      {/* ── COMUNIDAD tab ── */}
      {tab === 'comunidad' && (
        <div className="gg-cp__feed-layout">
          {/* Composer */}
          <Composer
            onSubmit={handleNewPost}
            userRole={userRole}
            communitySlug={community.slug || game}
            userAvatar={user?.avatar || ''}
            userNick={user?.nick || user?.username || ''}
            userStatus={user?.activeStatus}
          />

          {/* Active filter label */}
          {activeTag && (
            <div className="gg-cp__tag-filter">
              <span>Filtrando por: <b>{activeTag}</b></span>
              <button onClick={() => setActiveTag(null)}>{Icon.x}</button>
            </div>
          )}

          {/* Feed */}
          <div className="gg-cp__feed">
            {feedPosts.map(p => (
              <PostCard 
                key={p.id} 
                post={p} 
                onDelete={(id) => setPosts(prev => prev.filter(x => x.id !== id))}
                onBlock={(id, blockAuthor) => {
                  if (blockAuthor) {
                    const blockedPost = posts.find(x => x.id === id)
                    if (blockedPost) {
                      setPosts(prev => prev.filter(x => x.author?.nick !== blockedPost.author?.nick))
                    }
                  } else {
                    setPosts(prev => prev.filter(x => x.id !== id))
                  }
                }}
              />
            ))}
            {feedPosts.length === 0 && (
              <div className="gg-cp__empty">
                {Icon.chat}
                <p>Sé el primero en publicar en esta comunidad.</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── TORNEOS tab ── */}
      {tab === 'torneos' && (
        <div className="gg-cp__torneos">
          {tournamentPosts.length > 0 ? (
            tournamentPosts.map((p, i) => <TournamentCardSimple key={p.id} post={p} idx={i} />)
          ) : (
            <div className="gg-cp__empty">
              {Icon.trophy}
              <p>No hay torneos activos en esta comunidad aún.</p>
              {(userRole === 'tournament-organizer' || userRole === 'admin' || userRole === 'moderator') && (
                <button className="gg-btn gg-btn--primary gg-btn--sm" onClick={() => navigate('/torneos/crear')}>
                  Crear torneo
                </button>
              )}
            </div>
          )}

          {community.gallery?.length > 0 && (
            <section className="gg-cp__info-section">
              <h3>Galeria</h3>
              <div className="gg-cp__gallery">
                {community.gallery.map((item, index) => (
                  <figure key={`${item.url}-${index}`} className="gg-cp__gallery-item">
                    {item.type === 'video' ? <video src={item.url} controls /> : <img src={item.url} alt={item.title || `${name} ${index + 1}`} />}
                    {item.title && <figcaption>{item.title}</figcaption>}
                  </figure>
                ))}
              </div>
            </section>
          )}
        </div>
      )}

      {/* ── CREADORES tab ── */}
      {tab === 'creadores' && (
        <div className="gg-cp__creadores">
          {creators.length > 0 ? (
            creators.map((c, i) => <CreatorCard key={c.id} creator={c} delay={i * .08} />)
          ) : (
            <div className="gg-cp__empty">
              {Icon.play}
              <p>No hay creadores destacados aún.</p>
            </div>
          )}
        </div>
      )}

      {/* ── NOTICIAS tab ── */}
      {tab === 'noticias' && (
        <div className="gg-cp__noticias">
          {communityNews.length > 0 ? (
            communityNews.map((n, i) => <NewsItem key={n.id} article={n} idx={i} />)
          ) : (
            <div className="gg-cp__empty">
              {Icon.news}
              <p>No hay noticias para esta comunidad.</p>
            </div>
          )}
        </div>
      )}

      {/* ── MÁS INFO tab ── */}
      {tab === 'mas-info' && (
        <div className="gg-cp__info">
          {mold && (
            <>
              {/* Ficha oficial (molde) */}
              <section className="gg-cp__info-section gg-cp__mold-card">
                <div className="gg-cp__mold-head">
                  <span className="gg-cp__mold-badge">{Icon.shield} COMUNIDAD OFICIAL · ADMIN STELIANT ESPORTS</span>
                  <span className="gg-cp__mold-id">{mold.officialId}</span>
                </div>
                <div className="gg-cp__mold-grid">
                  <div><span>Región</span><b>{mold.region}</b></div>
                  <div><span>Idioma</span><b>{mold.lang}</b></div>
                  <div><span>Audiencia</span><b>{mold.audience}</b></div>
                  <div><span>Quién publica</span><b>{mold.whoPublishes}</b></div>
                </div>
              </section>

              {/* Desarrolladora + redes reales */}
              <section className="gg-cp__info-section">
                <h3>Desarrolladora</h3>
                <p className="gg-cp__mold-dev"><b>{mold.developer.name}</b> · desde {mold.developer.founded} · {mold.developer.country}</p>
                <div className="gg-cp__info-links">
                  {Object.entries(mold.developer.socials).map(([k, url]) => (
                    <a key={k} href={safeHref(url)} target="_blank" rel="noreferrer" className="gg-cp__info-link">
                      {Icon[SOCIAL_META[k]?.icon] || Icon.globe} {SOCIAL_META[k]?.label || k}
                    </a>
                  ))}
                </div>
              </section>

              {/* Reglas enumeradas */}
              <section className="gg-cp__info-section">
                <h3>Reglas de la comunidad</h3>
                <ol className="gg-cp__mold-rules">
                  {mold.rules.map((r, i) => <li key={i}>{r}</li>)}
                </ol>
              </section>

              {/* Política de contenido */}
              <section className="gg-cp__info-section">
                <h3>Política de contenido</h3>
                <div className="gg-cp__mold-policy">
                  <div className="ok"><b>✅ Permitido</b><p>{mold.allowed}</p></div>
                  <div className="no"><b>🚫 No permitido</b><p>{mold.notAllowed}</p></div>
                  <div className="ban"><b>⛔ Prohibido</b><p>{mold.banned}</p></div>
                </div>
              </section>

              {/* Equipo / Admin */}
              <section className="gg-cp__info-section">
                <h3>Equipo y administración</h3>
                <div className="gg-cp__mold-team">
                  {mold.team.map((t, i) => (
                    <div key={i} className="gg-cp__mold-member"><span className="gg-cp__mold-role">{t.role}</span><b>@{t.username}</b></div>
                  ))}
                </div>
              </section>
            </>
          )}

          {!mold && (community.rules?.length > 0 || community.allowed || community.notAllowed || community.banned) && (
            <>
              {community.rules?.length > 0 && (
                <section className="gg-cp__info-section">
                  <h3>Reglas de la comunidad</h3>
                  <ol className="gg-cp__mold-rules">
                    {community.rules.map((rule, index) => <li key={index}>{rule}</li>)}
                  </ol>
                </section>
              )}
              {(community.allowed || community.notAllowed || community.banned) && (
                <section className="gg-cp__info-section">
                  <h3>Politica de contenido</h3>
                  <div className="gg-cp__mold-policy">
                    {community.allowed && <div className="ok"><b>Permitido</b><p>{community.allowed}</p></div>}
                    {community.notAllowed && <div className="no"><b>No permitido</b><p>{community.notAllowed}</p></div>}
                    {community.banned && <div className="ban"><b>Prohibido</b><p>{community.banned}</p></div>}
                  </div>
                </section>
              )}
              {(community.team?.length > 0 || community.staff?.length > 0) && (
                <section className="gg-cp__info-section">
                  <h3>Equipo y administracion</h3>
                  <div className="gg-cp__mold-team">
                    {(community.team || community.staff || []).map((member, index) => (
                      <div key={index} className="gg-cp__mold-member"><span className="gg-cp__mold-role">{member.role}</span><b>@{member.username}</b></div>
                    ))}
                  </div>
                </section>
              )}
            </>
          )}

          <section className="gg-cp__info-section">
            <h3>Modos de juego</h3>
            <div className="gg-cp__info-tags">
              {(info.modes || []).map(m => <Badge key={m} variant="muted">{m}</Badge>)}
            </div>
          </section>

          {info.events?.length > 0 && (
            <section className="gg-cp__info-section">
              <h3>Próximos eventos</h3>
              <div className="gg-cp__info-events">
                {info.events.map((ev, i) => (
                  <div key={i} className="gg-cp__info-event">
                    <span className="gg-cp__info-event-date">
                      {new Date(ev.date).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })}
                    </span>
                    <span>{ev.title}</span>
                  </div>
                ))}
              </div>
            </section>
          )}

          {info.links?.length > 0 && (
            <section className="gg-cp__info-section">
              <h3>Enlaces útiles</h3>
              <div className="gg-cp__info-links">
                {info.links.map(l => (
                  <a key={l.url} href={safeHref(l.url)} target="_blank" rel="noreferrer" className="gg-cp__info-link">
                    {Icon.globe} {l.label}
                  </a>
                ))}
              </div>
            </section>
          )}
        </div>
      )}
    </div>
  )
}

