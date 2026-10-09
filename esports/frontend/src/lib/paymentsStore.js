const pad = (n, len) => String(n).padStart(len, '0')

export function checksum(base) {
  let h = 0
  for (let i = 0; i < base.length; i++) h = (h * 31 + base.charCodeAt(i)) % 1296
  return h.toString(36).toUpperCase().padStart(2, '0')
}

export function getPaymentByTournament(tournamentId) {
  return loadPayments().find(p => String(p.tournamentId) === String(tournamentId)) || null
}

export function verifyCode(rawCode) {
  const code = String(rawCode || '').trim().toUpperCase()
  const m = /^GG-(\d{2})-(\d{5})-(\d{6})-([0-9A-Z]{2})$/.exec(code)
  if (!m) return { valid: false, reason: 'Formato invalido' }
  const [, tt, amt, date, cc] = m
  const expected = checksum(`${tt}${amt}${date}`)
  const valid = expected === cc
  const yy = date.slice(0, 2)
  const mm = date.slice(2, 4)
  const dd = date.slice(4, 6)
  return {
    valid,
    reason: valid ? 'Checksum correcto' : 'Checksum no coincide',
    code,
    tournamentId: Number(tt),
    amount: Number(amt) / 100,
    date: `20${yy}-${mm}-${dd}`,
    record: null,
  }
}

export function loadPayments() {
  return []
}

export function addPayment() {
  console.warn('[GlitchGang] Pagos locales deshabilitados. Usa /payments/checkout.')
  return null
}

export function getPaymentByCode() {
  return null
}

