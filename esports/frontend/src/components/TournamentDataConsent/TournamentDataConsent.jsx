import './TournamentDataConsent.css'

export default function TournamentDataConsent({ checked, onChange }) {
  return (
    <div className="tournament-data-consent">
      <label>
        <input type="checkbox" required checked={checked} onChange={event => onChange(event.target.checked)} />
        <span>Acepto que las capturas de las partidas de mi equipo, incluidos los nicks, se envíen a Google para leer los resultados automáticamente.</span>
      </label>
      <a href="https://ai.google.dev/gemini-api/terms" target="_blank" rel="noopener noreferrer">Consultar las condiciones de Gemini</a>
    </div>
  )
}

