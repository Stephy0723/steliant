import { useEffect, useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import AuthLayout from '../../layouts/AuthLayout.jsx'
import Input from '../../components/Input/Input.jsx'
import Button from '../../components/Button/Button.jsx'
import { useAuth } from '../../context/AuthContext.jsx'
import { useLang } from '../../i18n/LangContext.jsx'
import './Login.css'

export default function Login() {
  const { t } = useLang()
  const { login, verifyTwoFactor, user, authReady } = useAuth()
  const navigate = useNavigate()

  const [identifier, setIdentifier] = useState('')
  const [password, setPassword] = useState('')
  const [remember, setRemember] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  // Segundo paso cuando la cuenta tiene 2FA: token temporal (5 min) + código.
  const [tempToken, setTempToken] = useState('')
  const [code, setCode] = useState('')

  // Una sesión almacenada se vuelve a validar al cargar la app. Cuando siga
  // siendo válida, /login no debe pedirle credenciales al usuario otra vez.
  useEffect(() => {
    if (authReady && user) navigate('/dashboard', { replace: true })
  }, [authReady, user, navigate])

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const result = await login(identifier.trim(), password, remember)
      if (result?.requiresTwoFactor) {
        setTempToken(result.tempToken)
        setCode('')
        return
      }
      navigate('/dashboard', { replace: true })
    } catch (err) {
      setError(err.message || 'Error al iniciar sesión')
    } finally {
      setLoading(false)
    }
  }

  const handleVerify = async (e) => {
    e.preventDefault()
    if (!code.trim()) { setError('Escribe el código'); return }
    setError('')
    setLoading(true)
    try {
      await verifyTwoFactor(tempToken, code, remember)
      navigate('/dashboard', { replace: true })
    } catch (err) {
      // El token temporal dura 5 minutos: si venció hay que volver a entrar.
      if (err.status === 401) {
        setTempToken('')
        setError('El tiempo para el código expiró. Inicia sesión de nuevo.')
      } else {
        setError(err.message || 'Código incorrecto')
      }
    } finally {
      setLoading(false)
    }
  }

  if (user) return null

  if (tempToken) {
    return (
      <AuthLayout title="Verificación en dos pasos" sub="Escribe el código de 6 dígitos de tu app autenticadora o uno de tus códigos de respaldo.">
        <form className="gg-login-form" onSubmit={handleVerify} noValidate>
          <Input
            label="Código" type="text" inputMode="numeric" autoComplete="one-time-code" autoFocus
            placeholder="123456" maxLength={20}
            value={code} onChange={(e) => setCode(e.target.value)} required
          />

          {error && <p className="gg-auth-err">{error}</p>}

          <Button variant="primary" size="lg" className="gg-btn--full" type="submit" disabled={loading}>
            {loading ? <span className="gg-auth-spinner" /> : 'Verificar'}
          </Button>

          <p className="gg-auth-link">
            <button type="button" className="gg-forgot" onClick={() => { setTempToken(''); setCode(''); setError('') }}>
              Volver
            </button>
          </p>
        </form>
      </AuthLayout>
    )
  }

  return (
    <AuthLayout title={t.auth.loginTitle} sub={t.auth.loginSub}>
      <form className="gg-login-form" onSubmit={handleSubmit} noValidate>
        {/* En el celular el teclado ponia mayuscula a la primera letra y
            autocorregia el nick ("kairo" -> "Kairo"), y el login fallaba en
            ese dispositivo pero no en la compu. name/autoComplete dejan que
            el gestor de contrasenas del telefono llene y guarde bien. */}
        <Input
          label={t.auth.emailOrNick} type="text" placeholder="tu@correo.com o tu_nick"
          name="username" autoComplete="username"
          autoCapitalize="none" autoCorrect="off" spellCheck={false}
          value={identifier} onChange={(e) => setIdentifier(e.target.value)} required
          error={error && !identifier ? 'Campo requerido' : ''}
        />
        <Input
          name="password" autoComplete="current-password"
          label={t.auth.password} type="password" placeholder="••••••••"
          value={password} onChange={(e) => setPassword(e.target.value)} required
          error={error && !password ? 'Campo requerido' : ''}
        />

        {error && <p className="gg-auth-err">{error}</p>}

        <div className="gg-login-meta">
          <label className="gg-checkbox">
            <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} />
            <span>{t.auth.remember}</span>
          </label>
          <Link to="/forgot" className="gg-forgot">{t.auth.forgotLink}</Link>
        </div>

        <Button variant="primary" size="lg" className="gg-btn--full" type="submit" disabled={loading}>
          {loading ? <span className="gg-auth-spinner" /> : t.auth.loginBtn}
        </Button>

        <p className="gg-auth-link">
          {t.auth.noAccount} <Link to="/register">{t.auth.signUpLink}</Link>
        </p>
        <p className="gg-auth-terms">
          Al continuar aceptas los <Link to="/terminos" target="_blank" rel="noopener noreferrer">Términos y Condiciones</Link> y la Política de Privacidad.
        </p>
      </form>
    </AuthLayout>
  )
}

