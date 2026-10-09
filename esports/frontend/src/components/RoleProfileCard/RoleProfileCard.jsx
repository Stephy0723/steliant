import { useMemo } from 'react'
import PlayerCard, { resolveCardModel } from '../PlayerCard/PlayerCard.jsx'
import { buildRoleCard } from '../../lib/roleCard.js'

// Tarjeta profesional de un rol: la misma tarjeta del perfil de jugador
// (PlayerCard) con el color del rol, 3 datos clave al frente y el perfil
// profesional al reverso (click para girarla). `details` permite previsualizar
// lo que se esta editando antes de guardar.
export default function RoleProfileCard({ role, user, details, width = 300, model, flippable = true, tilt = true }) {
  const built = useMemo(() => buildRoleCard(role, user, details), [role, user, details])
  return (
    <PlayerCard
      model={model || resolveCardModel(user?.activeCardDesign)}
      player={built.player}
      accent={built.accent}
      stats={built.stats}
      status={built.status}
      backBlocks={built.backBlocks}
      width={width}
      flippable={flippable}
      tilt={tilt}
    />
  )
}

