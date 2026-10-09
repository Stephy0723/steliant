import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { useLang } from '../../i18n/LangContext.jsx'
import { api } from '../../lib/api.js'
import { Icon } from '../../components/icons/Icons.jsx'
import GGLoader from '../../components/GGLoader/GGLoader.jsx'
import './News.css'

const FALLBACK_IMAGE = '/demos/steliant-esports/ImaHorizontal/Valo.jpg'

function normalizeNews(n) {
  return {
    id: n._id,
    slug: n.slug,
    title: n.title,
    excerpt: n.excerpt,
    image: n.image || FALLBACK_IMAGE,
    tag: n.category || 'general',
    author: n.author,
    date: n.createdAt
      ? new Date(n.createdAt).toLocaleDateString('es-DO', { day: '2-digit', month: 'short', year: 'numeric' })
      : '-',
    readTime: '5 min',
    color: '#00E676',
    organizer: null,
    featured: n.featured,
  }
}

export default function News() {
  const { t } = useLang()
  const navigate = useNavigate()
  const [newsItems, setNewsItems] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api('/news?status=publicado&limit=20')
      .then(({ news = [] }) => setNewsItems(news.map(normalizeNews)))
      .catch(() => setNewsItems([]))
      .finally(() => setLoading(false))
  }, [])

  const featured = newsItems.find(n => n.featured) || newsItems[0]
  const grid = newsItems.filter(n => n.id !== featured?.id)

  if (loading) {
    return (
      <div className="gg-page gg-news">
        <header className="gg-news__head">
          <div>
            <span className="gg-news__pre">NEWSROOM</span>
            <h1>{t.side.noticias}</h1>
          </div>
        </header>
        <div className="gg-news__empty" style={{ padding: '60px 0' }}>
          <GGLoader label="Sincronizando noticias" size="sm" />
        </div>
      </div>
    )
  }

  if (newsItems.length === 0) {
    return (
      <div className="gg-page gg-news">
        <header className="gg-news__head">
          <div>
            <span className="gg-news__pre">NEWSROOM</span>
            <h1>{t.side.noticias}</h1>
            <p>Cobertura, análisis y resultados del ecosistema competitivo.</p>
          </div>
        </header>
        <div className="gg-news__empty" style={{ padding: '80px 0' }}>
          {Icon.news}
          <p>No hay noticias publicadas todavía.</p>
          <small>Las noticias aparecerán aquí una vez que sean publicadas por los organizadores.</small>
        </div>
        <aside style={{ display: 'flex', justifyContent: 'center', marginTop: '32px' }}>
          <div className="gg-news__panel gg-news__cta" style={{ maxWidth: 340 }}>
            <b>¿Organizas torneos?</b>
            <p>Publica tus noticias y comunícate con la comunidad desde tu panel.</p>
            <button className="gg-news__cta-btn" onClick={() => navigate('/organizador')}>Ir al panel {Icon.chevronRight}</button>
          </div>
        </aside>
      </div>
    )
  }

  return (
    <div className="gg-page gg-news">
      <header className="gg-news__head">
        <div>
          <span className="gg-news__pre">NEWSROOM</span>
          <h1>{t.side.noticias}</h1>
          <p>Cobertura, análisis y resultados del ecosistema competitivo.</p>
        </div>
      </header>

      <div className="gg-news__layout">
        <div className="gg-news__main">
          {featured && (
            <motion.article
              className="gg-news__feature"
              style={{ '--nc': featured.color }}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              onClick={() => navigate(`/noticias/${featured.slug}`)}
            >
              <div className="gg-news__feature-img" style={{ '--news-img': `url(${featured.image})` }}>
                <span className="gg-news__feature-tag">{featured.tag}</span>
              </div>
              <div className="gg-news__feature-body">
                <h2>{featured.title}</h2>
                <p>{featured.excerpt}</p>
                <div className="gg-news__meta">
                  <span>{featured.author}</span><span>-</span><span>{featured.date}</span><span>-</span><span>{featured.readTime}</span>
                </div>
                <button className="gg-news__read">Leer artículo {Icon.chevronRight}</button>
              </div>
            </motion.article>
          )}

          <div className="gg-news__grid">
            {grid.map((n, i) => (
              <motion.article
                key={n.id}
                className="gg-news__card"
                style={{ '--nc': n.color }}
                initial={{ opacity: 0, y: 14 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.04 }}
                onClick={() => navigate(`/noticias/${n.slug}`)}
              >
                <div className="gg-news__card-img" style={{ '--news-img': `url(${n.image})` }}>
                  <span className="gg-news__card-tag">{n.tag}</span>
                </div>
                <div className="gg-news__card-body">
                  <h3>{n.title}</h3>
                  <p>{n.excerpt}</p>
                  <div className="gg-news__meta"><span>{n.date}</span><span>-</span><span>{n.readTime}</span></div>
                </div>
              </motion.article>
            ))}
            {grid.length === 0 && newsItems.length > 0 && (
              <div className="gg-news__empty">{Icon.news}<p>Sin más noticias todavía.</p></div>
            )}
          </div>
        </div>

        <aside className="gg-news__side">
          <div className="gg-news__panel">
            <div className="gg-news__panel-head">{Icon.bolt} <b>Flash informativo</b></div>
            <div className="gg-news__briefs">
              {newsItems.slice(0, 5).map(b => (
                <div
                  key={b.id}
                  className="gg-news__brief"
                  style={{ '--nc': b.color }}
                  onClick={() => navigate(`/noticias/${b.slug}`)}
                  role="button"
                >
                  <span className="gg-news__brief-dot" />
                  <div>
                    <h4>{b.title}</h4>
                    <small>{b.date}</small>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="gg-news__panel gg-news__cta">
            <b>¿Organizas torneos?</b>
            <p>Publica tus noticias y comunícate con la comunidad desde tu panel.</p>
            <button className="gg-news__cta-btn" onClick={() => navigate('/organizador')}>Ir al panel {Icon.chevronRight}</button>
          </div>
        </aside>
      </div>
    </div>
  )
}

