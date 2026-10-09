// Vista global "Resultados por revisar": las partidas que necesitan a un
// humano, de todos los torneos del organizador (el admin las ve en modo
// soporte). Cada torneo tiene además su pestaña "Resultados por revisar".
import ResultsReview from '../../../components/ResultsReview/ResultsReview.jsx'
import './OrganizerResults.css'

export default function OrganizerResults() {
  return (
    <div className="org-results">
      <header>
        <h1>Resultados por revisar</h1>
        <p>Partidas de tus torneos que la lectura automática no pudo validar sola. ⚪ Por confirmar: falta algo (captura borrosa, solo reportó un equipo, IA caída). 🟠 En arbitraje: algo se contradice. Lo más viejo va primero; en rojo, lo que lleva demasiado sin árbitro.</p>
      </header>
      <ResultsReview />
    </div>
  )
}

