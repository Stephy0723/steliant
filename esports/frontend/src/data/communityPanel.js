// ════════════════════════════════════════════════════════════
//  Datos del Panel de Comunidad (gestión para dueños/mods).
//  (Mock data — reemplazar por API real cuando esté disponible)
// ════════════════════════════════════════════════════════════
import { COMMUNITIES } from './communities.js'

// Comunidad que el usuario gestiona (owner / mod / organizador)
export function getManagedCommunity() {
  return COMMUNITIES.find(c => c.joined && ['owner', 'moderator', 'tournament-organizer'].includes(c.userRole))
    || COMMUNITIES.find(c => c.joined)
    || COMMUNITIES[0]
}

export const COMMUNITY_KPIS = [
  { key: 'members', label: 'Miembros',        icon: 'users',  delta: '+312 este mes', down: false },
  { key: 'active',  label: 'Activos (7d)',    icon: 'bolt',   delta: '+8.4%',         down: false },
  { key: 'posts',   label: 'Publicaciones',   icon: 'chat',   delta: '+47',           down: false },
  { key: 'events',  label: 'Eventos activos', icon: 'trophy', delta: '2 en vivo',     down: false },
]

export const GROWTH_TIMELINE = {
  labels: ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun'],
  members: [5200, 5900, 6400, 7100, 7800, 8200],
}

const ROLE_LABEL = { owner: 'Dueño', moderator: 'Moderador', 'tournament-organizer': 'Organizador', creator: 'Creador', member: 'Miembro' }
export { ROLE_LABEL }

export const COMMUNITY_MEMBERS = [
  { id: 1, nick: 'Vexon',        avatar: 'https://i.pravatar.cc/48?img=5',  role: 'tournament-organizer', joined: 'Ene 2024', posts: 312, online: true },
  { id: 2, nick: 'Miraya',       avatar: 'https://i.pravatar.cc/48?img=29', role: 'moderator', joined: 'Feb 2024', posts: 198, online: true },
  { id: 3, nick: 'Brooklyn',     avatar: 'https://i.pravatar.cc/48?img=12', role: 'creator',   joined: 'Mar 2024', posts: 421, online: true },
  { id: 4, nick: 'Krypto99',     avatar: 'https://i.pravatar.cc/48?img=17', role: 'member',    joined: 'Mar 2024', posts: 87,  online: false },
  { id: 5, nick: 'ZeroGravity',  avatar: 'https://i.pravatar.cc/48?img=60', role: 'member',    joined: 'Abr 2024', posts: 54,  online: true },
  { id: 6, nick: 'Solaris',      avatar: 'https://i.pravatar.cc/48?img=33', role: 'member',    joined: 'Abr 2024', posts: 31,  online: false },
  { id: 7, nick: 'Lumen',        avatar: 'https://i.pravatar.cc/48?img=15', role: 'member',    joined: 'May 2024', posts: 19,  online: false },
  { id: 8, nick: 'Riftcat',      avatar: 'https://i.pravatar.cc/48?img=44', role: 'member',    joined: 'May 2024', posts: 12,  online: true },
]

export const COMMUNITY_POSTS = [
  { id: 1, author: 'Vexon',    avatar: 'https://i.pravatar.cc/48?img=5',  pinned: true,  type: 'Anuncio',  text: 'Inscripciones abiertas para el GG Summer Open. Cupos limitados, ¡regístrate ya!', likes: 142, comments: 38, time: 'Hace 2h' },
  { id: 2, author: 'Brooklyn', avatar: 'https://i.pravatar.cc/48?img=12', pinned: false, type: 'Clip',     text: 'Clutch 1v5 en la final de la liga interna 🔥', likes: 318, comments: 64, time: 'Hace 5h' },
  { id: 3, author: 'Miraya',   avatar: 'https://i.pravatar.cc/48?img=29', pinned: false, type: 'Guía',     text: 'Nueva guía de setups de humo para todos los mapas. Link en comentarios.', likes: 96,  comments: 21, time: 'Ayer' },
]

