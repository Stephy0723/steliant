import { Link, useParams, useSearchParams } from 'react-router-dom'
import MatchStats from '../../components/MatchStats/MatchStats.jsx'
import './MatchStatsReview.css'

export default function MatchStatsReview() {
  const { id, matchId } = useParams()
  const [query] = useSearchParams()
  return <main className="match-stats-review">
    <Link to={`/torneos/${encodeURIComponent(id)}?tab=bracket`}>← Volver al torneo</Link>
    <h1>Revisar estadísticas de la partida</h1>
    <p>El capitán reporta; el rival o el organizador revisa y confirma. Puedes guardar un borrador y volver después.</p>
    <MatchStats key={`${id}-${matchId}`} tournamentId={id} matchId={matchId} initialGameNumber={query.get('partida')} />
  </main>
}

