import { useEffect, useMemo, useState } from 'react'
import { useAuth } from '../context/AuthContext.jsx'
import PanelShell from '../components/PanelShell/PanelShell.jsx'
import { Icon } from '../components/icons/Icons.jsx'
import { api } from '../lib/api.js'
import { teamColor } from '../lib/teamColor.js'

export default function TeamPanelLayout() {
  const { user } = useAuth()
  const [teams, setTeams] = useState([])
  const [selectedTeamId, setSelectedTeamId] = useState(() => localStorage.getItem('gg-active-team-id') || '')
  const [team, setTeam] = useState(null)

  useEffect(() => {
    let alive = true
    api('/teams/mine')
      .then(data => {
        if (!alive) return
        const userId = String(user?._id || user?.id || '')
        const allTeams = Array.isArray(data?.teams) ? data.teams : []
        // Este panel es solo para quien de verdad lidera el equipo -- ser
        // admin del sitio no da acceso aca (usar /admin/equipos para eso).
        const list = allTeams.filter(item => {
          const leaderId = String(item?.leader?._id || item?.leader?.id || item?.leader || '')
          return userId && leaderId && userId === leaderId
        })
        setTeams(list)
        const selected = list.find(item => String(item._id || item.id) === String(selectedTeamId)) || list[0] || null
        setTeam(selected)
        if (selected) {
          const id = String(selected._id || selected.id)
          setSelectedTeamId(id)
          localStorage.setItem('gg-active-team-id', id)
        }
      })
      .catch(() => { if (alive) { setTeams([]); setTeam(null) } })
    return () => { alive = false }
  }, [selectedTeamId])

  // Cambia cuál de mis equipos gestiona el panel. Un solo punto de verdad
  // para esto -- tanto el selector del topbar como el switcher que se ve
  // arriba del contenido (en MyTeamPanel, via outletContext.selectTeam)
  // pasan por acá, así ninguno de los dos queda desincronizado del otro.
  const selectTeamById = (id) => {
    const selected = teams.find(item => String(item._id || item.id) === String(id)) || null
    setSelectedTeamId(id)
    setTeam(selected)
    localStorage.setItem('gg-active-team-id', id)
  }
  const handleSelectTeam = (event) => selectTeamById(event.target.value)

  // El acento de todo el shell (topbar, sidebar, botones primarios via
  // --panel-accent) sale del color de identidad guardado del equipo, no de
  // un verde fijo -- ver [[project-role-studio-and-organizer-reputation]].
  const accent = teamColor(team?.color)
  const rosterSlots = team?.rosterSlots && typeof team.rosterSlots === 'object' ? team.rosterSlots : {}
  const filledSlots = Object.values(rosterSlots).filter(Boolean).length
  const sidebarContext = useMemo(() => {
    if (!team) return null
    return {
      title: team.name || 'Mi equipo',
      subtitle: team.publicCode || team.tag || 'Equipo activo',
      accent,
      items: [
        { label: 'Juego', value: team.game || 'Sin definir' },
        { label: 'Roster', value: `${filledSlots}/${team.maxMembers || 5}` },
        { label: 'Estado', value: team.acceptRequests === false ? 'Cerrado' : 'Reclutando' },
      ],
    }
  }, [team, accent, filledSlots])

  const sections = [
    {
      section: 'Equipo',
      items: [
        { path: '/mi-equipo', label: 'Resumen', icon: Icon.dashboard, end: true },
        { path: '/mi-equipo/roster', label: 'Roster', icon: Icon.users },
        { path: '/mi-equipo/enfrentamiento', label: 'Enfrentamiento', icon: Icon.target },
        { path: '/mi-equipo/planes', label: 'Planes del coach', icon: Icon.fileText },
        { path: '/mi-equipo/web', label: 'Pagina web', icon: Icon.globe },
        { path: '/mi-equipo/patrocinadores', label: 'Patrocinadores', icon: Icon.award },
        { path: '/mi-equipo/reclutar', label: 'Reclutar', icon: Icon.send },
        { path: '/mi-equipo/solicitudes', label: 'Solicitudes', icon: Icon.mail },
        { path: '/mi-equipo/calendario', label: 'Calendario', icon: Icon.calendar },
        { path: '/mi-equipo/retador', label: 'Modo Retador', icon: Icon.target },
      ],
    },
    {
      section: 'Configuracion',
      items: [
        { path: '/mi-equipo/privacidad', label: 'Privacidad', icon: Icon.lock },
        { path: '/equipos', label: 'Directorio', icon: Icon.team },
      ],
    },
  ]

  return (
    <PanelShell
      brand={{ name: 'GlitchGang', hq: 'Team HQ' }}
      accent={accent}
      title={`Panel de Equipo · ${team?.name || 'Mi equipo'}`}
      roleLabel={team?.leader ? 'Capitan' : 'Equipo'}
      sections={sections}
      sidebarContext={sidebarContext}
      topbarExtra={teams.length > 1 ? (
        <select className="gg-pnl-topbar__select" value={selectedTeamId} onChange={handleSelectTeam} aria-label="Cambiar equipo">
          {teams.map(item => (
            <option key={item._id || item.id} value={item._id || item.id}>
              {item.name} [{item.tag || 'GG'}]
            </option>
          ))}
        </select>
      ) : null}
      outletContext={{ team, teams, selectedTeamId, setTeam, selectTeam: selectTeamById }}
      user={{
        nick: team?.name || user?.nick || 'Equipo',
        avatar: team?.logo || user?.avatar || null,
        sub: team?.game || 'Gestion de equipo',
      }}
    />
  )
}

