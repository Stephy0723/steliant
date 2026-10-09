import axios from 'axios'
import { config } from '../config/index.js'

const DISCORD_API = 'https://discord.com/api/v10'
const DISCORD_OAUTH = 'https://discord.com/api/oauth2'

export function getDiscordAuthUrl(state = '') {
  const params = new URLSearchParams({
    client_id: config.discord.clientId,
    redirect_uri: config.discord.redirectUri,
    response_type: 'code',
    scope: 'identify email',
    state,
  })
  return `${DISCORD_OAUTH}/authorize?${params}`
}

export async function exchangeDiscordCode(code) {
  const { data: tokens } = await axios.post(
    `${DISCORD_OAUTH}/token`,
    new URLSearchParams({
      client_id: config.discord.clientId,
      client_secret: config.discord.clientSecret,
      grant_type: 'authorization_code',
      code,
      redirect_uri: config.discord.redirectUri,
    }),
    { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
  )
  return tokens
}

export async function getDiscordUser(accessToken) {
  const { data } = await axios.get(`${DISCORD_API}/users/@me`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  })
  return data
}
