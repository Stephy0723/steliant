import { useEffect, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { motion } from 'framer-motion'
import { useAuth } from '../../context/AuthContext.jsx'
import { Icon } from '../../components/icons/Icons.jsx'
import { api } from '../../lib/api.js'
import { toast } from '../../lib/toast.js'
import { showSocialLinkNotice } from '../../lib/socialLinkNotice.js'
import { hasTeamDraft, teamDraftUserKey, returnToTeamDraft } from '../../lib/teamEligibility.js'
import './ConnectDiscord.css'

export default function ConnectDiscord() {
  const { user, refreshUser } = useAuth()
  const navigate = useNavigate()
  const [search] = useSearchParams()
  const [busy, setBusy] = useState(false)
  const [linkStatus, setLinkStatus] = useState('idle')
  const [linkMessage, setLinkMessage] = useState('')
  const connected = Boolean(user?.discord?.id)
  const token = search.get('token') || ''
  // Viene del wizard de Crear equipo con un borrador guardado.
  const teamDraft = Boolean(user) && hasTeamDraft(teamDraftUserKey(user))

  useEffect(() => {
    const result = search.get('discord')
    if (!result) return

    if (result === 'linked') {
      showSocialLinkNotice('discord', 'success')
    } else if (result === 'already-linked') {
      showSocialLinkNotice('discord', 'error', {
        message: 'Esa cuenta de Discord ya esta vinculada a otra cuenta de GlitchGang.',
      })
    } else if (result === 'error') {
      showSocialLinkNotice('discord', 'error')
    }

    navigate('/conectar-discord', { replace: true })
  }, [navigate, search])

  useEffect(() => {
    if (!token || connected) return

    if (!user) {
      sessionStorage.setItem('gg-discord-link-token', token)
      setLinkStatus('needs-auth')
      setLinkMessage('Inicia sesion o crea tu cuenta para completar la vinculacion.')
      return
    }

    setLinkStatus('linking')
    setLinkMessage('Confirmando el enlace privado del bot.')
    api('/auth/discord/link/confirm', { method: 'POST', body: { token } })
      .then(() => {
        setLinkStatus('done')
        setLinkMessage('Tu cuenta de Discord quedo vinculada.')
        showSocialLinkNotice('discord', 'success')
        refreshUser()
        navigate('/conectar-discord', { replace: true })
      })
      .catch(err => {
        setLinkStatus('error')
        setLinkMessage(err.message || 'No se pudo vincular. El enlace pudo expirar.')
        showSocialLinkNotice('discord', 'error', {
          message: err.message || 'No se pudo vincular. El enlace pudo expirar.',
        })
      })
  }, [token, user, connected, refreshUser, navigate])

  const connect = async () => {
    if (!user) {
      navigate('/login')
      return
    }

    setBusy(true)
    try {
      const { url } = await api('/auth/discord/link-url', {
        method: 'POST',
        body: { returnTo: '/conectar-discord' },
      })
      window.location.href = url
    } catch (err) {
      showSocialLinkNotice('discord', 'error', {
        message: err.message || 'No se pudo iniciar la conexion con Discord.',
      })
      setBusy(false)
    }
  }

  const disconnect = () => {
    setBusy(true)
    api('/auth/discord/link', { method: 'DELETE' })
      .then(() => {
        toast('Discord desconectado', 'warn')
        refreshUser()
      })
      .catch(err => {
        showSocialLinkNotice('discord', 'error', {
          message: err.message || 'No se pudo desconectar Discord.',
        })
        toast(err.message || 'No se pudo desconectar Discord', 'error')
      })
      .finally(() => setBusy(false))
  }

  return (
    <main className="cd-page">
      <motion.section
        className="gg-role-apps cd-card"
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
      >
        <div className="gg-role-apps__head">
          <div>
            <h3>Todo tu torneo, sin salir de Discord</h3>
            <p>
              Inscribi tu equipo, hace check-in y enterate de tu proximo rival
              desde el mismo servidor donde ya chateas con tu equipo.
            </p>
          </div>
        </div>

        {linkStatus === 'needs-auth' ? (
          <div className="cd-actions">
            <Link className="gg-btn gg-btn--primary gg-btn--sm" to="/login">Iniciar sesion</Link>
            <Link className="gg-btn gg-btn--ghost gg-btn--sm" to="/register">Crear cuenta</Link>
          </div>
        ) : connected ? (
          <article className="gg-role-card active">
            <span className="gg-role-tag gg-role-tag--discord" data-text="DISCORD">
              <i>{Icon.discord}</i><b>DISCORD</b>
            </span>
            <div>
              <b>Ya estas conectado</b>
              <small>{user.discord.username}</small>
            </div>
            <button className="gg-btn gg-btn--ghost gg-btn--sm" onClick={disconnect} disabled={busy}>
              {busy ? 'Desconectando...' : 'Desconectar'}
            </button>
          </article>
        ) : (
          <button className="gg-btn gg-btn--primary" onClick={connect} disabled={busy || linkStatus === 'linking'}>
            {Icon.discord} {busy || linkStatus === 'linking' ? 'Conectando...' : 'Conectar con Discord'}
          </button>
        )}

        {teamDraft && (
          connected ? (
            <div className="cd-return">
              <div>
                <b>Discord listo</b>
                <small>Tu equipo te espera tal como lo dejaste.</small>
              </div>
              <button className="gg-btn gg-btn--primary gg-btn--sm" onClick={() => returnToTeamDraft(navigate)}>
                Volver a mi equipo {Icon.chevronRight}
              </button>
            </div>
          ) : (
            <p className="cd-hint">Guardamos tu equipo. Cuando conectes Discord te aparece el boton para volver a terminarlo.</p>
          )
        )}

        {linkMessage && linkStatus !== 'needs-auth' && linkStatus !== 'idle' && (
          <p className="cd-hint">{linkMessage}</p>
        )}
      </motion.section>
    </main>
  )
}

