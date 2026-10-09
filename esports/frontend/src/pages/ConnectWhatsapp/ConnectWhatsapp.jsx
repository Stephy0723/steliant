// Página exclusiva de conexión con WhatsApp -- el bot de WhatsApp ya manda
// a este link (whatsapp-bot-crm/src/commands/perfil.js) cuando alguien le
// escribe sin estar vinculado, pero la página nunca había existido. Usa los
// mismos endpoints reales que Ajustes → Conexiones
// (/auth/whatsapp/link/start y DELETE /auth/whatsapp/link).
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { useAuth } from '../../context/AuthContext.jsx'
import { Icon } from '../../components/icons/Icons.jsx'
import { api } from '../../lib/api.js'
import { toast } from '../../lib/toast.js'
import { showSocialLinkNotice } from '../../lib/socialLinkNotice.js'
import { WHATSAPP_ENABLED } from '../../config/featureFlags.js'
import './ConnectWhatsapp.css'

// Simula la conversación real con el bot -- mismos comandos que
// whatsapp-bot-crm/src/commands/ayuda.js, no inventados.
const CHAT = [
  { from: 'you', text: '!vincular ABC123' },
  { from: 'bot', text: '✅ Cuenta vinculada. Ya podés usar todos los comandos.' },
  { from: 'you', text: '!torneos' },
  { from: 'bot', text: '🏆 3 torneos abiertos ahora mismo. Escribe !torneo <id> para ver el detalle.' },
  { from: 'you', text: '!checkin' },
  { from: 'bot', text: '⏱️ Check-in confirmado para tu próxima partida. ¡Nos vemos en el server!' },
]

export default function ConnectWhatsapp() {
  const { user, refreshUser } = useAuth()
  const [busy, setBusy] = useState(false)
  const [link, setLink] = useState(null)
  const [chatStep, setChatStep] = useState(CHAT.length) // ya "reproducido" por defecto en reposo
  const connected = Boolean(user?.whatsapp?.verified && user?.whatsapp?.phone)

  useEffect(() => {
    if (!link || connected) return undefined
    let closed = false
    const checkWhatsapp = async () => {
      const fresh = await refreshUser()
      if (closed) return
      if (fresh?.whatsapp?.verified && fresh?.whatsapp?.phone) {
        setLink(null)
        showSocialLinkNotice('whatsapp', 'success', {
          message: `Tu WhatsApp +${fresh.whatsapp.phone} quedo validado y vinculado correctamente.`,
        })
      }
    }
    const interval = window.setInterval(checkWhatsapp, 3500)
    return () => {
      closed = true
      window.clearInterval(interval)
    }
  }, [link, connected, refreshUser])

  const generate = () => {
    setBusy(true)
    api('/auth/whatsapp/link/start', { method: 'POST' })
      .then(
        (res) => res,
        (err) => {
          showSocialLinkNotice('whatsapp', 'error', {
            message: err.message || 'No se pudo generar el codigo de vinculacion.',
          })
          throw err
        }
      )
      .then(data => { setLink(data); toast('Código generado', 'success') })
      .catch(err => toast(err.message || 'No se pudo generar el código', 'error'))
      .finally(() => setBusy(false))
  }
  const disconnect = () => {
    setBusy(true)
    api('/auth/whatsapp/link', { method: 'DELETE' })
      .then(
        (res) => res,
        (err) => {
          showSocialLinkNotice('whatsapp', 'error', {
            message: err.message || 'No se pudo desconectar WhatsApp.',
          })
          throw err
        }
      )
      .then(() => { setLink(null); toast('WhatsApp desconectado', 'warn') })
      .catch(err => toast(err.message || 'No se pudo desconectar', 'error'))
      .finally(() => setBusy(false))
  }
  const copyCommand = () => {
    navigator.clipboard?.writeText(link.command)
    toast('Comando copiado', 'success')
  }
  const replay = () => { setChatStep(0); CHAT.forEach((_, i) => setTimeout(() => setChatStep(i + 1), 260 + i * 550)) }

  if (!WHATSAPP_ENABLED) {
    return (
      <div className="cw-page">
        <div className="cw-content">
          <p style={{ padding: '48px', textAlign: 'center' }}>
            La conexión con WhatsApp no está disponible por ahora. <Link to="/ajustes?tab=conexiones">Usa Discord en su lugar</Link>.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="cw-page">
      <div className="cw-doodles" />

      <div className="cw-content">
        <motion.div className="cw-hero" initial={{ opacity: 0, y: -16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
          <motion.div
            className="cw-mark"
            initial={{ scale: 0.6, rotate: 14, opacity: 0 }}
            animate={{ scale: 1, rotate: 0, opacity: 1 }}
            transition={{ type: 'spring', stiffness: 220, damping: 14, delay: 0.1 }}
          >
            {Icon.whatsapp}
          </motion.div>
          <span className="cw-eyebrow">GlitchGang × WhatsApp</span>
          <h1>Tu torneo,<br />directo en tu chat</h1>
          <p>Sin apps nuevas, sin dashboards. Vinculás una vez y desde ahí seguís tus partidas, hacés check-in y consultás el bracket por mensaje.</p>
        </motion.div>

        <motion.div className="cw-phone" initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2, duration: 0.5 }}>
          <div className="cw-phone__bar">
            <span className="cw-phone__avatar">{Icon.whatsapp}</span>
            <div><b>GlitchGang Bot</b><small>en línea</small></div>
            <button className="cw-phone__replay" onClick={replay} title="Repetir">{Icon.refresh}</button>
          </div>
          <div className="cw-phone__body">
            <AnimatePresence>
              {CHAT.slice(0, chatStep).map((m, i) => (
                <motion.div
                  key={i}
                  className={`cw-bubble cw-bubble--${m.from}`}
                  initial={{ opacity: 0, y: 10, scale: 0.94 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  transition={{ duration: 0.28 }}
                >
                  {m.text}
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        </motion.div>

        {connected ? (
          <motion.div className="cw-connected" initial={{ opacity: 0, scale: 0.94 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.3 }}>
            <div className="cw-connected__icon">{Icon.check}</div>
            <div className="cw-connected__info">
              <b>Ya estás conectado</b>
              <span>+{user.whatsapp.phone}</span>
            </div>
            <button className="cw-btn cw-btn--ghost" onClick={disconnect} disabled={busy}>{busy ? 'Desconectando...' : 'Desconectar'}</button>
          </motion.div>
        ) : (
          <motion.div className="cw-steps" initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35 }}>
            <div className="cw-step">
              <span className="cw-step__num">1</span>
              <p>Generá tu código de vinculación desde acá.</p>
            </div>
            <div className="cw-step">
              <span className="cw-step__num">2</span>
              <p>Copiá el comando y enviáselo al WhatsApp oficial de GlitchGang.</p>
            </div>
            <div className="cw-step">
              <span className="cw-step__num">3</span>
              <p>Listo — desde ahí ya podés usar <code>!torneos</code>, <code>!checkin</code>, <code>!perfil</code>, <code>!bracket</code> y <code>!soporte</code>.</p>
            </div>

            {!link ? (
              <button className="cw-btn cw-btn--primary" onClick={generate} disabled={busy}>
                {Icon.whatsapp} {busy ? 'Generando...' : 'Generar código'}
              </button>
            ) : (
              <div className="cw-command">
                <span>Enviá este comando al WhatsApp oficial de GlitchGang:</span>
                <div className="cw-command__row">
                  <code>{link.command}</code>
                  <button className="cw-btn cw-btn--ghost cw-btn--sm" onClick={copyCommand}>{Icon.copy} Copiar</button>
                </div>
                <small>El código vence en 10 minutos.</small>
              </div>
            )}
          </motion.div>
        )}

        <Link className="cw-back" to="/ajustes">Volver a Ajustes</Link>
      </div>
    </div>
  )
}

