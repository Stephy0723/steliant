import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useSearchParams, Link } from 'react-router-dom'
import AuthLayout from '../../layouts/AuthLayout.jsx'
import Input from '../../components/Input/Input.jsx'
import Button from '../../components/Button/Button.jsx'
import { useAuth } from '../../context/AuthContext.jsx'
import { useLang } from '../../i18n/LangContext.jsx'
import { Icon } from '../../components/icons/Icons.jsx'
import { api } from '../../lib/api.js'
import { GAMES_BY_CATEGORY } from '../../data/games.js'
import { AMERICA_COUNTRIES, AMERICA_COUNTRY_CODES } from '../../data/countries.js'
import { DIAL_CODES, UNIQUE_DIAL_CODES, splitDialCode } from '../../data/dialCodes.js'
import { unlockBannerGift } from '../../data/bannerGift.js'
import '../Login/Login.css'
import './Register.css'

const EXPERIENCE = ['rookie', 'mid', 'pro']
const PLATFORMS = ['pc', 'mobile', 'console']
const LOOKING_FOR = ['tournaments', 'team_duo', 'fun']
const GENDERS = ['male', 'female', 'non_binary', 'prefer_not_to_say', 'other']

function normalizeSearch(value = '') {
  return String(value).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
}

export default function Register() {
  const { t, lang } = useLang()
  const copy = t.register
  const steps = copy.steps
  const { register } = useAuth()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const [step, setStep] = useState(0)
  // Presentes cuando se llega desde el login con Discord (auth.controller.js
  // redirige aqui si no encuentra una cuenta existente) o desde un enlace
  // de referido (?ref=CODE) compartido por /referir en el bot.
  const [discordHint] = useState(() => {
    const discordId = searchParams.get('discord_id') || ''
    const discordUsername = searchParams.get('discord_username') || ''
    return discordId ? { discordId, discordUsername } : null
  })
  const [countries, setCountries] = useState(AMERICA_COUNTRIES)
  const [countryQuery, setCountryQuery] = useState('')
  const [countryOpen, setCountryOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [errors, setErrors] = useState({})
  const names = useMemo(() => new Intl.DisplayNames([lang], { type: 'region' }), [lang])
  const [form, setForm] = useState(() => ({
    firstName: '',
    lastName: '',
    countryCode: 'RD',
    phoneCountryDial: '+1',
    phoneNumber: '',
    birthDate: '',
    gender: '',
    games: [],
    experienceLevel: 'rookie',
    mainPlatform: 'pc',
    lookingFor: ['tournaments'],
    nick: '',
    email: searchParams.get('email') || '',
    password: '',
    confirm: '',
    referralCode: searchParams.get('ref') || '',
    acceptedTerms: false,
  }))

  useEffect(() => {
    api('/countries')
      .then(({ countries: items }) => {
        const americanItems = Array.isArray(items)
          ? items.filter(item => AMERICA_COUNTRY_CODES.includes(item.code))
          : []
        // Solo si la BD trae la lista completa: una colección a medio sembrar
        // (p.ej. solo RD) dejaba el selector con 1 país.
        if (americanItems.length >= AMERICA_COUNTRIES.length) setCountries(americanItems)
      })
      .catch(() => {})
  }, [])

  const set = (key, value) => {
    setForm(prev => ({ ...prev, [key]: value }))
    // El error de un campo se borra al editarlo (antes quedaba "Mínimo 8
    // caracteres" visible aunque ya se hubiera escrito una contraseña válida).
    setErrors(prev => (prev[key] ? { ...prev, [key]: undefined } : prev))
  }
  const countryName = (code) => code === 'RD' ? (lang === 'es' ? 'República Dominicana' : 'Dominican Republic') : names.of(code)
  const countryLabel = ({ code, number }) => `${number} · ${countryName(code)} (${code})`
  const selectedCountry = countries.find(country => country.code === form.countryCode)

  useEffect(() => {
    if (selectedCountry) setCountryQuery(countryLabel(selectedCountry))
  }, [lang, selectedCountry?.code, selectedCountry?.number])

  const filteredCountries = useMemo(() => {
    const query = normalizeSearch(countryQuery)
    // El input muestra la etiqueta del país elegido: si no se ha escrito nada
    // nuevo, no se usa como filtro (si no, la lista solo mostraba ese país).
    if (!query || (selectedCountry && countryQuery === countryLabel(selectedCountry))) return countries

    return countries.filter(country => {
      const label = normalizeSearch(countryLabel(country))
      return label.includes(query)
        || country.code.toLowerCase().includes(query)
        || country.number.includes(query)
    })
  }, [countries, countryQuery, lang, selectedCountry])

  const selectCountry = (code) => {
    const country = countries.find(item => item.code === code)
    setForm(prev => ({
      ...prev,
      countryCode: code,
      phoneCountryDial: DIAL_CODES[code] || '+',
    }))
    if (country) setCountryQuery(countryLabel(country))
    setCountryOpen(false)
  }

  const categoryLabel = (category) => copy.categories?.[category.id] || category.name || copy.otherGames || (lang === 'es' ? 'Otros juegos' : 'Other games')
  const selectedGamesLabel = `${copy.gamesCount}: ${form.games.length}`

  const toggle = (key, value) => {
    setForm(prev => {
      const exists = prev[key].includes(value)
      return { ...prev, [key]: exists ? prev[key].filter(item => item !== value) : [...prev[key], value] }
    })
  }

  const validateStep = (targetStep = step) => {
    const e = {}
    if (targetStep === 0) {
      if (form.firstName.trim().length < 2) e.firstName = copy.errors.firstName
      if (form.lastName.trim().length < 2) e.lastName = copy.errors.lastName
      if (!form.countryCode) e.countryCode = copy.errors.country
      if (!form.phoneNumber.trim()) e.phoneNumber = copy.errors.phone
      if (!form.birthDate) e.birthDate = copy.errors.birthDate
      if (!form.gender) e.gender = copy.errors.gender
    }
    if (targetStep === 1 && form.games.length === 0) e.games = copy.errors.games
    if (targetStep === 2) {
      if (!form.experienceLevel) e.experienceLevel = copy.errors.level
      if (!form.mainPlatform) e.mainPlatform = copy.errors.platform
      if (form.lookingFor.length === 0) e.lookingFor = copy.errors.goals
    }
    if (targetStep === 3) {
      if (form.nick.trim().length < 3) e.nick = copy.errors.nick
      if (!form.email.includes('@')) e.email = copy.errors.email
      if (form.password.length < 8) e.password = copy.errors.password
      if (form.password !== form.confirm) e.confirm = copy.errors.confirm
      if (!form.acceptedTerms) e.acceptedTerms = copy.errors.terms
    }
    setErrors(e)
    return Object.keys(e).length === 0
  }

  const next = () => {
    if (validateStep()) setStep(prev => Math.min(prev + 1, steps.length - 1))
  }

  const submit = async (event) => {
    event.preventDefault()
    if (!validateStep(3)) return
    setLoading(true)
    setErrors({})
    try {
      await register({
        firstName: form.firstName,
        lastName: form.lastName,
        countryCode: form.countryCode,
        phoneCountryDial: form.phoneCountryDial,
        phoneNumber: form.phoneNumber,
        birthDate: form.birthDate,
        gender: form.gender,
        games: form.games,
        experienceLevel: form.experienceLevel,
        mainPlatform: form.mainPlatform,
        lookingFor: form.lookingFor,
        nick: form.nick,
        email: form.email,
        password: form.password,
        referralCode: form.referralCode,
        acceptedTerms: form.acceptedTerms,
        ...(discordHint ? { discordId: discordHint.discordId, discordUsername: discordHint.discordUsername } : {}),
      })
      unlockBannerGift()
      localStorage.setItem('gg-welcome-pending', '1')
      navigate('/dashboard', { replace: true })
    } catch (err) {
      setErrors({ general: err.message })
    } finally {
      setLoading(false)
    }
  }

  return (
    <AuthLayout title={t.auth.registerTitle} sub={t.auth.registerSub}>
      <form className="gg-login-form gg-register-flow" onSubmit={submit} noValidate>
        <div className="gg-register-body">
          <div className="gg-register-steps">
            {steps.map((label, index) => (
              <button key={label} type="button" className={`gg-register-step ${index === step ? 'active' : ''} ${index < step ? 'done' : ''}`} onClick={() => index < step && setStep(index)}>
                <span>{index + 1}</span>{label}
              </button>
            ))}
          </div>

        {step === 0 && (
          <section className="gg-register-pane">
            <div className="gg-register-grid">
              <Input label={copy.firstName} value={form.firstName} onChange={event => set('firstName', event.target.value)} error={errors.firstName} />
              <Input label={copy.lastName} value={form.lastName} onChange={event => set('lastName', event.target.value)} error={errors.lastName} />
            </div>
            <div className="gg-register-country">
              <span>{copy.country}</span>
              <div className="gg-country-combobox">
                <input
                  type="search"
                  value={countryQuery}
                  placeholder={copy.countryPlaceholder}
                  autoComplete="off"
                  onFocus={event => { event.target.select(); setCountryOpen(true) }}
                  onBlur={() => window.setTimeout(() => setCountryOpen(false), 120)}
                  onChange={event => {
                    setCountryQuery(event.target.value)
                    setForm(prev => ({ ...prev, countryCode: '', phoneCountryDial: '+' }))
                    setCountryOpen(true)
                  }}
                />
                {countryOpen && (
                  <div className="gg-country-results">
                    {filteredCountries.length > 0 ? filteredCountries.map(country => (
                      <button
                        key={country.code}
                        type="button"
                        className={country.code === form.countryCode ? 'active' : ''}
                        onMouseDown={event => event.preventDefault()}
                        onClick={() => selectCountry(country.code)}
                      >
                        <strong>{countryName(country.code)}</strong>
                        <span>{country.number} · {country.code}</span>
                      </button>
                    )) : (
                      <p>{copy.noCountries}</p>
                    )}
                  </div>
                )}
              </div>
              {errors.countryCode && <small>{errors.countryCode}</small>}
            </div>
            <div className="gg-register-phone">
              <label>
                <span>{copy.dialCode}</span>
                <select
                  value={form.phoneCountryDial}
                  onChange={event => set('phoneCountryDial', event.target.value)}
                  style={countryOpen ? { visibility: 'hidden' } : undefined}
                >
                  {UNIQUE_DIAL_CODES.map(code => <option key={code} value={code}>{code}</option>)}
                </select>
              </label>
              <Input
                label={copy.phone}
                value={form.phoneNumber}
                onChange={event => {
                  const raw = event.target.value
                  const split = splitDialCode(raw)
                  if (split) {
                    setForm(prev => ({ ...prev, phoneCountryDial: split.dialCode, phoneNumber: split.number.slice(0, 15) }))
                    return
                  }
                  if (raw.startsWith('+') || raw.startsWith('00')) {
                    set('phoneNumber', raw.slice(0, 20))
                    return
                  }
                  set('phoneNumber', raw.replace(/\D/g, '').slice(0, 15))
                }}
                error={errors.phoneNumber}
                inputMode="tel"
                maxLength={20}
              />
            </div>
            <div className="gg-register-grid">
              <Input label={copy.birthDate} type="date" value={form.birthDate} onChange={event => set('birthDate', event.target.value)} error={errors.birthDate} />
              <label className="gg-register-country">
                <span>{copy.gender}</span>
                <select value={form.gender} onChange={event => set('gender', event.target.value)}>
                  <option value="">{copy.select}</option>
                  {GENDERS.map(gender => <option key={gender} value={gender}>{copy.genders[gender]}</option>)}
                </select>
                {errors.gender && <small>{errors.gender}</small>}
              </label>
            </div>
          </section>
        )}

        {step === 1 && (
          <section className="gg-register-pane">
            <div className="gg-register-pane__head">
              <h3>{copy.chooseGames}</h3>
              <span>{selectedGamesLabel}</span>
            </div>
            <div className="gg-register-catalog">
              {GAMES_BY_CATEGORY.map(category => (
                <div className="gg-register-category" key={category.id}>
                  <h4>{categoryLabel(category)}</h4>
                  <div className="gg-register-games">
                    {category.games.map(game => (
                      <button key={game.id} type="button" className={`gg-register-game notranslate ${form.games.includes(game.id) ? 'active' : ''}`} style={{ '--game-color': game.color }} onClick={() => toggle('games', game.id)} translate="no">
                        <span className="gg-register-game__thumb">
                          <img src={game.images?.logo || game.image} alt="" loading="lazy" />
                        </span>
                        <b>{game.name}</b>
                        <small>{copy.categories?.[game.categoryId] || game.category}</small>
                        {form.games.includes(game.id) && <i className="gg-register-game__check">{Icon.check}</i>}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
            {errors.games && <p className="gg-auth-err">{errors.games}</p>}
          </section>
        )}

        {step === 2 && (
          <section className="gg-register-pane">
            <h3>{copy.experienceTitle}</h3>
            <div className="gg-register-options">
              {EXPERIENCE.map(option => (
                <button key={option} type="button" className={form.experienceLevel === option ? 'active' : ''} onClick={() => set('experienceLevel', option)}>
                  <b>{copy.experience[option][0]}</b><span>{copy.experience[option][1]}</span>
                </button>
              ))}
            </div>
            <h3>{copy.mainPlatform}</h3>
            <div className="gg-register-options compact">
              {PLATFORMS.map(option => <button key={option} type="button" className={form.mainPlatform === option ? 'active' : ''} onClick={() => set('mainPlatform', option)}>{copy.platforms[option]}</button>)}
            </div>
            <h3>{copy.lookingFor}</h3>
            <div className="gg-register-options compact">
              {LOOKING_FOR.map(option => <button key={option} type="button" className={form.lookingFor.includes(option) ? 'active' : ''} onClick={() => toggle('lookingFor', option)}>{copy.goals[option]}</button>)}
            </div>
            {errors.lookingFor && <p className="gg-auth-err">{errors.lookingFor}</p>}
          </section>
        )}

        {step === 3 && (
          <section className="gg-register-pane">
            <h3>{copy.credentials}</h3>
            <Input label={copy.gamerTag} placeholder="ProGamer123" name="username" autoComplete="username" autoCapitalize="none" autoCorrect="off" spellCheck={false} value={form.nick} onChange={event => set('nick', event.target.value)} error={errors.nick} />
            <Input label={t.auth.email} type="email" placeholder="you@example.com" name="email" autoComplete="email" autoCapitalize="none" autoCorrect="off" spellCheck={false} value={form.email} onChange={event => set('email', event.target.value)} error={errors.email} />
            <Input label={t.auth.password} type="password" placeholder={t.auth.password} value={form.password} onChange={event => set('password', event.target.value)} error={errors.password} />
            <Input label={t.auth.confirmPwd} type="password" placeholder={t.auth.confirmPwd} value={form.confirm} onChange={event => set('confirm', event.target.value)} error={errors.confirm} />
            <Input label={copy.referral} value={form.referralCode} onChange={event => set('referralCode', event.target.value)} />
            <label className="gg-register-terms">
              <input type="checkbox" checked={form.acceptedTerms} onChange={event => set('acceptedTerms', event.target.checked)} />
              <span>{copy.termsPrefix} <Link to="/terminos" target="_blank" rel="noopener noreferrer">{copy.termsLink}</Link> {copy.termsJoin} <Link to="/terminos" target="_blank" rel="noopener noreferrer">{copy.privacyLink}</Link>.</span>
            </label>
            {errors.acceptedTerms && <p className="gg-auth-err" style={{ marginTop: -8 }}>{errors.acceptedTerms}</p>}
          </section>
        )}

          {errors.general && <p className="gg-auth-err">{errors.general}</p>}
        </div>

        <div className="gg-register-footer">
          <div className="gg-register-actions">
            {step > 0 && <Button variant="ghost" size="lg" type="button" onClick={() => setStep(prev => prev - 1)}>{copy.back}</Button>}
            {step < steps.length - 1
              ? <Button variant="primary" size="lg" type="button" onClick={next}>{copy.continue}</Button>
              : <Button variant="primary" size="lg" type="submit" disabled={loading}>{loading ? <span className="gg-auth-spinner" /> : t.auth.registerBtn}</Button>}
          </div>

          <p className="gg-auth-link">
            {t.auth.hasAccount} <Link to="/login">{t.auth.loginLink}</Link>
          </p>
        </div>
      </form>
    </AuthLayout>
  )
}

