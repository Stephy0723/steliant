import { useParams, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
const getOrganizerById = () => null
const TOURNAMENTS = []
const flagOf = () => ''
import { Icon } from '../../components/icons/Icons.jsx'
import RoleIdentityCorner from '../../components/RoleIdentityCorner/RoleIdentityCorner.jsx'
import { useAuth } from '../../context/AuthContext.jsx'
import './OrganizerProfile.css'

const STATUS = {
  live:     { label: '● EN VIVO', cls: 'live' },
  upcoming: { label: 'Próximo',   cls: 'up' },
  finished: { label: 'Finalizado', cls: 'fin' },
}

export default function OrganizerProfile() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { user } = useAuth()
  const org = getOrganizerById(id)

  if (!org) {
    return (
      <div className="gg-page gg-op">
        <p>Organizador no encontrado.</p>
        <button className="gg-op__btn" onClick={() => navigate('/torneos')}>← Volver a torneos</button>
      </div>
    )
  }

  const tours = TOURNAMENTS.filter(t => org.tournamentIds.includes(t.id))

  return (
    <div className="gg-page gg-op" style={{ '--oc': org.color }}>
      <button className="gg-op__back" onClick={() => navigate('/torneos')}>{Icon.chevronRight} Volver a torneos</button>

      {/* Hero estilo HUD */}
      <motion.div className="gg-op__hero" initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
        <RoleIdentityCorner role="organizer" profile={org} currentUser={user} />
        <span className="gg-op__corner tl" /><span className="gg-op__corner tr" />
        <span className="gg-op__corner bl" /><span className="gg-op__corner br" />
        <img className="gg-op__avatar" src={org.avatar} alt={org.name} />
        <div className="gg-op__info">
          <div className="gg-op__nameline">
            <h1>{org.name}</h1>
            {org.verified && <span className="gg-op__verif" title="Verificado">{Icon.check}</span>}
          </div>
          <p className="gg-op__role">{flagOf(org.country)} {org.roleLabel}</p>
          <p className="gg-op__bio">{org.bio}</p>
        </div>
        <div className="gg-op__stats">
          <div><b>{org.tournaments}</b><span>torneos</span></div>
          <div><b>{org.players}</b><span>jugadores</span></div>
          <div><b>{tours.length}</b><span>activos</span></div>
        </div>
      </motion.div>

      {/* Redes */}
      <div className="gg-op__socials">
        {org.socials.twitch && <a className="gg-op__social" href={`https://twitch.tv/${org.socials.twitch}`} target="_blank" rel="noreferrer">{Icon.twitch} Twitch</a>}
        {org.socials.discord && <button className="gg-op__social" type="button" disabled>{Icon.discord} Discord</button>}
        {org.socials.youtube && <a className="gg-op__social" href={`https://youtube.com/${org.socials.youtube}`} target="_blank" rel="noreferrer">{Icon.youtube} YouTube</a>}
      </div>

      {/* Noticias de la organización */}
      {org.news?.length > 0 && (
        <>
          <h2 className="gg-op__h">{Icon.news} Noticias de {org.name}</h2>
          <div className="gg-op__news">
            {org.news.map(n => (
              <div key={n.id} className="gg-op__news-item">
                <span className="gg-op__news-tag">{n.tag}</span>
                <div className="gg-op__news-body">
                  <b>{n.title}</b>
                  <small>{n.date}</small>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* Torneos del organizador */}
      <h2 className="gg-op__h">{Icon.trophy} Torneos de {org.name}</h2>
      {tours.length === 0 ? (
        <div className="gg-op__empty">{Icon.calendar}<p>Este organizador no tiene torneos publicados ahora mismo.</p></div>
      ) : (
        <div className="gg-op__grid">
          {tours.map((t, i) => {
            const st = STATUS[t.status] || STATUS.upcoming
            return (
              <motion.button
                key={t.id} className="gg-op__tcard" style={{ '--tc': t.color }}
                initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.06 }}
                onClick={() => navigate(`/torneos/${t.id}`)}
              >
                <div className="gg-op__tcard-top">
                  <span className="gg-op__game">{t.game}</span>
                  <span className={`gg-op__status ${st.cls}`}>{st.label}</span>
                </div>
                <h3>{t.name}</h3>
                <div className="gg-op__tmeta">
                  <span>{Icon.trophy} ${t.prize}</span>
                  <span>{Icon.users} {t.filled}/{t.slots}</span>
                  {t.entryFee > 0 ? <span className="fee">{Icon.creditCard} ${t.entryFee}</span> : <span className="free">Gratis</span>}
                </div>
                <span className="gg-op__view">Ver torneo {Icon.chevronRight}</span>
              </motion.button>
            )
          })}
        </div>
      )}
    </div>
  )
}

