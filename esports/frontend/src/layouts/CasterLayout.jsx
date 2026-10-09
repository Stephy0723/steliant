import { useAuth } from '../context/AuthContext.jsx'
import PanelShell from '../components/PanelShell/PanelShell.jsx'
import { Icon } from '../components/icons/Icons.jsx'

export default function CasterLayout() {
  const { user } = useAuth()

  const sections = [
    {
      section: 'Caster Studio',
      items: [
        { path: '/caster',          label: 'Resumen',   icon: Icon.dashboard, end: true },
        { path: '/caster/eventos',  label: 'Eventos',   icon: Icon.trophy },
        { path: '/caster/emisiones',label: 'Emisiones', icon: Icon.tv },
        { path: '/caster/stats',    label: 'Estadísticas', icon: Icon.chartBar },
        { path: '/caster/perfil',   label: 'Perfil profesional', icon: Icon.edit },
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
      brand={{ name: 'GlitchGang', hq: 'Caster Studio' }}
      accent="#EF4444"
      title="Panel de Caster"
      roleLabel="Caster"
      sections={sections}
      user={{
        nick: user?.nick || 'Caster',
        avatar: user?.avatar,
        sub: 'Caster',
      }}
    />
  )
}

