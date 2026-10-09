import { useState } from 'react'
import PageHeader from '../../components/PageHeader/PageHeader.jsx'
import Tabs from '../../components/Tabs/Tabs.jsx'
import Badge from '../../components/Badge/Badge.jsx'
import { Icon } from '../../components/icons/Icons.jsx'
import { usePoints } from '../../context/PointsContext.jsx'
import { POINT_LEVELS } from '../../data/rewards.js'
import './Rewards.css'

const TABS = [
  { id:'progress', label:'Progreso' },
  { id:'achievements', label:'Logros' },
  { id:'referrals', label:'Referidos' },
]

const STATUS = {
  registered:'Registrado',
  verified:'Verificado',
  pro:'Cuenta activa',
}

const CATEGORY_LABELS = {
  onboarding:'Onboarding',
  social:'Social',
  team:'Equipos',
  community:'Comunidad',
  competitive:'Competitivo',
}

export default function Rewards() {
  const points = usePoints()
  const [tab, setTab] = useState('progress')
  const [copied, setCopied] = useState(false)
  const nextMin = points.nextLevel?.min || points.profilePoints
  const levelProgress = points.nextLevel
    ? Math.min(100, ((points.profilePoints - points.level.min) / (nextMin - points.level.min)) * 100)
    : 100
  const refLink = points.referralCode ? `https://glitchgang.gg/register?ref=${points.referralCode}` : ''

  const copy = () => {
    navigator.clipboard?.writeText(refLink)
    setCopied(true)
    setTimeout(() => setCopied(false), 1600)
  }

  if (!points.loaded) {
    return <div className="gg-page gg-rewards"><PageHeader title="Progreso y logros" /></div>
  }

  return (
    <div className="gg-page gg-rewards">
      <PageHeader title="Progreso y logros" sub="Tu perfil crece automaticamente con tus acciones verificadas dentro de GlitchGang." />

      <section className={`gg-rw-hero gg-rw-rank-${Math.min(points.level.intensity, 7)}`} style={{ '--rank-color':points.level.color, '--rank-accent':points.level.accent, '--rank-glow':points.level.glow }}>
        <div>
          <span className="gg-rw-overline">Puntos de perfil</span>
          <strong className="gg-rw-score">{points.profilePoints.toLocaleString()}</strong>
          <h2 style={{ color:points.level.color }}>{points.level.name}</h2>
          <p>{(points.nextLevel.min - points.profilePoints).toLocaleString()} para {points.nextLevel.name}</p>
        </div>
        <div className="gg-rw-hero__stats">
          <div><b>{points.profilePoints}</b><span>Puntos</span></div>
          <div><b>{points.stats.friends}</b><span>Amigos</span></div>
          <div><b>{points.stats.titles}</b><span>Titulos</span></div>
          <div><b>{points.stats.tournaments}</b><span>Torneos</span></div>
        </div>
        <div className="gg-rw-progress"><span style={{ width:`${levelProgress}%` }} /></div>
        <small>Los puntos se calculan automaticamente segun tus acciones dentro de GlitchGang: completar el perfil, conectar cuentas, jugar, publicar y competir.</small>
      </section>

      <Tabs tabs={TABS} value={tab} onChange={setTab} />

      {tab === 'progress' && (
        <>
          <div className="gg-rw-section-head">
            <h3>Como se ganan los puntos</h3>
            <p>Desglose automatico por acciones dentro de la plataforma</p>
          </div>
          <div className="gg-rw-progress-grid">
            {points.progress.map(item => {
              const percentage = Math.min(100, Math.round((item.current / item.total) * 100))
              return (
                <article className="gg-rw-progress-card" key={item.id}>
                  <span className="gg-rw-progress-card__icon">{Icon[item.icon] || Icon.star}</span>
                  <div className="gg-rw-progress-card__body">
                    <div className="gg-rw-progress-card__title">
                      <b>{item.label}</b>
                      <strong>{item.points}{item.unlimited ? '+' : `/${item.maxPoints}`} pts</strong>
                    </div>
                    <p>{item.desc}</p>
                    <div className="gg-rw-progress-card__meta">
                      <span>{item.current}/{item.total} {item.unit || item.label.toLowerCase()}{item.unlimited ? ' · sin limite' : ''}</span>
                      <b>{percentage}%</b>
                    </div>
                    <div className="gg-rw-mini-progress"><span style={{ width:`${percentage}%` }} /></div>
                  </div>
                </article>
              )
            })}
          </div>
        </>
      )}

      {tab === 'achievements' && (
        <>
          <div className="gg-rw-section-head">
            <h3>{points.achievements.length} logros desbloqueables</h3>
            <p>{points.unlockedAchievements}/{points.achievements.length} desbloqueados</p>
          </div>
          <div className="gg-rw-achievement-grid">
            {points.achievements.map(item => (
              <article className={`gg-rw-achievement ${item.unlocked ? 'unlocked' : ''}`} key={item.id}>
                <span className="gg-rw-achievement__icon">{item.unlocked ? Icon.check : Icon.award}</span>
                <div>
                  <Badge variant={item.unlocked ? 'accent' : 'muted'}>{item.unlocked ? 'Desbloqueado' : 'En progreso'}</Badge>
                  <h4>{item.title}</h4>
                  <p>{item.desc}</p>
                  {!item.unlocked && <small>{item.current}/{item.total} {item.unit}</small>}
                  <em>{CATEGORY_LABELS[item.category]}</em>
                </div>
              </article>
            ))}
          </div>
        </>
      )}

      {tab === 'referrals' && (
        <div className="gg-rw-ref-layout">
          <section className="gg-rw-card">
            <h3>Invita a otros competidores</h3>
            <p className="gg-rw-copy">Comparte tu enlace. Cuando alguien se registre con tu código, aparece aquí automáticamente.</p>
            <div className="gg-rw-link"><span>{refLink}</span><button onClick={copy}>{copied ? 'Copiado' : 'Copiar'}</button></div>
          </section>
          <section className="gg-rw-card">
            <h3>Referidos registrados</h3>
            <div className="gg-rw-stack">
              {points.referrals.map(ref => (
                <div className="gg-rw-ref" key={ref.id}>
                  <div><b>{ref.nick}</b><span>Se unió el {ref.joined}</span></div>
                  <Badge variant={['verified', 'pro'].includes(ref.status) ? 'accent' : 'muted'}>{STATUS[ref.status]}</Badge>
                </div>
              ))}
              {points.referrals.length === 0 && <p className="gg-rw-copy">Todavía nadie se ha registrado con tu código.</p>}
            </div>
          </section>
        </div>
      )}

      <section className="gg-rw-levels">
        {POINT_LEVELS.map(level => (
          <div className={points.level.id === level.id ? 'active' : ''} key={level.id}>
            <span style={{ background:level.color }} />
            <b>{level.name}</b>
            <small>{level.min.toLocaleString()} pts</small>
          </div>
        ))}
        <div className={`gg-rw-levels__infinite ${points.level.id.startsWith('eclipse-') ? 'active' : ''}`}>
          <span />
          <b>Eclipse ∞</b>
          <small>Rangos ilimitados</small>
        </div>
      </section>
    </div>
  )
}

