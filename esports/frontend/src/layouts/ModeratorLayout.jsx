import { useAuth } from '../context/AuthContext.jsx'
import PanelShell from '../components/PanelShell/PanelShell.jsx'
import { Icon } from '../components/icons/Icons.jsx'

export default function ModeratorLayout() {
  const { user } = useAuth()

  const sections = [
    {
      section: 'Moderacion',
      items: [
        { path: '/moderador', label: 'Resumen', icon: Icon.dashboard, end: true },
        { path: '/moderador/eventos', label: 'Eventos', icon: Icon.trophy },
        { path: '/moderador/arbitraje', label: 'Arbitraje', icon: Icon.shield },
        { path: '/moderador/produccion', label: 'Produccion', icon: Icon.tv },
      ],
    },
    {
      section: 'Cuenta',
      items: [
        { path: '/perfil', label: 'Mi Perfil', icon: Icon.user },
        { path: '/editar-perfil', label: 'Editar', icon: Icon.edit },
      ],
    },
  ]

  return (
    <PanelShell
      brand={{ name: 'GlitchGang', hq: 'Tournament Ops' }}
      accent="#22C55E"
      title="Panel de Moderador"
      roleLabel="Moderador"
      sections={sections}
      user={{
        nick: user?.nick || 'Moderador',
        avatar: user?.avatar,
        sub: 'Moderador de Torneos',
      }}
    />
  )
}

