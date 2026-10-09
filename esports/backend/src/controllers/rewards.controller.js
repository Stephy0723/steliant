// Recompensas (/recompensas): progreso, logros y referidos REALES del jugador.
// Restaurado el 3/oct desde aaec89b (23/ago): se habia perdido en un merge y
// la pagina volvio a la simulacion con localStorage.
import { User } from '../models/User.js'
import { Team } from '../models/Team.js'
import { Tournament } from '../models/Tournament.js'
import { Community } from '../models/Community.js'
import { CommunityPost } from '../models/CommunityPost.js'
import { getOrCreateReferralCode } from '../services/codes.service.js'

function progressPoints(current, total, maxPoints, unlimited, pointsPerAction) {
  return unlimited ? current * pointsPerAction : Math.floor((Math.min(current, total) / total) * maxPoints)
}

function buildProgress(counts) {
  const items = [
    { id: 'friends', label: 'Amigos', desc: 'Amistades mutuas.', icon: 'users', maxPoints: 75, total: 5, current: counts.friends },
    { id: 'profile', label: 'Datos del perfil', desc: 'Nombre, pais, telefono, etc.', icon: 'user', maxPoints: 25, total: 5, current: 5 },
    { id: 'visual', label: 'Estilo visual', desc: 'Avatar, placa, fondo y marco.', icon: 'palette', maxPoints: 20, total: 4, current: counts.visual, unit: 'items' },
    { id: 'games', label: 'Juegos', desc: 'Selecciona tus juegos.', icon: 'gamepad', maxPoints: 25, total: 5, current: counts.games, unit: 'juegos' },
    { id: 'accounts', label: 'Cuentas conectadas', desc: 'Discord, Twitch, YouTube, Instagram, TikTok.', icon: 'globe', maxPoints: 75, total: 5, current: counts.accounts, unit: 'cuentas' },
    { id: 'bio', label: 'Bio', desc: 'Escribe una bio (+20 caracteres).', icon: 'edit', maxPoints: 10, total: 1, current: counts.bio, unit: 'estado' },
    { id: 'roles', label: 'Roles', desc: 'Roles configurados (organizador, coach, caster).', icon: 'globe', maxPoints: 12, total: 4, current: counts.roles, unit: 'roles' },
    { id: 'university', label: 'Universidad verificada', desc: 'Verifica tu universidad.', icon: 'award', maxPoints: 30, total: 1, current: counts.university, unit: 'estado' },
    { id: 'communities', label: 'Comunidades', desc: 'Unete a comunidades.', icon: 'users', maxPoints: 75, total: 3, current: counts.communities, unit: 'comunidades' },
    { id: 'posts', label: 'Publicaciones', desc: 'Publica contenido. Sigue sumando sin limite.', icon: 'edit', maxPoints: 75, total: 5, current: counts.posts, unit: 'posts', unlimited: true, pointsPerAction: 15 },
    { id: 'interactions', label: 'Interacciones', desc: 'Likes y comentarios recibidos. Sigue sumando sin limite.', icon: 'heart', maxPoints: 75, total: 25, current: counts.interactions, unit: 'interacciones', unlimited: true, pointsPerAction: 3 },
    { id: 'teams', label: 'Equipos', desc: 'Forma parte de equipos. Sigue sumando sin limite.', icon: 'users', maxPoints: 150, total: 3, current: counts.teams, unit: 'equipos', unlimited: true, pointsPerAction: 50 },
    { id: 'leadership', label: 'Liderazgo', desc: 'Capitanea equipos. Sigue sumando sin limite.', icon: 'crown', maxPoints: 150, total: 2, current: counts.leadership, unit: 'capitanias', unlimited: true, pointsPerAction: 75 },
    { id: 'tournaments', label: 'Torneos jugados', desc: 'Participa en torneos. Sigue sumando sin limite.', icon: 'trophy', maxPoints: 500, total: 5, current: counts.tournaments, unit: 'torneos', unlimited: true, pointsPerAction: 100 },
    { id: 'titles', label: 'Titulos de campeon', desc: 'Gana torneos. Sigue sumando sin limite.', icon: 'award', maxPoints: 1250, total: 5, current: counts.titles, unit: 'titulos', unlimited: true, pointsPerAction: 250 },
  ]
  return items.map(item => ({ ...item, points: progressPoints(item.current, item.total, item.maxPoints, item.unlimited, item.pointsPerAction) }))
}

function buildAchievements(counts) {
  return [
    { id: 'profile', title: 'Perfil completo', desc: 'Completa los 5 datos base.', category: 'onboarding', unlocked: true },
    { id: 'style', title: 'Firma gamer', desc: 'Avatar, placa, fondo y marco.', category: 'onboarding', unlocked: counts.visual >= 4 },
    { id: 'bio', title: 'Voz propia', desc: 'Escribe tu bio.', category: 'onboarding', current: counts.bio, total: 1, unit: 'paso', unlocked: counts.bio >= 1 },
    { id: 'multigame', title: 'Multijuego', desc: 'Selecciona 3 juegos.', category: 'onboarding', unlocked: counts.games >= 3 },
    { id: 'social', title: 'Perfil social', desc: 'Conecta 3 cuentas.', category: 'social', current: Math.min(counts.accounts, 3), total: 3, unlocked: counts.accounts >= 3 },
    { id: 'discord', title: 'Discord listo', desc: 'Vincula Discord.', category: 'social', unlocked: counts.discord },
    { id: 'verified-account', title: 'Cuenta verificada', desc: 'Verifica tu universidad.', category: 'social', unlocked: counts.university >= 1 },
    { id: 'first-friend', title: 'Primer amigo', desc: '1 amistad mutua.', category: 'social', unlocked: counts.friends >= 1 },
    { id: 'network', title: 'Red activa', desc: '5 amistades mutuas.', category: 'social', current: Math.min(counts.friends, 5), total: 5, unlocked: counts.friends >= 5 },
    { id: 'first-team', title: 'Primer equipo', desc: 'Unete a un equipo.', category: 'team', current: Math.min(counts.teams, 1), total: 1, unlocked: counts.teams >= 1 },
    { id: 'captain', title: 'Capitan', desc: 'Lidera un equipo.', category: 'team', unlocked: counts.leadership >= 1 },
    { id: 'community', title: 'Miembro activo', desc: 'Unete a una comunidad.', category: 'community', unlocked: counts.communities >= 1 },
    { id: 'creator', title: 'Creador', desc: 'Publica 3 posts.', category: 'community', current: Math.min(counts.posts, 3), total: 3, unlocked: counts.posts >= 3 },
    { id: 'popular', title: 'Popular', desc: 'Recibe 10 likes.', category: 'community', current: Math.min(counts.likes, 10), total: 10, unlocked: counts.likes >= 10 },
    { id: 'debut', title: 'Debut', desc: 'Juega tu primer torneo.', category: 'competitive', current: Math.min(counts.tournaments, 1), total: 1, unlocked: counts.tournaments >= 1 },
    { id: 'veteran', title: 'Veterano', desc: 'Juega 5 torneos.', category: 'competitive', current: Math.min(counts.tournaments, 5), total: 5, unlocked: counts.tournaments >= 5 },
    { id: 'first-title', title: 'Primera corona', desc: 'Gana un torneo.', category: 'competitive', current: Math.min(counts.titles, 1), total: 1, unlocked: counts.titles >= 1 },
    { id: 'dynasty', title: 'Dinastia', desc: 'Gana 5 torneos.', category: 'competitive', current: Math.min(counts.titles, 5), total: 5, unlocked: counts.titles >= 5 },
  ]
}

function referralStatus(user) {
  if (user.plan && user.plan !== 'Free') return 'pro'
  if (user.emailVerified) return 'verified'
  return 'registered'
}

export async function getRewards(req, res, next) {
  try {
    const userId = req.user._id
    const user = await User.findById(userId).lean()

    const referralCode = await getOrCreateReferralCode(user)

    const teams = await Team.find({ $or: [{ members: userId }, { leader: userId }] }).select('_id leader').lean()
    const teamIds = teams.map(t => t._id)
    const leadershipCount = teams.filter(t => String(t.leader) === String(userId)).length

    const [communitiesCount, posts, tournamentsCount, referredUsers] = await Promise.all([
      Community.countDocuments({ members: userId }),
      CommunityPost.find({ author: userId }).select('likes comments').lean(),
      teamIds.length ? Tournament.countDocuments({ 'registrations.team': { $in: teamIds } }) : 0,
      User.find({ referredBy: userId }).select('nick createdAt plan emailVerified').sort({ createdAt: -1 }).lean(),
    ])
    // Campeonatos del jugador (User.titles, los otorga tournamentTitles.service.js).
    // Antes se comparaba Tournament.winner (un nombre) contra ids de equipo: nunca coincidia.
    const titlesCount = (user.titles || []).filter(title => title.placement === 1).length

    const likesReceived = posts.reduce((sum, p) => sum + (p.likes?.length || 0), 0)
    const commentsReceived = posts.reduce((sum, p) => sum + (p.comments?.length || 0), 0)

    const accountsConnected = [
      Boolean(user.discord?.id),
      Boolean(user.social?.twitch),
      Boolean(user.social?.youtube),
      Boolean(user.social?.instagram),
      Boolean(user.social?.tiktok),
    ].filter(Boolean).length

    const visualScore = [
      Boolean(user.avatar),
      Boolean(user.activeFrame),
      Boolean(user.activeBg || user.activeCustomBg),
      Boolean(user.activeBadge),
    ].filter(Boolean).length

    // Amigos: la lista real de amistades (User.friends); si la cuenta viene
    // del sistema de seguimiento, cuenta tambien los seguimientos mutuos.
    const followerIds = new Set((user.followers || []).map(id => String(id)))
    const mutualFollows = (user.following || []).filter(id => followerIds.has(String(id))).length
    const mutualFriends = Math.max((user.friends || []).length, mutualFollows)

    const counts = {
      friends: mutualFriends,
      visual: visualScore,
      games: Math.min(user.games?.length || 0, 5),
      accounts: accountsConnected,
      discord: Boolean(user.discord?.id),
      bio: (user.bio || '').trim().length >= 20 ? 1 : 0,
      roles: Math.min(user.roles?.length || 0, 4),
      university: user.university?.verificationStatus === 'verified' ? 1 : 0,
      communities: Math.min(communitiesCount, 3),
      posts: posts.length,
      interactions: likesReceived + commentsReceived,
      likes: likesReceived,
      teams: teamIds.length,
      leadership: leadershipCount,
      tournaments: tournamentsCount,
      titles: titlesCount,
    }

    const progress = buildProgress(counts)
    const achievements = buildAchievements(counts)

    res.json({
      referralCode,
      stats: { friends: counts.friends, titles: counts.titles, tournaments: counts.tournaments },
      progress,
      achievements,
      unlockedAchievements: achievements.filter(a => a.unlocked).length,
      referrals: referredUsers.map(r => ({
        id: String(r._id), nick: r.nick,
        status: referralStatus(r),
        joined: new Date(r.createdAt).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' }),
      })),
    })
  } catch (error) { next(error) }
}
