import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { motion } from 'framer-motion'
import { useAuth } from '../../context/AuthContext.jsx'
import { Icon } from '../../components/icons/Icons.jsx'
import { api } from '../../lib/api.js'
import { toast } from '../../lib/toast.js'
import { GAME_BY_ID, normalizeGameId } from '../../data/games.js'
import './JoinTeam.css'
import { teamColor } from '../../lib/teamColor.js'
import { joinBlockers } from '../../lib/teamEligibility.js'

const idOf = value => String(value?._id || value?.id || value || '')

function gameOf(raw) {
  if (!raw) return null
  const game = GAME_BY_ID[normalizeGameId(raw, '')]
  return game ? { name: game.name, logo: game.images?.logo || null } : { name: String(raw), logo: null }
}

function TeamMark({ team, size = 'lg' }) {
  const initials = (team?.tag || team?.name || '?').slice(0, 3).toUpperCase()
  return (
    <span className={`jt-mark jt-mark--${size}`}>
      {team?.logo ? <img src={team.logo} alt="" /> : <b>{initials}</b>}
    </span>
  )
}

export default function JoinTeam() {
  const { code } = useParams()
  const { user, refreshUser } = useAuth()
  const navigate = useNavigate()
  const [team, setTeam] = useState(null)
  const [currentTeam, setCurrentTeam] = useState(null)
  const [loadError, setLoadError] = useState('')
  const [busy, setBusy] = useState(false)
  const userId = idOf(user)
  const currentTeamId = idOf(user?.team || user?.teamId)
  const alreadyOnATeam = Boolean(
    user?.team || user?.teamId || user?.teamCode || user?.captainTeam || user?.ownedTeam ||
    (Array.isArray(user?.teams) && user.teams.length > 0)
  )

  useEffect(() => {
    let alive = true
    api(`/teams/invite/${code}`)
      .then(data => { if (alive) setTeam(data) })
      .catch(err => { if (alive) setLoadError(err.message || 'No se encontro ese codigo de invitacion.') })
    return () => { alive = false }
  }, [code])

  // Nombre y logo del equipo en el que ya esta, para el aviso de "sal primero".
  useEffect(() => {
    if (!currentTeamId) { setCurrentTeam(null); return undefined }
    let alive = true
    api(`/teams/${currentTeamId}`)
      .then(data => { if (alive) setCurrentTeam(data?.team || data) })
      .catch(() => { if (alive) setCurrentTeam(null) })
    return () => { alive = false }
  }, [currentTeamId])

  const joinTeam = () => {
    setBusy(true)
    api('/teams/join', { method: 'POST', body: { inviteCode: code } })
      .then(res => {
        toast(res.message || `Te uniste a ${team?.name || 'el equipo'}`, 'success')
        refreshUser()
        navigate(`/jugador/equipos?perfilEquipo=${encodeURIComponent(team?.publicCode || idOf(team))}`)
      })
      .catch(err => toast(err.message || 'No se pudo unir al equipo', 'error'))
      .finally(() => setBusy(false))
  }

  const members = team?.members?.length || 0
  const max = team?.maxMembers || 0
  const game = gameOf(team?.game)
  const leader = team?.leader && typeof team.leader === 'object' ? team.leader : null
  const teamKey = team?.publicCode || idOf(team)
  const isMember = Boolean(team && userId && (
    idOf(team.leader) === userId || (team.members || []).some(m => idOf(m) === userId)
  ))
  const full = Boolean(team && max && members >= max)
  const closed = Boolean(team && team.acceptRequests === false)
  const university = Boolean(team?.university?.isUniversityTeam)
  const currentTeamKey = currentTeam?.publicCode || currentTeamId
  // Reglas del equipo (femenino, país, región). La universidad tiene su propio aviso abajo.
  const ruleBlockers = team && user ? joinBlockers(team, user).filter(b => b.key !== 'university') : []

  let body
  if (isMember) {
    body = (
      <div className="jt-state jt-state--ok">
        <i>{Icon.check}</i>
        <div><b>Ya eres parte de {team.name}</b><small>No tienes que hacer nada mas.</small></div>
        <Link className="jt-btn jt-btn--ghost" to={`/jugador/equipos?perfilEquipo=${encodeURIComponent(teamKey)}`}>Mi perfil en el equipo {Icon.chevronRight}</Link>
      </div>
    )
  } else if (alreadyOnATeam) {
    body = (
      <div className="jt-state jt-state--warn">
        <div className="jt-state__head">
          <i>{Icon.alert}</i>
          <div>
            <b>Ya estas en un equipo</b>
            <small>Solo puedes estar en un equipo a la vez. Sal del actual y vuelve a abrir este link para unirte.</small>
          </div>
        </div>
        {currentTeam && (
          <div className="jt-current">
            <TeamMark team={currentTeam} size="sm" />
            <div>
              <span className="jt-label">Tu equipo actual</span>
              <b>{currentTeam.tag ? `[${currentTeam.tag}] ` : ''}{currentTeam.name}</b>
            </div>
          </div>
        )}
        <div className="jt-row">
          <Link className="jt-btn jt-btn--ghost" to={currentTeamKey ? `/equipos/${currentTeamKey}` : '/jugador/equipos'}>
            Ir a mi equipo {Icon.chevronRight}
          </Link>
        </div>
      </div>
    )
  } else if (ruleBlockers.length) {
    body = (
      <div className="jt-state jt-state--warn">
        {ruleBlockers.map(b => (
          <div className="jt-state__head" key={b.key}>
            <i>{Icon.lock}</i>
            <div><b>{b.title}</b><small>{b.detail}</small></div>
          </div>
        ))}
        <div className="jt-row">
          <Link className="jt-btn jt-btn--ghost" to={`/equipos/${teamKey}`}>Ver perfil del equipo {Icon.chevronRight}</Link>
        </div>
      </div>
    )
  } else if (university || closed || full) {
    body = (
      <div className="jt-state jt-state--warn">
        <div className="jt-state__head">
          <i>{Icon.lock}</i>
          <div>
            <b>{full ? 'El roster esta completo' : university ? 'Equipo universitario' : 'No acepta miembros ahora'}</b>
            <small>
              {full
                ? 'Este equipo ya llego a su limite de jugadores.'
                : university
                  ? 'Este equipo no acepta link directo: pide al líder que te invite por tu nick, o solicita unirte desde su perfil.'
                  : 'El lider cerro las entradas por ahora. Puedes ver su perfil mientras tanto.'}
            </small>
          </div>
        </div>
        <div className="jt-row">
          <Link className="jt-btn jt-btn--ghost" to={`/equipos/${teamKey}`}>Ver perfil del equipo {Icon.chevronRight}</Link>
        </div>
      </div>
    )
  } else {
    body = (
      <div className="jt-steps">
        <p className="jt-note">Acepta la invitacion para unirte y completar tu perfil de jugador en este equipo.</p>
        <button className="jt-btn jt-btn--primary" onClick={joinTeam} disabled={busy}>
          {busy ? 'Uniendote...' : <>Unirme a {team.name} {Icon.chevronRight}</>}
        </button>
      </div>
    )
  }

  return (
    <main className="jt-page">
      <motion.section
        className="jt-card"
        style={team ? { '--jt-tone': teamColor(team.color) } : undefined}
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
      >
        <span className="jt-eyebrow">// Invitacion de equipo</span>

        {!team && (
          <div className="jt-empty">
            <i>{loadError ? Icon.alert : Icon.users}</i>
            <b>{loadError ? 'Invitacion no valida' : 'Cargando invitacion...'}</b>
            {loadError && <small>{loadError}</small>}
            {loadError && <Link className="jt-btn jt-btn--ghost" to="/equipos">Explorar equipos</Link>}
          </div>
        )}

        {team && (
          <>
            <header className="jt-hero">
              <div className="jt-banner" style={team.banner ? { backgroundImage: `url(${team.banner})` } : undefined} />
              <TeamMark team={team} />
              <div className="jt-hero__id">
                <span className="jt-label">Te invitaron a</span>
                <h1 data-text={team.name}>{team.name}</h1>
                {team.slogan && <p>{team.slogan}</p>}
              </div>
            </header>

            <dl className="jt-stats">
              {team.tag && <div><dt>Tag</dt><dd>[{team.tag}]</dd></div>}
              <div>
                <dt>Roster</dt>
                <dd>{members}{max ? `/${max}` : ''}</dd>
                {max > 0 && <span className="jt-meter"><span style={{ width: `${Math.min(100, (members / max) * 100)}%` }} /></span>}
              </div>
              {game && (
                <div>
                  <dt>Juego</dt>
                  <dd className="jt-game">{game.logo && <img src={game.logo} alt="" />}{game.name}</dd>
                </div>
              )}
              {leader?.nick && (
                <div>
                  <dt>Lider</dt>
                  <dd className="jt-game">
                    {leader.avatar && !String(leader.avatar).includes('avatar-default') && <img className="jt-av" src={leader.avatar} alt="" />}
                    {leader.nick}
                  </dd>
                </div>
              )}
            </dl>

            {body}
          </>
        )}
      </motion.section>
    </main>
  )
}

