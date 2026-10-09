import { useState } from 'react'
import { Link } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import AuthLayout from '../../layouts/AuthLayout.jsx'
import Input from '../../components/Input/Input.jsx'
import Button from '../../components/Button/Button.jsx'
import { useAuth } from '../../context/AuthContext.jsx'
import { useLang } from '../../i18n/LangContext.jsx'
import { Icon } from '../../components/icons/Icons.jsx'
import '../Login/Login.css'

export default function ForgotPassword() {
  const { t } = useLang()
  const { forgotPassword } = useAuth()

  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState('')
  const [resetToken, setResetToken] = useState('')

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!email) { setError('Introduce tu email'); return }
    setError('')
    setLoading(true)
    try {
      const result = await forgotPassword(email)
      setResetToken(result.resetToken || '')
      setSent(true)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <AuthLayout title={t.auth.forgotTitle} sub={t.auth.forgotSub}>
      <AnimatePresence mode="wait">
        {sent ? (
          <motion.div key="sent" className="gg-sent"
            initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.4 }}>
            <div className="gg-sent__icon">{Icon.check}</div>
            <h2>{t.auth.sentTitle}</h2>
            <p>{t.auth.sentSub} <b>{email}</b></p>
            {resetToken && (
              <Link className="gg-forgot" to={`/reset-password?token=${resetToken}`}>
                {t.auth.resetLink || 'Definir nueva contraseña'}
              </Link>
            )}
            <Link to="/login"><Button variant="ghost" size="sm">{t.auth.backToLogin}</Button></Link>
          </motion.div>
        ) : (
          <motion.form key="form" className="gg-login-form" onSubmit={handleSubmit} noValidate
            initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            <Input label={t.auth.email} type="email" placeholder="tu@correo.com" autoComplete="email" autoCapitalize="none" autoCorrect="off" spellCheck={false}
              value={email} onChange={(e) => setEmail(e.target.value)} error={error} />
            <Button variant="primary" size="lg" className="gg-btn--full" type="submit" disabled={loading}>
              {loading ? <span className="gg-auth-spinner" /> : t.auth.forgotBtn}
            </Button>
            <p className="gg-auth-link">
              <Link to="/login">{t.auth.backToLogin}</Link>
            </p>
          </motion.form>
        )}
      </AnimatePresence>
    </AuthLayout>
  )
}

