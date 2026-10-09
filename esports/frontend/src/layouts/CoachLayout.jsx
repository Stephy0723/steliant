import { useAuth } from '../context/AuthContext.jsx'
import PanelShell from '../components/PanelShell/PanelShell.jsx'
import { Icon } from '../components/icons/Icons.jsx'

export default function CoachLayout() {
  const { user } = useAuth()

  const sections = [
    {
      section: 'Coach HQ',
      items: [
        { path: '/coach',           label: 'Resumen',   icon: Icon.dashboard, end: true },
        { path: '/coach/jugadores', label: 'Mis equipos', icon: Icon.users },
        { path: '/coach/sesiones',  label: 'Sesiones',  icon: Icon.calendar },
        { path: '/coach/analisis',  label: 'Análisis',  icon: Icon.chartBar },
      ],
    },
    {
      section: 'Cuenta',
      items: [
        { path: '/perfil',        label: 'Mi Perfil', icon: Icon.user },
        { path: '/editar-perfil', label: 'Editar',    icon: Icon.edit },
      ],
    },
  ]

  return (
    <PanelShell
      brand={{ name: 'GlitchGang', hq: 'Coach HQ' }}
      accent="#F59E0B"
      title="Panel de Coach"
      roleLabel="Coach"
      sections={sections}
      user={{
        nick: user?.nick || 'Coach',
        avatar: user?.avatar,
        sub: 'Coach',
      }}
    />
  )
}

