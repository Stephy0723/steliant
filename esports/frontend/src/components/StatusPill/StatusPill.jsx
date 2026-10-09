import './StatusPill.css'

const VARIANTS = {
  activo:     'green',
  publicado:  'green',
  live:       'green',
  pagado:     'green',
  pendiente:  'warn',
  upcoming:   'warn',
  borrador:   'warn',
  revisión:   'warn',
  resuelto:   'blue',
  finished:   'muted',
  inactivo:   'muted',
  descartado: 'muted',
  ban:        'red',
  fallido:    'red',
  reembolso:  'orange',
  autorizado: 'green',
  rechazado:  'red',
}

export default function StatusPill({ status }) {
  const variant = VARIANTS[status] || 'muted'
  return <span className={`gg-status-pill gg-status-pill--${variant}`}>{status}</span>
}

