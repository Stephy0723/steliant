import { useEffect, useRef, useState } from 'react'
import { useParams, useNavigate, useLocation } from 'react-router-dom'
import { motion } from 'framer-motion'
import { useAuth } from '../../context/AuthContext.jsx'
import { getPaymentByTournament } from '../../lib/paymentsStore.js'
import { paymentsApi } from '../../lib/serverApi.js'
import { api } from '../../lib/api.js'
import PaymentTicket from '../../components/PaymentTicket/PaymentTicket.jsx'
import PaymentMethods from '../../components/PaymentMethods/PaymentMethods.jsx'
import TournamentDataConsent from '../../components/TournamentDataConsent/TournamentDataConsent.jsx'
import { isMobileLegends } from '../../../../shared/matchStats.mjs'
import { Icon } from '../../components/icons/Icons.jsx'
import { toast } from '../../lib/toast.js'
import './TournamentCheckout.css'

function mapApiTournament(raw, fallbackId) {
  if (!raw) return null
  return {
    id: raw.publicId || raw.tournamentCode || raw._id || fallbackId,
    _id: raw._id || '',
    publicId: raw.publicId || '',
    name: raw.title || raw.name || 'Torneo',
    title: raw.title || raw.name || 'Torneo',
    game: raw.game || '',
    color: raw.primaryColor || '#00E676',
    date: raw.date ? new Date(raw.date).toLocaleDateString('es-DO', { day: 'numeric', month: 'short', year: 'numeric' }) : 'Por definir',
    prize: raw.prizePool || 0,
    entryFee: raw.entryFee || 0,
    filled: raw.registrations?.length || raw.currentSlots || 0,
    slots: raw.maxSlots || 0,
  }
}

export default function TournamentCheckout() {
  const { id } = useParams()
  const navigate = useNavigate()
  const location = useLocation()
  const { user } = useAuth()
  const search = new URLSearchParams(location.search)
  const selectedTeamId = location.state?.teamId || search.get('teamId') || ''
  const [remoteTour, setRemoteTour] = useState(() => mapApiTournament(location.state?.tournament, id))
  const [loadingTour, setLoadingTour] = useState(!location.state?.tournament)
  const [method, setMethod] = useState('card')
  const [loading, setLoading] = useState(false)
  const [payment, setPayment] = useState(() => getPaymentByTournament(id))
  const [agree, setAgree] = useState(false)
  const [dataConsent, setDataConsent] = useState(false)
  const registeredRef = useRef(false)

  useEffect(() => {
    let alive = true
    setDataConsent(false)
    setAgree(false)
    registeredRef.current = false
    setPayment(getPaymentByTournament(id))
    setLoadingTour(true)
    api(`/tournaments/${id}`)
      .then(data => {
        if (!alive) return
        setRemoteTour(mapApiTournament(data?.tournament || data, id))
      })
      .catch(() => {
        if (alive) setRemoteTour(null)
      })
      .finally(() => {
        if (alive) setLoadingTour(false)
      })
    return () => { alive = false }
  }, [id])

  const tour = remoteTour
  const tournamentKey = tour?.publicId || tour?.id || id
  const fee = Number(tour?.entryFee || 0)
  const serviceFee = Math.round(fee * 0.08 * 100) / 100
  const total = fee + serviceFee
  const mlbbTournament = isMobileLegends(tour?.game)
  const consentRequired = mlbbTournament && !dataConsent

  const registerOnce = async () => {
    if (consentRequired) throw new Error('Acepta el envío de capturas a Google para inscribir el equipo.')
    if (registeredRef.current) return
    await api(`/tournaments/${tournamentKey}/register`, { method: 'POST', body: { teamId: selectedTeamId, dataConsent: mlbbTournament && dataConsent } })
    registeredRef.current = true
  }

  const payTransfer = async (event) => {
    event.preventDefault()
    if (!agree || !tour || loadingTour || consentRequired) return
    setLoading(true)
    try {
      const data = await paymentsApi.checkout({
        concept: `Inscripcion torneo: ${tour.name}`,
        tournamentId: tournamentKey,
        teamId: selectedTeamId,
        amount: total,
        currency: 'USD',
        method,
        kind: 'tournament',
      })
      if (data?.order?.status !== 'paid') {
        toast(data?.message || 'Orden creada. Falta confirmar el pago con el proveedor.', 'info', { title: 'Pago pendiente' })
        return
      }
      await registerOnce()
      setPayment(data.order)
      toast(`Pago confirmado para ${tour.name}`, 'success', { title: 'Pago confirmado', sound: 'register' })
    } catch (error) {
      toast(error?.message || 'No se pudo iniciar el pago real', 'error', { title: 'Pago no procesado' })
    } finally {
      setLoading(false)
    }
  }

  const handlePaid = async (order) => {
    try {
      await registerOnce()
      setPayment(order)
      toast(`Pago confirmado para ${tour.name}`, 'success', { title: 'Pago confirmado', sound: 'register' })
    } catch (error) {
      setPayment(order)
      toast(error?.message || 'Pago confirmado, pero no se pudo registrar el equipo.', 'error', { title: 'Inscripcion pendiente' })
    }
  }

  const emailReceipt = async () => {
    if (!payment?.id) return
    try {
      const res = await paymentsApi.emailReceipt(payment.id)
      toast(`Comprobante enviado a ${res?.email || user?.email || 'tu correo'}`, 'success', { title: 'Correo enviado' })
    } catch (error) {
      toast(error?.message || 'No se pudo enviar el comprobante', 'error')
    }
  }

  if (loadingTour && !tour) {
    return <div className="gg-page gg-tco"><p>Cargando torneo...</p></div>
  }

  if (!tour) {
    return (
      <div className="gg-page gg-tco">
        <p>Torneo no encontrado.</p>
        <button className="gg-tco__btn" onClick={() => navigate('/torneos')}>Volver</button>
      </div>
    )
  }

  if (payment) {
    return (
      <div className="gg-page gg-tco gg-tco--success">
        <motion.div className="gg-tco__success-head" initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
          <div className="gg-tco__check">{Icon.check}</div>
          <h1>Inscripcion confirmada</h1>
          <p>Tu pago quedo registrado. Guarda este comprobante: valida tu entrada al torneo.</p>
        </motion.div>

        <PaymentTicket payment={payment} tournament={tour} />

        <div className="gg-tco__success-actions">
          <button className="gg-tco__btn gg-tco__btn--primary" onClick={() => window.print()}>{Icon.printer} Descargar / Imprimir</button>
          <button className="gg-tco__btn" onClick={emailReceipt}>{Icon.send} Reenviar al correo</button>
          <button className="gg-tco__btn" onClick={() => navigate('/mis-pagos')}>{Icon.fileText} Mis comprobantes</button>
          <button className="gg-tco__btn gg-tco__btn--primary" onClick={() => navigate(`/torneos/${tournamentKey}/bienvenida`, { state: { teamId: selectedTeamId, teamName: tour?.name } })}>{Icon.trophy} Ver mi bienvenida al torneo</button>
          <button className="gg-tco__btn" onClick={() => navigate(`/torneos/${tournamentKey}`)}>{Icon.chevronRight} Ir al torneo</button>
        </div>
      </div>
    )
  }

  return (
    <div className="gg-page gg-tco">
      <button className="gg-tco__back" onClick={() => navigate(`/torneos/${tournamentKey}`)}>{Icon.x} Volver al torneo</button>

      <div className="gg-tco__layout">
        <motion.div className="gg-tco__main" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
          <h1>Inscripcion al torneo</h1>
          <p className="gg-tco__sub">Completa el pago para asegurar tu plaza en <b>{tour.name}</b>.</p>

          <h3 className="gg-tco__h">Metodo de pago</h3>
          <PaymentMethods
            value={method}
            onChange={setMethod}
            amount={total}
            user={user}
            reference={`TOR-${tournamentKey}-${user?.nick || 'YOU'}`}
            checkoutBody={{
              concept: `Inscripcion torneo: ${tour.name}`,
              tournamentId: tournamentKey,
              teamId: selectedTeamId,
              amount: total,
              currency: 'USD',
              method,
              kind: 'tournament',
            }}
            onPaid={handlePaid}
            beforeCreateOrder={() => {
              if (loadingTour || !tour || !agree || consentRequired) {
                throw new Error('Acepta las condiciones y el consentimiento requerido antes de pagar.')
              }
            }}
            onPayError={(error) => {
              if (error) toast(String(error), 'error', { title: 'Pago no procesado' })
            }}
            payDisabled={!agree || consentRequired || loadingTour}
          />

          <form className="gg-tco__form" onSubmit={method === 'transfer' ? payTransfer : event => event.preventDefault()}>
            {mlbbTournament && <TournamentDataConsent checked={dataConsent} onChange={setDataConsent} />}
            <label className="gg-tco__agree">
              <input type="checkbox" checked={agree} onChange={event => setAgree(event.target.checked)} />
              <span>Acepto los terminos del torneo y la politica de pagos. La cuota no es reembolsable salvo cancelacion del evento.</span>
            </label>

            {method === 'transfer' && (
              <button type="submit" className="gg-tco__pay" disabled={loading || loadingTour || !agree || consentRequired}>
                {loading ? <>{Icon.bolt} Procesando...</> : <>{Icon.lock} Pagar ${total}</>}
              </button>
            )}
            <p className="gg-tco__disclaimer">{Icon.lock} El pago debe confirmarse con el proveedor configurado en backend.</p>
          </form>
        </motion.div>

        <aside className="gg-tco__summary">
          <div className="gg-tco__sum-card" style={{ '--tc': tour.color }}>
            <div className="gg-tco__sum-banner"><span className="gg-tco__sum-game">{tour.game}</span></div>
            <h4>{tour.name}</h4>
            <div className="gg-tco__sum-meta">
              <span>{Icon.calendar} {tour.date}</span>
              <span>{Icon.trophy} ${tour.prize} en premios</span>
              <span>{Icon.users} {tour.filled}/{tour.slots} equipos</span>
            </div>
            <div className="gg-tco__sum-rows">
              <div><span>Cuota de inscripcion</span><b>${fee}</b></div>
              <div><span>Cargo por servicio (8%)</span><b>${serviceFee}</b></div>
              <div className="gg-tco__sum-total"><span>Total</span><b>${total}</b></div>
            </div>
          </div>
          <p className="gg-tco__secure">{Icon.shield} Transaccion cifrada - Comprobante validable</p>
        </aside>
      </div>
    </div>
  )
}

