import { useState } from 'react'
import { Link } from 'react-router-dom'
import AuthLayout from '../../layouts/AuthLayout.jsx'
import Button from '../../components/Button/Button.jsx'
import { Icon } from '../../components/icons/Icons.jsx'
import { useAuth } from '../../context/AuthContext.jsx'
import { api } from '../../lib/api.js'
import { showSocialLinkNotice } from '../../lib/socialLinkNotice.js'
import { WHATSAPP_ENABLED } from '../../config/featureFlags.js'
import '../LinkAccount/LinkAccount.css'

// Flow: user types their WhatsApp number -> the bot sends a code to that number
// -> user types the code here -> verified.
export default function VincularWhatsapp() {
  const { user, refreshUser } = useAuth()
  const verified = Boolean(user?.whatsapp?.verified && user?.whatsapp?.phone)

  const [phone, setPhone] = useState(user?.whatsapp?.phone || (user?.phoneCountryDial && user?.phoneNumber ? `${user.phoneCountryDial}${user.phoneNumber}` : ''))
  const [code, setCode] = useState('')
  const [stage, setStage] = useState('phone') // phone | code | done
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const [devCode, setDevCode] = useState('')
  const [info, setInfo] = useState('')

  const sendCode = async (e) => {
    e?.preventDefault()
    setErr(''); setDevCode(''); setBusy(true)
    try {
      const res = await api('/auth/whatsapp/link/start', { method: 'POST', body: { phone } })
      setStage('code')
      setInfo(res.message || 'Te enviamos un código por WhatsApp.')
      if (res.devCode) setDevCode(res.devCode)
    } catch (e2) {
      showSocialLinkNotice('whatsapp', 'error', {
        message: e2.message || 'No se pudo enviar el codigo de vinculacion.',
      })
      setErr(e2.message || 'No se pudo enviar el código.')
    } finally { setBusy(false) }
  }

  const confirm = async (e) => {
    e?.preventDefault()
    setErr(''); setBusy(true)
    try {
      await api('/auth/whatsapp/link/confirm', { method: 'POST', body: { code } })
      await refreshUser()
      setStage('done')
      showSocialLinkNotice('whatsapp', 'success')
    } catch (e2) {
      showSocialLinkNotice('whatsapp', 'error', {
        message: e2.message || 'Codigo incorrecto.',
      })
      setErr(e2.message || 'Código incorrecto.')
    } finally { setBusy(false) }
  }

  if (!WHATSAPP_ENABLED) {
    return (
      <AuthLayout title="WhatsApp no disponible" sub="Por ahora usamos Discord para los avisos del equipo">
        <div className="gg-link">
          <p className="gg-link__lead">
            La verificación por WhatsApp no está disponible por ahora. <Link to="/conectar-discord">Vincula Discord</Link> en su lugar.
          </p>
        </div>
      </AuthLayout>
    )
  }

  return (
    <AuthLayout title="Verificar WhatsApp" sub="Confirma tu número para recibir avisos de tu equipo">
      <div className="gg-link">
        <p className="gg-link__lead">
          El <b>capitán</b> de cada equipo verifica su WhatsApp para recibir los avisos importantes.
          Para el resto de jugadores es opcional.
        </p>

        <ul className="gg-link__why">
          <li>{Icon.check}<span><b>Recordatorio de partida</b>El bot te avisa 30 min antes de cada juego.</span></li>
          <li>{Icon.check}<span><b>Check-in</b>Te escribe cuando abre el check-in para que no pierdas la ronda.</span></li>
          <li>{Icon.check}<span><b>Contacto del capitán</b>Los organizadores pueden contactarte por cambios de horario.</span></li>
          <li>{Icon.check}<span><b>Solo avisos</b>No se usa para spam ni se comparte con otros jugadores.</span></li>
        </ul>

        {verified || stage === 'done' ? (
          <div className="gg-link__status">
            {Icon.check}
            <span>Verificado: <b>{user?.whatsapp?.phone || phone}</b>. Ya puedes cerrar esta pestaña.</span>
          </div>
        ) : stage === 'phone' ? (
          <form className="gg-link__form" onSubmit={sendCode}>
            <div className="gg-link__field">
              <label htmlFor="wa-phone">Número de WhatsApp (con código de país)</label>
              <input id="wa-phone" inputMode="tel" autoComplete="tel" value={phone} maxLength={20}
                onChange={e => setPhone(e.target.value.slice(0, 20))} placeholder="+1 809 555 1234" />
            </div>
            {err && <p className="gg-link__err">{err}</p>}
            <Button variant="primary" size="lg" type="submit" disabled={busy || phone.replace(/\D/g, '').length < 8 || phone.replace(/\D/g, '').length > 15}>
              {busy ? 'Enviando…' : 'Enviarme el código'}
            </Button>
            <p className="gg-link__hint">Recibirás un código de 6 dígitos en ese número por WhatsApp.</p>
          </form>
        ) : (
          <form className="gg-link__form" onSubmit={confirm}>
            {info && <p className="gg-link__hint">{info}</p>}
            {devCode && <p className="gg-link__devcode">Código (entorno de prueba): {devCode}</p>}
            <div className="gg-link__field">
              <label htmlFor="wa-code">Código recibido</label>
              <input id="wa-code" data-code value={code} onChange={e => setCode(e.target.value.toUpperCase())}
                placeholder="GG-000000" autoComplete="one-time-code" />
            </div>
            {err && <p className="gg-link__err">{err}</p>}
            <Button variant="primary" size="lg" type="submit" disabled={busy || code.replace(/\D/g, '').length < 6}>
              {busy ? 'Verificando…' : 'Verificar'}
            </Button>
            <div className="gg-link__actions">
              <button type="button" className="gg-link__back" onClick={() => { setStage('phone'); setCode(''); setErr('') }}>
                Cambiar número
              </button>
              <button type="button" className="gg-link__back" onClick={sendCode} disabled={busy}>
                Reenviar código
              </button>
            </div>
          </form>
        )}

        <Link className="gg-link__back" to="/equipos">← Volver a equipos</Link>
      </div>
    </AuthLayout>
  )
}

