import { useEffect, useState } from 'react'
import { useAuth } from '../context/AuthContext.jsx'
import PanelShell from '../components/PanelShell/PanelShell.jsx'
import { Icon } from '../components/icons/Icons.jsx'
import { getMyBrand } from '../lib/brandApi.js'

const TIER_LABEL = { platinum: 'Platino', gold: 'Oro', silver: 'Plata' }

export default function BrandLayout() {
  const { user } = useAuth()
  const [brand,  setBrand]  = useState(null)
  const [unread, setUnread] = useState(0)

  useEffect(() => {
    getMyBrand()
      .then(data => { setBrand(data.brand); setUnread(data.unreadReports || 0) })
      .catch(() => {})
  }, [])

  const isOro     = ['gold', 'platinum'].includes(brand?.tier)
  const isPlatino = brand?.tier === 'platinum'

  const sections = [
    {
      section: 'Marca',
      items: [
        { path: '/marca',          label: 'Resumen',  icon: Icon.dashboard, end: true },
        { path: '/marca/mi-marca', label: 'Mi Marca', icon: Icon.user },
        { path: '/marca/organizadores', label: 'Organizadores', icon: Icon.trophy },
        ...(isOro ? [
          { path: '/marca/campanas',      label: 'Campañas',      icon: Icon.bolt },
          { path: '/marca/inventario',    label: 'Inventario',    icon: Icon.layoutGrid },
          { path: '/marca/creatividades', label: 'Creatividades', icon: Icon.palette },
        ] : []),
        ...(isPlatino ? [
          { path: '/marca/naming-rights', label: 'Naming Rights', icon: Icon.trophy },
        ] : []),
      ],
    },
    {
      section: 'Comunicación',
      items: [
        {
          path: '/marca/reportes',
          label: unread > 0 ? `Reportes (${unread})` : 'Reportes',
          icon: Icon.fileText,
        },
        { path: '/marca/contacto', label: 'Hablar con el equipo', icon: Icon.chat },
      ],
    },
    {
      section: 'Cuenta',
      items: [
        { path: '/perfil',  label: 'Perfil',  icon: Icon.user },
        { path: '/ajustes', label: 'Ajustes', icon: Icon.gear },
      ],
    },
  ]

  return (
    <PanelShell
      brand={{ name: 'GlitchGang', hq: 'Brand Center' }}
      accent="#F0A500"
      title="Centro de Marca"
      roleLabel={brand?.tier ? TIER_LABEL[brand.tier] : 'Marca'}
      sections={sections}
      user={{
        nick:   brand?.name || user?.nick || 'Marca',
        avatar: null,
        sub:    brand?.industry || 'Centro de marca',
      }}
    />
  )
}

