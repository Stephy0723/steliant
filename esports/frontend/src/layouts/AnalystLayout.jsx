import { useAuth } from '../context/AuthContext.jsx'
import PanelShell from '../components/PanelShell/PanelShell.jsx'
import { Icon } from '../components/icons/Icons.jsx'

export default function AnalystLayout() {
  const { user } = useAuth()

  const sections = [
    {
      section: 'Analyst Lab',
      items: [
        { path: '/analista',           label: 'Resumen',    icon: Icon.dashboard, end: true },
        { path: '/analista/reportes',  label: 'Reportes',   icon: Icon.trend },
        { path: '/analista/equipos',   label: 'Equipos',    icon: Icon.team },
        { path: '/analista/torneos',   label: 'Torneos',    icon: Icon.trophy },
        { path: '/analista/perfil',    label: 'Perfil profesional', icon: Icon.edit },
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
      brand={{ name: 'GlitchGang', hq: 'Analyst Lab' }}
      accent="#06B6D4"
      title="Panel de Analista"
      roleLabel="Analista"
      sections={sections}
      user={{
        nick: user?.nick || 'Analista',
        avatar: user?.avatar,
        sub: 'Analista',
      }}
    />
  )
}

