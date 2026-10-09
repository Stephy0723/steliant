import { useAuth } from '../context/AuthContext.jsx'
import PanelShell from '../components/PanelShell/PanelShell.jsx'
import { Icon } from '../components/icons/Icons.jsx'

export default function CreatorLayout() {
  const { user } = useAuth()

  const sections = [
    {
      section: 'Estudio',
      items: [
        { path: '/creador',              label: 'Resumen',     icon: Icon.dashboard, end: true },
        { path: '/creador/contenido',    label: 'Contenido',   icon: Icon.tv },
        { path: '/creador/analiticas',   label: 'Analíticas',  icon: Icon.chartBar },
        { path: '/creador/monetizacion', label: 'Monetización',icon: Icon.creditCard },
        { path: '/creador/perfil',       label: 'Perfil profesional', icon: Icon.edit },
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
      brand={{ name: 'GlitchGang', hq: 'Creator Studio' }}
      accent="#9146FF"
      title="Estudio de Creador"
      roleLabel="Creator"
      sections={sections}
      user={{
        nick: user?.nick || '',
        avatar: user?.avatar || '/demos/steliant-esports/avatar-default.svg',
        sub: 'Creador',
      }}
    />
  )
}

