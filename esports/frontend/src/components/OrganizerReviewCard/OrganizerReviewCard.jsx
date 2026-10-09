import { useEffect, useState } from 'react'
import { Icon } from '../icons/Icons.jsx'
import { api } from '../../lib/api.js'
import './OrganizerReviewCard.css'

// Calificar al organizador de un torneo ya finalizado -- solo lo puede hacer
// un equipo que de verdad jugo ese torneo (el backend lo vuelve a validar).
// Pedido de Stephanie para el directorio de Organizadores del Centro de
// Marcas. Ver BACKEND-PENDIENTE.md #brand-organizador-reputacion.
export default function OrganizerReviewCard({ organizerId, tournamentId, team }) {
  const [existing, setExisting] = useState(null)
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(false)
  const [rating, setRating] = useState(0)
  const [hoverRating, setHoverRating] = useState(0)
  const [comment, setComment] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    let alive = true
    setLoading(true)
    api(`/organizers/${organizerId}/reviews/mine?tournamentId=${tournamentId}&teamId=${team.id}`)
      .then(data => {
        if (!alive) return
        setExisting(data?.review || null)
        if (data?.review) {
          setRating(data.review.rating)
          setComment(data.review.comment || '')
        }
      })
      .catch(() => {})
      .finally(() => { if (alive) setLoading(false) })
    return () => { alive = false }
  }, [organizerId, tournamentId, team.id])

  const submit = async () => {
    if (!rating) { setError('Selecciona de 1 a 5 estrellas.'); return }
    setSaving(true)
    setError('')
    try {
      const { review } = await api(`/organizers/${organizerId}/reviews`, {
        method: 'POST',
        body: { tournamentId, teamId: team.id, rating, comment },
      })
      setExisting(review)
      setEditing(false)
    } catch (err) {
      setError(err?.message || 'No se pudo enviar la calificación.')
    } finally {
      setSaving(false)
    }
  }

  if (loading) return null

  if (existing && !editing) {
    return (
      <div className="gg-org-review gg-org-review--done">
        <div className="gg-org-review__stars">
          {[1, 2, 3, 4, 5].map(n => (
            <span key={n} className={n <= existing.rating ? 'on' : ''}>{Icon.star}</span>
          ))}
        </div>
        <p>Calificaste este torneo con {existing.rating}/5{existing.comment ? `: "${existing.comment}"` : '.'}</p>
        <button type="button" className="gg-org-review__edit" onClick={() => setEditing(true)}>Editar</button>
      </div>
    )
  }

  return (
    <div className="gg-org-review">
      <p className="gg-org-review__title">{Icon.star} ¿Cómo estuvo la organización de este torneo?</p>
      <div className="gg-org-review__picker">
        {[1, 2, 3, 4, 5].map(n => (
          <button
            key={n}
            type="button"
            className={n <= (hoverRating || rating) ? 'on' : ''}
            onMouseEnter={() => setHoverRating(n)}
            onMouseLeave={() => setHoverRating(0)}
            onClick={() => setRating(n)}
            aria-label={`${n} estrellas`}
          >
            {Icon.star}
          </button>
        ))}
      </div>
      <textarea
        rows={2}
        maxLength={800}
        value={comment}
        onChange={e => setComment(e.target.value)}
        placeholder="Opcional: contá cómo fue el check-in, la comunicación, el bracket..."
      />
      {error && <p className="gg-org-review__error">{error}</p>}
      <div className="gg-org-review__actions">
        <button type="button" className="gg-org-review__submit" disabled={saving} onClick={submit}>
          {saving ? 'Enviando...' : existing ? 'Guardar cambios' : 'Enviar calificación'}
        </button>
        {existing && <button type="button" className="gg-org-review__cancel" onClick={() => setEditing(false)}>Cancelar</button>}
      </div>
    </div>
  )
}

