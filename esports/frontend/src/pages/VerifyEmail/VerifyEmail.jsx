import { useEffect, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import AuthLayout from '../../layouts/AuthLayout.jsx'
import Button from '../../components/Button/Button.jsx'
import { useAuth } from '../../context/AuthContext.jsx'
import { useLang } from '../../i18n/LangContext.jsx'
import { api } from '../../lib/api.js'
import '../Login/Login.css'

// Destino del enlace del correo de verificación (/verify-email?token=...).
// Confirma el token una sola vez y refresca la sesión si hay una abierta.
export default function VerifyEmail() {
  const { lang } = useLang()
  const { user, refreshUser } = useAuth()
  const [params] = useSearchParams()
  const token = params.get('token') || ''
  const [status, setStatus] = useState(token ? 'loading' : 'error')
  const [error, setError] = useState(token ? '' : (lang === 'es' ? 'El enlace no es válido.' : 'The link is invalid.'))
  const sent = useRef(false)

  useEffect(() => {
    // StrictMode monta dos veces: el token es de un solo uso.
    if (!token || sent.current) return
    sent.current = true
    api('/auth/verify-email', { method: 'POST', body: JSON.stringify({ token }) })
      .then(() => {
        setStatus('done')
        if (user) refreshUser?.()
      })
      .catch(err => {
        setStatus('error')
        setError(err.message)
      })
  }, [token, user, refreshUser])

  return (
    <AuthLayout
      title={lang === 'es' ? 'Verificar correo' : 'Verify email'}
      sub={lang === 'es' ? 'Confirmamos tu dirección de correo.' : 'We are confirming your email address.'}
    >
      <div className="gg-sent">
        {status === 'loading' && <h2>{lang === 'es' ? 'Verificando…' : 'Verifying…'}</h2>}
        {status === 'done' && <h2>{lang === 'es' ? 'Correo verificado' : 'Email verified'}</h2>}
        {status === 'error' && (
          <>
            <h2>{lang === 'es' ? 'No se pudo verificar' : 'Could not verify'}</h2>
            <p className="gg-auth-err">{error}</p>
            {user && <p>{lang === 'es' ? 'Puedes pedir un enlace nuevo en Ajustes → Cuenta.' : 'You can request a new link in Settings → Account.'}</p>}
          </>
        )}
        {status !== 'loading' && (
          <Link to={user ? '/dashboard' : '/login'}>
            <Button variant="primary">{user ? (lang === 'es' ? 'Ir al panel' : 'Go to dashboard') : (lang === 'es' ? 'Iniciar sesión' : 'Log in')}</Button>
          </Link>
        )}
      </div>
    </AuthLayout>
  )
}

