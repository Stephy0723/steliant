/**
 * TOTP implementation per RFC 6238 using only Node.js built-ins.
 * Compatible with Google Authenticator, Authy, and any TOTP app.
 */

import crypto from 'node:crypto'

const BASE32_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'

function base32Encode(bytes) {
  let bits = 0, value = 0, output = ''
  for (const byte of bytes) {
    value = (value << 8) | byte
    bits += 8
    while (bits >= 5) {
      output += BASE32_CHARS[(value >>> (bits - 5)) & 31]
      bits -= 5
    }
  }
  if (bits > 0) output += BASE32_CHARS[(value << (5 - bits)) & 31]
  while (output.length % 8 !== 0) output += '='
  return output
}

function base32Decode(input) {
  const str = input.toUpperCase().replace(/=+$/, '').replace(/\s/g, '')
  const bytes = []
  let bits = 0, value = 0
  for (const char of str) {
    const idx = BASE32_CHARS.indexOf(char)
    if (idx === -1) continue
    value = (value << 5) | idx
    bits += 5
    if (bits >= 8) {
      bytes.push((value >>> (bits - 8)) & 0xff)
      bits -= 8
    }
  }
  return Buffer.from(bytes)
}

function hotp(secretBytes, counter, digits = 6) {
  const buf = Buffer.alloc(8)
  let temp = counter
  for (let i = 7; i >= 0; i--) {
    buf[i] = temp & 0xff
    temp = Math.floor(temp / 256)
  }
  const hmac = crypto.createHmac('sha1', secretBytes).update(buf).digest()
  const offset = hmac[hmac.length - 1] & 0xf
  const otp = (
    ((hmac[offset] & 0x7f) << 24) |
    ((hmac[offset + 1] & 0xff) << 16) |
    ((hmac[offset + 2] & 0xff) << 8) |
    (hmac[offset + 3] & 0xff)
  ) % Math.pow(10, digits)
  return String(otp).padStart(digits, '0')
}

function currentStep(period = 30) {
  return Math.floor(Date.now() / 1000 / period)
}

export function generateSecret(bytes = 20) {
  return base32Encode(crypto.randomBytes(bytes))
}

export function generateToken(secret, period = 30) {
  return hotp(base32Decode(secret), currentStep(period))
}

export function verifyToken(token, secret, period = 30, window = 1) {
  const step = currentStep(period)
  const secretBytes = base32Decode(secret)
  for (let i = -window; i <= window; i++) {
    if (hotp(secretBytes, step + i) === String(token).trim()) return true
  }
  return false
}

export function generateUri(email, issuer, secret) {
  const params = new URLSearchParams({ secret, issuer, algorithm: 'SHA1', digits: '6', period: '30' })
  return `otpauth://totp/${encodeURIComponent(issuer)}:${encodeURIComponent(email)}?${params}`
}
