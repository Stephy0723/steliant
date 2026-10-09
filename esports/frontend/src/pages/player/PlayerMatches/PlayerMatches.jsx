import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { Icon } from '../../../components/icons/Icons.jsx'
import GGLoader from '../../../components/GGLoader/GGLoader.jsx'
import { api } from '../../../lib/api.js'
import TeamMatchups from '../../../components/TeamMatchups/TeamMatchups.jsx'
import './PlayerMatches.css'

const ACTIVE_TEAM_KEY = 'gg-active-team-id'

function teamIdOf(team) {
  return String(team?._id || team?.id || team?.publicCode || team?.tag || '')
}

function rememberActiveTeam(team) {
  const id = teamIdOf(team)
  if (!id) return
  try {
    localStorage.setItem(ACTIVE_TEAM_KEY, id)
  } catch {}
}

export default function PlayerMatches() {
  const [team, setTeam] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let alive = true
    api('/teams/mine')
      .then(res => {
        if (!alive) return
        const teams = Array.isArray(res) ? res : Array.isArray(res?.teams) ? res.teams : []
        let stored = ''
        try {
          stored = localStorage.getItem(ACTIVE_TEAM_KEY) || ''
        } catch {}
        const selected = teams.find(item => teamIdOf(item) === stored) || teams[0] || null
        setTeam(selected)
        if (selected) rememberActiveTeam(selected)
      })
      .catch(() => { if (alive) setTeam(null) })
      .finally(() => { if (alive) setLoading(false) })
    return () => { alive = false }
  }, [])

  return (
    <div className="pp-page plm-page">
      <motion.div className="plm-head" initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
        <span className="plm-eyebrow">{Icon.target} Partidas</span>
        <h1>Tu proximo enfrentamiento</h1>
        <p>Rival, horario, formato y check-in de tu equipo activo en cada torneo.</p>
      </motion.div>

      {loading ? (
        <GGLoader label="Sincronizando enfrentamientos" size="sm" />
      ) : (
        <TeamMatchups team={team} />
      )}
    </div>
  )
}

