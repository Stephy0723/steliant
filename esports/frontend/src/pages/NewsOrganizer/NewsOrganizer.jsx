import { Link, Navigate, useNavigate, useParams } from 'react-router-dom'
import PageHeader from '../../components/PageHeader/PageHeader.jsx'
import Badge from '../../components/Badge/Badge.jsx'
import Button from '../../components/Button/Button.jsx'
import { getArticlesByOrganizer, getOrganizerBySlug } from '../../data/news.js'
import { GlitchGangText } from '../../components/GlitchText/GlitchText.jsx'
import './NewsOrganizer.css'

export default function NewsOrganizer() {
  const { slug } = useParams()
  const navigate = useNavigate()
  const organizer = getOrganizerBySlug(slug)

  if (!organizer) return <Navigate to="/noticias" replace />

  const articles = getArticlesByOrganizer(slug)
  const lead = articles[0]
  const secondary = articles.slice(1)

  return (
    <div className="gg-page gg-news-org-page">
      <PageHeader title={organizer.name} sub={organizer.label}>
        <div className="gg-news-org-page__actions">
          <Button variant="ghost" onClick={() => navigate('/noticias')}>Volver a noticias</Button>
        </div>
      </PageHeader>

      <section className="gg-news-org-hero" style={{ '--accent': organizer.accent }}>
        <img src={organizer.image} alt={organizer.name} className="gg-news-org-hero__image" />
        <div className="gg-news-org-hero__overlay" />
        <div className="gg-news-org-hero__content">
          <Badge variant="accent">{organizer.region}</Badge>
          <h1><GlitchGangText>{organizer.label}</GlitchGangText></h1>
          <p>{organizer.description}</p>
          <div className="gg-news-org-hero__stats">
            {organizer.stats.map((item) => (
              <div className="gg-news-org-stat" key={item.label}>
                <strong>{item.value}</strong>
                <span>{item.label}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {lead && (
        <section className="gg-news-org-feature">
          <article className="gg-news-org-feature__main">
            <img src={lead.image} alt={lead.title} />
            <div className="gg-news-org-feature__copy">
              <div className="gg-news-org-feature__top">
                <Badge variant="muted">{lead.tag}</Badge>
                <span>{lead.category}</span>
              </div>
              <h2><GlitchGangText>{lead.title}</GlitchGangText></h2>
              <p>{lead.excerpt}</p>
              <p className="gg-news-org-feature__body">{lead.body}</p>
              <div className="gg-news-org-feature__meta">
                <span>{lead.author}</span>
                <span>•</span>
                <span>{lead.date}</span>
                <span>•</span>
                <span>{lead.readTime}</span>
              </div>
              <div className="gg-news-org-feature__actions">
                <Button onClick={() => navigate(`/noticias/${lead.slug}`)}>Leer más</Button>
              </div>
            </div>
          </article>
        </section>
      )}

      <section className="gg-news-org-grid">
        {secondary.map((article) => (
          <article className="gg-news-org-card" key={article.slug}>
            <img src={article.image} alt={article.title} className="gg-news-org-card__image" />
            <div className="gg-news-org-card__body">
              <div className="gg-news-org-card__head">
                <Badge variant="muted">{article.tag}</Badge>
                <span>{article.category}</span>
              </div>
              <h3><GlitchGangText>{article.title}</GlitchGangText></h3>
              <p>{article.excerpt}</p>
              <div className="gg-news-org-card__meta">
                <span>{article.date}</span>
                <span>•</span>
                <span>{article.readTime}</span>
              </div>
              <div className="gg-news-org-card__actions">
                <Button variant="ghost" onClick={() => navigate(`/noticias/${article.slug}`)}>Leer más</Button>
              </div>
            </div>
          </article>
        ))}
      </section>

      <section className="gg-news-org-footer">
        <Link to="/noticias" className="gg-news-org-footer__back">Ir al panel general de noticias</Link>
      </section>
    </div>
  )
}

