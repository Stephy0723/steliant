import { useEffect, useMemo, useState } from 'react'
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom'
import { motion } from 'framer-motion'
import { useAuth } from '../../context/AuthContext.jsx'
import { api } from '../../lib/api.js'
import Button from '../../components/Button/Button.jsx'
import TournamentDataConsent from '../../components/TournamentDataConsent/TournamentDataConsent.jsx'
import { Icon } from '../../components/icons/Icons.jsx'
import { toast } from '../../lib/toast.js'
import { getGameArt } from '../../data/organizerTournaments.js'
import { registrationDateState } from '../../lib/registrationWindow.js'
import { gameAccountsApi } from '../../lib/gameAccountsApi.js'
import { isMobileLegends } from '../../../../shared/matchStats.mjs'
import './TournamentRegistration.css'

function mapTournament(raw, fallbackId) {
  if (!raw) return null
  const registrations = Array.isArray(raw.registrations) ? raw.registrations : []
  const art = getGameArt(raw.game || raw.gameCode || raw.category)
  return {
    id: raw.publicId || raw.tournamentCode || raw._id || fallbackId,
    dbId: raw._id || '',
    publicId: raw.publicId || '',
    internalId: raw.tournamentCode || '',
    name: raw.title || raw.name || 'Torneo',
    game: raw.game || '',
    format: String(raw.format || 'single_elimination').replace(/_/g, ' '),
    modality: raw.modality || raw.category || '',
    platform: raw.platform || 'pc',
    status: raw.status || '',
    date: raw.date || '',
    timezone: raw.timezone || 'America/Santo_Domingo',
    registrationStart: raw.registrationWindow?.start || raw.registrationStart || '',
    registrationEnd: raw.registrationWindow?.end || raw.registrationEnd || '',
    lateRegistration: Boolean(raw.lateRegistration),
    entryFee: Number(raw.entryFee || 0),
    prizePool: Number(raw.prizePool || 0),
    maxSlots: Number(raw.maxSlots || raw.slots || 0),
    currentSlots: registrations.length || Number(raw.currentSlots || raw.filled || 0),
    color: raw.primaryColor || raw.color || art.color || '#00E676',
    banner: raw.banner || art.image || '',
    gameLogo: raw.gameLogo || art.logo || '',
  }
}

function normalizeGame(value = '') {
  return String(value).toLowerCase().replace(/[^a-z0-9]+/g, '')
}

function formatDate(value) {
  if (!value) return 'Por definir'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return String(value)
  return date.toLocaleString('es-DO', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

function requiredPlayersForTournament(tournament) {
  const text = `${tournament?.modality || ''} ${tournament?.format || ''}`.toLowerCase()
  const match = text.match(/(\d+)\s*v\s*\d+/)
  if (match) return Math.max(1, Number(match[1]) || 5)
  if (text.includes('solo') || text.includes('1v1') || text.includes('individual')) return 1
  if (text.includes('duo') || text.includes('2v2')) return 2
  if (text.includes('trio') || text.includes('3v3')) return 3
  return 5
}

function playerIdentity(player) {
  return String(player?.id || player?._id || player?.playerCode || player?.userId || '').trim()
}

function slotFilled(slot) {
  if (!slot || typeof slot !== 'object') return false
  return Boolean(slot.nick || slot.name || slot.fullName || slot.id || slot.playerCode || slot.gameId)
}

function validateTeamForTournament(team, tournament) {
  const required = requiredPlayersForTournament(tournament)
  if (!team) return { ok: false, required, filled: 0, checks: [{ ok: false, label: 'Selecciona un equipo.' }] }

  const members = Array.isArray(team.members) ? team.members : []
  const roster = Array.isArray(team.roster) ? team.roster : []
  const slots = team.rosterSlots && typeof team.rosterSlots === 'object' ? team.rosterSlots : {}
  const hasTitularSlots = Object.keys(slots).some(key => key.startsWith('titular-'))
  const titularSlots = Array.from({ length: required }, (_, index) => slots[`titular-${index + 1}`]).filter(slotFilled)
  const players = hasTitularSlots ? titularSlots : (members.length ? members : roster).slice(0, required)
  const memberByIdentity = new Map([...members, ...roster].map(member => [playerIdentity(member), member]).filter(([key]) => key))
  const missingDiscord = []
  const missingProfile = []

  players.forEach((player, index) => {
    const identity = playerIdentity(player)
    const member = memberByIdentity.get(identity) || null
    const name = player?.nick || player?.name || player?.fullName || member?.nick || `Titular ${index + 1}`
    const hasProfile = Boolean(identity || player?.gameId || member?.playerCode)
    const hasDiscord = Boolean(player?.discordId || member?.discord?.id)
    if (!hasProfile) missingProfile.push(name)
    if (!hasDiscord) missingDiscord.push(name)
  })

  const checks = [
    {
      ok: players.length >= required,
      label: players.length >= required
        ? `Roster completo: ${players.length}/${required} titulares.`
        : `Faltan ${required - players.length} jugador(es) titular(es). Este torneo requiere ${required}.`,
    },
    {
      ok: missingProfile.length === 0 && players.length > 0,
      label: missingProfile.length
        ? `Falta validar perfil competitivo de: ${missingProfile.join(', ')}.`
        : 'Perfiles competitivos listos.',
    },
    {
      ok: missingDiscord.length === 0 && players.length > 0,
      label: missingDiscord.length
        ? `Falta Discord vinculado de: ${missingDiscord.join(', ')}.`
        : 'Discord vinculado en todos los titulares.',
    },
  ]

  return { ok: checks.every(check => check.ok), required, filled: players.length, checks }
}

function getRegistrationState({ tournament, user, selectedTeamId, teamValidation }) {
  if (!tournament) return { open: false, label: 'Sin torneo', tone: 'warn', reason: 'No se encontro la informacion del torneo.' }
  if (!user) return { open: false, label: 'Inicia sesion', tone: 'warn', reason: 'Inicia sesion para inscribirte.' }
  if (!selectedTeamId) return { open: false, label: 'Sin equipo', tone: 'warn', reason: 'Selecciona o crea un equipo para continuar.' }
  if (teamValidation && !teamValidation.ok) {
    return { open: false, label: 'Equipo incompleto', tone: 'warn', reason: teamValidation.checks.find(check => !check.ok)?.label || 'Completa y valida el roster antes de inscribirte.' }
  }

  const dateState = registrationDateState({ ...tournament, startsAt: tournament.date })
  const statusOpen = ['open', 'ongoing'].includes(String(tournament.status || ''))
  const isFull = Number(tournament.maxSlots || 0) > 0 && Number(tournament.currentSlots || 0) >= Number(tournament.maxSlots || 0)

  if (isFull) return { open: false, label: 'Lleno', tone: 'warn', reason: 'El torneo ya completo todos sus cupos.' }
  if (!statusOpen) return { open: false, label: 'No publicado', tone: 'warn', reason: 'El organizador debe poner el torneo en Publicado o En vivo.' }
  if (dateState === 'not_open') {
    return { open: false, label: 'Abre pronto', tone: 'warn', reason: `Las inscripciones abren ${formatDate(tournament.registrationStart)}.` }
  }
  if (dateState === 'started') {
    return { open: false, label: 'Ya empezo', tone: 'warn', reason: `El torneo empezo ${formatDate(tournament.date)}. Solo el organizador puede habilitar inscripciones tardias.` }
  }
  if (dateState === 'closed') {
    return { open: false, label: 'Cerrado por fecha', tone: 'warn', reason: `Las inscripciones cerraron ${formatDate(tournament.registrationEnd)}. Solo el organizador puede habilitar inscripciones tardias.` }
  }
  if (dateState === 'late') {
    return { open: true, label: 'Inscripcion tardia', tone: 'ok', reason: 'El organizador habilito inscripciones tardias para este torneo.' }
  }

  return { open: true, label: 'Disponible', tone: 'ok', reason: 'Puedes inscribir tu equipo en este torneo.' }
}

export default function TournamentRegistration() {
  const { id } = useParams()
  const navigate = useNavigate()
  const location = useLocation()
  const { user } = useAuth()
  const [tournament, setTournament] = useState(() => mapTournament(location.state?.tournament, id))
  const [teams, setTeams] = useState([])
  const [selectedTeamId, setSelectedTeamId] = useState(location.state?.teamId || '')
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    let alive = true
    Promise.all([
      api(`/tournaments/${id}`).catch(() => null),
      api('/teams/mine').catch(() => ({ teams: [] })),
    ]).then(([tourRes, teamsRes]) => {
      if (!alive) return
      const rawTour = tourRes?.tournament || tourRes
      const mapped = mapTournament(rawTour, id) || tournament
      const list = Array.isArray(teamsRes?.teams) ? teamsRes.teams : []
      setTournament(mapped)
      setTeams(list)
      setSelectedTeamId(current => {
        if (current && list.some(team => String(team._id || team.id) === String(current))) return current
        const sameGame = list.find(team => normalizeGame(team.game) === normalizeGame(mapped?.game))
        return String((sameGame || list[0])?._id || (sameGame || list[0])?.id || '')
      })
    }).finally(() => {
      if (alive) setLoading(false)
    })
    return () => { alive = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

  const tournamentKey = tournament?.publicId || tournament?.internalId || tournament?.id || id
  const isPaid = Number(tournament?.entryFee || 0) > 0
  const eligibleTeams = useMemo(() => {
    const sameGame = teams.filter(team => normalizeGame(team.game) === normalizeGame(tournament?.game))
    return sameGame.length ? sameGame : teams
  }, [teams, tournament?.game])
  const selectedTeam = eligibleTeams.find(team => String(team._id || team.id) === String(selectedTeamId))
  const teamValidation = validateTeamForTournament(selectedTeam, tournament)
  const registerState = getRegistrationState({ tournament, user, selectedTeamId, teamValidation })

  // Cuenta de Mobile Legends verificada (codigo del correo del juego). Por
  // ahora es recomendacion: avisa quien falta pero no bloquea la inscripcion.
  const mlbbTournament = isMobileLegends(tournament?.game)
  const [dataConsent, setDataConsent] = useState(false)
  useEffect(() => { setDataConsent(false) }, [id])
  const titularUsers = useMemo(() => {
    const slots = selectedTeam?.rosterSlots && typeof selectedTeam.rosterSlots === 'object' ? selectedTeam.rosterSlots : {}
    const required = requiredPlayersForTournament(tournament)
    return Array.from({ length: required }, (_, index) => slots[`titular-${index + 1}`])
      .filter(slot => slotFilled(slot) && /^[a-f\d]{24}$/i.test(String(slot.userId || '')))
      .map(slot => ({ userId: String(slot.userId), nick: slot.nick || slot.name || 'Jugador' }))
  }, [selectedTeam, tournament])
  const titularIdsKey = titularUsers.map(p => p.userId).join(',')
  const [gameAccountStatus, setGameAccountStatus] = useState(null)
  useEffect(() => {
    setGameAccountStatus(null)
    if (!mlbbTournament || !titularIdsKey || !user) return undefined
    let alive = true
    gameAccountsApi.status(titularIdsKey.split(','))
      .then(d => { if (alive) setGameAccountStatus(d.statuses || {}) })
      .catch(() => {})
    return () => { alive = false }
  }, [mlbbTournament, titularIdsKey, user])
  const unverifiedTitulars = gameAccountStatus ? titularUsers.filter(p => !gameAccountStatus[p.userId]?.mlbb?.verified) : []
  const canSubmit = registerState.open

  const handleSubmit = async () => {
    if (!user) return navigate('/login')
    if (!teams.length) return navigate('/equipos', { state: { autoCreate: true } })
    // El servidor exige correo verificado para inscribir (anti cuentas múltiples).
    if (!user.emailVerified) {
      toast('Verifica tu correo para inscribirte. Te llevamos a Ajustes.', 'info')
      return navigate('/ajustes?tab=cuenta')
    }
    if (!canSubmit) {
      toast(registerState.reason, 'info')
      return
    }
    if (mlbbTournament && !dataConsent) {
      toast('Acepta el envío de capturas a Google para inscribir el equipo.', 'info')
      return
    }
    if (isPaid) {
      navigate(`/torneos/${tournamentKey}/pago`, { state: { teamId: selectedTeamId, tournament } })
      return
    }
    setSubmitting(true)
    try {
      await api(`/tournaments/${tournamentKey}/register`, { method: 'POST', body: { teamId: selectedTeamId, dataConsent: mlbbTournament && dataConsent } })
      toast('Equipo inscrito correctamente.', 'success', { sound: 'register' })
      navigate(`/torneos/${tournamentKey}/bienvenida`, { state: { teamId: selectedTeamId, teamName: selectedTeam?.name } })
    } catch (error) {
      toast(error?.message || 'No se pudo inscribir el equipo.', 'error')
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) return <div className="gg-page treg"><p>Cargando inscripcion...</p></div>

  if (!tournament) {
    return (
      <div className="gg-page treg">
        <section className="treg-empty">
          <b>Torneo no encontrado</b>
          <Button variant="ghost" onClick={() => navigate('/torneos')}>Volver a torneos</Button>
        </section>
      </div>
    )
  }

  return (
    <div className="gg-page treg" style={{ '--tr-color': tournament.color }}>
      <motion.section className="treg-hero" initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }}>
        {tournament.banner && <img className="treg-hero__bg" src={tournament.banner} alt="" />}
        <div className="treg-hero__content">
          <button type="button" className="treg-back" onClick={() => navigate(`/torneos/${tournamentKey}`)}>{Icon.x} Volver al torneo</button>
          <div className="treg-hero__main">
            <span className="treg-game-mark">
              {tournament.gameLogo ? <img src={tournament.gameLogo} alt="" /> : (tournament.game || 'GG').slice(0, 3)}
            </span>
            <div>
              <span className="treg-kicker">{Icon.users} Inscripcion oficial</span>
              <h1>{tournament.name}</h1>
              <p>{tournament.game} - {tournament.modality || tournament.format} - {tournament.platform}</p>
            </div>
          </div>
        </div>
        <div className="treg-price">
          <small>Entrada</small>
          <b>{isPaid ? `$${tournament.entryFee}` : 'Gratis'}</b>
        </div>
      </motion.section>

      <div className="treg-grid">
        <motion.section className="treg-panel" initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: .04 }}>
          <div className="treg-panel__head">
            <h2>{Icon.team} Equipo a inscribir</h2>
            <small>{eligibleTeams.length} disponibles</small>
          </div>

          {eligibleTeams.length ? (
            <div className="treg-teams">
              {eligibleTeams.map(team => {
                const teamId = String(team._id || team.id)
                const active = teamId === String(selectedTeamId)
                const validation = validateTeamForTournament(team, tournament)
                return (
                  <button key={teamId} type="button" className={`treg-team${active ? ' is-active' : ''}`} onClick={() => setSelectedTeamId(teamId)}>
                    <span className="treg-team__logo">{team.logo ? <img src={team.logo} alt="" /> : (team.tag || team.name || 'T').slice(0, 2)}</span>
                    <span className="treg-team__body">
                      <b>{team.name}</b>
                      <small>{team.tag || 'GG'} - {team.game || 'Juego sin definir'} - {validation.filled}/{validation.required} titulares</small>
                    </span>
                    <span className={`treg-team__status ${validation.ok ? 'is-ok' : 'is-warn'}`}>{validation.ok ? Icon.check : Icon.alert}</span>
                  </button>
                )
              })}
            </div>
          ) : (
            <div className="treg-empty">
              <b>No tienes equipos disponibles</b>
              <p>Crea un equipo primero para poder inscribirte en torneos. Incluso en torneos 1v1 necesitas un equipo (aunque sea solo tu) con Discord vinculado.</p>
              <Button variant="primary" onClick={() => navigate('/equipos', { state: { autoCreate: true } })}>{Icon.plus} Crear equipo</Button>
            </div>
          )}
        </motion.section>

        <motion.aside className="treg-panel treg-panel--summary" initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: .08 }}>
          <div className="treg-panel__head">
            <h2>{Icon.fileText} Resumen</h2>
            <small>{tournament.currentSlots}/{tournament.maxSlots || '-'}</small>
          </div>
          <dl className="treg-facts">
            <div><dt>Apertura</dt><dd>{formatDate(tournament.registrationStart)}</dd></div>
            <div><dt>Cierre</dt><dd>{formatDate(tournament.registrationEnd)}</dd></div>
            <div><dt>Estado</dt><dd className={registerState.tone === 'ok' ? 'is-ok' : 'is-warn'}>{registerState.label}</dd></div>
            <div><dt>Equipo</dt><dd>{selectedTeam ? `${selectedTeam.name} [${selectedTeam.tag || 'GG'}]` : 'Sin seleccionar'}</dd></div>
          </dl>
          <p className={`treg-state-note ${registerState.tone === 'ok' ? 'is-ok' : 'is-warn'}`}>{registerState.reason}</p>
          <div className="treg-checklist">
            {teamValidation.checks.map((check, index) => (
              <div key={index} className={check.ok ? 'is-ok' : 'is-warn'}>
                <span>{check.ok ? Icon.check : Icon.alert}</span>
                <p>{check.label}</p>
              </div>
            ))}
            {mlbbTournament && gameAccountStatus && titularUsers.length > 0 && (
              <div className={unverifiedTitulars.length ? 'is-info' : 'is-ok'}>
                <span>{unverifiedTitulars.length ? Icon.alert : Icon.check}</span>
                <p>
                  {unverifiedTitulars.length
                    ? <>Recomendado: falta verificar la cuenta de Mobile Legends de {unverifiedTitulars.map(p => p.nick).join(', ')}. Cada jugador lo hace en <Link to={`/ajustes?tab=conexiones&volver=${encodeURIComponent(location.pathname)}`}>Ajustes → Conexiones</Link> y vuelve aquí con un botón.</>
                    : 'Cuentas de Mobile Legends verificadas en todos los titulares.'}
                </p>
              </div>
            )}
          </div>
          {mlbbTournament && <TournamentDataConsent checked={dataConsent} onChange={setDataConsent} />}
          <Button variant="primary" disabled={submitting || !selectedTeamId || (mlbbTournament && !dataConsent)} onClick={handleSubmit}>
            {submitting ? 'Inscribiendo...' : isPaid ? `Continuar a pago - $${tournament.entryFee}` : 'Confirmar inscripcion'}
          </Button>
        </motion.aside>
      </div>
    </div>
  )
}

