export const config = {
  port: Number(process.env.PORT) || 4000,
  env: process.env.NODE_ENV || 'development',
  isProd: process.env.NODE_ENV === 'production',
  clientOrigin: process.env.CLIENT_ORIGIN || 'http://localhost:5173',

  mongoEnabled: process.env.MONGODB_ENABLED !== 'false',
  mongoUri: process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/glitchgang',

  jwt: {
    secret: process.env.JWT_SECRET || 'change-this-dev-secret-min-32-chars!!',
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  },

  cookie: {
    name: process.env.AUTH_COOKIE_NAME || 'auth_token',
    secure: process.env.AUTH_COOKIE_SECURE === 'true' || process.env.NODE_ENV === 'production',
    sameSite: process.env.AUTH_COOKIE_SAME_SITE || 'lax',
    domain: process.env.AUTH_COOKIE_DOMAIN || undefined,
  },

  csrf: {
    cookieName: process.env.CSRF_COOKIE_NAME || 'csrf_token',
    headerName: process.env.CSRF_HEADER_NAME || 'x-csrf-token',
  },

  redis: {
    url: process.env.REDIS_URL || '',
  },

  smtp: {
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: Number(process.env.SMTP_PORT) || 587,
    user: process.env.SMTP_USER || '',
    pass: process.env.SMTP_PASS || '',
    from: process.env.SMTP_FROM || process.env.SMTP_USER || 'noreply@glitchgang.gg',
  },

  discord: {
    clientId: process.env.DISCORD_CLIENT_ID || '',
    clientSecret: process.env.DISCORD_CLIENT_SECRET || '',
    redirectUri: process.env.DISCORD_AUTH_REDIRECT_URI || process.env.DISCORD_REDIRECT_URI || 'http://localhost:4000/api/auth/discord/callback',
  },

  whatsapp: {
    graphVersion:  process.env.WHATSAPP_GRAPH_VERSION || 'v23.0',
    phoneNumberId: process.env.WHATSAPP_PHONE_NUMBER_ID || '',
    accessToken:   process.env.WHATSAPP_ACCESS_TOKEN || '',
    // Template used to deliver the OTP (falls back to a plain text message).
    otpTemplate:   process.env.WHATSAPP_OTP_TEMPLATE_NAME || '',
    // When the Cloud API isn't configured (local dev), return the code in the
    // API response so the flow is still testable end to end.
    devReturnCode: process.env.NODE_ENV !== 'production',
  },

  microsoft: {
    clientId:     process.env.MICROSOFT_CLIENT_ID     || '',
    clientSecret: process.env.MICROSOFT_CLIENT_SECRET || '',
    redirectUri:  process.env.MICROSOFT_REDIRECT_URI  || 'http://localhost:4000/api/university/microsoft/callback',
    tenantId:     process.env.MICROSOFT_TENANT_ID     || 'common',
    autoApprove:  process.env.UNIVERSITY_AUTO_APPROVE_EMAIL_MATCH !== 'false',
  },

  // Cerebro IA (ver services/ai.service.js). GG (asistente web) usa Gemini.
  ai: {
    strategy: process.env.AI_STRATEGY || 'failover',
    maxTokens: Number(process.env.AI_MAX_TOKENS) || 1024,
    providers: {
      gemini: {
        key: process.env.GEMINI_API_KEY || '',
        model: process.env.GEMINI_MODEL || 'gemini-flash-lite-latest',
        fallbackModels: (process.env.GEMINI_FALLBACK_MODELS || 'gemini-flash-lite-latest,gemini-3.5-flash-lite,gemini-3.1-flash-lite,gemini-2.0-flash-lite').split(',').map(m => m.trim()).filter(Boolean),
      },
      claude: { key: process.env.ANTHROPIC_API_KEY || '', model: process.env.ANTHROPIC_MODEL || 'claude-haiku-4-5-20251001' },
      openai: { key: process.env.OPENAI_API_KEY || '', model: process.env.OPENAI_MODEL || 'gpt-4o-mini' },
    },
  },

  matchStats: {
    visionEnabled: process.env.MATCH_STATS_VISION_ENABLED !== 'false',
    model: process.env.GEMINI_STATS_MODEL || process.env.GEMINI_MODEL || 'gemini-flash-lite-latest',
    timeoutMs: Math.min(60000, Math.max(5000, Number(process.env.MATCH_STATS_TIMEOUT_MS) || 45000)),
    requestsPerMinute: Math.min(20, Math.max(1, Number(process.env.MATCH_STATS_REQUESTS_PER_MINUTE) || 4)),
    repairEnabled: process.env.MATCH_STATS_REPAIR_ENABLED !== 'false',
  },
  // Grabaciones de voz de /start-match (services/matchRecordings.service.js).
  // Fuera de /uploads (que es publico): solo se sirven al arbitro del torneo.
  matchRecordings: {
    dir: process.env.MATCH_RECORDINGS_DIR || '',
    // "Si no hay reclamos, se elimina automaticamente a los 30 dias" (aviso
    // del bot en el canal). Con reclamo, se cuenta desde que se decide.
    retentionDays: Math.max(1, Number(process.env.MATCH_RECORDINGS_RETENTION_DAYS) || 30),
    maxTrackMb: Math.max(1, Number(process.env.MATCH_RECORDINGS_MAX_TRACK_MB) || 200),
  },
  // Lectura automatica de /report y avance del bracket (services/matchResults.service.js).
  matchResults: {
    autoReadEnabled: process.env.MATCH_RESULTS_AUTO_READ !== 'false',
    // Confianza minima de la IA (general y del ganador) para validar sola.
    confidence: Math.min(1, Math.max(0.5, Number(process.env.MATCH_RESULTS_CONFIDENCE) || 0.85)),
    // Cuota del sistema (no del jugador) para lecturas automaticas.
    readsPerMinute: Math.min(60, Math.max(1, Number(process.env.MATCH_RESULTS_READS_PER_MINUTE) || 10)),
    // Escalado de casos sin tomar (minutos).
    escalateMinutes: Math.max(1, Number(process.env.MATCH_RESULTS_ESCALATE_MINUTES) || 10),
    escalateUrgentMinutes: Math.max(1, Number(process.env.MATCH_RESULTS_ESCALATE_URGENT_MINUTES) || 20),
  },
  // Verificacion de cuentas de Mobile Legends por codigo al correo del juego
  // (API comunitaria Rone Arena, no oficial). Ver services/gameAccount.service.js.
  gameAccounts: {
    enabled: process.env.GAME_ACCOUNT_VERIFY_ENABLED !== 'false',
    baseUrl: (process.env.GAME_ACCOUNT_VERIFY_URL || 'https://arena.rone.dev/api').replace(/\/+$/, ''),
    timeoutMs: Math.min(30000, Math.max(3000, Number(process.env.GAME_ACCOUNT_VERIFY_TIMEOUT_MS) || 12000)),
    // Hosts extra que se aceptan como `alternative_endpoint` en un 503 (ademas
    // del mismo dominio que baseUrl). Separados por coma, ej. "mirror.ejemplo.com".
    altHosts: String(process.env.GAME_ACCOUNT_VERIFY_ALT_HOSTS || '').split(',').map(h => h.trim().toLowerCase()).filter(Boolean),
  },
  universityDevBypass: process.env.UNIVERSITY_DEV_BYPASS === 'true',
}

// Con el secreto por defecto (visible en el repo) cualquiera puede firmar una
// sesión de admin. Fuera de local (producción o un CLIENT_ORIGIN público) el
// servidor no arranca con un secreto ausente, corto o de ejemplo.
const publicDeploy = config.isProd || !/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?(,|$)/.test(config.clientOrigin)
const rawSecret = process.env.JWT_SECRET || ''
const weakSecret = rawSecret.length < 32 || /change-this|replace-with/i.test(rawSecret)
if (publicDeploy && weakSecret) {
  throw new Error('JWT_SECRET ausente o débil: define uno aleatorio de 64+ caracteres (node -e "console.log(require(\'crypto\').randomBytes(48).toString(\'hex\'))")')
}
if (publicDeploy && config.universityDevBypass) {
  throw new Error('UNIVERSITY_DEV_BYPASS no puede estar activo en un despliegue público.')
}
