import { User } from '../models/User.js'

const SOCIAL_PLATFORMS = ['twitch', 'youtube', 'tiktok', 'instagram']

/**
 * GET /api/users/creators — directorio público de creadores (usuarios con
 * el rol 'creator' ya aprobado), opcionalmente filtrado por ?game=<id>.
 * Solo expone lo que existe de verdad: no hay tracking de seguidores/en vivo
 * en la app, así que esos campos no se inventan.
 */
export async function getPublicCreators(req, res, next) {
  try {
    const game = String(req.query.game || '').trim()
    const filter = { roles: 'creator' }
    if (game) filter.games = game

    const users = await User.find(filter)
      .select('nick avatar bio social games')
      .limit(60)
      .lean()

    const creators = users.map(u => ({
      id: String(u._id),
      nick: u.nick,
      avatar: u.avatar,
      bio: u.bio || '',
      games: u.games || [],
      socials: Object.fromEntries(
        SOCIAL_PLATFORMS.map(platform => [platform, {
          connected: Boolean(u.social?.[platform]),
          username: u.social?.[platform] || '',
        }]),
      ),
    }))

    res.json({ creators })
  } catch (err) { next(err) }
}
