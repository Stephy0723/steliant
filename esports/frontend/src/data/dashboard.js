// Datos de ejemplo para el dashboard
export const KPIS = [
  { key: 'winrate',  label: 'Win rate',        value: '68%',    delta: '▲ 4.2% esta semana', down: false },
  { key: 'ranking',  label: 'Ranking global',  value: '#1,204', delta: '▲ 86 posiciones',    down: false },
  { key: 'matches',  label: 'Partidas',         value: '342',    delta: '▲ 12 hoy',           down: false },
  { key: 'earnings', label: 'Ganancias',        value: '$1,820', delta: '▼ 3% vs mes',        down: true  },
]

export const CHART_DATA = [40, 62, 48, 80, 58, 90, 72]
export const CHART_DAYS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom']

export const RECENT_MATCHES = [
  { id: 1, vs: 'Team Volt',    meta: 'Ranked · hace 2h',  result: '+24', win: true  },
  { id: 2, vs: 'Nyx Esports',  meta: 'Torneo · hace 5h',  result: '+31', win: true  },
  { id: 3, vs: 'Cipher Clan',  meta: 'Ranked · ayer',     result: '−18', win: false },
  { id: 4, vs: 'Phantom',      meta: 'Scrim · ayer',      result: '+12', win: true  },
  { id: 5, vs: 'Zero Latency', meta: 'Ranked · hace 2d',  result: '−9',  win: false },
]

