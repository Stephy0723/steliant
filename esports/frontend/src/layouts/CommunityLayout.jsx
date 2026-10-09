import { useState, useEffect, useCallback, useMemo } from 'react'
import { useAuth } from '../context/AuthContext.jsx'
import PanelShell from '../components/PanelShell/PanelShell.jsx'
import { Icon } from '../components/icons/Icons.jsx'
import { getMyCommunities } from '../lib/communitiesApi.js'

export default function CommunityLayout() {
  const { user } = useAuth()
  const [communities, setCommunities] = useState([])
  const [loading, setLoading] = useState(true)

  const refetch = useCallback(() => {
    setLoading(true)
    getMyCommunities()
      .then(d => setCommunities(Array.isArray(d.communities) ? d.communities : []))
      .catch(() => setCommunities([]))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => { refetch() }, [refetch])

  const managed = communities[0] || null

  const sidebarContext = useMemo(() => {
    if (!managed) return null
    return {
      title: managed.name,
      subtitle: managed.publicId || 'Comunidad activa',
      accent: managed.color || managed.accent || '#1E9DE3',
      logo: managed.logo || '',
      banner: managed.banner || managed.poster || '',
      items: [
        { label: 'Region', value: managed.region || 'Sin definir' },
        { label: 'Juegos', value: (managed.games || []).join(', ') || 'Sin juegos' },
        { label: 'Miembros', value: String(managed.members || 0) },
        { label: 'Slug', value: managed.slug || 'Pendiente' },
      ],
    }
  }, [managed])

  const sections = [
    {
      section: 'Comunidad',
      items: [
        { path: '/mi-comunidad', label: 'Resumen', icon: Icon.dashboard, end: true },
        { path: '/mi-comunidad/operaciones', label: 'Operaciones', icon: Icon.bolt },
        { path: '/mi-comunidad/miembros', label: 'Miembros', icon: Icon.users },
        { path: '/mi-comunidad/publicaciones', label: 'Publicaciones', icon: Icon.chat },
        { path: '/mi-comunidad/web', label: 'Presencia web', icon: Icon.globe },
        { path: '/mi-comunidad/crear', label: 'Nueva comunidad', icon: Icon.plus },
      ],
    },
    {
      section: 'Cuenta',
      items: [
        { path: '/perfil', label: 'Mi Perfil', icon: Icon.user },
        { path: '/ajustes', label: 'Ajustes', icon: Icon.gear },
      ],
    },
  ]

  return (
    <PanelShell
      brand={{ name: 'GlitchGang', hq: 'Community Hub' }}
      accent={managed?.accent || managed?.color || '#1E9DE3'}
      title={`Panel de Comunidad${managed ? ` · ${managed.name}` : ''}`}
      roleLabel={managed?.region || 'Dueno'}
      sections={sections}
      sidebarContext={sidebarContext}
      user={{
        nick: user?.nick || 'Usuario',
        avatar: user?.avatar || '/demos/steliant-esports/avatar-default.svg',
        sub: managed?.name || 'Sin comunidad',
      }}
      outletContext={{ communities, managed, loading, refetch }}
    />
  )
}

