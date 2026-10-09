// Pestañas del panel "Gestionar torneo".
// icon = clave dentro de Icon (se resuelve con Icon[tab.icon]).
// Compartido entre el sidebar contextual (OrganizerLayout) y el panel (Manage).

export const MANAGE_TABS = [
  { key: 'resumen',       label: 'Resumen',        icon: 'dashboard', group: 'General' },
  { key: 'config',        label: 'Configuración',  icon: 'gear',      group: 'General' },
  { key: 'equipos',       label: 'Equipos',        icon: 'users',     group: 'Competición' },
  { key: 'competencia',   label: 'Competencia',    icon: 'layers',    group: 'Competición' },
  { key: 'reglas',        label: 'Reglas / Reglamento', icon: 'fileText', group: 'Competición' },
  { key: 'checkin',       label: 'Check-in',       icon: 'check',     group: 'Competición' },
  { key: 'prizepool',     label: 'Prize Pool',     icon: 'trophy',    group: 'Competición' },
  { key: 'bracket',       label: 'Bracket',        icon: 'award',     group: 'Competición' },
  { key: 'resultados',    label: 'Resultados por revisar', icon: 'shield', group: 'Competición' },
  { key: 'ruleta',        label: 'Ruleta de sorteo', icon: 'target',  group: 'Competición' },
  { key: 'marca',         label: 'Sponsors / Marca', icon: 'palette',   group: 'Identidad' },
  { key: 'colaboradores', label: 'Staff y permisos', icon: 'users',  group: 'Identidad' },
  { key: 'discord',       label: 'Discord',        icon: 'discord',   group: 'Integraciones' },
  { key: 'sala',          label: 'Sala de staff',  icon: 'chat',      group: 'Soporte' },
  { key: 'reportar',      label: 'Reportar',       icon: 'alert',     group: 'Soporte' },
  { key: 'actividad',     label: 'Actividad',      icon: 'clock',     group: 'Soporte' },
]

export const MANAGE_TAB_KEYS = MANAGE_TABS.map(t => t.key)

