import StaffInvitations from '../../components/StaffInvitations/StaffInvitations.jsx'

export default function StaffInvitationsPage() {
  return (
    <div className="gg-page" style={{ maxWidth: 760, margin: '0 auto', padding: '24px 16px 48px' }}>
      <h1 style={{ fontSize: 24, marginBottom: 6 }}>Invitaciones de staff</h1>
      <p style={{ color: 'var(--text-dim, #8b93a7)', marginBottom: 24 }}>
        Torneos donde un organizador te invito a formar parte del staff. Acepta para aparecer confirmado en la pagina del torneo.
      </p>
      <StaffInvitations />
    </div>
  )
}

