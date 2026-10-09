import { useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import AuthLayout from '../../layouts/AuthLayout.jsx'
import Input from '../../components/Input/Input.jsx'
import Button from '../../components/Button/Button.jsx'
import { useAuth } from '../../context/AuthContext.jsx'
import { useLang } from '../../i18n/LangContext.jsx'
import '../Login/Login.css'

export default function ResetPassword() {
  const { t, lang } = useLang()
  const { resetPassword } = useAuth()
  const [params] = useSearchParams()
  const token = params.get('token') || ''
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState('')

  const submit = async (event) => {
    event.preventDefault()
    if (!token) return setError(lang === 'es' ? 'El enlace no es válido.' : 'The link is invalid.')
    if (password.length < 8) return setError(lang === 'es' ? 'Usa al menos 8 caracteres.' : 'Use at least 8 characters.')
    if (password !== confirm) return setError(lang === 'es' ? 'Las contraseñas no coinciden.' : 'Passwords do not match.')

    setLoading(true)
    setError('')
    try {
      await resetPassword(token, password)
      setDone(true)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <AuthLayout
      title={lang === 'es' ? 'Nueva contraseña' : 'New password'}
      sub={lang === 'es' ? 'Protege tu cuenta con una contraseña segura.' : 'Protect your account with a secure password.'}
    >
      {done ? (
        <div className="gg-sent">
          <h2>{lang === 'es' ? 'Contraseña actualizada' : 'Password updated'}</h2>
          <Link to="/login"><Button variant="primary">{t.auth.loginBtn}</Button></Link>
        </div>
      ) : (
        <form className="gg-login-form" onSubmit={submit}>
          <Input label={t.auth.password} type="password" value={password} onChange={(event) => setPassword(event.target.value)} />
          <Input label={t.auth.confirmPwd} type="password" value={confirm} onChange={(event) => setConfirm(event.target.value)} />
          {error && <p className="gg-auth-err">{error}</p>}
          <Button variant="primary" type="submit" disabled={loading}>{loading ? '...' : (lang === 'es' ? 'Actualizar contraseña' : 'Update password')}</Button>
        </form>
      )}
    </AuthLayout>
  )
}

