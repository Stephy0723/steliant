import { useState, useEffect } from 'react'
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom'
import PageHeader from '../../components/PageHeader/PageHeader.jsx'
import Badge from '../../components/Badge/Badge.jsx'
import Button from '../../components/Button/Button.jsx'
import GGLoader from '../../components/GGLoader/GGLoader.jsx'
import { FEATURED_NEWS, getArticlesByOrganizer, getNewsArticleBySlug, getOrganizerBySlug } from '../../data/news.js'
import { GlitchGangText } from '../../components/GlitchText/GlitchText.jsx'
import { api } from '../../lib/api.js'
import './NewsArticle.css'

export default function NewsArticle() {
  const { slug } = useParams()
  const navigate = useNavigate()
  const [article, setArticle] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    api(`/news/${slug}`)
      .then(data => {
        if (data && data.title) {
          const norm = {
            ...data,
            image: data.cover || data.image || '',
            tag: data.category || 'general',
            date: data.date || (data.createdAt ? new Date(data.createdAt).toLocaleDateString('es-DO', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'),
            readTime: data.readingTime ? `${data.readingTime} min` : '5 min',
            color: data.color || '#00E676',
            paragraphs: data.paragraphs || (data.body ? data.body.split('\n').filter(Boolean) : []),
            organizer: data.organizer || null,
          }
          setArticle(norm)
        } else {
          setArticle(getNewsArticleBySlug(slug) || null)
        }
      })
      .catch(() => {
        setArticle(getNewsArticleBySlug(slug) || null)
      })
      .finally(() => {
        setLoading(false)
      })
  }, [slug])

  // Clics en enlaces y compartidos reales (los ve el admin en /admin/noticias).
  const track = (kind) => {
    if (article?._id) api(`/news/${article._id}/track`, { method: 'POST', body: { kind } }).catch(() => {})
  }
  const share = async () => {
    const url = window.location.href
    try {
      if (navigator.share) await navigator.share({ title: article.title, url })
      else await navigator.clipboard?.writeText(url)
      track('share')
    } catch { /* cancelado por el usuario */ }
  }

  if (loading) {
    return <div className="gg-page gg-news-article-page" style={{ textAlign: 'center', padding: '100px 0' }}><GGLoader label="Sincronizando articulo" size="sm" /></div>
  }

  if (!article) return <Navigate to="/noticias" replace />

  const organizer = getOrganizerBySlug(article.organizer)
  const related = getArticlesByOrganizer(article.organizer).filter(item => item.slug !== article.slug).slice(0, 3)

  return (
    <div className="gg-page gg-news-article-page">
      <PageHeader title="Noticias" sub={organizer?.label || 'Cobertura editorial'}>
        <div className="gg-news-article-page__actions">
          <Button variant="ghost" onClick={() => navigate('/noticias')}>Volver</Button>
          {organizer && (
            <Link to={`/noticias/organizador/${organizer.slug}`} className="gg-news-article-page__organizer">
              {organizer.name}
            </Link>
          )}
        </div>
      </PageHeader>

      <article className="gg-news-article">
        <div className="gg-news-article__hero" style={{ '--accent': article.color }}>
          <img src={article.image} alt={article.title} className="gg-news-article__image" />
          <div className="gg-news-article__overlay" />
          <div className="gg-news-article__hero-content">
            <div className="gg-news-article__hero-badges">
              <Badge variant="accent">{article.tag}</Badge>
              {organizer && <Link to={`/noticias/organizador/${organizer.slug}`} className="gg-news-article__chip">{organizer.name}</Link>}
            </div>
            <span className="gg-news-article__category">{article.category}</span>
            <h1><GlitchGangText>{article.title}</GlitchGangText></h1>
            <p>{article.excerpt}</p>
            <div className="gg-news-article__meta">
              <span>{article.author}</span>
              <span>•</span>
              <span>{article.date}</span>
              <span>•</span>
              <span>{article.readTime}</span>
            </div>
          </div>
        </div>

        <div className="gg-news-article__layout">
          <div className="gg-news-article__body">
            <p className="gg-news-article__lede">{article.body}</p>
            {article.paragraphs.map((paragraph, index) => (
              <p key={index}>{paragraph}</p>
            ))}
            {article._id && (
              <div className="gg-news-article__extras">
                {(article.links || []).filter(l => l?.url).map((l, i) => (
                  <a key={i} href={l.url} target="_blank" rel="noopener noreferrer" className="gg-news-article__panel-link" onClick={() => track('click')}>
                    {l.label || l.url}
                  </a>
                ))}
                <Button variant="ghost" onClick={share}>Compartir</Button>
              </div>
            )}
          </div>

          <aside className="gg-news-article__sidebar">
            {organizer && (
              <div className="gg-news-article__panel">
                <h3>{organizer.name}</h3>
                <p>{organizer.description}</p>
                <Link to={`/noticias/organizador/${organizer.slug}`} className="gg-news-article__panel-link">
                  Ver página del organizador
                </Link>
              </div>
            )}

            <div className="gg-news-article__panel">
              <h3>Relacionadas</h3>
              <div className="gg-news-article__related">
                {related.length > 0 ? related.map((item) => (
                  <button key={item.slug} className="gg-news-article__related-item" onClick={() => navigate(`/noticias/${item.slug}`)}>
                    <img src={item.image} alt={item.title} />
                    <div>
                      <strong><GlitchGangText>{item.title}</GlitchGangText></strong>
                      <span>{item.date}</span>
                    </div>
                  </button>
                )) : (
                  <button className="gg-news-article__related-item" onClick={() => navigate(`/noticias/${FEATURED_NEWS.slug}`)}>
                    <img src={FEATURED_NEWS.image} alt={FEATURED_NEWS.title} />
                    <div>
                      <strong><GlitchGangText>{FEATURED_NEWS.title}</GlitchGangText></strong>
                      <span>{FEATURED_NEWS.date}</span>
                    </div>
                  </button>
                )}
              </div>
            </div>
          </aside>
        </div>
      </article>
    </div>
  )
}

